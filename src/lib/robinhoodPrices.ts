import { config } from "./config";
import type { PoolRead } from "./proof";

/**
 * Prices for Robinhood Chain tokens (tokenized stocks and the chain's memecoins), read
 * straight from Uniswap v3 pools over Tatum's Robinhood Chain RPC. None of them trade on a
 * centralised exchange as tokens, so the pool is the price.
 *
 * Copycat tokens reuse the same tickers, so pools are pinned here, not looked up: each is
 * the deepest Uniswap v3 pool for that token against USDG or WETH, checked against market
 * prices with scripts/try-robinhood.mts.
 *
 * The free RPC plan has no eth_call, so the price is read from the pool's storage: slot 0
 * holds slot0, whose low 160 bits are sqrtPriceX96. Token order and decimals can't be read
 * that way, so they're pinned too (Uniswap orders a pool's tokens by address).
 */

export type RobinhoodKind = "stock" | "memecoin";

const USDG = { address: "0x5fc5360d0400a0fd4f2af552add042d716f1d168", decimals: 6 };
const WETH = { address: "0x0bd7d308f8e1639fab988df18a8011f41eacad73", decimals: 18 };
/** WETH/USDG, the deepest pool on the chain: prices everything quoted in WETH. */
const WETH_USDG_POOL = "0x52e65B17fB6E5BA00Ed806f37Afcd2DaA50271Ca";

interface Pinned {
  token: string;
  decimals: number;
  pool: string;
  quote: typeof USDG | typeof WETH;
  kind: RobinhoodKind;
}

const pin = (token: string, pool: string, quote: Pinned["quote"], kind: RobinhoodKind, decimals = 18): Pinned => ({ token, decimals, pool, quote, kind });

const TOKENS: Record<string, Pinned> = {
  TSLA: pin("0x322F0929c4625eD5bAd873c95208D54E1c003b2d", "0xf4ACdAEEB7022862A763C9B1B885e11191c889E3", USDG, "stock"),
  NVDA: pin("0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC", "0xd4EB21209C4D6093f80B5b84f5C45cc093EA14a3", USDG, "stock"),
  AAPL: pin("0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9", "0x8bb3514e2204E1cDF3Ac149EFEe7Ff04D91B719f", WETH, "stock"),
  SPY: pin("0x117cc2133c37B721F49dE2A7a74833232B3B4C0C", "0xDDCBBa3666f578E3F09516f21Ff85BFee859AB5e", WETH, "stock"),
  MSFT: pin("0xe93237C50D904957Cf27E7B1133b510C669c2e74", "0xeb60bCD1D920ad6E102690CCFC6fB488899E1510", USDG, "stock"),
  AMZN: pin("0x12f190a9F9d7D37a250758b26824B97CE941bF54", "0x8AC92DA74AB5F3b1d024Dc1943Ad7e15Dc4179Ef", USDG, "stock"),
  GOOGL: pin("0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3", "0x34D0dC122CF9A8Eb296fC5e0D3A233625D7d19b7", USDG, "stock"),
  META: pin("0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35", "0xa4BdB396a69617eb7F70E2cc1EF526f7340b1B0d", WETH, "stock"),
  COIN: pin("0x6330D8C3178a418788dF01a47479c0ce7CCF450b", "0x6707aeAc7D0e519B083219d27BB427364363183A", WETH, "stock"),
  // No HOOD: the only liquid "HOOD" isn't named like Robinhood's stock tokens ("… • Robinhood Token").
  PONS: pin("0x39dBED3a2bd333467115dE45665cC57F813C4571", "0x10CC6BD38112cAc182db90B6a71d8Bb5939526bA", WETH, "memecoin"),
  CASHCAT: pin("0x020bfC650A365f8BB26819deAAbF3E21291018b4", "0xA70fc67C9F69da90B63a0e4C05D229954574E313", WETH, "memecoin"),
};

export const isRobinhoodToken = (symbol: string) => symbol.toUpperCase() in TOKENS;
export const robinhoodKind = (symbol: string): RobinhoodKind | null => TOKENS[symbol.toUpperCase()]?.kind ?? null;
export const robinhoodTokens = () => Object.entries(TOKENS).map(([symbol, t]) => ({ symbol, ...t }));

const RPC = "https://robinhood-mainnet.gateway.tatum.io";

/**
 * The free plan allows a few requests a second and no batching, so requests go one at a
 * time, a little apart, and a rate-limited one is retried.
 */
let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;
const SPACING_MS = 300;

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const run = async (): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      const wait = lastCall + SPACING_MS - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastCall = Date.now();
      const res = await fetch(RPC, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": config.tatum.apiKey },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8_000),
      });
      const body = (await res.json().catch(() => null)) as { result?: T; error?: { message: string } } | null;
      if (body?.result !== undefined) return body.result;
      if (attempt >= 3 || (res.status !== 429 && !/rate|limit/i.test(body?.error?.message ?? ""))) throw new Error(`${method}: ${body?.error?.message ?? res.status}`);
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
    }
  };
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}

/** sqrtPriceX96 from a Uniswap v3 pool's slot 0 word: its low 160 bits. */
export const sqrtPriceFromSlot0 = (word: string) => BigInt(word) & ((BigInt(1) << BigInt(160)) - BigInt(1));

/** Uniswap keeps sqrt(price of token0 in token1) as Q64.96 over raw units; this is the price in whole tokens. */
export const uniswapPrice = (sqrtPriceX96: bigint, dec0: number, dec1: number) => (Number(sqrtPriceX96) / 2 ** 96) ** 2 * 10 ** (dec0 - dec1);

/** How many `quote` one `token` buys in this pool, at a block. */
async function priceIn(pool: string, token: { address: string; decimals: number }, quote: { address: string; decimals: number }, block: string): Promise<number> {
  const sqrt = sqrtPriceFromSlot0(await rpc<string>("eth_getStorageAt", [pool, "0x0", block]));
  if (!sqrt) throw new Error(`empty pool ${pool}`);
  const tokenFirst = token.address.toLowerCase() < quote.address.toLowerCase();
  const [t0, t1] = tokenFirst ? [token, quote] : [quote, token];
  const p = uniswapPrice(sqrt, t0.decimals, t1.decimals);
  return tokenFirst ? p : 1 / p;
}

/** Pool reads are cached briefly: a burst of calls on one token costs one read. */
const cache = new Map<string, { at: number; value: Promise<{ price: number; reads: PoolRead[] } | null> }>();
const TTL = 20_000;

/**
 * USD price of a Robinhood Chain token from its pool, read at one block, with the pools it
 * came from (plus WETH/USDG when the token trades against WETH). Null if we don't track it.
 */
export function robinhoodQuote(symbol: string): Promise<{ price: number; reads: PoolRead[] } | null> {
  const key = symbol.toUpperCase();
  const t = TOKENS[key];
  if (!t) return Promise.resolve(null);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  const value = (async () => {
    // One block for every read, so the price and its proof describe the same moment.
    const block = await rpc<string>("eth_blockNumber", []);
    const read = (pool: string): PoolRead => ({ chain: "robinhood", pool, block: String(BigInt(block)) });
    const own = await priceIn(t.pool, { address: t.token, decimals: t.decimals }, t.quote, block);
    if (t.quote === USDG) return { price: own, reads: [read(t.pool)] };
    const weth = await priceIn(WETH_USDG_POOL, WETH, USDG, block);
    return { price: own * weth, reads: [read(t.pool), read(WETH_USDG_POOL)] };
  })();
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  return value;
}
