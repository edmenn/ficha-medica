// Lightweight in-memory rate limiter.
// NOTE: On serverless/Vercel this is per-instance and best-effort, not a
// global limiter. For production-grade global limits, replace with a shared
// store (Upstash Redis / Vercel KV). This provides a baseline defense and a
// documented integration point.
const buckets = new Map<string, { count: number; resetAt: number }>()

export interface RateLimitOptions {
  limit: number
  windowMs: number
}

export function rateLimit(key: string, { limit, windowMs }: RateLimitOptions): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }

  bucket.count += 1
  if (bucket.count > limit) {
    return { allowed: false, remaining: 0 }
  }
  return { allowed: true, remaining: limit - bucket.count }
}

// Simple IP extraction from request headers. Best-effort behind proxies.
export function clientIp(req: Request): string {
  if (!req?.headers || typeof req.headers.get !== 'function') return 'unknown'
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}
