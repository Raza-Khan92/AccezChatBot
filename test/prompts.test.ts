import { describe, expect, it } from 'vitest'
import { internalLeak } from '../src/guard.js'
import { answerSystem, buildUserTurn, CLASSIFIER_SCHEMA, TEXT } from '../src/prompts.js'

describe('answer prompt language handling', () => {
  it('keeps Arabic rules and the glossary out of English conversations', () => {
    expect(answerSystem('en')).not.toMatch(/[\u0600-\u06FF]/)
    expect(answerSystem('en')).not.toContain('ARABIC REPLIES')
  })
  it('adds the Arabic rules and the website glossary for Arabic conversations', () => {
    const ar = answerSystem('ar')
    expect(ar).toContain('ARABIC REPLIES')
    expect(ar).toContain('مقدم الخدمة')
    expect(ar).toContain('مدير العقارات')
    expect(ar).toContain('Western digits')
  })
  it('states the reply language explicitly on every turn', () => {
    const base = { boundary: 'b', audience: 'general' as const, intent: 'question' as const, context: [], message: 'hi' }
    expect(buildUserTurn({ ...base, lang: 'ar' })).toContain('Reply language: Arabic')
    expect(buildUserTurn({ ...base, lang: 'en' })).toContain('Reply language: English')
  })
  it('tells the assistant never to repeat the 400+ claim and to ask who people are in plain words', () => {
    expect(answerSystem('en')).toContain('400+')
    expect(answerSystem('en')).toMatch(/never a bare label/i)
  })
})

describe('fixed replies', () => {
  it('exist in both languages for every case', () => {
    for (const key of ['greeting', 'busy', 'unsure', 'handoff', 'abuse', 'problem', 'internal', 'content'] as const) {
      expect(TEXT.en[key].length).toBeGreaterThan(10)
      expect(TEXT.ar[key]).toMatch(/[\u0600-\u06FF]/)
    }
  })
  it('classifier must report a language', () => {
    expect(CLASSIFIER_SCHEMA.required).toContain('language')
  })
})

describe('problems and internal questions', () => {
  it('the classifier can route both to fixed replies', () => {
    const intents = (CLASSIFIER_SCHEMA.properties.intent as { enum: string[] }).enum
    expect(intents).toEqual(expect.arrayContaining(['problem_report', 'internal', 'provided_content']))
  })
  it('the fixed replies are safe: no internal words, and the problem reply points to Support', () => {
    for (const lang of ['en', 'ar'] as const) {
      for (const key of Object.keys(TEXT[lang]) as (keyof typeof TEXT.en)[]) {
        expect(internalLeak(TEXT[lang][key]), `${lang}.${key}`).toBeNull()
      }
      expect(TEXT[lang].problem).toContain('https://www.accez.cloud/support')
    }
  })
  it('the answer prompt forbids discussing internals and technical causes', () => {
    expect(answerSystem('en')).toContain('WHAT YOU NEVER DISCUSS')
    expect(answerSystem('en')).toMatch(/never guess or explain technical causes/i)
  })
})

describe('conduct rules in the answer prompt', () => {
  it('forbids criticism, inappropriate help, reading files and promises', () => {
    const rules = answerSystem('en')
    expect(rules).toMatch(/never criticise or speak negatively about Accez/i)
    expect(rules).toMatch(/never open links, read files/i)
    expect(rules).toMatch(/never promise or hint at a discount/i)
    expect(rules).toMatch(/only when you could not answer/i)
  })
})

