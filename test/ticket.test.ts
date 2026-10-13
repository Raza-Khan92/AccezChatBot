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

describe('offer counting', () => {
  it('counts only the assistant messages that invited the visitor, and knows when a lead was saved', async () => {
    const { addMessage, countLeadOffers, hasLead, saveLead } = await import('../src/db.js')
    const sid = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
    addMessage(sid, 'user', 'if you like, I can take your details here')
    addMessage(sid, 'assistant', 'Plans start free. If you\'d like, I can take your details here so the Accez team can follow up with you.')
    addMessage(sid, 'assistant', 'Something else without an invitation.')
    addMessage(sid, 'assistant', 'Happy to connect you with the Accez team. Share a few details below and someone will follow up with you.')
    expect(countLeadOffers(sid, ["I can take your details here", 'Share a few details below'])).toBe(2)
    expect(hasLead(sid)).toBe(false)
    saveLead(sid, { firstName: 'A' } as never)
    expect(hasLead(sid)).toBe(true)
  })
})
