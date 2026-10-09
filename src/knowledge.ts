import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { config, EMBED_DIMS } from './config.js'
import { EMBED_FORMAT } from './gemini.js'

export type Audience = 'pms' | 'provider' | 'resident' | 'general'
export const AUDIENCES: Audience[] = ['pms', 'provider', 'resident', 'general']

export interface Chunk {
  id: string
  audience: Audience
  /** "guardrail" chunks tell the assistant what it must NOT state, and are searchable for every audience. */
  kind: 'fact' | 'guardrail'
  title: string
  text: string
  src: string
  hash: string
  /** The answer depends on who is asking, so the assistant should ask which side the visitor is on. */
  askSide?: boolean
}
export interface IndexedChunk extends Chunk { vec: number[] }
export interface Index { embedModel: string; embedFormat?: string; kbHash?: string; dims: number; builtAt: string; chunks: IndexedChunk[] }

const BASE_DIR = join(process.cwd(), 'knowledge', 'base')
export const INDEX_PATH = config.INDEX_PATH

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

/** Parses one knowledge markdown file: front matter (audience, kind) then "## Title" sections. */
export function parseKnowledge(raw: string): Chunk[] {
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/)
  if (!fm) throw new Error('knowledge file is missing front matter')
  const meta = Object.fromEntries(
    fm[1]!.split('\n').map((l) => l.split(/:\s*/, 2) as [string, string]).filter(([k, v]) => k && v),
  )
  const audience = meta.audience as Audience
  if (!AUDIENCES.includes(audience)) throw new Error(`unknown audience "${meta.audience}"`)
  const kind = meta.kind === 'guardrail' ? 'guardrail' : 'fact'

  const used = new Set<string>()
  const chunks: Chunk[] = []
  for (const section of raw.slice(fm[0].length).split(/^## /m).slice(1)) {
    const nl = section.indexOf('\n')
    const title = section.slice(0, nl).trim()
    let body = section.slice(nl + 1)
    const srcMatch = body.match(/<!--\s*src:\s*([^>]*?)\s*-->/)
    body = body.replace(/<!--[\s\S]*?-->/g, '').trim()
    if (!title || !body) continue
    let id = `${audience}:${slug(title)}`
    for (let n = 2; used.has(id); n++) id = `${audience}:${slug(title)}-${n}`
    used.add(id)
    chunks.push({
      id, audience, kind, title, text: body, src: srcMatch?.[1] ?? '', ...(section.includes('<!-- ask-side -->') ? { askSide: true } : {}),
      hash: createHash('sha1').update(`${title}\n${body}`).digest('hex'),
    })
  }
  return chunks
}

export function loadChunks(dir = BASE_DIR): Chunk[] {
  return readdirSync(dir).filter((f) => f.endsWith('.md')).sort()
    .flatMap((f) => parseKnowledge(readFileSync(join(dir, f), 'utf8')))
}

/** One hash for the whole knowledge base: changes whenever any chunk is added, removed or edited. */
export function kbHash(chunks: Chunk[]): string {
  return createHash('sha1').update(chunks.map((c) => `${c.id}:${c.hash}`).sort().join('\n')).digest('hex')
}

/** An index is current only if it was built from exactly today's knowledge files with today's embedding format. */
export function indexProblem(idx: Index, chunks: Chunk[] = loadChunks()): string | null {
  if (idx.kbHash !== kbHash(chunks)) return 'the index was not built from the current knowledge files'
  if (idx.embedFormat !== EMBED_FORMAT) return 'the index was built with an older embedding format'
  return null
}

export function loadIndex(): Index | null {
  if (!existsSync(INDEX_PATH)) return null
  const idx = JSON.parse(readFileSync(INDEX_PATH, 'utf8')) as Index
  if (idx.embedModel !== config.EMBED_MODEL || idx.dims !== EMBED_DIMS) return null
  return idx
}

export const chunkText = (c: Chunk) => `${c.title}\n${c.text}`

export interface Hit { chunk: IndexedChunk; score: number }

/**
 * Vectors are unit length, so the dot product is the cosine similarity. Several query vectors (for example the
 * visitor's own words and the rewritten question) are allowed: each chunk keeps its best score.
 */
export function search(index: Index, queryVecs: number[][], audience: Audience, k = config.TOP_K): Hit[] {
  // A known audience only sees its own facts plus general ones. When the audience is not known yet, everything is
  // searchable and the answer prompt must say which side a fact belongs to.
  const pool = audience === 'general'
    ? index.chunks
    : index.chunks.filter((c) => c.kind === 'guardrail' || c.audience === 'general' || c.audience === audience)
  return pool
    .map((chunk) => ({
      chunk,
      score: Math.max(...queryVecs.map((q) => chunk.vec.reduce((s, x, i) => s + x * (q[i] ?? 0), 0))),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
}

/**
 * Keeps the best `k` results and adds up to `maxExtra` guardrail entries that ranked just below them. A "do not say this" rule that is
 * a close match must never be crowded out by ordinary facts that would contradict it.
 */
export function withGuardrails(hits: Hit[], k: number, maxExtra = 2): Hit[] {
  return [...hits.slice(0, k), ...hits.slice(k).filter((h) => h.chunk.kind === 'guardrail').slice(0, maxExtra)]
}
