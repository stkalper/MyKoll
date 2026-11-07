// Quick check of call extraction: npx tsx --env-file=.env.local scripts/try-extract.mts
import { existsSync, readFileSync } from "node:fs";
import { extractCall, mightBeCall } from "../src/lib/calls";

function local(): string[] {
  const file = new URL("./samples.local.txt", import.meta.url);
  return existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
}

const samples = [
  "SUI to $5 by Friday",
  "sol looks good ngl",
  "who's watching the major tonight?",
  "eth up by tomorrow evening",
  "Spirit beat Vitality, easy",
  "NVDA under 200 by end of month",
  "PONS to 50 cents this week",
  "TRX long, entry 0.33, TP 0.36, SL 0.31",
  "btc 70k tomorrow",
  // More, in Ukrainian and Russian, from a local file kept out of the repository (one per line).
  ...local(),
];
for (const s of samples) {
  const pre = mightBeCall(s);
  const r = pre ? await extractCall(s) : null;
  if (r && "picks" in r) {
    console.log("?", JSON.stringify(s), "=>", r.picks.map((p) => `${p.subject} vs ${p.opponent}`).join(", "), r.skipped.length ? `· left out: ${r.skipped.join("; ")}` : "");
    continue;
  }
  const d = r && !("reason" in r) ? r : null;
  console.log(pre ? "?" : "-", JSON.stringify(s), "=>", d ? `${d.market} ${d.subject}${d.opponent ? " vs " + d.opponent : ""} ${d.direction} ${d.target ?? ""} by ${d.deadline}` : "no call");
  if (d && (d.quote !== s || d.why)) console.log("    quote:", JSON.stringify(d.quote), "· why:", JSON.stringify(d.why));
}
