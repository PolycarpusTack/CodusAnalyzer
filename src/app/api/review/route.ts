import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';

const MAX_CODE_LENGTH = 50_000;
const MAX_LIMIT = 100;

interface StaticFinding {
  ruleId: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  category: string;
  message: string;
  lineStart: number;
  lineEnd: number;
  codeSnippet: string;
  suggestion: string;
  explanation: string;
  documentation: string;
  autoFixable: boolean;
}

const VALID_LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'csharp', 'php', 'ruby'] as const;
const VALID_PRESETS = ['full', 'security', 'performance', 'maintainability'] as const;
type ReviewPreset = typeof VALID_PRESETS[number];

const PRESET_FOCUS: Record<ReviewPreset, string> = {
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

const aiReviewSchema = z.object({
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

type AIReviewResponse = z.infer<typeof aiReviewSchema>;
type AIFinding = AIReviewResponse['findings'][number];

interface PatternRule {
  id: string;
  pattern: RegExp;
  severity: 'critical' | 'error' | 'warning' | 'info';
  category: string;
  message: string;
  explanation: string;
  suggestion: string;
  documentation: string;
}

// Security patterns to check
const SECURITY_PATTERNS: readonly PatternRule[] = [
  {
    id: 'sql-injection',
    pattern: /(execute\s*\(\s*["'].*\+|query\s*\(\s*["'].*\+|SELECT.*WHERE.*\+|db\.query\s*\(\s*["'].*\$\{)/gi,
    severity: 'critical',
    category: 'security',
    message: 'Potential SQL injection vulnerability detected',
    explanation: 'SQL injection allows attackers to execute arbitrary SQL commands by manipulating input data.',
    suggestion: 'Use parameterized queries instead of string concatenation.',
    documentation: 'https://owasp.org/www-community/attacks/SQL_Injection'
  },
  {
    id: 'xss-innerhtml',
    pattern: /innerHTML\s*=\s*[^;]+\+/gi,
    severity: 'critical',
    category: 'security',
    message: 'XSS vulnerability: Dynamic innerHTML assignment detected',
    explanation: 'Direct innerHTML assignment with dynamic content can lead to Cross-Site Scripting (XSS) attacks.',
    suggestion: 'Use textContent instead, or sanitize HTML content before assignment.',
    documentation: 'https://owasp.org/www-community/attacks/xss/'
  },
  {
    id: 'xss-dangerously',
    pattern: /dangerouslySetInnerHTML/gi,
    severity: 'warning',
    category: 'security',
    message: 'React dangerouslySetInnerHTML detected',
    explanation: 'dangerouslySetInnerHTML can expose your application to XSS attacks if not used carefully.',
    suggestion: 'Ensure content is properly sanitized before using dangerouslySetInnerHTML.',
    documentation: 'https://react.dev/reference/react-dom/components/common#dangerously-setting-the-inner-html'
  },
  {
    id: 'eval-usage',
    pattern: /\beval\s*\(/gi,
    severity: 'critical',
    category: 'security',
    message: 'eval() function usage detected',
    explanation: 'eval() can execute arbitrary code and is a major security risk.',
    suggestion: 'Avoid eval() and use safer alternatives like JSON.parse() for JSON data.',
    documentation: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval'
  },
  {
    id: 'hardcoded-secret',
    pattern: /(password|secret|api[_-]?key|token)\s*[=:]\s*["'][^"']+["']/gi,
    severity: 'critical',
    category: 'security',
    message: 'Hardcoded secret or credential detected',
    explanation: 'Secrets in code can be exposed through version control, logs, or error messages.',
    suggestion: 'Use environment variables or a secret manager for sensitive data.',
    documentation: 'https://12factor.net/config'
  },
  {
    id: 'aws-key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: 'critical',
    category: 'security',
    message: 'AWS Access Key detected in code',
    explanation: 'AWS access keys should never be hardcoded in source code.',
    suggestion: 'Remove the key immediately and rotate credentials. Use AWS IAM roles or environment variables.',
    documentation: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html'
  }
];

// Performance patterns
const PERFORMANCE_PATTERNS: readonly PatternRule[] = [
  {
    id: 'n-plus-one',
    pattern: /(?:for\s*\(.*await|forEach\s*\(\s*async|for\s*\(.*\.\w+\s*\(\))/gi,
    severity: 'warning',
    category: 'performance',
    message: 'Potential N+1 query pattern detected',
    explanation: 'Making database queries inside loops can cause severe performance issues.',
    suggestion: 'Use bulk fetch operations or batch queries instead of per-item queries.',
    documentation: 'https://use-the-index-luke.com/sql/n+1-problem'
  },
  {
    id: 'sync-operation',
    pattern: /readFileSync|writeFileSync|existsSync/gi,
    severity: 'warning',
    category: 'performance',
    message: 'Synchronous file operation detected',
    explanation: 'Synchronous operations block the event loop and can degrade performance.',
    suggestion: 'Use asynchronous alternatives (readFile, writeFile, exists) instead.',
    documentation: 'https://nodejs.org/api/fs.html'
  },
  {
    id: 'memory-leak',
    pattern: /setInterval\s*\([^)]+\)\s*(?!const|let|var)/gi,
    severity: 'warning',
    category: 'performance',
    message: 'setInterval without reference detected',
    explanation: 'setInterval without storing reference can cause memory leaks if not cleared.',
    suggestion: 'Store the interval reference and clear it when no longer needed.',
    documentation: 'https://developer.mozilla.org/en-US/docs/Web/API/setInterval'
  }
];

// Code quality patterns
const QUALITY_PATTERNS: readonly PatternRule[] = [
  {
    id: 'any-type',
    pattern: /:\s*any\b/gi,
    severity: 'warning',
    category: 'maintainability',
    message: 'TypeScript any type usage detected',
    explanation: 'Using any defeats TypeScript type checking and can hide potential bugs.',
    suggestion: 'Use specific types or unknown instead of any.',
    documentation: 'https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#any'
  },
  {
    id: 'todo-comment',
    pattern: /\/\/\s*(TODO|FIXME|HACK|XXX):/gi,
    severity: 'info',
    category: 'maintainability',
    message: 'TODO/FIXME comment detected',
    explanation: 'Unresolved TODO comments should be tracked and addressed.',
    suggestion: 'Consider creating issues for TODOs or resolving them.',
    documentation: ''
  },
  {
    id: 'console-log',
    pattern: /console\.(log|debug|info)\s*\(/gi,
    severity: 'info',
    category: 'style',
    message: 'Console logging statement detected',
    explanation: 'Console logs in production code can expose sensitive information and clutter logs.',
    suggestion: 'Remove console logs before deploying or use a proper logging library.',
    documentation: ''
  },
  {
    id: 'empty-catch',
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}/gi,
    severity: 'warning',
    category: 'maintainability',
    message: 'Empty catch block detected',
    explanation: 'Empty catch blocks silently swallow errors, making debugging difficult.',
    suggestion: 'Handle the error properly or at least log it.',
    documentation: ''
  },
  {
    id: 'var-declaration',
    pattern: /\bvar\s+\w+/gi,
    severity: 'warning',
    category: 'style',
    message: 'var declaration detected',
    explanation: 'var has function scope and can lead to unexpected behavior.',
    suggestion: 'Use let or const instead for block-scoped variables.',
    documentation: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/var'
  }
];

interface EnabledCategories {
  security: boolean;
  performance: boolean;
  maintainability: boolean;
  style: boolean;
}

function runStaticAnalysis(code: string, language: string, enabledCategories?: EnabledCategories) {
  const findings: StaticFinding[] = [];
  const lines = code.split('\n');

  // Build pattern list based on enabled categories
  const patternSets: PatternRule[][] = [];
  if (!enabledCategories || enabledCategories.security) patternSets.push([...SECURITY_PATTERNS]);
  if (!enabledCategories || enabledCategories.performance) patternSets.push([...PERFORMANCE_PATTERNS]);
  if (!enabledCategories || enabledCategories.maintainability || enabledCategories.style) patternSets.push([...QUALITY_PATTERNS]);
  const allPatterns = patternSets.flat();
  
  for (const patternRule of allPatterns) {
    const regex = new RegExp(patternRule.pattern.source, patternRule.pattern.flags);
    let execResult;

    while ((execResult = regex.exec(code)) !== null) {
      // Find line number
      const beforeMatch = code.substring(0, execResult.index);
      const lineNum = (beforeMatch.match(/\n/g) || []).length + 1;

      // Get code snippet
      const lineStart = Math.max(0, lineNum - 2);
      const lineEnd = Math.min(lines.length, lineNum + 1);
      const codeSnippet = lines.slice(lineStart, lineEnd).join('\n');
      
      findings.push({
        ruleId: patternRule.id,
        severity: patternRule.severity,
        category: patternRule.category,
        message: patternRule.message,
        lineStart: lineNum,
        lineEnd: lineNum,
        codeSnippet: codeSnippet,
        suggestion: patternRule.suggestion,
        explanation: patternRule.explanation,
        documentation: patternRule.documentation,
        autoFixable: patternRule.id === 'console-log' || patternRule.id === 'var-declaration'
      });
    }
  }

  // Calculate complexity
  const complexityFindings = analyzeComplexity(code, lines);
  findings.push(...complexityFindings);

  // Check for long functions
  const longFunctionFindings = analyzeLongFunctions(code, lines, language);
  findings.push(...longFunctionFindings);

  return findings;
}

function analyzeComplexity(code: string, lines: string[]) {
  const findings: StaticFinding[] = [];
  
  // Count decision points (simplified cyclomatic complexity)
  const decisionPatterns = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\bswitch\s*\(/g,
    /\bcase\s+/g,
    /\bcatch\s*\(/g,
    /\?\s*[^:]+\s*:/g,
    /&&/g,
    /\|\|/g
  ];

  let complexity = 1;
  for (const pattern of decisionPatterns) {
    const matches = code.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  if (complexity > 15) {
    findings.push({
      ruleId: 'high-complexity',
      severity: complexity > 25 ? 'error' : 'warning',
      category: 'maintainability',
      message: `High cyclomatic complexity detected (${complexity})`,
      lineStart: 1,
      lineEnd: lines.length,
      codeSnippet: '',
      suggestion: 'Consider breaking down complex logic into smaller, focused functions.',
      explanation: 'High cyclomatic complexity makes code harder to test, understand, and maintain.',
      documentation: 'https://en.wikipedia.org/wiki/Cyclomatic_complexity',
      autoFixable: false
    });
  }

  return findings;
}

function analyzeLongFunctions(code: string, lines: string[], language: string) {
  const findings: StaticFinding[] = [];
  
  // Simple regex for function detection (works for JS/TS/Python-ish)
  const functionPattern = /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\(|def\s+\w+|public\s+(?:static\s+)?(?:async\s+)?\w+\s*\()/g;
  
  const functionStarts: number[] = [];
  let execResult;

  while ((execResult = functionPattern.exec(code)) !== null) {
    const beforeMatch = code.substring(0, execResult.index);
    const lineNum = (beforeMatch.match(/\n/g) || []).length + 1;
    functionStarts.push(lineNum);
  }

  // Check function lengths
  for (let i = 0; i < functionStarts.length; i++) {
    const start = functionStarts[i];
    const end = i < functionStarts.length - 1 ? functionStarts[i + 1] - 1 : lines.length;
    const length = end - start + 1;
    
    if (length > 50) {
      findings.push({
        ruleId: 'long-function',
        severity: length > 100 ? 'warning' : 'info',
        category: 'maintainability',
        message: `Long function detected (${length} lines)`,
        lineStart: start,
        lineEnd: end,
        codeSnippet: lines.slice(start - 1, Math.min(start + 4, end)).join('\n'),
        suggestion: 'Consider breaking this function into smaller, focused functions.',
        explanation: 'Long functions are harder to understand, test, and maintain.',
        documentation: 'https://refactoring.guru/extract-method',
        autoFixable: false
      });
    }
  }

  return findings;
}

async function getAIReview(code: string, language: string, staticFindings: StaticFinding[], preset: ReviewPreset = 'full'): Promise<AIReviewResponse> {
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

    // Run static analysis
    const staticFindings = runStaticAnalysis(code, language, enabledCategories);
    
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

    // Use AI quality score directly — the AI already sees static findings as context,
    // so subtracting again would double-penalize
    const qualityScore = Math.max(0, Math.min(100, aiReview.qualityScore));

    // Determine pass/fail
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
    
    const reviews = await db.codeReview.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        findings: {
          orderBy: { severity: 'asc' }
        }
      }
    });

    return NextResponse.json({ reviews });
  } catch (error) {
    logger.error('Failed to fetch reviews', { error: String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch review history' },
      { status: 500 }
    );
  }
}
