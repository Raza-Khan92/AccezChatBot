import { describe, expect, it, vi } from 'vitest'

// The model is replaced by fixed answers so the conversation rules can be checked without any real model call.
let nextIntent = 'question'
vi.mock('../src/gemini.js', () => ({
  GeminiError: class extends Error { status = 0; summary = '' },
  BudgetError: class extends Error {},
  EMBED_FORMAT: 'v2',
  embed: async () => { const v = new Array(768).fill(0); v[0] = 1; return v },
  generate: async (o: { schema?: unknown }) => ({
    text: o.schema
      ? JSON.stringify({ audience: 'pms', intent: nextIntent, language: 'en', query: 'plans', interest: true })
      : 'Here is the answer.',
    tokensIn: 1, tokensOut: 1, blocked: false, truncated: false,
  }),
}))

const { chat } = await import('../src/chat.js')
const { saveLead } = await import('../src/db.js')
const P = await import('../src/prompts.js')

const ask = async (sid: string, text: string) => chat(sid, text)
const has = (reply: string, t: string) => reply.includes(t)

describe('offers to take details', () => {
  it('invites once, offers the form again after the next two answers, then stops', async () => {
    nextIntent = 'question'
    const sid = 'a1b2c3d4-0001-4aaa-8bbb-000000000001'
    const r1 = await ask(sid, 'what does it cost for 20 units')
    expect(has(r1.reply, P.TEXT.en.invite)).toBe(true)
    expect(r1.actions.offerTeam).toBe(true)
    const r2 = await ask(sid, 'and for hotels?')
    expect(has(r2.reply, P.TEXT.en.handoff)).toBe(true)
    expect(r2.actions.leadForm).toBe(true)
    const r3 = await ask(sid, 'what about channels?')
    expect(r3.actions.leadForm).toBe(true)
    const r4 = await ask(sid, 'and owners?')
    expect(r4.actions.leadForm).toBe(false)
    expect(r4.actions.offerTeam).toBe(false)
    expect(has(r4.reply, P.TEXT.en.invite) || has(r4.reply, P.TEXT.en.handoff)).toBe(false)
  })
})

describe('after the details were submitted', () => {
  it('keeps answering, says the details were received, then that the team will get back, then nothing more, and never reopens the form', async () => {
    nextIntent = 'question'
    const sid = 'a1b2c3d4-0002-4aaa-8bbb-000000000002'
    saveLead(sid, { firstName: 'A' } as never)
    const r1 = await ask(sid, 'does it support arabic')
    expect(r1.reply).toContain('Here is the answer.')
    expect(has(r1.reply, P.TEXT.en.received)).toBe(true)
    expect(r1.actions.leadForm || r1.actions.offerTeam).toBe(false)
    const r2 = await ask(sid, 'and channels')
    expect(r2.reply).toContain('Here is the answer.')
    expect(has(r2.reply, P.TEXT.en.soon)).toBe(true)
    const r3 = await ask(sid, 'one more thing')
    expect(r3.reply).toContain('Here is the answer.')
    expect(has(r3.reply, P.TEXT.en.received) || has(r3.reply, P.TEXT.en.soon)).toBe(false)
  })
  it('does not reopen the form when they ask for the team again', async () => {
    nextIntent = 'wants_human'
    const sid = 'a1b2c3d4-0003-4aaa-8bbb-000000000003'
    saveLead(sid, { firstName: 'B' } as never)
    const r = await ask(sid, 'please call me')
    expect(r.actions.leadForm).toBe(false)
    expect(r.reply).toBe(P.TEXT.en.received)
  })
})
