import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const VALID_STATUSES = ['open', 'fixed', 'wont_fix', 'false_positive'] as const;
type ResolutionStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(status: unknown): status is ResolutionStatus {
  return typeof status === 'string' && VALID_STATUSES.includes(status as ResolutionStatus);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; findingId: string }> }
) {
  try {
    const { id: reviewId, findingId } = await params;

    const body = await request.json();
    const { status } = body;

    if (!isValidStatus(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Verify the finding belongs to the specified review
    const existing = await db.codeReviewFinding.findFirst({
      where: { id: findingId, reviewId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Finding not found for the specified review' },
        { status: 404 }
      );
    }

    const resolvedAt = status === 'open' ? null : new Date();

    const updated = await db.codeReviewFinding.update({
      where: { id: findingId },
      data: {
        resolution: status,
        resolvedAt,
      },
    });

    return NextResponse.json({ finding: updated });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update finding resolution' },
      { status: 500 }
    );
  }
}
