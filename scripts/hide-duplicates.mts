// Hides calls that were logged twice (Telegram redelivered the update), keeping the other copy, in
// the database named by .env.local (production). Only hides a call when a visible twin exists: same
// chat, author, claim and quote, under 10 minutes apart. Then works the author's record out again.
// Shows what it would do; pass --yes to do it.
//   npx tsx --env-file=.env.local scripts/hide-duplicates.mts 40 38          (dry run)
//   npx tsx --env-file=.env.local scripts/hide-duplicates.mts 40 38 --yes
import { db } from "../src/lib/db";
import { refreshRecord } from "../src/lib/learning";

const apply = process.argv.includes("--yes");
const ids = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
if (!ids.length) throw new Error("Which calls? e.g. scripts/hide-duplicates.mts 40 38");

for (const id of ids) {
  const [twin] = await db<{ id: number; chat_id: string; author_id: string; author_name: string; quote: string; hidden: boolean }>(
    `select b.id, a.chat_id, a.author_id, a.author_name, a.quote, a.hidden
       from calls a join calls b on b.id <> a.id and b.chat_id = a.chat_id and b.author_id = a.author_id and b.market = a.market
        and b.subject = a.subject and b.opponent is not distinct from a.opponent and b.direction = a.direction
        and b.target is not distinct from a.target and b.quote = a.quote and not b.hidden
        and abs(extract(epoch from b.made_at - a.made_at)) < 600
      where a.id = $1`,
    [id],
  );
  if (!twin) {
    console.log(`#${id}: no visible twin, left as it is`);
    continue;
  }
  if (twin.hidden) {
    console.log(`#${id}: already hidden`);
    continue;
  }
  console.log(`#${id}: ${twin.author_name} "${twin.quote.slice(0, 50)}" duplicates #${twin.id}${apply ? " → hiding it" : " (would hide it)"}`);
  if (!apply) continue;
  await db(`update calls set hidden = true where id = $1`, [id]);
  await refreshRecord(twin.chat_id, twin.author_id);
}
if (!apply) console.log("\nDry run. Add --yes to hide them.");
process.exit(0);
