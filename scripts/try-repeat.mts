// Nothing gets logged twice: a repeat delivery of an update, or the same call sent again, on the local database.
//   npx tsx --env-file=.env.local scripts/try-repeat.mts
import "./local-db.mts";
import { firstDelivery } from "../src/lib/bot";
import { justLogged } from "../src/lib/calls";
import { db } from "../src/lib/db";

const id = Date.now();
console.log("first:", await firstDelivery(id), "· repeat:", await firstDelivery(id), "· next update:", await firstDelivery(id + 1));

const chat = -1000000000006;
const draft = { market: "crypto", subject: "BNB", opponent: null, direction: "above", target: 705, quote: "bnb 705 in 3 hours" } as const;
const before = await justLogged(chat, 601, draft);
const [row] = await db<{ id: number }>(
  `insert into calls (chat_id, author_id, author_name, market, subject, direction, target, entry_price, quote, deadline)
   values ($1, 601, '@repeat_test', 'crypto', 'BNB', 'above', 705, 703, $2, now() + interval '3 hours') returning id`,
  [chat, draft.quote],
);
console.log("before it's logged:", before, "· sent again:", (await justLogged(chat, 601, draft)) === row.id);
console.log("someone else:", await justLogged(chat, 602, draft), "· another level:", await justLogged(chat, 601, { ...draft, target: 710 }), "· another chat:", await justLogged(chat - 1, 601, draft));
await db(`update calls set made_at = now() - interval '11 minutes' where id = $1`, [row.id]);
console.log("11 minutes later:", await justLogged(chat, 601, draft));
process.exit(0);
