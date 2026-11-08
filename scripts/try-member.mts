// One member's file from a chat's public file, on the local database: their calls, hidden ones left out.
//   npx tsx --env-file=.env.local scripts/try-member.mts
import "./local-db.mts";
import { setChatPublic, touchChat } from "../src/lib/calls";
import { db } from "../src/lib/db";
import { fileUrl } from "../src/lib/receipts";
import { GET } from "../src/app/api/app/board/route";

const chat = -1000000777003;
await touchChat(chat, "Member file test");
await db(`delete from calls where chat_id = $1`, [chat]);
const add = (author: number, name: string, status: string, hidden = false) =>
  db(
    `insert into calls (chat_id, author_id, author_name, market, subject, direction, target, quote, deadline, status, hidden, resolved_at)
     values ($1, $2, $3, 'crypto', 'BTC', 'above', 100000, 'btc 100k', now(), $4, $5, now())`,
    [chat, author, name, status, hidden],
  );
await add(1, "@jake", "win");
await add(1, "@jake", "loss");
await add(1, "@jake", "win", true);
await add(2, "@max", "win");

const slug = new URL(fileUrl(chat)).searchParams.get("file")!;
const ask = async (member: string) => {
  const res = await GET(new Request(`http://local/api/app/board?file=${encodeURIComponent(slug)}&member=${encodeURIComponent(member)}`));
  return { status: res.status, body: await res.json() };
};

await setChatPublic(chat, true);
const jake = await ask("@jake");
console.log("@jake:", jake.status, "(want 200) · calls:", jake.body.calls?.length, "(want 2, the hidden one left out) · authors:", [...new Set(jake.body.calls?.map((c: { author: string }) => c.author))]);
console.log("nobody:", (await ask("@nobody")).status, "(want 404)");
await setChatPublic(chat, false);
console.log("private:", (await ask("@jake")).status, "(want 404)");
await db(`delete from calls where chat_id = $1`, [chat]);
process.exit(0);
