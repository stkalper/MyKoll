// Updates the command menu Telegram shows for the bot (production bot token from .env.local).
//   npx tsx --env-file=.env.local scripts/set-commands.mts
import "./local-db.mts";
import { Bot } from "grammy";
import { BOT_COMMANDS } from "../src/lib/bot";
import { config } from "../src/lib/config";

const bot = new Bot(config.telegram.botToken);
await bot.api.setMyCommands(BOT_COMMANDS);
console.log("commands:", (await bot.api.getMyCommands()).map((c) => `/${c.command}`).join(" "));
process.exit(0);
