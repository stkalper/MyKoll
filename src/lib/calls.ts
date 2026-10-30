import { inBackground } from "./background";
import { config } from "./config";
import { db } from "./db";
import { complete, parseJson } from "./llm";
import { learnFrom, trackRecords } from "./learning";
import { remember } from "./memory";
import { wakeAt } from "./schedule";
import { findMatch, marketWinner, teamKey, type MarketRef } from "./polymarket";
import type { PoolRead } from "./proof";
import { DISAGREE, gap, quote, sourceLabel, type PriceSource, type Quote } from "./tatum";

export type Market = "crypto" | "cs2";
/** "to" is a bare price level ("BTC 102k tomorrow"): only on a draft, it becomes above/below once the price is known. */
export type Direction = "above" | "below" | "up" | "down" | "win" | "to";
export type Status = "open" | "awaiting_score" | "win" | "loss" | "void";

export interface CallRow {
  id: number;
  chat_id: string;
  chat_title: string | null;
  author_id: string;
  author_name: string;
  market: Market;
  subject: string;
  opponent: string | null;
  direction: Direction;
  target: number | null;
  entry_price: number | null;
  quote: string;
  made_at: Date;
  deadline: Date;
  status: Status;
  final_price: number | null;
  result_note: string | null;
  resolved_at: Date | null;
  hidden: boolean;
  price_source: PriceSource | null;
  entry_proof: PoolRead[] | null;
  entry_check: number | null;
  final_proof: PoolRead[] | null;
  final_check: number | null;
  market_ref: MarketRef | null;
}

/** What the model reads out of a message before it becomes a call. */
export interface Draft {
  market: Market;
  subject: string;
  opponent: string | null;
  direction: Direction;
  target: number | null;
  deadline: string;
  quote: string;
  /** The author's reasoning when it came in the same message as the call. */
  why?: string | null;
}

const DAY = 86_400_000;
/** Longest message the bot reads: a signal with its reasoning fits, an essay doesn't. */
const MAX_MESSAGE = 1500;
/** A receipt quotes the call itself, not a whole long message. */
const MAX_QUOTE = 280;

/* ---------- Spotting calls ---------- */

// \b only knows ASCII letters, so word edges are spelled out to work for Cyrillic too.
const word = (alts: string) => new RegExp(`(?<![\\p{L}\\d])(${alts})(?![\\p{L}])`, "iu");
const CS2_TEAMS = word(
  "navi|na'vi|нави|наві|faze|фейз|vitality|віталіті|spirit|спіріт|спирит|g2|mouz|falcons|liquid|astralis|heroic|furia|mongolz|eternal fire|virtus\\.?pro|vp|complexity|3dmax|pain|aurora|b8|monte|nip|big|gamerlegion|betboom|parivision|legacy|mibr|imperial|og",
);
const CRYPTO = word(
  "\\$[a-z]{2,8}|navx|haedal|ika|hippo|lofi|scallop|btc|bitcoin|eth|ether\\p{L}*|sol|solana|sui|wal|walrus|xrp|doge|bnb|ton|ada|avax|link|pepe|hype|deep|cetus|trx|tron|трон\\p{L}*|трх|ltc|bch|atom|algo|xlm|matic|vet|cro|chz|tsla|tesla|тесл\\p{L}*|nvda|nvidia|нвід\\p{L}*|aapl|msft|amzn|googl|pons|понс|cashcat|бітк\\p{L}*|битк\\p{L}*|біток|биток|бтк|бтс|бтц|ефір\\p{L}*|етер\\p{L}*|эфир\\p{L}*|сол\\p{L}*|суі|суи",
);
/** Any ticker written in caps, e.g. "APT" or "WAL". */
const TICKER = /(?<![\p{L}\d])[A-Z]{2,6}(?![\p{L}])/u;
const PREDICTION =
  /\d|\b(will|gonna|by|to|until|pump|dump|moon|long|short|win|wins|beat|beats|take|takes|crash|ath|tp|sl|entry|target|signal)\b|буд|пі[дй]д|впад|вирос|вигра|візьм|рознес|злет|пойд|упад|вырас|выигр|возьм|разнес|порв|лонг|шорт|тейк|стоп|вхід|вход|ціль|цель|сигнал|памп|дамп|зрост|рост|пада/iu;

/** Cheap filter so the model only sees messages that could plausibly be a call. */
export function mightBeCall(text: string): boolean {
  if (text.length < 6 || text.length > MAX_MESSAGE || text.startsWith("/")) return false;
  return (CRYPTO.test(text) || TICKER.test(text) || CS2_TEAMS.test(text)) && PREDICTION.test(text);
}

/** "Tuesday 28 October 2026 at 14:05 (GMT+02:00)" in the chat's zone, so the model can resolve "by Friday". */
function nowInZone(): string {
  const now = new Date();
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: config.timezone, timeZoneName: "longOffset" })
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName")?.value;
  return `${now.toLocaleString("en-GB", { timeZone: config.timezone, dateStyle: "full", timeStyle: "short" })} (${offset})`;
}

/**
 * Asks the model whether a message is a checkable prediction and, if so, turns it
 * into a structured draft. Returns null for chatter, jokes and questions, and a reason
 * when it is a call the bot can't keep score on.
 */
export async function extractCall(text: string): Promise<Draft | { reason: string } | null> {
  const reply = await complete(
    [
      {
        role: "system",
        content: `You read messages from a Telegram group chat about crypto and Counter-Strike 2 and decide if a message is a CALL: a concrete, checkable prediction the author makes themselves.
A call is either:
- crypto: a coin's price going above/below a level, or up/down, by some time. Example: "SUI to $5 by Friday", "btc dumps under 90k this week", "sol up by tomorrow".
  A coin with a price and a time is a call even without a side: "BTC 102k tomorrow" / "БТС 102к завтра" means BTC gets to 102000 by tomorrow.
  A trading signal is a call too: "TRX long, entry 0.33, TP 0.36, SL 0.31" / "лонг TRX, тейк 0.36" means TRX above the first take-profit (short: below it).
  This also covers stock tokens on Robinhood Chain (TSLA, NVDA, AAPL, SPY, MSFT, AMZN, GOOGL, META, COIN) and its memecoins (PONS, CASHCAT): "tesla to 450 by Friday" is subject TSLA.
- cs2: a team winning a match. Example: "NaVi take FaZe tonight", "Spirit beats Vitality".
Not calls: questions, jokes, sarcasm, other people's predictions, vague moods ("sol looks good").

Now is ${nowInZone()} in ${config.timezone}.

Reply with JSON only:
{"is_call": boolean,
 "market": "crypto" | "cs2",
 "subject": ticker in caps for crypto (BTC, SUI, SOL, TSLA...) or the team picked to WIN for cs2,
 "opponent": the other team for cs2, else null,
 "direction": "above" | "below" (crypto with a price level and a side: above, over, to, pump, вище, до, памп...), "to" (a price level with no side said, e.g. "BTC 102k tomorrow"), "up" | "down" (crypto without a level), "win" (cs2),
 "target": price level in USD as a number, else null (expand "90k" / "90к" to 90000; "1 бакс" / "a buck" is 1),
 "in_minutes": minutes from now until the call is judged if the message says it relatively ("in 5 minutes", "in 2 hours", "через 5 годин" = 300, "через пів години" = 30, "within a day"), else null,
 "deadline": ISO 8601 with offset for when the call is judged if the message names a time or day, else null. "by Friday" / "до неділі" means the END of that day (23:59 local); "tonight" means 23:59 today; "tomorrow" / "завтра" means 23:59 tomorrow,
 "call_text": the part of the message that states the call itself, copied word for word (e.g. "TRX long, entry 0.33, TP 0.36"), else null,
 "why": the author's reasons for the call if the message gives any (charts, news, levels, "because ..."), copied or lightly trimmed in the author's own words and language, else null}`,
      },
      { role: "user", content: text },
    ],
    { temperature: 0, maxTokens: 600, json: true },
  );

  const r = parseJson<{
    is_call?: boolean;
    market?: Market;
    subject?: string;
    opponent?: string | null;
    direction?: Direction;
    target?: number | null;
    in_minutes?: number | null;
    deadline?: string | null;
    call_text?: string | null;
    why?: string | null;
  }>(reply);
  if (!r?.is_call || !r.subject || !r.market || !r.direction) return null;
  if (r.market !== "crypto" && r.market !== "cs2") return null;
  if (r.market === "cs2" && (!r.opponent || r.direction !== "win")) return null;
  if (r.market === "crypto" && !["above", "below", "up", "down", "to"].includes(r.direction)) return null;
  if (hasLevel(r.direction) && !(Number(r.target) > 0)) return null;

  // Relative times are counted here, not by the model. No deadline said: a CS2 match is
  // usually within a day, a price call gets a week.
  const minutes = Number(r.in_minutes);
  let deadline =
    minutes > 0 ? new Date(Date.now() + minutes * 60_000) : r.deadline ? new Date(r.deadline) : new Date(Date.now() + (r.market === "cs2" ? DAY : 7 * DAY));
  if (Number.isNaN(deadline.getTime())) deadline = new Date(Date.now() + 7 * DAY);
  if (deadline.getTime() < Date.now() + 60_000) return { reason: "That deadline is already here. Give it at least a couple of minutes." };
  if (deadline.getTime() > Date.now() + 120 * DAY) return { reason: "I only keep score on calls that settle within 120 days." };

  return {
    market: r.market,
    subject: r.market === "crypto" ? r.subject.replace(/^\$/, "").toUpperCase() : r.subject,
    opponent: r.market === "cs2" ? (r.opponent ?? null) : null,
    direction: r.direction,
    target: hasLevel(r.direction) ? Number(r.target) : null,
    deadline: deadline.toISOString(),
    quote: quoteOf(text, r.call_text),
    why: r.why?.trim().slice(0, 500) || null,
  };
}

/** The words a receipt quotes: the call as the model found it, if it really is in the message. */
function quoteOf(text: string, callText?: string | null): string {
  const call = callText?.trim();
  const quote = call && text.includes(call) ? call : text.trim();
  return quote.length > MAX_QUOTE ? `${quote.slice(0, MAX_QUOTE - 1)}…` : quote;
}

/* ---------- Describing calls ---------- */

const hasLevel = (d: Direction) => d === "above" || d === "below" || d === "to";

/** A bare level is a call on the move it takes to get there: above if the price is under it, below if over. */
export function sideOf(direction: Direction, target: number | null, price: number): Direction {
  return direction === "to" && target !== null ? (target > price ? "above" : "below") : direction;
}

export function usd(n: number): string {
  if (n >= 1000) return `$${Math.round(n).toLocaleString("en-US")}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toPrecision(3)}`;
}

export function when(d: Date | string): string {
  return new Date(d).toLocaleString("en-GB", {
    timeZone: config.timezone,
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "SUI above $5.00", "NaVi to beat FaZe", "SOL up from $186.40". */
export function claim(c: Pick<CallRow, "market" | "subject" | "opponent" | "direction" | "target" | "entry_price">): string {
  if (c.market === "cs2") return `${c.subject} to beat ${c.opponent}`;
  if (hasLevel(c.direction)) return `${c.subject} ${c.direction} ${usd(c.target!)}`;
  return `${c.subject} ${c.direction}${c.entry_price ? ` from ${usd(c.entry_price)}` : ""}`;
}

/* ---------- Logging and resolving ---------- */

export interface Author {
  id: number;
  name: string;
}

/** How a price was sourced, for memory: where it came from, the pool transaction behind it, and the cross-check. */
function sourcing(q: Pick<Quote, "price" | "source" | "proof" | "check">): string {
  const parts = [sourceLabel[q.source]];
  const read = q.proof?.[0];
  if (read?.tx) parts.push(`pool state from Sui tx ${read.tx}`);
  else if (read?.block) parts.push(`pool ${read.pool} at Robinhood Chain block ${read.block}`);
  if (q.check) parts.push(`Tatum Price API said ${usd(q.check)}${gap(q.price, q.check) > DISAGREE ? ", the sources disagree" : ""}`);
  return parts.join("; ");
}

export async function logCall(chat: { id: number; title?: string }, author: Author, draft: Draft): Promise<CallRow | { error: string }> {
  let q: Quote | null = null;
  if (draft.market === "crypto") {
    q = await quote(draft.subject);
    if (!q) return { error: `Tatum has no price for ${draft.subject}, so I can't keep score on it.` };
    draft = { ...draft, direction: sideOf(draft.direction, draft.target, q.price) };
    if (draft.direction === "above" && q.price >= draft.target!) return { error: `${draft.subject} is already at ${usd(q.price)}, above ${usd(draft.target!)}.` };
    if (draft.direction === "below" && q.price <= draft.target!) return { error: `${draft.subject} is already at ${usd(q.price)}, below ${usd(draft.target!)}.` };
  }

  // CS2: the same match on Polymarket, when there is one, for its odds and its result.
  let market: MarketRef | null = null;
  if (draft.market === "cs2" && draft.opponent) {
    market = await findMatch(draft.subject, draft.opponent, new Date(draft.deadline)).catch((err) => {
      console.error("Polymarket lookup failed", err);
      return null;
    });
    if (market && (market.prob >= 0.97 || market.prob <= 0.03))
      return { error: `Polymarket already has ${market.outcome} at ${Math.round(market.prob * 100)}%: that match looks decided.` };
  }

  const [call] = await db<CallRow>(
    `insert into calls (chat_id, chat_title, author_id, author_name, market, subject, opponent, direction, target, entry_price, price_source, entry_proof, entry_check, market_ref, quote, deadline)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) returning *`,
    [
      chat.id, chat.title ?? null, author.id, author.name, draft.market, draft.subject, draft.opponent, draft.direction, draft.target,
      q?.price ?? null, q?.source ?? null, q?.proof ? JSON.stringify(q.proof) : null, q?.check ?? null, market ? JSON.stringify(market) : null,
      draft.quote, draft.deadline,
    ],
  );

  // The deadline wake-up and the memory write don't depend on each other.
  const scheduled = wakeAt(call.id, call.deadline);
  // Reasons given in the same message are filed like a /why, so the receipt shows them.
  if (draft.why) await db(`insert into call_reasons (call_id, text) values ($1, $2)`, [call.id, draft.why]);

  const priceNote = q
    ? ` ${call.subject} was ${usd(q.price)} at the time (${sourcing(q)}).`
    : market
      ? ` Polymarket had ${market.outcome} at ${Math.round(market.prob * 100)}% to win (Tatum Prediction Market API, market ${market.marketId}).`
      : "";
  // The receipt doesn't need the memory write, so it goes out first and the write follows.
  inBackground(async () => {
    const record = (await trackRecords(chat.id).catch(() => new Map())).get(String(author.id));
    const recordNote = record ? ` Their record at the time: ${record.summary}` : "";
    const job = await remember(
      chat.id,
      `[CALL #${call.id}] ${when(call.made_at)}: ${author.name} called "${call.quote}". Logged as ${claim(call)} by ${when(call.deadline)}.${priceNote}${recordNote}`,
    );
    if (job) await db(`update calls set memory_job = $1 where id = $2`, [job, call.id]);
    if (draft.why) await remember(chat.id, `[REASON #${call.id}] ${author.name} explained the call "${call.quote}" (${claim(call)}): ${draft.why}`);
  });
  await scheduled;
  return call;
}

export interface Resolution {
  call: CallRow;
  /** Set when a CS2 call needs the chat to confirm the score. */
  askScore?: boolean;
}

/**
 * Settles every open crypto call whose target was hit or whose deadline passed, and every
 * CS2 call whose Polymarket market has resolved. CS2 calls past their deadline with no result
 * yet move to "awaiting_score", where the chat can confirm the score (and Polymarket can still
 * settle them first). Safe to run as often as you like.
 */
export async function resolveDue(): Promise<Resolution[]> {
  const open = await db<CallRow>(
    `select * from calls where status = 'open' or (status = 'awaiting_score' and market_ref is not null) order by deadline`,
  );
  const out: Resolution[] = [];
  const prices = new Map<string, Quote | null>();
  const now = Date.now();

  for (const call of open) {
    const due = new Date(call.deadline).getTime() <= now;

    if (call.market === "cs2") {
      const winner = call.market_ref ? await marketWinner(call.market_ref.marketId).catch(() => null) : null;
      if (winner) {
        const outcome = teamKey(winner) === teamKey(call.market_ref!.outcome) ? "win" : "loss";
        const settled = await settle(call, outcome, `${winner} won (resolved by Polymarket from HLTV)`, null);
        if (settled) out.push({ call: settled });
        continue;
      }
      if (!due || call.status !== "open") continue;
      const [moved] = await db<CallRow>(`update calls set status = 'awaiting_score' where id = $1 and status = 'open' returning *`, [call.id]);
      if (moved) out.push({ call: moved, askScore: true });
      continue;
    }

    if (!prices.has(call.subject)) prices.set(call.subject, await quote(call.subject).catch(() => null));
    const q = prices.get(call.subject);
    if (!q) continue;
    const price = q.price;

    let outcome: "win" | "loss" | null = null;
    if (call.direction === "above" && price >= call.target!) outcome = "win";
    else if (call.direction === "below" && price <= call.target!) outcome = "win";
    else if (due) {
      if (call.direction === "up") outcome = price > call.entry_price! ? "win" : "loss";
      else if (call.direction === "down") outcome = price < call.entry_price! ? "win" : "loss";
      else outcome = "loss";
    }
    if (!outcome) continue;

    const note = due ? `${call.subject} was ${usd(price)} at the deadline` : `${call.subject} hit ${usd(price)} before the deadline`;
    const settled = await settle(call, outcome, note, q);
    if (settled) out.push({ call: settled });
  }
  return out;
}

async function settle(call: CallRow, outcome: "win" | "loss", note: string, q: Quote | null): Promise<CallRow | null> {
  const [row] = await db<CallRow>(
    `update calls set status = $2, result_note = $3, final_price = $4, final_proof = $5, final_check = $6, resolved_at = now()
     where id = $1 and status in ('open', 'awaiting_score') returning *`,
    [call.id, outcome, note, q?.price ?? null, q?.proof ? JSON.stringify(q.proof) : null, q?.check ?? null],
  );
  if (!row) return null;
  await remember(
    row.chat_id,
    `[RESULT #${row.id}] ${row.author_name}'s call "${row.quote}" (${claim(row)}) was ${outcome === "win" ? "RIGHT" : "WRONG"}: ${note}${q ? ` (${sourcing(q)})` : ""}.` +
      (row.market_ref ? ` Polymarket had ${row.market_ref.outcome} at ${Math.round(row.market_ref.prob * 100)}% when it was called.` : ""),
  ).catch((err) => console.error("memory write failed", err));
  await learnFrom(row).catch((err) => console.error("learning failed", err));
  return row;
}

/** Records one member's answer to "who won?". A vote from anyone but the author settles it. */
export async function voteScore(callId: number, voter: Author, winner: string): Promise<{ call?: CallRow; message: string }> {
  const [call] = await db<CallRow>(`select * from calls where id = $1`, [callId]);
  if (!call || call.status !== "awaiting_score") return { message: "This one is already settled." };
  if (String(call.author_id) === String(voter.id)) return { message: "Someone else has to confirm your own call." };
  if (winner === "void") {
    await db(`update calls set status = 'void', result_note = 'match cancelled', resolved_at = now() where id = $1`, [callId]);
    return { message: "Marked as cancelled." };
  }
  await db(`insert into score_votes (call_id, user_id, winner) values ($1, $2, $3) on conflict do nothing`, [callId, voter.id, winner]);
  const outcome = winner === call.subject ? "win" : "loss";
  const settled = await settle(call, outcome, `${winner} won (confirmed by ${voter.name})`, null);
  return settled ? { call: settled, message: "Thanks, settled." } : { message: "This one is already settled." };
}

/* ---------- Reading ---------- */

export interface Standing {
  author_id: string;
  author_name: string;
  calls: number;
  hits: number;
}

export async function leaderboard(chatId: number | string, market: Market): Promise<Standing[]> {
  return db<Standing>(
    `select author_id, max(author_name) as author_name,
            count(*)::int as calls, count(*) filter (where status = 'win')::int as hits
       from calls
      where chat_id = $1 and market = $2 and status in ('win', 'loss') and not hidden
      group by author_id
      order by count(*) filter (where status = 'win')::float / count(*) desc, count(*) desc`,
    [chatId, market],
  );
}

export async function openCalls(chatId: number | string): Promise<CallRow[]> {
  return db<CallRow>(`select * from calls where chat_id = $1 and status in ('open', 'awaiting_score') and not hidden order by deadline`, [chatId]);
}

export async function hiddenIds(chatId: number | string): Promise<Set<number>> {
  const rows = await db<{ id: number }>(`select id from calls where chat_id = $1 and hidden`, [chatId]);
  return new Set(rows.map((r) => r.id));
}

export async function recentCalls(chatId: number | string, limit = 30): Promise<CallRow[]> {
  return db<CallRow>(`select * from calls where chat_id = $1 and not hidden order by made_at desc limit $2`, [chatId, limit]);
}

/** Everything the bot keeps about one member of a chat, hidden calls included. */
export async function callsBy(chatId: number | string, authorId: number | string): Promise<CallRow[]> {
  return db<CallRow>(`select * from calls where chat_id = $1 and author_id = $2 order by made_at desc`, [chatId, authorId]);
}

/** Lets an author take a call off the board and out of the bot's answers, or bring it back. */
export async function setHidden(callId: number, authorId: number, hidden: boolean): Promise<boolean> {
  const rows = await db(`update calls set hidden = $3 where id = $1 and author_id = $2 returning id`, [callId, authorId, hidden]);
  return rows.length > 0;
}

export const hideCall = (callId: number, authorId: number) => setHidden(callId, authorId, true);

/** Adds the author's reasoning to their call and to the chat's memory. */
export async function addReason(callId: number, authorId: number, text: string): Promise<CallRow | "not_yours"> {
  const [call] = await db<CallRow>(`select * from calls where id = $1`, [callId]);
  if (!call || String(call.author_id) !== String(authorId) || call.hidden) return "not_yours";
  const reason = text.trim().slice(0, 500);
  await db(`insert into call_reasons (call_id, text) values ($1, $2)`, [callId, reason]);
  await remember(call.chat_id, `[REASON #${call.id}] ${call.author_name} explained the call "${call.quote}" (${claim(call)}): ${reason}`).catch((err) =>
    console.error("memory write failed", err),
  );
  return call;
}

/** Reasons per call id, oldest first. */
export async function reasonsFor(callIds: number[]): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  if (!callIds.length) return out;
  const rows = await db<{ call_id: number; text: string }>(
    `select call_id, text from call_reasons where call_id = any($1::int[]) order by created_at`,
    [callIds],
  );
  for (const r of rows) out.set(r.call_id, [...(out.get(r.call_id) ?? []), r.text]);
  return out;
}

/** How long the author has to say an auto-logged message wasn't a call. */
export const UNDO_MINUTES = 15;

/** Voids an auto-logged call its author says wasn't one; it leaves the board and the bot's answers. */
export async function undoCall(callId: number, authorId: number): Promise<CallRow | "not_yours" | "too_late"> {
  const [call] = await db<CallRow>(`select * from calls where id = $1`, [callId]);
  if (!call || String(call.author_id) !== String(authorId)) return "not_yours";
  if (Date.now() - new Date(call.made_at).getTime() > UNDO_MINUTES * 60_000) return "too_late";
  await db(`update calls set status = 'void', hidden = true, result_note = 'not a call (undone by author)', resolved_at = now() where id = $1`, [callId]);
  return call;
}

/** Remembers a group's current title; cheap enough to call on every group update. */
export async function touchChat(chatId: number, title: string) {
  await db(
    `insert into chats (chat_id, title) values ($1, $2)
     on conflict (chat_id) do update set title = excluded.title, updated_at = now()
     where chats.title is distinct from excluded.title or chats.updated_at < now() - interval '1 hour'`,
    [chatId, title],
  );
}

export async function knownChats(): Promise<{ chat_id: string; title: string | null }[]> {
  // Groups with calls count too, in case they were active before the chats table existed.
  return db(
    `select chat_id, max(title) as title from (
       select chat_id, title, updated_at from chats
       union all select chat_id, chat_title, made_at from calls where chat_id < 0
     ) seen group by chat_id order by max(updated_at) desc limit 200`,
  );
}

export async function chatTitle(chatId: number | string): Promise<string | null> {
  const [row] = await db<{ title: string | null }>(`select title from chats where chat_id = $1`, [chatId]);
  return row?.title ?? null;
}

export type ChatMode = "ask" | "auto";

export async function chatMode(chatId: number | string): Promise<ChatMode> {
  const [row] = await db<{ mode: ChatMode }>(`select mode from chat_settings where chat_id = $1`, [chatId]);
  return row?.mode ?? "ask";
}

export async function setChatMode(chatId: number | string, mode: ChatMode) {
  await db(`insert into chat_settings (chat_id, mode) values ($1, $2) on conflict (chat_id) do update set mode = excluded.mode`, [chatId, mode]);
}
