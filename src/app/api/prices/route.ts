import { proofLabel, proofUrl } from "@/lib/proof";
import { gap, quote } from "@/lib/tatum";

const SYMBOLS = ["BTC", "SUI", "WAL", "DEEP", "TSLA", "PONS"];

/**
 * Live prices for the landing page: which come from on-chain pools (Sui, Robinhood Chain),
 * the explorer page behind each pool price, and how the Price API compares where it has
 * one. Cached at the edge.
 */
export async function GET() {
  const prices = [];
  for (const symbol of SYMBOLS) {
    const q = await quote(symbol).catch(() => null);
    prices.push({
      symbol,
      price: q?.price,
      source: q?.source,
      proofUrl: q?.proof?.[0] ? proofUrl(q.proof[0]) : undefined,
      proofChain: q?.proof?.[0] ? proofLabel(q.proof[0]) : undefined,
      check: q?.check ? { price: q.check, apart: gap(q.price, q.check) } : undefined,
    });
  }
  return Response.json({ prices }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } });
}
