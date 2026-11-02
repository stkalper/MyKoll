// Public receipt links for call ids, signed the way the bot signs them. No DB.
//   npx tsx --env-file=.env.local scripts/share-links.mts 37 38 41
import "./local-db.mts";
import { shareUrl } from "../src/lib/receipts";

for (const id of process.argv.slice(2).map(Number)) console.log(id, shareUrl(id));
process.exit(0);
