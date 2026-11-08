// Local development: run the bot with long polling instead of a webhook.
//   npx tsx --env-file=.env.local scripts/poll.mts
import { announceBets, announceResolutions, BOT_COMMANDS, createBot } from "../src/lib/bot";

const bot = createBot();
await bot.api.deleteWebhook();
await bot.api.setMyCommands(BOT_COMMANDS);
setInterval(() => announceResolutions(bot).catch((err) => console.error("resolve failed", err)), 60_000);
setInterval(() => announceBets(bot).catch((err) => console.error("bets failed", err)), 60_000);
console.log("polling…");
await bot.start({ onStart: (me) => console.log(`@${me.username} is up`) });
