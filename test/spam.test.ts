import { describe, expect, it } from 'vitest'
import { checkFormToken, issueFormToken, tooManyLinks } from '../src/spam.js'

describe('form token', () => {
  const now = 10_000_000
  it('accepts a genuine token once it is old enough, and only once', () => {
    const t = issueFormToken(now)
    expect(checkFormToken(t, now + 5000, 3000)).toBe('ok')
    expect(checkFormToken(t, now + 6000, 3000)).toBe('used')
  })
  it('rejects a token that is too fresh, too old, forged or malformed', () => {
    expect(checkFormToken(issueFormToken(now), now + 500, 3000)).toBe('too_fast')
    expect(checkFormToken(issueFormToken(now), now + 3 * 60 * 60 * 1000, 3000)).toBe('expired')
    const [ts] = issueFormToken(now).split('.')
    expect(checkFormToken(`${ts}.${'0'.repeat(64)}`, now + 5000, 3000)).toBe('invalid')
    expect(checkFormToken(`${now - 99999}.${issueFormToken(now).split('.')[1]}`, now + 5000, 3000)).toBe('invalid')
    for (const bad of [undefined, '', 'x', '123', '.abc']) expect(checkFormToken(bad, now + 5000, 3000)).toBe('invalid')
  })
})

describe('tooManyLinks', () => {
  it('flags two or more links and allows ordinary messages', () => {
    expect(tooManyLinks('buy at http://a.com and www.b.com')).toBe(true)
    expect(tooManyLinks('I would like a demo for my 12 properties')).toBe(false)
    expect(tooManyLinks('my site is https://example.com')).toBe(false)
  })
})
