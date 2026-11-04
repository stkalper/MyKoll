import { db } from "./db";
import type { MemoryEffectKind } from "./view";

/**
 * The times what the bot remembered changed what it did in a chat: a call flagged as a weak spot,
 * a member no longer asked, a message left alone. Written when it happens, so the feed in the Mini
 * App shows real decisions and not a description of what the bot could do.
 */
export async function noteEffect(chatId: number | string, kind: MemoryEffectKind, text: string, callId: number | null = null) {
  await db(`insert into memory_effects (chat_id, kind, text, call_id) values ($1, $2, $3, $4) on conflict do nothing`, [chatId, kind, text, callId]).catch((err) =>
    console.error("could not note a memory effect", err),
  );
}

export const recentEffects = (chatId: number | string, limit = 12) =>
  db<{ kind: MemoryEffectKind; text: string; created_at: Date }>(`select kind, text, created_at from memory_effects where chat_id = $1 order by created_at desc limit $2`, [chatId, limit]);

/**
 * Every time a result changed what the bot thinks a member is good or bad at, grouped by member,
 * oldest first: how its view of each of them was built up over time. Reads the feed lines written
 * by `changeText` ("Changed its view of @x after "<quote>": <changes>.").
 */
export async function changesOfMind(chatId: number | string): Promise<{ member: string; changes: { after: string; what: string; at: Date }[] }[]> {
  const rows = await db<{ text: string; created_at: Date }>(
    `select text, created_at from memory_effects where chat_id = $1 and kind = 'record_changed' order by created_at limit 200`,
    [chatId],
  );
  const byMember = new Map<string, { after: string; what: string; at: Date }[]>();
  for (const r of rows) {
    const m = r.text.match(/^Changed its view of (.+?) after "(.*)": (.+)\.$/);
    if (!m) continue;
    byMember.set(m[1], [...(byMember.get(m[1]) ?? []), { after: m[2], what: m[3], at: r.created_at }]);
  }
  // Members whose view changed most often first: theirs is the longest story.
  return [...byMember.entries()].map(([member, changes]) => ({ member, changes })).sort((a, b) => b.changes.length - a.changes.length);
}

/** How many times each kind of change happened across these chats, with nothing that identifies anyone. */
export async function effectCounts(chatIds: (number | string)[]): Promise<Partial<Record<MemoryEffectKind, number>>> {
  if (!chatIds.length) return {};
  const rows = await db<{ kind: MemoryEffectKind; n: number }>(`select kind, count(*)::int as n from memory_effects where chat_id = any($1) group by kind`, [chatIds]);
  return Object.fromEntries(rows.map((r) => [r.kind, r.n]));
}
