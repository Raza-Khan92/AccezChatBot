import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getConnInfo } from '@hono/node-server/conninfo'
import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { z } from 'zod'
import { chat } from './chat.js'
import { allowedOrigins, config } from './config.js'
import { createLead, leadSchema } from './leads.js'
import { GREETING } from './prompts.js'
import { pickClientIp } from './ip.js'
import { allow } from './ratelimit.js'
import { checkFormToken, issueFormToken, tooManyLinks } from './spam.js'

const WIDGET_DIR = join(process.cwd(), 'src', 'widget')
const assets: Record<string, { body: string; type: string }> = {
  '/widget': { body: readFileSync(join(WIDGET_DIR, 'index.html'), 'utf8').replace('__GREETING__', GREETING), type: 'text/html; charset=utf-8' },
  '/widget.css': { body: readFileSync(join(WIDGET_DIR, 'widget.css'), 'utf8'), type: 'text/css; charset=utf-8' },
  '/widget.js': { body: readFileSync(join(WIDGET_DIR, 'widget.js'), 'utf8'), type: 'text/javascript; charset=utf-8' },
}

const LOGO = readFileSync(join(WIDGET_DIR, 'logo.png'))
const MAX_BODY = 8 * 1024
const app = new Hono()

app.use('*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('Referrer-Policy', 'no-referrer')
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  c.header(
    'Content-Security-Policy',
    `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; ` +
      `base-uri 'none'; form-action 'none'; frame-ancestors ${allowedOrigins.join(' ') || "'none'"}`,
  )
})

function clientIp(c: Context): string {
  let socketIp: string | undefined
  try { socketIp = getConnInfo(c).remote.address } catch { socketIp = undefined }
  return pickClientIp(c.req.header('x-forwarded-for'), config.TRUSTED_PROXY_HOPS, config.TRUST_PROXY, socketIp)
}

async function readJson(c: Context): Promise<unknown> {
  const text = await c.req.text()
  if (text.length > MAX_BODY) throw new HttpError(413, 'request too large')
  try { return JSON.parse(text) } catch { throw new HttpError(400, 'invalid JSON') }
}
class HttpError extends Error { constructor(public status: 400 | 413 | 422 | 429, message: string) { super(message) } }

app.use('/api/*', bodyLimit({ maxSize: MAX_BODY, onError: (c) => c.json({ error: 'request too large' }, 413) }))

for (const [path, a] of Object.entries(assets)) {
  app.get(path, (c) => {
    c.header('Cache-Control', path === '/widget' ? 'no-cache' : 'public, max-age=300')
    return c.body(a.body, 200, { 'Content-Type': a.type })
  })
}

app.get('/logo.png', (c) => {
  c.header('Cache-Control', 'public, max-age=86400')
  return c.body(LOGO, 200, { 'Content-Type': 'image/png' })
})

app.get('/health', (c) => c.json({ ok: true }))

const chatBody = z.object({
  sessionId: z.uuid(),
  message: z.string().transform((s) => s.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim()).pipe(z.string().min(1).max(600)),
})

app.post('/api/chat', async (c) => {
  const ip = clientIp(c)
  // The global cap stops address rotation from draining the model budget; the per-address caps stop one visitor hogging it.
  if (!allow('chat-global', config.GLOBAL_CHAT_PER_MINUTE, 60_000)) throw new HttpError(429, 'we are busy right now, please try again in a minute')
  if (!allow(`chat:${ip}`, 20, 60_000) || !allow(`chat-day:${ip}`, 300, 86_400_000)) throw new HttpError(429, 'too many messages, please wait a moment')
  const body = chatBody.safeParse(await readJson(c))
  if (!body.success) throw new HttpError(422, 'a message of 1 to 600 characters is required')
  if (!allow(`chat-session:${body.data.sessionId}`, 40, 3_600_000)) throw new HttpError(429, 'too many messages, please wait a moment')
  c.header('Cache-Control', 'no-store')
  return c.json(await chat(body.data.sessionId, body.data.message))
})

app.get('/api/lead-token', (c) => {
  if (!allow(`lead-token:${clientIp(c)}`, 30, 3_600_000)) throw new HttpError(429, 'too many requests, please try again later')
  c.header('Cache-Control', 'no-store')
  return c.json({ token: issueFormToken() })
})

app.post('/api/lead', async (c) => {
  const ip = clientIp(c)
  if (!allow(`lead:${ip}`, 5, 3_600_000)) throw new HttpError(429, 'too many requests, please try again later')
  const body = leadSchema.safeParse(await readJson(c))
  if (!body.success) {
    const fields = Object.keys(z.flattenError(body.error).fieldErrors)
    return c.json({ ok: false, fields }, 422)
  }
  // Spam checks. A visitor who fails the token check is told to press the button again; links in the message are refused.
  const tokenResult = checkFormToken(body.data.formToken)
  if (tokenResult !== 'ok') return c.json({ ok: false, fields: [], reason: 'retry' }, 422)
  if (tooManyLinks(body.data.message)) return c.json({ ok: false, fields: ['message'] }, 422)
  c.header('Cache-Control', 'no-store')
  const lead = await createLead(body.data)
  console.log(JSON.stringify({ evt: 'lead', id: lead.id, status: lead.status, duplicate: lead.duplicate }))
  return c.json({ ok: true })
})

app.notFound((c) => c.json({ error: 'not found' }, 404))
app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status)
  console.error(JSON.stringify({ evt: 'unhandled', error: err.message }))
  return c.json({ error: 'something went wrong' }, 500)
})

export { app }
