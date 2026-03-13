import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    // Total reviews and aggregate scores
    const aggregates = await db.codeReview.aggregate({
      _count: { id: true },
      _avg: { qualityScore: true },
    });

    const totalReviews = aggregates._count.id;
    const averageQualityScore = aggregates._avg.qualityScore ?? 0;

    // Pass rate
    const passedCount = await db.codeReview.count({
      where: { passed: true },
    });
    const passRate = totalReviews > 0 ? (passedCount / totalReviews) * 100 : 0;

    // Finding counts by category
    const findingsByCategory = await db.codeReviewFinding.groupBy({
      by: ['category'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    // Finding counts by severity
    const findingsBySeverity = await db.codeReviewFinding.groupBy({
      by: ['severity'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    // Reviews per language
    const reviewsByLanguage = await db.codeReview.groupBy({
      by: ['language'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    // Most common findings (top 10 by message)
    const topFindings = await db.codeReviewFinding.groupBy({
      by: ['message'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Reviews per day (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentReviews = await db.codeReview.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day
    const reviewsPerDay: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      reviewsPerDay[key] = 0;
    }
    for (const review of recentReviews) {
      const key = review.createdAt.toISOString().split('T')[0];
      if (key in reviewsPerDay) {
        reviewsPerDay[key]++;
      }
    }

    return NextResponse.json({
      totalReviews,
      averageQualityScore: Math.round(averageQualityScore * 10) / 10,
      passRate: Math.round(passRate * 10) / 10,
      findingsByCategory: findingsByCategory.map((f) => ({
        category: f.category,
        count: f._count.id,
      })),
      findingsBySeverity: findingsBySeverity.map((f) => ({
        severity: f.severity,
        count: f._count.id,
      })),
      reviewsByLanguage: reviewsByLanguage.map((r) => ({
        language: r.language,
        count: r._count.id,
      })),
      topFindings: topFindings.map((f) => ({
        message: f.message,
        count: f._count.id,
      })),
      reviewsPerDay,
    });
  } catch (error) {
    logger.error('Failed to fetch review stats', { error: String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch review statistics' },
      { status: 500 }
    );
  }
}
