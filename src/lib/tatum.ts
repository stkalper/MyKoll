import { config } from "./config";

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
