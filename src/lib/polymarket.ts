import { config } from "./config";

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
}

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

/**
 * A team name reduced to what identifies it: "Team Vitality", "VITALITY" and "Vitality.Bet"
 * all become "vitality". "NAVI Junior" stays "navijunior", so it never passes for NaVi.
 */
export function teamKey(name: string): string {
  const k = name
    .toLowerCase()
    .replace(/['’.\s-]/g, "")
    .replace(/^team/, "")
    .replace(/(esports|gaming|clan|bet)$/, "");
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
};

/** Both teams of a Polymarket CS2 event, from its title: "Counter-Strike: MOUZ vs FURIA (BO3) - …". */
export function teamsOf(title: string): [string, string] | null {
  const m = title.match(/^Counter-Strike:\s*(.+?)\s+vs\.?\s+(.+?)\s*\(BO\d\)/i);
  return m ? [m[1], m[2]] : null;
}

/** Upcoming CS2 events, newest first; a few pages, cached briefly since every CS2 call looks here. */
let upcoming: { at: number; value: Promise<Event[]> } | undefined;

function upcomingEvents(): Promise<Event[]> {
  if (upcoming && Date.now() - upcoming.at < 10 * 60_000) return upcoming.value;
  const value = (async () => {
    const out: Event[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 3; page++) {
      const r = await get<{ data: Event[]; pagination?: { cursor?: string } }>(
        `/events?platform=polymarket&status=active&category=Esports&sort=newest&limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      );
      out.push(...r.data.filter((e) => teamsOf(e.title)));
      cursor = r.pagination?.cursor;
      if (!cursor || !r.data.length) break;
    }
    return out;
  })();
  upcoming = { at: Date.now(), value };
  value.catch(() => (upcoming = undefined));
  return value;
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
  // Search returns ten results, ranked loosely, so it's asked two ways and the answers merged.
  const ask = (q: string) =>
    get<{ data?: { events?: Event[] } }>(`/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.data?.events ?? [])
      .catch(() => [] as Event[]);
  const value = Promise.all([ask(`Counter-Strike: ${team}`), ask(team)]).then(([a, b]) => {
    const byId = new Map([...a, ...b].map((e) => [e.id, e]));
    return [...byId.values()].filter((e) => teamsOf(e.title)?.some((t) => teamKey(t) === key));
  });
  searched.set(key, { at: Date.now(), value });
  return value;
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
  const found = (await Promise.all([searchTeam(team), opponent ? searchTeam(opponent) : []])).flat();
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
    if (!market || market.status === "resolved" || market.resolution?.outcome) continue;
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
 * A team's next match on Polymarket that hasn't started, for a call that names only the team
 * ("изи для НАВІ завтра"): on the day the author named ("завтра" is 23:59 tomorrow), else the
 * soonest this week. Names are spelled the way Polymarket spells them.
 */
export async function nextMatch(team: string, by?: Date): Promise<{ team: string; opponent: string; at: Date } | null> {
  const key = teamKey(team);
  const game = (await teamEvents(team))
    .filter((e) => ahead(e) && teamsOf(e.title)!.some((t) => teamKey(t) === key))
    .sort(byTime(by))[0];
  if (!game) return null;
  const [ours, theirs] = sides(game, key);
  return { team: ours, opponent: theirs, at: startOf(game) };
}

/** The match-winner market of an event (not a map, handicap or totals market). */
async function matchWinner(eventId: string): Promise<Market | null> {
  const r = await get<{ data: Market[] }>(`/markets?platform=polymarket&eventId=${encodeURIComponent(eventId)}&limit=50`);
  return r.data.find((m) => teamsOf(m.question) && m.outcomes.length === 2) ?? null;
}

/**
 * The Polymarket market for a CS2 call: the same two teams, in a match being played now or coming
 * this week and not yet resolved, the one before the call's deadline first. The price is the
 * market's at that moment, live if the match is on. Null when Polymarket has no such match.
 */
export async function findMatch(team: string, opponent: string, deadline: Date): Promise<MarketRef | null> {
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
    const market = await matchWinner(event.id);
    const pick = market?.outcomes.find((o) => teamKey(o.name) === teamKey(team));
    if (!market || !pick || market.status === "resolved" || market.resolution?.outcome) continue;
    return {
      platform: "polymarket",
      eventId: event.id,
      marketId: market.id,
      title: market.question,
      url: market.source?.url ?? event.source?.url ?? "https://polymarket.com",
      outcome: pick.name,
      prob: pick.price,
    };
  }
  return null;
}

/** Who won, once Polymarket has resolved the market; null while it's still open. */
export async function marketWinner(marketId: string): Promise<string | null> {
  const r = await get<{ data?: Market } & Partial<Market>>(`/markets/${encodeURIComponent(marketId)}`);
  const m = (r.data ?? r) as Market;
  return m.status === "resolved" && m.resolution?.outcome ? m.resolution.outcome : null;
}
