import { randomBytes } from "node:crypto";
import { Bot, InlineKeyboard, type Context } from "grammy";
import { answer, recallQuestion, shownMemory, sourcesText, type Source } from "./ask";
import {
  chatMode,
  claim,
  extractCall,
  finishedSlate,
  hiddenIds,
  hideCall,
  isPublicChat,
  leaderboard,
  addReason,
  logCall,
  logSlate,
  ownerOf,
  mightBeCallNow,
  openCalls,
  reasonsFor,
  resolveDue,
  setChatMode,
  setChatPublic,
  touchChat,
  undoCall,
  UNDO_MINUTES,
  usd,
  voteScore,
  when,
  withBlobs,
  type CallRow,
  type ChatMode,
  type Draft,
  type Slate,
  type SlateResult,
  type Unplaced,
} from "./calls";
import { config, llmEnabled } from "./config";
import { db } from "./db";
import { habitFor, habitText, misreadsLike, recordFeedback } from "./habits";
import { noteForNewCall, trackRecords } from "./learning";
import { bookLine } from "./bookmakers";
import { pickName } from "./polymarket";
import { fileUrl, shareUrl } from "./receipts";
import { memoryScorecard, scorecardLine } from "./scorecard";
import { forwardedPost, justTheLink, postLinkIn, readPost, sourceName, type ForwardOrigin, type Post, type PostLink } from "./posts";
import { blobUrl, proofLabel, proofUrl } from "./proof";
import { nextSweep } from "./schedule";
import { noteEffect } from "./effects";
import { DISAGREE, gap, sourceLabel } from "./tatum";
import { vsMarketText } from "./view";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const authorOf = (ctx: Context) => ({
  id: ctx.from!.id,
  name: ctx.from!.username ? `@${ctx.from!.username}` : ctx.from!.first_name,
});

/** The Price API's view of an on-chain price, flagged when the two sources disagree. */
function crossCheck(price: number | null, check: number | null): string | null {
  if (price === null || check === null) return null;
  const apart = gap(price, check);
  return apart > DISAGREE
    ? `⚠️ The price feed says ${usd(check)}, ${(apart * 100).toFixed(1)}% apart. The on-chain price is the one that counts.`
    : `✓ The price feed agrees: ${usd(check)} (${(apart * 100).toFixed(1)}% apart)`;
}

function receiptText(call: CallRow, headline: string, reasons: string[] = [], learned: string[] = []): string {
  const lines = [`🧾 <b>Receipt #${call.id}</b> · ${headline}`, `${esc(call.author_name)}: “${esc(call.quote)}”`];
  if (call.source)
    lines.push(`<i>📎 posted ${esc(when(call.source.postedAt))} · shared by ${esc(call.source.sharedBy.name)}</i>`);
  lines.push("", `<i>${esc(claim(call))}</i> · judged ${esc(when(call.deadline))}`);
  const settled = call.status === "win" || call.status === "loss";
  if (call.entry_price !== null && !settled)
    lines.push(`${call.subject} was ${usd(call.entry_price)} when ${call.source ? "shared" : "called"} · ${sourceLabel[call.price_source ?? "price-api"]}`);
  if (call.result_note) lines.push(esc(call.result_note));
  const cross = settled ? crossCheck(call.final_price, call.final_check) : crossCheck(call.entry_price, call.entry_check);
  if (cross) lines.push(cross);
  if (call.market_ref) {
    const ref = call.market_ref;
    const pct = Math.round(ref.prob * 100);
    const pick = esc(pickName(ref));
    const via = ref.direct ? "" : " (via Tatum)";
    const at = ref.late ? "when the match was listed, after the call" : "when called";
    lines.push(
      ref.score
        ? call.status === "win"
          ? `🎯 Called the score: Polymarket had ${pick} at ${pct}%`
          : `📈 Polymarket gave ${pick} ${pct}% ${at}${via}`
        : call.status === "win" && pct < 45
          ? `🎯 Called the upset: Polymarket had ${pick} at ${pct}%`
          : `📈 Polymarket gave ${pick} ${pct}% ${at}${pct < 45 ? " — an underdog pick" : ""}${via}`,
    );
    if (ref.book) lines.push(`🏦 Bookmakers then: ${esc(bookLine(ref.book))}`);
  }
  for (const r of reasons) lines.push(`💭 why: ${esc(r)}`);
  if (learned.length) lines.push("", ...learned.map(esc));
  if (call.status === "open" && !reasons.length && !call.source) lines.push("", "<i>Reply to this receipt to add why you think so.</i>");
  return lines.join("\n");
}

/**
 * Buttons under a receipt: whatever the message needs, plus a link to the Sui transaction
 * that set the pool price it was judged by, so anyone in the chat can check it.
 */
function receiptButtons(call: CallRow, kb = new InlineKeyboard()): InlineKeyboard | undefined {
  const proof = (call.status === "win" || call.status === "loss" ? call.final_proof : call.entry_proof)?.[0];
  const next = () => (kb.inline_keyboard.flat().length ? kb.row() : kb);
  if (proof) next().url(`🔎 Check the price on ${proofLabel(proof)}`, proofUrl(proof));
  if (call.market_ref) next().url("📈 The match on Polymarket", call.market_ref.url);
  if (call.memory_blob) next().url("🧠 Sealed on Walrus before the result", blobUrl(call.memory_blob));
  if (call.source?.url) next().url(`📎 The original post on ${call.source.kind === "x" ? "X" : "Telegram"}`, call.source.url);
  return kb.inline_keyboard.flat().length ? kb : undefined;
}

/** What the bot has learned that bears on this call: shown when it's made, and after it settles. */
const learnedForNew = (call: CallRow) => noteForNewCall(call).catch(() => [] as string[]);
async function learnedAfter(call: CallRow): Promise<string[]> {
  const [records, changed] = await Promise.all([
    trackRecords(call.chat_id).catch(() => new Map()),
    db<{ text: string }>(`select text from memory_effects where call_id = $1 and kind = 'record_changed'`, [call.id]).catch(() => []),
  ]);
  const record = records.get(String(call.author_id));
  // The effect reads `Changed its view of @x after "<quote>": <changes>.`; the quote may hold anything.
  const change = changed[0]?.text.match(/^.*": (.+)\.$/)?.[1];
  return [...(record ? [`📈 Updated record: ${record.summary}`] : []), ...(change ? [`🔄 I changed my mind: ${change}`] : [])];
}

/** Reasons the author gave in the message itself, shown on the receipt as its first "why". */
const reasonsIn = (d: Draft) => (d.why ? [d.why] : []);

/**
 * The call in a post someone shared from X or Telegram, read from the post's own text and time and
 * filed under its author. Null when the post holds no checkable call.
 */
async function callFromPost(from: PostLink | Post, sharer: { id: number; name: string }): Promise<Draft | Slate | Unplaced | null> {
  const post = "text" in from ? from : await readPost(from);
  if (!post) return { reason: "I can't read that post. It may be deleted, or from a private account or channel.", speak: true };
  if (!(await mightBeCallNow(post.text))) return null;
  const found = await extractCall(post.text, post.postedAt).catch((err) => {
    console.error("call extraction failed", err);
    return null;
  });
  if (!found || "reason" in found) return found;
  return { ...found, source: { kind: post.kind, url: post.url, handle: post.handle, postedAt: post.postedAt.toISOString(), sharedBy: sharer } };
}

/** The call a bot message is the receipt of, if it is one. */
const receiptIdIn = (text?: string) => Number(text?.match(/^🧾 Receipt #(\d+)/)?.[1]) || null;

const outcomeHeadline = (call: CallRow) => (call.status === "win" ? "✅ called it" : call.status === "loss" ? "❌ missed" : "logged");

function draftSummary(d: Draft): string {
  return claim({ ...d, entry_price: null }) + ` by ${when(d.deadline)}`;
}

/* ---------- Slates: several CS2 picks in one message ---------- */

function slateOffer(s: Slate): string {
  const n = s.picks.length;
  const lines = [
    s.source ? `📎 ${esc(sourceName(s.source))} picked ${n} match${n === 1 ? "" : "es"} (posted ${esc(when(s.source.postedAt))}):` : `📋 Sounds like picks on ${n} match${n === 1 ? "" : "es"}:`,
    "",
  ];
  s.picks.forEach((p, i) =>
    lines.push(
      p.opponent
        ? `${i + 1}. <b>${esc(p.subject)}</b> to beat ${esc(p.opponent)} · ${esc(when(p.deadline))}`
        : `${i + 1}. <b>${esc(p.subject)}</b> on their next match · not listed yet, I'll wait for it`,
    ),
  );
  if (s.skipped.length) lines.push("", `<i>Left out: ${esc(s.skipped.join("; "))}</i>`);
  lines.push("", `Log ${n === 1 ? "it" : `all ${n}`} as calls? I'll post who won once the last match is over.`);
  return lines.join("\n");
}

function slateLogged(author: string, s: Slate, calls: CallRow[], errors: string[]): string {
  const lines = [`🧾 <b>${calls.length} pick${calls.length === 1 ? "" : "s"} logged</b> · ${esc(author)}: “${esc(s.quote)}”`, ""];
  for (const c of calls) {
    const odds = c.market_ref
      ? ` · Polymarket ${Math.round(c.market_ref.prob * 100)}%${c.market_ref.book ? `, ${esc(bookLine(c.market_ref.book))}` : ""}`
      : "";
    lines.push(c.opponent ? `#${c.id} ${esc(c.subject)} to beat ${esc(c.opponent)}${odds}` : `#${c.id} ${esc(c.subject)} on their next match, once it's listed`);
  }
  if (errors.length) lines.push("", `<i>Not logged: ${esc(errors.join("; "))}</i>`);
  if (s.why) lines.push("", `💭 why: ${esc(s.why)}`);
  lines.push("", "<i>I'll post who won once the last match is over.</i>");
  return lines.join("\n");
}

function slateText(s: SlateResult): string {
  const scored = s.calls.filter((c) => c.status === "win" || c.status === "loss");
  const hits = scored.filter((c) => c.status === "win").length;
  const lines = [`🏁 <b>All matches are over</b> · ${esc(s.author_name)} went <b>${hits}/${scored.length}</b>`, `“${esc(s.quote)}”`, ""];
  for (const c of s.calls) {
    if (c.status === "void") {
      lines.push(`➖ #${c.id} ${esc(c.opponent ? `${c.subject} vs ${c.opponent}` : c.subject)}: ${esc(c.waiting || !c.opponent ? "no match listed" : "cancelled")}`);
      continue;
    }
    const won = c.status === "win";
    const pct = c.market_ref ? Math.round(c.market_ref.prob * 100) : null;
    const upset = won && pct !== null && pct < 45 && !c.score ? ` 🎯 upset, Polymarket had ${pct}%` : "";
    // A score pick can miss with its team winning; the note says how ("FURIA won, but 2:1, not 2:0").
    lines.push(
      c.score
        ? `${won ? "✅" : "❌"} #${c.id} <b>${esc(c.subject)} ${esc(c.score.replace("-", ":"))}</b>: ${esc((c.result_note ?? "").replace(/ \(.*\)$/, ""))}`
        : `${won ? "✅" : "❌"} #${c.id} <b>${esc(won ? c.subject : (c.opponent ?? "?"))}</b> beat ${esc(won ? (c.opponent ?? "?") : c.subject)}${upset}`,
    );
  }
  if (scored.length && hits === scored.length) lines.push("", "Clean sweep 🧹");
  return lines.join("\n");
}

/** Posts a slate's results if this call was the last of it to settle. */
async function announceSlate(bot: Bot, call: CallRow) {
  if (!call.slate_id) return;
  const slate = await finishedSlate(call.slate_id);
  if (!slate) return;
  const learned = await learnedAfter(call);
  await bot.api.sendMessage(call.chat_id, slateText(slate) + (learned.length ? `\n\n${learned.map(esc).join("\n")}` : ""), { parse_mode: "HTML" });
}

/** Posts results for calls that were just settled, and asks the chat for CS2 scores. */
export async function announceResolutions(bot: Bot) {
  const settled = await resolveDue();
  const reasons = await reasonsFor(settled.map((r) => r.call.id));
  const sealed = new Map((await withBlobs(settled.map((r) => r.call))).map((c) => [c.id, c]));
  for (const { call: resolved, askScore, placed, dropped } of settled) {
    const call = sealed.get(resolved.id) ?? resolved;
    if (placed) {
      const ref = call.market_ref;
      const odds = ref
        ? `\n📈 Polymarket gives ${esc(pickName(ref))} ${Math.round(ref.prob * 100)}% now (the match wasn't listed when it was called)` +
          (ref.book ? `\n🏦 Bookmakers: ${esc(bookLine(ref.book))}` : "")
        : "";
      await bot.api.sendMessage(
        call.chat_id,
        `📌 <b>Receipt #${call.id}</b> found its match · ${esc(call.author_name)}: “${esc(call.quote)}”\n\n<i>${esc(claim(call))}</i> · judged ${esc(when(call.deadline))}${odds}`,
        { parse_mode: "HTML", reply_markup: receiptButtons(call) },
      );
      continue;
    }
    if (dropped) {
      // A pick in a slate is reported with the rest of it.
      if (call.slate_id) {
        await announceSlate(bot, call);
        continue;
      }
      await bot.api.sendMessage(call.chat_id, `➖ <b>Receipt #${call.id}</b> dropped · ${esc(call.author_name)}: “${esc(call.quote)}”\n${esc(call.result_note ?? "")}`, {
        parse_mode: "HTML",
      });
      continue;
    }
    // A pick in a slate is reported with the rest of it, once the last match is over.
    if (call.slate_id && !askScore) {
      await announceSlate(bot, call);
      continue;
    }
    if (askScore) {
      const kb = new InlineKeyboard()
        .text(call.subject, `score:${call.id}:a`)
        .text(call.opponent!, `score:${call.id}:b`)
        .row()
        .text("Match cancelled", `score:${call.id}:void`);
      await bot.api.sendMessage(
        call.chat_id,
        `⏰ <b>${esc(call.subject)} vs ${esc(call.opponent!)}</b> should be over.\n${esc(call.author_name)} called “${esc(call.quote)}”.\nWho won? (anyone but ${esc(call.author_name)} can confirm)` +
          (call.market_ref ? "\n<i>Polymarket hasn't resolved it yet; if it does first, I'll settle it from there.</i>" : ""),
        { parse_mode: "HTML", reply_markup: kb },
      );
    } else {
      const share = config.publicUrl ? new InlineKeyboard().url("🔗 Share this receipt", shareUrl(call.id)) : undefined;
      await bot.api.sendMessage(call.chat_id, receiptText(call, outcomeHeadline(call), reasons.get(call.id), await learnedAfter(call)), {
        parse_mode: "HTML",
        reply_markup: receiptButtons(call, share),
      });
    }
  }
}

let lastSweep = 0;

/** Webhook traffic doubles as a clock: settle due calls at most every few minutes. */
async function sweepSoon(bot: Bot) {
  if (Date.now() - lastSweep < 3 * 60_000) return;
  lastSweep = Date.now();
  await announceResolutions(bot).catch((err) => console.error("sweep failed", err));
  // And make sure the quarter-hourly sweep is running, for when the chats go quiet.
  await nextSweep();
}

/** True the first time an update arrives. The insert decides, so two instances can't both take it. */
export async function firstDelivery(updateId: number): Promise<boolean> {
  const taken = await db(`insert into seen_updates (update_id) values ($1) on conflict do nothing returning update_id`, [updateId]);
  return taken.length > 0;
}

export function createBot(): Bot {
  const bot = new Bot(config.telegram.botToken);

  // A repeat delivery would log the same call and post the same receipt twice.
  bot.use(async (ctx, next) => {
    if (await firstDelivery(ctx.update.update_id)) return next();
    console.log("repeat delivery skipped", { update: ctx.update.update_id });
  });

  // Every update is a chance to settle due calls (Hobby cron only runs daily).
  // Registered first, because command handlers don't pass updates further down.
  bot.use(async (ctx, next) => {
    if (ctx.chat && "title" in ctx.chat && ctx.chat.title) await touchChat(ctx.chat.id, ctx.chat.title).catch(() => {});
    await next();
    await sweepSoon(bot);
  });

  bot.command("start", (ctx) =>
    ctx.reply(
      "I keep receipts on your group chat's crypto and CS2 calls.\n\nAdd me to a group, then:\n• /call SUI to $5 by Friday\n• /call NaVi beat FaZe tonight\n• or just talk — I'll offer to log anything that sounds like a call\n• /board — who calls it right\n• /ask what did Jake say about SUI?",
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

    // "/call <link>" files the call in that post under its author.
    const link = postLinkIn(text);
    const draft = link ? await callFromPost(link, authorOf(ctx)) : await extractCall(text);
    if (!draft) return ctx.reply("That doesn't read like a checkable call. Try: /call BTC under 90k by Sunday, or /call Spirit beat Vitality.");
    if ("reason" in draft) return ctx.reply(draft.reason);
    const chat = { id: ctx.chat.id, title: "title" in ctx.chat ? ctx.chat.title : undefined };
    if ("picks" in draft) {
      const { calls, errors } = await logSlate(chat, author, draft);
      if (!calls.length) return ctx.reply(errors.join("\n"));
      return ctx.reply(slateLogged(ownerOf(author, draft).name, draft, calls, errors), { parse_mode: "HTML" });
    }
    const call = await logCall(chat, author, draft);
    if ("error" in call) return ctx.reply(call.error);
    await ctx.reply(receiptText(call, "logged ✍️", reasonsIn(draft), await learnedForNew(call)), { parse_mode: "HTML", reply_markup: receiptButtons(call) });
  });

  bot.command("board", async (ctx) => {
    const [crypto, cs2, scorecard, records] = await Promise.all([
      leaderboard(ctx.chat.id, "crypto"),
      leaderboard(ctx.chat.id, "cs2"),
      memoryScorecard(ctx.chat.id),
      trackRecords(ctx.chat.id),
    ]);
    const check = scorecardLine(scorecard);
    // On CS2, how each member's picks did against the odds Polymarket gave them.
    const vsMarket = (r: (typeof cs2)[number]) => {
      const edge = records.get(String(r.author_id))?.marketEdge;
      return edge === undefined ? "" : ` · ${vsMarketText(Math.round(edge * 100))}`;
    };
    const section = (title: string, rows: typeof crypto, extra: (r: (typeof crypto)[number]) => string = () => "") =>
      rows.length
        ? `<b>${title}</b>\n` + rows.map((r, i) => `${i + 1}. ${esc(r.author_name)} — ${Math.round((r.hits / r.calls) * 100)}% (${r.hits}/${r.calls})${extra(r)}`).join("\n")
        : `<b>${title}</b>\nno settled calls yet`;
    // Groups can't host web_app buttons, so link to the bot's Main Mini App with the chat as start_param.
    const open = new InlineKeyboard().url("📊 Open the board", `https://t.me/${ctx.me.username}?startapp=${ctx.chat.id}`);
    await ctx.reply(`🏆 Who calls it right\n\n${section("Crypto", crypto)}\n\n${section("CS2", cs2, vsMarket)}${check ? `\n\n${esc(check)}` : ""}`, {
      parse_mode: "HTML",
      reply_markup: open,
    });
  });

  bot.command("open", async (ctx) => {
    const calls = await openCalls(ctx.chat.id);
    if (!calls.length) return ctx.reply("No open calls. Somebody say something bold.");
    await ctx.reply(
      "⏳ Open calls\n\n" + calls.map((c) => `#${c.id} ${esc(c.author_name)}: ${esc(claim(c))} · ${esc(when(c.deadline))}`).join("\n"),
      { parse_mode: "HTML" },
    );
  });

  /**
   * Answers from the chat's memory, with a button that shows which memories the answer came from
   * and where each is sealed on Walrus, so nobody has to take the bot's word for what it remembers.
   */
  async function replyFromMemory(ctx: Context, question: string, replyTo?: number) {
    await ctx.replyWithChatAction("typing");
    const { text, sources } = await answer(ctx.chat!.id, question);
    let kb: InlineKeyboard | undefined;
    if (sources.length) {
      const id = randomBytes(6).toString("hex");
      await db(`insert into answer_sources (id, chat_id, sources) values ($1, $2, $3)`, [id, ctx.chat!.id, JSON.stringify(sources)]);
      kb = new InlineKeyboard().text(`🧠 What I recalled (${sources.length})`, `recalled:${id}`);
    }
    await ctx.reply(text, { reply_markup: kb, ...(replyTo ? { reply_parameters: { message_id: replyTo } } : {}) });
  }

  bot.command("ask", async (ctx) => {
    const q = ctx.match.trim();
    if (!q) return ctx.reply("Ask me something, e.g. /ask what did Max say about SOL?");
    await replyFromMemory(ctx, q);
  });

  bot.callbackQuery(/^recalled:(\w+)$/, async (ctx) => {
    const [row] = await db<{ chat_id: string; sources: Source[] }>(`select chat_id, sources from answer_sources where id = $1`, [ctx.match![1]]);
    if (!row || String(row.chat_id) !== String(ctx.chat?.id)) return ctx.answerCallbackQuery({ text: "This one expired. Ask me again." });
    // A call hidden since the answer was given drops out here too.
    const hidden = await hiddenIds(ctx.chat!.id);
    const sources = row.sources.filter((s) => shownMemory(s.text, hidden));
    await ctx.answerCallbackQuery();
    await ctx.reply(sourcesText(sources), {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_parameters: { message_id: ctx.callbackQuery.message!.message_id },
    });
    // Shown once per answer; the list stays in the chat right under it.
    await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
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

  const PUBLIC_TEXT =
    "Anyone with the link can see this chat's board, receipts and what memory changed — never anyone's own file, and never hidden calls. Members can still /hide any call of theirs.";
  const publicKeyboard = (on: boolean) => new InlineKeyboard().text(on ? "Make it private" : "Make it public", on ? "public:off" : "public:on");
  const publicStatus = (chatId: number, on: boolean) =>
    on ? `🌐 This chat's file is public:\n${fileUrl(chatId)}\n\n${PUBLIC_TEXT}` : `🔒 This chat's file is private.\n\nMaking it public: ${PUBLIC_TEXT}`;

  bot.command("public", async (ctx) => {
    if (ctx.chat.type === "private") return ctx.reply("Use /public in a group.");
    const on = await isPublicChat(ctx.chat.id);
    await ctx.reply(`${publicStatus(ctx.chat.id, on)}\n\nOnly group admins can switch.`, { reply_markup: publicKeyboard(on), link_preview_options: { is_disabled: true } });
  });

  bot.callbackQuery(/^public:(on|off)$/, async (ctx) => {
    if (!(await isAdmin(ctx))) return ctx.answerCallbackQuery({ text: "Only group admins can change this.", show_alert: true });
    const on = ctx.match![1] === "on";
    await setChatPublic(ctx.chat!.id, on);
    await ctx.answerCallbackQuery({ text: on ? "The file is public" : "The file is private" });
    await ctx.editMessageText(publicStatus(ctx.chat!.id, on), { reply_markup: publicKeyboard(on), link_preview_options: { is_disabled: true } });
  });

  bot.callbackQuery(/^undo:(\d+)$/, async (ctx) => {
    const res = await undoCall(Number(ctx.match![1]), ctx.from.id);
    if (res === "not_yours") return ctx.answerCallbackQuery({ text: "Only the author can undo their call.", show_alert: true });
    if (res === "too_late") return ctx.answerCallbackQuery({ text: `Too late — calls can be undone within ${UNDO_MINUTES} minutes. Use /hide instead.`, show_alert: true });
    await ctx.answerCallbackQuery({ text: "Undone." });
    await ctx.editMessageText("↩️ Not a call — removed. I'll remember that.");
    await recordFeedback(ctx.chat!.id, authorOf(ctx), false, res);
  });

  bot.callbackQuery(/^(log|nolog):(\w+)$/, async (ctx) => {
    const [, action, pendingId] = ctx.match!;
    const [pending] = await db<{ chat_id: string; author_id: string; draft: Draft | Slate }>(`select * from pending_calls where id = $1`, [pendingId]);
    if (!pending) return ctx.answerCallbackQuery({ text: "This one expired." });
    if (String(pending.author_id) !== String(ctx.from.id)) return ctx.answerCallbackQuery({ text: "Only the author can log their call.", show_alert: true });
    // Whoever removes the draft logs it, so a double tap can't log it twice.
    const claimed = await db(`delete from pending_calls where id = $1 returning id`, [pendingId]);
    if (!claimed.length) return ctx.answerCallbackQuery({ text: "Already handled." });
    const chat = { id: ctx.chat!.id, title: "title" in ctx.chat! ? ctx.chat!.title : undefined };
    if ("picks" in pending.draft) {
      const slate = pending.draft;
      if (action === "nolog") {
        await ctx.answerCallbackQuery({ text: "Not logged." });
        return ctx.deleteMessage().catch(() => {});
      }
      await ctx.answerCallbackQuery();
      const { calls, errors } = await logSlate(chat, authorOf(ctx), slate);
      if (!calls.length) return ctx.editMessageText(errors.join("\n"));
      return ctx.editMessageText(slateLogged(ownerOf(authorOf(ctx), slate).name, slate, calls, errors), { parse_mode: "HTML" });
    }
    if (action === "nolog") {
      await ctx.answerCallbackQuery({ text: "Not logged. I'll remember that." });
      await ctx.deleteMessage().catch(() => {});
      // A shared post says nothing about how this member talks, so it doesn't train their habits.
      return pending.draft.source ? undefined : recordFeedback(ctx.chat!.id, authorOf(ctx), false, pending.draft);
    }
    const call = await logCall(chat, authorOf(ctx), pending.draft);
    await ctx.answerCallbackQuery();
    if ("error" in call) return ctx.editMessageText(call.error);
    await ctx.editMessageText(receiptText(call, "logged ✍️", reasonsIn(pending.draft), await learnedForNew(call)), {
      parse_mode: "HTML",
      reply_markup: receiptButtons(call),
    });
    if (!pending.draft.source) await recordFeedback(ctx.chat!.id, authorOf(ctx), true, pending.draft);
  });

  bot.callbackQuery(/^score:(\d+):(a|b|void)$/, async (ctx) => {
    const [, id, pick] = ctx.match!;
    const [call] = await db<CallRow>(`select * from calls where id = $1`, [Number(id)]);
    if (!call) return ctx.answerCallbackQuery({ text: "Unknown call." });
    const winner = pick === "a" ? call.subject : pick === "b" ? call.opponent! : "void";
    const res = await voteScore(call.id, authorOf(ctx), winner);
    await ctx.answerCallbackQuery({ text: res.message });
    if (res.call)
      await ctx.editMessageText(receiptText(res.call, outcomeHeadline(res.call), [], await learnedAfter(res.call)), {
        parse_mode: "HTML",
        reply_markup: receiptButtons(res.call),
      });
    else if (winner === "void" && res.message.startsWith("Marked")) await ctx.editMessageText(`Call #${call.id} is void: match cancelled.`);
    await announceSlate(bot, call);
  });

  // Captions too: signals are often a chart with the call written under it.
  bot.on(["message:text", "message:caption"], async (ctx) => {
    const text = ctx.message.text ?? ctx.message.caption ?? "";
    const mention = `@${ctx.me.username}`;
    const repliedToMe = ctx.message.reply_to_message?.from?.id === ctx.me.id;

    // The author replying to their own receipt is adding the why behind the call.
    const receiptId = repliedToMe ? receiptIdIn(ctx.message.reply_to_message?.text) : null;
    if (receiptId && !text.includes(mention)) {
      const [call] = await db<CallRow>(`select * from calls where id = $1`, [receiptId]);
      if (call && String(call.author_id) === String(ctx.from.id)) return saveReason(ctx, receiptId, text);
    }

    // A question to the bot: "@mykoll_bot what did Jake say about SUI?", or plainly "who called nemiga?"
    if (text.includes(mention) || (repliedToMe && ctx.chat.type !== "private") || recallQuestion(text)) {
      const q = text.replace(mention, "").trim();
      if (q) return replyFromMemory(ctx, q, ctx.message.message_id);
    }

    if (ctx.chat.type === "private" || !llmEnabled) return;

    // A link to a post on X or Telegram: the call in it is filed under the post's author, once the
    // member who shared it says so. A bare link is a request to look, so the bot answers even when
    // there's nothing to file; a link inside a longer message is only offered when it holds a call.
    // A message forwarded from a channel or another person works the same way: the call is the
    // original author's, timed from when they first sent it. Forwards that hold no call pass quietly.
    const forwarded = ctx.message.forward_origin ? forwardedPost(ctx.message.forward_origin as ForwardOrigin, text) : null;
    const link = forwarded ? null : postLinkIn(text);
    if (forwarded || link) {
      const asked = link ? justTheLink(text, link) : false;
      if (asked) void ctx.replyWithChatAction("typing").catch(() => {});
      const found = await callFromPost((forwarded ?? link)!, authorOf(ctx));
      const reply = (message: string) => ctx.reply(message, { reply_parameters: { message_id: ctx.message.message_id } });
      console.log("shared post", { chat: ctx.chat.id, kind: forwarded ? "forward" : link!.kind, result: found ? ("reason" in found ? found.reason : "call") : "not a call" });
      if (!found) return asked ? reply(`I read @${link!.handle}'s post but found no call in it I can check.`) : undefined;
      // A forward or a bare link holds a call the sender wants kept, so say why it can't be.
      if ("reason" in found) return asked || forwarded ? reply(found.reason) : undefined;
      const id = randomBytes(6).toString("hex");
      await db(`insert into pending_calls (id, chat_id, author_id, draft) values ($1, $2, $3, $4)`, [id, ctx.chat.id, ctx.from.id, JSON.stringify(found)]);
      const n = "picks" in found ? found.picks.length : 1;
      const offer =
        "picks" in found
          ? slateOffer(found)
          : `📎 <b>${esc(sourceName(found.source!))}</b> called it ${esc(when(found.source!.postedAt))}:\n“${esc(found.quote)}”\n\n<b>${esc(draftSummary(found))}</b>. Keep score on it?`;
      return ctx.reply(offer, {
        parse_mode: "HTML",
        reply_parameters: { message_id: ctx.message.message_id },
        link_preview_options: { is_disabled: true },
        reply_markup: new InlineKeyboard().text(n === 1 ? "🧾 Track it" : `🧾 Track all ${n}`, `log:${id}`).text("No", `nolog:${id}`),
      });
    }
    if (!(await mightBeCallNow(text))) return console.log("skipped by prefilter", { chat: ctx.chat.id, length: text.length });
    const draft = await extractCall(text).catch((err) => {
      console.error("call extraction failed", err);
      return null;
    });
    console.log("spotted candidate", { chat: ctx.chat.id, length: text.length, result: draft ? ("reason" in draft ? draft.reason : "call") : "not a call" });
    if (!draft) return;
    // Most reasons stay quiet in a passive read; a clear pick the bot can't place is worth saying.
    if ("reason" in draft)
      return draft.speak ? ctx.reply(draft.reason, { reply_parameters: { message_id: ctx.message.message_id } }) : undefined;
    // Several picks at once always get asked about, whatever the chat's mode: it's a lot to log on a guess.
    if ("picks" in draft) {
      const id = randomBytes(6).toString("hex");
      await db(`insert into pending_calls (id, chat_id, author_id, draft) values ($1, $2, $3, $4)`, [id, ctx.chat.id, ctx.from.id, JSON.stringify(draft)]);
      const n = draft.picks.length;
      return ctx.reply(slateOffer(draft), {
        parse_mode: "HTML",
        reply_parameters: { message_id: ctx.message.message_id },
        reply_markup: new InlineKeyboard().text(n === 1 ? "🧾 Log it" : `🧾 Log all ${n}`, `log:${id}`).text("No", `nolog:${id}`),
      });
    }
    // Pricing, memory and the receipt take a few seconds; show the chat the bot is on it.
    void ctx.replyWithChatAction("typing").catch(() => {});

    // What the bot has learned about this member can override the chat's mode, and it says so.
    const author = authorOf(ctx);
    const [mode, habit, misreads] = await Promise.all([chatMode(ctx.chat.id), habitFor(ctx.chat.id, author.id), misreadsLike(ctx.chat.id, author, draft)]);
    if (misreads >= 2) {
      await noteEffect(ctx.chat.id, "stayed_quiet", `Stayed quiet on ${author.name}: they said twice that messages like this aren't calls.`);
      return console.log("skipped: the author said this reading wasn't a call before", { chat: ctx.chat.id, misreads });
    }

    if (!misreads && (habit === "trusted" || (mode === "auto" && habit !== "unsure"))) {
      const call = await logCall({ id: ctx.chat.id, title: "title" in ctx.chat ? ctx.chat.title : undefined }, author, draft);
      if ("error" in call) return ctx.reply(call.error, { reply_parameters: { message_id: ctx.message.message_id } });
      const why = mode === "ask" ? [`🤝 ${author.name} ${habitText.trusted.them}.`] : [];
      if (mode === "ask") await noteEffect(ctx.chat.id, "logged_without_asking", `Logged ${author.name}'s "${call.quote}" without asking: ${author.name} ${habitText.trusted.them}.`, call.id);
      return ctx.reply(receiptText(call, mode === "auto" ? "logged automatically ⚡" : "logged without asking ⚡", reasonsIn(draft), [...why, ...(await learnedForNew(call))]), {
        parse_mode: "HTML",
        reply_parameters: { message_id: ctx.message.message_id },
        reply_markup: receiptButtons(call, new InlineKeyboard().text("✗ Not a call", `undo:${call.id}`)),
      });
    }

    // Nothing is stored until the author agrees; the draft waits here for their tap.
    const because = misreads
      ? "Last time I read something like this from you, it wasn't a call."
      : mode === "auto" && habit === "unsure"
        ? habitText.unsure.you
        : "";
    if (because) await noteEffect(ctx.chat.id, "asked_first", `Asked ${author.name} first about "${draft.quote}": ${because}`);
    const id = randomBytes(6).toString("hex");
    await db(`insert into pending_calls (id, chat_id, author_id, draft) values ($1, $2, $3, $4)`, [id, ctx.chat.id, ctx.from.id, JSON.stringify(draft)]);
    await ctx.reply(`📌 Sounds like a call: <b>${esc(draftSummary(draft))}</b>. Log it?${because ? `\n<i>${esc(because)}</i>` : ""}`, {
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
  { command: "public", description: "Open this chat's file to anyone with the link, or close it" },
];
