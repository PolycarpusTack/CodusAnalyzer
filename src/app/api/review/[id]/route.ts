import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const review = await db.codeReview.findUnique({
      where: { id },
      include: {
        findings: {
          orderBy: { severity: 'asc' }
        }
      }
    });

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    return NextResponse.json({ review });
  } catch (error) {
    logger.error('Failed to fetch review', { error: String(error) });
    return NextResponse.json({ error: 'Failed to fetch review' }, { status: 500 });
  }
}
