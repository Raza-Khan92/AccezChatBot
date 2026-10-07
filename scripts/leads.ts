// Lists captured leads: npm run leads            (table)
//                       npm run leads -- --json  (full records)
import { db } from '../src/db.js'

const rows = db.prepare('select id, session_id, payload, sf_status, sf_error, created_at from leads order by id desc').all() as {
  id: number; session_id: string; payload: string; sf_status: string; sf_error: string | null; created_at: string
}[]

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows.map((r) => ({ ...r, payload: JSON.parse(r.payload) })), null, 2))
} else if (!rows.length) {
  console.log('No leads yet.')
} else {
  console.table(rows.map((r) => {
    const p = JSON.parse(r.payload)
    return { id: r.id, when: r.created_at, name: `${p.firstName} ${p.lastName}`, email: p.email, phone: p.phone, role: p.role, status: r.sf_status }
  }))
}
