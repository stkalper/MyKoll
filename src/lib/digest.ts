import type { Bot } from "grammy";
import { claim, usd, type CallRow } from "./calls";
import { db } from "./db";
import { memoryScorecard, scorecardLine } from "./scorecard";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** How far the price ended from what was called, as a fraction (crypto with a target only). */
const missBy = (c: CallRow) => (c.target && c.final_price ? Math.abs(c.final_price - c.target) / c.target : 0);
const moved = (c: CallRow) => (c.entry_price && c.final_price ? Math.abs(c.final_price - c.entry_price) / c.entry_price : 0);

/** The week in one message for one chat, or null if nothing happened there. */
export async function weeklyDigest(chatId: number | string): Promise<string | null> {
  const settled = await db<CallRow>(
    `select * from calls where chat_id = $1 and status in ('win', 'loss') and not hidden and resolved_at > now() - interval '7 days'`,
    [chatId],
  );
  const [{ open }] = await db<{ open: number }>(`select count(*)::int as open from calls where chat_id = $1 and status = 'open' and not hidden`, [chatId]);
  if (!settled.length && !open) return null;

  const byAuthor = new Map<string, { hits: number; calls: number }>();
  for (const c of settled) {
    const s = byAuthor.get(c.author_name) ?? { hits: 0, calls: 0 };
    s.calls++;
    if (c.status === "win") s.hits++;
    byAuthor.set(c.author_name, s);
  }
  const ranked = [...byAuthor].sort(([, a], [, b]) => b.hits / b.calls - a.hits / a.calls || b.calls - a.calls);
  const best = settled.filter((c) => c.status === "win").sort((a, b) => moved(b) - moved(a))[0];
  const worst = settled.filter((c) => c.status === "loss").sort((a, b) => missBy(b) - missBy(a))[0];

  const lines = ["🗓 <b>The week in receipts</b>", ""];
  if (ranked.length && ranked[0][1].hits) lines.push(`🏆 Sharpest: ${esc(ranked[0][0])} — ${ranked[0][1].hits}/${ranked[0][1].calls} right`);
  if (best) lines.push(`🎯 Best call: ${esc(best.author_name)} “${esc(best.quote)}”`);
  if (worst)
    lines.push(
      `🤡 Biggest miss: ${esc(worst.author_name)} “${esc(worst.quote)}”` +
        (worst.final_price ? ` (${esc(claim(worst))}, ended at ${usd(worst.final_price)})` : ""),
    );
  if (!settled.length) lines.push("No calls settled this week.");
  if (open) lines.push(`⏳ Still open: ${open} call${open === 1 ? "" : "s"}`);
  const check = scorecardLine(await memoryScorecard(chatId));
  if (check) lines.push("", esc(check));
  lines.push("", "Full board: /board");
  return lines.join("\n");
}

/** Posts the weekly digest to every chat that had calls this week. */
export async function postWeeklyDigests(bot: Bot) {
  const chats = await db<{ chat_id: string }>(
    `select distinct chat_id from calls where made_at > now() - interval '7 days' or resolved_at > now() - interval '7 days' or status = 'open'`,
  );
  for (const { chat_id } of chats) {
    const text = await weeklyDigest(chat_id);
    if (text) await bot.api.sendMessage(chat_id, text, { parse_mode: "HTML" }).catch((err) => console.error("digest failed", chat_id, err));
  }
}
