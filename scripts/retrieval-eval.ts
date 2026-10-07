// Checks that search finds the right knowledge for real questions. Costs embedding calls only, no generation.
//   npm run retrieval-eval
// recall@k: how often at least one expected entry is among the top results. MRR: how high the first hit ranks.
import { readFileSync } from 'node:fs'
import { config } from '../src/config.js'
import { embed } from '../src/gemini.js'
import { indexProblem, loadIndex, search, type Audience } from '../src/knowledge.js'

interface Case { id: string; q: string; audience: Audience; expect: string[] }
const idx = loadIndex()
if (!idx) { console.error('No index: run npm run ingest'); process.exit(1) }
const problem = indexProblem(idx)
if (problem) { console.error(`Stale index: ${problem}. Run npm run ingest`); process.exit(1) }

const cases = JSON.parse(readFileSync('evals/retrieval.json', 'utf8')) as Case[]
const threshold = Number(process.env.RECALL_THRESHOLD ?? 0.85)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let hits = 0
let rrSum = 0
const misses: string[] = []
const scores: number[] = []
for (const c of cases) {
  const found = search(idx, [await embed(c.q, 'query')], c.audience, config.TOP_K)
  const want = c.expect.map((t) => t.toLowerCase())
  const rank = found.findIndex((h) => want.includes(h.chunk.title.toLowerCase()))
  scores.push(found[0]?.score ?? 0)
  if (rank >= 0) { hits++; rrSum += 1 / (rank + 1) } else misses.push(`${c.id} [${c.audience}] ${c.q}\n      wanted: ${c.expect.join(' | ')}\n      got:    ${found.slice(0, 3).map((h) => h.chunk.title).join(' | ')}`)
  await sleep(Number(process.env.EVAL_SPACING_MS ?? 700))
}
const recall = hits / cases.length
console.log(`recall@${config.TOP_K}: ${(recall * 100).toFixed(1)}% (${hits}/${cases.length})  MRR: ${(rrSum / cases.length).toFixed(3)}  top score min/median: ${Math.min(...scores).toFixed(3)} / ${scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)]!.toFixed(3)}`)
if (misses.length) console.log('\nMisses:\n' + misses.map((m) => '  ' + m).join('\n'))
process.exit(recall >= threshold ? 0 : 1)
