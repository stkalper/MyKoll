// Hiding a settled call takes it out of the author's stored record, and unhiding puts it back. Local DB only.
//   npx tsx --env-file=.env.local scripts/try-hide.mts
import "./local-db.mts";
import { setHidden, type CallRow } from "../src/lib/calls";
import { db } from "../src/lib/db";
import { learnFrom, trackRecords } from "../src/lib/learning";

const chat = -1000000777101;
const author = 777;
await db(`delete from calls where chat_id = $1`, [chat]);
await db(`delete from track_records where chat_id = $1`, [chat]);
const add = async (quote: string, status: "win" | "loss") =>
  (
    await db<{ id: number }>(
      `insert into calls (chat_id, author_id, author_name, market, subject, direction, target, quote, deadline, status, resolved_at)
       values ($1, $2, '@hide_test', 'crypto', 'BNB', 'above', 705, $3, now(), $4, now()) returning id`,
      [chat, author, quote, status],
    )
  )[0].id;

await add("Bnb 705 in 3 hours", "win");
const twin = await add("Bnb 705 in 3 hours", "win");
await add("Bnb 720 by Friday", "loss");
const [last] = await db<CallRow>(`select * from calls where chat_id = $1 order by id desc limit 1`, [chat]);
// Stored the way a settlement stores it (memory write skipped: no Walrus for a test chat).
await learnFrom(last).catch(() => {});
const summary = async () => (await trackRecords(chat)).get(String(author))?.summary;
console.log("before:", await summary(), "(want 2/3)");
await setHidden(twin, author, true);
console.log("hidden:", await summary(), "(want 1/2)");
await setHidden(twin, author, false);
console.log("unhidden:", await summary(), "(want 2/3)");
process.exit(0);
