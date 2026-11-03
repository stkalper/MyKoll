import { connection } from "next/server";
import { livePrices } from "@/lib/live";

/**
 * Live prices: which come from on-chain pools (Sui, Robinhood Chain), the explorer page behind
 * each pool price, and how the Price API compares where it has one. Cached at the edge.
 */
export async function GET() {
  // Read at request time, never while building.
  await connection();
  return Response.json({ prices: await livePrices() }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } });
}
