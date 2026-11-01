import { knownChats } from "@/lib/calls";
import { db } from "@/lib/db";
import { effectCounts } from "@/lib/effects";
import { memoryCounts } from "@/lib/memory";
import { memoryScorecard } from "@/lib/scorecard";

/**
 * Live numbers for the landing page, from the production database and Walrus Memory. Only
 * chats the bot has actually seen are counted, so test namespaces don't inflate the total.
 */
export async function GET() {
  const [chats, [calls], counts, memoryCheck] = await Promise.all([
    knownChats(),
    db<{ calls: number; settled: number; members: number }>(
      `select count(*)::int as calls,
              count(*) filter (where status in ('win', 'loss'))::int as settled,
              (select count(*)::int from track_records) as members
         from calls where not hidden`,
    ),
    memoryCounts().catch(() => null),
    memoryScorecard(),
  ]);
  const memoryEffects = await effectCounts(chats.map((c) => c.chat_id));
  const memories = counts ? chats.reduce((sum, c) => sum + (counts.get(String(c.chat_id)) ?? 0), 0) : null;
  return Response.json(
    { groups: chats.length, calls: calls.calls, settled: calls.settled, members: calls.members, memories, memoryCheck, memoryEffects },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800" } },
  );
}
