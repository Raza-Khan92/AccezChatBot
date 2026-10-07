import { db } from './db.js'

/** Deletes a chat session: its messages and the session record. Returns how many messages were removed. */
export function forgetSession(sessionId: string): number {
  const removed = db.prepare('delete from messages where session_id = ?').run(sessionId).changes
  db.prepare('delete from sessions where id = ?').run(sessionId)
  return removed
}

/** Deletes everything held about one email address: its leads and the chat sessions those leads came from. */
export function forgetByEmail(email: string): { leads: number; chatMessages: number } {
  const e = email.trim().toLowerCase()
  const sessions = db.prepare(`select distinct session_id from leads where json_extract(payload, '$.email') = ?`).all(e) as { session_id: string }[]
  const chatMessages = sessions.reduce((n, s) => n + forgetSession(s.session_id), 0)
  const leads = db.prepare(`delete from leads where json_extract(payload, '$.email') = ?`).run(e).changes
  return { leads, chatMessages }
}
