import { cacheLife } from "next/cache";
import { knownChats, publicChats } from "./calls";
import { db } from "./db";
import { effectCounts } from "./effects";
import { memoryCounts } from "./memory";
import { proofLabel, proofUrl } from "./proof";
import { fileUrl } from "./receipts";
import { memoryScorecard } from "./scorecard";
import { gap, quote } from "./tatum";
import type { MemoryCheckView, MemoryEffectKind } from "./view";

/** Live numbers for the landing page and /api/stats, from the production database and Walrus Memory. */
export interface LiveStats {
  groups: number;
  calls: number;
  settled: number;
  members: number;
  memories: number | null;
  memoryCheck: MemoryCheckView;
  memoryEffects: Partial<Record<MemoryEffectKind, number>>;
  /** Real chats whose admins made their file public, so anyone can see the bot at work. */
  publicFiles: { title: string; calls: number; url: string }[];
}

/** Only chats the bot has actually seen are counted, so test namespaces don't inflate the total. */
export async function liveStats(): Promise<LiveStats> {
  const [chats, [calls], counts, memoryCheck, open] = await Promise.all([
    knownChats(),
    db<{ calls: number; settled: number; members: number }>(
      `select count(*)::int as calls,
              count(*) filter (where status in ('win', 'loss'))::int as settled,
              (select count(*)::int from track_records) as members
         from calls where not hidden`,
    ),
    memoryCounts().catch(() => null),
    memoryScorecard(),
    publicChats(),
  ]);
  const memoryEffects = await effectCounts(chats.map((c) => c.chat_id));
  const memories = counts ? chats.reduce((sum, c) => sum + (counts.get(String(c.chat_id)) ?? 0), 0) : null;
  const publicFiles = open.map((c) => ({ title: c.title ?? "A group chat", calls: c.calls, url: fileUrl(c.chat_id) }));
  return { groups: chats.length, calls: calls.calls, settled: calls.settled, members: calls.members, memories, memoryCheck, memoryEffects, publicFiles };
}

export interface LivePrice {
  symbol: string;
  price?: number;
  source?: string;
  /** The explorer page behind this pool price, and which chain it's on. */
  proofUrl?: string;
  proofChain?: string;
  /** The Price API's price for the same token, when it has one. */
  check?: { price: number; apart: number };
}

const SYMBOLS = ["BTC", "SUI", "WAL", "DEEP", "TSLA", "PONS"];

/** The prices calls are judged by right now, each with where it came from. */
export async function livePrices(): Promise<LivePrice[]> {
  const prices: LivePrice[] = [];
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
  return prices;
}

/*
 * The landing page renders these on the server from a shared cache, so the numbers arrive with the
 * page instead of after it: the page is rebuilt in the background every two minutes, and a visitor
 * never waits on the database, Walrus or a price source.
 */

export async function cachedStats(): Promise<LiveStats | null> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 120, expire: 86_400 });
  return liveStats().catch((err) => {
    console.error("live stats failed", err);
    return null;
  });
}

export async function cachedPrices(): Promise<LivePrice[]> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 120, expire: 86_400 });
  return livePrices();
}
