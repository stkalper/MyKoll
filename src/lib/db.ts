import { createHash } from "node:crypto";
import { config } from "./config";

/**
 * One query function over two drivers: Neon's HTTP driver in production, and an
 * embedded PGlite (real Postgres in WASM) for local development, so the SQL is identical.
 */
type Query = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

const SCHEMA = `
create table if not exists calls (
  id            serial primary key,
  chat_id       bigint not null,
  chat_title    text,
  author_id     bigint not null,
  author_name   text not null,
  market        text not null check (market in ('crypto', 'cs2')),
  -- crypto: ticker; cs2: the team picked to win
  subject       text not null,
  -- cs2 only: the other team
  opponent      text,
  -- crypto: 'above' | 'below' (target given) or 'up' | 'down' (vs entry price); cs2: 'win'
  direction     text not null,
  target        double precision,
  entry_price   double precision,
  quote         text not null,
  made_at       timestamptz not null default now(),
  deadline      timestamptz not null,
  status        text not null default 'open' check (status in ('open', 'awaiting_score', 'win', 'loss', 'void')),
  final_price   double precision,
  result_note   text,
  resolved_at   timestamptz,
  hidden        boolean not null default false,
  memory_job    text
);
alter table calls add column if not exists price_source text;
-- On-chain prices: the pool states they were read from, and the Price API's price for the same token as a cross-check.
alter table calls add column if not exists entry_proof jsonb;
alter table calls add column if not exists entry_check double precision;
alter table calls add column if not exists final_proof jsonb;
alter table calls add column if not exists final_check double precision;
-- CS2 calls: the Polymarket match-winner market they were matched to, with the pick's price then.
alter table calls add column if not exists market_ref jsonb;
-- CS2 picks made together in one message ("NaVi, Vitality, FURIA"), reported together once the last match ends.
alter table calls add column if not exists slate_id text;
create index if not exists calls_chat_idx on calls (chat_id, made_at desc);
create index if not exists calls_due_idx on calls (status, deadline);
create index if not exists calls_slate_idx on calls (slate_id) where slate_id is not null;

create table if not exists slates (
  id            text primary key,
  chat_id       bigint not null,
  author_id     bigint not null,
  author_name   text not null,
  quote         text not null,
  created_at    timestamptz not null default now(),
  announced_at  timestamptz
);

-- A call spotted in conversation, waiting for its author to tap "log it".
create table if not exists pending_calls (
  id          text primary key,
  chat_id     bigint not null,
  author_id   bigint not null,
  draft       jsonb not null,
  created_at  timestamptz not null default now()
);

-- Chat members confirming a CS2 score.
create table if not exists score_votes (
  call_id   integer not null references calls (id),
  user_id   bigint not null,
  winner    text not null,
  primary key (call_id, user_id)
);

-- Why the author made a call, added by replying to its receipt.
create table if not exists call_reasons (
  id          serial primary key,
  call_id     integer not null references calls (id),
  text        text not null,
  created_at  timestamptz not null default now()
);

-- What the bot has learned about each member from their settled calls (latest only; history lives in Walrus Memory).
create table if not exists track_records (
  chat_id      bigint not null,
  author_id    bigint not null,
  author_name  text not null,
  summary      text not null,
  stats        jsonb not null,
  updated_at   timestamptz not null default now(),
  primary key (chat_id, author_id)
);

-- Groups the bot has seen, so the Mini App can list them when opened outside a group.
create table if not exists chats (
  chat_id     bigint primary key,
  title       text,
  updated_at  timestamptz not null default now()
);

-- Each "Log it" (accepted), "No" or "Not a call" (rejected) on a call the bot spotted, so it learns how each member talks.
create table if not exists call_feedback (
  id          serial primary key,
  chat_id     bigint not null,
  author_id   bigint not null,
  accepted    boolean not null,
  created_at  timestamptz not null default now()
);
create index if not exists call_feedback_author_idx on call_feedback (chat_id, author_id, id desc);

-- 'ask': offer to log calls spotted in chat; 'auto': log them straight away (admins choose).
create table if not exists chat_settings (
  chat_id  bigint primary key,
  mode     text not null default 'ask' check (mode in ('ask', 'auto'))
);
`;

let ready: Promise<Query> | undefined;

async function connect(): Promise<Query> {
  let query: Query;
  let exec: (sql: string) => Promise<unknown>;
  if (config.databaseUrl) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(config.databaseUrl);
    query = async (text, params = []) => (await sql.query(text, params)) as never;
    // The HTTP driver runs one statement per call; drop comments first, they may contain ";".
    exec = async (text) => {
      const statements = text.replace(/--.*$/gm, "").split(";").map((s) => s.trim()).filter(Boolean);
      for (const stmt of statements) await sql.query(stmt);
    };
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { mkdirSync } = await import("node:fs");
    mkdirSync(".data", { recursive: true });
    const db = new PGlite(".data/pglite");
    query = async (text, params = []) => (await db.query(text, params)).rows as never;
    exec = (text) => db.exec(text);
  }
  // Neon's HTTP driver sends the schema one statement at a time (~25 round trips), which a cold
  // start can't afford on every message, so it only runs when the schema text changed.
  const hash = createHash("sha256").update(SCHEMA).digest("hex").slice(0, 16);
  const applied = await query<{ hash: string }>(`select hash from schema_meta where id = 1`).catch(() => []);
  if (applied[0]?.hash !== hash) {
    await exec(SCHEMA);
    await exec(`create table if not exists schema_meta (id int primary key, hash text not null)`);
    await query(`insert into schema_meta (id, hash) values (1, $1) on conflict (id) do update set hash = excluded.hash`, [hash]);
  }
  return query;
}

export const db: Query = async (text, params) => {
  ready ??= connect();
  return (await ready)(text, params);
};
