// End-to-end without Telegram: log calls, settle them, ask the memory.
//   npx tsx --env-file=.env.local scripts/try-flow.mts
import "./local-db.mts";
import { answer } from "../src/lib/ask";
import { extractCall, leaderboard, logCall, resolveDue } from "../src/lib/calls";
import { db } from "../src/lib/db";

const chat = { id: -1000000000001, title: "Receipts test chat" };
const ivan = { id: 111, name: "@ivan_test" };

for (const text of ["SUI to $5 by Friday", "BTC up by tomorrow evening"]) {
  const draft = await extractCall(text);
  const call = draft && !("reason" in draft) && !("picks" in draft) && (await logCall(chat, ivan, draft));
  console.log("logged:", call && !("error" in call) ? `#${call.id} ${call.subject} ${call.direction} entry=${call.entry_price}` : call);
}

// Pretend the BTC deadline has passed and settle it.
await db(`update calls set deadline = now() - interval '1 minute' where chat_id = $1 and subject = 'BTC' and status = 'open'`, [chat.id]);
const settled = await resolveDue();
console.log("settled:", settled.map((r) => `#${r.call.id} ${r.call.status} (${r.call.result_note})`));
console.log("board:", await leaderboard(chat.id, "crypto"));

// Walrus writes are asynchronous; give the relayer a moment before asking.
await new Promise((r) => setTimeout(r, 20_000));
console.log("ask:", await answer(chat.id, "що Іван казав про SUI?"));
process.exit(0);
