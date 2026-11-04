import type { CallRow } from "./calls";
import { db } from "./db";
import { PRIOR_CALLS, segmentsOf, trackRecordOf, trustOn } from "./learning";
import { memoryCheckReady, type MemoryCheckView } from "./view";

/**
 * Does the memory help? For every settled call, the bot's trust in it is worked out from
 * what it knew when the call was made (only the author's calls settled before that), so
 * nothing later leaks in. Then:
 * - Brier score of that trust against the outcome, next to a bot that forgets and so trusts
 *   everyone 50/50 (always 0.25), and a bot that only knows how often the chat's calls came true
 *   so far. Beating the first can just mean the chat is often right; beating the second takes
 *   knowing who is right about what. Lower is better.
 * - How often calls came true when the bot had flagged a weak spot, a strong spot, or neither.
 */

/** Settled calls scored, how many had a record behind them, both Brier scores, and hits per kind of spot. */
export type Scorecard = MemoryCheckView;

/** The scorecard for settled calls; each author's history is read only within their own chat. */
export function scoreMemory(settled: CallRow[]): Scorecard {
  const done = settled.filter((c) => c.status === "win" || c.status === "loss");
  const spots: Scorecard["spots"] = { weak: { calls: 0, hits: 0 }, strong: { calls: 0, hits: 0 }, none: { calls: 0, hits: 0 } };
  let withRecord = 0;
  let memory = 0;
  let chatRate = 0;

  for (const c of done) {
    const madeAt = new Date(c.made_at).getTime();
    // The chat's hit rate so far, pulled toward a coin flip the same way a member's record is.
    const chatBefore = done.filter((p) => p.chat_id === c.chat_id && p.id !== c.id && p.resolved_at && new Date(p.resolved_at).getTime() < madeAt);
    const chatHits = chatBefore.filter((p) => p.status === "win").length;
    const chatTrust = (chatHits + PRIOR_CALLS / 2) / (chatBefore.length + PRIOR_CALLS);
    const before = done
      .filter((p) => p.chat_id === c.chat_id && p.author_id === c.author_id && p.id !== c.id && p.resolved_at && new Date(p.resolved_at).getTime() < madeAt)
      .sort((a, b) => new Date(a.resolved_at!).getTime() - new Date(b.resolved_at!).getTime());
    const record = trackRecordOf(before) ?? undefined;
    if (record) withRecord++;

    const hit = c.status === "win" ? 1 : 0;
    memory += (trustOn(record, c).weight - hit) ** 2;
    chatRate += (chatTrust - hit) ** 2;

    const kinds = new Set(segmentsOf(c));
    const spot = record?.weak.some((s) => kinds.has(s.segment)) ? "weak" : record?.strong.some((s) => kinds.has(s.segment)) ? "strong" : "none";
    spots[spot].calls++;
    spots[spot].hits += hit;
  }

  return {
    calls: done.length,
    withRecord,
    brierMemory: done.length ? memory / done.length : null,
    brierForgetful: done.length ? 0.25 : null,
    brierChatRate: done.length ? chatRate / done.length : null,
    spots,
  };
}

/** The scorecard for one chat, or for every chat the bot is in. */
export async function memoryScorecard(chatId?: number | string): Promise<Scorecard> {
  const rows = await db<CallRow>(
    `select * from calls where status in ('win', 'loss') and not hidden ${chatId === undefined ? "" : "and chat_id = $1"} order by made_at`,
    chatId === undefined ? [] : [chatId],
  );
  return scoreMemory(rows);
}

/** One line for the chat: what the memory has been worth so far, once there's enough to say. */
export function scorecardLine(s: Scorecard): string | null {
  if (!memoryCheckReady(s)) return null;
  const rate = (x: { calls: number; hits: number }) => (x.calls ? `${Math.round((x.hits / x.calls) * 100)}% right (${x.hits}/${x.calls})` : null);
  const chat = s.brierChatRate != null ? `, and ${s.brierChatRate.toFixed(3)} for one that only knows how often this chat is right` : "";
  const parts = [`🧪 Memory check over ${s.calls} settled calls: my trust scored ${s.brierMemory!.toFixed(3)} vs 0.250 for a bot that forgets${chat} (lower is better).`];
  const weak = rate(s.spots.weak);
  const strong = rate(s.spots.strong);
  if (weak) parts.push(`Calls I flagged as a weak spot: ${weak}.`);
  if (strong) parts.push(`Strong spots: ${strong}.`);
  return parts.join(" ");
}
