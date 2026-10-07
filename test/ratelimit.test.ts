import { describe, expect, it } from 'vitest'
import { allow } from '../src/ratelimit.js'

describe('allow', () => {
  it('allows up to the limit then blocks until the window resets', () => {
    const t = 1_000_000
    expect([1, 2, 3].map(() => allow('k1', 3, 1000, t))).toEqual([true, true, true])
    expect(allow('k1', 3, 1000, t + 10)).toBe(false)
    expect(allow('k1', 3, 1000, t + 1001)).toBe(true)
  })
  it('keeps separate keys separate', () => {
    expect(allow('a', 1, 1000, 5)).toBe(true)
    expect(allow('b', 1, 1000, 5)).toBe(true)
    expect(allow('a', 1, 1000, 6)).toBe(false)
  })
})
