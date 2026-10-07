import { z } from 'zod'

const bool = z.enum(['true', 'false']).default('false').transform((v) => v === 'true')

const schema = z.object({
  GEMINI_API_KEY: z.string().min(10).optional(),
  CHAT_MODEL: z.string().default('gemini-3.5-flash-lite'),
  EMBED_MODEL: z.string().default('gemini-embedding-2'),
  PORT: z.coerce.number().int().default(8787),
  // Origins allowed to embed the widget iframe (CSP frame-ancestors). No CORS: the widget calls its own origin.
  ALLOWED_ORIGINS: z.string().default('https://www.accez.cloud,https://accez.cloud,http://localhost:3000'),
  DATA_DIR: z.string().default('data'),
  DB_PATH: z.string().optional(),
  // The search index is built from the knowledge files and shipped with the app (the host's disk may be wiped on restart).
  INDEX_PATH: z.string().default('knowledge/index.json'),
  // Only true behind a reverse proxy that sets X-Forwarded-For. Otherwise the header is ignored.
  TRUST_PROXY: bool,
  // Leads are stored locally always. They are sent to Salesforce only when this is true.
  SALESFORCE_ENABLED: bool,
  SF_OID: z.string().default('00D41000002kA0p'),
  SF_RECORD_TYPE: z.string().default('012Pm000004jdap'),
  RETENTION_DAYS: z.coerce.number().int().default(90),
  // Hard cap on Gemini calls per day so a burst cannot burn the free quota.
  DAILY_LLM_BUDGET: z.coerce.number().int().default(2000),
  // Rate-limit handling: wait the API's suggested retry delay, up to this long, for this many attempts.
  GEMINI_MAX_RETRY_WAIT_MS: z.coerce.number().int().default(6000),
  GEMINI_MAX_ATTEMPTS: z.coerce.number().int().default(4),
  MIN_SCORE: z.coerce.number().default(0.5),
  // Lead-form spam protection: a form token must be at least this old before it is accepted (no human fills a form faster).
  MIN_FORM_MS: z.coerce.number().int().default(3000),
  LEAD_SECRET: z.string().min(16).optional(),
  // Number of reverse proxies in front of this service. X-Forwarded-For is read from the right, never the (spoofable) left.
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(1).default(1),
  // Whole-service cap on chat requests per minute, so rotating addresses cannot drain the model budget.
  GLOBAL_CHAT_PER_MINUTE: z.coerce.number().int().default(120),
  // Serving an index that does not match the knowledge files is unsafe. Only allow it on purpose.
  ALLOW_STALE_INDEX: bool,
  TOP_K: z.coerce.number().int().default(6),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid configuration:', z.prettifyError(parsed.error))
  process.exit(1)
}

export const config = parsed.data
export const EMBED_DIMS = 768
export const allowedOrigins = config.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
