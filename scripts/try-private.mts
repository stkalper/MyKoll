// A call written to the bot in a private chat, through the real bot handler with Telegram faked,
// on the local database: it is logged right away into the member's own journal.
//   npx tsx --env-file=.env.local scripts/try-private.mts
import "./local-db.mts";
import { createBot } from "../src/lib/bot";
import { db } from "../src/lib/db";

const me = { id: 999000111, is_bot: false, first_name: "Test", username: "journal_test" };
const bot = createBot();
bot.botInfo = { id: 1, is_bot: true, first_name: "MyKoll", username: "mykoll_bot" } as typeof bot.botInfo;
const sent: { method: string; text?: string }[] = [];
bot.api.config.use(async (_prev, method, payload) => {
  sent.push({ method, text: (payload as { text?: string }).text });
  return { ok: true, result: { message_id: sent.length, date: 0, chat: { id: me.id, type: "private" }, text: "" } } as never;
});

await db(`delete from calls where chat_id = $1`, [me.id]);
let update = Math.floor(Date.now() / 1000);
const say = (text: string) =>
  bot.handleUpdate({ update_id: update++, message: { message_id: update, date: Math.floor(Date.now() / 1000), chat: { id: me.id, type: "private", first_name: "Test" }, from: me, text } });

await say("BTC 150k by Friday");
const [call] = await db<{ id: number; chat_title: string; subject: string; target: number }>(`select * from calls where chat_id = $1`, [me.id]);
console.log("logged:", call ? `#${call.id} ${call.subject} ${call.target} in "${call.chat_title}"` : "nothing", "(want BTC 150000 in \"Personal journal\")");
console.log("replied:", sent.filter((s) => s.method === "sendMessage").map((s) => s.text?.split("\n")[0]));

await db(`delete from calls where chat_id = $1`, [me.id]);
process.exit(0);
