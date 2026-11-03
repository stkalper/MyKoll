// The live numbers docs/blog.md quotes in [brackets], read from the public endpoints (no DB, no keys).
//   npx tsx scripts/blog-numbers.mts
const SITE = "https://mykoll.vercel.app";
const FILE = "-5318326021_0662615677bc";

const stats = await (await fetch(`${SITE}/api/stats`)).json();
const file = await (await fetch(`${SITE}/api/app/board?file=${FILE}`)).json();
const check = stats.memoryCheck;

console.log("Across all chats");
console.log(`  groups ${stats.groups} · calls ${stats.calls} · settled ${stats.settled} · memories ${stats.memories}`);
console.log(`  Memory Check: ${check.calls} calls, memory ${check.brierMemory?.toFixed(3)} vs forgetful ${check.brierForgetful}`);
console.log(`  weak spots ${check.spots.weak.hits}/${check.spots.weak.calls} · strong spots ${check.spots.strong.hits}/${check.spots.strong.calls} · no flag ${check.spots.none.hits}/${check.spots.none.calls}`);
console.log(`  memory effects: ${JSON.stringify(stats.memoryEffects)}`);

console.log(`\nThe public chat: ${file.chat?.title}`);
const effects = (file.memoryEffects ?? []) as { kind: string }[];
const byKind = effects.reduce<Record<string, number>>((m, e) => ((m[e.kind] = (m[e.kind] ?? 0) + 1), m), {});
console.log(`  effects listed: ${effects.length} ${JSON.stringify(byKind)} (the feed shows the latest only)`);
for (const market of ["crypto", "cs2"] as const) {
  for (const s of file.boards?.[market] ?? []) {
    console.log(`  ${market} ${s.name} ${s.hits}/${s.calls}${s.vsMarket !== undefined ? ` · ${s.vsMarket} pts vs Polymarket` : ""}${s.insight ? ` · ${s.insight}` : ""}`);
  }
}
