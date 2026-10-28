import { config } from "./config";
import { isSuiToken, suiTokenPriceUsd } from "./suiPrices";

/** Where a price came from: Tatum's Price API, or an on-chain Sui pool read over Tatum's Sui gRPC. */
export type PriceSource = "price-api" | "sui-onchain";

export const sourceLabel: Record<PriceSource, string> = {
  "price-api": "Tatum Price API",
  "sui-onchain": "on-chain Cetus pool via Tatum Sui RPC",
};

/** USD price of a ticker from Tatum's Price API, or null if Tatum doesn't know the symbol. */
export async function priceUsd(symbol: string): Promise<number | null> {
  const url = `https://api.tatum.io/v4/data/rate/symbol?symbol=${encodeURIComponent(symbol.toUpperCase())}&basePair=USD`;
  const res = await fetch(url, {
    headers: { "x-api-key": config.tatum.apiKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { value?: string };
  const value = Number(data.value);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * The price a call is judged by. Sui tokens are read from their pool on-chain (many have no
 * listing the Price API knows), everything else comes from the Price API.
 */
export async function quote(symbol: string): Promise<{ price: number; source: PriceSource } | null> {
  if (isSuiToken(symbol)) {
    const price = await suiTokenPriceUsd(symbol).catch((err) => {
      console.error("on-chain price failed", symbol, err);
      return null;
    });
    if (price) return { price, source: "sui-onchain" };
  }
  const price = await priceUsd(symbol);
  return price ? { price, source: "price-api" } : null;
}
