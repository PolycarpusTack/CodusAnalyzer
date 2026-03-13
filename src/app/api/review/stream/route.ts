import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { reviewCache } from '@/lib/cache';
import { createStreamController } from '@/lib/streaming';
import { runStaticAnalysis } from '@/lib/static-analysis';
import type { StaticFinding } from '@/lib/analysis/types';
import { getAIReview, VALID_PRESETS, type ReviewPreset, type AIFinding } from '@/lib/ai-review';

const MAX_CODE_LENGTH = 50_000;
const VALID_LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'csharp', 'php', 'ruby', 'smalltalk'] as const;

export async function POST(request: NextRequest) {
  const sc = createStreamController();

  const run = async () => {
    try {
      // --- Rate limiting ---
      const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'anonymous';
      const rateLimit = checkRateLimit(clientIp);
      if (!rateLimit.allowed) {
        sc.sendError('Rate limit exceeded. Please try again later.');
        sc.close();
        return;
      }

      sc.sendStatus('Validating request...');

      const body = await request.json();
      const { code, language, fileName, preset: rawPreset, enabledCategories, saveHistory = true } = body;
      const preset: ReviewPreset = VALID_PRESETS.includes(rawPreset) ? rawPreset : 'full';

      // --- Validation ---
      if (!code || typeof code !== 'string' || !language || typeof language !== 'string') {
        sc.sendError('Code and language are required');
        sc.close();
        return;
      }

      if (code.length > MAX_CODE_LENGTH) {
        sc.sendError(`Code exceeds maximum length of ${MAX_CODE_LENGTH} characters`);
        sc.close();
        return;
      }

      if (!VALID_LANGUAGES.includes(language as typeof VALID_LANGUAGES[number])) {
        sc.sendError(`Unsupported language. Supported: ${VALID_LANGUAGES.join(', ')}`);
        sc.close();
        return;
      }

      // --- Cache check ---
      const cacheKey = reviewCache.generateKey(code, language, preset);
      const cached = reviewCache.get(cacheKey);
      if (cached) {
        sc.sendStatus('Returning cached result...');
        sc.sendResult(cached as object);
        sc.close();
        return;
      }

      // --- Static analysis ---
      sc.sendStatus('Running static analysis...');
      const staticFindings = await runStaticAnalysis(code, language, enabledCategories);
      sc.sendStatus(`Static analysis complete. Found ${staticFindings.length} issue(s).`);

      // --- AI review ---
      sc.sendStatus('Waiting for AI review...');
      const aiReview = await getAIReview(code, language, staticFindings, preset);
      sc.sendStatus('AI review complete. Building results...');

      // --- Combine findings ---
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

      // Deduplicate
      const uniqueFindings = allFindings.filter((finding, index, self) =>
        index === self.findIndex(f =>
          f.message === finding.message &&
          f.lineStart === finding.lineStart
        )
      );

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

      // --- Cache the result ---
      reviewCache.set(cacheKey, result);

      // --- Persist to database ---
      if (saveHistory) {
        sc.sendStatus('Saving review to history...');
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

        sc.sendResult({ ...result, reviewId: review.id });
      } else {
        sc.sendResult(result);
      }
    } catch (error) {
      logger.error('Streaming code review error', { error: String(error) });
      sc.sendError('Failed to perform code review');
    } finally {
      sc.close();
    }
  };

  run();

  return new NextResponse(sc.stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
