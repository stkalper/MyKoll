import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config";

export interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/**
 * Validates Telegram Mini App `initData` as described in
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyInitData(initData: string, botToken: string, maxAgeSec = 24 * 3600): TelegramWebAppUser | null {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;

  try {
    return JSON.parse(params.get("user") ?? "null");
  } catch {
    return null;
  }
}

/** The Mini App user from the request's signed initData, or null. */
export function appUser(req: Request): TelegramWebAppUser | null {
  return verifyInitData(req.headers.get("x-telegram-init-data") ?? "", config.telegram.botToken);
}

/** Whether a user is currently in a chat, per Telegram. */
export async function isMember(chatId: string, userId: number): Promise<boolean> {
  const res = await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/getChatMember?chat_id=${chatId}&user_id=${userId}`);
  const data = (await res.json()) as { ok: boolean; result?: { status: string } };
  const status = data.result?.status;
  return Boolean(data.ok && status && !["left", "kicked"].includes(status));
}

/**
 * The Mini App user, if they are a member of the chat they ask about.
 * A chat's board is only visible to people in that chat.
 */
export async function chatMember(req: Request, chatId: string): Promise<TelegramWebAppUser | null> {
  const user = appUser(req);
  if (!user || !/^-?\d+$/.test(chatId)) return null;
  return (await isMember(chatId, user.id)) ? user : null;
}
