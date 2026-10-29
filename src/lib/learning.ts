import type { CallRow } from "./calls";
import { db } from "./db";
import { recall, remember } from "./memory";
import { isSuiToken } from "./suiPrices";

/**
 * The learning loop. Every settled call updates what the bot knows about its author:
 * where they tend to be right and where they don't. That track record is written to the
 * chat's Walrus Memory (so its history shows how the bot's view changed) and comes back
 * on every new call the author makes, next to their most similar past call.
 */

const MAJORS = new Set(["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "ADA", "TON", "AVAX", "LINK"]);
const DAY = 86_400_000;

/** The groups a call counts towards, e.g. "Sui tokens", "bullish calls", "NaVi picks". */
export function segmentsOf(c: Pick<CallRow, "market" | "subject" | "direction" | "made_at" | "deadline">): string[] {
  if (c.market === "cs2") return ["CS2 picks", `${c.subject} picks`];
  const out = ["crypto calls", `${c.subject} calls`];
  if (isSuiToken(c.subject) && c.subject !== "SUI") out.push("Sui tokens");
  else if (MAJORS.has(c.subject)) out.push("majors");
  out.push(c.direction === "above" || c.direction === "up" ? "bullish calls" : "bearish calls");
  const horizon = new Date(c.deadline).getTime() - new Date(c.made_at).getTime();
  if (horizon < DAY) out.push("calls under a day");
  else if (horizon > 7 * DAY) out.push("long-range calls");
  return out;
}

export interface SegmentRecord {
  segment: string;
  hits: number;
  calls: number;
}

export interface TrackRecord {
  authorName: string;
  hits: number;
  calls: number;
  strong: SegmentRecord[];
  weak: SegmentRecord[];
  /** Per segment, for picking the ones relevant to a new call. */
  segments: SegmentRecord[];
  summary: string;
}

const rate = (r: { hits: number; calls: number }) => r.hits / r.calls;
const fmt = (r: SegmentRecord) => `${r.segment} ${r.hits}/${r.calls}`;

/** Works out an author's track record in a chat from their settled calls. */
export async function computeTrackRecord(chatId: number | string, authorId: number | string): Promise<TrackRecord | null> {
  const settled = await db<CallRow>(
    `select * from calls where chat_id = $1 and author_id = $2 and status in ('win', 'loss') and not hidden order by resolved_at`,
    [chatId, authorId],
  );
  return trackRecordOf(settled);
}

/** The track record behind a list of one author's settled calls, oldest first. */
export function trackRecordOf(settled: CallRow[]): TrackRecord | null {
  if (!settled.length) return null;

  const bySegment = new Map<string, SegmentRecord>();
  for (const c of settled) {
    for (const segment of segmentsOf(c)) {
      const r = bySegment.get(segment) ?? { segment, hits: 0, calls: 0 };
      r.calls++;
      if (c.status === "win") r.hits++;
      bySegment.set(segment, r);
    }
  }
  const segments = [...bySegment.values()];
  // A pattern needs at least two settled calls before the bot calls it a strength or weakness.
  const telling = segments.filter((r) => r.calls >= 2 && r.segment !== "crypto calls").sort((a, b) => b.calls - a.calls);
  const strong = telling.filter((r) => rate(r) >= 0.67).slice(0, 2);
  const weak = telling.filter((r) => rate(r) <= 0.34).slice(0, 2);

  const hits = settled.filter((c) => c.status === "win").length;
  const name = settled[settled.length - 1].author_name;
  const parts = [`${name} is ${hits}/${settled.length} right`];
  if (strong.length) parts.push(`strong on ${strong.map(fmt).join(", ")}`);
  if (weak.length) parts.push(`weak on ${weak.map(fmt).join(", ")}`);
  const bullish = bySegment.get("bullish calls")?.calls ?? 0;
  const crypto = bySegment.get("crypto calls")?.calls ?? 0;
  if (crypto >= 4 && bullish / crypto >= 0.75) parts.push("and mostly calls pumps");

  return { authorName: name, hits, calls: settled.length, strong, weak, segments, summary: parts.join("; ") + "." };
}

/** Recomputes the author's track record after a result, stores it, and adds it to memory. */
export async function learnFrom(call: CallRow): Promise<TrackRecord | null> {
  const record = await computeTrackRecord(call.chat_id, call.author_id);
  if (!record) return null;
  await db(
    `insert into track_records (chat_id, author_id, author_name, summary, stats, updated_at) values ($1, $2, $3, $4, $5, now())
     on conflict (chat_id, author_id) do update set author_name = excluded.author_name, summary = excluded.summary, stats = excluded.stats, updated_at = now()`,
    [call.chat_id, call.author_id, record.authorName, record.summary, JSON.stringify(record)],
  );
  await remember(
    call.chat_id,
    `[TRACK RECORD ${record.authorName}] ${new Date().toISOString().slice(0, 10)}, after call #${call.id}: ${record.summary}`,
  ).catch((err) => console.error("memory write failed", err));
  return record;
}

export async function trackRecords(chatId: number | string): Promise<Map<string, TrackRecord>> {
  const rows = await db<{ author_id: string; stats: TrackRecord }>(`select author_id, stats from track_records where chat_id = $1`, [chatId]);
  return new Map(rows.map((r) => [String(r.author_id), r.stats]));
}

/** A short "strong: … · weak: …" line for boards. */
export const insightLine = (r: TrackRecord) =>
  [r.strong.length ? `strong: ${r.strong.map((s) => s.segment).join(", ")}` : "", r.weak.length ? `weak: ${r.weak.map((s) => s.segment).join(", ")}` : ""]
    .filter(Boolean)
    .join(" · ");

/**
 * What the bot says when an author makes a new call: their record on this kind of call,
 * and their most similar past call, recalled from the chat's Walrus Memory by meaning.
 */
export async function noteForNewCall(call: CallRow): Promise<string[]> {
  const record = (await trackRecords(call.chat_id)).get(String(call.author_id));
  const lines: string[] = [];

  if (record) {
    const relevant = segmentsOf(call)
      .map((s) => record.segments.find((r) => r.segment === s))
      .filter((r): r is SegmentRecord => Boolean(r) && r!.segment !== "crypto calls")
      .slice(0, 3);
    // Call out when this call is in a spot the author is known to be good or bad at.
    const isIn = (list: SegmentRecord[]) => relevant.find((r) => list.some((s) => s.segment === r.segment));
    const strong = isIn(record.strong);
    const weak = isIn(record.weak);
    const spot = weak ? ` — ⚠️ a weak spot (${fmt(weak)})` : strong ? ` — 🔥 a strong spot (${fmt(strong)})` : "";
    lines.push(`📊 ${call.author_name}'s record: ${relevant.length ? relevant.map(fmt).join(" · ") : `${record.hits}/${record.calls} overall`}${spot}`);
  }

  const memories = await recall(call.chat_id, `${call.author_name} ${call.subject} ${call.quote}`, 8).catch(() => []);
  const similar = memories.find(
    (m) => m.text.startsWith("[RESULT #") && m.text.includes(call.author_name) && m.text.includes(call.subject) && !m.text.startsWith(`[RESULT #${call.id}]`),
  );
  if (similar) {
    const verdict = similar.text.includes(" was RIGHT") ? "✅ right" : "❌ wrong";
    const quote = similar.text.match(/call "([^"]+)"/)?.[1];
    if (quote) lines.push(`↩ Last time: “${quote}” — ${verdict}`);
  }
  return [...lines, ...(await roomNote(call).catch(() => []))];
}

/* ---------- Whom to trust ---------- */

/** Which way a call leans: "up" or "down" for crypto, the team picked for CS2. */
const sideOf = (c: CallRow) => (c.market === "cs2" ? c.subject : c.direction === "above" || c.direction === "up" ? "up" : "down");
const sideLabel = (side: string) => (side === "up" ? "↑ up" : side === "down" ? "↓ down" : side);

/** Two calls on the same coin, or on the same match from either side. */
const sameQuestion = (a: CallRow, b: CallRow) =>
  a.market === b.market &&
  (a.market === "crypto" ? a.subject === b.subject : [a.subject, a.opponent].sort().join() === [b.subject, b.opponent].sort().join());

/**
 * How far the bot trusts an author on a call: their hit rate on the closest kind of call
 * (this coin or team first, then its group, then overall), smoothed so 1/1 isn't 100%.
 */
export function trustOn(record: TrackRecord | undefined, c: CallRow): { weight: number; basis: string } {
  if (!record) return { weight: 0.5, basis: "no record yet" };
  const own = `${c.subject} ${c.market === "cs2" ? "picks" : "calls"}`;
  const kinds = segmentsOf(c).filter((s) => s !== "crypto calls").sort((a, b) => Number(b === own) - Number(a === own));
  const r = kinds.map((s) => record.segments.find((x) => x.segment === s)).find(Boolean) ?? { segment: "everything", hits: record.hits, calls: record.calls };
  return { weight: (r.hits + 1) / (r.calls + 2), basis: `${r.hits}/${r.calls} on ${r.segment}` };
}

/**
 * When others in the chat already have an open call on the same coin or match, the bot
 * weighs everyone's view by what it has learned about them and says which way the
 * people worth listening to lean.
 */
export async function roomNote(call: CallRow): Promise<string[]> {
  const open = await db<CallRow>(
    `select * from calls where chat_id = $1 and market = $2 and status = 'open' and not hidden and id <> $3 and author_id <> $4 order by made_at desc`,
    [call.chat_id, call.market, call.id, call.author_id],
  );
  // One voice per member: their latest call on it.
  const others = new Map<string, CallRow>();
  for (const c of open) if (sameQuestion(call, c) && !others.has(String(c.author_id))) others.set(String(c.author_id), c);
  if (!others.size) return [];

  const records = await trackRecords(call.chat_id);
  const votes = [call, ...others.values()].map((c) => ({ c, side: sideOf(c), ...trustOn(records.get(String(c.author_id)), c) }));
  const bySide = new Map<string, number>();
  for (const v of votes) bySide.set(v.side, (bySide.get(v.side) ?? 0) + v.weight);
  const total = [...bySide.values()].reduce((a, b) => a + b, 0);
  const [lead, weight] = [...bySide.entries()].sort((a, b) => b[1] - a[1])[0];
  const share = Math.round((weight / total) * 100);

  // When the head count and the track records disagree, that's the point worth making.
  const heads = new Map<string, number>();
  for (const v of votes) heads.set(v.side, (heads.get(v.side) ?? 0) + 1);
  const [mostSaid, saidBy] = [...heads.entries()].sort((a, b) => b[1] - a[1])[0];
  const overruled = mostSaid !== lead && saidBy > votes.length / 2 ? `${saidBy} of ${votes.length} say ${sideLabel(mostSaid)}, but w` : "W";

  const topic = call.market === "cs2" ? `${call.subject} vs ${call.opponent}` : call.subject;
  return [
    `🧭 Also on ${topic}: ${votes
      .slice(1)
      .map((v) => `${v.c.author_name} ${sideLabel(v.side)} (${v.basis})`)
      .join(", ")}`,
    bySide.size === 1
      ? `Everyone agrees: ${sideLabel(lead)}.`
      : share === 50
        ? "Weighted by track record, the chat is split 50/50."
        : `${overruled}eighted by track record the chat leans ${sideLabel(lead)} (${share}%).`,
  ];
}
