// Quick check of call extraction: npx tsx --env-file=.env.local scripts/try-extract.mts
import { extractCall, mightBeCall } from "../src/lib/calls";

const samples = [
  "SUI to $5 by Friday",
  "біток впаде нижче 90к до неділі",
  "NaVi сьогодні рознесуть FaZe",
  "sol looks good ngl",
  "who's watching the major tonight?",
  "eth up by tomorrow evening",
  "Spirit beat Vitality, easy",
];
for (const s of samples) {
  const pre = mightBeCall(s);
  const d = pre ? await extractCall(s) : null;
  console.log(pre ? "?" : "-", JSON.stringify(s), "=>", d ? `${d.market} ${d.subject}${d.opponent ? " vs " + d.opponent : ""} ${d.direction} ${d.target ?? ""} by ${d.deadline}` : "no call");
}
