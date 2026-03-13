import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';

/** GET /api/github-app/installations — List installations. */
export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.userId || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const installations = await db.gitHubInstallation.findMany({
    include: {
      repositories: {
        select: {
          id: true,
          fullName: true,
          reviewEnabled: true,
          autoReview: true,
          reviewPreset: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ installations });
}
