import { describe, expect, it } from 'vitest'
import { addMessage, db, saveLead } from '../src/db.js'
import { forgetByEmail, forgetSession } from '../src/forget.js'
import { withGuardrails, type Hit, type IndexedChunk } from '../src/knowledge.js'

const count = (table: string) => (db.prepare(`select count(*) n from ${table}`).get() as { n: number }).n

describe('deleting one person\'s data', () => {
  it('removes their leads and the chats those leads came from, and nothing else', () => {
    saveLead('s-ali', { email: 'ali@example.com', firstName: 'Ali' })
    addMessage('s-ali', 'user', 'hello'); addMessage('s-ali', 'assistant', 'hi')
    saveLead('s-sara', { email: 'sara@example.com', firstName: 'Sara' })
    addMessage('s-sara', 'user', 'hello')
    expect(forgetByEmail(' ALI@example.com ')).toEqual({ leads: 1, chatMessages: 2 })
    expect(count('leads')).toBe(1)
    expect(db.prepare(`select count(*) n from messages where session_id = 's-sara'`).get()).toEqual({ n: 1 })
  })
  it('deletes a single chat by session id', () => {
    addMessage('s-x', 'user', 'a'); addMessage('s-x', 'user', 'b')
    expect(forgetSession('s-x')).toBe(2)
  })
})

describe('withGuardrails', () => {
  const hit = (id: string, kind: 'fact' | 'guardrail', score: number): Hit => ({ score, chunk: { id, kind, audience: 'general', title: id, text: '', src: '', hash: id, vec: [] } as IndexedChunk })
  const hits = [hit('f1', 'fact', .9), hit('f2', 'fact', .8), hit('f3', 'fact', .7), hit('g1', 'guardrail', .65), hit('f4', 'fact', .6), hit('g2', 'guardrail', .55), hit('g3', 'guardrail', .5)]
  it('keeps the top results and adds close guardrails that ranked just below them', () => {
    expect(withGuardrails(hits, 3).map((h) => h.chunk.id)).toEqual(['f1', 'f2', 'f3', 'g1', 'g2'])
  })
  it('still adds later guardrails but never ordinary facts that ranked below the cut', () => {
    const ids = withGuardrails(hits, 4).map((h) => h.chunk.id)
    expect(ids).toEqual(['f1', 'f2', 'f3', 'g1', 'g2', 'g3'])
    expect(ids).not.toContain('f4')
  })
})
