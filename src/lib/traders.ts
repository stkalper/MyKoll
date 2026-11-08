import { db } from "./db";
import { teamsOf, type MarketRef } from "./polymarket";
import { sourceId } from "./posts";

/**
 * Polymarket traders a chat follows. Someone shares a link to a trader's profile; from then on
 * every position of $500 or more the trader opens on a CS2, politics or crypto market is posted to
 * the chat and filed as the trader's call, judged by how the market resolves. So a trader builds a
 * track record in the chat's memory by kind of bet, the same way its members do by kind of call.
 * Everything is read from Polymarket's public APIs; no key needed.
 */

const DATA = "https://data-api.polymarket.com/v2";
const GAMMA = "https://gamma-api.polymarket.com";

/** A position worth posting: this much put on one outcome, in USDC, since the chat started following. */
export const MIN_STAKE = 500;
/** Fills smaller than this are left out of a position: market makers and bots trade dust all day. */
const MIN_FILL = 25;
/** Most traders one chat can follow, so the chat stays a chat. */
export const MAX_FOLLOWS = 5;
/** Most new bets posted for one trader in one sweep; the rest are filed and summed up in one line. */
export const MAX_POSTS = 3;
/**
 * A bet at 95¢ or more (or 5¢ or less) is parking money on a settled question, not a prediction,
 * and would flatter a record, so it isn't filed.
 */
const DECIDED = 0.95;
/** Crypto markets that settle within the hour ("Bitcoin Up or Down, 5 minutes") are noise, not calls. */
const MIN_CRYPTO_HORIZON = 3_600_000;

export type BetCategory = "cs2" | "politics" | "crypto";
export const CATEGORY_LABEL: Record<BetCategory, string> = { cs2: "CS2", politics: "politics", crypto: "crypto" };

export interface Trader {
  wallet: string;
  name: string;
  url: string;
}

export interface TraderStats {
  pnl?: number;
  volume?: number;
  markets?: number;
  biggestWin?: number;
  joined?: Date;
}

const get = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, { headers: { "User-Agent": "MyKollBot/1.0 (+https://mykoll.vercel.app)" }, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`Polymarket ${res.status} for ${url.replace(/\?.*/, "")}`);
  return (await res.json()) as T;
};

/* ---------- Profiles ---------- */

const PROFILE_LINK = /(?:https?:\/\/)?(?:www\.)?polymarket\.com\/(?:profile\/)?(@[\w.-]{1,40}|0x[0-9a-fA-F]{40})/i;

/** A link to a trader's profile in a message: polymarket.com/@name or polymarket.com/profile/0x…. */
export function profileLinkIn(text: string): { handle?: string; wallet?: string } | null {
  const m = text.match(PROFILE_LINK);
  if (!m) return null;
  // A sentence can end right after the link: "follow polymarket.com/@fred."
  return m[1].startsWith("@") ? { handle: m[1].slice(1).replace(/\.+$/, "") } : { wallet: m[1].toLowerCase() };
}

/** A profile with no name of its own shows its wallet; Polymarket gives it a generated pseudonym. */
const shownName = (p: { name?: string; pseudonym?: string }, wallet: string) =>
  p.name && !/^0x[0-9a-f]{40}(-\d+)?$/i.test(p.name) ? p.name : (p.pseudonym ?? `${wallet.slice(0, 6)}…${wallet.slice(-4)}`);

export const profileUrl = (wallet: string) => `https://polymarket.com/profile/${wallet}`;

/** The trader behind a profile link, found by wallet or by their name on Polymarket. */
export async function findTrader(link: { handle?: string; wallet?: string }): Promise<Trader | null> {
  let wallet = link.wallet;
  if (!wallet && link.handle) {
    const found = await get<{ profiles?: { name?: string; proxyWallet?: string }[] }>(
      `${GAMMA}/public-search?q=${encodeURIComponent(link.handle)}&search_profiles=true&limit_per_type=10`,
    );
    wallet = found.profiles?.find((p) => p.name?.toLowerCase() === link.handle!.toLowerCase())?.proxyWallet?.toLowerCase();
  }
  if (!wallet) return null;
  const profile = await get<{ name?: string; pseudonym?: string; proxyWallet?: string }>(`${GAMMA}/public-profile?address=${wallet}`).catch(() => null);
  if (!profile?.proxyWallet) return null;
  return { wallet, name: shownName(profile, wallet), url: profileUrl(wallet) };
}

/** What Polymarket itself says about a trader: all-time profit, volume, markets traded, biggest win. */
export async function traderStats(wallet: string): Promise<TraderStats> {
  const [stats, board] = await Promise.all([
    get<{ data?: { trades?: number; biggest_win?: number; join_date?: number | null; all_time_pnl?: { volume_usdc?: number } } | null }>(`${DATA}/user-stats?user=${wallet}`).catch(() => null),
    get<{ data?: { pnl?: number } | null }>(`${DATA}/leaderboard?user=${wallet}&time_period=ALL`).catch(() => null),
  ]);
  const s = stats?.data;
  return {
    pnl: board?.data?.pnl,
    volume: s?.all_time_pnl?.volume_usdc,
    markets: s?.trades,
    biggestWin: s?.biggest_win,
    joined: s?.join_date ? new Date(s.join_date * 1000) : undefined,
  };
}

/** The id a trader's calls are filed under in every chat: negative, like any outside account's. */
export const traderId = (wallet: string) => sourceId({ kind: "polymarket", handle: wallet });
export const traderName = (name: string) => `${name} on Polymarket`;

/* ---------- Following ---------- */

export interface Follow {
  chat_id: string;
  wallet: string;
  name: string;
  added_by_id: string;
  added_by_name: string;
  created_at: Date;
}

/** Starts following a trader in a chat, from now on. */
export async function follow(chatId: number, trader: Trader, by: { id: number; name: string }): Promise<"added" | "already" | "full"> {
  const [{ n }] = await db<{ n: number }>(`select count(*)::int as n from trader_follows where chat_id = $1`, [chatId]);
  const [existing] = await db(`select 1 from trader_follows where chat_id = $1 and wallet = $2`, [chatId, trader.wallet]);
  if (existing) return "already";
  if (n >= MAX_FOLLOWS) return "full";
  // A trader first followed now is read from now: what they did before isn't news to the chat.
  // Followed again after nobody did for a while, it's read from now too, not from where it was left.
  await db(
    `insert into traders (wallet, name, url, seen_until) values ($1, $2, $3, extract(epoch from now())::bigint)
     on conflict (wallet) do update set name = excluded.name,
       seen_until = case when exists (select 1 from trader_follows f where f.wallet = excluded.wallet) then traders.seen_until else excluded.seen_until end`,
    [trader.wallet, trader.name, trader.url],
  );
  await db(
    `insert into trader_follows (chat_id, wallet, added_by_id, added_by_name) values ($1, $2, $3, $4) on conflict do nothing`,
    [chatId, trader.wallet, by.id, by.name],
  );
  return "added";
}

/** Stops following; anyone who added a trader, or a chat admin, may. Returns whether anything was removed. */
export async function unfollow(chatId: number | string, wallet: string): Promise<boolean> {
  const rows = await db(`delete from trader_follows where chat_id = $1 and wallet = $2 returning wallet`, [chatId, wallet]);
  return rows.length > 0;
}

export async function follows(chatId: number | string): Promise<Follow[]> {
  return db<Follow>(
    `select f.chat_id, f.wallet, t.name, f.added_by_id, f.added_by_name, f.created_at
       from trader_follows f join traders t using (wallet) where f.chat_id = $1 order by f.created_at`,
    [chatId],
  );
}

export const anyFollows = async () => ((await db<{ n: number }>(`select count(*)::int as n from trader_follows`))[0]?.n ?? 0) > 0;

/* ---------- New bets ---------- */

interface Fill {
  condition_id: string;
  outcome: string;
  side: string;
  size: number;
  price: number;
  timestamp: number;
  title: string;
  slug: string;
  event_slug: string;
  transaction_hash: string;
}

/** What a market is, for deciding whether a bet on it is filed, and how. */
export interface MarketInfo {
  conditionId: string;
  question: string;
  eventId: string;
  eventSlug?: string;
  outcomes: string[];
  endDate: Date | null;
  /** When a match starts, for a sports market that says. */
  start: Date | null;
  closed: boolean;
  category: BetCategory | null;
  /** A CS2 match-winner market: its two teams. */
  teams?: [string, string];
}

interface GammaMarket {
  conditionId: string;
  question: string;
  outcomes?: string;
  endDate?: string;
  gameStartTime?: string;
  closed?: boolean;
  sportsMarketType?: string;
  tags?: { slug: string }[];
  events?: { id: string | number; slug?: string; tags?: { slug: string }[] }[];
}

/** Which of the kinds of market followed bets are filed for this one is, by Polymarket's own tags. */
export function categoryOf(tags: string[]): BetCategory | null {
  const has = (...slugs: string[]) => slugs.some((s) => tags.includes(s));
  if (has("counter-strike-2", "cs2", "counter-strike")) return "cs2";
  if (has("crypto", "crypto-prices", "bitcoin", "ethereum")) return "crypto";
  if (has("politics", "geopolitics", "elections", "us-politics", "world-elections")) return "politics";
  return null;
}

export function marketInfoOf(m: GammaMarket): MarketInfo {
  const tags = [...(m.tags ?? []), ...(m.events?.flatMap((e) => e.tags ?? []) ?? [])].map((t) => t.slug.toLowerCase());
  const outcomes = JSON.parse(m.outcomes ?? "[]") as string[];
  const category = categoryOf(tags);
  const teams = category === "cs2" && m.sportsMarketType === "moneyline" && outcomes.length === 2 && teamsOf(m.question) ? (outcomes as [string, string]) : undefined;
  return {
    conditionId: m.conditionId,
    question: m.question,
    eventId: String(m.events?.[0]?.id ?? ""),
    eventSlug: m.events?.[0]?.slug,
    outcomes,
    endDate: m.endDate ? new Date(m.endDate) : null,
    start: m.gameStartTime ? new Date(m.gameStartTime.replace(" ", "T").replace(/\+00$/, "Z")) : null,
    closed: Boolean(m.closed),
    category,
    teams,
  };
}

async function marketInfo(conditionId: string): Promise<MarketInfo | null> {
  // Closed markets only come back when asked for.
  const ask = (closed: boolean) => get<GammaMarket[]>(`${GAMMA}/markets?condition_ids=${conditionId}&include_tag=true&closed=${closed}`).catch(() => []);
  const [m] = [...(await ask(false)), ...(await ask(true))];
  return m ? marketInfoOf(m) : null;
}

/** A position the trader opened, summed over its fills since the chat started following. */
export interface Position {
  wallet: string;
  condition_id: string;
  outcome: string;
  cash: number;
  shares: number;
  first_at: number;
  title: string;
  slug: string;
  event_slug: string;
  tx: string;
}

/** Fills summed into positions, one per market and outcome. Only buys count: that's where a trader takes a side. */
export function positionsOf(wallet: string, fills: Fill[]): Position[] {
  const by = new Map<string, Position>();
  for (const f of fills) {
    if (f.side !== "BUY" || !(f.size > 0) || !(f.price > 0)) continue;
    const key = `${f.condition_id}:${f.outcome}`;
    const p = by.get(key) ?? { wallet, condition_id: f.condition_id, outcome: f.outcome, cash: 0, shares: 0, first_at: f.timestamp, title: f.title, slug: f.slug, event_slug: f.event_slug, tx: f.transaction_hash };
    p.cash += f.size * f.price;
    p.shares += f.size;
    if (f.timestamp < p.first_at) [p.first_at, p.tx] = [f.timestamp, f.transaction_hash];
    by.set(key, p);
  }
  return [...by.values()];
}

/** Why a position isn't filed as a bet, or null when it is one. */
export function notABet(p: Pick<Position, "cash" | "shares" | "first_at">, m: Pick<MarketInfo, "category" | "closed" | "endDate">): string | null {
  if (p.cash < MIN_STAKE) return "under the stake";
  if (!m.category) return "not a CS2, politics or crypto market";
  if (m.closed) return "market closed";
  const price = p.cash / p.shares;
  if (price >= DECIDED || price <= 1 - DECIDED) return "already decided";
  if (m.category === "crypto" && m.endDate && m.endDate.getTime() - p.first_at * 1000 < MIN_CRYPTO_HORIZON) return "settles within the hour";
  return null;
}

/** A bet ready to be filed in the chats that follow its trader. */
export interface NewBet {
  trader: Trader;
  position: Position;
  market: MarketInfo;
  ref: MarketRef;
}

/**
 * Reads every followed trader's fills since the last look, adds them to their positions, and
 * returns the positions that have just become bets worth posting. Each trader is read once,
 * however many chats follow them. A failed read is retried next sweep from the same point.
 */
export async function newBets(): Promise<NewBet[]> {
  const traders = await db<{ wallet: string; name: string; url: string }>(
    `select t.wallet, t.name, t.url from traders t where exists (select 1 from trader_follows f where f.wallet = t.wallet)`,
  );
  const out: NewBet[] = [];
  const markets = new Map<string, MarketInfo | null>();
  for (const t of traders) {
    // Two sweeps at once (a chat message and the queue) would add the same fills twice, so one reads a trader at a time.
    const [lease] = await db<{ seen_until: string }>(
      `update traders set reading_at = now() where wallet = $1 and (reading_at is null or reading_at < now() - interval '2 minutes') returning seen_until`,
      [t.wallet],
    );
    if (!lease) continue;
    const since = Number(lease.seen_until);
    try {
      const fills = await recentFills(t.wallet, since).catch((err) => {
        console.error("trader fills failed", t.wallet, err);
        return null;
      });
      if (!fills?.length) continue;
      const latest = Math.max(...fills.map((f) => f.timestamp));
      const grown: Position[] = [];
      for (const p of positionsOf(t.wallet, fills)) {
        const [row] = await db<Position & { posted: boolean }>(
          `insert into trader_positions (wallet, condition_id, outcome, cash, shares, first_at, title, slug, event_slug, tx)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           on conflict (wallet, condition_id, outcome) do update set cash = trader_positions.cash + excluded.cash, shares = trader_positions.shares + excluded.shares
           returning wallet, condition_id, outcome, cash, shares, first_at, title, slug, event_slug, tx, posted`,
          [p.wallet, p.condition_id, p.outcome, p.cash, p.shares, p.first_at, p.title, p.slug, p.event_slug, p.tx],
        );
        // Posted once, the moment the position crosses the stake.
        if (!row.posted && Number(row.cash) >= MIN_STAKE) grown.push({ ...row, cash: Number(row.cash), shares: Number(row.shares), first_at: Number(row.first_at) });
      }
      for (const p of grown) {
        if (!markets.has(p.condition_id)) markets.set(p.condition_id, await marketInfo(p.condition_id));
        const m = markets.get(p.condition_id);
        if (!m) continue;
        const why = notABet(p, m);
        // Only a position that can never become a bet is put aside; one under the stake may still grow.
        if (why && why !== "under the stake") {
          await db(`update trader_positions set posted = true, skipped = $4 where wallet = $1 and condition_id = $2 and outcome = $3`, [p.wallet, p.condition_id, p.outcome, why]);
          continue;
        }
        if (why) continue;
        const [taken] = await db(
          `update trader_positions set posted = true where wallet = $1 and condition_id = $2 and outcome = $3 and not posted returning wallet`,
          [p.wallet, p.condition_id, p.outcome],
        );
        if (!taken) continue;
        out.push({ trader: { wallet: t.wallet, name: t.name, url: t.url }, position: p, market: m, ref: refOf(p, m) });
      }
      await db(`update traders set seen_until = greatest(seen_until, $2) where wallet = $1`, [t.wallet, latest]);
    } finally {
      await db(`update traders set reading_at = null where wallet = $1`, [t.wallet]);
    }
  }
  return out;
}

/** A trader's fills after `since` (epoch seconds), oldest first, across as many pages as there are. */
async function recentFills(wallet: string, since: number): Promise<Fill[]> {
  const fills: Fill[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 5; page++) {
    const params = new URLSearchParams({ user: wallet, start: String(since + 1), filter_type: "CASH", filter_amount: String(MIN_FILL), limit: "500" });
    if (cursor) params.set("cursor", cursor);
    const res: { data?: Fill[]; pagination?: { next_cursor?: string | null } } = await get(`${DATA}/trades?${params}`);
    fills.push(...(res.data ?? []).filter((f) => f.timestamp > since));
    cursor = res.pagination?.next_cursor ?? null;
    if (!cursor) break;
  }
  return fills.sort((a, b) => a.timestamp - b.timestamp);
}

/** The market a bet is on, kept on its call the way a CS2 pick keeps its match. */
export function refOf(p: Position, m: MarketInfo): MarketRef {
  return {
    platform: "polymarket",
    eventId: m.eventId,
    marketId: m.conditionId,
    title: m.question,
    url: `https://polymarket.com/event/${m.eventSlug ?? p.event_slug ?? p.slug}`,
    outcome: p.outcome,
    prob: p.cash / p.shares,
    direct: true,
    category: m.category ?? undefined,
    stake: Math.round(p.cash),
    tx: p.tx,
  };
}
