// ---------------------------------------------------------------------------
// Webhook signature verification (HMAC-SHA256)
// ---------------------------------------------------------------------------

import crypto from 'crypto';

/**
 * Verify a GitHub webhook signature using HMAC-SHA256.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) return false;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const sig = Buffer.from(signature);
  const exp = Buffer.from(expected);

  if (sig.length !== exp.length) return false;

  return crypto.timingSafeEqual(sig, exp);
}
