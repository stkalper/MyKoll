// Messages through the call filter and extraction, as the bot reads them. No DB.
//   npx tsx --env-file=.env.local scripts/try-one.mts ["message" ...]
import "./local-db.mts";
import { extractCall, mightBeCallNow } from "../src/lib/calls";

const samples = process.argv.length > 2
  ? process.argv.slice(2)
  : ["Legacy, mongolz, mouz", "наві віталіті", "mouz і legacy", "navi vs faze", "mongolz хто грає завтра?", "mouz or legacy?"];
for (const text of samples) {
  const pre = await mightBeCallNow(text);
  const r = pre ? await extractCall(text) : null;
  const shown = !r ? "no call" : "picks" in r ? `slate: ${r.picks.map((p) => `${p.subject} vs ${p.opponent}`).join(", ")}${r.skipped.length ? ` · left out: ${r.skipped.join("; ")}` : ""}` : "reason" in r ? `unplaced: ${r.reason}` : `${r.subject} vs ${r.opponent} ${r.direction}`;
  console.log(pre ? "?" : "-", JSON.stringify(text), "=>", shown);
}
process.exit(0);
