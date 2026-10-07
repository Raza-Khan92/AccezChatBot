interface Bucket { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 20_000

/** Keeps memory bounded: first drop expired entries, then the oldest ones. */
function trim(now: number): void {
  if (buckets.size <= MAX_BUCKETS) return
  for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k)
  for (const k of buckets.keys()) {
    if (buckets.size <= MAX_BUCKETS / 2) break
    buckets.delete(k)
  }
}

/** Fixed-window limiter. Returns true if the call is allowed. In-memory: one process only. */
export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  trim(now)
  const b = buckets.get(key)
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (b.count >= limit) return false
  b.count++
  return true
}

setInterval(() => {
  const now = Date.now()
  for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k)
}, 60_000).unref()
