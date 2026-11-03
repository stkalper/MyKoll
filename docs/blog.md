<!--
Draft for Medium. Numbers marked [N] are from the live bot on 3 November 2026 and get refreshed
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

Memories are recalled by meaning, not keywords: “who was bullish on BNB?” finds those calls though the word “bullish” never appears in them. Each call is sealed on Walrus Mainnet when it is logged, so there is a timestamped record of every call from before its result was known.

## How it learned, in a real chat

The screenshots below are from a real group of friends, not a demo. Its file is public, and you can open it without Telegram: [the chat's file](https://mykoll.vercel.app/app?file=-5318326021_0662615677bc).

**The first days: just receipts.** Every message that sounded like a call got a question: *log it?* The very first call was a miss: “BTC up tomorrow to 82000” ended at $80,138. The bot remembered the call, the result and who made it, but there was nothing to learn from yet.

**After a few verdicts: records.** Each verdict rewrites the author's track record, split by kind of call: per coin or team, majors vs Sui tokens, bullish vs bearish, short vs long range. A pattern needs at least two settled calls before the bot calls it a strength or a weakness.

**It started bringing up the past.** When @crypcort wrote “Bnb 700 in 3hours”, the receipt came back with their last call like it, recalled from memory: *“Bnb 708 in 2 hours”, right*. And it flagged the new call as a **strong spot**: bullish calls 2/2. It was right again.

**It stopped asking.** After a member confirms three spotted calls in a row, the bot logs theirs without asking, says why, and leaves an undo button. In this chat that has already happened [5] times. It works the other way too: when two of someone's last three spotted calls were “not a call”, the bot asks first even in auto mode. When it misreads a message, it stores *its own misreading* (“BTC below $90,000”), never the message itself, and stops offering the same kind of call after two rejections.

**It weighed the room.** When @crypcort called BetBoom over MOUZ while @craffny already had MOUZ, the bot didn't just count heads. It weighed both by their record on that kind of pick and showed which way the people worth listening to lean.

**It measured people against the market.** CS2 picks are matched to the Polymarket match-winner market, so the bot knows the odds at the moment of the call. Picks under 45% are filed as underdog picks, and each member gets an edge against the market. The best moment so far: Liquid over Aurora, which Polymarket had at **31%**. It won. But honest numbers matter more than highlights. Over all their CS2 picks, both members still trail Polymarket slightly ([−5] and [−2] points), and the board says so.

Every one of these moments is written down. The chat's file has a feed called *What memory changed here*, and the site counts them across all chats: [12] times in this chat so far.

## Is the memory actually earning its keep?

It's easy to claim a memory makes a bot smarter. I wanted a number that could also say *no*.

The **Memory Check** takes the trust the bot had in each call *at the moment it was made* (no peeking at later results), scores it against how the call ended (Brier score, lower is better), and puts it next to a bot that forgets and trusts everyone 50/50, which always scores 0.25.

On [30] settled calls across both chats the memory scores **[0.251]**. That is a tie with forgetting.

I'm publishing it anyway, because that is what the data says. Trust starts at 50/50 and moves only as far as the evidence takes it (a record counts as if 16 coin-flip calls came before it), so a member with a handful of settled calls is still trusted close to 50/50, by design: one lucky call shouldn't make anyone an oracle. In simulated chats where members really differ and have a real history, memory wins clearly; with a few members and a few weeks of calls, it can't yet. The score is shown in the chat and on the site from 30 calls, and the raw number is always at [/api/stats](https://mykoll.vercel.app/api/stats).

The useful part isn't the score yet. It's the behaviour: what gets brought back, flagged, skipped or asked.

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
