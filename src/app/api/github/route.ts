import { NextRequest, NextResponse } from 'next/server';
import { parseGitHubUrl } from '@/lib/github';
import { logger } from '@/lib/logger';

const MAX_FILE_SIZE = 500_000; // 500KB

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'GitHub URL is required' }, { status: 400 });
    }

    const parsed = parseGitHubUrl(url);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Invalid GitHub URL. Expected format: https://github.com/owner/repo/blob/branch/path/to/file' },
        { status: 400 }
      );
    }

    const rawUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${parsed.branch}/${parsed.path}`;

    const res = await fetch(rawUrl);
    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ error: 'File not found. Make sure the repository and file are public.' }, { status: 404 });
      }
      return NextResponse.json({ error: `Failed to fetch file (${res.status})` }, { status: res.status });
    }

    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 500KB)' }, { status: 413 });
    }

    const content = await res.text();

    if (content.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 500KB)' }, { status: 413 });
    }

    const fileName = parsed.path.split('/').pop() || parsed.path;

    return NextResponse.json({ content, fileName, path: parsed.path });
  } catch (error) {
    logger.error('GitHub fetch error', { error: String(error) });
    return NextResponse.json({ error: 'Failed to fetch file from GitHub' }, { status: 500 });
  }
}
