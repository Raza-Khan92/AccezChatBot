import { serve } from '@hono/node-server'
import { app } from './app.js'
import { config } from './config.js'
import { purgeOldChats } from './db.js'
import { retryFailedLeads } from './leads.js'
import { indexProblem, loadIndex } from './knowledge.js'

const purge = () => {
  const deleted = purgeOldChats(config.RETENTION_DAYS)
  if (deleted) console.log(JSON.stringify({ evt: 'purge', deleted }))
}
purge()
// A server that stays up for months must keep enforcing retention, not only at boot.
setInterval(purge, 24 * 60 * 60 * 1000).unref()
// Leads that failed to reach Salesforce are retried every five minutes, up to five attempts each.
setInterval(() => { retryFailedLeads().then((n) => { if (n) console.log(JSON.stringify({ evt: 'lead_retry', delivered: n })) }).catch(() => {}) }, 5 * 60 * 1000).unref()

const idx = loadIndex()
const stale = idx ? indexProblem(idx) : 'there is no index'
if (stale && !config.ALLOW_STALE_INDEX) {
  console.error(JSON.stringify({ evt: 'startup_refused', reason: stale, fix: 'run npm run ingest' }))
  process.exit(1)
}

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(JSON.stringify({ evt: 'listening', port: info.port, chunks: loadIndex()?.chunks.length ?? 0, salesforce: config.SALESFORCE_ENABLED }))
})
