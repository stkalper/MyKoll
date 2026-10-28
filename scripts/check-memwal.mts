// Checks the Walrus Memory delegate key: npx tsx --env-file=.env.local scripts/check-memwal.mts
import { MemWal } from "@mysten-incubation/memwal";

const client = MemWal.create({
  key: process.env.MEMWAL_PRIVATE_KEY!,
  accountId: process.env.MEMWAL_ACCOUNT_ID!,
  serverUrl: process.env.MEMWAL_SERVER_URL,
});
console.log("agent public key:", await client.getPublicKeyHex());
console.log("health:", (await client.health()).status);
const r = await client.recall({ query: "SUI", limit: 1, namespace: "receipts:healthcheck" });
console.log("recall ok, results:", r.results.length);
