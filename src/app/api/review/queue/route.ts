import { NextRequest, NextResponse } from 'next/server';
import { reviewQueue } from '@/lib/queue';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const clientIp =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'anonymous';

    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(
              Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
            ),
          },
        }
      );
    }

    const body = await request.json();
    const { code, language, fileName, preset, enabledCategories, customPrompt } =
      body;

    if (!code || typeof code !== 'string' || !language || typeof language !== 'string') {
      return NextResponse.json(
        { error: 'Code and language are required' },
        { status: 400 }
      );
    }

    if (code.length > 50_000) {
      return NextResponse.json(
        { error: 'Code exceeds maximum length of 50000 characters' },
        { status: 400 }
      );
    }

    const jobId = reviewQueue.enqueue({
      code,
      language,
      fileName: fileName || 'untitled',
      preset: preset || 'full',
      enabledCategories,
      customPrompt,
    });

    return NextResponse.json({ jobId }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to enqueue review job' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    let jobs = reviewQueue.getJobs();

    if (
      statusFilter &&
      ['pending', 'processing', 'completed', 'failed'].includes(statusFilter)
    ) {
      jobs = jobs.filter((j) => j.status === statusFilter);
    }

    // Strip code content from list response to keep payload small
    const sanitized = jobs.map(({ code, ...rest }) => rest);

    return NextResponse.json({ jobs: sanitized });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch job queue' },
      { status: 500 }
    );
  }
}
