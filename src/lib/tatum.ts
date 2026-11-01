import { config } from "./config";
import { tatumOr, tatumOut } from "./fallback";
import type { PoolRead } from "./proof";
import { isRobinhoodToken, robinhoodQuote } from "./robinhoodPrices";
import { isSuiToken, suiTokenQuote } from "./suiPrices";

/**
 * Where a price came from: Tatum's Price API, an on-chain Sui pool read over Tatum's Sui
 * gRPC, or an on-chain Robinhood Chain pool read over Tatum's Robinhood Chain RPC. The rest are
 * the public endpoints used while Tatum is out of credits.
 */
export type PriceSource = "price-api" | "sui-onchain" | "robinhood-onchain" | "binance" | "coingecko" | "sui-public" | "robinhood-public";

export const sourceLabel: Record<PriceSource, string> = {
  "price-api": "Tatum Price API",
  "sui-onchain": "on-chain Cetus pool via Tatum Sui RPC",
  "robinhood-onchain": "on-chain Uniswap pool on Robinhood Chain via Tatum RPC",
  binance: "Binance public API",
  coingecko: "CoinGecko public API",
  "sui-public": "on-chain Cetus pool via public Sui GraphQL",
  "robinhood-public": "on-chain Uniswap pool via public Robinhood Chain RPC",
};

/** Tickers the Price API knows under another symbol. */
const API_SYMBOL: Record<string, string> = { TRX: "TRON" };

/** A ticker's USD price from public APIs: Binance's pair if it has one, else CoinGecko's top match. */
async function publicPrice(ticker: string): Promise<{ price: number; source: PriceSource } | null> {
  const read = async (url: string) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000) }).catch(() => null);
    return res?.ok ? ((await res.json().catch(() => null)) as Record<string, unknown> | null) : null;
  };
  const binance = Number((await read(`https://data-api.binance.vision/api/v3/ticker/price?symbol=${encodeURIComponent(ticker)}USDT`))?.price);
  if (binance > 0) return { price: binance, source: "binance" };
  const key = ticker.toLowerCase();
  const gecko = await read(`https://api.coingecko.com/api/v3/simple/price?symbols=${encodeURIComponent(key)}&vs_currencies=usd`);
  const usd = Number((gecko?.[key] as { usd?: number } | undefined)?.usd);
  return usd > 0 ? { price: usd, source: "coingecko" } : null;
}

/** USD price of a ticker and where it came from, or null if nobody knows the symbol. */
export function priceFeed(symbol: string): Promise<{ price: number; source: PriceSource } | null> {
  const ticker = symbol.toUpperCase();
  return tatumOr(
    async () => {
      const value = await tatumPrice(ticker);
      return value ? { price: value, source: "price-api" as const } : null;
    },
    () => publicPrice(ticker),
  );
}

export const priceUsd = async (symbol: string) => (await priceFeed(symbol))?.price ?? null;

/** USD price from Tatum's Price API, or null if Tatum doesn't know the symbol. */
async function tatumPrice(ticker: string): Promise<number | null> {
  const url = `https://api.tatum.io/v4/data/rate/symbol?symbol=${encodeURIComponent(API_SYMBOL[ticker] ?? ticker)}&basePair=USD`;
  const get = () => fetch(url, { headers: { "x-api-key": config.tatum.apiKey }, signal: AbortSignal.timeout(6_000) });
  // The first request from a cold function now and then hangs; a second try goes through.
  const res = await get().catch(get);
  if (res.status === 402) throw new Error("Price API 402");
  if (!res.ok) return null;
  const data = (await res.json()) as { value?: string };
  const value = Number(data.value);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export interface Quote {
  price: number;
  source: PriceSource;
  /** On-chain prices: the pool states they were read from, checkable on a Sui explorer. */
  proof?: PoolRead[];
  /** On-chain prices: what the Price API says for the same token, when it covers it. */
  check?: number;
}

/** Sources further apart than this are flagged on the receipt. */
export const DISAGREE = 0.02;

/** How far apart two prices are, as a fraction of the one that counts. */
export const gap = (price: number, check: number) => Math.abs(check - price) / price;

/**
 * The price a call is judged by. Sui tokens are read from their pool on-chain (most have no
 * listing the Price API covers), and cross-checked against the Price API where it has one;
 * Robinhood Chain tokens come from their Uniswap pool; everything else from the Price API.
 */
export async function quote(symbol: string): Promise<Quote | null> {
  if (isSuiToken(symbol)) {
    const [onchain, check] = await Promise.all([
      suiTokenQuote(symbol).catch((err) => {
        console.error("on-chain price failed", symbol, err);
        return null;
      }),
      priceUsd(symbol).catch(() => null),
    ]);
    if (onchain) return { price: onchain.price, source: tatumOut() ? "sui-public" : "sui-onchain", proof: onchain.reads, check: check ?? undefined };
    return check ? priceFeed(symbol) : null;
  }
  // Stock tokens and Robinhood Chain memecoins: the pool is the only source. The Price API is no
  // fallback or cross-check here, because its "TSLA" or "META" would be some other crypto token.
  if (isRobinhoodToken(symbol)) {
    const onchain = await robinhoodQuote(symbol).catch((err) => {
      console.error("Robinhood Chain price failed", symbol, err);
      return null;
    });
    return onchain ? { price: onchain.price, source: tatumOut() ? "robinhood-public" : "robinhood-onchain", proof: onchain.reads } : null;
  }
  return priceFeed(symbol);
}
