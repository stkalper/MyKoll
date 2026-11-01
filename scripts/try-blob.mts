// Queues one memory in a test namespace, waits for it to be sealed, and checks its explorer link.
// Writes to Walrus mainnet, but never to a real chat's namespace or to the database.
//   npx tsx --env-file=.env.local scripts/try-blob.mts
import { remember, sealedBlobs } from "../src/lib/memory";
import { blobUrl } from "../src/lib/proof";

const job = await remember(-1000000000007, `[TEST] blob link check ${new Date().toISOString()}`);
console.log("queued:", Boolean(job));
if (!job) process.exit(1);

for (let i = 0; i < 40; i++) {
  const blobs = await sealedBlobs([job]);
  const blob = blobs.get(job);
  if (blob) {
    const res = await fetch(blobUrl(blob), { signal: AbortSignal.timeout(15_000) });
    console.log(`sealed after ~${i * 5} s:`, blob, "· link", blobUrl(blob), res.status);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 5_000));
}
console.log("not sealed yet");
process.exit(1);
