import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/gemini.js', () => ({
  generate: async () => ({ text: JSON.stringify({ subject: 'Invoices not showing', summary: 'The customer cannot see invoices.' }), tokensIn: 0, tokensOut: 0, blocked: false, truncated: false }),
}))

const { addMessage } = await import('../src/db.js')
const { draftTicket } = await import('../src/ticket.js')

describe('draftTicket', () => {
  it('sends the summary plus only the last three messages', async () => {
    const sid = '7c1e2d3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f'
    for (let i = 1; i <= 8; i++) addMessage(sid, i % 2 ? 'user' : 'assistant', `message number ${i}`)
    const t = await draftTicket(sid)
    expect(t.subject).toBe('Invoices not showing')
    expect(t.description).toContain('The customer cannot see invoices.')
    expect(t.description).toContain('message number 8')
    expect(t.description).toContain('message number 6')
    expect(t.description).not.toContain('message number 5')
    expect((t.description.match(/message number/g) ?? []).length).toBe(3)
  })
  it('sends fewer when the chat is short', async () => {
    const sid = '8d2f3e4a-5b6c-4d7e-9f0a-1b2c3d4e5f60'
    addMessage(sid, 'user', 'only one')
    expect((await draftTicket(sid)).description).toContain('only one')
  })
})
