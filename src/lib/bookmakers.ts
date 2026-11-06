import { config } from "./config";
import { teamKey } from "./polymarket";

/**
 * Bookmaker odds on a CS2 match, from OddsPapi, read once when a call is made so a receipt can show
 * what the bookmakers thought next to Polymarket. Pinnacle (the sharpest book) when it has a line,
 * otherwise the median of every book that does. The free tier is 250 requests a month and a call
 * costs two (the fixture list, cached, and the odds), so any failure just leaves the line out.
 */
export interface BookOdds {
  /** "Pinnacle", or "bookmakers" for the median of several. */
  book: string;
  /** The chance of the pick (the team winning, or that exact map score) with the bookmaker's margin taken out. */
  prob: number;
  /** How many books priced it. */
  books: number;
  fixtureId: string;
}

const API = "https://api.oddspapi.io/v4";
const CS2 = 17;
/** OddsPapi market ids for CS2: match winner, and the maps handicap at -1.5 and +1.5 for the first-listed team. */
const WINNER = "171";
const MINUS_15 = "1725";
const PLUS_15 = "1737";

interface Fixture {
  fixtureId: string;
  participant1Name: string;
  participant2Name: string;
  startTime: string;
  hasOdds: boolean;
}

interface Leg {
  players?: Record<string, { price?: number; active?: boolean }>;
}
interface BookMarkets {
  suspended?: boolean;
  markets?: Record<string, { marketActive?: boolean; outcomes?: Record<string, Leg> }>;
}
export type BookmakerOdds = Record<string, BookMarkets>;

/** No more requests until then, after a quota or auth error. */
let pausedUntil = 0;
let fixtures: { at: number; list: Fixture[] } | null = null;
/** Each fixture's odds for ten minutes: picks on both sides of a match, or a slate, cost one request. */
const oddsCache = new Map<string, { at: number; odds: BookmakerOdds }>();

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = `${API}${path}?${new URLSearchParams({ ...params, apiKey: config.oddspapi.apiKey })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (res.status === 401 || res.status === 403 || res.status === 429) {
    // Out of the month's requests, or the key is wrong: stop asking for a while.
    pausedUntil = Date.now() + (res.status === 429 ? 10 * 60_000 : 6 * 3_600_000);
    throw new Error(`OddsPapi ${res.status}`);
  }
  if (!res.ok) throw new Error(`OddsPapi ${res.status}`);
  return (await res.json()) as T;
}

const day = (t: number) => new Date(t).toISOString().slice(0, 10);

/** CS2 fixtures from yesterday to a week ahead, kept for half an hour. */
async function cs2Fixtures(): Promise<Fixture[]> {
  if (fixtures && Date.now() - fixtures.at < 30 * 60_000) return fixtures.list;
  const now = Date.now();
  const list = await get<Fixture[]>("/fixtures", { sportId: String(CS2), from: day(now - 86_400_000), to: day(now + 8 * 86_400_000) });
  fixtures = { at: now, list: Array.isArray(list) ? list : [] };
  return fixtures.list;
}

/** A two-way price pair as chances that add up to 1 (the bookmaker's margin taken out). */
function fair(a?: number, b?: number): number | null {
  if (!a || !b || a <= 1 || b <= 1) return null;
  return 1 / a / (1 / a + 1 / b);
}

function pair(m: BookMarkets, market: string): number | null {
  const mk = m.markets?.[market];
  if (!mk || mk.marketActive === false) return null;
  const legs = Object.entries(mk.outcomes ?? {}).sort(([x], [y]) => Number(x) - Number(y));
  if (legs.length !== 2) return null;
  const [a, b] = legs.map(([, leg]) => leg.players?.["0"]);
  if (a?.active === false || b?.active === false) return null;
  return fair(a?.price, b?.price);
}

/**
 * One book's chance for the pick. `first` says whether the picked team is the fixture's first
 * participant. A map score comes from the handicap: -1.5 for the first team is its 2:0, and +1.5
 * for it is everything but the other team's 2:0; 2:1 is the rest of the team's chance to win.
 */
export function bookChance(m: BookMarkets, first: boolean, score?: string | null): number | null {
  if (m.suspended) return null;
  const p1 = pair(m, WINNER);
  if (p1 === null) return null;
  const win = first ? p1 : 1 - p1;
  if (!score) return win;
  const sweep1 = pair(m, MINUS_15);
  const notSwept1 = pair(m, PLUS_15);
  if (sweep1 === null || notSwept1 === null) return null;
  const sweep = first ? sweep1 : 1 - notSwept1;
  // A line that doesn't add up (a sweep likelier than the win) is a stale or misread market.
  if (sweep <= 0 || sweep >= win) return null;
  const p = score === "2-0" ? sweep : win - sweep;
  return Math.min(0.99, Math.max(0.01, p));
}

/** Pinnacle when it prices the pick, otherwise the median of every book that does. */
export function consensus(odds: BookmakerOdds, first: boolean, score?: string | null): Omit<BookOdds, "fixtureId"> | null {
  const chances = Object.entries(odds)
    // Skip the demo book and the "+" variants (other feeds of the same book).
    .filter(([slug]) => slug !== "demo" && !slug.includes("+"))
    .map(([slug, m]) => [slug, bookChance(m, first, score)] as const)
    .filter((e): e is readonly [string, number] => e[1] !== null);
  if (!chances.length) return null;
  const pinnacle = chances.find(([slug]) => slug === "pinnacle");
  if (pinnacle) return { book: "Pinnacle", prob: pinnacle[1], books: chances.length };
  const sorted = chances.map(([, p]) => p).sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { book: "bookmakers", prob: median, books: chances.length };
}

/** The bookmakers' chance for a CS2 pick, or null when there's no key, no fixture or no line. */
export async function bookOdds(team: string, opponent: string, at: Date, score?: string | null): Promise<BookOdds | null> {
  if (!config.oddspapi.apiKey || Date.now() < pausedUntil) return null;
  const [us, them] = [teamKey(team), teamKey(opponent)];
  const fixture = (await cs2Fixtures())
    .filter((f) => f.hasOdds)
    .filter((f) => {
      const keys = [teamKey(f.participant1Name), teamKey(f.participant2Name)];
      return keys.includes(us) && keys.includes(them);
    })
    // The same pair can meet twice in a week; take the meeting nearest the Polymarket match.
    .sort((a, b) => Math.abs(Date.parse(a.startTime) - at.getTime()) - Math.abs(Date.parse(b.startTime) - at.getTime()))[0];
  if (!fixture || Math.abs(Date.parse(fixture.startTime) - at.getTime()) > 36 * 3_600_000) return null;
  let cached = oddsCache.get(fixture.fixtureId);
  if (!cached || Date.now() - cached.at > 10 * 60_000) {
    const res = await get<{ bookmakerOdds?: BookmakerOdds }>("/odds", { fixtureId: fixture.fixtureId });
    cached = { at: Date.now(), odds: res.bookmakerOdds ?? {} };
    oddsCache.set(fixture.fixtureId, cached);
  }
  const found = consensus(cached.odds, teamKey(fixture.participant1Name) === us, score);
  return found ? { ...found, fixtureId: fixture.fixtureId } : null;
}

/** "Pinnacle 68%", or "bookmakers 66% (median of 140)". */
export const bookLine = (b: Pick<BookOdds, "book" | "prob" | "books">) =>
  `${b.book} ${Math.round(b.prob * 100)}%${b.book === "Pinnacle" ? "" : ` (median of ${b.books})`}`;
