import { ChannelCredentials } from "@grpc/grpc-js";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";
import { config } from "./config";

/**
 * Prices for Sui tokens read straight from on-chain Cetus CLMM pools over Tatum's Sui gRPC
 * gateway. Many Sui tokens have no CEX listing, so this is the only honest price for them.
 */

/** Deepest Cetus pool per token, paired with SUI or USDC (mainnet). */
const POOLS: Record<string, string> = {
  SUI: "0xb8d7d9e66a60c239e7a60110efcf8de6c705580ed924d0dde141f4a0e2c90105",
  WAL: "0x72f5c6eef73d77de271886219a2543e7c29a33de19a6c69c5cf1899f729c3f17",
  DEEP: "0xe01243f37f712ef87e556afb9b1d03d0fae13f96d324ec912daffc339dfdcbd2",
  CETUS: "0x2e041f3fd93646dcc877f783c1f2b7fa62d30271bdef1f21ef002cebf857bded",
  HAEDAL: "0x711f5d37e3b09b026b182d9e0973d05e9a837d11066ff48f4a55a426d8913359",
  NAVX: "0x0254747f5ca059a1972cd7f6016485d51392a3fde608107b93bbaebea550f703",
  NS: "0x763f63cbada3a932c46972c6c6dcf1abd8a9a73331908a1d7ef24c2232d85520",
  IKA: "0x8a7632cbbab48b9e4a1bc736580366f0b8c1164724f5990eebdfbe504fbcd83b",
  HIPPO: "0xb785e6eed355c1f8367c06d2b0cb9303ab167f8359a129bb003891ee54c6fce0",
  SCA: "0x9661cca01a5b9b3536883568fa967a2943e237de11a97976795f5adb293892e9",
  LOFI: "0xd6918afa64d432b84b48088d165b0dda0b7459463a7d66365f7ff890cae22d2d",
};

const SUI_TYPE = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";
const USDC_TYPE = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";

export const isSuiToken = (symbol: string) => symbol.toUpperCase() in POOLS;

let client: SuiGrpcClient | undefined;

/** Tatum's gateway speaks native gRPC (application/grpc), not gRPC-web, so use an HTTP/2 transport. */
function sui(): SuiGrpcClient {
  client ??= new SuiGrpcClient({
    network: "mainnet",
    transport: new GrpcTransport({
      host: config.tatum.suiGrpcHost,
      channelCredentials: ChannelCredentials.createSsl(),
      meta: { "x-api-key": config.tatum.apiKey },
    }),
  });
  return client;
}

/**
 * Tatum's free plan allows only a few requests per second, so calls go one at a time
 * and a 429 is retried after a short pause.
 */
let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;
const SPACING_MS = 350;

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    for (let attempt = 0; ; attempt++) {
      const wait = lastCall + SPACING_MS - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastCall = Date.now();
      try {
        return await fn();
      } catch (err) {
        if (attempt >= 4 || !String((err as Error).message).includes("429")) throw err;
        await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
      }
    }
  };
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}

const decimals = new Map<string, number>();

async function decimalsOf(coinType: string): Promise<number> {
  const normalized = coinType.startsWith("0x") ? coinType : `0x${coinType}`;
  if (!decimals.has(normalized)) {
    // A rate-limited lookup comes back empty rather than failing, so treat empty as retryable.
    const coinMetadata = await throttled(async () => {
      const { coinMetadata } = await sui().core.getCoinMetadata({ coinType: normalized });
      if (!coinMetadata) throw new Error(`429? no metadata for ${normalized}`);
      return coinMetadata;
    });
    decimals.set(normalized, coinMetadata.decimals);
  }
  return decimals.get(normalized)!;
}

const sameType = (a: string, b: string) => a.replace(/^0x0*/, "") === b.replace(/^0x0*/, "");

interface PoolPrice {
  coinA: string;
  coinB: string;
  /** How many B one A buys, in whole tokens. */
  aInB: number;
}

/** Pool reads are cached briefly: a burst of calls on one token costs one request. */
const poolCache = new Map<string, { at: number; value: Promise<PoolPrice> }>();
const POOL_TTL = 20_000;

function readPool(poolId: string): Promise<PoolPrice> {
  const hit = poolCache.get(poolId);
  if (hit && Date.now() - hit.at < POOL_TTL) return hit.value;
  const value = fetchPool(poolId);
  poolCache.set(poolId, { at: Date.now(), value });
  value.catch(() => poolCache.delete(poolId));
  return value;
}

async function fetchPool(poolId: string): Promise<PoolPrice> {
  const { object } = await throttled(() => sui().core.getObject({ objectId: poolId, include: { json: true } }));
  const [, coinA, coinB] = object.type.match(/::pool::Pool<(.+),\s*(.+)>$/) ?? [];
  const sqrt = (object as { json?: { current_sqrt_price?: string } }).json?.current_sqrt_price;
  if (!coinA || !coinB || !sqrt) throw new Error(`unexpected pool ${poolId}`);
  // Cetus keeps sqrt(price of A in B) as Q64.64 over raw units.
  const raw = (Number(BigInt(sqrt)) / 2 ** 64) ** 2;
  const [decA, decB] = await Promise.all([decimalsOf(coinA), decimalsOf(coinB)]);
  return { coinA, coinB, aInB: raw * 10 ** (decA - decB) };
}

/** USD price of a Sui token from its on-chain pool, or null if it isn't one we track. */
export async function suiTokenPriceUsd(symbol: string): Promise<number | null> {
  const poolId = POOLS[symbol.toUpperCase()];
  if (!poolId) return null;
  const pool = await readPool(poolId);

  const usdOf = async (coinType: string): Promise<number | null> => {
    if (sameType(coinType, USDC_TYPE)) return 1;
    if (sameType(coinType, SUI_TYPE)) return symbol.toUpperCase() === "SUI" ? null : suiTokenPriceUsd("SUI");
    return null;
  };

  // The token is whichever side isn't the quote; for SUI itself the quote is USDC.
  const quoteB = await usdOf(pool.coinB);
  if (quoteB !== null && !sameType(pool.coinA, USDC_TYPE)) return pool.aInB * quoteB;
  const quoteA = await usdOf(pool.coinA);
  if (quoteA !== null) return quoteA / pool.aInB;
  return null;
}
