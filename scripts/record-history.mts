// Replays every member's settled calls in the order they settled and prints each time a result
// changed what the bot thinks they're good or bad at (recordChanges in src/lib/learning.ts).
// Reads only. With --write, adds the changes that happened before this feature existed to the
// chat's "What memory changed" feed, dated when they happened (the database only, not Walrus).
//   npx tsx --env-file=.env.local scripts/record-history.mts [--write]
import type { CallRow } from "../src/lib/calls";
import { db } from "../src/lib/db";
import { changeText, recordChanges, trackRecordOf } from "../src/lib/learning";
import { scoreMemory } from "../src/lib/scorecard";

const write = process.argv.includes("--write");
const settled = await db<CallRow>(`select * from calls where status in ('win', 'loss') and not hidden order by resolved_at`);

const byAuthor = new Map<string, CallRow[]>();
for (const c of settled) {
  const key = `${c.chat_id}:${c.author_id}`;
  byAuthor.set(key, [...(byAuthor.get(key) ?? []), c]);
}

let found = 0;
let added = 0;
for (const calls of byAuthor.values()) {
  for (let i = 1; i < calls.length; i++) {
    const c = calls[i];
    const changes = recordChanges(trackRecordOf(calls.slice(0, i)) ?? undefined, trackRecordOf(calls.slice(0, i + 1))!);
    if (!changes.length) continue;
    found++;
    const text = changeText(c, changes);
    console.log(`${new Date(c.resolved_at!).toISOString().slice(0, 16)} #${c.id} ${text}`);
    if (write) {
      const rows = await db(
        `insert into memory_effects (chat_id, kind, text, call_id, created_at) values ($1, 'record_changed', $2, $3, $4) on conflict do nothing returning id`,
        [c.chat_id, text, c.id, c.resolved_at],
      );
      added += rows.length;
    }
  }
}

const s = scoreMemory(settled);
console.log(`\n${found} changes of mind over ${settled.length} settled calls${write ? `, ${added} added to the feed` : " (nothing written; --write adds them to the feed)"}`);
console.log(`Memory Check: memory ${s.brierMemory?.toFixed(3)} · chat hit rate only ${s.brierChatRate?.toFixed(3)} · forgetful 0.250`);
process.exit(0);
