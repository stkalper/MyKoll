// The prices calls are judged by, where each comes from, and the proof behind on-chain ones.
//   npx tsx --env-file=.env.local scripts/try-prices.mts
import { proofUrl } from "../src/lib/suiPrices";
import { gap, quote } from "../src/lib/tatum";

for (const symbol of ["BTC", "SUI", "WAL", "DEEP"]) {
  const q = await quote(symbol);
  if (!q) {
    console.log(symbol, "no price");
    continue;
  }
  console.log(`${symbol}: $${q.price.toPrecision(5)} from ${q.source}`);
  if (q.check) console.log(`  Price API: $${q.check.toPrecision(5)}, ${(gap(q.price, q.check) * 100).toFixed(2)}% apart`);
  for (const read of q.proof ?? []) console.log(`  pool ${read.pool.slice(0, 10)}… v${read.version} → ${proofUrl(read)}`);
}
process.exit(0);
