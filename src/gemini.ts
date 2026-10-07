import { config, EMBED_DIMS } from './config.js'

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

export class GeminiError extends Error {
  constructor(public status: number, message: string) { super(message) }
  /** One-line description for logs: for quota errors, which limit was hit and when it resets. */
  get summary(): string {
    const id = this.message.match(/"quotaId"\s*:\s*"([^"]+)"/)?.[1]
    const value = this.message.match(/"quotaValue"\s*:\s*"([^"]+)"/)?.[1]
    const retry = this.message.match(/"retryDelay"\s*:\s*"([^"]+)"/)?.[1]
    return id ? `HTTP ${this.status} ${id} limit=${value ?? '?'} retryIn=${retry ?? '?'}` : `HTTP ${this.status} ${this.message.slice(0, 120).replace(/\s+/g, ' ')}`
  }
}
export class BudgetError extends Error {}

let budgetDay = new Date().toISOString().slice(0, 10)
let spent = 0

function spend(): void {
  const today = new Date().toISOString().slice(0, 10)
  if (today !== budgetDay) { budgetDay = today; spent = 0 }
  if (spent >= config.DAILY_LLM_BUDGET) throw new BudgetError('daily model-call budget reached')
  spent++
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function post(path: string, body: unknown, attempt = 0): Promise<any> {
  const key = config.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  spend()
  let res: Response
  try {
    res = await fetch(`${BASE}/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    })
  } catch (err) {
    if (attempt < 2) { await sleep(400 * 2 ** attempt); return post(path, body, attempt + 1) }
    throw new GeminiError(0, `network error: ${(err as Error).message}`)
  }
  if (res.ok) return res.json()
  const errText = await res.text()
  if ((res.status === 429 || res.status >= 500) && attempt < config.GEMINI_MAX_ATTEMPTS - 1) {
    const hinted = Number(errText.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/)?.[1]) * 1000
    const wait = Number.isFinite(hinted) ? hinted + 500 : 600 * 2 ** attempt + Math.random() * 300
    if (wait <= config.GEMINI_MAX_RETRY_WAIT_MS) {
      await sleep(wait)
      return post(path, body, attempt + 1)
    }
  }
  throw new GeminiError(res.status, errText.slice(0, 1500))
}

function normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1
  return v.map((x) => x / n)
}

/** Bump when the text sent for embedding changes, so old vectors are never mixed with new ones. */
export const EMBED_FORMAT = 'v2'

/**
 * gemini-embedding-2 has no task type: the task goes in the text (format from Google's embeddings page).
 * gemini-embedding-001 takes a taskType parameter.
 */
export function embedBody(text: string, kind: 'doc' | 'query', title?: string): Record<string, unknown> {
  if (config.EMBED_MODEL.startsWith('gemini-embedding-2')) {
    const content = kind === 'doc' ? `title: ${title || 'none'} | text: ${text}` : `task: search result | query: ${text}`
    return { content: { parts: [{ text: content }] }, outputDimensionality: EMBED_DIMS }
  }
  return {
    content: { parts: [{ text: kind === 'doc' && title ? `${title}\n${text}` : text }] },
    taskType: kind === 'doc' ? 'RETRIEVAL_DOCUMENT' : 'RETRIEVAL_QUERY',
    outputDimensionality: EMBED_DIMS,
    ...(title && kind === 'doc' ? { title } : {}),
  }
}

export async function embed(text: string, kind: 'doc' | 'query', title?: string): Promise<number[]> {
  const data = await post(`models/${config.EMBED_MODEL}:embedContent`, embedBody(text, kind, title))
  const values = data?.embedding?.values as number[] | undefined
  if (!values?.length) throw new GeminiError(502, 'embedding response had no values')
  return normalize(values)
}

export interface Turn { role: 'user' | 'model'; text: string }
export interface GenerateOptions {
  system: string
  turns: Turn[]
  maxTokens?: number
  temperature?: number
  /** Gemini responseSchema (OpenAPI subset, upper-case types). Sets JSON output. */
  schema?: Record<string, unknown>
}
export interface GenerateResult { text: string; tokensIn: number; tokensOut: number; blocked: boolean; truncated: boolean }

export async function generate(opts: GenerateOptions): Promise<GenerateResult> {
  const data = await post(`models/${config.CHAT_MODEL}:generateContent`, {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: opts.turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      maxOutputTokens: opts.maxTokens ?? 700,
      ...(opts.schema ? { responseMimeType: 'application/json', responseSchema: opts.schema } : {}),
    },
  })
  const cand = data?.candidates?.[0]
  const parts = (cand?.content?.parts ?? []) as { text?: string; thought?: boolean }[]
  const text = parts.filter((p) => !p.thought).map((p) => p.text ?? '').join('').trim()
  return {
    text,
    tokensIn: data?.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: data?.usageMetadata?.candidatesTokenCount ?? 0,
    blocked: !text && (!!data?.promptFeedback?.blockReason || cand?.finishReason === 'SAFETY'),
    // Thinking models spend part of the allowance on hidden reasoning, which can cut the visible reply off mid-sentence.
    truncated: cand?.finishReason === 'MAX_TOKENS',
  }
}
