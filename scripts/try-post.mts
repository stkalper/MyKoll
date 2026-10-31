// Reads posts the way the bot does and shows the call it would log from each, without the database.
//   npx tsx --env-file=.env.local scripts/try-post.mts <link> [link ...]
import { extractCall } from "../src/lib/calls";
import { postLinkIn, readPost } from "../src/lib/posts";

for (const url of process.argv.slice(2)) {
  const link = postLinkIn(url);
  const post = link && (await readPost(link));
  if (!post) {
    console.log("\n" + url, "=> unreadable");
    continue;
  }
  console.log("\n" + url, "·", post.postedAt.toISOString(), "\n ", post.text.replace(/\s+/g, " ").slice(0, 220));
  const r = await extractCall(post.text, post.postedAt);
  const out = !r ? "no call" : "picks" in r ? r.picks.map((p) => `${p.subject} vs ${p.opponent} by ${p.deadline}`).join(", ") : "reason" in r ? `unplaced: ${r.reason}` : `${r.market} ${r.subject} ${r.direction} ${r.target ?? ""}${r.targetPct ? ` (${r.targetPct}%)` : ""} by ${r.deadline}`;
  console.log("  =>", out);
}
process.exit(0);
