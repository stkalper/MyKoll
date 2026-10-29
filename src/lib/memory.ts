import { MemWal } from "@mysten-incubation/memwal";
import { config, memwalEnabled } from "./config";

/**
 * Walrus Memory for a group chat. Every chat has its own namespace, so one chat's
 * calls never surface in another chat's answers. Entries start with a tag such as
 * `[CALL #12]` so recall results can be tied back to a call (and hidden ones dropped).
 */

export interface Recalled {
  text: string;
  blobId?: string;
  distance: number;
}

/** Recall results above this distance are usually unrelated filler (see Walrus Memory docs). */
const MAX_DISTANCE = 0.8;

let client: MemWal | undefined;

function memwal(): MemWal {
  client ??= MemWal.create({
    key: config.memwal.key,
    accountId: config.memwal.accountId,
    serverUrl: config.memwal.serverUrl,
    namespace: config.memwal.namespacePrefix,
  });
  return client;
}

export const chatNamespace = (chatId: number | string) => `${config.memwal.namespacePrefix}:chat:${chatId}`;

/** Queues a write and returns the relayer job id; the blob is sealed in the background. */
export async function remember(chatId: number | string, text: string): Promise<string | null> {
  if (!memwalEnabled) return null;
  const job = await memwal().rememberAsync(text, chatNamespace(chatId));
  return job.job_id;
}

export async function recall(chatId: number | string, query: string, limit = 10): Promise<Recalled[]> {
  if (!memwalEnabled) return [];
  const result = await memwal().recall({ query, limit, namespace: chatNamespace(chatId), maxDistance: MAX_DISTANCE });
  return result.results.map((r) => ({ text: r.text, blobId: r.blob_id, distance: r.distance }));
}

/** How many memories each chat holds on Walrus, keyed by chat id, as the relayer counts them. */
export async function memoryCounts(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!memwalEnabled) return out;
  const prefix = chatNamespace("");
  let cursor: string | undefined;
  do {
    const page = await memwal().listNamespaces({ cursor, limit: 500 });
    for (const n of page.namespaces) if (n.name.startsWith(prefix)) out.set(n.name.slice(prefix.length), n.memory_count);
    cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return out;
}

/** Call ids referenced by a memory entry, e.g. "[CALL #12]" → 12. */
export function callIdsIn(text: string): number[] {
  return [...text.matchAll(/#(\d+)\]/g)].map((m) => Number(m[1]));
}
