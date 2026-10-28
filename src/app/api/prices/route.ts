import { quote } from "@/lib/tatum";

const SYMBOLS = ["BTC", "ETH", "SUI", "WAL", "DEEP", "NS"];

/** Live prices for the landing page, showing which come from on-chain Sui pools. Cached at the edge. */
export async function GET() {
  const prices = [];
  for (const symbol of SYMBOLS) prices.push({ symbol, ...(await quote(symbol).catch(() => null)) });
  return Response.json({ prices }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } });
}
