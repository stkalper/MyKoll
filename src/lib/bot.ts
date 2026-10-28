import { randomBytes } from "node:crypto";
import { Bot, InlineKeyboard, type Context } from "grammy";
import { answer } from "./ask";
import {
  chatMode,
  claim,
  extractCall,
  hideCall,
  leaderboard,
  addReason,
  logCall,
  mightBeCall,
  openCalls,
  reasonsFor,
  resolveDue,
  setChatMode,
  touchChat,
  undoCall,
  UNDO_MINUTES,
  usd,
  voteScore,
  when,
  type CallRow,
  type ChatMode,
  type Draft,
} from "./calls";
import { config, llmEnabled } from "./config";
import { db } from "./db";
import { shareUrl } from "./receipts";
import { sourceLabel } from "./tatum";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const authorOf = (ctx: Context) => ({
  id: ctx.from!.id,
  name: ctx.from!.username ? `@${ctx.from!.username}` : ctx.from!.first_name,
});

function receiptText(call: CallRow, headline: string, reasons: string[] = []): string {
  const lines = [`🧾 <b>Receipt #${call.id}</b> · ${headline}`, `${esc(call.author_name)}: “${esc(call.quote)}”`, ""];
  lines.push(`<i>${esc(claim(call))}</i> · judged ${esc(when(call.deadline))}`);
  if (call.entry_price !== null && call.status === "open")
    lines.push(`${call.subject} was ${usd(call.entry_price)} when called · ${sourceLabel[call.price_source ?? "price-api"]}`);
  if (call.result_note) lines.push(esc(call.result_note));
  for (const r of reasons) lines.push(`💭 why: ${esc(r)}`);
  if (call.status === "open" && !reasons.length) lines.push("", "<i>Reply to this receipt to add why you think so.</i>");
  return lines.join("\n");
}

/** The call a bot message is the receipt of, if it is one. */
const receiptIdIn = (text?: string) => Number(text?.match(/^🧾 Receipt #(\d+)/)?.[1]) || null;

const outcomeHeadline = (call: CallRow) => (call.status === "win" ? "✅ called it" : call.status === "loss" ? "❌ missed" : "logged");

function draftSummary(d: Draft): string {
  return claim({ ...d, entry_price: null }) + ` by ${when(d.deadline)}`;
}

/** Posts results for calls that were just settled, and asks the chat for CS2 scores. */
export async function announceResolutions(bot: Bot) {
  const settled = await resolveDue();
  const reasons = await reasonsFor(settled.map((r) => r.call.id));
  for (const { call, askScore } of settled) {
    if (askScore) {
      const kb = new InlineKeyboard()
        .text(call.subject, `score:${call.id}:a`)
        .text(call.opponent!, `score:${call.id}:b`)
        .row()
        .text("Match cancelled", `score:${call.id}:void`);
      await bot.api.sendMessage(
        call.chat_id,
        `⏰ <b>${esc(call.subject)} vs ${esc(call.opponent!)}</b> should be over.\n${esc(call.author_name)} called “${esc(call.quote)}”.\nWho won? (anyone but ${esc(call.author_name)} can confirm)`,
        { parse_mode: "HTML", reply_markup: kb },
      );
    } else {
      const share = config.publicUrl ? new InlineKeyboard().url("🔗 Share this receipt", shareUrl(call.id)) : undefined;
      await bot.api.sendMessage(call.chat_id, receiptText(call, outcomeHeadline(call), reasons.get(call.id)), { parse_mode: "HTML", reply_markup: share });
    }
  }
}

let lastSweep = 0;

/** Webhook traffic doubles as a clock: settle due calls at most every few minutes. */
async function sweepSoon(bot: Bot) {
  if (Date.now() - lastSweep < 3 * 60_000) return;
  lastSweep = Date.now();
  await announceResolutions(bot).catch((err) => console.error("sweep failed", err));
}

export function createBot(): Bot {
  const bot = new Bot(config.telegram.botToken);

  // Every update is a chance to settle due calls (Hobby cron only runs daily).
  // Registered first, because command handlers don't pass updates further down.
  bot.use(async (ctx, next) => {
    if (ctx.chat && "title" in ctx.chat && ctx.chat.title) await touchChat(ctx.chat.id, ctx.chat.title).catch(() => {});
    await next();
    await sweepSoon(bot);
  });

  bot.command("start", (ctx) =>
    ctx.reply(
      "I keep receipts on your group chat's crypto and CS2 calls.\n\nAdd me to a group, then:\n• /call SUI to $5 by Friday\n• /call NaVi beat FaZe tonight\n• or just talk — I'll offer to log anything that sounds like a call\n• /board — who calls it right\n• /ask what did Ivan say about SUI?",
      {
        reply_markup: new InlineKeyboard().url("➕ Add to a group", `https://t.me/${ctx.me.username}?startgroup=receipts`),
      },
    ),
  );

  bot.command("call", async (ctx) => {
    // Replying "/call" to someone's message logs *their* words as their call.
    const target = ctx.message?.reply_to_message;
    const text = ctx.match.trim() || target?.text || "";
    const author = target?.from && !ctx.match.trim() ? { id: target.from.id, name: target.from.username ? `@${target.from.username}` : target.from.first_name } : authorOf(ctx);
    if (!text) return ctx.reply("Tell me the call, e.g. /call SOL above $300 by Friday — or reply /call to someone's message.");
    if (!llmEnabled) return ctx.reply("Call parsing needs an LLM key on the server.");

    const draft = await extractCall(text);
    if (!draft) return ctx.reply("That doesn't read like a checkable call. Try: /call BTC under 90k by Sunday, or /call Spirit beat Vitality.");
    if ("reason" in draft) return ctx.reply(draft.reason);
    const call = await logCall({ id: ctx.chat.id, title: "title" in ctx.chat ? ctx.chat.title : undefined }, author, draft);
    if ("error" in call) return ctx.reply(call.error);
    await ctx.reply(receiptText(call, "logged ✍️"), { parse_mode: "HTML" });
  });

  bot.command("board", async (ctx) => {
    const [crypto, cs2] = await Promise.all([leaderboard(ctx.chat.id, "crypto"), leaderboard(ctx.chat.id, "cs2")]);
    const section = (title: string, rows: typeof crypto) =>
      rows.length
        ? `<b>${title}</b>\n` + rows.map((r, i) => `${i + 1}. ${esc(r.author_name)} — ${Math.round((r.hits / r.calls) * 100)}% (${r.hits}/${r.calls})`).join("\n")
        : `<b>${title}</b>\nno settled calls yet`;
    // Groups can't host web_app buttons, so link to the bot's Main Mini App with the chat as start_param.
    const open = new InlineKeyboard().url("📊 Open the board", `https://t.me/${ctx.me.username}?startapp=${ctx.chat.id}`);
    await ctx.reply(`🏆 Who calls it right\n\n${section("Crypto", crypto)}\n\n${section("CS2", cs2)}`, { parse_mode: "HTML", reply_markup: open });
  });

  bot.command("open", async (ctx) => {
    const calls = await openCalls(ctx.chat.id);
    if (!calls.length) return ctx.reply("No open calls. Somebody say something bold.");
    await ctx.reply(
      "⏳ Open calls\n\n" + calls.map((c) => `#${c.id} ${esc(c.author_name)}: ${esc(claim(c))} · ${esc(when(c.deadline))}`).join("\n"),
      { parse_mode: "HTML" },
    );
  });

  bot.command("ask", async (ctx) => {
    const q = ctx.match.trim();
    if (!q) return ctx.reply("Ask me something, e.g. /ask what did Max say about SOL?");
    await ctx.replyWithChatAction("typing");
    await ctx.reply(await answer(ctx.chat.id, q));
  });

  async function saveReason(ctx: Context, callId: number, text: string) {
    const call = await addReason(callId, ctx.from!.id, text);
    if (call === "not_yours") return ctx.reply("Only the author can add the why to their own call.");
    const reasons = (await reasonsFor([call.id])).get(call.id) ?? [];
    await ctx.reply(receiptText(call, "why added 💭", reasons), { parse_mode: "HTML" });
  }

  bot.command("why", async (ctx) => {
    const m = ctx.match.match(/^#?(\d+)\s+([\s\S]+)/);
    if (!m) return ctx.reply("Add your reasoning to a call: /why 12 ETF inflows and shorts getting squeezed — or just reply to its receipt.");
    await saveReason(ctx, Number(m[1]), m[2]);
  });

  bot.command("hide", async (ctx) => {
    const id = Number(ctx.match.replace("#", "").trim());
    if (!id) return ctx.reply("Which one? /hide 12 takes your call #12 off the board and out of my answers.");
    const ok = await hideCall(id, ctx.from!.id);
    await ctx.reply(ok ? `Call #${id} is hidden. It no longer counts and I won't bring it up.` : "You can only hide your own calls.");
  });

  const MODE_TEXT: Record<ChatMode, string> = {
    ask: "📌 <b>Ask first</b> — when someone sounds like they're making a call, I offer to log it and the author taps to confirm.",
    auto: `⚡ <b>Auto</b> — I log anything that sounds like a call right away. The author can undo it within ${UNDO_MINUTES} minutes.`,
  };
  const modeKeyboard = (current: ChatMode) =>
    new InlineKeyboard().text(`${current === "ask" ? "● " : ""}Ask first`, "mode:ask").text(`${current === "auto" ? "● " : ""}Auto`, "mode:auto");

  async function isAdmin(ctx: Context): Promise<boolean> {
    if (ctx.chat?.type === "private") return true;
    const member = await ctx.getChatMember(ctx.from!.id);
    return member.status === "creator" || member.status === "administrator";
  }

  bot.command("mode", async (ctx) => {
    const current = await chatMode(ctx.chat.id);
    await ctx.reply(`How should I handle calls in this chat?\n\n${MODE_TEXT.ask}\n\n${MODE_TEXT.auto}\n\nOnly group admins can switch.`, {
      parse_mode: "HTML",
      reply_markup: modeKeyboard(current),
    });
  });

  bot.callbackQuery(/^mode:(ask|auto)$/, async (ctx) => {
    if (!(await isAdmin(ctx))) return ctx.answerCallbackQuery({ text: "Only group admins can change this.", show_alert: true });
    const mode = ctx.match![1] as ChatMode;
    await setChatMode(ctx.chat!.id, mode);
    await ctx.answerCallbackQuery({ text: mode === "auto" ? "Auto mode on" : "Ask-first mode on" });
    await ctx.editMessageText(`Mode set.\n\n${MODE_TEXT[mode]}`, { parse_mode: "HTML", reply_markup: modeKeyboard(mode) });
  });

  bot.callbackQuery(/^undo:(\d+)$/, async (ctx) => {
    const res = await undoCall(Number(ctx.match![1]), ctx.from.id);
    if (res === "not_yours") return ctx.answerCallbackQuery({ text: "Only the author can undo their call.", show_alert: true });
    if (res === "too_late") return ctx.answerCallbackQuery({ text: `Too late — calls can be undone within ${UNDO_MINUTES} minutes. Use /hide instead.`, show_alert: true });
    await ctx.answerCallbackQuery({ text: "Undone." });
    await ctx.editMessageText("↩️ Not a call — removed.");
  });

  bot.callbackQuery(/^(log|nolog):(\w+)$/, async (ctx) => {
    const [, action, pendingId] = ctx.match!;
    const [pending] = await db<{ chat_id: string; author_id: string; draft: Draft }>(`select * from pending_calls where id = $1`, [pendingId]);
    if (!pending) return ctx.answerCallbackQuery({ text: "This one expired." });
    if (String(pending.author_id) !== String(ctx.from.id)) return ctx.answerCallbackQuery({ text: "Only the author can log their call.", show_alert: true });
    await db(`delete from pending_calls where id = $1`, [pendingId]);
    if (action === "nolog") {
      await ctx.answerCallbackQuery({ text: "Not logged." });
      return ctx.deleteMessage().catch(() => {});
    }
    const call = await logCall({ id: ctx.chat!.id, title: "title" in ctx.chat! ? ctx.chat!.title : undefined }, authorOf(ctx), pending.draft);
    await ctx.answerCallbackQuery();
    if ("error" in call) return ctx.editMessageText(call.error);
    await ctx.editMessageText(receiptText(call, "logged ✍️"), { parse_mode: "HTML" });
  });

  bot.callbackQuery(/^score:(\d+):(a|b|void)$/, async (ctx) => {
    const [, id, pick] = ctx.match!;
    const [call] = await db<CallRow>(`select * from calls where id = $1`, [Number(id)]);
    if (!call) return ctx.answerCallbackQuery({ text: "Unknown call." });
    const winner = pick === "a" ? call.subject : pick === "b" ? call.opponent! : "void";
    const res = await voteScore(call.id, authorOf(ctx), winner);
    await ctx.answerCallbackQuery({ text: res.message });
    if (res.call) await ctx.editMessageText(receiptText(res.call, outcomeHeadline(res.call)), { parse_mode: "HTML" });
    else if (winner === "void" && res.message.startsWith("Marked")) await ctx.editMessageText(`Call #${call.id} is void: match cancelled.`);
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    const mention = `@${ctx.me.username}`;
    const repliedToMe = ctx.message.reply_to_message?.from?.id === ctx.me.id;

    // The author replying to their own receipt is adding the why behind the call.
    const receiptId = repliedToMe ? receiptIdIn(ctx.message.reply_to_message?.text) : null;
    if (receiptId && !text.includes(mention)) {
      const [call] = await db<CallRow>(`select * from calls where id = $1`, [receiptId]);
      if (call && String(call.author_id) === String(ctx.from.id)) return saveReason(ctx, receiptId, text);
    }

    // A question to the bot: "@mykoll_bot what did Ivan say about SUI?"
    if (text.includes(mention) || (repliedToMe && ctx.chat.type !== "private")) {
      const q = text.replace(mention, "").trim();
      if (q) {
        await ctx.replyWithChatAction("typing");
        return ctx.reply(await answer(ctx.chat.id, q), { reply_parameters: { message_id: ctx.message.message_id } });
      }
    }

    if (ctx.chat.type === "private" || !llmEnabled) return;
    if (!mightBeCall(text)) return console.log("skipped by prefilter", { chat: ctx.chat.id, length: text.length });
    const draft = await extractCall(text).catch((err) => {
      console.error("call extraction failed", err);
      return null;
    });
    console.log("spotted candidate", { chat: ctx.chat.id, length: text.length, result: draft ? ("reason" in draft ? draft.reason : "call") : "not a call" });
    if (!draft || "reason" in draft) return;

    if ((await chatMode(ctx.chat.id)) === "auto") {
      const call = await logCall({ id: ctx.chat.id, title: "title" in ctx.chat ? ctx.chat.title : undefined }, authorOf(ctx), draft);
      if ("error" in call) return ctx.reply(call.error, { reply_parameters: { message_id: ctx.message.message_id } });
      return ctx.reply(receiptText(call, "logged automatically ⚡"), {
        parse_mode: "HTML",
        reply_parameters: { message_id: ctx.message.message_id },
        reply_markup: new InlineKeyboard().text("✗ Not a call", `undo:${call.id}`),
      });
    }

    // Nothing is stored until the author agrees; the draft waits here for their tap.
    const id = randomBytes(6).toString("hex");
    await db(`insert into pending_calls (id, chat_id, author_id, draft) values ($1, $2, $3, $4)`, [id, ctx.chat.id, ctx.from.id, JSON.stringify(draft)]);
    await ctx.reply(`📌 Sounds like a call: <b>${esc(draftSummary(draft))}</b>. Log it?`, {
      parse_mode: "HTML",
      reply_parameters: { message_id: ctx.message.message_id },
      reply_markup: new InlineKeyboard().text("🧾 Log it", `log:${id}`).text("No", `nolog:${id}`),
    });
  });

  bot.catch((err) => console.error("bot error", err.error));

  return bot;
}

export const BOT_COMMANDS = [
  { command: "call", description: "Log a call: /call SUI to $5 by Friday" },
  { command: "board", description: "Who calls it right" },
  { command: "open", description: "Calls still running" },
  { command: "ask", description: "Ask what someone said before" },
  { command: "why", description: "Add why you made a call: /why 12 ETF inflows" },
  { command: "hide", description: "Hide one of your calls" },
  { command: "mode", description: "Ask before logging calls, or log them automatically" },
];
