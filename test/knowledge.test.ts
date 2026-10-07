import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadChunks, parseKnowledge } from '../src/knowledge.js'

const sample = `---
audience: provider
kind: guardrail
---

## First topic?
Body one.
<!-- src: SP-001, DOC-002 -->

## Second topic
Body two <!-- hidden --> stays clean.

## Empty

## First topic?
Same title again.
`

describe('parseKnowledge', () => {
  const chunks = parseKnowledge(sample)
  it('reads audience and kind from front matter', () => {
    expect(chunks.every((c) => c.audience === 'provider' && c.kind === 'guardrail')).toBe(true)
  })
  it('splits sections, skips empty ones and strips comments', () => {
    expect(chunks.map((c) => c.title)).toEqual(['First topic?', 'Second topic', 'First topic?'])
    expect(chunks[1]!.text).toBe('Body two  stays clean.')
  })
  it('keeps the src comment as metadata', () => {
    expect(chunks[0]!.src).toBe('SP-001, DOC-002')
  })
  it('gives duplicate titles unique ids', () => {
    expect(new Set(chunks.map((c) => c.id)).size).toBe(chunks.length)
  })
  it('rejects a file with no front matter or an unknown audience', () => {
    expect(() => parseKnowledge('## A\nb')).toThrow()
    expect(() => parseKnowledge('---\naudience: nobody\n---\n## A\nb')).toThrow()
  })
})

// Lint of the real knowledge base: owner rulings that must never be contradicted by a stated fact.
describe('knowledge base lint', () => {
  const chunks = loadChunks()
  const facts = chunks.filter((c) => c.kind === 'fact')
  const forbidden: [string, RegExp][] = [
    ['"400+" channels (owner ruled it out)', /\b400\s*(\+|plus)/i],
    ['Checkout.com (not used)', /checkout\.com/i],
    ['unverified PM paid-plan prices', /SAR\s?(40|150)\b/],
    ['unverified transaction tax rates', /2\.5\s*(percent|%)/i],
    ['GDPR/PDPL/encryption claims (open question)', /\b(GDPR|PDPL)\b|encrypt/i],
    ['support hours / 24-7 claims (open question)', /24\s*\/\s*7|business hours.*(am|pm)/i],
    ['"instant" booking claims (open question)', /instant(ly)? (booking|confirm)/i],
    ['e-signature or online signing claims (owner ruling D-15)', /electronic sign|e-signature|public signing link|sign[^.]{0,30}online/i],
    ['assigning work orders to vendors or own-staff-only (owner ruling D-14)', /assign[^.]{0,60}vendor|vendors? [^.]{0,30}assign|own staff/i],
    ['the website Start Free button for sign-up (owner ruling D-13)', /\bStart Free\b/],
    ['any fee, commission or platform-fee percentage (owner ruling D-18)', /(fee|fees|commission)[^.\n]{0,60}\d+(\.\d+)?\s?%|\d+(\.\d+)?\s?%[^.\n]{0,60}(fee|fees|commission)/i],
    ['native mobile app claims (owner ruling D-24)', /\b(iphone|ios app|android app|app store|google play|native app|download the app)\b/i],
    ['a demo duration (owner ruling D-27)', /\b\d+\s?(minutes|mins)\b[^.]{0,40}\bdemo|\bdemo\b[^.]{0,60}\b\d+\s?(minutes|mins)\b/i],
    ['cash payments (owner ruling D-22)', /\bpay(s|ing)? (in )?cash|in cash|cash (on arrival|booking|payment)s?\b/i],
  ]
  for (const [label, re] of forbidden) {
    it(`no fact states ${label}`, () => {
      const hits = facts.filter((c) => re.test(`${c.title} ${c.text}`)).map((c) => c.id)
      expect(hits).toEqual([])
    })
  }
  it('nothing the bot can see uses internal or code-level language', () => {
    const internal = /webhook|endpoint|\bcron\b|middleware|controller|\bbackend\b|\bfrontend\b|database|stack ?trace|source ?code|codebase|\.env\b|localhost|staging|api key|secret key|access token|feature flag|commented out|\bstub\b|\bTODO\b|\benum\b|\.(tsx?|jsx?|mjs|sql)\b|\/src\/|\bJWT\b|\bSQL\b/i
    const hits = chunks.filter((c) => internal.test(`${c.title} ${c.text}`)).map((c) => c.id)
    expect(hits).toEqual([])
  })
  it('every chunk is substantial and traceable', () => {
    expect(chunks.length).toBeGreaterThan(100)
    const thin = chunks.filter((c) => c.text.split(/\s+/).length < 15).map((c) => c.id)
    expect(thin).toEqual([])
    const unsourced = facts.filter((c) => !c.src).map((c) => c.id)
    expect(unsourced).toEqual([])
  })
  it('chunk ids are globally unique', () => {
    expect(new Set(chunks.map((c) => c.id)).size).toBe(chunks.length)
  })
})

describe('labelled retrieval set', () => {
  it('names only knowledge entries that exist, so the set cannot silently drift from the knowledge', () => {
    const titles = new Set(loadChunks().map((c) => c.title.toLowerCase()))
    const cases = JSON.parse(readFileSync('evals/retrieval.json', 'utf8')) as { id: string; expect: string[] }[]
    expect(cases.length).toBeGreaterThan(30)
    const missing = cases.flatMap((c) => c.expect.filter((t) => !titles.has(t.toLowerCase())).map((t) => `${c.id}: ${t}`))
    expect(missing).toEqual([])
  })
})

describe('shipped search index', () => {
  it('was built from exactly the current knowledge files (re-run npm run ingest and commit knowledge/index.json after any knowledge edit)', async () => {
    const { readFileSync } = await import('node:fs')
    const { indexProblem } = await import('../src/knowledge.js')
    const idx = JSON.parse(readFileSync('knowledge/index.json', 'utf8'))
    expect(indexProblem(idx)).toBeNull()
  })
})
