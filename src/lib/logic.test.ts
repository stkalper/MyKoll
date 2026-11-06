// The parts of the bot that decide things, tested without Telegram, a database or the network.
//   npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recallQuestion, shownMemory, sourcesText } from "./ask";
import { isOutOfCredits, tatumOr, tatumOut } from "./fallback";
import { claim, mightBeCall, reached, sideOf, teamsNamed, tickerOf, unknownNames, usd, type CallRow } from "./calls";
import { habitOf } from "./habits";
import { recordChanges, segmentsOf, trackRecordOf, trustOn } from "./learning";
import { fromGammaMarket, spellTeams, startOf, teamKey, teamsOf, winnerOf } from "./polymarket";
import { forwardedPost, justTheLink, postLinkIn, sourceId, sourceName } from "./posts";
import { sqrtPriceFromSlot0, uniswapPrice } from "./robinhoodPrices";
import { scorecardLine, scoreMemory } from "./scorecard";
import { poolPrice } from "./suiPrices";
import { gap } from "./tatum";

const DAY = 86_400_000;
const call = (over: Partial<CallRow>): CallRow =>
  ({
    id: 1, chat_id: "-1", chat_title: null, author_id: "7", author_name: "@jake", market: "crypto", subject: "SUI", opponent: null,
    direction: "up", target: null, entry_price: 1, quote: "", made_at: new Date(0), deadline: new Date(3 * DAY), status: "open",
    final_price: null, result_note: null, resolved_at: null, hidden: false, price_source: null, entry_proof: null, entry_check: null, final_proof: null, final_check: null, market_ref: null,
    ...over,
  }) as CallRow;

describe("spotting calls", () => {
  it("lets through predictions in English, Ukrainian and Russian", () => {
    for (const text of ["SUI to $5 by Friday", "btc dumps under 90k this week", "біток до 90к до неділі", "NaVi рознесуть FaZe сьогодні", "эфир упадет до 2000", "WAL 0.05 by friday", "тесла до 450 до пʼятниці", "PONS to 50 cents", "trx лонг", "TRX long, entry 0.33, TP 0.36", "трх шорт тейк 0.30", "сигнал по трону", "БТС 102к завтра", "СУІ вище 1 бакса через 5 годин", "BTC 102k tomorrow", "SUI above 1 buck in 5 hours", "sui over a dollar tomorrow", "суі вище бакса завтра", "изи для НАВІ завтра", "ставлю на віталіті проти спіріт", "vitality vs spirit, vitality", "Fnatic beat NIP", "фнатік фаворит", "наві, віталіті, мауз, фуріа", "NaVi Vitality MOUZ FURIA", "betting on fnatic", "+1 vitality", "ez fnatic"])
      assert.equal(mightBeCall(text), true, text);
  });
  it("skips chatter, commands and coins without a prediction", () => {
    for (const text of ["good morning everyone", "/call SUI to $5", "BTC", "lol", "дивимось наві ввечері?"]) assert.equal(mightBeCall(text), false, text);
  });
});

describe("signal posts", () => {
  it("lets through the shapes signal posts come in", () => {
    for (const text of ["$ASTERUSDT is going to explode from here", "$SNOW perfectly retested. Expecting to see a drop from here", "#BTC breakout incoming", "COIN: $LINK/USDT Direction: LONG", "Pick: NaVi ML @1.85 (2u)"])
      assert.equal(mightBeCall(text), true, text);
  });
  it("reads the coin out of pairs and tags", () => {
    for (const [raw, want] of [["$CHZUSDT", "CHZ"], ["SOL/USDT", "SOL"], ["ETH-PERP", "ETH"], ["#btc", "BTC"], ["BTCUSD", "BTC"], ["USDT", "USDT"], ["SUI", "SUI"]])
      assert.equal(tickerOf(raw), want, raw);
  });
  it("spells out a target given relative to the price", () => {
    assert.equal(claim({ ...call({ direction: "above", target: null, subject: "SOL" }), targetPct: 100 }), "SOL up 100%");
    assert.equal(claim({ ...call({ direction: "below", target: null, subject: "SOL" }), targetPct: -20 }), "SOL down 20%");
  });
});

describe("calls shared from posts", () => {
  it("finds links to posts on X and public Telegram channels", () => {
    assert.deepEqual(postLinkIn("look https://x.com/CryptoGuru/status/1985341984679469056?s=20"), {
      kind: "x", url: "https://x.com/CryptoGuru/status/1985341984679469056", handle: "CryptoGuru", id: "1985341984679469056",
    });
    assert.equal(postLinkIn("https://twitter.com/abc/status/123")?.kind, "x");
    assert.equal(postLinkIn("https://t.me/s/whale_alerts/4521")?.url, "https://t.me/whale_alerts/4521");
    assert.equal(postLinkIn("https://t.me/c/1234567/89"), null);
    assert.equal(postLinkIn("https://x.com/abc"), null);
  });
  it("tells a shared link from a link inside a longer message", () => {
    const link = postLinkIn("https://x.com/abc/status/123")!;
    assert.equal(justTheLink("https://x.com/abc/status/123", link), true);
    assert.equal(justTheLink("check this https://x.com/abc/status/123", link), true);
    assert.equal(justTheLink("he says btc goes to 120k, I think it dumps first https://x.com/abc/status/123", link), false);
  });
  it("reads a forwarded channel post as that channel's, timed when it was first posted", () => {
    const post = forwardedPost({ type: "channel", chat: { username: "wolfoftrading", title: "Wolf" }, message_id: 812, date: 1_793_000_000 }, "$CHZUSDT long, targets 0.0143");
    assert.equal(post?.url, "https://t.me/wolfoftrading/812");
    assert.equal(post?.handle, "wolfoftrading");
    assert.equal(post?.postedAt.getTime(), 1_793_000_000_000);
    const closed = forwardedPost({ type: "channel", chat: { title: "VIP Signals" }, message_id: 5, date: 1 }, "BTC 120k")!;
    assert.equal(closed.url, "");
    assert.equal(sourceName(closed), "VIP Signals on Telegram");
    assert.equal(forwardedPost({ type: "hidden_user", sender_user_name: "Max", date: 1 }, "  "), null);
  });
  it("gives each outside account one stable id, apart from Telegram users", () => {
    const id = sourceId({ kind: "x", handle: "CryptoGuru" });
    assert.equal(id, sourceId({ kind: "x", handle: "cryptoguru" }));
    assert.notEqual(id, sourceId({ kind: "telegram", handle: "cryptoguru" }));
    assert.ok(id < 0);
    assert.equal(sourceName({ kind: "x", handle: "CryptoGuru" }), "@CryptoGuru on X");
  });
});

describe("teams beyond the fixed list", () => {
  it("finds teams on Polymarket's current matches in a message", () => {
    const listed = new Set(["bcgame", "lynnvision", "metizport", "og"]);
    assert.deepEqual([...teamsNamed("easy for bcgame", listed).keys()], ["bcgame"]);
    assert.deepEqual([...teamsNamed("BC.Game Esports tonight", listed).keys()], ["bcgame"]);
    assert.deepEqual([...teamsNamed("Lynn Vision, Metizport", listed).keys()].sort(), ["lynnvision", "metizport"]);
    assert.deepEqual([...teamsNamed("og bro", listed).keys()], []);
  });
});

describe("describing calls", () => {
  it("spells out each kind of claim", () => {
    assert.equal(claim(call({ direction: "above", target: 90000, subject: "BTC" })), "BTC above $90,000");
    assert.equal(claim(call({ direction: "up", entry_price: 186.4, subject: "SOL" })), "SOL up from $186.40");
    assert.equal(claim(call({ market: "cs2", subject: "NaVi", opponent: "FaZe", direction: "win" })), "NaVi to beat FaZe");
    assert.equal(claim(call({ direction: "to", target: 102000, subject: "BTC" })), "BTC to $102,000");
  });
  it("reads a bare price level as up or down from where the price is now", () => {
    assert.equal(sideOf("to", 102000, 96000), "above");
    assert.equal(sideOf("to", 90000, 96000), "below");
    assert.equal(sideOf("below", 1, 0.5), "below");
  });
  it("formats small and large prices", () => {
    assert.equal(usd(81705.4), "$81,705");
    assert.equal(usd(0.0341), "$0.0341");
  });
});

describe("the learning loop", () => {
  it("files a call under its kinds", () => {
    assert.deepEqual(segmentsOf(call({ subject: "WAL", direction: "above", deadline: new Date(DAY / 2) })), [
      "crypto calls", "WAL calls", "Sui tokens", "bullish calls", "calls under a day",
    ]);
    assert.deepEqual(segmentsOf(call({ market: "cs2", subject: "NaVi" })), ["CS2 picks", "NaVi picks"]);
    assert.ok(segmentsOf(call({ subject: "TSLA" })).includes("stock tokens"));
    assert.ok(segmentsOf(call({ subject: "PONS" })).includes("Robinhood Chain memecoins"));
  });

  it("finds strengths and weaknesses once there are two calls of a kind", () => {
    const record = trackRecordOf([
      call({ subject: "WAL", status: "loss" }),
      call({ subject: "DEEP", status: "loss" }),
      call({ subject: "BTC", status: "win" }),
      call({ subject: "ETH", status: "win" }),
    ])!;
    assert.equal(record.hits, 2);
    assert.ok(record.strong.some((s) => s.segment === "majors"));
    assert.ok(record.weak.some((s) => s.segment === "Sui tokens"));
    assert.match(record.summary, /^@jake is 2\/4 right; strong on .*majors 2\/2.*; weak on .*Sui tokens 0\/2/);
  });

  it("trusts a member most on the coin itself, smoothed so one call isn't certainty", () => {
    const record = trackRecordOf([call({ status: "win" }), call({ status: "win" }), call({ status: "win" }), call({ subject: "BTC", status: "loss" })])!;
    const { weight, basis } = trustOn(record, call({}));
    assert.equal(basis, "3/3 on SUI calls");
    assert.ok(weight > 0.6 && weight < 0.65, String(weight));
    assert.deepEqual(trustOn(undefined, call({})), { weight: 0.5, basis: "no record yet" });
  });

  it("moves little on one result, and further with more", () => {
    const once = trackRecordOf([call({ status: "win" })])!;
    const weight = trustOn(once, call({})).weight;
    assert.ok(weight > 0.5 && weight < 0.6, String(weight));
    const missed = trustOn(trackRecordOf([call({ status: "loss" })])!, call({})).weight;
    assert.ok(missed < 0.5 && missed > 0.4, String(missed));
    const many = trackRecordOf(Array.from({ length: 10 }, () => call({ status: "win" })))!;
    assert.ok(trustOn(many, call({})).weight > 0.75);
  });
});

describe("CS2 on Polymarket", () => {
  it("matches team names across spellings, without mixing up academy teams", () => {
    assert.equal(teamKey("Team Vitality"), teamKey("VITALITY"));
    assert.equal(teamKey("NaVi"), teamKey("Natus Vincere"));
    assert.equal(teamKey("Na'Vi"), "navi");
    assert.notEqual(teamKey("NAVI Junior"), teamKey("NaVi"));
    assert.equal(teamKey("FURIA Esports"), teamKey("FURIA"));
    assert.equal(teamKey("НАВІ"), "navi");
    assert.equal(teamKey("BC.Game Esports"), "bcgame");
    assert.equal(teamKey("BetBoom Team"), teamKey("betboom"));
    assert.equal(teamKey("BB"), teamKey("BetBoom Team"));
  });
  it("spells out team nicknames in a question to memory, and leaves other words alone", () => {
    assert.equal(spellTeams("who called bb"), "who called bb (BetBoom Team)");
    assert.equal(spellTeams("хто казав про наві і бб?"), "хто казав про наві і бб? (Natus Vincere, BetBoom Team)");
    assert.equal(spellTeams("who called c9"), "who called c9 (Cloud9)");
    assert.equal(spellTeams("who called bnb"), "who called bnb");
    assert.equal(spellTeams("who called furia"), "who called furia");
  });
  it("reads when a match starts from its description, in New York time", () => {
    const at = (when: string) => startOf({ description: `the match, initially scheduled for ${when} ET. More text`, closeTime: "2026-10-31T03:25:00Z" }).toISOString();
    assert.equal(at("October 30, 2026 at 5:15 PM"), "2026-10-30T21:15:00.000Z");
    assert.equal(at("November 2, 2026 at 12:00 PM"), "2026-11-02T17:00:00.000Z");
    assert.equal(at("January 5, 2027 at 9:30 AM"), "2027-01-05T14:30:00.000Z");
    assert.equal(startOf({ closeTime: "2026-10-31T03:25:00Z" }).toISOString(), "2026-10-31T03:25:00.000Z");
    assert.equal(teamKey("фнатік"), teamKey("fnatic"));
    assert.equal(teamKey("TheMongolZ"), teamKey("The MongolZ"));
  });
  it("reads both teams from a Polymarket match title", () => {
    assert.deepEqual(teamsOf("Counter-Strike: MOUZ vs FURIA (BO3) - PGL Masters Bucharest Playoffs"), ["MOUZ", "FURIA"]);
    assert.equal(teamsOf("Counter-Strike: MOUZ vs FURIA - Map 1 Winner"), null);
  });
  it("learns whether a member beats the market", () => {
    const ref = (prob: number) => ({ platform: "polymarket" as const, eventId: "1", marketId: "m", title: "", url: "", outcome: "X", prob });
    const picks = [
      call({ market: "cs2", subject: "FURIA", opponent: "MOUZ", direction: "win", status: "win", market_ref: ref(0.4) }),
      call({ market: "cs2", subject: "B8", opponent: "FaZe", direction: "win", status: "win", market_ref: ref(0.3) }),
    ];
    assert.ok(segmentsOf(picks[0]).includes("underdog picks"));
    const record = trackRecordOf(picks)!;
    assert.equal(Math.round(record.marketEdge! * 100), 65);
    assert.match(record.summary, /beats Polymarket by 65 pts on CS2/);
  });
});

describe("changing its mind", () => {
  const bnb = (id: number, status: "win" | "loss") => call({ id, subject: "BNB", direction: "above", status, made_at: new Date(id * DAY), resolved_at: new Date(id * DAY + 1) });
  const after = (...calls: CallRow[]) => trackRecordOf(calls)!;
  const twoRight = after(bnb(1, "win"), bnb(2, "win"));
  const twoOfFour = after(bnb(1, "win"), bnb(2, "win"), bnb(3, "loss"), bnb(4, "loss"));

  it("says when a strength is gone, with the numbers before and after", () => {
    assert.ok(recordChanges(twoRight, twoOfFour).includes("no longer strong on BNB calls (2/2 → 2/4)"));
  });
  it("says when a weakness appears", () => {
    const twoOfSix = after(bnb(1, "win"), bnb(2, "win"), bnb(3, "loss"), bnb(4, "loss"), bnb(5, "loss"), bnb(6, "loss"));
    assert.ok(recordChanges(twoOfFour, twoOfSix).includes("now weak on BNB calls (2/4 → 2/6)"));
  });
  it("stays quiet when nothing it believes has changed, and on a first record", () => {
    assert.deepEqual(recordChanges(twoRight, after(bnb(1, "win"), bnb(2, "win"), bnb(3, "win"))), []);
    assert.deepEqual(recordChanges(undefined, twoRight), []);
  });
  it("doesn't call a strength lost when it only slipped out of the summary's top two", () => {
    const sui = (id: number) => call({ id, subject: "SUI", direction: "above", status: "win", made_at: new Date(id * DAY), resolved_at: new Date(id * DAY + 1) });
    const more = after(bnb(1, "win"), bnb(2, "win"), sui(3), sui(4), sui(5));
    assert.ok(!recordChanges(twoRight, more).some((c) => c.startsWith("no longer strong on BNB")));
  });
});

describe("memory scorecard", () => {
  // Jake misses on Sui tokens again and again; Max keeps getting SUI right.
  const at = (day: number) => new Date(day * DAY);
  const history = [
    ...[0, 1, 2, 3].map((d) => call({ id: 10 + d, author_id: "1", subject: "WAL", status: "loss", made_at: at(d), resolved_at: at(d + 0.5) })),
    ...[0, 1, 2, 3].map((d) => call({ id: 20 + d, author_id: "2", subject: "SUI", status: "win", made_at: at(d), resolved_at: at(d + 0.5) })),
  ];

  it("only uses what was known when each call was made", () => {
    const s = scoreMemory(history);
    assert.equal(s.calls, 8);
    // The first call of each author had no record yet.
    assert.equal(s.withRecord, 6);
  });
  it("beats a bot that forgets when records are telling, and flags the weak spots", () => {
    const s = scoreMemory(history);
    assert.ok(s.brierMemory! < s.brierForgetful!);
    // Half the chat's calls come true, so knowing only that is no help; knowing who made them is.
    assert.ok(s.brierMemory! < s.brierChatRate!);
    assert.equal(s.spots.weak.hits, 0);
    assert.ok(s.spots.weak.calls >= 2);
    assert.equal(s.spots.strong.hits, s.spots.strong.calls);
  });
  it("gives a score once there are enough calls for it to mean something", () => {
    const long = [
      ...Array.from({ length: 16 }, (_, d) => call({ id: 100 + d, author_id: "1", subject: "WAL", status: "loss", made_at: at(d), resolved_at: at(d + 0.5) })),
      ...Array.from({ length: 16 }, (_, d) => call({ id: 200 + d, author_id: "2", subject: "SUI", status: "win", made_at: at(d), resolved_at: at(d + 0.5) })),
    ];
    assert.match(scorecardLine(scoreMemory(long))!, /vs 0\.250 for a bot that forgets/);
    assert.equal(scorecardLine(scoreMemory(long.slice(0, 20))), null);
  });
  it("stays quiet until there is enough to say", () => {
    assert.equal(scorecardLine(scoreMemory(history.slice(0, 3))), null);
  });
});

describe("habits", () => {
  it("stops asking after three confirms, asks first after two rejections", () => {
    assert.equal(habitOf([true, true, true]), "trusted");
    assert.equal(habitOf([true, true]), null);
    assert.equal(habitOf([false, true, false]), "unsure");
    assert.equal(habitOf([false, true, true]), null);
  });
});

describe("who won a market", () => {
  const market = (nrg: number, wildcard: number) => ({ status: "active", outcomes: [{ name: "NRG", price: nrg }, { name: "WILDCARD", price: wildcard }] });
  it("takes the official resolution", () => {
    assert.deepEqual(winnerOf({ ...market(0, 1), status: "resolved", resolution: { outcome: "WILDCARD" } }), { name: "WILDCARD" });
  });
  it("takes a price that says the match is over, before the resolution comes", () => {
    assert.deepEqual(winnerOf(market(0.0005, 0.9995)), { name: "WILDCARD", price: 0.9995 });
  });
  it("waits while the match can still turn", () => {
    assert.equal(winnerOf(market(0.48, 0.52)), null);
    assert.equal(winnerOf(market(0.02, 0.98)), null);
  });
});

describe("when Tatum is out of credits", () => {
  it("recognises the 402 from every Tatum API, and nothing else", () => {
    for (const message of ["Price API 402", "Received HTTP status code 402", "eth_blockNumber: 402", "prediction API 402 for /events"]) assert.ok(isOutOfCredits(new Error(message)), message);
    for (const message of ["prediction API 500 for /events", "timeout", "price 4021"]) assert.equal(isOutOfCredits(new Error(message)), false, message);
  });
  it("passes other errors on, then uses the public source and stays there", async () => {
    await assert.rejects(tatumOr(() => Promise.reject(new Error("timeout")), async () => "public"));
    assert.equal(tatumOut(), false);
    assert.equal(await tatumOr(async () => "tatum", async () => "public"), "tatum");
    assert.equal(await tatumOr(() => Promise.reject(new Error("Price API 402")), async () => "public"), "public");
    assert.equal(tatumOut(), true);
    assert.equal(await tatumOr(async () => "tatum", async () => "public"), "public");
  });
  it("reads Polymarket's own market format", () => {
    const base = { conditionId: "0xabc", question: "Counter-Strike: NRG vs Wildcard (BO3)", outcomes: '["NRG", "Wildcard"]' };
    const open = fromGammaMarket({ ...base, outcomePrices: '["0.0005", "0.9995"]', closed: false }, "1", "cs2-nrg");
    assert.equal(open.status, "active");
    assert.deepEqual(open.outcomes, [{ name: "NRG", price: 0.0005 }, { name: "Wildcard", price: 0.9995 }]);
    assert.equal(open.source?.url, "https://polymarket.com/event/cs2-nrg");
    assert.deepEqual(winnerOf(open), { name: "Wildcard", price: 0.9995 });
    const done = fromGammaMarket({ ...base, outcomePrices: '["0", "1"]', closed: true, umaResolutionStatus: "resolved" }, "1");
    assert.deepEqual(winnerOf(done), { name: "Wildcard" });
  });
});

describe("price targets", () => {
  it("counts a level as reached at the level or past it, on the called side only", () => {
    assert.ok(reached(705, "above", 705));
    assert.ok(reached(705.06, "above", 705));
    assert.equal(reached(704.92, "above", 705), false);
    assert.ok(reached(705, "below", 705));
    assert.ok(reached(704.92, "below", 705));
    assert.equal(reached(705.06, "below", 705), false);
  });
});

describe("questions about past calls", () => {
  it("answers them without being tagged", () => {
    for (const q of ["who called nemiga", "Who called SUI?", "who said btc 100k", "who was right about furia", "what did Jake say about SOL", "хто казав про суі", "Хто вгадав матч наві?", "що казав Макс"])
      assert.ok(recallQuestion(q), q);
  });
  it("stays out of ordinary chat", () => {
    for (const q of ["who's watching tonight?", "who called me?!", "navi beat faze", "whoever called this is a genius", "хто йде на матч", "btc 102k tomorrow"])
      assert.equal(recallQuestion(q), false, q);
  });
  it("shows what an answer was based on, minus hidden calls and the bot's own bookkeeping", () => {
    const hidden = new Set([12]);
    assert.ok(shownMemory("[CALL #41] @craffny called \"Bnb 705 in 3 hours\".", hidden));
    assert.equal(shownMemory("[RESULT #12] @max's call was RIGHT.", hidden), false);
    assert.equal(shownMemory("[TRACK RECORD @max] @max is 3/5 right.", hidden), false);
    assert.equal(shownMemory("[NOT A CALL @max] BTC below $90,000", hidden), false);
    const text = sourcesText([{ text: "[CALL #41] <b>BNB</b> & co", blobId: "BDAW" }, { text: "[HABIT @max] logs without asking" }]);
    assert.match(text, /1\. \[CALL #41\] &lt;b&gt;BNB&lt;\/b&gt; &amp; co · <a href="https:\/\/walruscan\.com\/mainnet\/blob\/BDAW">sealed on Walrus<\/a>/);
    assert.match(text, /2\. \[HABIT @max\] logs without asking\n/);
    assert.match(sourcesText([]), /hidden/);
  });
});

describe("prices", () => {
  it("turns a Cetus Q64.64 sqrt price into a price in whole tokens", () => {
    // SUI (9 decimals) at $0.95 in USDC (6 decimals): raw price is 0.95e-3.
    const sqrt = BigInt(Math.round(Math.sqrt(0.95e-3) * 2 ** 64)).toString();
    assert.ok(Math.abs(poolPrice(sqrt, 9, 6) - 0.95) < 1e-9);
  });
  it("reads a Uniswap v3 price from the pool's raw slot 0 storage word", () => {
    // WETH/USDG on Robinhood Chain, as read over Tatum's RPC: WETH (18 decimals) is token0, USDG (6) token1.
    const sqrt = sqrtPriceFromSlot0("0x0001442a402a40171dfcf7cd000000000000000000032cff0fe805aea0000000");
    assert.equal(sqrt, BigInt("3839266650001300581777408"));
    assert.ok(Math.abs(uniswapPrice(sqrt, 18, 6) - 2348.21) < 0.01);
  });
  it("measures how far two sources are apart", () => {
    assert.ok(Math.abs(gap(100, 102) - 0.02) < 1e-12);
  });
});

describe("a list of picks with teams the bot has no alias for", () => {
  it("keeps the words that could be team names", () => {
    assert.deepEqual(unknownNames("navi mouz og fokus 9ine acend", ["navi", "mouz", "og"]), ["fokus", "9ine", "acend"]);
    assert.deepEqual(unknownNames("navi, mouz і fokus", ["navi", "mouz"]), ["fokus"]);
  });
  it("leaves sentences and scores to the model", () => {
    assert.equal(unknownNames("navi and mouz are going to lose this one tomorrow for sure", ["navi", "mouz"]), null);
    assert.equal(unknownNames("navi 2:0 mouz", ["navi", "mouz"]), null);
    assert.equal(unknownNames("navi fokus", ["navi"]), null);
    assert.equal(unknownNames("navi mouz", ["navi", "mouz"]), null);
  });
});
