import { describe, expect, it } from 'vitest'
import { leadStep, MAX_OFFERS } from '../src/leadpolicy.js'

describe('leadStep', () => {
  it('stays quiet for a visitor who shows no interest', () => {
    expect(leadStep({ offers: 0, submitted: false, interested: false })).toBe('none')
  })
  it('invites softly the first time interest shows', () => {
    expect(leadStep({ offers: 0, submitted: false, interested: true })).toBe('invite')
  })
  it('offers the form again after each answer, even to an ordinary question, until the limit', () => {
    expect(leadStep({ offers: 1, submitted: false, interested: false })).toBe('form')
    expect(leadStep({ offers: 2, submitted: false, interested: false })).toBe('form')
    expect(leadStep({ offers: MAX_OFFERS, submitted: false, interested: true })).toBe('none')
  })
  it('stops for good once the details were submitted', () => {
    expect(leadStep({ offers: 0, submitted: true, interested: true })).toBe('none')
    expect(leadStep({ offers: 1, submitted: true, interested: true })).toBe('none')
  })
})
