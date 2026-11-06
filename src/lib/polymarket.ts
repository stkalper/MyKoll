import { config } from "./config";
import { isOutOfCredits, tatumOr, tatumOut } from "./fallback";

/**
 * CS2 matches on Polymarket, through Tatum's Prediction Market API. A CS2 call is matched to
 * the Polymarket match-winner market for the same two teams, so the receipt can show what the
 * market thought of the pick, and the call settles from the market's resolution (Polymarket
 * resolves CS2 from HLTV) instead of waiting for someone in the chat to confirm the score.
 */

const API = "https://api.tatum.io/v4/data/prediction";

/** The market a CS2 call was matched to, kept on the call. */
export interface MarketRef {
  platform: "polymarket";
  eventId: string;
  marketId: string;
  title: string;
  url: string;
  /** The picked team as Polymarket names it, and its price (implied chance) when the call was made. */
  outcome: string;
  prob: number;
  /** Set when this was read straight from Polymarket, because Tatum was out of credits. */
  direct?: boolean;
  /**
   * Map-score picks: the score picked ("2-0" or "2-1", the picked team's maps first), the chance
   * of the team winning at all, and the "Games Total: O/U 2.5" market that says how many maps were
   * played. `prob` is then the chance of that exact score.
   */
  score?: string;
  winProb?: number;
  mapsMarketId?: string;
  /** Set when the match was found after the call was made (the pick waited for Polymarket to list it), so its odds are from then. */
  late?: boolean;
}

/** The pick as a receipt names it: "FURIA", or "FURIA 2:0" for a map-score pick. */
export const pickName = (ref: Pick<MarketRef, "outcome" | "score">) => (ref.score ? `${ref.outcome} ${ref.score.replace("-", ":")}` : ref.outcome);

interface Outcome {
  name: string;
  price: number;
}

interface Market {
  id: string;
  eventId: string;
  question: string;
  status: string;
  outcomes: Outcome[];
  resolution?: { outcome?: string | null } | null;
  source?: { url?: string };
}

interface Event {
  id: string;
  title: string;
  description?: string;
  status: string;
  closeTime: string;
  source?: { url?: string };
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/**
 * When a match starts. Polymarket's closeTime is a few hours after the market went up, not the
 * match time, and CS2 markets keep trading while the match is played, so the start comes from the
 * description: "initially scheduled for October 30, 2026 at 5:15 PM ET".
 */
export function startOf(e: Pick<Event, "description" | "closeTime">): Date {
  const m = e.description?.match(/scheduled for (\w+) (\d{1,2}), (\d{4}) at (\d{1,2}):(\d{2}) ([AP]M) ET/i);
  const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  if (!m || month < 0) return new Date(e.closeTime);
  const hour = (Number(m[4]) % 12) + (m[6].toUpperCase() === "PM" ? 12 : 0);
  return fromNewYork(Number(m[3]), month, Number(m[2]), hour, Number(m[5]));
}

/** A wall-clock time in New York (EST or EDT, whichever applied that day) as an instant. */
function fromNewYork(year: number, month: number, day: number, hour: number, minute: number): Date {
  const guess = Date.UTC(year, month, day, hour + 5, minute);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "longOffset" })
    .formatToParts(new Date(guess))
    .find((p) => p.type === "timeZoneName")?.value;
  const hours = Number(offset?.match(/GMT([+-]\d{2})/)?.[1] ?? -5);
  return new Date(Date.UTC(year, month, day, hour - hours, minute));
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { "x-api-key": config.tatum.apiKey }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`prediction API ${res.status} for ${path}`);
  return (await res.json()) as T;
}

/* Polymarket's own API, for when Tatum is out of credits. Its ids are the ones Tatum passes on. */

const GAMMA = "https://gamma-api.polymarket.com";
/** Polymarket's tag for Counter-Strike 2. */
const CS2_TAG = 100780;

interface GammaMarket {
  conditionId: string;
  question: string;
  outcomes?: string;
  outcomePrices?: string;
  closed?: boolean;
  umaResolutionStatus?: string | null;
  slug?: string;
}

interface GammaEvent {
  id: string | number;
  title: string;
  description?: string;
  closed?: boolean;
  endDate?: string;
  slug?: string;
  markets?: GammaMarket[];
}

async function gamma<T>(path: string): Promise<T> {
  const res = await fetch(`${GAMMA}${path}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Polymarket API ${res.status} for ${path}`);
  return (await res.json()) as T;
}

const eventUrl = (slug?: string) => (slug ? `https://polymarket.com/event/${slug}` : undefined);

const fromGammaEvent = (e: GammaEvent): Event => ({
  id: String(e.id),
  title: e.title,
  description: e.description,
  status: e.closed ? "closed" : "active",
  closeTime: e.endDate ?? "",
  source: { url: eventUrl(e.slug) },
});

/** Outcomes and prices come as JSON strings; a closed market's winner is the side priced at 1. */
export function fromGammaMarket(m: GammaMarket, eventId: string, slug?: string): Market {
  const names = JSON.parse(m.outcomes ?? "[]") as string[];
  const prices = (JSON.parse(m.outcomePrices ?? "[]") as string[]).map(Number);
  const outcomes = names.map((name, i) => ({ name, price: prices[i] ?? 0 }));
  const resolved = Boolean(m.closed) && m.umaResolutionStatus === "resolved";
  return {
    id: m.conditionId,
    eventId,
    question: m.question,
    status: resolved ? "resolved" : m.closed ? "closed" : "active",
    outcomes,
    // A 50/50 resolution is a cancelled or unplayed match: no side won.
    resolution: resolved ? { outcome: outcomes.find((o) => o.price > 0.5)?.name ?? null } : null,
    source: { url: eventUrl(slug ?? m.slug) },
  };
}

/** The latest CS2 events first, which is where this week's matches are; older ones never get played. */
async function gammaListing(): Promise<Event[]> {
  const pages = await Promise.all(
    [0, 100, 200].map((offset) => gamma<GammaEvent[]>(`/events?active=true&closed=false&tag_id=${CS2_TAG}&order=endDate&ascending=false&limit=100&offset=${offset}`)),
  );
  return pages.flat().map(fromGammaEvent).filter((e) => teamsOf(e.title));
}

/**
 * A team name reduced to what identifies it: "Team Vitality", "VITALITY" and "Vitality.Bet"
 * all become "vitality". "NAVI Junior" stays "navijunior", so it never passes for NaVi.
 */
export function teamKey(name: string): string {
  const k = name
    .toLowerCase()
    .replace(/['’.\s-]/g, "")
    .replace(/^team/, "")
    .replace(/(esports|gaming|clan|bet|team)$/, "");
  return ALIASES[k] ?? k;
}

const ALIASES: Record<string, string> = {
  natusvincere: "navi",
  нави: "navi",
  наві: "navi",
  virtuspro: "vp",
  mousesports: "mouz",
  фейз: "faze",
  віталіті: "vitality",
  спіріт: "spirit",
  спирит: "spirit",
  фнатік: "fnatic",
  фнатик: "fnatic",
  themongolz: "mongolz",
  монголз: "mongolz",
  мауз: "mouz",
  фуріа: "furia",
  фурия: "furia",
  астраліс: "astralis",
  астралис: "astralis",
  c9: "cloud9",
  bb: "betboom",
  бб: "betboom",
  бетбум: "betboom",
  фут: "fut",
};

/** Each aliased team as calls name it (Polymarket's spelling), for searching memory. */
const FULL_NAMES: Record<string, string> = {
  navi: "Natus Vincere",
  vp: "Virtus.pro",
  mouz: "MOUZ",
  faze: "FaZe",
  vitality: "Vitality",
  spirit: "Spirit",
  fnatic: "Fnatic",
  mongolz: "The MongolZ",
  furia: "FURIA",
  astralis: "Astralis",
  cloud9: "Cloud9",
  fut: "FUT Esports",
  betboom: "BetBoom Team",
};

/**
 * A question with the full name of each team it calls by a nickname: "who called bb" →
 * "who called bb (BetBoom Team)". Memory is searched by meaning, and "bb" on its own reads
 * closer to BNB than to BetBoom.
 */
export function spellTeams(text: string): string {
  const names = new Set<string>();
  for (const w of text.split(/[\s,;:!?()"«»/+]+/)) {
    const team = ALIASES[w.toLowerCase().replace(/['’.-]/g, "")];
    if (team && FULL_NAMES[team]) names.add(FULL_NAMES[team]);
  }
  return names.size ? `${text} (${[...names].join(", ")})` : text;
}

/** Both teams of a Polymarket CS2 event, from its title: "Counter-Strike: MOUZ vs FURIA (BO3) - …". */
export function teamsOf(title: string): [string, string] | null {
  const m = title.match(/^Counter-Strike:\s*(.+?)\s+vs\.?\s+(.+?)\s*\(BO\d\)/i);
  return m ? [m[1], m[2]] : null;
}

const ACTIVE_ESPORTS = "/events?platform=polymarket&status=active&category=Esports";

/**
 * Every open CS2 event. Polymarket lists matches days ahead, among hundreds of other esports
 * events, so the whole listing is read (~6 pages), not just the newest. It takes a few seconds,
 * so after the first load the last listing is served while a fresh one loads behind it.
 */
let upcoming: { at: number; value: Promise<Event[]> } | undefined;

function upcomingEvents(): Promise<Event[]> {
  if (upcoming && Date.now() - upcoming.at < 10 * 60_000) return upcoming.value;
  const value = tatumOr(async () => {
    const out: Event[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const r = await get<{ data: Event[]; pagination?: { cursor?: string } }>(
        `${ACTIVE_ESPORTS}&sort=newest&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      );
      out.push(...r.data.filter((e) => teamsOf(e.title)));
      cursor = r.pagination?.cursor;
      if (!cursor || !r.data.length) break;
    }
    return out;
  }, gammaListing);
  const last = upcoming?.value;
  upcoming = { at: Date.now(), value };
  value.catch(() => (upcoming = undefined));
  return last ?? value;
}

/**
 * Open CS2 events for one team. The newest-first listing above misses matches that were put up
 * long before they're played, so a team's own matches are also searched by name.
 */
async function teamEvents(team: string): Promise<Event[]> {
  const [listed, found] = await Promise.all([upcomingEvents(), searchTeam(team)]);
  const open = found.filter((e) => e.status === "active");
  const ids = new Set(listed.map((e) => e.id));
  return [...listed, ...open.filter((e) => !ids.has(e.id))];
}

/** A team's CS2 events by name, open and closed alike; briefly cached, since one message can ask twice. */
const searched = new Map<string, { at: number; value: Promise<Event[]> }>();

function searchTeam(team: string): Promise<Event[]> {
  const key = teamKey(team);
  const hit = searched.get(key);
  if (hit && Date.now() - hit.at < 2 * 60_000) return hit.value;
  // Search returns ten results, ranked loosely and mostly closed, so it's asked two ways; open events
  // come from the listing's own search, which matches the name as written ("mongolz" finds "TheMongolz").
  const orNothing = (err: unknown): Event[] => {
    if (isOutOfCredits(err)) throw err;
    return [];
  };
  const ask = (q: string) =>
    get<{ data?: { events?: Event[] } }>(`/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.data?.events ?? [])
      .catch(orNothing);
  const open = () =>
    get<{ data: Event[] }>(`${ACTIVE_ESPORTS}&limit=50&search=${encodeURIComponent(key)}`)
      .then((r) => r.data)
      .catch(orNothing);
  const value = tatumOr(
    () => Promise.all([ask(`Counter-Strike: ${team}`), ask(team), open()]),
    () =>
      gamma<{ events?: GammaEvent[] }>(`/public-search?q=${encodeURIComponent(team)}&limit_per_type=20&keep_closed_markets=1`)
        .then((r) => [(r.events ?? []).map(fromGammaEvent)])
        .catch(() => [[] as Event[]]),
  ).then((all) => {
    const byId = new Map(all.flat().map((e) => [e.id, e]));
    return [...byId.values()].filter((e) => teamsOf(e.title)?.some((t) => teamKey(t) === key));
  });
  searched.set(key, { at: Date.now(), value });
  return value;
}

/**
 * The name Polymarket gives a CS2 team if it has ever listed a match of theirs ("fokus" → "FOKUS",
 * "og" → "OG"), and null for a word that isn't a team. Lets a list of picks name smaller teams the
 * bot has no alias for.
 */
export async function knownTeam(word: string): Promise<string | null> {
  const key = teamKey(word);
  if (key.length < 2) return null;
  const event = (await searchTeam(word).catch(() => [] as Event[]))[0];
  return event ? sides(event, key)[0] : null;
}

/** The two teams of an event, the given team first. */
function sides(e: Event, key: string): [string, string] {
  const teams = teamsOf(e.title)!;
  return teamKey(teams[0]) === key ? teams : [teams[1], teams[0]];
}

/**
 * A match of this team (against this opponent, if named) that is being played right now: past
 * its start and not yet resolved. A pick on the team now is a pick on this match.
 */
export async function startedMatch(team: string, opponent?: string | null): Promise<{ team: string; opponent: string; at: Date } | null> {
  const key = teamKey(team);
  const now = Date.now();
  const found = (await Promise.all([teamEvents(team), searchTeam(team), opponent ? searchTeam(opponent) : []])).flat();
  const recent = [...new Map(found.map((e) => [e.id, e])).values()]
    .filter((e) => {
      const start = startOf(e).getTime();
      const teams = teamsOf(e.title)!.map(teamKey);
      return start <= now && start > now - 8 * 3_600_000 && teams.includes(key) && (!opponent || teams.includes(teamKey(opponent)));
    })
    // The latest start first: the one being played, not an earlier one waiting to be resolved.
    .sort((a, b) => startOf(b).getTime() - startOf(a).getTime());
  for (const e of recent) {
    const market = await matchWinner(e.id).catch(() => null);
    if (!market || winnerOf(market)) continue;
    const [ours, theirs] = sides(e, key);
    return { team: ours, opponent: theirs, at: startOf(e) };
  }
  return null;
}

/** Orders matches for a call that names a time: those starting in the day before it first, then the nearest, then the soonest. */
const byTime = (by?: Date) => (a: Event, b: Event) => {
  const miss = (e: Event) => {
    if (!by) return 0;
    const t = startOf(e).getTime();
    return t <= by.getTime() && t > by.getTime() - 86_400_000 ? 0 : Math.abs(t - by.getTime());
  };
  return miss(a) - miss(b) || startOf(a).getTime() - startOf(b).getTime();
};

/** Not started yet, and within the week. */
const ahead = (e: Event) => {
  const start = startOf(e).getTime();
  return start > Date.now() && start < Date.now() + 7 * 86_400_000;
};

let knownTeams: Set<string> | undefined;

/**
 * Every team with a CS2 match listed on Polymarket, as team keys, so the call filter knows teams
 * beyond its own list ("easy for bcgame"). Only the first call on an instance waits for the
 * listing; after that it answers from the last one and refreshes behind it.
 */
export async function listedTeams(): Promise<Set<string>> {
  const load = upcomingEvents().then((events) => (knownTeams = new Set(events.flatMap((e) => teamsOf(e.title)!.map(teamKey)))));
  if (knownTeams) {
    load.catch(() => {});
    return knownTeams;
  }
  return load.catch(() => new Set<string>());
}

/** How many upcoming CS2 matches Polymarket lists (for the health check). */
export const upcomingCs2Matches = async () => (await upcomingEvents()).filter(ahead).length;

/**
 * A team's next match on Polymarket that hasn't started (against this opponent, if named), so a
 * call lands on when the match is played ("изи для НАВІ завтра"): on the day the author named
 * ("завтра" is 23:59 tomorrow), else the soonest this week. Names are spelled the way Polymarket
 * spells them.
 */
export async function nextMatch(team: string, by?: Date, opponent?: string | null): Promise<{ team: string; opponent: string; at: Date } | null> {
  const key = teamKey(team);
  const game = (await teamEvents(team))
    .filter((e) => {
      const teams = teamsOf(e.title)!.map(teamKey);
      return ahead(e) && teams.includes(key) && (!opponent || teams.includes(teamKey(opponent)));
    })
    .sort(byTime(by))[0];
  if (!game) return null;
  const [ours, theirs] = sides(game, key);
  return { team: ours, opponent: theirs, at: startOf(game) };
}

/** Every market of an event: the match winner, each map, the handicap, the totals. */
function eventMarkets(eventId: string): Promise<Market[]> {
  return tatumOr(
    async () => (await get<{ data: Market[] }>(`/markets?platform=polymarket&eventId=${encodeURIComponent(eventId)}&limit=50`)).data,
    async () => {
      const e = await gamma<GammaEvent>(`/events/${encodeURIComponent(eventId)}`);
      return (e.markets ?? []).map((m) => fromGammaMarket(m, eventId, e.slug));
    },
  );
}

type Priced = Pick<Market, "id" | "question" | "outcomes">;

/** The match-winner market among an event's markets (not a map, handicap or totals market). */
const winnerMarket = <M extends Priced>(markets: M[]): M | null => markets.find((m) => teamsOf(m.question) && m.outcomes.length === 2) ?? null;

/** The match-winner market of an event. */
async function matchWinner(eventId: string): Promise<Market | null> {
  return winnerMarket(await eventMarkets(eventId));
}

const clamp = (p: number) => Math.min(0.99, Math.max(0.01, p));

/**
 * The chance of a best-of-three ending in this score for this team, from the markets Polymarket
 * runs beside the match winner: "Map Handicap: X (-1.5) vs Y (+1.5)" is X winning 2:0, and
 * "Games Total: O/U 2.5" is whether a third map is played. Without the handicap, the third map is
 * taken to be as likely whoever wins. Null when there's no totals market to settle the score by.
 */
export function scoreOdds(markets: Priced[], team: string, score: string): { prob: number; winProb: number; mapsMarketId: string } | null {
  const winner = winnerMarket(markets);
  const maps = markets.find((m) => /games total:?\s*o\/u\s*2\.5/i.test(m.question));
  const win = winner?.outcomes.find((o) => teamKey(o.name) === teamKey(team));
  const over = maps?.outcomes.find((o) => /^over$/i.test(o.name));
  if (!winner || !maps || !win || !over) return null;
  const pWin = Number(win.price);
  const pOver = Number(over.price);
  const handicap = markets.find((m) => /map handicap/i.test(m.question) && m.outcomes.length === 2);
  // The handicap names the side giving -1.5 maps by a short tag ("INF"); its outcome is that team's 2:0.
  const minus = handicap?.question.match(/handicap:\s*(.+?)\s*\(-1\.5\)/i)?.[1];
  // Its outcomes come in the question's order, so a tag that matches neither name ("MGZ") is the first.
  const sweeper = minus ? (handicap!.outcomes.find((o) => teamKey(o.name).startsWith(teamKey(minus))) ?? handicap!.outcomes[0]) : undefined;
  let twoOne: number;
  if (sweeper) {
    const sweep = Number(sweeper.price);
    // Ours gives the maps: our 2:1 is our win less our 2:0. Theirs: our 2:1 is the third map less theirs.
    twoOne = teamKey(sweeper.name) === teamKey(team) ? pWin - sweep : pOver - (1 - pWin - sweep);
  } else {
    twoOne = pWin * pOver;
  }
  const prob = score === "2-0" ? pWin - twoOne : twoOne;
  return { prob: clamp(prob), winProb: pWin, mapsMarketId: maps.id };
}

/** How a best-of-three went by its totals market, once decided: "2-0" if two maps were played, "2-1" if three. */
export async function mapsPlayed(mapsMarketId: string): Promise<"2-0" | "2-1" | null> {
  const result = await marketWinner(mapsMarketId);
  if (!result) return null;
  return /^over$/i.test(result.name) ? "2-1" : /^under$/i.test(result.name) ? "2-0" : null;
}

/**
 * The Polymarket market for a CS2 call: the same two teams, in a match being played now or coming
 * this week and not yet resolved, the one before the call's deadline first. The price is the
 * market's at that moment, live if the match is on. Null when Polymarket has no such match.
 */
export async function findMatch(team: string, opponent: string, deadline: Date, score?: string | null): Promise<MarketRef | null> {
  const want = [teamKey(team), teamKey(opponent)].sort().join("|");
  const now = Date.now();
  const [listed, ours, theirs] = await Promise.all([teamEvents(team), searchTeam(team), searchTeam(opponent)]);
  const events = [...new Map([...listed, ...ours, ...theirs].map((e) => [e.id, e])).values()]
    .filter((e) => {
      const start = startOf(e).getTime();
      return start > now - 8 * 3_600_000 && start < now + 7 * 86_400_000 && teamsOf(e.title)!.map(teamKey).sort().join("|") === want;
    })
    .sort(byTime(deadline));

  for (const event of events) {
    const markets = await eventMarkets(event.id);
    const market = winnerMarket(markets);
    const pick = market?.outcomes.find((o) => teamKey(o.name) === teamKey(team));
    if (!market || !pick || market.status === "resolved" || market.resolution?.outcome) continue;
    // A map score only means something in a best-of-three with a totals market to settle it by.
    const odds = score && /\(BO3\)/i.test(event.title) ? scoreOdds(markets, team, score) : null;
    return {
      platform: "polymarket",
      eventId: event.id,
      marketId: market.id,
      title: market.question,
      url: market.source?.url ?? event.source?.url ?? "https://polymarket.com",
      outcome: pick.name,
      prob: odds ? odds.prob : pick.price,
      ...(odds ? { score: score!, winProb: pick.price, mapsMarketId: odds.mapsMarketId } : {}),
      ...(tatumOut() ? { direct: true } : {}),
    };
  }
  return null;
}

/** The price at which a match is over in all but name. */
const DECIDED = 0.995;

/**
 * Who won a market, if anyone yet. Polymarket's official resolution can come hours after the match,
 * while the price says it the moment the match ends (99.95% for the winner), so the price counts too.
 */
export function winnerOf(m: Pick<Market, "status" | "resolution" | "outcomes">): { name: string; price?: number } | null {
  if (m.status === "resolved" && m.resolution?.outcome) return { name: m.resolution.outcome };
  const ahead = m.outcomes?.find((o) => Number(o.price) >= DECIDED);
  return ahead ? { name: ahead.name, price: Number(ahead.price) } : null;
}

export async function marketWinner(marketId: string): Promise<{ name: string; price?: number } | null> {
  const market = await tatumOr(
    async () => {
      const r = await get<{ data?: Market } & Partial<Market>>(`/markets/${encodeURIComponent(marketId)}`);
      return (r.data ?? r) as Market;
    },
    async () => {
      // Closed markets only come back when asked for.
      const ask = (closed: boolean) => gamma<GammaMarket[]>(`/markets?condition_ids=${encodeURIComponent(marketId)}&closed=${closed}`);
      const [m] = [...(await ask(false)), ...(await ask(true))];
      if (!m) throw new Error(`no Polymarket market ${marketId}`);
      return fromGammaMarket(m, "");
    },
  );
  return winnerOf(market);
}
