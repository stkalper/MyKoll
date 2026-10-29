// Checks the pinned Robinhood Chain pools: the price read from each over Tatum's RPC next to
// the market price DexScreener shows for that exact token address, so a wrong pin, a copycat
// token or wrong decimals show up as a mismatch.
//   npx tsx --env-file=.env.local scripts/try-robinhood.mts
import { proofUrl } from "../src/lib/proof";
import { robinhoodQuote, robinhoodTokens } from "../src/lib/robinhoodPrices";

for (const t of robinhoodTokens()) {
  const q = await robinhoodQuote(t.symbol);
  const pairs = (await fetch(`https://api.dexscreener.com/tokens/v1/robinhood/${t.token}`).then((r) => r.json())) as { baseToken: { symbol: string; name: string }; priceUsd?: string }[];
  const market = Number(pairs.find((p) => p.priceUsd)?.priceUsd);
  const apart = q && market ? Math.abs(q.price - market) / market : NaN;
  const flag = apart > 0.03 ? "  ⚠️ check this pin" : "";
  console.log(`${t.symbol.padEnd(8)} on-chain $${q?.price.toPrecision(5).padEnd(9)} market $${String(market).padEnd(9)} ${(apart * 100).toFixed(2)}% · ${pairs[0]?.baseToken.name}${flag}`);
}
const tsla = await robinhoodQuote("TSLA");
if (tsla) console.log("block", tsla.reads[0].block, "proof link:", proofUrl(tsla.reads[0]));
process.exit(0);
