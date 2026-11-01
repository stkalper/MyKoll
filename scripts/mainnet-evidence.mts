// Prints the README's mainnet evidence from the database named by .env.local (production): which
// source priced the calls, and recent calls with the Walrus blob and the on-chain read behind them.
// Reads only: a read-only transaction, and it skips src/lib/db.ts, which would apply the schema.
// No names or quotes, only public ids.
//   npx tsx --env-file=.env.local scripts/mainnet-evidence.mts
import { neon } from "@neondatabase/serverless";
import { config } from "../src/lib/config";
import { sealedBlobs } from "../src/lib/memory";
import { blobUrl, proofUrl, type PoolRead } from "../src/lib/proof";

const sql = neon(config.databaseUrl);
const [sources, onchain, recent] = await sql.transaction(
  (tx) => [
    tx.query(`select coalesce(price_source, 'polymarket or score') as source, count(*)::int as n from calls where not hidden group by 1 order by 2 desc`),
    tx.query(`select id, to_char(made_at, 'YYYY-MM-DD') as day, price_source, entry_proof, memory_job from calls where not hidden and entry_proof is not null order by id desc limit 8`),
    tx.query(`select id, to_char(made_at, 'YYYY-MM-DD') as day, price_source, entry_proof, memory_job from calls where not hidden and memory_job is not null order by id desc limit 6`),
  ],
  { readOnly: true },
);

console.log("Priced by:", sources.map((s) => `${s.source} ${s.n}`).join(", "));
const rows = [...new Map([...onchain, ...recent].map((r) => [r.id, r])).values()].sort((a, b) => b.id - a.id);
const blobs = await sealedBlobs(rows.map((r) => r.memory_job).filter(Boolean));
console.log("\n| Call | Date | Price source | On-chain read | Walrus blob |\n|---|---|---|---|---|");
for (const r of rows) {
  const read = (r.entry_proof as PoolRead[] | null)?.[0];
  const blob = r.memory_job ? blobs.get(r.memory_job) : null;
  console.log(`| #${r.id} | ${r.day} | ${r.price_source ?? "-"} | ${read ? `[${read.tx?.slice(0, 10) ?? `block ${read.block}`}](${proofUrl(read)})` : "-"} | ${blob ? `[${blob.slice(0, 10)}](${blobUrl(blob)})` : "-"} |`);
}
process.exit(0);
