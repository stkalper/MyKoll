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
  status: string;
  closeTime: string;
  source?: { url?: string };
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
  const [listed, found] = await Promise.all([
    upcomingEvents(),
    get<{ data?: { events?: Event[] } }>(`/search?q=${encodeURIComponent(`Counter-Strike: ${team}`)}`)
      .then((r) => (r.data?.events ?? []).filter((e) => e.status === "active" && teamsOf(e.title)))
      .catch(() => [] as Event[]),
  ]);
  const ids = new Set(listed.map((e) => e.id));
  return [...listed, ...found.filter((e) => !ids.has(e.id))];
}

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
export const upcomingCs2Matches = async () => (await upcomingEvents()).filter((e) => new Date(e.closeTime).getTime() > Date.now()).length;

/**
 * A team's next match on Polymarket, for a call that names only the team ("изи для НАВІ завтра"):
 * the first one in the day before the time the author named ("завтра" is 23:59 tomorrow), else
 * the one nearest it, else the soonest one this week. Names are spelled the way Polymarket spells them.
 */
export async function nextMatch(team: string, by?: Date): Promise<{ team: string; opponent: string; at: Date } | null> {
  const key = teamKey(team);
  const now = Date.now();
  const miss = (at: Date) => {
    if (!by) return 0;
    const t = at.getTime();
    return t <= by.getTime() && t > by.getTime() - 86_400_000 ? 0 : Math.abs(t - by.getTime());
  };
  const games = (await teamEvents(team))
    .map((e) => ({ teams: teamsOf(e.title)!, at: new Date(e.closeTime) }))
    .filter((g) => g.teams.some((t) => teamKey(t) === key) && g.at.getTime() > now - 3 * 3_600_000 && g.at.getTime() < now + 7 * 86_400_000)
    .sort((a, b) => miss(a.at) - miss(b.at) || a.at.getTime() - b.at.getTime());
  const game = games[0];
  if (!game) return null;
  const [ours, theirs] = teamKey(game.teams[0]) === key ? game.teams : [game.teams[1], game.teams[0]];
  return { team: ours, opponent: theirs, at: game.at };
}

/** The match-winner market of an event (not a map, handicap or totals market). */
async function matchWinner(eventId: string): Promise<Market | null> {
  const r = await get<{ data: Market[] }>(`/markets?platform=polymarket&eventId=${encodeURIComponent(eventId)}&limit=50`);
  return r.data.find((m) => teamsOf(m.question) && m.outcomes.length === 2) ?? null;
}

/**
 * The Polymarket market for a CS2 call: the same two teams, playing between a few hours ago
 * and a week from now, nearest to the call's deadline. Null when Polymarket has no such match.
 */
export async function findMatch(team: string, opponent: string, deadline: Date): Promise<MarketRef | null> {
  const want = [teamKey(team), teamKey(opponent)].sort().join("|");
  const now = Date.now();
  const candidates = (await teamEvents(team))
    .filter((e) => {
      const teams = teamsOf(e.title)!;
      const close = new Date(e.closeTime).getTime();
      return teams.map(teamKey).sort().join("|") === want && close > now - 6 * 3_600_000 && close < now + 7 * 86_400_000;
    })
    .sort((a, b) => Math.abs(new Date(a.closeTime).getTime() - deadline.getTime()) - Math.abs(new Date(b.closeTime).getTime() - deadline.getTime()));
  const event = candidates[0];
  if (!event) return null;

  const market = await matchWinner(event.id);
  const pick = market?.outcomes.find((o) => teamKey(o.name) === teamKey(team));
  if (!market || !pick) return null;
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

/** Who won, once Polymarket has resolved the market; null while it's still open. */
export async function marketWinner(marketId: string): Promise<string | null> {
  const r = await get<{ data?: Market } & Partial<Market>>(`/markets/${encodeURIComponent(marketId)}`);
  const m = (r.data ?? r) as Market;
  return m.status === "resolved" && m.resolution?.outcome ? m.resolution.outcome : null;
}
