<!--
Draft for Medium. Numbers are from the live bot on 9 November 2026 (scripts/blog-numbers.mts
prints the current ones). Video: https://youtu.be/0csVH_PTqyM.
-->

# My group chat finally keeps receipts: how a Telegram bot learned who to trust

*Built for the Tatum × Walrus “Total Recall” hackathon. Bot: [@mykoll_bot](https://t.me/mykoll_bot) · Site: [mykoll.vercel.app](https://mykoll.vercel.app) · Code: [github.com/stkalper/MyKoll](https://github.com/stkalper/MyKoll) · Video: [youtu.be/0csVH_PTqyM](https://youtu.be/0csVH_PTqyM)*

Every crypto or Counter-Strike chat has the same fight.

> “You said it would pump.”
> “I never said that.”

Calls get made in passing (“BNB 705 in 3 hours”, “easy for FURIA”) and then they are forgotten, deleted or remembered wrong. Nobody keeps score, so nobody knows whose calls are worth anything.

MyKoll is a Telegram bot that sits in the group and keeps score without changing how people talk. Someone makes a call the way they would anyway. The bot files a receipt with the price, or the Polymarket odds, at that second. It settles the call by itself when the deadline hits and remembers all of it in the chat's **Walrus Memory**.

This post is about the part that surprised me most: watching the bot change how it treats each person as its memory filled up.

## Without memory, it's a price alert

The first version I sketched had no memory. It logged a call, waited for the deadline and posted ✅ or ❌. That is a price alert with extra steps. It can't answer “is Max any good on SUI?”, it treats a first-time guess and a ten-for-ten streak the same way, and it asks the same questions forever.

What the chat actually wants is the history: *who said what, when, why, and how it ended*. So every call writes plain-language entries into a namespace that belongs to that one chat (shortened here):

```
[CALL #49] @crypcort called "Bnb 700 in 3hours". BNB above $700.00. BNB was $699.38 (Binance public API).
[RESULT #49] @crypcort's call "Bnb 700 in 3hours" was RIGHT: BNB hit $700.30 before the deadline.
[TRACK RECORD @crypcort] @crypcort is 21/26 right; strong on CS2 picks 11/14, calls under a day 10/12; beats Polymarket by 15 pts on CS2.
[HABIT @crypcort] @crypcort confirmed their last 3 calls, so I log theirs without asking.
```

Memories are recalled by meaning, not keywords: “who was bullish on BNB?” finds those calls though the word “bullish” never appears in them. Every answer has a **🧠 What I recalled** button that lists the memories it was built from, each linked to its blob on Walrus, so nobody has to take the bot's word for what it remembers. Each call is sealed on Walrus Mainnet when it is logged, so there is a timestamped record of every call from before its result was known.

## How it learned, in a real chat

The screenshots below are from a real group of friends, not a demo. Its file is public, and you can open it without Telegram: [the chat's file](https://mykoll.vercel.app/app?file=-5318326021_0662615677bc).

**The first days: just receipts.** Every message that sounded like a call got a question: *log it?* The very first call was a miss: “BTC up tomorrow to 82000” ended at $80,138. The bot remembered the call, the result and who made it, but there was nothing to learn from yet.

**After a few verdicts: records.** Each verdict rewrites the author's track record, split by kind of call: per coin or team, majors vs Sui tokens, bullish vs bearish, short vs long range. A pattern needs at least two settled calls before the bot calls it a strength or a weakness.

**It started bringing up the past.** When @crypcort wrote “Bnb 700 in 3hours”, the receipt came back with their last call like it, recalled from memory: *“Bnb 708 in 2 hours”, right*. And it flagged the new call as a **strong spot**: bullish calls 2/2. It was right again.

**It stopped asking.** After a member confirms three spotted calls in a row, the bot logs theirs without asking, says why, and leaves an undo button. In this chat that has already happened 5 times. It works the other way too: when two of someone's last three spotted calls were “not a call”, the bot asks first even in auto mode. When it misreads a message, it stores *its own misreading* (“BTC below $90,000”), never the message itself, and stops offering the same kind of call after two rejections.

**It weighed the room.** When @crypcort called BetBoom over MOUZ while @craffny already had MOUZ, the bot didn't just count heads. It weighed both by their record on that kind of pick and showed which way the people worth listening to lean.

**It changed its mind.** A record isn't a verdict. When a result moves someone clearly across the line, the bot says so: after “Btc 78k in 30 min” missed, @craffny went from 1/2 to 1/3 on majors: *now weak on majors*. The bot says that in the chat under the result and writes it into memory, so its history shows when and why its view of someone changed. Near the line it stays quiet, so 2/2 → 2/3 → 3/4 isn't three changes of mind. Across the chats, that has happened 14 times in 81 settled calls.

**It measured people against the market.** CS2 picks are matched to the Polymarket match-winner market, so the bot knows the odds at the moment of the call. Picks under 45% are filed as underdog picks, and each member gets an edge against the market. The best moment so far: Liquid over Aurora, which Polymarket had at **31%**. It won. But honest numbers matter more than highlights, so the board shows the whole picture: over all their CS2 picks, @crypcort is 15 points ahead of Polymarket and @craffny is level with it. Earlier in the week, both were behind.

Every one of these moments is written down, in a feed called *What memory changed here* in each chat's file. Since the bot started keeping that log, memory has changed what it did **63 times** across the three chats: 22 calls logged without asking, 21 past calls brought back, 13 strong and weak spots flagged, and 7 split rooms weighed by record. On top of that, a result changed its mind about someone 14 times.

## Is the memory actually earning its keep?

It's easy to claim a memory makes a bot smarter. I wanted numbers that could also say *no*, so the bot keeps score on itself, in public.

**The clearest evidence is the flags.** When a new call matches a member's strong spot in memory, the bot says so on the receipt. Calls flagged that way came true **18 times out of 20**. Calls with no flag came true 32 of 57, and calls flagged as a weak spot 2 of 4. Chance alone would open a gap that wide between flagged and unflagged calls about 1 time in 200 (one-sided Fisher exact test, p = 0.005). Those flags come from nothing but the chat's Walrus Memory.

**Memory against no memory.** The **Memory Check** takes the trust the bot had in each call *at the moment it was made* (no peeking at later results) and scores it against how the call ended (Brier score, lower is better). A bot with no memory trusts everyone 50/50 and always scores 0.25. With Walrus Memory, on 81 settled calls in real chats, the bot scores **0.227**.

**People against the chat average.** Part of that lead comes from remembering just one thing: 64% of these chats' calls come true. A bot that knows only that scores 0.231. Knowing *who* is right about *what* is ahead of it, but by a small margin so far, and I'd rather say that than round it up. At 30 calls the memory was still tied with forgetting (0.251), so the trend is going the right way.

The margin is small by design. Trust starts at 50/50 and moves only as far as the evidence takes it (a record counts as if 16 coin-flip calls came before it), so one lucky call can't make anyone an oracle. In simulated chats like these (four members, right 60% of the time, who really differ), memory is ahead of the chat-average bot in a bit over half the chats at 50 calls, three in four at 100 and four in five at 200 ([the simulation](https://github.com/stkalper/MyKoll/blob/main/scripts/try-trust.mts)). The score is shown in the chat and on the site from 30 calls, and the raw number is always at [/api/stats](https://mykoll.vercel.app/api/stats).

The same trust is on every receipt now, as the bot's own chance the call comes true, next to Polymarket's: *🎯 Memory's chance: 62% (5/7 on NaVi picks) · Polymarket 58%*. What the chat sees and what the Memory Check scores are the same number.

None of this was tuned after the fact, and the commits show it: the Memory Check against a bot that forgets went in on [29 October](https://github.com/stkalper/MyKoll/commit/b5e08be), the 16-call prior, chosen on simulated chats, on [2 November](https://github.com/stkalper/MyKoll/commit/1ccbcb2), and the hit-rate bot on [4 November](https://github.com/stkalper/MyKoll/commit/ded0088).

The score is the slow part. The behaviour is what the chat feels every day: what gets brought back, flagged, skipped or asked.

## You decide what it keeps

Long-term memory in a group chat is only OK if people stay in control:

- Only calls are stored, never the conversation.
- In ask mode nothing is saved until the author taps “Log it”, and auto-logged calls can be undone.
- Anyone can hide their call with `/hide` or from the Mini App. It drops off the board and out of the bot's answers, and their record is worked out again without it.
- Hidden is not rewritten, and that's on purpose. A Walrus blob can't be deleted or edited, so nobody can quietly drop a bad call or change what they said after the fact. That's what makes it a receipt. A hidden call stays sealed and encrypted; it just never shows or counts again.
- Each chat has its own namespace, so one chat's calls never come up in another chat's answers.
- A chat's file is private unless an admin opens it with `/public`.

## Following the whales

Chats argue about Polymarket traders as much as about each other, so the bot can follow them too. Paste a link to a trader's profile and the chat follows them: every new position of $500 or more they open on a CS2, politics or crypto market lands as a receipt with the stake and the price paid, is sealed in the chat's memory, and settles when the market resolves. The trader builds a record the way members do, by kind of bet: politics, crypto or CS2, longshots or favourites, Yes or No. It also says how often they win against the prices they paid, because a run of 90¢ favourites coming in isn't skill. A bet on a CS2 match becomes a pick on that team, so a whale's bet is weighed against the chat's own picks on the same match.

It went live on 8 November, so there are no settled bets to show yet. Everything comes from Polymarket's public API, no key needed.

## Prices you can check

Every receipt says where its price came from. Majors come from the **Tatum Price API**. Sui tokens like WAL, DEEP and NS are priced straight from their **Cetus pools on Sui mainnet through Tatum's Sui gRPC**, because the price feed doesn't cover them; for those tokens, the pool is the only price there is. Stock tokens on Robinhood Chain are read from their Uniswap v3 pools over Tatum's Robinhood Chain RPC. Coins none of those list (FARTCOIN, PURR, ZEREBRO and the rest of Hyperliquid's 230+) are priced from Hyperliquid's public mid prices, so a chat can call almost anything that trades. An on-chain price links the Sui transaction that set it, and CS2 calls link the Polymarket market and settle from its result.

Halfway through the hackathon the project used up its Tatum credits. With the Tatum team's go-ahead, the bot now falls back to public endpoints (Binance, Sui GraphQL, Polymarket's API) whenever Tatum answers 402, checks Tatum again every 10 minutes, and labels every receipt with the source it really used.

## Things I learned building it

- **People don't write calls in a format.** “Bnb 705 in 3 hours”, “easy for FURIA” in Ukrainian slang, “TRX long from 0.34, TP 0.37”, a list of four teams, a forwarded post from a signal channel. An LLM reads them, with rules taken from real public channels (brags like “TP3 HIT ✅” and both-ways scenarios are not calls). When the model was unreliable, a rule replaced it. A bare list of team names is now a set of picks by rule, because the model got it right only one time in three.
- **Polymarket's `closeTime` is not the match time.** CS2 markets keep trading while the match is played, so the real start comes from the event description, in New York time.
- **Polymarket lists matches late.** Even a big event's playoff match can appear only the day before, while the chat is already calling it. So a pick waits for its match: a team's next one, the pair named, or the day named. Once the match is listed, the pick gets its odds (marked as read after the call) and settles from the market.
- **People call the score, not just the winner.** “NaVi 2:1” is now a pick on that score, priced from the maps handicap and totals markets beside the match winner and settled from the totals: “won, but 2:1, not 2:0”.
- **People don't always give a date.** “Sui 5$” is a call too. It gets a week, the bot says the moment the coin gets there, and if it doesn't, the author decides: another week, or count it as missed.
- **Webhooks get delivered twice.** A slow reply made Telegram resend an update, and a few calls were logged twice. Updates are now de-duplicated by id, and hiding a duplicate takes it out of the record.
- **A memory metric has to be allowed to lose.** Otherwise it's marketing.

## Try it, or check it

- Add [@mykoll_bot](https://t.me/mykoll_bot) to a group and say something bold.
- No group? Write the bot privately: it keeps a journal of your own calls, and a Polymarket profile link works there too.
- No Telegram? Open [a real chat's file](https://mykoll.vercel.app/app?file=-5318326021_0662615677bc) or the [demo chat](https://mykoll.vercel.app/app).
- Every claim in this post links to a receipt, a Walrus blob, a Sui transaction or a Polymarket market in the README's [Check it yourself](https://github.com/stkalper/MyKoll#check-it-yourself) table.

Built with Walrus Memory and Tatum for Total Recall. @WalrusFoundation @Tatum_io
