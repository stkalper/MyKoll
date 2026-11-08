// A call with no date ("SUI 5$"), on the local database: it gets a week; when the week runs out
// short of the level, the author is asked, can give it another week, or lets it go as missed.
//   npx tsx --env-file=.env.local scripts/try-undated.mts
import "./local-db.mts";
import { extendCall, extractCall, logCall, missCall, resolveDue, type CallRow, type Draft } from "../src/lib/calls";
import { db } from "../src/lib/db";

const chat = { id: -1000000777004, title: "Undated test chat" };
const ivan = { id: 111, name: "@ivan_test" };
await db(`delete from calls where chat_id = $1`, [chat.id]);

for (const text of ["Sui 5$", "eth 5000 soon", "btc at 80k lol"]) {
  const d = await extractCall(text);
  console.log(JSON.stringify(text), "→", d && !("reason" in d) && !("picks" in d) ? `${d.subject} ${d.direction} ${d.target}, undated: ${d.undated}` : d);
}

const draft = (await extractCall("Sui 5$")) as Draft;
const logged = (await logCall(chat, ivan, draft)) as CallRow;
console.log("logged:", `#${logged.id} ${logged.direction} ${logged.target}, undated ${logged.undated}, judged ${new Date(logged.deadline).toISOString()}`);

const weekUp = async () => {
  await db(`update calls set deadline = now() - interval '1 minute' where id = $1`, [logged.id]);
  return (await resolveDue()).find((r) => r.call.id === logged.id);
};

const first = await weekUp();
console.log("week up:", first?.askExtend ? `asked, price ${first.askExtend.price}, answer by ${first.call.extend_by}` : first, "(want asked)");
console.log("someone else:", (await extendCall(logged.id, 222)).message, "(want only the author)");
const extended = await extendCall(logged.id, ivan.id);
console.log("another week:", extended.message, "· judged", extended.call?.deadline, "· extended", extended.call?.extended, "(want 1)");

const second = await weekUp();
console.log("week up again:", second?.askExtend ? "asked" : second, "(want asked)");
const missed = await missCall(logged.id, ivan.id);
console.log("let go:", missed.message, "·", missed.call?.status, "·", missed.call?.result_note, "(want loss)");

// With no answer in time, it's missed on its own.
const again = (await logCall(chat, ivan, { ...draft, quote: "Sui 5$ (2)" })) as CallRow;
await db(`update calls set deadline = now() - interval '1 minute' where id = $1`, [again.id]);
await resolveDue();
await db(`update calls set extend_by = now() - interval '1 minute' where id = $1`, [again.id]);
const silent = (await resolveDue()).find((r) => r.call.id === again.id);
console.log("no answer:", silent?.call.status, "·", silent?.call.result_note, "(want loss)");

await db(`delete from calls where chat_id = $1`, [chat.id]);
process.exit(0);
