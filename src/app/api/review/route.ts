import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { reviewCache } from '@/lib/cache';
import { runStaticAnalysis } from '@/lib/static-analysis';
import type { StaticFinding } from '@/lib/analysis/types';
import { getAIReview, VALID_PRESETS, type ReviewPreset, type AIFinding } from '@/lib/ai-review';

const MAX_CODE_LENGTH = 50_000;
const MAX_LIMIT = 100;

const VALID_LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'csharp', 'php', 'ruby', 'smalltalk'] as const;

export async function POST(request: NextRequest) {
  try {
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'anonymous';
    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();
    const { code, language, fileName, preset: rawPreset, enabledCategories, saveHistory = true } = body;
    const preset: ReviewPreset = VALID_PRESETS.includes(rawPreset) ? rawPreset : 'full';

    if (!code || typeof code !== 'string' || !language || typeof language !== 'string') {
      return NextResponse.json({ error: 'Code and language are required' }, { status: 400 });
    }

    if (code.length > MAX_CODE_LENGTH) {
      return NextResponse.json(
        { error: `Code exceeds maximum length of ${MAX_CODE_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (!VALID_LANGUAGES.includes(language as typeof VALID_LANGUAGES[number])) {
      return NextResponse.json(
        { error: `Unsupported language. Supported: ${VALID_LANGUAGES.join(', ')}` },
        { status: 400 }
      );
    }

    // Check cache
    const cacheKey = reviewCache.generateKey(code, language, preset);
    const cached = reviewCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Run static analysis (now async — supports multiple backends)
    const staticFindings = await runStaticAnalysis(code, language, enabledCategories);

    // Get AI review
    const aiReview = await getAIReview(code, language, staticFindings, preset);

    // Combine findings
    const allFindings: StaticFinding[] = [
      ...staticFindings,
      ...(aiReview.findings || []).map((f: AIFinding, index: number) => ({
        ruleId: `ai-${f.category}-${index}`,
        severity: f.severity,
        category: f.category,
        message: f.message,
        lineStart: f.lineStart || 1,
        lineEnd: f.lineEnd || f.lineStart || 1,
        codeSnippet: '',
        suggestion: f.suggestion || '',
        explanation: f.explanation || '',
        documentation: '',
        autoFixable: false
      }))
    ];

    // Deduplicate findings
    const uniqueFindings = allFindings.filter((finding, index, self) =>
      index === self.findIndex(f =>
        f.message === finding.message &&
        f.lineStart === finding.lineStart
      )
    );

    // Calculate counts
    const counts = {
      critical: uniqueFindings.filter(f => f.severity === 'critical').length,
      error: uniqueFindings.filter(f => f.severity === 'error').length,
      warning: uniqueFindings.filter(f => f.severity === 'warning').length,
      info: uniqueFindings.filter(f => f.severity === 'info').length
    };

    const qualityScore = Math.max(0, Math.min(100, aiReview.qualityScore));
    const passed = counts.critical === 0 && counts.error === 0;

    const result = {
      summary: aiReview.summary || 'Code review completed',
      positiveAspects: aiReview.positiveAspects || [],
      qualityScore,
      totalLines: code.split('\n').length,
      passed,
      counts,
      findings: uniqueFindings,
      testingSuggestions: aiReview.testingSuggestions || []
    };

    // Cache the result
    reviewCache.set(cacheKey, result);

    // Save to database if requested
    if (saveHistory) {
      const review = await db.codeReview.create({
        data: {
          codeContent: code,
          language,
          fileName: fileName || 'untitled',
          summary: result.summary,
          positiveAspects: JSON.stringify(result.positiveAspects),
          qualityScore: result.qualityScore,
          totalLines: result.totalLines,
          passed: result.passed,
          criticalCount: counts.critical,
          errorCount: counts.error,
          warningCount: counts.warning,
          infoCount: counts.info,
          findings: {
            create: uniqueFindings.map(f => ({
              ruleId: f.ruleId,
              severity: f.severity,
              category: f.category,
              message: f.message,
              lineStart: f.lineStart,
              lineEnd: f.lineEnd,
              codeSnippet: f.codeSnippet || '',
              suggestion: f.suggestion || '',
              explanation: f.explanation || '',
              documentation: f.documentation || '',
              autoFixable: f.autoFixable || false
            }))
          }
        }
      });

      return NextResponse.json({ ...result, reviewId: review.id });
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Code review error', { error: String(error) });
    return NextResponse.json(
      { error: 'Failed to perform code review' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '10') || 10), MAX_LIMIT);
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);

    const [reviews, total] = await Promise.all([
      db.codeReview.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          findings: {
            orderBy: { severity: 'asc' }
          }
        }
      }),
      db.codeReview.count(),
    ]);

    return NextResponse.json({ reviews, total });
  } catch (error) {
    logger.error('Failed to fetch reviews', { error: String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch review history' },
      { status: 500 }
    );
  }
}
