// scripts/hide-duplicates.mts on the local database: a logged-twice pair and a lone call.
//   npx tsx --env-file=.env.local scripts/try-hide-duplicates.mts
import "./local-db.mts";
import { db } from "../src/lib/db";

const chat = -1000000777201;
await db(`delete from calls where chat_id = $1`, [chat]);
const add = async (quote: string) =>
  (
    await db<{ id: number }>(
      `insert into calls (chat_id, author_id, author_name, market, subject, direction, target, quote, deadline, status, resolved_at)
       values ($1, 778, '@dup_test', 'crypto', 'BNB', 'above', 705, $2, now(), 'win', now()) returning id`,
      [chat, quote],
    )
  )[0].id;
const first = await add("Bnb 705 in 3 hours");
const second = await add("Bnb 705 in 3 hours");
const lone = await add("Bnb 720 by Friday");

process.argv = [process.argv[0], "hide-duplicates", String(first), String(lone), "--yes"];
const exit = process.exit;
process.exit = (() => undefined) as never;
// Through a URL, so the type check doesn't read the .mts extension as an import it must resolve.
await import(new URL("./hide-duplicates.mts", import.meta.url).href);
process.exit = exit;
const rows = await db<{ id: number; hidden: boolean }>(`select id, hidden from calls where chat_id = $1 order by id`, [chat]);
console.log(rows.map((r) => `#${r.id} hidden=${r.hidden}`).join(" · "), `(want #${first} hidden, #${second} and #${lone} visible)`);
process.exit(0);
