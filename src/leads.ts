import { z } from 'zod'
import { config } from './config.js'
import { db, getHistory, saveLead, setLeadStatus } from './db.js'
import { redact } from './guard.js'

export const ROLES = {
  property_manager: 'Property manager',
  property_owner: 'Property owner',
  service_provider: 'Service provider',
  resident_guest: 'Resident or guest',
  other: 'Other',
} as const

const control = /[\u0000-\u001f\u007f]/g
/** Single-line text: no control characters, collapsed whitespace, and no leading spreadsheet-formula character. */
const line = (max: number) =>
  z.string().transform((s) => s.replace(control, ' ').replace(/\s+/g, ' ').trim()).pipe(z.string().max(max))
const safeLine = (max: number) => line(max).transform((s) => (/^[=+\-@]/.test(s) ? `'${s}` : s))

export const leadSchema = z.object({
  sessionId: z.uuid(),
  // Limits match the maxLength values of the live Salesforce web-to-lead form.
  firstName: safeLine(40).pipe(z.string().min(1)),
  lastName: safeLine(80).pipe(z.string().min(1)),
  email: z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(80)),
  phone: z.string().trim().max(40).refine(
    (p) => /^[+\d\s().-]+$/.test(p) && p.replace(/\D/g, '').length >= 7 && p.replace(/\D/g, '').length <= 15,
    'enter a valid phone number',
  ),
  role: z.enum(Object.keys(ROLES) as [keyof typeof ROLES, ...(keyof typeof ROLES)[]]),
  company: safeLine(40).optional().default(''),
  city: safeLine(40).optional().default(''),
  message: z.string().transform((s) => s.replace(control, ' ').trim()).pipe(z.string().max(1000)).optional().default(''),
  /** Proof the form was really opened: issued by /api/lead-token, signed, single-use. */
  formToken: z.string().max(200),
  /** Honeypot. Real visitors never see or fill it. */
  website: z.string().max(0).optional(),
})
export type LeadInput = z.infer<typeof leadSchema>

/**
 * Field names match the Salesforce web-to-lead form already live on accez.cloud
 * (first_name, last_name, email, company, mobile, city, description, lead_source, recordType, oid).
 * No custom fields are invented: the visitor's role goes into description.
 */
export function toSalesforceFields(lead: LeadInput, transcript: string): Record<string, string> {
  const description = [
    `Role: ${ROLES[lead.role]}`,
    lead.message ? `Message: ${redact(lead.message)}` : '',
    `Source: Accez Assistant chatbot (session ${lead.sessionId.slice(0, 8)})`,
    transcript ? `Recent conversation:\n${redact(transcript)}` : '',
  ].filter(Boolean).join('\n').slice(0, 3000) // the live form allows 3000 characters
  return {
    oid: config.SF_OID,
    recordType: config.SF_RECORD_TYPE,
    lead_source: 'Chatbot',
    first_name: lead.firstName,
    last_name: lead.lastName,
    email: lead.email,
    // Salesforce requires a company on a lead. The site form leaves it to the visitor.
    company: lead.company || 'Not provided',
    mobile: lead.phone,
    city: lead.city,
    description,
  }
}

export function transcriptFor(sessionId: string): string {
  return getHistory(sessionId, 6)
    .map((m) => `${m.role === 'user' ? 'Visitor' : 'Assistant'}: ${m.content.replace(/\s+/g, ' ').slice(0, 220)}`)
    .join('\n')
}

const SF_URL = `https://webto.salesforce.com/servlet/servlet.WebToLead?encoding=UTF-8&orgId=${config.SF_OID}`

/** Salesforce web-to-lead never reports delivery: a 200 or 302 only means it accepted the POST. */
async function postToSalesforce(fields: Record<string, string>): Promise<void> {
  const res = await fetch(SF_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  })
  if (res.status >= 400) throw new Error(`Salesforce returned ${res.status}`)
}

export interface LeadResult { id: number; status: 'local_only' | 'submitted' | 'failed'; duplicate: boolean }

export async function createLead(lead: LeadInput): Promise<LeadResult> {
  const dup = db.prepare(
    `select id, sf_status from leads where session_id = ? and json_extract(payload, '$.email') = ?
     and sf_status != 'failed' and created_at > datetime('now', '-10 minutes')`,
  ).get(lead.sessionId, lead.email) as { id: number; sf_status: LeadResult['status'] } | undefined
  if (dup) return { id: dup.id, status: dup.sf_status, duplicate: true }

  const { website: _honeypot, formToken: _token, ...clean } = lead
  const id = saveLead(lead.sessionId, clean)
  if (!config.SALESFORCE_ENABLED) return { id, status: 'local_only', duplicate: false }
  try {
    await postToSalesforce(toSalesforceFields(lead, transcriptFor(lead.sessionId)))
    setLeadStatus(id, 'submitted')
    return { id, status: 'submitted', duplicate: false }
  } catch (err) {
    setLeadStatus(id, 'failed', (err as Error).message)
    db.prepare('update leads set attempts = attempts + 1 where id = ?').run(id)
    console.error(JSON.stringify({ evt: 'lead_failed', id, error: (err as Error).message.slice(0, 120) }))
    return { id, status: 'failed', duplicate: false }
  }
}

/** Retries leads that Salesforce did not accept. Returns how many were delivered this round. */
export async function retryFailedLeads(): Promise<number> {
  if (!config.SALESFORCE_ENABLED) return 0
  const rows = db.prepare(`select id, session_id, payload from leads where sf_status = 'failed' and attempts < 5 order by id limit 20`).all() as
    { id: number; session_id: string; payload: string }[]
  let delivered = 0
  for (const r of rows) {
    const parsed = leadSchema.safeParse({ ...JSON.parse(r.payload), sessionId: r.session_id })
    if (!parsed.success) { db.prepare('update leads set attempts = 5 where id = ?').run(r.id); continue }
    try {
      await postToSalesforce(toSalesforceFields(parsed.data, transcriptFor(r.session_id)))
      setLeadStatus(r.id, 'submitted')
      delivered++
    } catch (err) {
      setLeadStatus(r.id, 'failed', (err as Error).message)
      db.prepare('update leads set attempts = attempts + 1 where id = ?').run(r.id)
    }
  }
  return delivered
}
