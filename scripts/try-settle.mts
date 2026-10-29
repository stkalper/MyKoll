// Log an on-chain priced call, move its deadline into the past and settle it: both ends
// should carry the pool transaction they were priced from and the Price API cross-check.
//   npx tsx --env-file=.env.local scripts/try-settle.mts
import "./local-db.mts";
import { logCall, resolveDue, type CallRow } from "../src/lib/calls";
import { db } from "../src/lib/db";
import { toView } from "../src/lib/receipts";

const chat = { id: -1000000000004, title: "Settle test" };
const call = await logCall(chat, { id: 401, name: "@settle_test" }, {
  market: "crypto", subject: "SUI", opponent: null, direction: "up", target: null,
  deadline: new Date(Date.now() + 3_600_000).toISOString(), quote: "SUI up in an hour",
});
if ("error" in call) throw new Error(call.error);
console.log("logged:", { entry: call.entry_price, check: call.entry_check, proof: call.entry_proof?.map((p) => p.tx) });

await db(`update calls set deadline = now() - interval '1 minute' where id = $1`, [call.id]);
const settled = (await resolveDue()).find((r) => r.call.id === call.id)?.call;
const [row] = await db<CallRow>(`select * from calls where id = $1`, [call.id]);
console.log("settled:", { status: row.status, final: row.final_price, check: row.final_check, proof: row.final_proof?.map((p) => p.tx), viaResolve: Boolean(settled) });
console.log("view:", { proofUrl: toView(row, new Map()).proofUrl, check: toView(row, new Map()).check });
process.exit(0);
