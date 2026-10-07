import { describe, expect, it } from 'vitest'
import { db } from '../src/db.js'
import { createLead, leadSchema, toSalesforceFields } from '../src/leads.js'

const base = {
  sessionId: '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b',
  firstName: 'Sara', lastName: 'Al Qahtani', email: 'Sara@Example.com', phone: '+966 50 123 4567',
  role: 'service_provider', formToken: 'x',
}

describe('leadSchema', () => {
  it('accepts a valid lead and normalises the email', () => {
    const r = leadSchema.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe('sara@example.com')
  })
  it('requires name, email and phone', () => {
    for (const k of ['firstName', 'lastName', 'email', 'phone'] as const) {
      expect(leadSchema.safeParse({ ...base, [k]: '' }).success).toBe(false)
    }
  })
  it('rejects bad emails, short or lettered phones and unknown roles', () => {
    expect(leadSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false)
    expect(leadSchema.safeParse({ ...base, phone: '12345' }).success).toBe(false)
    expect(leadSchema.safeParse({ ...base, phone: 'call me maybe' }).success).toBe(false)
    expect(leadSchema.safeParse({ ...base, role: 'hacker' }).success).toBe(false)
  })
  it('rejects a filled honeypot', () => {
    expect(leadSchema.safeParse({ ...base, website: 'http://spam.example' }).success).toBe(false)
  })
  it('strips control characters and neutralises spreadsheet formulas', () => {
    const r = leadSchema.parse({ ...base, firstName: '=HYPERLINK("x")', company: 'Acme\n\tLtd' })
    expect(r.firstName.startsWith("'=")).toBe(true)
    expect(r.company).toBe('Acme Ltd')
  })
})

describe('toSalesforceFields', () => {
  const lead = leadSchema.parse({ ...base, message: 'Need a demo', city: 'Riyadh' })
  const f = toSalesforceFields(lead, 'Visitor: hi')
  it('uses exactly the field names of the live web-to-lead form', () => {
    expect(Object.keys(f).sort()).toEqual(
      ['city', 'company', 'description', 'email', 'first_name', 'last_name', 'lead_source', 'mobile', 'oid', 'recordType'],
    )
    expect(f.lead_source).toBe('Chatbot')
    expect(f.oid).toBe('00D41000002kA0p')
    expect(f.mobile).toBe('+966 50 123 4567')
  })
  it('puts the role, message and transcript in the description and defaults the company', () => {
    expect(f.description).toContain('Role: Service provider')
    expect(f.description).toContain('Message: Need a demo')
    expect(f.description).toContain('Visitor: hi')
    expect(f.company).toBe('Not provided')
  })
})

describe('createLead', () => {
  it('stores locally without contacting Salesforce, and ignores a quick duplicate', async () => {
    const lead = leadSchema.parse({ ...base, email: 'dup@example.com' })
    const a = await createLead(lead)
    const b = await createLead(lead)
    expect(a.status).toBe('local_only')
    expect(b.duplicate).toBe(true)
    expect(b.id).toBe(a.id)
    const n = db.prepare("select count(*) as n from leads where json_extract(payload, '$.email') = ?").get('dup@example.com') as { n: number }
    expect(n.n).toBe(1)
  })
})
