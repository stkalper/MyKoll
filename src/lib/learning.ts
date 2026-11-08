import type { CallRow } from "./calls";
import { db } from "./db";
import { noteEffect } from "./effects";
import { recall, remember } from "./memory";
import { blobUrl } from "./proof";
import { robinhoodKind } from "./robinhoodPrices";
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
export function segmentsOf(c: Pick<CallRow, "market" | "subject" | "direction" | "made_at" | "deadline"> & { market_ref?: CallRow["market_ref"] }): string[] {
  if (c.market === "cs2") {
    const out = ["CS2 picks", `${c.subject} picks`];
    // What the market thought of the team winning when it was picked (a score pick's own odds are lower).
    const win = c.market_ref ? (c.market_ref.winProb ?? c.market_ref.prob) : null;
    if (win !== null && win < 0.45) out.push("underdog picks");
    else if (win !== null && win > 0.55) out.push("favourite picks");
    if (c.market_ref?.score) out.push("map-score picks");
    return out;
  }
  const out = ["crypto calls", `${c.subject} calls`];
  const robinhood = robinhoodKind(c.subject);
  if (isSuiToken(c.subject) && c.subject !== "SUI") out.push("Sui tokens");
  else if (MAJORS.has(c.subject)) out.push("majors");
  else if (robinhood === "stock") out.push("stock tokens");
  else if (robinhood === "memecoin") out.push("Robinhood Chain memecoins");
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
  /** CS2 picks with Polymarket odds: hit rate minus the market's average price for them. */
  marketEdge?: number;
  summary: string;
}

const rate = (r: { hits: number; calls: number }) => r.hits / r.calls;
const fmt = (r: SegmentRecord) => `${r.segment} ${r.hits}/${r.calls}`;

// A pattern needs at least two settled calls before the bot calls it a strength or weakness.
const isTelling = (r: SegmentRecord) => r.calls >= 2 && r.segment !== "crypto calls";
const isStrong = (r: SegmentRecord) => isTelling(r) && rate(r) >= 0.67;
const isWeak = (r: SegmentRecord) => isTelling(r) && rate(r) <= 0.34;

/**
 * How a result changed the bot's view of someone: a strength or weakness it now sees, or one it
 * no longer does, with the numbers before and after. Only clear crossings count: a strength
 * (67%+) is new when the rate was under 60% before, and gone when it falls under 60%; a weakness
 * (34% or less) likewise against 40%. So 2/2 → 2/3 → 3/4 isn't reported as three changes of mind.
 * A spot that only slipped out of the summary's top two hasn't changed either.
 */
export function recordChanges(before: TrackRecord | undefined, after: TrackRecord): string[] {
  if (!before) return [];
  const find = (r: TrackRecord, segment: string) => r.segments.find((s) => s.segment === segment);
  const was = (r?: SegmentRecord) => (r ? `${r.hits}/${r.calls}` : "none");
  const out: string[] = [];
  for (const [kind, gone] of [
    ["strong", (r?: SegmentRecord) => !r || !isTelling(r) || rate(r) < 0.6],
    ["weak", (r?: SegmentRecord) => !r || !isTelling(r) || rate(r) > 0.4],
  ] as const) {
    for (const r of kind === "strong" ? after.strong : after.weak) {
      const old = find(before, r.segment);
      if (gone(old)) out.push(`now ${kind} on ${r.segment} (${was(old)} → ${r.hits}/${r.calls})`);
    }
    for (const r of kind === "strong" ? before.strong : before.weak) {
      const current = find(after, r.segment);
      if (gone(current)) out.push(`no longer ${kind} on ${r.segment} (${r.hits}/${r.calls} → ${was(current)})`);
    }
  }
  return out;
}

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
  const telling = segments.filter((r) => isTelling(r)).sort((a, b) => b.calls - a.calls);
  const strong = telling.filter(isStrong).slice(0, 2);
  const weak = telling.filter(isWeak).slice(0, 2);

  const hits = settled.filter((c) => c.status === "win").length;
  const name = settled[settled.length - 1].author_name;
  const parts = [`${name} is ${hits}/${settled.length} right`];
  if (strong.length) parts.push(`strong on ${strong.map(fmt).join(", ")}`);
  if (weak.length) parts.push(`weak on ${weak.map(fmt).join(", ")}`);
  const bullish = bySegment.get("bullish calls")?.calls ?? 0;
  const crypto = bySegment.get("crypto calls")?.calls ?? 0;
  if (crypto >= 4 && bullish / crypto >= 0.75) parts.push("and mostly calls pumps");

  // Against the market: how much more often their CS2 picks came true than Polymarket gave them.
  // Odds read after the call was made (a pick that waited for its match) would flatter the edge.
  const priced = settled.filter((c) => c.market_ref && !c.market_ref.late);
  const marketEdge = priced.length >= 2 ? priced.reduce((sum, c) => sum + (c.status === "win" ? 1 : 0) - c.market_ref!.prob, 0) / priced.length : undefined;
  if (marketEdge !== undefined) {
    const pts = Math.round(marketEdge * 100);
    parts.push(pts >= 0 ? `beats Polymarket by ${pts} pts on CS2` : `trails Polymarket by ${-pts} pts on CS2`);
  }

  return { authorName: name, hits, calls: settled.length, strong, weak, segments, marketEdge, summary: parts.join("; ") + "." };
}

/** The feed line for a change of mind; a long or multi-line quote (a forwarded signal post) is cut to its start. */
export function changeText(call: Pick<CallRow, "author_name" | "quote">, changes: string[]): string {
  const line = call.quote.split("\n")[0].trim();
  const quote = line.length > 60 ? `${line.slice(0, 59)}…` : line + (call.quote.includes("\n") ? " …" : "");
  return `Changed its view of ${call.author_name} after "${quote}": ${changes.join("; ")}.`;
}

/** Recomputes the author's track record after a result, stores it, and adds it to memory. */
export async function learnFrom(call: CallRow): Promise<TrackRecord | null> {
  const [record, [stored]] = await Promise.all([
    computeTrackRecord(call.chat_id, call.author_id),
    db<{ stats: TrackRecord }>(`select stats from track_records where chat_id = $1 and author_id = $2`, [call.chat_id, call.author_id]),
  ]);
  if (!record) return null;
  // Said out loud when a result changes what the bot thinks someone is good or bad at.
  const changes = recordChanges(stored?.stats, record);
  if (changes.length) {
    await noteEffect(call.chat_id, "record_changed", changeText(call, changes), call.id);
    await remember(
      call.chat_id,
      `[RECORD CHANGE ${record.authorName}] ${new Date().toISOString().slice(0, 10)}, after call #${call.id}: ${record.authorName} is ${changes.join("; ")}.`,
    ).catch((err) => console.error("memory write failed", err));
  }
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

/**
 * Recomputes a member's stored record after one of their calls is hidden or brought back, so the
 * record the bot recalls never counts a call the member took off the board.
 */
export async function refreshRecord(chatId: number | string, authorId: number | string): Promise<void> {
  const record = await computeTrackRecord(chatId, authorId);
  if (!record) {
    await db(`delete from track_records where chat_id = $1 and author_id = $2`, [chatId, authorId]);
    return;
  }
  await db(
    `insert into track_records (chat_id, author_id, author_name, summary, stats, updated_at) values ($1, $2, $3, $4, $5, now())
     on conflict (chat_id, author_id) do update set author_name = excluded.author_name, summary = excluded.summary, stats = excluded.stats, updated_at = now()`,
    [chatId, authorId, record.authorName, record.summary, JSON.stringify(record)],
  );
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
/** Which way a call leans, for finding its like in memory: bullish or bearish on a coin, or a pick on a team. */
const leanOf = (c: Pick<CallRow, "market" | "direction">) => (c.market === "cs2" ? "pick" : c.direction === "below" || c.direction === "down" ? "bearish" : "bullish");

/**
 * How past calls like this one ended, read from the chat's Walrus Memory: the [RESULT] entries of
 * calls on the same coin leaning the same way, or picks on the same team, by anyone in the chat.
 * Hidden calls and this call itself are left out, and each call counts once.
 */
export function likeCallsIn(texts: string[], call: Pick<CallRow, "id" | "market" | "direction" | "subject">, hidden: Set<number>) {
  const lean = leanOf(call);
  const seen = new Map<number, boolean>();
  for (const text of texts) {
    const m = text.match(/^\[RESULT #(\d+)\] .*?call ".*?" \((.+?)\) was (RIGHT|WRONG)/);
    if (!m) continue;
    const id = Number(m[1]);
    if (id === call.id || hidden.has(id) || seen.has(id)) continue;
    const claimed = m[2];
    if (!claimed.startsWith(`${call.subject} `)) continue;
    const rest = claimed.slice(call.subject.length + 1);
    const same =
      lean === "pick" ? /^to (beat|win)( |$)/.test(rest) : lean === "bullish" ? /^(above|up)( |$)/.test(rest) : /^(below|down)( |$)/.test(rest);
    if (same) seen.set(id, m[3] === "RIGHT");
  }
  return { n: seen.size, hits: [...seen.values()].filter(Boolean).length, lean, ids: [...seen.keys()].sort((a, b) => a - b) };
}

/** A line on a receipt: plain text (escaped when sent), or HTML the bot built itself, e.g. with links. */
export type ReceiptLine = string | { html: string };

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** How many of the recalled calls get a link to their sealed result, so the line stays one line. */
const LIKE_LINKS = 5;

/** A receipt line on how calls like this one have gone in the chat, from memory, once there are at least 3. */
async function likeCallsLine(call: CallRow): Promise<ReceiptLine | null> {
  const lean = leanOf(call);
  // Three searches worded differently, side by side, and their results merged: now and then the
  // relayer answers one with a handful of entries, or with entries on something else, and in
  // trials on the real chat one of three always came back whole. Any of them may fail.
  const worded = lean === "pick" ? `RESULT ${call.subject} to beat` : `RESULT ${call.subject} ${lean === "bullish" ? "above" : "below"}`;
  const queries: [string, number][] = [
    [`RESULT ${call.subject}`, 60],
    [`${call.subject} call result`, 60],
    [worded, 30],
  ];
  const [found, hiddenRows] = await Promise.all([
    Promise.all(queries.map(([q, limit]) => recall(call.chat_id, q, limit).catch(() => []))),
    db<{ id: number }>(`select id from calls where chat_id = $1 and hidden`, [call.chat_id]),
  ]);
  const memories = found.flat();
  const like = likeCallsIn(
    memories.map((m) => m.text),
    call,
    new Set(hiddenRows.map((r) => r.id)),
  );
  if (like.n < 3) return null;
  const what = lean === "pick" ? `picks on ${call.subject}` : `${lean} ${call.subject} calls`;
  await noteEffect(call.chat_id, "last_time", `Recalled ${like.n} past ${what} from memory, ${like.hits} of them right, for ${call.author_name}'s call "${call.quote}".`, call.id);
  // The latest few of those results, each linked to the Walrus blob it was recalled from.
  const blobOf = new Map<number, string>();
  for (const m of memories) {
    const id = Number(m.text.match(/^\[RESULT #(\d+)\]/)?.[1]);
    if (id && m.blobId && !blobOf.has(id)) blobOf.set(id, m.blobId);
  }
  const linked = like.ids.filter((id) => blobOf.has(id)).slice(-LIKE_LINKS);
  const links = linked.map((id) => `<a href="${blobUrl(blobOf.get(id)!)}">#${id}</a>`).join(" ");
  const more = linked.length && like.n > linked.length ? " …" : "";
  return {
    html: `🧠 From this chat's memory: ${like.hits} of ${like.n} ${escHtml(what)} came true${links ? `
<i>recalled from Walrus: ${links}${more}</i>` : ""}`,
  };
}

/**
 * The bot's own chance that the call comes true, from what it has learned about the author: the
 * same number the Memory Check scores against outcomes. Next to Polymarket's price on a CS2 pick.
 * Only said once the author has a record; with none the bot knows nothing and it would read 50%.
 */
export function chanceLine(record: TrackRecord | undefined, call: CallRow): string | null {
  if (!record) return null;
  const { weight, basis } = trustOn(record, call);
  const ref = call.market_ref;
  const market = ref && !ref.score ? ` · Polymarket ${Math.round(ref.prob * 100)}%` : "";
  return `🎯 Memory's chance: ${Math.round(weight * 100)}% (${basis})${market}`;
}

export async function noteForNewCall(call: CallRow): Promise<ReceiptLine[]> {
  // Recall takes a second or more, so it only runs when the author has a settled call on this coin or team to recall.
  const [records, [past], room, like] = await Promise.all([
    trackRecords(call.chat_id),
    db<{ n: number }>(
      `select count(*)::int as n from calls where chat_id = $1 and author_id = $2 and subject = $3 and status in ('win', 'loss') and not hidden and id <> $4`,
      [call.chat_id, call.author_id, call.subject, call.id],
    ),
    roomNote(call).catch(() => [] as string[]),
    likeCallsLine(call).catch(() => null),
  ]);
  const record = records.get(String(call.author_id));
  const lines: ReceiptLine[] = [];
  const said = `${call.author_name}'s call "${call.quote}"`;

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
    if (weak) await noteEffect(call.chat_id, "weak_spot", `Flagged ${said} as a weak spot (${fmt(weak)}).`, call.id);
    else if (strong) await noteEffect(call.chat_id, "strong_spot", `Flagged ${said} as a strong spot (${fmt(strong)}).`, call.id);
    lines.push(`📊 ${call.author_name}'s record: ${relevant.length ? relevant.map(fmt).join(" · ") : `${record.hits}/${record.calls} overall`}${spot}`);
    const chance = chanceLine(record, call);
    if (chance) lines.push(chance);
  }

  const memories = past?.n ? await recall(call.chat_id, `${call.author_name} ${call.subject} ${call.quote}`, 8).catch(() => []) : [];
  const similar = memories.find(
    (m) => m.text.startsWith("[RESULT #") && m.text.includes(call.author_name) && m.text.includes(call.subject) && !m.text.startsWith(`[RESULT #${call.id}]`),
  );
  if (similar) {
    const verdict = similar.text.includes(" was RIGHT") ? "✅ right" : "❌ wrong";
    const quote = similar.text.match(/call "([^"]+)"/)?.[1];
    if (quote) {
      lines.push(`↩ Last time: “${quote}” — ${verdict}`);
      await noteEffect(call.chat_id, "last_time", `Answered ${said} with what they said last time: "${quote}", ${verdict.slice(2)}.`, call.id);
    }
  }
  if (like) lines.push(like);
  if (room.length) await noteEffect(call.chat_id, "room", `Weighed everyone's record on ${call.subject} to show which way the people worth listening to lean.`, call.id);
  return [...lines, ...room];
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
 * How far the bot trusts an author on a call. It starts from a coin flip and moves only as far as
 * the evidence takes it: their overall record counts as if 16 coin-flip calls came before it, and
 * their record on the closest kind of call (this coin or team first, then its group) counts as if
 * 16 calls at their overall rate came before that. One right call barely moves it. The sizes come
 * from simulated chats (scripts/try-trust.mts), not from real calls, so they aren't fitted to the
 * score they're judged by.
 */
export const PRIOR_CALLS = 16;
const PRIOR_KIND_CALLS = 16;

export function trustOn(record: TrackRecord | undefined, c: CallRow): { weight: number; basis: string } {
  if (!record) return { weight: 0.5, basis: "no record yet" };
  const own = `${c.subject} ${c.market === "cs2" ? "picks" : "calls"}`;
  const kinds = segmentsOf(c).filter((s) => s !== "crypto calls").sort((a, b) => Number(b === own) - Number(a === own));
  const overall = (record.hits + PRIOR_CALLS / 2) / (record.calls + PRIOR_CALLS);
  const r = kinds.map((s) => record.segments.find((x) => x.segment === s)).find(Boolean);
  if (!r) return { weight: overall, basis: `${record.hits}/${record.calls} on everything` };
  return { weight: (r.hits + PRIOR_KIND_CALLS * overall) / (r.calls + PRIOR_KIND_CALLS), basis: `${r.hits}/${r.calls} on ${r.segment}` };
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

  const topic = call.market === "cs2" && call.opponent ? `${call.subject} vs ${call.opponent}` : call.subject;
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
