// ---------------------------------------------------------------------------
// GitHub PR Review Orchestrator
// ---------------------------------------------------------------------------

import { getInstallationToken, githubFetch } from './github-app';
import { parsePRFiles, findingToDiffPosition, type DiffFile } from './diff-parser';
import { runStaticAnalysis } from './static-analysis';
import { getAIReview, type ReviewPreset } from './ai-review';
import { fetchRepoConfig } from './repo-config';
import { db } from './db';
import { logger } from './logger';
import type { StaticFinding } from './analysis/types';

// Concurrency limiter
let activePRReviews = 0;
const MAX_CONCURRENT_REVIEWS = 2;

// File filters
const SKIP_EXTENSIONS = new Set(['.lock', '.min.js', '.min.css', '.map', '.woff', '.woff2', '.ttf', '.eot', '.ico', '.png', '.jpg', '.gif', '.svg', '.pdf']);
const SKIP_PATHS = ['node_modules/', 'vendor/', 'dist/', 'build/', '.next/', '__pycache__/'];

interface PRReviewParams {
  installationId: number;
  owner: string;
  repo: string;
  prNumber: number;
  headSha: string;
  repositoryId: string;
  preset: ReviewPreset;
  maxComments: number;
  minSeverity: string;
}

export async function handlePRReview(params: PRReviewParams): Promise<void> {
  const { installationId, owner, repo, prNumber, headSha, repositoryId, preset, maxComments, minSeverity } = params;

  // Concurrency check
  if (activePRReviews >= MAX_CONCURRENT_REVIEWS) {
    logger.warn('PR review concurrency limit reached', { prNumber });
    return;
  }
  activePRReviews++;

  // Create review record
  const prReview = await db.gitHubPRReview.create({
    data: {
      repositoryId,
      prNumber,
      headSha,
      status: 'in_progress',
    },
  });

  try {
    const token = await getInstallationToken(installationId);
    const authHeaders = { Authorization: `token ${token}` };

    // Check if head SHA is still current
    const prRes = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      { headers: authHeaders },
    );
    if (!prRes.ok) throw new Error(`Failed to fetch PR: ${prRes.status}`);
    const prData = await prRes.json();
    if (prData.head.sha !== headSha) {
      logger.info('Stale PR review — head SHA changed', { prNumber, expected: headSha, actual: prData.head.sha });
      await db.gitHubPRReview.update({
        where: { id: prReview.id },
        data: { status: 'completed', errorMessage: 'Stale: head SHA changed' },
      });
      return;
    }

    // Fetch repo config (.codereview.yml)
    const repoConfig = await fetchRepoConfig(owner, repo, token);
    const ignorePaths = repoConfig?.ignore_paths || [];

    // Fetch PR files
    const filesRes = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`,
      { headers: authHeaders },
    );
    if (!filesRes.ok) throw new Error(`Failed to fetch PR files: ${filesRes.status}`);
    const rawFiles = await filesRes.json();

    // Parse and filter files
    const diffFiles = parsePRFiles(rawFiles);
    const reviewableFiles = diffFiles.filter(f => shouldReviewFile(f, ignorePaths));

    if (reviewableFiles.length === 0) {
      await db.gitHubPRReview.update({
        where: { id: prReview.id },
        data: { status: 'completed', findingsCount: 0 },
      });
      return;
    }

    // Review each file
    const allComments: PRComment[] = [];
    let totalScore = 0;

    for (const file of reviewableFiles) {
      // Fetch file content
      const contentRes = await githubFetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${file.filename}?ref=${headSha}`,
        { headers: authHeaders },
      );

      if (!contentRes.ok) continue;
      const contentData = await contentRes.json();

      if (contentData.encoding !== 'base64' || !contentData.content) continue;
      const code = Buffer.from(contentData.content, 'base64').toString('utf-8');

      // Skip very large files
      if (code.length > 50_000) continue;

      const language = detectLanguageFromFilename(file.filename);
      if (!language) continue;

      // Run analysis
      const staticFindings = await runStaticAnalysis(code, language);
      const aiReview = await getAIReview(code, language, staticFindings, preset);
      totalScore += aiReview.qualityScore;

      // Combine and filter findings
      const findings: StaticFinding[] = [
        ...staticFindings,
        ...(aiReview.findings || []).map((f, i) => ({
          ruleId: `ai-${f.category}-${i}`,
          severity: f.severity,
          category: f.category,
          message: f.message,
          lineStart: f.lineStart || 1,
          lineEnd: f.lineEnd || f.lineStart || 1,
          codeSnippet: '',
          suggestion: f.suggestion || '',
          explanation: f.explanation || '',
          documentation: '',
          autoFixable: false,
        })),
      ];

      // Filter by severity
      const severityOrder = ['critical', 'error', 'warning', 'info'];
      const minIdx = severityOrder.indexOf(minSeverity);
      const filtered = findings.filter(f => severityOrder.indexOf(f.severity) <= minIdx);

      // Map findings to diff positions
      for (const finding of filtered) {
        const position = findingToDiffPosition(finding.lineStart, file);
        if (position !== null) {
          allComments.push({
            path: file.filename,
            position,
            body: formatComment(finding),
          });
        }
      }
    }

    // Limit comments
    const comments = allComments.slice(0, maxComments);
    const avgScore = reviewableFiles.length > 0 ? totalScore / reviewableFiles.length : 70;

    // Post review
    if (comments.length > 0) {
      const reviewEvent = avgScore >= 70 ? 'COMMENT' : 'REQUEST_CHANGES';
      const reviewBody = `## CodeAnalyzer Review\n\n` +
        `Quality Score: **${Math.round(avgScore)}/100**\n` +
        `Files reviewed: ${reviewableFiles.length}\n` +
        `Issues found: ${allComments.length}${allComments.length > maxComments ? ` (showing ${maxComments})` : ''}`;

      const reviewRes = await githubFetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            commit_id: headSha,
            body: reviewBody,
            event: reviewEvent,
            comments,
          }),
        },
      );

      if (!reviewRes.ok) {
        const errText = await reviewRes.text();
        throw new Error(`Failed to post review: ${reviewRes.status} ${errText}`);
      }

      const reviewData = await reviewRes.json();
      await db.gitHubPRReview.update({
        where: { id: prReview.id },
        data: {
          status: 'completed',
          reviewId: String(reviewData.id),
          qualityScore: avgScore,
          findingsCount: allComments.length,
        },
      });
    } else {
      await db.gitHubPRReview.update({
        where: { id: prReview.id },
        data: { status: 'completed', qualityScore: avgScore, findingsCount: 0 },
      });
    }
  } catch (error) {
    logger.error('PR review error', { error: String(error), prNumber });
    await db.gitHubPRReview.update({
      where: { id: prReview.id },
      data: { status: 'failed', errorMessage: String(error) },
    });
  } finally {
    activePRReviews--;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

interface PRComment {
  path: string;
  position: number;
  body: string;
}

function shouldReviewFile(file: DiffFile, ignorePaths: string[]): boolean {
  // Skip removed files
  if (file.status === 'removed') return false;

  // Skip files with no patch (binary files)
  if (!file.patch) return false;

  // Skip by extension
  const ext = '.' + file.filename.split('.').pop()?.toLowerCase();
  if (SKIP_EXTENSIONS.has(ext)) return false;

  // Skip by path prefix
  if (SKIP_PATHS.some(p => file.filename.includes(p))) return false;

  // Skip ignore paths from .codereview.yml
  if (ignorePaths.some(p => file.filename.startsWith(p) || file.filename.match(new RegExp(p)))) return false;

  return true;
}

function detectLanguageFromFilename(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript', mts: 'typescript',
    py: 'python',
    java: 'java',
    go: 'go',
    rs: 'rust',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    st: 'smalltalk',
  };
  return ext ? (map[ext] || null) : null;
}

function formatComment(finding: StaticFinding): string {
  const severityEmoji: Record<string, string> = {
    critical: '!!!',
    error: '!!',
    warning: '!',
    info: 'i',
  };

  let body = `**[${severityEmoji[finding.severity] || ''} ${finding.severity.toUpperCase()}]** ${finding.message}`;

  if (finding.explanation) {
    body += `\n\n${finding.explanation}`;
  }
  if (finding.suggestion) {
    body += `\n\n**Suggestion:** ${finding.suggestion}`;
  }
  if (finding.documentation) {
    body += `\n\n[Documentation](${finding.documentation})`;
  }

  return body;
}
