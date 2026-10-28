import { config } from "./config";
import { db } from "./db";
import { complete, parseJson } from "./llm";
import { remember } from "./memory";
import { priceUsd } from "./tatum";

export type Market = "crypto" | "cs2";
export type Direction = "above" | "below" | "up" | "down" | "win";
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
  hidden: boolean;
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
}

const DAY = 86_400_000;

/* ---------- Spotting calls ---------- */

// \b only knows ASCII letters, so word edges are spelled out to work for Cyrillic too.
const word = (alts: string) => new RegExp(`(?<![\\p{L}\\d])(${alts})(?![\\p{L}])`, "iu");
const CS2_TEAMS = word(
  "navi|na'vi|нави|наві|faze|фейз|vitality|віталіті|spirit|спіріт|спирит|g2|mouz|falcons|liquid|astralis|heroic|furia|mongolz|eternal fire|virtus\\.?pro|vp|complexity|3dmax|pain|aurora|b8|monte|nip|big|gamerlegion|betboom|parivision|legacy|mibr|imperial|og",
);
const CRYPTO = word(
  "\\$[a-z]{2,8}|btc|eth|sol|sui|wal|xrp|doge|bnb|ton|ada|avax|link|pepe|hype|deep|cetus|біток|биток|біткоїн|биткоин|ефір|эфир|солана|суі",
);
const PREDICTION =
  /\d|\b(will|gonna|by|to|until|pump|dump|moon|long|short|win|wins|beat|beats|take|takes|crash|ath)\b|буд|пі[дй]д|впад|вирос|вигра|візьм|рознес|злет|пойд|упад|вырас|выигр|возьм|разнес|порв/iu;

/** Cheap filter so the model only sees messages that could plausibly be a call. */
export function mightBeCall(text: string): boolean {
  if (text.length < 6 || text.length > 300 || text.startsWith("/")) return false;
  return (CRYPTO.test(text) || CS2_TEAMS.test(text)) && PREDICTION.test(text);
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
 * into a structured draft. Returns null for chatter, jokes and questions.
 */
export async function extractCall(text: string): Promise<Draft | null> {
  const reply = await complete(
    [
      {
        role: "system",
        content: `You read messages from a Telegram group chat about crypto and Counter-Strike 2 and decide if a message is a CALL: a concrete, checkable prediction the author makes themselves.
A call is either:
- crypto: a coin's price going above/below a level, or up/down, by some time. Example: "SUI to $5 by Friday", "btc dumps under 90k this week", "sol up by tomorrow".
- cs2: a team winning a match. Example: "NaVi take FaZe tonight", "Spirit beats Vitality".
Not calls: questions, jokes, sarcasm, other people's predictions, vague moods ("sol looks good").

Now is ${nowInZone()} in ${config.timezone}.

Reply with JSON only:
{"is_call": boolean,
 "market": "crypto" | "cs2",
 "subject": ticker in caps for crypto (BTC, SUI, SOL...) or the team picked to WIN for cs2,
 "opponent": the other team for cs2, else null,
 "direction": "above" | "below" (crypto with a price level), "up" | "down" (crypto without a level), "win" (cs2),
 "target": price level in USD as a number, else null (expand "90k" to 90000),
 "deadline": ISO 8601 with offset for when the call is judged, or null if none was said}`,
      },
      { role: "user", content: text },
    ],
    { temperature: 0, maxTokens: 300, json: true },
  );

  const r = parseJson<{
    is_call?: boolean;
    market?: Market;
    subject?: string;
    opponent?: string | null;
    direction?: Direction;
    target?: number | null;
    deadline?: string | null;
  }>(reply);
  if (!r?.is_call || !r.subject || !r.market || !r.direction) return null;
  if (r.market !== "crypto" && r.market !== "cs2") return null;
  if (r.market === "cs2" && (!r.opponent || r.direction !== "win")) return null;
  if (r.market === "crypto" && !["above", "below", "up", "down"].includes(r.direction)) return null;
  if ((r.direction === "above" || r.direction === "below") && !(Number(r.target) > 0)) return null;

  // No deadline said: a CS2 match is usually within a day, a price call gets a week.
  let deadline = r.deadline ? new Date(r.deadline) : new Date(Date.now() + (r.market === "cs2" ? DAY : 7 * DAY));
  if (Number.isNaN(deadline.getTime())) deadline = new Date(Date.now() + 7 * DAY);
  if (deadline.getTime() < Date.now() + 5 * 60_000 || deadline.getTime() > Date.now() + 120 * DAY) return null;

  return {
    market: r.market,
    subject: r.market === "crypto" ? r.subject.replace(/^\$/, "").toUpperCase() : r.subject,
    opponent: r.market === "cs2" ? (r.opponent ?? null) : null,
    direction: r.direction,
    target: r.direction === "above" || r.direction === "below" ? Number(r.target) : null,
    deadline: deadline.toISOString(),
    quote: text.trim(),
  };
}

/* ---------- Describing calls ---------- */

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
  if (c.direction === "above" || c.direction === "below") return `${c.subject} ${c.direction} ${usd(c.target!)}`;
  return `${c.subject} ${c.direction}${c.entry_price ? ` from ${usd(c.entry_price)}` : ""}`;
}

/* ---------- Logging and resolving ---------- */

export interface Author {
  id: number;
  name: string;
}

export async function logCall(chat: { id: number; title?: string }, author: Author, draft: Draft): Promise<CallRow | { error: string }> {
  let entry: number | null = null;
  if (draft.market === "crypto") {
    entry = await priceUsd(draft.subject);
    if (entry === null) return { error: `Tatum has no price for ${draft.subject}, so I can't keep score on it.` };
    if (draft.direction === "above" && entry >= draft.target!) return { error: `${draft.subject} is already at ${usd(entry)}, above ${usd(draft.target!)}.` };
    if (draft.direction === "below" && entry <= draft.target!) return { error: `${draft.subject} is already at ${usd(entry)}, below ${usd(draft.target!)}.` };
  }

  const [call] = await db<CallRow>(
    `insert into calls (chat_id, chat_title, author_id, author_name, market, subject, opponent, direction, target, entry_price, quote, deadline)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning *`,
    [chat.id, chat.title ?? null, author.id, author.name, draft.market, draft.subject, draft.opponent, draft.direction, draft.target, entry, draft.quote, draft.deadline],
  );

  const priceNote = entry !== null ? ` ${call.subject} was ${usd(entry)} at the time (Tatum).` : "";
  const job = await remember(
    chat.id,
    `[CALL #${call.id}] ${when(call.made_at)}: ${author.name} called "${call.quote}". Logged as ${claim(call)} by ${when(call.deadline)}.${priceNote}`,
  ).catch((err) => {
    console.error("memory write failed", err);
    return null;
  });
  if (job) await db(`update calls set memory_job = $1 where id = $2`, [job, call.id]);
  return call;
}

export interface Resolution {
  call: CallRow;
  /** Set when a CS2 call needs the chat to confirm the score. */
  askScore?: boolean;
}

/**
 * Settles every open crypto call whose target was hit or whose deadline passed, and moves
 * CS2 calls past their deadline to "awaiting_score". Safe to run as often as you like.
 */
export async function resolveDue(): Promise<Resolution[]> {
  const open = await db<CallRow>(`select * from calls where status = 'open' order by deadline`);
  const out: Resolution[] = [];
  const prices = new Map<string, number | null>();
  const now = Date.now();

  for (const call of open) {
    const due = new Date(call.deadline).getTime() <= now;

    if (call.market === "cs2") {
      if (!due) continue;
      const [moved] = await db<CallRow>(`update calls set status = 'awaiting_score' where id = $1 and status = 'open' returning *`, [call.id]);
      if (moved) out.push({ call: moved, askScore: true });
      continue;
    }

    if (!prices.has(call.subject)) prices.set(call.subject, await priceUsd(call.subject));
    const price = prices.get(call.subject);
    if (price == null) continue;

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
    const settled = await settle(call, outcome, note, price);
    if (settled) out.push({ call: settled });
  }
  return out;
}

async function settle(call: CallRow, outcome: "win" | "loss", note: string, price: number | null): Promise<CallRow | null> {
  const [row] = await db<CallRow>(
    `update calls set status = $2, result_note = $3, final_price = $4, resolved_at = now()
     where id = $1 and status in ('open', 'awaiting_score') returning *`,
    [call.id, outcome, note, price],
  );
  if (!row) return null;
  await remember(
    row.chat_id,
    `[RESULT #${row.id}] ${row.author_name}'s call "${row.quote}" (${claim(row)}) was ${outcome === "win" ? "RIGHT" : "WRONG"}: ${note}.`,
  ).catch((err) => console.error("memory write failed", err));
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

/** Lets an author take a call off the board and out of the bot's answers. */
export async function hideCall(callId: number, authorId: number): Promise<boolean> {
  const rows = await db(`update calls set hidden = true where id = $1 and author_id = $2 returning id`, [callId, authorId]);
  return rows.length > 0;
}
