// What the bot finds on Polymarket for one team: its listed and searched CS2 matches, the one on now, and the next.
//   npx tsx --env-file=.env.local scripts/try-team.mts <team>
import { listedTeams, nextMatch, startedMatch, startOf, teamKey, teamsOf } from "../src/lib/polymarket";
import { config } from "../src/lib/config";

const team = process.argv[2] ?? "mongolz";
console.log("key:", teamKey(team), "· listed:", (await listedTeams()).has(teamKey(team)));
for (const q of [`Counter-Strike: ${team}`, team]) {
  const r = await fetch(`https://api.tatum.io/v4/data/prediction/search?q=${encodeURIComponent(q)}`, { headers: { "x-api-key": config.tatum.apiKey } });
  const j = (await r.json()) as { data?: { events?: { id: string; title: string; status: string; closeTime: string; description?: string }[] } };
  console.log(`\nsearch "${q}":`);
  for (const e of j.data?.events ?? []) console.log(" ", e.status, startOf(e).toISOString(), e.title, teamsOf(e.title)?.map(teamKey));
}
console.log("\nstarted:", await startedMatch(team));
console.log("next:", await nextMatch(team));
process.exit(0);
