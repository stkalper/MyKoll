/**
 * Hyperliquid's public API: mid prices for every coin it trades (perps and spot), with no key and
 * no credits. It prices coins Binance has no USDT pair for (HYPE, FARTCOIN, PURR, new launches),
 * and its coin list lets the cheap filter spot a call on one written in lower case ("fartcoin 0.2").
 */
const API = "https://api.hyperliquid.xyz/info";

/** Plain coin names: "BTC", "kPEPE", "PURR/USDC". Others are spot ids ("@107") and outcome markets ("#1234"). */
const NAMED = /^[A-Za-z0-9]+(\/USDC)?$/;

let mids: { at: number; prices: Map<string, number>; names: string[] } | null = null;

/** Every named coin's mid price, upper-cased ("KPEPE", "PURR/USDC"), kept for 15 seconds. */
async function allMids(): Promise<Map<string, number>> {
  return (await load()).prices;
}

async function load(): Promise<NonNullable<typeof mids>> {
  if (mids && Date.now() - mids.at < 15_000) return mids;
  const res = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "allMids" }),
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok) throw new Error(`Hyperliquid ${res.status}`);
  const raw = (await res.json()) as Record<string, string>;
  mids = { at: Date.now(), prices: midsFrom(raw), names: Object.keys(raw).filter((n) => NAMED.test(n)) };
  return mids;
}

export function midsFrom(raw: Record<string, string>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [name, mid] of Object.entries(raw)) {
    const price = Number(mid);
    if (NAMED.test(name) && price > 0) out.set(name.toUpperCase(), price);
  }
  return out;
}

/**
 * A ticker's USD price in Hyperliquid's mids: its perp, else its spot pair against USDC, else the
 * thousand-unit perp ("kPEPE" is 1,000 PEPE) divided by 1,000.
 */
export function priceIn(prices: Map<string, number>, ticker: string): number | null {
  const t = ticker.toUpperCase();
  const k = prices.get(`K${t}`);
  return prices.get(t) ?? prices.get(`${t}/USDC`) ?? (k ? k / 1000 : null);
}

export async function hyperliquidPrice(ticker: string): Promise<number | null> {
  return priceIn(await allMids(), ticker);
}

/** Coin names that are also everyday words; a lower-case one isn't taken as a coin on its own. */
const WORDS = new Set(["move", "people", "super", "stable", "layer", "prompt", "prove", "vine", "mega", "meme", "chip", "hyper", "launchcoin", "useless", "init", "dood", "jelly", "goat", "pump", "brett"]);
let coins: { at: number; names: Set<string> } | null = null;

/** "kPEPE" → "pepe", "PURR/USDC" → "purr"; short names and everyday words left out. */
export function coinWords(names: string[]): string[] {
  return names.map((n) => n.replace(/\/USDC$/, "").replace(/^k(?=[A-Z])/, "").toLowerCase()).filter((n) => n.length >= 4 && !WORDS.has(n));
}

/** Lower-case names of Hyperliquid's coins worth spotting in a message, refreshed every 10 minutes. */
export async function hyperliquidCoins(): Promise<Set<string>> {
  if (coins && Date.now() - coins.at < 10 * 60_000) return coins.names;
  const names = new Set(coinWords((await load()).names));
  coins = { at: Date.now(), names };
  return names;
}
