// Starts the production deployment's checks right after a deploy. Queue messages stay with the
// deployment that sent them, so a new one has none until something runs in it. Settles and posts
// whatever is due, as the daily cron does, but never the weekly digest. `npm run deploy` runs this.
//   npx tsx --env-file=.env.local scripts/kick.mts
const res = await fetch("https://mykoll.vercel.app/api/cron/resolve?noDigest", {
  headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  signal: AbortSignal.timeout(120_000),
});
console.log("kick:", res.status, await res.text());
process.exit(res.ok ? 0 : 1);
