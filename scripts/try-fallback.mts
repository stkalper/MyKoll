// Every read the bot makes, with whatever Tatum answers right now: when it's out of credits, these
// come from the public endpoints. No database.
//   npx tsx --env-file=.env.local scripts/try-fallback.mts
import { tatumOut } from "../src/lib/fallback";
import { findMatch, listedTeams, marketWinner, nextMatch, startedMatch, upcomingCs2Matches } from "../src/lib/polymarket";
import { quote } from "../src/lib/tatum";

const time = async <T,>(what: string, read: () => Promise<T>) => {
  const start = Date.now();
  const value = await read().catch((err) => `FAILED ${err}`);
  console.log(`${what} (${Date.now() - start} ms):`, value);
  return value;
};

for (const symbol of ["BTC", "BNB", "TRX", "SUI", "WAL", "DEEP", "TSLA", "PONS", "NOSUCHCOINX"])
  await time(symbol, async () => {
    const q = await quote(symbol);
    return q && { price: q.price, source: q.source, proof: q.proof?.[0]?.tx ?? q.proof?.[0]?.block, check: q.check };
  });

console.log("tatum out:", tatumOut());
await time("upcoming CS2 matches", upcomingCs2Matches);
await time("teams listed", async () => (await listedTeams()).size);
await time("next match, mongolz", () => nextMatch("mongolz"));
await time("next match, furia", () => nextMatch("furia"));
await time("playing now, mongolz", () => startedMatch("mongolz"));
const market = (await time("market, mongolz vs legacy", () => findMatch("TheMongolz", "Legacy", new Date(Date.now() + 2 * 86_400_000))));
if (market && typeof market === "object") await time("its winner so far", () => marketWinner(market.marketId));
await time("a finished match (FaZe vs NAVI Junior)", () => marketWinner("0xe632c7e6ce5aa9a601565dedefdfcc95b0026378fa6a5937d3128f06c57fc158"));
process.exit(0);
