import { webhookCallback } from "grammy";
import { createBot } from "@/lib/bot";
import { config } from "@/lib/config";

const bot = createBot();

// Telegram signs every webhook call with the secret we registered via setWebhook.
export const POST = webhookCallback(bot, "std/http", { secretToken: config.telegram.webhookSecret || undefined });
