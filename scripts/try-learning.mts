// The learning loop without Telegram: settle a few calls, then see what the bot says on the next one.
//   DATABASE_URL= npx tsx --env-file=.env.local scripts/try-learning.mts
import { logCall, type CallRow, type Draft } from "../src/lib/calls";
import { db } from "../src/lib/db";
import { computeTrackRecord, learnFrom, noteForNewCall } from "../src/lib/learning";

const chat = { id: -1000000000002, title: "Learning test" };
const ivan = { id: 222, name: "@ivan_test" };
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const draft = (subject: string, direction: Draft["direction"], target: number | null, quote: string): Draft => ({
  market: "crypto", subject, opponent: null, direction, target, deadline: inDays(3), quote,
});

const history: [Draft, "win" | "loss"][] = [
  [draft("WAL", "above", 0.05, "WAL to 5 cents by Friday"), "loss"],
  [draft("DEEP", "above", 0.03, "DEEP doubles this week"), "loss"],
  [draft("NS", "above", 0.02, "NS to 2 cents"), "loss"],
  [draft("BTC", "up", null, "BTC up by Sunday"), "win"],
  [draft("ETH", "up", null, "ETH green week"), "win"],
];
for (const [d, outcome] of history) {
  const call = await logCall(chat, ivan, d);
  if ("error" in call) throw new Error(call.error);
  const [row] = await db<CallRow>(`update calls set status = $2, resolved_at = now(), result_note = 'test' where id = $1 returning *`, [call.id, outcome]);
  await learnFrom(row);
}
console.log("record:", (await computeTrackRecord(chat.id, ivan.id))?.summary);

const next = await logCall(chat, ivan, draft("WAL", "above", 0.06, "WAL to 6 cents, for real this time"));
if (!("error" in next)) console.log("note on new WAL call:", await noteForNewCall(next));
const btc = await logCall(chat, ivan, draft("BTC", "up", null, "BTC up again"));
if (!("error" in btc)) console.log("note on new BTC call:", await noteForNewCall(btc));
process.exit(0);
