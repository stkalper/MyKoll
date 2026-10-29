// How many memories each chat has on Walrus Memory (the landing page's live count reads the same).
//   npx tsx --env-file=.env.local scripts/check-namespaces.mts
import { MemWal } from "@mysten-incubation/memwal";
import { config } from "../src/lib/config";

const memwal = MemWal.create({ key: config.memwal.key, accountId: config.memwal.accountId, serverUrl: config.memwal.serverUrl });
let cursor: string | undefined;
do {
  const page = await memwal.listNamespaces({ cursor, limit: 500 });
  for (const n of page.namespaces) console.log(n.name.padEnd(40), String(n.memory_count).padStart(5), n.updated_at);
  cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined;
} while (cursor);
process.exit(0);
