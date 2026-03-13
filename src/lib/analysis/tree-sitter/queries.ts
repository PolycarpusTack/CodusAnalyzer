// ---------------------------------------------------------------------------
// Tree-sitter S-expression queries per rule category
// ---------------------------------------------------------------------------

export interface QueryRule {
  id: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  category: string;
  message: string;
  explanation: string;
  suggestion: string;
  documentation: string;
  autoFixable: boolean;
  /** S-expression pattern for tree-sitter query. */
  pattern: string;
  /** Languages this query applies to. Empty = all that support tree-sitter. */
  languages: string[];
}

// ── Security queries ───────────────────────────────────────────────────────

export const SECURITY_QUERIES: QueryRule[] = [
  {
    id: 'eval-usage',
    severity: 'critical',
    category: 'security',
    message: 'eval() function usage detected',
    explanation: 'eval() can execute arbitrary code and is a major security risk.',
    suggestion: 'Avoid eval() and use safer alternatives like JSON.parse() for JSON data.',
    documentation: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval',
    autoFixable: false,
    pattern: '(call_expression function: (identifier) @fn (#eq? @fn "eval"))',
    languages: ['javascript', 'typescript'],
  },
  {
    id: 'dangerously-set-inner-html',
    severity: 'warning',
    category: 'security',
    message: 'React dangerouslySetInnerHTML detected',
    explanation: 'dangerouslySetInnerHTML can expose your application to XSS attacks if not used carefully.',
    suggestion: 'Ensure content is properly sanitized before using dangerouslySetInnerHTML.',
    documentation: 'https://react.dev/reference/react-dom/components/common#dangerously-setting-the-inner-html',
    autoFixable: false,
    pattern: '(jsx_attribute (property_identifier) @attr (#eq? @attr "dangerouslySetInnerHTML"))',
    languages: ['javascript', 'typescript'],
  },
  {
    id: 'innerhtml-assignment',
    severity: 'critical',
    category: 'security',
    message: 'XSS vulnerability: Dynamic innerHTML assignment detected',
    explanation: 'Direct innerHTML assignment with dynamic content can lead to Cross-Site Scripting (XSS) attacks.',
    suggestion: 'Use textContent instead, or sanitize HTML content before assignment.',
    documentation: 'https://owasp.org/www-community/attacks/xss/',
    autoFixable: false,
    pattern: '(assignment_expression left: (member_expression property: (property_identifier) @prop (#eq? @prop "innerHTML")))',
    languages: ['javascript', 'typescript'],
  },
];

// ── Performance queries ────────────────────────────────────────────────────

export const PERFORMANCE_QUERIES: QueryRule[] = [
  {
    id: 'sync-fs-operation',
    severity: 'warning',
    category: 'performance',
    message: 'Synchronous file operation detected',
    explanation: 'Synchronous operations block the event loop and can degrade performance.',
    suggestion: 'Use asynchronous alternatives (readFile, writeFile) instead.',
    documentation: 'https://nodejs.org/api/fs.html',
    autoFixable: false,
    pattern: '(call_expression function: (member_expression property: (property_identifier) @method (#match? @method "^(readFileSync|writeFileSync|existsSync|mkdirSync|readdirSync|statSync|unlinkSync|rmdirSync)$")))',
    languages: ['javascript', 'typescript'],
  },
  {
    id: 'await-in-loop',
    severity: 'warning',
    category: 'performance',
    message: 'Potential N+1 query pattern: await inside loop',
    explanation: 'Making async calls inside loops can cause severe performance issues.',
    suggestion: 'Use Promise.all() or bulk fetch operations instead.',
    documentation: 'https://use-the-index-luke.com/sql/n+1-problem',
    autoFixable: false,
    pattern: '(for_statement body: (statement_block (expression_statement (await_expression))))',
    languages: ['javascript', 'typescript'],
  },
];

// ── Quality queries ────────────────────────────────────────────────────────

export const QUALITY_QUERIES: QueryRule[] = [
  {
    id: 'var-declaration',
    severity: 'warning',
    category: 'style',
    message: 'var declaration detected',
    explanation: 'var has function scope and can lead to unexpected behavior.',
    suggestion: 'Use let or const instead for block-scoped variables.',
    documentation: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/var',
    autoFixable: true,
    pattern: '(variable_declaration "var")',
    languages: ['javascript', 'typescript'],
  },
  {
    id: 'empty-catch',
    severity: 'warning',
    category: 'maintainability',
    message: 'Empty catch block detected',
    explanation: 'Empty catch blocks silently swallow errors, making debugging difficult.',
    suggestion: 'Handle the error properly or at least log it.',
    documentation: '',
    autoFixable: false,
    pattern: '(catch_clause body: (statement_block) @body (#eq? @body "{}"))',
    languages: ['javascript', 'typescript'],
  },
  {
    id: 'console-log',
    severity: 'info',
    category: 'style',
    message: 'Console logging statement detected',
    explanation: 'Console logs in production code can expose sensitive information and clutter logs.',
    suggestion: 'Remove console logs before deploying or use a proper logging library.',
    documentation: '',
    autoFixable: true,
    pattern: '(call_expression function: (member_expression object: (identifier) @obj property: (property_identifier) @method (#eq? @obj "console") (#match? @method "^(log|debug|info)$")))',
    languages: ['javascript', 'typescript'],
  },
  {
    id: 'any-type',
    severity: 'warning',
    category: 'maintainability',
    message: 'TypeScript any type usage detected',
    explanation: 'Using any defeats TypeScript type checking and can hide potential bugs.',
    suggestion: 'Use specific types or unknown instead of any.',
    documentation: 'https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#any',
    autoFixable: false,
    pattern: '(type_annotation (predefined_type) @type (#eq? @type "any"))',
    languages: ['typescript'],
  },
];

/** Get all queries applicable to a language and enabled categories. */
export function getQueriesForLanguage(
  language: string,
  categories?: { security?: boolean; performance?: boolean; maintainability?: boolean; style?: boolean },
): QueryRule[] {
  const queries: QueryRule[] = [];

  if (!categories || categories.security) {
    queries.push(...SECURITY_QUERIES.filter(q => q.languages.length === 0 || q.languages.includes(language)));
  }
  if (!categories || categories.performance) {
    queries.push(...PERFORMANCE_QUERIES.filter(q => q.languages.length === 0 || q.languages.includes(language)));
  }
  if (!categories || categories.maintainability || categories.style) {
    queries.push(...QUALITY_QUERIES.filter(q => q.languages.length === 0 || q.languages.includes(language)));
  }

  return queries;
}
