import { NextRequest, NextResponse } from 'next/server';
import { reviewQueue } from '@/lib/queue';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = reviewQueue.getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Return job without the full code content
  const { code, ...jobData } = job;

  return NextResponse.json(jobData);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = reviewQueue.getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  reviewQueue.deleteJob(jobId);

  return NextResponse.json({ deleted: true });
}
