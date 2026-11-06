// Logs a map-score pick and a pick that waits for its match on the local database, then runs a
// sweep: the score pick gets its odds, the waiting one gets matched once Polymarket lists a match.
// No Walrus writes: the MemWal key is unset before the app's config loads.
import "./local-db.mts";
delete process.env.MEMWAL_PRIVATE_KEY;

const { extractCall, logCall, resolveDue, claim } = await import("../src/lib/calls");
const { db } = await import("../src/lib/db");
const chat = { id: -424242, title: "score/wait test" };
const me = { id: 4242, name: "@tester" };

for (const text of ["фут 2:0", "spirit 2-1", "ставлю на fokus"]) {
  const draft = await extractCall(text);
  if (!draft || "reason" in draft || "picks" in draft) {
    console.log(text, "→", draft);
    continue;
  }
  const call = await logCall(chat, me, draft);
  if ("error" in call) console.log(text, "→ error", call.error);
  else console.log(`#${call.id}`, JSON.stringify(text), "→", claim(call), "| odds", call.market_ref?.prob?.toFixed(3) ?? "-", "| waiting", call.waiting, "|", call.result_note ?? "");
}

// Pretend the FOKUS pick was made while nothing was listed, and a match of FUT's is listed now.
await db(`update calls set subject = 'FUT Esports' where chat_id = $1 and waiting`, [chat.id]);
const out = await resolveDue();
for (const r of out.filter((r) => String(r.call.chat_id) === String(chat.id)))
  console.log("sweep:", r.placed ? "PLACED" : r.dropped ? "DROPPED" : r.call.status, `#${r.call.id}`, claim(r.call), "| late", r.call.market_ref?.late ?? false, "| odds", r.call.market_ref?.prob);
await db(`delete from calls where chat_id = $1`, [chat.id]);
process.exit(0);
