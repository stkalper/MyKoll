// Memory changing what the bot does, without Telegram: whom to trust on a shared call, and
// how answers to spotted calls change whether it asks.
//   DATABASE_URL= npx tsx --env-file=.env.local scripts/try-habits.mts
import { logCall, type CallRow, type Draft } from "../src/lib/calls";
import { db } from "../src/lib/db";
import { habitFor, misreadsLike, recordFeedback } from "../src/lib/habits";
import { learnFrom, noteForNewCall } from "../src/lib/learning";

const chat = { id: -1000000000000 - Math.floor(Math.random() * 1e6), title: "Habits test" };
const max = { id: 301, name: "@max_test" };
const ivan = { id: 302, name: "@ivan_test" };
const ola = { id: 303, name: "@ola_test" };
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const draft = (subject: string, direction: Draft["direction"], target: number | null, quote: string): Draft => ({
  market: "crypto", subject, opponent: null, direction, target, deadline: inDays(3), quote,
});

async function settled(author: typeof max, d: Draft, outcome: "win" | "loss") {
  const call = await logCall(chat, author, d);
  if ("error" in call) throw new Error(call.error);
  const [row] = await db<CallRow>(`update calls set status = $2, resolved_at = now(), result_note = 'test' where id = $1 returning *`, [call.id, outcome]);
  await learnFrom(row);
}

// Max has been right on SUI, Ivan wrong.
for (let i = 0; i < 3; i++) await settled(max, draft("SUI", "up", null, `SUI up #${i}`), "win");
for (let i = 0; i < 3; i++) await settled(ivan, draft("SUI", "up", null, `SUI up #${i}`), "loss");

console.log("— whom to trust —");
await logCall(chat, max, draft("SUI", "up", null, "SUI green by Sunday"));
await logCall(chat, ivan, draft("SUI", "down", null, "SUI bleeds this week"));
const third = await logCall(chat, ola, draft("SUI", "down", null, "SUI dumps"));
if (!("error" in third)) console.log((await noteForNewCall(third)).join("\n"));

console.log("\n— habits —");
for (let i = 0; i < 3; i++) await recordFeedback(chat.id, ola, true, draft("SOL", "up", null, "x"));
console.log("after 3 confirms:", await habitFor(chat.id, ola.id));
await recordFeedback(chat.id, ola, false, draft("BTC", "below", 90000, "x"));
console.log("after one 'not a call':", await habitFor(chat.id, ola.id));
await recordFeedback(chat.id, ola, false, draft("BTC", "below", 85000, "x"));
console.log("after two:", await habitFor(chat.id, ola.id));

console.log("\n— misreads, recalled from Walrus Memory —");
const similar = draft("BTC", "below", 88000, "x");
const different = draft("SUI", "above", 5, "x");
for (let i = 0; i < 12; i++) {
  const n = await misreadsLike(chat.id, ola.name, similar);
  if (n >= 2) break;
  await new Promise((r) => setTimeout(r, 10_000));
}
console.log("like 'BTC below $88,000':", await misreadsLike(chat.id, ola.name, similar));
console.log("like 'SUI above $5':", await misreadsLike(chat.id, ola.name, different));
process.exit(0);
