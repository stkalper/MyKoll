import { randomBytes } from "node:crypto";
import { inBackground } from "./background";
import { config } from "./config";
import { db } from "./db";
import { complete, parseJson } from "./llm";
import { learnFrom, trackRecords } from "./learning";
import { remember } from "./memory";
import { firstCheck, nextSweep, wakeAt } from "./schedule";
import { findMatch, listedTeams, marketWinner, nextMatch, startedMatch, teamKey, type MarketRef } from "./polymarket";
import { sourceId, sourceName, type PostSource } from "./posts";
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
  slate_id: string | null;
  /** Set when the call came from a post on X or Telegram that someone shared; the author is the post's. */
  source: PostSource | null;
  shared_by_id: string | null;
}

/** Several CS2 picks in one message ("NaVi, Vitality, FURIA"), each on its team's next match. */
export interface Slate {
  picks: Draft[];
  /** Picks the bot couldn't place, and why. */
  skipped: string[];
  quote: string;
  why?: string | null;
  source?: PostSource;
}

/** A call the bot can't keep score on, and why; `speak` when it's worth saying even in a passive read. */
export interface Unplaced {
  reason: string;
  /** The same in a few words, for a list of picks. */
  short?: string;
  speak?: boolean;
}

/** Most picks one message can hold. */
const MAX_PICKS = 12;

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
  /** The post the call came from, when it was shared from X or Telegram. */
  source?: PostSource;
  /** A target given relative to the price ("+30%", "2x"), turned into a level when the call is logged. */
  targetPct?: number | null;
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
  "navi|na'vi|natus vincere|нави|наві|faze|фейз|vitality|віталіті|виталити|spirit|спіріт|спирит|g2|mouz|мауз|falcons|liquid|astralis|астраліс|астралис|heroic|furia|фурі\\p{L}*|фури\\p{L}*|(?:the\\s?)?mongolz|монголз|eternal fire|virtus\\.?pro|vp|complexity|3dmax|pain|aurora|b8|monte|nip|big|gamerlegion|betboom|parivision|legacy|mibr|imperial|og|fnatic|фнатік\\p{L}*|фнатик\\p{L}*|cloud9|c9|ence|passion ua|tyloo|lynn vision|wildcard|fluxo|nemiga|немиг\\p{L}*|saw|m80|gentle mates|nrg|sashi|bestia",
);
const CRYPTO = word(
  "\\$[a-z]{2,10}|#[a-z]{2,10}|[a-z]{2,10}/?usdt|navx|haedal|ika|hippo|lofi|scallop|btc|bitcoin|eth|ether\\p{L}*|sol|solana|sui|wal|walrus|xrp|doge|bnb|ton|ada|avax|link|pepe|hype|deep|cetus|trx|tron|трон\\p{L}*|трх|ltc|bch|atom|algo|xlm|matic|vet|cro|chz|tsla|tesla|тесл\\p{L}*|nvda|nvidia|нвід\\p{L}*|aapl|msft|amzn|googl|pons|понс|cashcat|бітк\\p{L}*|битк\\p{L}*|біток|биток|бтк|бтс|бтц|ефір\\p{L}*|етер\\p{L}*|эфир\\p{L}*|сол\\p{L}*|суі|суи",
);
const CS2_TEAMS_ALL = new RegExp(CS2_TEAMS.source, "giu");
/** Any ticker written in caps, e.g. "APT" or "WAL". */
const TICKER = /(?<![\p{L}\d])[A-Z]{2,6}(?![\p{L}])/u;
const PREDICTION =
  /\d|\b(will|gonna|by|to|until|pump|dump|moon|long|short|win|wins|beat|beats|take|takes|crash|ath|tp|sl|entry|target|signal|over|under|above|below|tomorrow|tmrw|tonight|next week|hours?|hrs?|mins?|dollars?|bucks?|cents?|vs|easy|ez|fav|favou?rite|underdog|bet|betting|backing|picks?|locks?|stomps?|smash(es)?|clears?|expect\w*|explod\w*|drop|rally|bounce|breakout|bullish|bearish|targets?|tp\d|buy zone|accumulat\w*|invalidation|eow|eom|eoy|pt|ml|moneyline|incoming|send(ing)?)\b|\+\s?(на|1)|плюс на|изи|ізі|ставл|ставк|проти|против|перемож|перемог|победи|фаворит|андердог|буд|вищ|вище|нижч|завтра|годин|хвилин|бакс|долар|цент|пі[дй]д|впад|вирос|вигра|візьм|рознес|злет|пойд|упад|вырас|выигр|возьм|разнес|порв|лонг|шорт|тейк|стоп|вхід|вход|ціль|цель|сигнал|памп|дамп|зрост|рост|пада/iu;

/** Cheap filter so the model only sees messages that could plausibly be a call. */
export function mightBeCall(text: string): boolean {
  if (text.length < 4 || text.length > MAX_MESSAGE || text.startsWith("/")) return false;
  // A bare list of teams is a set of picks: "наві, віталіті, мауз, фуріа".
  if ((text.match(CS2_TEAMS_ALL) ?? []).length >= 2) return true;
  return (CRYPTO.test(text) || TICKER.test(text) || CS2_TEAMS.test(text)) && PREDICTION.test(text);
}

/**
 * Listed teams named in a message, team key to the words used: one to three words at a time,
 * e.g. "BC.Game", "Lynn Vision".
 */
export function teamsNamed(text: string, teams: Set<string>): Map<string, string> {
  const words = text.split(/[\s,;:!?()"«»/+]+/).filter(Boolean);
  const found = new Map<string, string>();
  for (let i = 0; i < words.length; i++)
    for (let n = 1; n <= 3 && i + n <= words.length; n++) {
      const phrase = words.slice(i, i + n).join(" ");
      const key = teamKey(phrase);
      // Short keys ("og", "big") are too easily ordinary words; the fixed list covers those teams.
      if (key.length >= 4 && teams.has(key) && !found.has(key)) found.set(key, phrase);
    }
  return found;
}

/** Every CS2 team a message names, as written, from the fixed list and Polymarket's current matches. */
async function teamWords(text: string): Promise<Map<string, string>> {
  const named = teamsNamed(text, await listedTeams().catch(() => new Set<string>()));
  for (const m of text.match(CS2_TEAMS_ALL) ?? []) if (!named.has(teamKey(m))) named.set(teamKey(m), m);
  return named;
}

/**
 * The filter with teams on Polymarket's current CS2 matches added to its own list, so a pick on a
 * smaller team ("easy for bcgame") isn't dropped before the model sees it.
 */
export async function mightBeCallNow(text: string): Promise<boolean> {
  if (mightBeCall(text)) return true;
  if (text.length < 4 || text.length > MAX_MESSAGE || text.startsWith("/")) return false;
  const named = await teamWords(text);
  return named.size >= 2 || (named.size >= 1 && PREDICTION.test(text));
}

/** "Tuesday 28 October 2026 at 14:05 (GMT+02:00)" in the chat's zone, so the model can resolve "by Friday". */
function nowInZone(now = new Date()): string {
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: config.timezone, timeZoneName: "longOffset" })
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName")?.value;
  return `${now.toLocaleString("en-GB", { timeZone: config.timezone, dateStyle: "full", timeStyle: "short" })} (${offset})`;
}

/* The prompt is built from the parts a message needs: the free tier counts input tokens per
   minute, so a plain chat message doesn't pay for the rules on signal posts and CS2 picks. */

const CRYPTO_RULES = `- crypto: a coin's price going above/below a level, or up/down, by some time. Example: "SUI to $5 by Friday", "btc dumps under 90k this week", "sol up by tomorrow".
  A coin with a price and a time is a call even without a side: "BTC 102k tomorrow" / "БТС 102к завтра" means BTC gets to 102000 by tomorrow.
  A trading signal is a call too: "TRX long, entry 0.33, TP 0.36, SL 0.31" / "лонг TRX, тейк 0.36" means TRX above the first take-profit (short: below it).
  This also covers stock tokens on Robinhood Chain (TSLA, NVDA, AAPL, SPY, MSFT, AMZN, GOOGL, META, COIN) and its memecoins (PONS, CASHCAT): "tesla to 450 by Friday" is subject TSLA.`;

const SIGNAL_RULES = `  Signal posts from X and Telegram channels are calls in these shapes too:
  - structured: "COIN: $LINK/USDT · Direction: LONG · Entry: 10.2-10.5 · Targets: 11.0 / 11.8 / 12.5 · SL: 9.8 · Leverage: 5x" means LINK above the FIRST target (SHORT: below it);
  - a direction with no level: "Expecting to see a drop from here", "$ASTER is going to explode", "bottom is in" (up/down from now);
  - a relative target: "+30% from here", "2x incoming", "200% potential", "SOL halves" (use target_pct, not target);
  - a range of targets ("pushes toward 78,100 to 80,700"): the nearer level counts;
  - pairs and tags name the coin: $CHZUSDT, BTCUSDT, SOL/USDT, ETH-PERP, #BTC, $TIA all mean the coin before the quote currency.
  Not calls, however confident they sound:
  - results and bragging about earlier calls: "Target 3: HIT ✅ (+64% gain)", "23.8% profit (5x)", "PERFECTLY predicted the retest", "+1,000% this month", "as we called";
  - scenarios on both sides: "hold 76,500 and this pushes to 80,700, lose it and it drops to 75,000";
  - pure conditionals with no commitment: "if it breaks 82k, 87k is next", "a close above 82,150 opens the door to 87.5k" (but "longing here, invalidation below 76k, target 87k" is a call);
  - market commentary, ads, total market cap or dominance (no single coin to price).`;

const CS2_RULES = `- cs2: a team winning its match. Example: "NaVi take FaZe tonight", "Spirit beats Vitality".
  Any CS2 team counts, big or small (fnatic, Eternal Fire, Nemiga, BC.Game...).
  A bare "X beat Y" / "X beats Y" is a call on their coming match, not a past result: chats talk about matches ahead, so "Fnatic beat Eternal Fire" and "Spirit beat Vitality, easy" are calls. Only skip it when the message clearly talks about a match already played ("yesterday", "did you see", "gg wp").
  A team name with a word of confidence is a call on that team, even in two words, in any language: "фнатік ізі", "ez fnatic", "easy for X", "изи для X", "+ на X", "+1 X", "X фаворит", "X is the fav", "X lock", "my pick X", "backing X", "ставлю на X проти Y", "betting on X vs Y", "X vs Y, X" (all of these pick X), "X stomps Y".
  A predicted score is a call on the team with more maps: "FaZe 2-0 G2" picks FaZe, "2:1 G2 vs FaZe" picks G2.
  The opponent may go unnamed ("изи для НАВІ завтра", "NaVi easy tomorrow"): then opponent is null.
  Tipster formats pick the team named: "Pick: NaVi ML @1.85 (2u)", "Vitality -1.5 maps @2.10", "Bet: FURIA to win". Odds, units and stakes don't matter. Totals and props ("over 26.5 rounds", "first blood") can't be checked: not calls.
  Several teams picked at once are a set of picks, one per team: a bare list ("наві, віталіті, мауз, фуріа", "NaVi Vitality MOUZ FURIA tomorrow"), "my picks: X, Y, Z", or several "X over Y" in one message. Put every pick in "picks".`;

/** Words that mark a channel-style signal post, where the signal rules earn their tokens. */
const SIGNAL_HINTS = /\b(tp\d?|sl|entry|targets?|leverage|long|short|usdt|perp|invalidation|expect\w*|explod\w*|incoming|\d+x|hit|profit|gains?|potential|halves|[1-9]\d?[mhdw])\b|✅|%|лонг|шорт|тейк|стоп|ціл/i;

function callPrompt(text: string, teams: string[], posted?: Date): string {
  const cs2 = teams.length > 0;
  const crypto = !cs2 || CRYPTO.test(text) || TICKER.test(text);
  const signals = crypto && (Boolean(posted) || SIGNAL_HINTS.test(text));
  const when = posted
    ? `This was posted on ${nowInZone(posted)} in ${config.timezone}; read every time in it from that moment. Now is ${nowInZone()}.`
    : `Now is ${nowInZone()} in ${config.timezone}.`;
  return `You read messages from a Telegram group chat about crypto and Counter-Strike 2 and decide if a message is a CALL: a concrete, checkable prediction the author makes themselves.
A call is either:
${[crypto && CRYPTO_RULES, signals && SIGNAL_RULES, cs2 && CS2_RULES].filter(Boolean).join("\n")}
Not calls: questions, jokes, sarcasm, other people's predictions, vague moods ("sol looks good").

${when}${cs2 ? `\nThese words in the message are CS2 team names: ${teams.map((t) => `"${t}"`).join(", ")}.` : ""}

Reply with JSON only:
{"is_call": boolean,
 "market": "crypto" | "cs2",
 "subject": ticker in caps for crypto (BTC, SUI, SOL, TSLA...) or the team picked to WIN for cs2 (team names in their usual English spelling: "наві" is NaVi, "фурію" is FURIA),
 "opponent": the other team for cs2 if the message names it, else null,${cs2 ? `
 "picks": for a set of cs2 picks, every pick in order as {"team": the team picked to win, "opponent": the team it plays if named, else null}; else null,` : ""}
 "direction": "above" | "below" (crypto with a price level and a side: above, over, to, pump, вище, до, памп...), "to" (a price level with no side said, e.g. "BTC 102k tomorrow"), "up" | "down" (crypto without a level), "win" (cs2),
 "target": price level in USD as a number, else null (expand "90k" / "90к" to 90000; "1 бакс" / "a buck" / "a dollar" is 1, "50 cents" is 0.5),${signals ? `
 "target_pct": for a target given relative to the price now, the move in percent ("+30%" = 30, "2x" = 100, "3x" = 200, "-20%" = -20, "halves" = -50), else null,
 "timeframe": the chart timeframe the call is made on if it names one and gives no time ("15m", "1h", "4h", "1d", "1w"), else null,` : ""}
 "in_minutes": minutes from now until the call is judged if the message says it relatively ("in 5 minutes", "in 2 hours", "через 5 годин" = 300, "через пів години" = 30, "within a day"), else null,
 "deadline": ISO 8601 with offset for when the call is judged if the message names a time or day, else null. "by Friday" / "до неділі" means the END of that day (23:59 local); "tonight" means 23:59 today; "tomorrow" / "завтра" means 23:59 tomorrow; EOW / EOM / EOY / "by Q4" mean the end of that week, month, year or quarter,
 "call_text": the part of the message that states the call itself, copied word for word (e.g. "TRX long, entry 0.33, TP 0.36"), else null,
 "why": the author's reasons for the call if the message gives any (charts, news, levels, "because ..."), copied or lightly trimmed in the author's own words and language, else null}`;
}

/**
 * Asks the model whether a message is a checkable prediction and, if so, turns it
 * into a structured draft. Returns null for chatter, jokes and questions, and a reason
 * when it is a call the bot can't keep score on.
 */
export async function extractCall(text: string, posted?: Date): Promise<Draft | Slate | Unplaced | null> {
  const teams = [...(await teamWords(text)).values()];
  const reply = await complete(
    [
      { role: "system", content: callPrompt(text, teams, posted) },
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
    target_pct?: number | null;
    timeframe?: string | null;
    in_minutes?: number | null;
    deadline?: string | null;
    call_text?: string | null;
    why?: string | null;
    picks?: Array<{ team?: string; opponent?: string | null }> | null;
  }>(reply);
  if (!r?.is_call) return null;

  // Relative times are counted here, not by the model.
  const minutes = Number(r.in_minutes);
  const told = minutes > 0 ? new Date((posted ?? new Date()).getTime() + minutes * 60_000) : r.deadline ? new Date(r.deadline) : null;
  const said = told && !Number.isNaN(told.getTime()) ? told : null;
  const quoted = quoteOf(text, r.call_text);
  const why = r.why?.trim().slice(0, 500) || null;

  const picks = (r.picks ?? []).filter((p) => p.team?.trim());
  if (picks.length >= 2) return slateOf(picks, said, quoted, why);

  if (!r.subject || !r.market || !r.direction) return null;
  if (r.market !== "crypto" && r.market !== "cs2") return null;
  if (r.market === "cs2" && r.direction !== "win") return null;
  if (r.market === "crypto" && !["above", "below", "up", "down", "to"].includes(r.direction)) return null;
  // A relative target ("+30%", "2x") becomes a level once the price is known, when it's logged.
  const pct = Number(r.target_pct);
  const relative = r.market === "crypto" && !(Number(r.target) > 0) && Number.isFinite(pct) && pct !== 0 && pct > -100;
  if (hasLevel(r.direction) && !(Number(r.target) > 0) && !relative) return null;

  if (r.market === "cs2") {
    const placed = await placePick(r.subject, r.opponent, said);
    if ("reason" in placed) return placed;
    return { market: "cs2", ...placed, direction: "win", target: null, quote: quoted, why };
  }

  // No time said: the chart's timeframe sets the horizon, else a price call gets a week. Counted
  // from the post when the call came from one, so an old post's call can be past its deadline.
  const horizon = HORIZON[r.timeframe?.toLowerCase() ?? ""] ?? 7 * DAY;
  const deadline = said ?? new Date((posted ?? new Date()).getTime() + horizon);
  const late = tooLate(deadline);
  if (late) return late;
  return {
    market: r.market,
    subject: tickerOf(r.subject),
    opponent: null,
    direction: relative ? (pct > 0 ? "above" : "below") : r.direction,
    target: hasLevel(r.direction) && !relative ? Number(r.target) : null,
    targetPct: relative ? pct : null,
    deadline: deadline.toISOString(),
    quote: quoted,
    why,
  };
}

/** How long a call made on a chart timeframe runs, when it names no time. */
const HORIZON: Record<string, number> = {
  "15m": 4 * 3_600_000,
  "30m": 8 * 3_600_000,
  "1h": DAY,
  "4h": 3 * DAY,
  "1d": 14 * DAY,
  "1w": 60 * DAY,
};

/** "$CHZUSDT", "SOL/USDT", "ETH-PERP", "#btc" → the coin itself. */
export function tickerOf(raw: string): string {
  const t = raw.trim().replace(/^[$#]/, "").toUpperCase();
  const base = t.replace(/[/-]?(USDT|USDC|USD|BUSD|PERP)$/, "").replace(/[/-]$/, "");
  return base.length >= 2 ? base : t;
}

function tooLate(deadline: Date): Unplaced | null {
  if (deadline.getTime() < Date.now() + 60_000) return { reason: `That deadline (${when(deadline)}) is already here, so there's nothing left to judge.`, short: "its deadline has passed" };
  if (deadline.getTime() > Date.now() + 120 * DAY) return { reason: "I only keep score on calls that settle within 120 days." };
  return null;
}

/**
 * Where a CS2 pick lands: a pick with no opponent is on the team's next match as Polymarket lists
 * it, judged a few hours after it starts. With an opponent and no time said, a match is usually
 * within a day.
 */
async function placePick(
  team: string,
  rival: string | null | undefined,
  said: Date | null,
): Promise<{ subject: string; opponent: string; deadline: string } | Unplaced> {
  let subject = team.trim();
  let opponent = rival?.trim() || null;
  let deadline = said ?? new Date(Date.now() + DAY);
  const lookup = <T,>(p: Promise<T | null>) =>
    p.catch((err) => {
      console.error("Polymarket lookup failed", err);
      return null;
    });

  // A match being played right now is the one the author means, unless they named a later day.
  // Polymarket trades CS2 live, so the receipt shows the odds at the moment of the call.
  const [live, next] = await Promise.all([lookup(startedMatch(subject, opponent)), opponent ? null : lookup(nextMatch(subject, said ?? undefined))]);
  const match = live && (!said || live.at.getTime() > said.getTime() - DAY) ? live : next;
  if (match) {
    ({ team: subject, opponent } = match);
    // Judged once the match is over: a few hours after it starts, and at least an hour from now.
    const over = Math.max(match.at.getTime() + 4 * 3_600_000, Date.now() + 3_600_000);
    if (!said || deadline.getTime() < over) deadline = new Date(over);
  } else if (!opponent) {
    return { reason: `I can't find a match ${subject} plays this week. Name the opponent, e.g. "${subject} beat FaZe".`, short: `no match found for ${subject}`, speak: true };
  }
  return tooLate(deadline) ?? { subject, opponent, deadline: deadline.toISOString() };
}

/**
 * A set of CS2 picks from one message. Each lands on its team's match; picks the bot can't place,
 * repeats, and two picks on the same match (both sides can't win) are left out and listed.
 */
async function slateOf(
  raw: Array<{ team?: string; opponent?: string | null }>,
  said: Date | null,
  quote: string,
  why: string | null,
): Promise<Slate | Draft | Unplaced> {
  const placed = await Promise.all(raw.slice(0, MAX_PICKS).map((p) => placePick(p.team!, p.opponent, said)));
  const skipped: string[] = [];
  const picks: Draft[] = [];
  placed.forEach((p, i) => {
    if ("reason" in p) skipped.push(p.short ?? `${raw[i].team}: ${p.reason}`);
    else picks.push({ market: "cs2", ...p, direction: "win", target: null, quote, why });
  });
  if (raw.length > MAX_PICKS) skipped.push(`only the first ${MAX_PICKS} picks count`);

  const matchOf = (d: Draft) => [teamKey(d.subject), teamKey(d.opponent!)].sort().join("|");
  const seen = new Map<string, Draft[]>();
  for (const d of picks) seen.set(matchOf(d), [...(seen.get(matchOf(d)) ?? []), d]);
  const kept: Draft[] = [];
  for (const same of seen.values()) {
    const sides = new Set(same.map((d) => teamKey(d.subject)));
    if (sides.size > 1) skipped.push(`${same[0].subject} and ${same[0].opponent} play each other, so pick one`);
    else kept.push(same[0]);
  }

  if (!kept.length) return { reason: `I couldn't place any of those picks (${skipped.join("; ")}).`, speak: true };
  if (kept.length === 1 && !skipped.length) return kept[0];
  return { picks: kept, skipped, quote, why };
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
export function claim(
  c: Pick<CallRow, "market" | "subject" | "opponent" | "direction" | "target" | "entry_price"> & { targetPct?: number | null },
): string {
  if (c.market === "cs2") return `${c.subject} to beat ${c.opponent}`;
  if (hasLevel(c.direction) && c.target === null && c.targetPct) return `${c.subject} ${c.targetPct > 0 ? "up" : "down"} ${Math.abs(c.targetPct)}%`;
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

/** Who a call belongs to: the post's author when it was shared from one, else whoever said it. */
export const ownerOf = (said: Author, d: Pick<Draft, "source">): Author => (d.source ? { id: sourceId(d.source), name: sourceName(d.source) } : said);

export async function logCall(chat: { id: number; title?: string }, sharer: Author, draft: Draft, slateId: string | null = null): Promise<CallRow | { error: string }> {
  const author = ownerOf(sharer, draft);
  let q: Quote | null = null;
  if (draft.market === "crypto") {
    q = await quote(draft.subject);
    if (!q) return { error: `Tatum has no price for ${draft.subject}, so I can't keep score on it.` };
    if (draft.targetPct) draft = { ...draft, target: Number((q.price * (1 + draft.targetPct / 100)).toPrecision(6)) };
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
    `insert into calls (chat_id, chat_title, author_id, author_name, market, subject, opponent, direction, target, entry_price, price_source, entry_proof, entry_check, market_ref, quote, deadline, slate_id, source, shared_by_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) returning *`,
    [
      chat.id, chat.title ?? null, author.id, author.name, draft.market, draft.subject, draft.opponent, draft.direction, draft.target,
      q?.price ?? null, q?.source ?? null, q?.proof ? JSON.stringify(q.proof) : null, q?.check ?? null, market ? JSON.stringify(market) : null,
      draft.quote, draft.deadline, slateId, draft.source ? JSON.stringify(draft.source) : null, draft.source ? sharer.id : null,
    ],
  );

  // The deadline wake-up and the memory write don't depend on each other.
  const scheduled = Promise.all([wakeAt(call.id, firstCheck(call)), nextSweep()]);
  // Reasons given in the same message are filed like a /why, so the receipt shows them.
  if (draft.why) await db(`insert into call_reasons (call_id, text) values ($1, $2)`, [call.id, draft.why]);

  const fromPost = draft.source
    ? ` It was posted ${when(draft.source.postedAt)} (${draft.source.url}) and shared in the chat by ${draft.source.sharedBy.name}.`
    : "";
  const priceNote = q
    ? ` ${call.subject} was ${usd(q.price)} ${draft.source ? "when it was shared" : "at the time"} (${sourcing(q)}).`
    : market
      ? ` Polymarket had ${market.outcome} at ${Math.round(market.prob * 100)}% to win (Tatum Prediction Market API, market ${market.marketId}).`
      : "";
  // The receipt doesn't need the memory write, so it goes out first and the write follows.
  inBackground(async () => {
    const record = (await trackRecords(chat.id).catch(() => new Map())).get(String(author.id));
    const recordNote = record ? ` Their record at the time: ${record.summary}` : "";
    const job = await remember(
      chat.id,
      `[CALL #${call.id}] ${when(call.made_at)}: ${author.name} called "${call.quote}". Logged as ${claim(call)} by ${when(call.deadline)}.${fromPost}${priceNote}${recordNote}`,
    );
    if (job) await db(`update calls set memory_job = $1 where id = $2`, [job, call.id]);
    if (draft.why) await remember(chat.id, `[REASON #${call.id}] ${author.name} explained the call "${call.quote}" (${claim(call)}): ${draft.why}`);
  });
  await scheduled;
  return call;
}

/** Logs every pick of a slate as its own call, tied together so they're reported together. */
export async function logSlate(
  chat: { id: number; title?: string },
  sharer: Author,
  slate: Slate,
): Promise<{ calls: CallRow[]; errors: string[] }> {
  const id = randomBytes(6).toString("hex");
  const author = ownerOf(sharer, slate);
  await db(`insert into slates (id, chat_id, author_id, author_name, quote) values ($1, $2, $3, $4, $5)`, [id, chat.id, author.id, author.name, slate.quote]);
  // One at a time: each call schedules its own wake-up and memory write.
  const calls: CallRow[] = [];
  const errors: string[] = [];
  for (const pick of slate.picks) {
    const call = await logCall(chat, sharer, slate.source ? { ...pick, source: slate.source } : pick, id);
    if ("error" in call) errors.push(`${pick.subject}: ${call.error}`);
    else calls.push(call);
  }
  return { calls, errors };
}

export interface SlateResult {
  author_name: string;
  quote: string;
  calls: CallRow[];
}

/**
 * The whole slate once its last match is settled, or null while any is still running. Only the
 * first caller gets it, so the summary goes out once however many sweeps race to settle it.
 */
export async function finishedSlate(slateId: string): Promise<SlateResult | null> {
  const calls = await db<CallRow>(`select * from calls where slate_id = $1 order by id`, [slateId]);
  if (!calls.length || calls.some((c) => c.status === "open" || c.status === "awaiting_score")) return null;
  const [slate] = await db<{ author_name: string; quote: string }>(
    `update slates set announced_at = now() where id = $1 and announced_at is null returning author_name, quote`,
    [slateId],
  );
  return slate ? { ...slate, calls } : null;
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
  // A call shared from a post belongs to an outside account, so the member who shared it manages it.
  const rows = await db(`update calls set hidden = $3 where id = $1 and (author_id = $2 or shared_by_id = $2) returning id`, [callId, authorId, hidden]);
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
  if (!call || (String(call.author_id) !== String(authorId) && String(call.shared_by_id) !== String(authorId))) return "not_yours";
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
