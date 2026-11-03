import { connection } from "next/server";
import { liveStats } from "@/lib/live";

/** Live numbers, from the production database and Walrus Memory (the landing page renders the same). */
export async function GET() {
  // Read at request time, never while building.
  await connection();
  return Response.json(await liveStats(), { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800" } });
}
