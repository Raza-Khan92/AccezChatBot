import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { config } from './config.js'

const path = config.DB_PATH ?? join(config.DATA_DIR, 'assistant.db')
if (path !== ':memory:') mkdirSync(config.DATA_DIR, { recursive: true })

export const db = new Database(path)
db.pragma('journal_mode = WAL')
db.exec(`
  create table if not exists sessions (
    id text primary key,
    audience text not null default 'general',
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now'))
  );
  create table if not exists messages (
    id integer primary key autoincrement,
    session_id text not null,
    role text not null check (role in ('user','assistant')),
    content text not null,
    audience text,
    intent text,
    top_score real,
    unanswered integer not null default 0,
    tokens_in integer,
    tokens_out integer,
    latency_ms integer,
    created_at text not null default (datetime('now'))
  );
  create index if not exists messages_session on messages(session_id, id);
  create table if not exists leads (
    id integer primary key autoincrement,
    session_id text not null,
    payload text not null,
    sf_status text not null default 'local_only',
    sf_error text,
    created_at text not null default (datetime('now'))
  );
`)

function ensureColumn(table: string, column: string, ddl: string): void {
  const cols = db.prepare(`pragma table_info(${table})`).all() as { name: string }[]
  if (!cols.some((c) => c.name === column)) db.exec(`alter table ${table} add column ${column} ${ddl}`)
}
// So a wrong answer can be reconstructed later: which knowledge it used, which model and prompt wrote it, why a guard rejected it.
ensureColumn('messages', 'chunk_ids', 'text')
ensureColumn('messages', 'model', 'text')
ensureColumn('messages', 'prompt_version', 'text')
ensureColumn('messages', 'kb_hash', 'text')
ensureColumn('messages', 'guard_issue', 'text')
ensureColumn('leads', 'attempts', 'integer not null default 0')

export type Role = 'user' | 'assistant'
export interface StoredMessage { role: Role; content: string }

export function getSessionAudience(sessionId: string): string {
  const row = db.prepare('select audience from sessions where id = ?').get(sessionId) as { audience: string } | undefined
  return row?.audience ?? 'general'
}

export function touchSession(sessionId: string, audience: string): void {
  db.prepare(
    `insert into sessions (id, audience) values (?, ?)
     on conflict(id) do update set audience = excluded.audience, updated_at = datetime('now')`,
  ).run(sessionId, audience)
}

export function getHistory(sessionId: string, limit: number): StoredMessage[] {
  const rows = db
    .prepare('select role, content from messages where session_id = ? order by id desc limit ?')
    .all(sessionId, limit) as StoredMessage[]
  return rows.reverse()
}

export interface MessageMeta {
  audience?: string
  intent?: string
  topScore?: number
  unanswered?: boolean
  tokensIn?: number
  tokensOut?: number
  latencyMs?: number
  chunkIds?: string
  model?: string
  promptVersion?: string
  kbHash?: string
  guardIssue?: string
}

export function addMessage(sessionId: string, role: Role, content: string, meta: MessageMeta = {}): void {
  db.prepare(
    `insert into messages (session_id, role, content, audience, intent, top_score, unanswered, tokens_in, tokens_out, latency_ms,
                           chunk_ids, model, prompt_version, kb_hash, guard_issue)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    sessionId, role, content, meta.audience ?? null, meta.intent ?? null, meta.topScore ?? null,
    meta.unanswered ? 1 : 0, meta.tokensIn ?? null, meta.tokensOut ?? null, meta.latencyMs ?? null,
    meta.chunkIds ?? null, meta.model ?? null, meta.promptVersion ?? null, meta.kbHash ?? null, meta.guardIssue ?? null,
  )
}

export function saveLead(sessionId: string, payload: unknown): number {
  const r = db.prepare('insert into leads (session_id, payload) values (?, ?)').run(sessionId, JSON.stringify(payload))
  return Number(r.lastInsertRowid)
}

export function setLeadStatus(id: number, status: string, error?: string): void {
  db.prepare('update leads set sf_status = ?, sf_error = ? where id = ?').run(status, error ?? null, id)
}

/** Chats older than the retention window are deleted. Leads are business records and are kept. */
export function purgeOldChats(days: number): number {
  const cutoff = `-${Math.max(1, Math.floor(days))} days`
  const m = db.prepare(`delete from messages where created_at < datetime('now', ?)`).run(cutoff)
  db.prepare(`delete from sessions where updated_at < datetime('now', ?)`).run(cutoff)
  return m.changes
}
