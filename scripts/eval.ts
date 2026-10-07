// Replays the golden questions through the real pipeline and checks the answers.
//   npm run eval              all cases
//   npm run eval -- lane      only cases whose id contains "lane" (comma-separate several: lane,ar-)
// Uses a throwaway in-memory database. Costs real model calls, paced to stay under rate limits.
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { chat } from '../src/chat.js'
import { config } from '../src/config.js'
import { loadIndex } from '../src/knowledge.js'
import { PROMPT_VERSION, TEXT } from '../src/prompts.js'

interface Case {
  id: string
  turns: string[]
  audience?: string
  mustMatch?: string[]
  mustNotMatch?: string[]
  offerTeam?: boolean
  leadForm?: boolean
}

const filters = (process.argv[2] ?? '').split(',').filter(Boolean)
const cases = (JSON.parse(readFileSync('evals/golden.json', 'utf8')) as Case[]).filter((c) => !filters.length || filters.some((f) => c.id.includes(f)))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const SPACING = Number(process.env.EVAL_SPACING_MS ?? 1200)

const BUSY = [TEXT.en.busy, TEXT.ar.busy]
// A "busy" reply means the model was unavailable. That proves nothing either way, so it is never counted as a pass.
const results: { id: string; ok: boolean; inconclusive: boolean; failures: string[]; reply: string; audience: string }[] = []
for (const c of cases) {
  const sid = randomUUID()
  let last = await chat(sid, c.turns[0]!)
  for (const t of c.turns.slice(1)) { await sleep(SPACING); last = await chat(sid, t) }
  const failures: string[] = []
  if (c.audience && last.audience !== c.audience) failures.push(`audience was ${last.audience}, expected ${c.audience}`)
  for (const re of c.mustMatch ?? []) if (!new RegExp(re, 'i').test(last.reply)) failures.push(`missing /${re}/`)
  for (const re of c.mustNotMatch ?? []) if (new RegExp(re, 'i').test(last.reply)) failures.push(`contains forbidden /${re}/`)
  if (c.offerTeam !== undefined && (last.actions.offerTeam || last.actions.leadForm) !== c.offerTeam) failures.push(`expected team hand-off = ${c.offerTeam}`)
  if (c.leadForm !== undefined && last.actions.leadForm !== c.leadForm) failures.push(`expected lead form = ${c.leadForm}`)
  const inconclusive = BUSY.includes(last.reply)
  results.push({ id: c.id, ok: !failures.length && !inconclusive, inconclusive, failures, reply: last.reply, audience: last.audience })
  console.log(`${inconclusive ? 'INCONCLUSIVE (model unavailable)' : failures.length ? 'FAIL' : 'ok  '} ${c.id}${!inconclusive && failures.length ? '  <- ' + failures.join('; ') : ''}`)
  await sleep(SPACING)
}

const failed = results.filter((r) => !r.ok && !r.inconclusive)
const inconclusive = results.filter((r) => r.inconclusive)
mkdirSync('data', { recursive: true })
writeFileSync('data/eval-report.json', JSON.stringify({
  model: config.CHAT_MODEL, embedModel: config.EMBED_MODEL, promptVersion: PROMPT_VERSION, kbHash: loadIndex()?.kbHash,
  at: new Date().toISOString(), passed: results.length - failed.length - inconclusive.length, failed: failed.length, inconclusive: inconclusive.length, results,
}, null, 2))
console.log(`\n${results.length - failed.length - inconclusive.length} passed, ${failed.length} failed, ${inconclusive.length} inconclusive (model unavailable) of ${results.length}. Full replies: data/eval-report.json`)
if (inconclusive.length) console.log('Inconclusive cases are not passes. Re-run them when the model is available.')
process.exit(failed.length || inconclusive.length ? 1 : 0)
