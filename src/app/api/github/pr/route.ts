import { NextRequest, NextResponse } from 'next/server';
import { parsePRUrl, fetchPRFiles } from '@/lib/github-pr';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { url, token } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'PR URL is required' }, { status: 400 });
    }

    const parsed = parsePRUrl(url);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Invalid GitHub PR URL. Expected format: https://github.com/owner/repo/pull/123' },
        { status: 400 }
      );
    }

    const prInfo = await fetchPRFiles(parsed.owner, parsed.repo, parsed.number, token || undefined);

    return NextResponse.json(prInfo);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch PR data';
    logger.error('GitHub PR fetch error', { error: String(error) });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
