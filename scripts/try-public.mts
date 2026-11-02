// A chat's public file, on the local database: private by default, forged links refused, no one's own file in it.
//   npx tsx --env-file=.env.local scripts/try-public.mts
import "./local-db.mts";
import { setChatPublic, touchChat } from "../src/lib/calls";
import { fileUrl } from "../src/lib/receipts";
import { GET } from "../src/app/api/app/board/route";

const chat = -1000000777001;
await touchChat(chat, "Public file test");
const slug = new URL(fileUrl(chat)).searchParams.get("file")!;
const ask = async (file: string) => {
  const res = await GET(new Request(`http://local/api/app/board?file=${encodeURIComponent(file)}`));
  return { status: res.status, body: await res.json() };
};

await setChatPublic(chat, false);
console.log("private:", (await ask(slug)).status, "(want 404)");
await setChatPublic(chat, true);
const open = await ask(slug);
console.log("public:", open.status, "(want 200) · me:", open.body.me, "· mine:", open.body.mine?.length, "· title:", open.body.chat?.title);
console.log("forged:", (await ask(slug.replace(/.$/, (c) => (c === "0" ? "1" : "0")))).status, "(want 404)");
console.log("other chat, same sig:", (await ask(slug.replace("777001", "777002"))).status, "(want 404)");
await setChatPublic(chat, false);
console.log("private again:", (await ask(slug)).status, "(want 404)");
process.exit(0);
