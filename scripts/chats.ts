// Review conversations: npm run chats                 (latest 40 messages)
//                       npm run chats -- --unanswered (questions the bot could not answer)
import { db } from '../src/db.js'

const unanswered = process.argv.includes('--unanswered')
const rows = unanswered
  ? db.prepare(
      `select (select content from messages u where u.session_id = a.session_id and u.role = 'user' and u.id < a.id order by u.id desc limit 1) as question,
              a.audience, a.top_score, a.chunk_ids, a.guard_issue, a.created_at
       from messages a where a.role = 'assistant' and a.unanswered = 1 order by a.id desc limit 100`,
    ).all()
  : db.prepare(
      `select session_id, role, substr(content, 1, 140) as content, audience, intent, top_score, latency_ms, created_at
       from messages order by id desc limit 40`,
    ).all()

if (!rows.length) console.log('Nothing to show.')
else console.table(rows)
