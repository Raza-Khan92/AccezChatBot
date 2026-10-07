import { describe, expect, it } from 'vitest'
import { app } from '../src/app.js'

const json = (body: unknown, ip = '198.51.100.1') => ({ method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) })
const sid = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b'

describe('http surface', () => {
  it('the public health page reveals nothing about the model or the knowledge', async () => {
    const res = await app.request('/health')
    expect(await res.json()).toEqual({ ok: true })
  })
  it('serves the widget with a strict CSP that limits who may embed it', async () => {
    const res = await app.request('/widget')
    expect(res.status).toBe(200)
    const csp = res.headers.get('content-security-policy') ?? ''
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain('frame-ancestors https://www.accez.cloud')
    expect(csp).not.toContain('unsafe-inline')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(await res.text()).toContain('Welcome! I&#39;m Accez Assistant'.replace('&#39;', "'"))
  })
  it('serves the widget script and styles', async () => {
    expect((await app.request('/widget.js')).headers.get('content-type')).toContain('javascript')
    expect((await app.request('/widget.css')).headers.get('content-type')).toContain('text/css')
  })
  it('returns 404 JSON for unknown paths and exposes no CORS headers', async () => {
    const res = await app.request('/nope')
    expect(res.status).toBe(404)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })
  it('rejects malformed chat requests before touching the model', async () => {
    expect((await app.request('/api/chat', json({ sessionId: 'x', message: 'hi' }))).status).toBe(422)
    expect((await app.request('/api/chat', json({ sessionId: sid, message: '   ' }))).status).toBe(422)
    expect((await app.request('/api/chat', json({ sessionId: sid, message: 'a'.repeat(601) }))).status).toBe(422)
    expect((await app.request('/api/chat', { method: 'POST', body: '{not json' })).status).toBe(400)
    expect((await app.request('/api/chat', json({ sessionId: sid, message: 'x'.repeat(9000) }))).status).toBe(413)
  })
  it('validates leads and names the failing fields', async () => {
    const res = await app.request('/api/lead', json({ sessionId: sid, firstName: 'A', lastName: 'B', email: 'bad', phone: '1', role: 'other', formToken: 'x' }))
    expect(res.status).toBe(422)
    const body = (await res.json()) as { ok: boolean; fields: string[] }
    expect(body.ok).toBe(false)
    expect(body.fields).toEqual(expect.arrayContaining(['email', 'phone']))
  })
  const lead = { sessionId: sid, firstName: 'Sara', lastName: 'Q', email: 'sara@example.com', phone: '+966501234567', role: 'property_manager' }
  const token = async (ip = '198.51.100.1') => ((await (await app.request('/api/lead-token', { headers: { 'x-forwarded-for': ip } })).json()) as { token: string }).token
  it('accepts a valid lead that carries a genuine form token', async () => {
    const res = await app.request('/api/lead', json({ ...lead, formToken: await token('198.51.100.2') }, '198.51.100.2'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
  it('refuses a lead with no token, a forged token, or a token used before', async () => {
    for (const formToken of ['', '123.abc', 'garbage']) {
      const res = await app.request('/api/lead', json({ ...lead, email: 'bot@example.com', formToken }, '198.51.100.3'))
      expect(res.status).toBe(422)
    }
    const t = await token('198.51.100.4')
    expect((await app.request('/api/lead', json({ ...lead, email: 'one@example.com', formToken: t }, '198.51.100.4'))).status).toBe(200)
    const again = await app.request('/api/lead', json({ ...lead, email: 'two@example.com', formToken: t }, '198.51.100.4'))
    expect(again.status).toBe(422)
    expect(await again.json()).toMatchObject({ reason: 'retry' })
  })
  it('refuses a message stuffed with links', async () => {
    const res = await app.request('/api/lead', json({ ...lead, email: 'spam@example.com', message: 'see http://a.example and http://b.example', formToken: await token('198.51.100.5') }, '198.51.100.5'))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ fields: ['message'] })
  })
})
