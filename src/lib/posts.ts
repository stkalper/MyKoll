/**
 * Calls made outside the chat: a link to a post on X or a public Telegram channel. The bot reads
 * the post, and the call is filed under the post's author, so the chat keeps score on the
 * accounts it argues about, not only on its own members.
 */

export type PostKind = "x" | "telegram";

export interface PostLink {
  kind: PostKind;
  url: string;
  handle: string;
  id: string;
}

export interface Post extends PostLink {
  text: string;
  postedAt: Date;
}

/** Where a call came from when it was shared from a post, kept on its draft and its row. */
export interface PostSource {
  kind: PostKind;
  url: string;
  handle: string;
  postedAt: string;
  sharedBy: { id: number; name: string };
}

const X_LINK = /https?:\/\/(?:www\.|mobile\.)?(?:x|twitter|fxtwitter|vxtwitter|fixupx)\.com\/(\w{1,15})\/status(?:es)?\/(\d+)/i;
const TG_LINK = /https?:\/\/(?:t|telegram)\.me\/(?:s\/)?([A-Za-z]\w{3,31})\/(\d+)/i;

/** The first post link in a message. Private Telegram links (t.me/c/...) can't be read, so they don't count. */
export function postLinkIn(text: string): PostLink | null {
  const x = text.match(X_LINK);
  if (x) return { kind: "x", url: `https://x.com/${x[1]}/status/${x[2]}`, handle: x[1], id: x[2] };
  const tg = text.match(TG_LINK);
  if (tg && tg[1].toLowerCase() !== "c") return { kind: "telegram", url: `https://t.me/${tg[1]}/${tg[2]}`, handle: tg[1], id: tg[2] };
  return null;
}

/** True when a message is little more than the link: the sender is asking the bot to look at it. */
export function justTheLink(text: string, link: PostLink): boolean {
  return text.replace(/https?:\/\/\S+/g, "").trim().length < 25 && postLinkIn(text)?.url === link.url;
}

export const sourceName = (s: Pick<PostSource, "kind" | "handle">) => `@${s.handle} on ${s.kind === "x" ? "X" : "Telegram"}`;

/**
 * A stable id for an outside account, so its calls add up to one track record per chat. Negative,
 * so it never meets a Telegram user id.
 */
export function sourceId(s: Pick<PostSource, "kind" | "handle">): number {
  let h = 0x811c9dc5;
  for (const ch of `${s.kind}:${s.handle.toLowerCase()}`) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return -(h + 1);
}

const get = (url: string) => fetch(url, { headers: { "User-Agent": "MyKollBot/1.0 (+https://mykoll.vercel.app)" }, signal: AbortSignal.timeout(8_000) });

/** A post on X, read through the public fxtwitter API, with vxtwitter as a fallback. No X API key needed. */
async function readX(link: PostLink): Promise<Post | null> {
  const fx = await get(`https://api.fxtwitter.com/${link.handle}/status/${link.id}`)
    .then((r) => (r.ok ? (r.json() as Promise<{ tweet?: { text?: string; created_timestamp?: number; author?: { screen_name?: string } } }>) : null))
    .catch(() => null);
  if (fx?.tweet?.text && fx.tweet.created_timestamp)
    return { ...link, handle: fx.tweet.author?.screen_name ?? link.handle, text: fx.tweet.text, postedAt: new Date(fx.tweet.created_timestamp * 1000) };

  const vx = await get(`https://api.vxtwitter.com/${link.handle}/status/${link.id}`)
    .then((r) => (r.ok ? (r.json() as Promise<{ text?: string; date_epoch?: number; user_screen_name?: string }>) : null))
    .catch(() => null);
  if (vx?.text && vx.date_epoch) return { ...link, handle: vx.user_screen_name ?? link.handle, text: vx.text, postedAt: new Date(vx.date_epoch * 1000) };
  return null;
}

const unescape = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();

/** A post in a public Telegram channel, read from its embed widget. */
async function readTelegram(link: PostLink): Promise<Post | null> {
  const page = await get(`https://t.me/${link.handle}/${link.id}?embed=1&mode=tme`)
    .then((r) => (r.ok ? r.text() : null))
    .catch(() => null);
  if (!page) return null;
  const body = page.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1];
  const when = page.match(/<time[^>]*datetime="([^"]+)"/)?.[1];
  if (!body || !when) return null;
  return { ...link, text: unescape(body), postedAt: new Date(when) };
}

export async function readPost(link: PostLink): Promise<Post | null> {
  const post = await (link.kind === "x" ? readX(link) : readTelegram(link));
  return post && post.text && !Number.isNaN(post.postedAt.getTime()) ? post : null;
}
