<!--
Draft for Medium. Numbers marked [N] are from the live bot on 4 November 2026 and get refreshed
before publishing (scripts/blog-numbers.mts prints the current ones). Video link: [VIDEO].
-->

# My group chat finally keeps receipts: how a Telegram bot learned who to trust

*Built for the Tatum × Walrus “Total Recall” hackathon. Bot: [@mykoll_bot](https://t.me/mykoll_bot) · Site: [mykoll.vercel.app](https://mykoll.vercel.app) · Code: [github.com/stkalper/MyKoll](https://github.com/stkalper/MyKoll) · Video: [VIDEO]*

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
[CALL #41] @craffny called "Bnb 705 in 3 hours". BNB above $705.00. BNB was $702.92 (Tatum Price API).
[RESULT #41] @craffny's call "Bnb 705 in 3 hours" was RIGHT: BNB was $705.06 at the deadline.
[TRACK RECORD @craffny] @craffny is 8/14 right; strong on BNB calls, FURIA picks; weak on BTC calls.
[HABIT @craffny] @craffny confirmed their last 3 calls, so I log theirs without asking.
```

Memories are recalled by meaning, not keywords: “who was bullish on BNB?” finds those calls though the word “bullish” never appears in them. Every answer has a **🧠 What I recalled** button that lists the memories it was built from, each linked to its blob on Walrus, so nobody has to take the bot's word for what it remembers. Each call is sealed on Walrus Mainnet when it is logged, so there is a timestamped record of every call from before its result was known.

## How it learned, in a real chat

The screenshots below are from a real group of friends, not a demo. Its file is public, and you can open it without Telegram: [the chat's file](https://mykoll.vercel.app/app?file=-5318326021_0662615677bc).

**The first days: just receipts.** Every message that sounded like a call got a question: *log it?* The very first call was a miss: “BTC up tomorrow to 82000” ended at $80,138. The bot remembered the call, the result and who made it, but there was nothing to learn from yet.

**After a few verdicts: records.** Each verdict rewrites the author's track record, split by kind of call: per coin or team, majors vs Sui tokens, bullish vs bearish, short vs long range. A pattern needs at least two settled calls before the bot calls it a strength or a weakness.

**It started bringing up the past.** When @crypcort wrote “Bnb 700 in 3hours”, the receipt came back with their last call like it, recalled from memory: *“Bnb 708 in 2 hours”, right*. And it flagged the new call as a **strong spot**: bullish calls 2/2. It was right again.

**It stopped asking.** After a member confirms three spotted calls in a row, the bot logs theirs without asking, says why, and leaves an undo button. In this chat that has already happened [4] times. It works the other way too: when two of someone's last three spotted calls were “not a call”, the bot asks first even in auto mode. When it misreads a message, it stores *its own misreading* (“BTC below $90,000”), never the message itself, and stops offering the same kind of call after two rejections.

**It weighed the room.** When @crypcort called BetBoom over MOUZ while @craffny already had MOUZ, the bot didn't just count heads. It weighed both by their record on that kind of pick and showed which way the people worth listening to lean.

**It changed its mind.** A record isn't a verdict. When a result moves someone clearly across the line, the bot says so: after “Btc 78k in 30 min” missed, @craffny went from 1/2 to 1/3 on majors: *now weak on majors*. The bot says that in the chat under the result and writes it into memory, so its history shows when and why its view of someone changed. Near the line it stays quiet, so 2/2 → 2/3 → 3/4 isn't three changes of mind. Replayed over both chats' history, that happened [11] times in [49] settled calls.

**It measured people against the market.** CS2 picks are matched to the Polymarket match-winner market, so the bot knows the odds at the moment of the call. Picks under 45% are filed as underdog picks, and each member gets an edge against the market. The best moment so far: Liquid over Aurora, which Polymarket had at **31%**. It won. But honest numbers matter more than highlights, so the board shows the whole picture: over all their CS2 picks, @crypcort is [10] points ahead of Polymarket and @craffny is [1] point behind. Earlier in the week, both were behind.

Every one of these moments is written down. The chat's file has a feed called *What memory changed here*, and the site counts them across all chats: [12] times in this chat so far.

## Is the memory actually earning its keep?

It's easy to claim a memory makes a bot smarter. I wanted a number that could also say *no*.

The **Memory Check** takes the trust the bot had in each call *at the moment it was made* (no peeking at later results), scores it against how the call ended (Brier score, lower is better), and puts it next to two bots that know less. One forgets everything and trusts everyone 50/50, which always scores 0.25. The other remembers nothing about anyone, only how often calls in the chat have come true so far. The memory has to beat that second one to show it learned something about *people*, not just about the chat.

The first time it had enough calls to say anything, at 30 settled calls, the memory scored **0.251**: a tie with forgetting. I was ready to publish that, because that is what the data said.

Then the chats kept going. On [49] settled calls the memory scores **[0.235]** against forgetting's 0.25. That looked like a win, until I added the second bot: knowing only that [61]% of these chats' calls come true already scores **[0.237]**. Almost all of the lead over 50/50 is the chat being right more often than not. Against the bot that knows that, it's a tie.

Where the memory does show something is the flags. Calls the bot marked as a member's **strong spot** came true [8] times out of [9]. Calls with no flag came true [22] of [39]. The score averages that signal away, because most calls aren't flagged yet.

It's a tie, not a failure. Trust starts at 50/50 and moves only as far as the evidence takes it (a record counts as if 16 coin-flip calls came before it), so one lucky call can't make anyone an oracle, and it takes many calls per member before their record moves the trust far from the chat's average. In simulated chats like these (four members, right 60% of the time, who really differ), memory is ahead of the hit-rate bot in a bit over half the chats at 50 calls, three in four at 100 and four in five at 200 ([the simulation](https://github.com/stkalper/MyKoll/blob/main/scripts/try-trust.mts)). At [49] calls, a tie is what to expect. The score is shown in the chat and on the site from 30 calls, and the raw number is always at [/api/stats](https://mykoll.vercel.app/api/stats).

The score is the slow part. The behaviour is what the chat feels every day: what gets brought back, flagged, skipped or asked.

## You decide what it keeps

Long-term memory in a group chat is only OK if people stay in control:

- Only calls are stored, never the conversation.
- In ask mode nothing is saved until the author taps “Log it”, and auto-logged calls can be undone.
- Anyone can hide their call with `/hide` or from the Mini App. It drops off the board and out of the bot's answers, and their record is worked out again without it.
- Each chat has its own namespace, so one chat's calls never come up in another chat's answers.
- A chat's file is private unless an admin opens it with `/public`.

## Prices you can check

Every receipt says where its price came from. Majors come from the **Tatum Price API**. Sui tokens like WAL, DEEP and NS are priced straight from their **Cetus pools on Sui mainnet through Tatum's Sui gRPC**, because the price feed doesn't cover them; for those tokens, the pool is the only price there is. Stock tokens on Robinhood Chain are read from their Uniswap v3 pools over Tatum's Robinhood Chain RPC. An on-chain price links the Sui transaction that set it, and CS2 calls link the Polymarket market and settle from its result.

Halfway through the hackathon the project used up its Tatum credits. With the Tatum team's go-ahead, the bot now falls back to public endpoints (Binance, Sui GraphQL, Polymarket's API) whenever Tatum answers 402, checks Tatum again every 10 minutes, and labels every receipt with the source it really used.

## Things I learned building it

- **People don't write calls in a format.** “Bnb 705 in 3 hours”, “изи для фуріа”, “TRX long from 0.34, TP 0.37”, a list of four teams, a forwarded post from a signal channel. An LLM reads them, with rules taken from real public channels (brags like “TP3 HIT ✅” and both-ways scenarios are not calls). When the model was unreliable, a rule replaced it. A bare list of team names is now a set of picks by rule, because the model got it right only one time in three.
- **Polymarket's `closeTime` is not the match time.** CS2 markets keep trading while the match is played, so the real start comes from the event description, in New York time.
- **Webhooks get delivered twice.** A slow reply made Telegram resend an update, and a few calls were logged twice. Updates are now de-duplicated by id, and hiding a duplicate takes it out of the record.
- **A memory metric has to be allowed to lose.** Otherwise it's marketing.

## Try it, or check it

- Add [@mykoll_bot](https://t.me/mykoll_bot) to a group and say something bold.
- No Telegram? Open [a real chat's file](https://mykoll.vercel.app/app?file=-5318326021_0662615677bc) or the [demo chat](https://mykoll.vercel.app/app).
- Every claim in this post links to a receipt, a Walrus blob, a Sui transaction or a Polymarket market in the README's [Check it yourself](https://github.com/stkalper/MyKoll#check-it-yourself) table.

Built with Walrus Memory and Tatum for Total Recall. @WalrusFoundation @Tatum_io
