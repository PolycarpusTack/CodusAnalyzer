import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const WEBHOOK_WINDOW_MS = 60_000; // 1 minute
const WEBHOOK_MAX_REQUESTS = 5;

const webhookRequests = new Map<string, { count: number; resetAt: number }>();

// Clean up stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of webhookRequests) {
    if (now > val.resetAt) webhookRequests.delete(key);
  }
}, 60_000);

function checkWebhookRateLimit(identifier: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = webhookRequests.get(identifier);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + WEBHOOK_WINDOW_MS;
    webhookRequests.set(identifier, { count: 1, resetAt });
    return { allowed: true, remaining: WEBHOOK_MAX_REQUESTS - 1, resetAt };
  }

  entry.count++;
  if (entry.count > WEBHOOK_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: WEBHOOK_MAX_REQUESTS - entry.count, resetAt: entry.resetAt };
}

async function runReview(code: string, language: string, fileName?: string, preset?: string) {
  // Call the internal review API
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  const res = await fetch(`${baseUrl}/api/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      language,
      fileName: fileName || 'webhook-submission',
      preset: preset || 'full',
      saveHistory: false,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Review failed' }));
    throw new Error(err.error || `Review failed (${res.status})`);
  }

  return res.json();
}

function extractGitHubPushInfo(payload: Record<string, unknown>): { code: string; language: string; fileName: string } | null {
  // For push events, extract the most recently modified file info from commits
  const commits = payload.commits as Array<Record<string, unknown>> | undefined;
  if (!commits || commits.length === 0) return null;

  const latestCommit = commits[commits.length - 1];
  const modified = latestCommit.modified as string[] | undefined;
  const added = latestCommit.added as string[] | undefined;

  const files = [...(modified || []), ...(added || [])];
  if (files.length === 0) return null;

  // We can only provide metadata; actual content would need fetching
  return {
    code: `// Push event received for: ${files.join(', ')}\n// Commit: ${latestCommit.message || 'unknown'}\n// Full review requires fetching file contents from the repository.`,
    language: 'javascript',
    fileName: files[0],
  };
}

function extractGitHubPRInfo(payload: Record<string, unknown>): { code: string; language: string; fileName: string } | null {
  const pullRequest = payload.pull_request as Record<string, unknown> | undefined;
  if (!pullRequest) return null;

  const title = pullRequest.title as string || 'Untitled PR';
  const body = pullRequest.body as string || '';
  const number = pullRequest.number as number;

  return {
    code: `// Pull Request #${number}: ${title}\n// ${body}\n// Full review requires fetching changed files from the PR.`,
    language: 'javascript',
    fileName: `PR-${number}`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'anonymous';
    const rateLimit = checkWebhookRateLimit(clientIp);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 5 requests per minute for webhooks.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
        }
      );
    }

    // Validate webhook secret
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret) {
      const providedSecret = request.headers.get('x-webhook-secret');
      if (providedSecret !== webhookSecret) {
        return NextResponse.json(
          { error: 'Invalid webhook secret' },
          { status: 401 }
        );
      }
    }

    const body = await request.json();

    let code: string;
    let language: string;
    let fileName: string | undefined;
    let preset: string | undefined;
    let callbackUrl: string | undefined;

    // Check if this is a GitHub webhook event
    const githubEvent = request.headers.get('x-github-event');

    if (githubEvent) {
      let extracted: { code: string; language: string; fileName: string } | null = null;

      if (githubEvent === 'push') {
        extracted = extractGitHubPushInfo(body);
      } else if (githubEvent === 'pull_request') {
        extracted = extractGitHubPRInfo(body);
      }

      if (!extracted) {
        return NextResponse.json(
          { message: `Received ${githubEvent} event but no reviewable content found.` },
          { status: 200 }
        );
      }

      code = extracted.code;
      language = extracted.language;
      fileName = extracted.fileName;
      callbackUrl = body.callbackUrl as string | undefined;
    } else {
      // Standard webhook format
      code = body.code;
      language = body.language;
      fileName = body.fileName;
      preset = body.preset;
      callbackUrl = body.callbackUrl;

      if (!code || typeof code !== 'string') {
        return NextResponse.json({ error: 'code is required' }, { status: 400 });
      }

      if (!language || typeof language !== 'string') {
        return NextResponse.json({ error: 'language is required' }, { status: 400 });
      }
    }

    // If callbackUrl is provided, process asynchronously
    if (callbackUrl && typeof callbackUrl === 'string') {
      // Respond immediately with 202 Accepted
      const responsePromise = NextResponse.json(
        { message: 'Review accepted. Results will be sent to callback URL.', callbackUrl },
        { status: 202 }
      );

      // Fire and forget: run review and POST results to callbackUrl
      runReview(code, language, fileName, preset)
        .then(async (result) => {
          try {
            await fetch(callbackUrl!, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: 'completed',
                fileName,
                result,
              }),
            });
          } catch (callbackError) {
            logger.error('Failed to send webhook callback', { error: String(callbackError), callbackUrl });
          }
        })
        .catch((reviewError) => {
          logger.error('Webhook async review failed', { error: String(reviewError) });
          fetch(callbackUrl!, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'error',
              fileName,
              error: String(reviewError),
            }),
          }).catch(() => {
            // Silently ignore callback failure
          });
        });

      return responsePromise;
    }

    // Synchronous processing
    const result = await runReview(code, language, fileName, preset);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Webhook error', { error: String(error) });
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
