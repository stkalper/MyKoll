// Following a Polymarket trader, on the local database with Polymarket's live data and Telegram
// faked: a profile link follows them, their recent $500+ bets become receipts, a bet on a market
// that has resolved settles, and their record by kind of bet comes out. Walrus Memory is off.
//   npx tsx --env-file=.env.local scripts/try-traders.mts [@name]
import "./local-db.mts";
delete process.env.MEMWAL_PRIVATE_KEY;
const { announceBets, createBot } = await import("../src/lib/bot");
const { resolveDue } = await import("../src/lib/calls");
const { db } = await import("../src/lib/db");
const { trackRecordOf } = await import("../src/lib/learning");
const { categoryOf, findTrader, notABet, profileLinkIn, traderId } = await import("../src/lib/traders");
type CallRow = import("../src/lib/calls").CallRow;

const handle = process.argv[2]?.replace(/^@/, "") ?? "fred4332";
const chat = { id: -1000000777005, type: "group" as const, title: "Trader test chat" };
const me = { id: 999000222, is_bot: false, first_name: "Test", username: "follow_test" };

console.log("links:", [
  profileLinkIn("look https://polymarket.com/@fred4332?tab=activity"),
  profileLinkIn("polymarket.com/profile/0x301E286fd88abb7cda0a19a24e4dc4823c4db752"),
  profileLinkIn("https://polymarket.com/event/some-market"),
  profileLinkIn("follow polymarket.com/@fred4332."),
], "(want fred4332, the wallet, null, fred4332)");
console.log("categories:", categoryOf(["crypto", "ethereum"]), categoryOf(["politics", "elections"]), categoryOf(["esports", "counter-strike-2"]), categoryOf(["sports", "soccer"]));
console.log("not a bet:", [
  notABet({ cash: 400, shares: 1000, first_at: 0 }, { category: "crypto", closed: false, endDate: null }),
  notABet({ cash: 900, shares: 1000, first_at: 0 }, { category: "politics", closed: false, endDate: null }),
  notABet({ cash: 900, shares: 3000, first_at: 0 }, { category: null, closed: false, endDate: null }),
  notABet({ cash: 900, shares: 3000, first_at: 0 }, { category: "crypto", closed: false, endDate: new Date(600_000) }),
  notABet({ cash: 900, shares: 3000, first_at: 0 }, { category: "cs2", closed: false, endDate: null }),
], "(want under the stake, already decided, not a CS2…, settles within the hour, null)");

const trader = await findTrader({ handle });
console.log("trader:", trader);
if (!trader) process.exit(1);

// Telegram faked: every message the bot would send is collected.
const bot = createBot();
bot.botInfo = { id: 1, is_bot: true, first_name: "MyKoll", username: "mykoll_bot" } as typeof bot.botInfo;
const sent: { method: string; text?: string; buttons?: string[] }[] = [];
bot.api.config.use(async (_prev, method, payload) => {
  const p = payload as { text?: string; reply_markup?: { inline_keyboard?: { text: string }[][] } };
  sent.push({ method, text: p.text, buttons: p.reply_markup?.inline_keyboard?.flat().map((b) => b.text) });
  return { ok: true, result: method === "getChatMember" ? { status: "member", user: me } : { message_id: sent.length, date: 0, chat, text: "" } } as never;
});
let update = Math.floor(Date.now() / 1000);
const say = (text: string) => {
  const command = text.match(/^\/\w+/)?.[0];
  const entities = command ? [{ type: "bot_command" as const, offset: 0, length: command.length }] : undefined;
  return bot.handleUpdate({ update_id: update++, message: { message_id: update, date: Math.floor(Date.now() / 1000), chat, from: me, text, entities } });
};

const author = traderId(trader.wallet);
await db(`delete from calls where chat_id = $1`, [chat.id]);
await db(`delete from track_records where chat_id = $1`, [chat.id]);
await db(`delete from trader_follows where chat_id = $1`, [chat.id]);
await db(`delete from trader_positions where wallet = $1`, [trader.wallet]);

await say(`this guy is good https://polymarket.com/@${handle}`);
console.log("\n--- follow card ---\n" + sent.filter((s) => s.method === "sendMessage").map((s) => `${s.text}\n[${s.buttons?.join(" | ")}]`).join("\n"));
sent.length = 0;
await say(`https://polymarket.com/@${handle}`);
console.log("\nagain:", sent.find((s) => s.method === "sendMessage")?.text?.split("\n")[0], "(want Already following)");

// Read from two days back instead of from now, so the run has real bets to post.
await db(`update traders set seen_until = extract(epoch from now() - interval '2 days')::bigint where wallet = $1`, [trader.wallet]);
sent.length = 0;
await announceBets(bot);
const posts = sent.filter((s) => s.method === "sendMessage");
console.log(`\n--- ${posts.length} messages from the sweep ---`);
for (const s of posts.slice(0, 4)) console.log(`${s.text}\n[${s.buttons?.join(" | ")}]\n`);
const skipped = await db<{ skipped: string; n: number }>(`select coalesce(skipped, case when posted then 'posted' else 'under the stake' end) as skipped, count(*)::int as n from trader_positions where wallet = $1 group by 1`, [trader.wallet]);
console.log("positions:", skipped);
const logged = await db<CallRow>(`select * from calls where chat_id = $1 and author_id = $2 order by id`, [chat.id, author]);
console.log("logged:", logged.map((c) => `#${c.id} ${c.market} ${c.subject} · ${c.quote.slice(0, 50)} · $${c.market_ref?.stake} @ ${c.market_ref?.prob.toFixed(2)} · ${c.market_ref?.category} · due ${new Date(c.deadline).toISOString().slice(0, 16)}`));

sent.length = 0;
await announceBets(bot);
console.log("second sweep posts:", sent.filter((s) => s.method === "sendMessage").length, "(want 0: nothing new, nothing twice)");

// A bet on a market that has already resolved settles from Polymarket, with the record after it.
const resolved = await fetch(`https://data-api.polymarket.com/v2/trades?user=${trader.wallet}&side=BUY&filter_type=CASH&filter_amount=200&end=${Math.floor(Date.now() / 1000) - 3 * 86_400}&limit=50`)
  .then((r) => r.json() as Promise<{ data: { condition_id: string; outcome: string; price: number; size: number; title: string; slug: string; event_slug: string; timestamp: number }[] }>)
  .then((r) => r.data.filter((t) => /up or down|above|price/i.test(t.title)).slice(0, 4));
for (const t of resolved) {
  const ref = { platform: "polymarket", eventId: "", marketId: t.condition_id, title: t.title, url: `https://polymarket.com/event/${t.event_slug}`, outcome: t.outcome, prob: t.price, direct: true, category: "crypto", stake: Math.round(t.size * t.price), tx: "0x0" };
  await db(
    `insert into calls (chat_id, author_id, author_name, market, subject, direction, market_ref, quote, made_at, deadline, source, shared_by_id)
     values ($1, $2, $3, 'polymarket', $4, 'win', $5, $6, to_timestamp($7), now() - interval '1 hour', $8, $9)`,
    [chat.id, author, `${trader.name} on Polymarket`, t.outcome, JSON.stringify(ref), t.title, t.timestamp, JSON.stringify({ kind: "polymarket", url: trader.url, handle: trader.name, wallet: trader.wallet, postedAt: new Date(t.timestamp * 1000).toISOString(), sharedBy: { id: me.id, name: "@follow_test" } }), me.id],
  );
}
const settled = (await resolveDue()).filter((r) => String(r.call.author_id) === String(author));
console.log("\nsettled:", settled.map((r) => `#${r.call.id} ${r.call.subject} on "${r.call.quote.slice(0, 45)}" → ${r.call.status}: ${r.call.result_note}`));
const record = trackRecordOf(await db<CallRow>(`select * from calls where chat_id = $1 and author_id = $2 and status in ('win', 'loss') order by resolved_at`, [chat.id, author]));
console.log("record:", record?.summary, "\nsegments:", record?.segments.map((s) => `${s.segment} ${s.hits}/${s.calls}`).join(" · "));

sent.length = 0;
await say("/following");
console.log("\n/following:", sent.find((s) => s.method === "sendMessage")?.text);

await db(`delete from calls where chat_id = $1`, [chat.id]);
await db(`delete from track_records where chat_id = $1`, [chat.id]);
await db(`delete from trader_follows where chat_id = $1`, [chat.id]);
process.exit(0);
