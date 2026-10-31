// A repeat delivery of a Telegram update is skipped, on the local database.
//   npx tsx --env-file=.env.local scripts/try-repeat.mts
import "./local-db.mts";
import { firstDelivery } from "../src/lib/bot";

const id = Date.now();
console.log("first:", await firstDelivery(id), "· repeat:", await firstDelivery(id), "· next update:", await firstDelivery(id + 1));
process.exit(0);
