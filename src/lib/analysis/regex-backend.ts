// ---------------------------------------------------------------------------
// Regex-based analysis backend — extracted from route.ts
// ---------------------------------------------------------------------------

import type { AnalysisBackend, AnalysisContext, StaticFinding, EnabledCategories } from './types';

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

// ── Security patterns ──────────────────────────────────────────────────────

const SECURITY_PATTERNS: readonly PatternRule[] = [
  {
    id: 'sql-injection',
    pattern: /(execute\s*\(\s*["'].*\+|query\s*\(\s*["'].*\+|SELECT.*WHERE.*\+|db\.query\s*\(\s*["'].*\$\{)/gi,
    severity: 'critical', category: 'security',
    message: 'Potential SQL injection vulnerability detected',
    explanation: 'SQL injection allows attackers to execute arbitrary SQL commands by manipulating input data.',
    suggestion: 'Use parameterized queries instead of string concatenation.',
    documentation: 'https://owasp.org/www-community/attacks/SQL_Injection'
  },
  {
    id: 'xss-innerhtml',
    pattern: /innerHTML\s*=\s*[^;]+\+/gi,
    severity: 'critical', category: 'security',
    message: 'XSS vulnerability: Dynamic innerHTML assignment detected',
    explanation: 'Direct innerHTML assignment with dynamic content can lead to Cross-Site Scripting (XSS) attacks.',
    suggestion: 'Use textContent instead, or sanitize HTML content before assignment.',
    documentation: 'https://owasp.org/www-community/attacks/xss/'
  },
  {
    id: 'xss-dangerously',
    pattern: /dangerouslySetInnerHTML/gi,
    severity: 'warning', category: 'security',
    message: 'React dangerouslySetInnerHTML detected',
    explanation: 'dangerouslySetInnerHTML can expose your application to XSS attacks if not used carefully.',
    suggestion: 'Ensure content is properly sanitized before using dangerouslySetInnerHTML.',
    documentation: 'https://react.dev/reference/react-dom/components/common#dangerously-setting-the-inner-html'
  },
  {
    id: 'eval-usage',
    pattern: /\beval\s*\(/gi,
    severity: 'critical', category: 'security',
    message: 'eval() function usage detected',
    explanation: 'eval() can execute arbitrary code and is a major security risk.',
    suggestion: 'Avoid eval() and use safer alternatives like JSON.parse() for JSON data.',
    documentation: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval'
  },
  {
    id: 'hardcoded-secret',
    pattern: /(password|secret|api[_-]?key|token)\s*[=:]\s*["'][^"']+["']/gi,
    severity: 'critical', category: 'security',
    message: 'Hardcoded secret or credential detected',
    explanation: 'Secrets in code can be exposed through version control, logs, or error messages.',
    suggestion: 'Use environment variables or a secret manager for sensitive data.',
    documentation: 'https://12factor.net/config'
  },
  {
    id: 'aws-key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: 'critical', category: 'security',
    message: 'AWS Access Key detected in code',
    explanation: 'AWS access keys should never be hardcoded in source code.',
    suggestion: 'Remove the key immediately and rotate credentials. Use AWS IAM roles or environment variables.',
    documentation: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html'
  }
];

// ── Performance patterns ───────────────────────────────────────────────────

const PERFORMANCE_PATTERNS: readonly PatternRule[] = [
  {
    id: 'n-plus-one',
    pattern: /(?:for\s*\(.*await|forEach\s*\(\s*async|for\s*\(.*\.\w+\s*\(\))/gi,
    severity: 'warning', category: 'performance',
    message: 'Potential N+1 query pattern detected',
    explanation: 'Making database queries inside loops can cause severe performance issues.',
    suggestion: 'Use bulk fetch operations or batch queries instead of per-item queries.',
    documentation: 'https://use-the-index-luke.com/sql/n+1-problem'
  },
  {
    id: 'sync-operation',
    pattern: /readFileSync|writeFileSync|existsSync/gi,
    severity: 'warning', category: 'performance',
    message: 'Synchronous file operation detected',
    explanation: 'Synchronous operations block the event loop and can degrade performance.',
    suggestion: 'Use asynchronous alternatives (readFile, writeFile, exists) instead.',
    documentation: 'https://nodejs.org/api/fs.html'
  },
  {
    id: 'memory-leak',
    pattern: /setInterval\s*\([^)]+\)\s*(?!const|let|var)/gi,
    severity: 'warning', category: 'performance',
    message: 'setInterval without reference detected',
    explanation: 'setInterval without storing reference can cause memory leaks if not cleared.',
    suggestion: 'Store the interval reference and clear it when no longer needed.',
    documentation: 'https://developer.mozilla.org/en-US/docs/Web/API/setInterval'
  }
];

// ── Quality patterns ───────────────────────────────────────────────────────

const QUALITY_PATTERNS: readonly PatternRule[] = [
  {
    id: 'any-type',
    pattern: /:\s*any\b/gi,
    severity: 'warning', category: 'maintainability',
    message: 'TypeScript any type usage detected',
    explanation: 'Using any defeats TypeScript type checking and can hide potential bugs.',
    suggestion: 'Use specific types or unknown instead of any.',
    documentation: 'https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#any'
  },
  {
    id: 'todo-comment',
    pattern: /\/\/\s*(TODO|FIXME|HACK|XXX):/gi,
    severity: 'info', category: 'maintainability',
    message: 'TODO/FIXME comment detected',
    explanation: 'Unresolved TODO comments should be tracked and addressed.',
    suggestion: 'Consider creating issues for TODOs or resolving them.',
    documentation: ''
  },
  {
    id: 'console-log',
    pattern: /console\.(log|debug|info)\s*\(/gi,
    severity: 'info', category: 'style',
    message: 'Console logging statement detected',
    explanation: 'Console logs in production code can expose sensitive information and clutter logs.',
    suggestion: 'Remove console logs before deploying or use a proper logging library.',
    documentation: ''
  },
  {
    id: 'empty-catch',
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}/gi,
    severity: 'warning', category: 'maintainability',
    message: 'Empty catch block detected',
    explanation: 'Empty catch blocks silently swallow errors, making debugging difficult.',
    suggestion: 'Handle the error properly or at least log it.',
    documentation: ''
  },
  {
    id: 'var-declaration',
    pattern: /\bvar\s+\w+/gi,
    severity: 'warning', category: 'style',
    message: 'var declaration detected',
    explanation: 'var has function scope and can lead to unexpected behavior.',
    suggestion: 'Use let or const instead for block-scoped variables.',
    documentation: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/var'
  }
];

// ── Pattern execution ──────────────────────────────────────────────────────

function runPatterns(code: string, lines: string[], patterns: readonly PatternRule[]): StaticFinding[] {
  const findings: StaticFinding[] = [];

  for (const patternRule of patterns) {
    const regex = new RegExp(patternRule.pattern.source, patternRule.pattern.flags);
    let execResult;

    while ((execResult = regex.exec(code)) !== null) {
      const beforeMatch = code.substring(0, execResult.index);
      const lineNum = (beforeMatch.match(/\n/g) || []).length + 1;

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
        codeSnippet,
        suggestion: patternRule.suggestion,
        explanation: patternRule.explanation,
        documentation: patternRule.documentation,
        autoFixable: patternRule.id === 'console-log' || patternRule.id === 'var-declaration'
      });
    }
  }

  return findings;
}

// ── Complexity analysis ────────────────────────────────────────────────────

function analyzeComplexity(code: string, lines: string[]): StaticFinding[] {
  const findings: StaticFinding[] = [];

  const decisionPatterns = [
    /\bif\s*\(/g, /\belse\s+if\s*\(/g, /\bfor\s*\(/g, /\bwhile\s*\(/g,
    /\bswitch\s*\(/g, /\bcase\s+/g, /\bcatch\s*\(/g, /\?\s*[^:]+\s*:/g,
    /&&/g, /\|\|/g
  ];

  let complexity = 1;
  for (const pattern of decisionPatterns) {
    const matches = code.match(pattern);
    if (matches) complexity += matches.length;
  }

  if (complexity > 15) {
    findings.push({
      ruleId: 'high-complexity',
      severity: complexity > 25 ? 'error' : 'warning',
      category: 'maintainability',
      message: `High cyclomatic complexity detected (${complexity})`,
      lineStart: 1, lineEnd: lines.length,
      codeSnippet: '',
      suggestion: 'Consider breaking down complex logic into smaller, focused functions.',
      explanation: 'High cyclomatic complexity makes code harder to test, understand, and maintain.',
      documentation: 'https://en.wikipedia.org/wiki/Cyclomatic_complexity',
      autoFixable: false
    });
  }

  return findings;
}

// ── Long function analysis ─────────────────────────────────────────────────

function analyzeLongFunctions(code: string, lines: string[]): StaticFinding[] {
  const findings: StaticFinding[] = [];

  // Matches JS/TS functions, Python def, Java/C# methods, and Smalltalk methods (word >> pattern)
  const functionPattern = /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\(|def\s+\w+|public\s+(?:static\s+)?(?:async\s+)?\w+\s*\(|\w+\s*>>\s*\w+)/g;
  const functionStarts: number[] = [];
  let execResult;

  while ((execResult = functionPattern.exec(code)) !== null) {
    const beforeMatch = code.substring(0, execResult.index);
    const lineNum = (beforeMatch.match(/\n/g) || []).length + 1;
    functionStarts.push(lineNum);
  }

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
        lineStart: start, lineEnd: end,
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

// ── Backend implementation ─────────────────────────────────────────────────

export class RegexBackend implements AnalysisBackend {
  readonly name = 'regex';
  readonly priority = 100; // lowest priority — fallback
  readonly supportedLanguages: string[] = []; // supports all

  async isAvailable(): Promise<boolean> {
    return true; // always available
  }

  async analyze(ctx: AnalysisContext): Promise<StaticFinding[]> {
    const { code, enabledCategories } = ctx;
    const lines = code.split('\n');

    const patternSets: PatternRule[][] = [];
    if (!enabledCategories || enabledCategories.security) patternSets.push([...SECURITY_PATTERNS]);
    if (!enabledCategories || enabledCategories.performance) patternSets.push([...PERFORMANCE_PATTERNS]);
    if (!enabledCategories || enabledCategories.maintainability || enabledCategories.style) patternSets.push([...QUALITY_PATTERNS]);

    const findings = runPatterns(code, lines, patternSets.flat());
    findings.push(...analyzeComplexity(code, lines));
    findings.push(...analyzeLongFunctions(code, lines));

    return findings;
  }
}

// Also export a standalone function for backward compatibility / benchmarks
export function runRegexAnalysis(code: string, language: string, enabledCategories?: EnabledCategories): StaticFinding[] {
  const backend = new RegexBackend();
  const ctx: AnalysisContext = { code, language, enabledCategories };
  // Sync-safe: regex backend does no async work internally
  let result: StaticFinding[] = [];
  backend.analyze(ctx).then(r => { result = r; });
  return result;
}
