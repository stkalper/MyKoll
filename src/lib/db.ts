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
create index if not exists calls_chat_idx on calls (chat_id, made_at desc);
create index if not exists calls_due_idx on calls (status, deadline);

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
  await exec(SCHEMA);
  return query;
}

export const db: Query = async (text, params) => {
  ready ??= connect();
  return (await ready)(text, params);
};
