import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';

/** GET /api/github-app/installations/[id]/settings — Get repo settings. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id } = await params;

  const repo = await db.gitHubRepository.findUnique({
    where: { id },
    include: {
      installation: {
        select: { accountLogin: true, accountType: true },
      },
    },
  });

  if (!repo) {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
  }

  return NextResponse.json({ repository: repo });
}

/** PATCH /api/github-app/installations/[id]/settings — Update repo settings. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const allowedFields = ['reviewEnabled', 'reviewPreset', 'autoReview', 'minSeverity', 'maxComments'];
  const updateData: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (field in body) {
      updateData[field] = body[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // Validate
  if (updateData.reviewPreset && !['full', 'security', 'performance', 'maintainability'].includes(updateData.reviewPreset as string)) {
    return NextResponse.json({ error: 'Invalid preset' }, { status: 400 });
  }
  if (updateData.minSeverity && !['critical', 'error', 'warning', 'info'].includes(updateData.minSeverity as string)) {
    return NextResponse.json({ error: 'Invalid minSeverity' }, { status: 400 });
  }
  if (updateData.maxComments !== undefined) {
    const mc = updateData.maxComments as number;
    if (mc < 1 || mc > 100) {
      return NextResponse.json({ error: 'maxComments must be 1-100' }, { status: 400 });
    }
  }

  const repo = await db.gitHubRepository.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ repository: repo });
}
