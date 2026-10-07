// Builds knowledge/index.json (committed, shipped with the app): every knowledge chunk plus its embedding.
// Paced to stay under the embedding rate limit. Finished vectors are cached, so a re-run resumes where it stopped.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { config, EMBED_DIMS } from '../src/config.js'
import { EMBED_FORMAT, embed, GeminiError } from '../src/gemini.js'
import { INDEX_PATH, kbHash, loadChunks, loadIndex, type IndexedChunk } from '../src/knowledge.js'

const CACHE_PATH = join(config.DATA_DIR, 'embed-cache.json')
const SPACING_MS = Number(process.env.INGEST_SPACING_MS ?? 800)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const chunks = loadChunks()
if (!chunks.length) { console.error('No knowledge chunks found in knowledge/base'); process.exit(1) }

const previous = loadIndex()
const cache = new Map<string, number[]>(previous?.embedFormat === EMBED_FORMAT ? previous.chunks.map((c) => [c.hash, c.vec]) : [])
if (existsSync(CACHE_PATH)) {
  const saved = JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as { model: string; fmt?: string; vecs: Record<string, number[]> }
  if (saved.model === config.EMBED_MODEL && saved.fmt === EMBED_FORMAT) for (const [h, v] of Object.entries(saved.vecs)) cache.set(h, v)
}
const saveCache = () => {
  mkdirSync(dirname(CACHE_PATH), { recursive: true })
  writeFileSync(CACHE_PATH, JSON.stringify({ model: config.EMBED_MODEL, fmt: EMBED_FORMAT, vecs: Object.fromEntries(cache) }))
}

const todo = chunks.filter((c) => !cache.has(c.hash))
let done = 0
for (const c of todo) {
  for (let attempt = 0; ; attempt++) {
    try {
      const vec = await embed(c.text, 'doc', c.title)
      cache.set(c.hash, vec.map((x) => Math.round(x * 1e6) / 1e6))
      break
    } catch (err) {
      if (err instanceof GeminiError && err.status === 429 && attempt < 8) {
        console.log(`rate limited, waiting 20s (retry ${attempt + 1})`)
        await sleep(20_000)
        continue
      }
      saveCache()
      console.error(`embed failed for ${c.id}: ${(err as Error).message.slice(0, 200)}\nProgress saved (${cache.size} vectors). Re-run to resume.`)
      process.exit(1)
    }
  }
  if (++done % 20 === 0) { saveCache(); console.log(`embedded ${done}/${todo.length}`) }
  await sleep(SPACING_MS)
}
saveCache()

const out: IndexedChunk[] = chunks.map((c) => ({ ...c, vec: cache.get(c.hash)! }))
mkdirSync(dirname(INDEX_PATH), { recursive: true })
writeFileSync(INDEX_PATH, JSON.stringify({ embedModel: config.EMBED_MODEL, embedFormat: EMBED_FORMAT, kbHash: kbHash(chunks), dims: EMBED_DIMS, builtAt: new Date().toISOString(), chunks: out }))

const by = Object.groupBy(chunks, (c) => c.audience)
console.log(`Indexed ${chunks.length} chunks (${todo.length} embedded, ${chunks.length - todo.length} reused):`,
  Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v!.length])))
const short = chunks.filter((c) => c.text.split(/\s+/).length < 15)
if (short.length) console.warn(`Warning: ${short.length} very short chunks:`, short.map((c) => c.id).slice(0, 8))
