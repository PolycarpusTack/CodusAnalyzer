// ---------------------------------------------------------------------------
// GitHub App — JWT generation, installation token exchange, rate-limit-aware fetch
// ---------------------------------------------------------------------------

import crypto from 'crypto';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ── JWT generation (RS256) ─────────────────────────────────────────────────

function base64url(data: Buffer | string): string {
  const buf = typeof data === 'string' ? Buffer.from(data) : data;
  return buf.toString('base64url');
}

/**
 * Generate a JWT for GitHub App authentication.
 * Uses RS256 signing with the app's private key.
 */
export function generateAppJWT(): string {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyB64 = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKeyB64) {
    throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY are required');
  }

  const privateKey = Buffer.from(privateKeyB64, 'base64').toString('utf-8');
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iat: now - 60,    // issued 60s ago (clock drift)
    exp: now + 600,   // expires in 10 min (max allowed)
    iss: appId,
  }));

  const signature = crypto
    .createSign('RSA-SHA256')
    .update(`${header}.${payload}`)
    .sign(privateKey, 'base64url');

  return `${header}.${payload}.${signature}`;
}

// ── Installation token management ──────────────────────────────────────────

interface TokenCache {
  token: string;
  expiresAt: string;
}

/**
 * Get an installation access token, using a cached value if still valid.
 */
export async function getInstallationToken(installationId: number): Promise<string> {
  // Check DB cache
  const installation = await db.gitHubInstallation.findUnique({
    where: { installationId },
  });

  if (installation?.tokenCache) {
    try {
      const cached: TokenCache = JSON.parse(installation.tokenCache);
      const expiresAt = new Date(cached.expiresAt);
      // Use cached token if it has >5min left
      if (expiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
        return cached.token;
      }
    } catch {
      // Invalid cache — proceed to refresh
    }
  }

  // Exchange JWT for installation token
  const jwt = generateAppJWT();
  const res = await githubFetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to get installation token: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const token: string = data.token;
  const expiresAt: string = data.expires_at;

  // Cache the token
  if (installation) {
    await db.gitHubInstallation.update({
      where: { installationId },
      data: {
        tokenCache: JSON.stringify({ token, expiresAt }),
      },
    });
  }

  return token;
}

// ── Rate-limit-aware fetch wrapper ─────────────────────────────────────────

let rateLimitRemaining = 5000;
let rateLimitReset = 0;

/**
 * Fetch wrapper that respects GitHub API rate limits.
 * Retries with exponential backoff on 403/429.
 */
export async function githubFetch(
  url: string,
  options: RequestInit = {},
  retries = 3,
): Promise<Response> {
  // Wait if we've hit the rate limit
  if (rateLimitRemaining <= 10 && rateLimitReset > Date.now()) {
    const waitMs = rateLimitReset - Date.now() + 1000;
    logger.warn('GitHub rate limit approaching, waiting', { waitMs });
    await new Promise(r => setTimeout(r, Math.min(waitMs, 60000)));
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'CodeAnalyzer-App',
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(url, { ...options, headers });

  // Update rate limit tracking
  const remaining = res.headers.get('x-ratelimit-remaining');
  const reset = res.headers.get('x-ratelimit-reset');
  if (remaining) rateLimitRemaining = parseInt(remaining, 10);
  if (reset) rateLimitReset = parseInt(reset, 10) * 1000;

  // Retry on rate limit or server errors
  if ((res.status === 403 || res.status === 429 || res.status >= 500) && retries > 0) {
    const retryAfter = res.headers.get('retry-after');
    const waitMs = retryAfter
      ? parseInt(retryAfter, 10) * 1000
      : Math.pow(2, 3 - retries) * 1000;

    logger.warn('GitHub API retry', { status: res.status, retries, waitMs });
    await new Promise(r => setTimeout(r, waitMs));
    return githubFetch(url, options, retries - 1);
  }

  return res;
}
