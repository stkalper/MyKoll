// Prices a few coins (Binance first, then Hyperliquid, then CoinGecko while Tatum is out of credits)
// and runs messages on coins only Hyperliquid lists through the filter and the extractor.
//   npx tsx --env-file=.env.local scripts/try-hyperliquid.mts
import "./local-db.mts";
const { quote } = await import("../src/lib/tatum");
const { mightBeCallNow, extractCall } = await import("../src/lib/calls");

for (const coin of ["BTC", "HYPE", "FARTCOIN", "PURR", "PEPE", "KAITO", "VIRTUAL", "ZEREBRO"]) {
  const q = await quote(coin).catch((e) => String(e));
  console.log(coin.padEnd(9), typeof q === "object" && q ? `${q.price} · ${q.source}` : q);
}
for (const text of ["fartcoin 0.2 завтра", "purr до 0.15 до пятниці", "kaito pump to 2$ this week", "zerebro x2 incoming"]) {
  const maybe = await mightBeCallNow(text);
  const draft = maybe ? await extractCall(text) : null;
  console.log(JSON.stringify(text), "→ filter", maybe, "→", draft && "subject" in draft ? `${draft.subject} ${draft.direction} ${draft.target ?? draft.targetPct ?? ""}` : JSON.stringify(draft));
}
process.exit(0);
