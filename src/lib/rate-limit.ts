// ---------------------------------------------------------------------------
// Rate limiting — supports IP, userId, and API key based limiting
// ---------------------------------------------------------------------------

const DEFAULT_WINDOW_MS = 60_000; // 1 minute

// Tiered defaults (requests per minute)
const TIER_LIMITS: Record<string, number> = {
  anonymous: 10,
  user: 30,
  apikey: 60,
  admin: 120,
};

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const requests = new Map<string, RateLimitEntry>();

// Clean up stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of requests) {
    if (now > val.resetAt) requests.delete(key);
  }
}, 60_000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for an identifier.
 * @param identifier - IP address, userId, or apiKeyId
 * @param tier - 'anonymous' | 'user' | 'apikey' | 'admin'
 * @param customLimit - Override the tier default
 */
export function checkRateLimit(
  identifier: string,
  tier: string = 'anonymous',
  customLimit?: number,
): RateLimitResult {
  const maxRequests = customLimit ?? TIER_LIMITS[tier] ?? TIER_LIMITS.anonymous;
  const now = Date.now();
  const key = `${tier}:${identifier}`;
  const entry = requests.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + DEFAULT_WINDOW_MS;
    requests.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}
