// CS2 calls against Polymarket through Tatum's Prediction Market API: which upcoming match a
// call maps to, what the market gives the pick, and how a resolved match reads back.
//   npx tsx --env-file=.env.local scripts/try-polymarket.mts [team] [opponent]
import { findMatch, marketWinner } from "../src/lib/polymarket";

const tomorrow = new Date(Date.now() + 86_400_000);
const pairs: [string, string][] = process.argv[3] ? [[process.argv[2], process.argv[3]]] : [["MOUZ", "FURIA"], ["FaZe", "B8"], ["NaVi", "FaZe"], ["Astralis", "Eternal Fire"]];

for (const [team, opponent] of pairs) {
  const m = await findMatch(team, opponent, tomorrow);
  console.log(`${team} over ${opponent}:`, m ? `${m.outcome} ${Math.round(m.prob * 100)}% · ${m.title} · ${m.url}` : "no Polymarket match");
}
// A match that's already been played: FaZe vs NAVI Junior, 10 Oct 2026 (FaZe won the series).
console.log("resolved match winner:", await marketWinner("0xe632c7e6ce5aa9a601565dedefdfcc95b0026378fa6a5937d3128f06c57fc158"));
process.exit(0);
