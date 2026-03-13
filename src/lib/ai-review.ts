// ---------------------------------------------------------------------------
// ai-review.ts — Shared AI review logic extracted from route.ts
// ---------------------------------------------------------------------------

import ZAI from 'z-ai-web-dev-sdk';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import type { StaticFinding } from './analysis/types';

// ── Types ──────────────────────────────────────────────────────────────────

export const VALID_PRESETS = ['full', 'security', 'performance', 'maintainability'] as const;
export type ReviewPreset = typeof VALID_PRESETS[number];

export const aiReviewSchema = z.object({
  summary: z.string().default('Code review completed'),
  positiveAspects: z.array(z.string()).default([]),
  findings: z.array(z.object({
    severity: z.enum(['critical', 'error', 'warning', 'info']).default('info'),
    category: z.string().default('maintainability'),
    message: z.string(),
    lineStart: z.number().optional(),
    lineEnd: z.number().optional(),
    explanation: z.string().optional(),
    suggestion: z.string().optional(),
  })).default([]),
  testingSuggestions: z.array(z.string()).default([]),
  qualityScore: z.number().min(0).max(100).default(70),
});

export type AIReviewResponse = z.infer<typeof aiReviewSchema>;
export type AIFinding = AIReviewResponse['findings'][number];

// ── Preset focus prompts ───────────────────────────────────────────────────

export const PRESET_FOCUS: Record<ReviewPreset, string> = {
  full: `Focus on all aspects:
1. Logic errors or potential bugs
2. Security vulnerabilities
3. Performance issues
4. Code maintainability
5. Best practices
6. Testing suggestions`,
  security: `Focus EXCLUSIVELY on security concerns:
1. Injection vulnerabilities (SQL, XSS, command injection)
2. Authentication and authorization flaws
3. Sensitive data exposure
4. Insecure dependencies or configurations
5. Input validation and sanitization
6. Cryptographic issues
Ignore style, naming, and non-security maintainability issues.`,
  performance: `Focus EXCLUSIVELY on performance concerns:
1. Algorithmic complexity and inefficient operations
2. Memory leaks and excessive allocations
3. N+1 queries and database performance
4. Unnecessary re-renders or recomputations
5. Blocking operations and concurrency issues
6. Bundle size and lazy loading opportunities
Ignore style, naming, and non-performance issues.`,
  maintainability: `Focus EXCLUSIVELY on maintainability concerns:
1. Code clarity and readability
2. Function/class size and single responsibility
3. Naming conventions and consistency
4. Code duplication and DRY violations
5. Type safety and error handling
6. Documentation and test coverage gaps
Ignore performance micro-optimizations and minor style preferences.`,
};

// ── AI review function ─────────────────────────────────────────────────────

export async function getAIReview(
  code: string,
  language: string,
  staticFindings: StaticFinding[],
  preset: ReviewPreset = 'full',
): Promise<AIReviewResponse> {
  const zai = await ZAI.create();

  const presetFocus = PRESET_FOCUS[preset];
  const systemPrompt = `You are an expert code reviewer with deep knowledge of software engineering best practices. Your task is to review code and provide actionable, educational feedback.

Review Preset: ${preset.toUpperCase()}

${presetFocus}

Guidelines:
1. Prioritize your feedback by severity: critical, error, warning, info
2. Explain WHY something is a problem, not just WHAT is wrong
3. Suggest specific fixes when possible
4. Be constructive and educational
5. Acknowledge good patterns when you see them

Output format (JSON array):
{
  "summary": "Brief overall assessment of the code",
  "positiveAspects": ["List of things done well"],
  "findings": [
    {
      "severity": "critical|error|warning|info",
      "category": "bug|security|performance|maintainability|testing",
      "message": "Brief description of the issue",
      "lineStart": 1,
      "lineEnd": 5,
      "explanation": "Detailed explanation of why this is a problem",
      "suggestion": "How to fix it"
    }
  ],
  "testingSuggestions": ["Suggested test cases"],
  "qualityScore": 75
}`;

  const userPrompt = `## Code Review Request

Language: ${language}

### Code to Review:
\`\`\`${language}
${code}
\`\`\`

### Static Analysis Findings (already detected):
${staticFindings.map(f => `- [${f.severity.toUpperCase()}] ${f.message} (line ${f.lineStart})`).join('\n')}

Please provide your ${preset === 'full' ? 'comprehensive' : preset + '-focused'} review.

Respond with valid JSON only.`;

  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    thinking: { type: 'disabled' }
  });

  const response = completion.choices[0]?.message?.content || '';

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return aiReviewSchema.parse(parsed);
    }
  } catch (e) {
    logger.error('Failed to parse AI response', { error: String(e) });
  }

  return {
    summary: 'AI review completed but response format was unexpected.',
    positiveAspects: [],
    findings: [],
    testingSuggestions: [],
    qualityScore: 70
  };
}
