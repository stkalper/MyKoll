// Where the time goes between a message and the bot's reply: each step of the path on its own,
// against the same LLM, Tatum and Walrus Memory as production (local database).
//   npx tsx --env-file=.env.local scripts/try-timing.mts
import "./local-db.mts";
import { extractCall, logCall, type Draft } from "../src/lib/calls";
import { db } from "../src/lib/db";
import { habitFor, misreadsLike } from "../src/lib/habits";
import { noteForNewCall } from "../src/lib/learning";
import { recall, remember } from "../src/lib/memory";
import { quote } from "../src/lib/tatum";

const chat = { id: -1000000000006, title: "Timing test" };
const time = async <T,>(label: string, fn: () => Promise<T>): Promise<T> => {
  const t = performance.now();
  const out = await fn();
  console.log(`${label.padEnd(34)} ${Math.round(performance.now() - t).toString().padStart(6)} ms`);
  return out;
};

await time("database connect + schema", () => db("select 1"));
const draft = (await time("LLM: extract the call", () => extractCall("TRX long, entry 0.33, TP 0.36"))) as Draft;
await time("habits (database)", () => habitFor(chat.id, 1));
await time("misreads (skipped: no 'not a call')", () => misreadsLike(chat.id, { id: 1, name: "@t" }, draft));
await time("price (Tatum Price API)", () => quote("TRX"));
await time("price (Tatum Sui gRPC)", () => quote("WAL"));
await time("Walrus remember (queue a write)", () => remember(chat.id, "[TIMING] test entry"));
await time("Walrus recall", () => recall(chat.id, "TRX long", 8));
const call = await time("logCall (all of it)", () => logCall(chat, { id: 1, name: "@t" }, draft));
if (!("error" in call)) await time("learning note for the receipt", () => noteForNewCall(call));
process.exit(0);
