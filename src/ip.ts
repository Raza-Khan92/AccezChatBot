/**
 * The caller's address. Behind trusted proxies it is the entry `hops` from the RIGHT of X-Forwarded-For: everything left of
 * it is client-supplied and can be forged. IPv6 is grouped by /64, because one user controls a whole /64.
 */
export function pickClientIp(xForwardedFor: string | undefined, hops: number, trustProxy: boolean, socketIp?: string): string {
  let ip: string | undefined
  if (trustProxy) {
    const parts = xForwardedFor?.split(',').map((p) => p.trim()).filter(Boolean) ?? []
    ip = parts[parts.length - hops]
  }
  ip ??= socketIp ?? 'unknown'
  return ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip
}
