import { claim, when, type Author, type CallRow, type Draft } from "./calls";
import { db } from "./db";
import { recall, remember } from "./memory";

/**
 * The bot learning how each member talks. Every "Log it", "No" and "✗ Not a call" on a
 * call the bot spotted is feedback, and it changes what the bot does next:
 * - someone who confirmed their last few calls stops being asked and gets logged straight away;
 * - someone whose spotted calls keep being rejected gets asked first, even in auto mode;
 * - a misread the author rejected is written to Walrus Memory, and when a new message reads
 *   the same way, the bot asks instead of logging, and after two rejections stays quiet.
 * Only the bot's own reading of a message is stored ("BTC below $90,000"), never the message.
 */

export type Habit = "trusted" | "unsure" | null;

/** Confirmed calls in a row before the bot stops asking. */
const STREAK = 3;
/** Rejections among the last STREAK before the bot asks first. */
const MISSES = 2;

type Reading = Pick<CallRow, "market" | "subject" | "opponent" | "direction" | "target"> & { entry_price?: number | null };

/** What a call is about and which way it leans, e.g. "BTC, bearish" or "NaVi over FaZe". */
const angle = (c: Reading) =>
  c.market === "cs2"
    ? `${c.subject} over ${c.opponent}`
    : `${c.subject}, ${c.direction === "to" ? "a price level" : c.direction === "above" || c.direction === "up" ? "bullish" : "bearish"}`;

async function lastAnswers(chatId: number | string, authorId: number | string): Promise<boolean[]> {
  const rows = await db<{ accepted: boolean }>(
    `select accepted from call_feedback where chat_id = $1 and author_id = $2 order by id desc limit ${STREAK}`,
    [chatId, authorId],
  );
  return rows.map((r) => r.accepted);
}

/** The habit behind a member's latest answers, newest first. */
export function habitOf(answers: boolean[]): Habit {
  if (answers.length === STREAK && answers.every(Boolean)) return "trusted";
  if (answers.filter((a) => !a).length >= MISSES) return "unsure";
  return null;
}

export const habitFor = async (chatId: number | string, authorId: number | string) => habitOf(await lastAnswers(chatId, authorId));

/** The habit in the bot's words: about a member (chat, memory) and to them (Mini App). */
export const habitText: Record<Exclude<Habit, null>, { them: string; you: string }> = {
  trusted: {
    them: `confirmed their last ${STREAK} calls, so I log theirs without asking`,
    you: `You confirmed your last ${STREAK} calls, so I log yours without asking.`,
  },
  unsure: {
    them: `said ${MISSES} of the last ${STREAK} calls I spotted weren't calls, so I ask them first`,
    you: `${MISSES} of the last ${STREAK} calls I spotted for you weren't calls, so I ask you first.`,
  },
};

/** Records an answer to a spotted call; writes the misread and any change of habit to memory. */
export async function recordFeedback(chatId: number | string, author: Author, accepted: boolean, reading: Reading) {
  const before = await habitFor(chatId, author.id);
  await db(`insert into call_feedback (chat_id, author_id, accepted) values ($1, $2, $3)`, [chatId, author.id, accepted]);
  const after = await habitFor(chatId, author.id);

  const notes: string[] = [];
  if (!accepted) notes.push(`[NOT A CALL] ${author.name}: I read a message as "${claim({ ...reading, entry_price: null })}" (${angle(reading)}) and they said it wasn't a call.`);
  if (after !== before)
    notes.push(`[HABIT ${author.name}] ${when(new Date())}: ${author.name} ${after ? habitText[after].them : "is back to the chat's usual mode"}.`);
  for (const note of notes) await remember(chatId, note).catch((err) => console.error("memory write failed", err));
}

/**
 * How many times the author said a reading like this one wasn't a call, recalled from Walrus
 * Memory. Recall takes a second or more, so it only runs for authors who ever said "not a call".
 */
export async function misreadsLike(chatId: number | string, author: Author, draft: Draft): Promise<number> {
  const [row] = await db<{ n: number }>(`select count(*)::int as n from call_feedback where chat_id = $1 and author_id = $2 and not accepted`, [chatId, author.id]);
  if (!row?.n) return 0;
  const authorName = author.name;
  const memories = await recall(chatId, `[NOT A CALL] ${authorName}: ${claim({ ...draft, entry_price: null })} (${angle(draft)})`, 10).catch(() => []);
  return memories.filter((m) => m.text.startsWith(`[NOT A CALL] ${authorName}:`) && m.text.includes(`(${angle(draft)})`)).length;
}

/** What the Mini App shows a member about how the bot has adapted to them. */
export async function habitsView(chatId: number | string, authorId: number | string): Promise<{ habit?: string; misreads: number }> {
  const [habit, [row]] = await Promise.all([
    habitFor(chatId, authorId),
    db<{ n: number }>(`select count(*)::int as n from call_feedback where chat_id = $1 and author_id = $2 and not accepted`, [chatId, authorId]),
  ]);
  return { habit: habit ? habitText[habit].you : undefined, misreads: row?.n ?? 0 };
}
