// Deletes one person's data on request.
//   npm run forget -- --email someone@example.com   (their leads and the chats those leads came from)
//   npm run forget -- --session <uuid>               (one chat)
import { forgetByEmail, forgetSession } from '../src/forget.js'

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined }
const email = arg('email')
const session = arg('session')
if (email) console.log('Deleted:', forgetByEmail(email))
else if (session) console.log('Deleted chat messages:', forgetSession(session))
else { console.error('Use --email <address> or --session <uuid>'); process.exit(1) }
