import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { config } from './config.js'

const secret = config.LEAD_SECRET ?? randomBytes(32).toString('hex')
const MAX_AGE_MS = 2 * 60 * 60 * 1000
const used = new Set<string>()

const sign = (ts: string) => createHmac('sha256', secret).update(ts).digest('hex')

/** Issued when the lead form is shown. Proves the form was really opened, and when. */
export function issueFormToken(now = Date.now()): string {
  const ts = String(now)
  return `${ts}.${sign(ts)}`
}

export type TokenResult = 'ok' | 'invalid' | 'too_fast' | 'expired' | 'used'

/** A token must be genuine, not too fresh (a bot submits instantly), not too old, and usable once. */
export function checkFormToken(token: string | undefined, now = Date.now(), minAgeMs = config.MIN_FORM_MS): TokenResult {
  const [ts, sig] = (token ?? '').split('.')
  if (!ts || !sig || !/^\d+$/.test(ts)) return 'invalid'
  const good = Buffer.from(sign(ts))
  const given = Buffer.from(sig)
  if (good.length !== given.length || !timingSafeEqual(good, given)) return 'invalid'
  const age = now - Number(ts)
  if (age < minAgeMs) return 'too_fast'
  if (age > MAX_AGE_MS) return 'expired'
  if (used.has(token!)) return 'used'
  if (used.size > 10_000) used.clear()
  used.add(token!)
  return 'ok'
}

/** Spam almost always carries links. A genuine enquiry rarely has two. */
export function tooManyLinks(text: string): boolean {
  return (text.match(/https?:\/\/|www\./gi) ?? []).length >= 2
}
