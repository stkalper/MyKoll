import { config } from "./config";
import { isSuiToken, suiTokenQuote, type PoolRead } from "./suiPrices";

/** Where a price came from: Tatum's Price API, or an on-chain Sui pool read over Tatum's Sui gRPC. */
export type PriceSource = "price-api" | "sui-onchain";

export const sourceLabel: Record<PriceSource, string> = {
  "price-api": "Tatum Price API",
  "sui-onchain": "on-chain Cetus pool via Tatum Sui RPC",
};

/** USD price of a ticker from Tatum's Price API, or null if Tatum doesn't know the symbol. */
export async function priceUsd(symbol: string): Promise<number | null> {
  const url = `https://api.tatum.io/v4/data/rate/symbol?symbol=${encodeURIComponent(symbol.toUpperCase())}&basePair=USD`;
  const get = () => fetch(url, { headers: { "x-api-key": config.tatum.apiKey }, signal: AbortSignal.timeout(6_000) });
  // The first request from a cold function now and then hangs; a second try goes through.
  const res = await get().catch(get);
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
 * everything else comes from the Price API.
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
    if (onchain) return { price: onchain.price, source: "sui-onchain", proof: onchain.reads, check: check ?? undefined };
    if (check) return { price: check, source: "price-api" };
    return null;
  }
  const price = await priceUsd(symbol);
  return price ? { price, source: "price-api" } : null;
}
