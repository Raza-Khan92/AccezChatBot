import { describe, expect, it } from 'vitest'
import { pickClientIp } from '../src/ip.js'
import { allow } from '../src/ratelimit.js'

describe('pickClientIp', () => {
  it('ignores X-Forwarded-For unless a proxy is trusted', () => {
    expect(pickClientIp('1.2.3.4', 1, false, '9.9.9.9')).toBe('9.9.9.9')
  })
  it('reads from the right, so a forged left-hand entry changes nothing', () => {
    expect(pickClientIp('6.6.6.6, 203.0.113.7', 1, true, '10.0.0.1')).toBe('203.0.113.7')
    expect(pickClientIp('7.7.7.7, 203.0.113.7', 1, true, '10.0.0.1')).toBe('203.0.113.7')
    expect(pickClientIp('6.6.6.6, 203.0.113.7, 10.1.1.1', 2, true)).toBe('203.0.113.7')
  })
  it('falls back to the socket, and groups IPv6 by /64', () => {
    expect(pickClientIp(undefined, 1, true, '9.9.9.9')).toBe('9.9.9.9')
    expect(pickClientIp('2001:db8:1:2:aaaa:bbbb:cccc:dddd', 1, true)).toBe('2001:db8:1:2')
    expect(pickClientIp('2001:db8:1:2:1111:2222:3333:4444', 1, true)).toBe('2001:db8:1:2')
  })
})

describe('rate limiter memory', () => {
  it('stays bounded however many different keys arrive', () => {
    const t = 5_000_000
    for (let i = 0; i < 30_000; i++) allow(`flood-${i}`, 5, 60_000, t)
    // After trimming, an old key is gone and a fresh one is still limited correctly.
    expect(allow('flood-29999', 1, 60_000, t)).toBe(false)
    expect(allow('flood-0', 1, 60_000, t)).toBe(true)
  })
})

describe('dedicated client address header', () => {
  it('uses the host\'s own header when it is set and proxies are trusted, ignoring a forged X-Forwarded-For', () => {
    expect(pickClientIp('9.9.9.9, 8.8.8.8', 1, true, '10.0.0.1', '203.0.113.7')).toBe('203.0.113.7')
  })
  it('ignores it when proxies are not trusted', () => {
    expect(pickClientIp(undefined, 1, false, '10.0.0.1', '203.0.113.7')).toBe('10.0.0.1')
  })
  it('falls back to X-Forwarded-For when the header is missing', () => {
    expect(pickClientIp('9.9.9.9, 8.8.8.8', 1, true, '10.0.0.1', undefined)).toBe('8.8.8.8')
  })
})
