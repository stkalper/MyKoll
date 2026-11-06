import { createHmac } from "node:crypto";
import { claim, reasonsFor, when, withBlobs, type CallRow } from "./calls";
import { config } from "./config";
import { bookLine } from "./bookmakers";
import { pickName } from "./polymarket";
import { db } from "./db";
import { blobUrl, proofLabel, proofUrl } from "./proof";
import { gap } from "./tatum";
import type { ReceiptView } from "./view";

const outcome = (s: CallRow["status"]): ReceiptView["outcome"] =>
  s === "win" ? "win" : s === "loss" ? "loss" : s === "void" ? "void" : "open";

export function toView(c: CallRow, reasons: Map<number, string[]>): ReceiptView {
  // Once settled, the price that counts is the one it was judged by.
  const settled = c.status === "win" || c.status === "loss";
  const proof = (settled ? c.final_proof : c.entry_proof)?.[0];
  const [price, check] = settled ? [c.final_price, c.final_check] : [c.entry_price, c.entry_check];
  return {
    proofUrl: proof ? proofUrl(proof) : undefined,
    proofChain: proof ? proofLabel(proof) : undefined,
    polymarket: c.market_ref
      ? { team: pickName(c.market_ref), prob: c.market_ref.prob, url: c.market_ref.url, direct: c.market_ref.direct, score: Boolean(c.market_ref.score), late: c.market_ref.late, book: c.market_ref.book ? bookLine(c.market_ref.book) : undefined }
      : undefined,
    check: price && check ? { price: check, apart: gap(price, check) } : undefined,
    id: c.id,
    author: c.author_name,
    market: c.market,
    quote: c.quote,
    claim: claim(c),
    madeAt: when(c.made_at),
    deadline: when(c.deadline),
    outcome: outcome(c.status),
    entry: c.entry_price ?? undefined,
    final: c.final_price ?? undefined,
    note: c.result_note ?? undefined,
    priceSource: c.price_source ?? undefined,
    blobUrl: c.memory_blob ? blobUrl(c.memory_blob) : undefined,
    reasons: reasons.get(c.id),
    hidden: c.hidden,
  };
}

/**
 * Public receipt links carry a signature, so receipts can't be enumerated by id:
 * only someone who was given the link (from the chat) can open it.
 */
const sign = (id: number) => createHmac("sha256", config.telegram.webhookSecret || config.telegram.botToken).update(`receipt:${id}`).digest("hex").slice(0, 12);

export const shareSlug = (id: number) => `${id}-${sign(id)}`;
export const shareUrl = (id: number) => `${config.publicUrl}/r/${shareSlug(id)}`;

/** A chat's public file link, signed the same way, so chats can't be enumerated by id either. */
const signChat = (chatId: string) =>
  createHmac("sha256", config.telegram.webhookSecret || config.telegram.botToken).update(`file:${chatId}`).digest("hex").slice(0, 12);

export const fileUrl = (chatId: number | string) => `${config.publicUrl}/app?file=${chatId}_${signChat(String(chatId))}`;

/** The chat behind a public file link, if the signature holds (whether it's public is checked separately). */
export function chatOfFile(slug: string): string | null {
  const [, chatId, sig] = slug.match(/^(-?\d+)_([0-9a-f]{12})$/) ?? [];
  return chatId && sig === signChat(chatId) ? chatId : null;
}

/** The receipt behind a public link, unless the link is forged or the author hid the call. */
export async function sharedReceipt(slug: string): Promise<ReceiptView | null> {
  const [, idText, sig] = slug.match(/^(\d+)-([0-9a-f]{12})$/) ?? [];
  const id = Number(idText);
  if (!id || sig !== sign(id)) return null;
  const [call] = await db<CallRow>(`select * from calls where id = $1 and not hidden`, [id]);
  if (!call) return null;
  const [sealed] = await withBlobs([call]);
  return toView(sealed, await reasonsFor([id]));
}
