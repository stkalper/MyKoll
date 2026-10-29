// CS2 calls end to end on the local database: a call on an upcoming match picks up its
// Polymarket odds, and a call tied to an already-played match settles from Polymarket's result.
//   npx tsx --env-file=.env.local scripts/try-cs2.mts [team] [opponent]
import "./local-db.mts";
import { logCall, resolveDue, type CallRow } from "../src/lib/calls";
import { db } from "../src/lib/db";

const chat = { id: -1000000000005, title: "CS2 test" };
const [team, opponent] = process.argv[3] ? [process.argv[2], process.argv[3]] : ["MOUZ", "FURIA"];
const tomorrow = new Date(Date.now() + 86_400_000).toISOString();

const call = await logCall(chat, { id: 501, name: "@cs2_test" }, { market: "cs2", subject: team, opponent, direction: "win", target: null, deadline: tomorrow, quote: `${team} take it` });
console.log("upcoming match:", "error" in call ? call.error : call.market_ref ?? "no Polymarket match");

// FaZe vs NAVI Junior, 10 Oct 2026: Polymarket resolved the series to FaZe.
const [played] = await db<CallRow>(
  `insert into calls (chat_id, author_id, author_name, market, subject, opponent, direction, quote, deadline, market_ref)
   values ($1, 502, '@cs2_test2', 'cs2', 'FaZe', 'NAVI Junior', 'win', 'FaZe win', now() + interval '1 day', $2) returning *`,
  [chat.id, JSON.stringify({ platform: "polymarket", eventId: "1160505", marketId: "0xe632c7e6ce5aa9a601565dedefdfcc95b0026378fa6a5937d3128f06c57fc158", title: "", url: "", outcome: "FAZE", prob: 0.55 })],
);
const settled = (await resolveDue()).find((r) => r.call.id === played.id)?.call;
console.log("played match:", settled ? `${settled.status} · ${settled.result_note}` : "not settled");
process.exit(0);
