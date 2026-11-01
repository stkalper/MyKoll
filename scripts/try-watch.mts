// The price check between sweeps, against live Tatum prices and without the database.
//   npx tsx --env-file=.env.local scripts/try-watch.mts
import { anyTargetReached } from "../src/lib/calls";

console.log("BNB above 1:", await anyTargetReached([{ subject: "BNB", direction: "above", target: 1 }]));
console.log("BNB above 1,000,000:", await anyTargetReached([{ subject: "BNB", direction: "above", target: 1_000_000 }]));
console.log("BNB below 1:", await anyTargetReached([{ subject: "BNB", direction: "below", target: 1 }]));
console.log("WAL (on-chain) above 0.000001:", await anyTargetReached([{ subject: "WAL", direction: "above", target: 0.000001 }]));
console.log("one of several:", await anyTargetReached([{ subject: "BTC", direction: "above", target: 1_000_000 }, { subject: "ETH", direction: "above", target: 1 }]));
console.log("unknown coin:", await anyTargetReached([{ subject: "NOSUCHCOINX", direction: "above", target: 1 }]));
process.exit(0);
