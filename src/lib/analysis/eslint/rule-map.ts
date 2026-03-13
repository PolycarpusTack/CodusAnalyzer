// ---------------------------------------------------------------------------
// Maps ESLint rule IDs to CodeAnalyzer categories and severity
// ---------------------------------------------------------------------------

interface RuleMapping {
  category: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  message: string;
  explanation: string;
  suggestion: string;
  documentation: string;
  autoFixable: boolean;
}

/**
 * Map of ESLint rule IDs to CodeAnalyzer finding metadata.
 * Only rules we actively enable are listed here.
 */
export const RULE_MAP: Record<string, RuleMapping> = {
  // ── Security (eslint-plugin-security) ───────────────────────────────
  'security/detect-eval-with-expression': {
    category: 'security', severity: 'critical',
    message: 'eval() with expression detected',
    explanation: 'eval() with dynamic expressions can execute arbitrary code.',
    suggestion: 'Avoid eval() and use safer alternatives.',
    documentation: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval',
    autoFixable: false,
  },
  'security/detect-non-literal-fs-filename': {
    category: 'security', severity: 'warning',
    message: 'Non-literal file path in fs call',
    explanation: 'Using variables in fs paths can lead to path traversal attacks.',
    suggestion: 'Validate and sanitize file paths before use.',
    documentation: 'https://owasp.org/www-community/attacks/Path_Traversal',
    autoFixable: false,
  },
  'security/detect-non-literal-regexp': {
    category: 'security', severity: 'warning',
    message: 'Non-literal RegExp detected',
    explanation: 'Dynamic regular expressions can be vulnerable to ReDoS attacks.',
    suggestion: 'Use literal regex patterns or validate input.',
    documentation: 'https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS',
    autoFixable: false,
  },
  'security/detect-object-injection': {
    category: 'security', severity: 'warning',
    message: 'Potential object injection via bracket notation',
    explanation: 'Using user input to access object properties can lead to prototype pollution.',
    suggestion: 'Validate keys or use Map instead of plain objects.',
    documentation: 'https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-object-injection.md',
    autoFixable: false,
  },
  'security/detect-possible-timing-attacks': {
    category: 'security', severity: 'warning',
    message: 'Possible timing attack detected',
    explanation: 'String comparison with === can leak information through timing.',
    suggestion: 'Use crypto.timingSafeEqual() for secret comparisons.',
    documentation: 'https://codahale.com/a-lesson-in-timing-attacks/',
    autoFixable: false,
  },
  'security/detect-child-process': {
    category: 'security', severity: 'warning',
    message: 'Child process execution detected',
    explanation: 'Executing child processes can introduce command injection vulnerabilities.',
    suggestion: 'Validate and sanitize all inputs to child_process calls.',
    documentation: 'https://owasp.org/www-community/attacks/Command_Injection',
    autoFixable: false,
  },

  // ── Quality (built-in ESLint rules) ─────────────────────────────────
  'no-var': {
    category: 'style', severity: 'warning',
    message: 'var declaration detected',
    explanation: 'var has function scope and can lead to unexpected behavior.',
    suggestion: 'Use let or const instead.',
    documentation: 'https://eslint.org/docs/rules/no-var',
    autoFixable: true,
  },
  'no-eval': {
    category: 'security', severity: 'critical',
    message: 'eval() usage detected',
    explanation: 'eval() can execute arbitrary code and is a major security risk.',
    suggestion: 'Avoid eval() and use safer alternatives.',
    documentation: 'https://eslint.org/docs/rules/no-eval',
    autoFixable: false,
  },
  'no-empty': {
    category: 'maintainability', severity: 'warning',
    message: 'Empty block statement detected',
    explanation: 'Empty blocks can indicate incomplete code or swallowed errors.',
    suggestion: 'Add a comment explaining why the block is empty, or handle the case.',
    documentation: 'https://eslint.org/docs/rules/no-empty',
    autoFixable: false,
  },
  'no-console': {
    category: 'style', severity: 'info',
    message: 'Console statement detected',
    explanation: 'Console logs in production code can expose information.',
    suggestion: 'Remove console logs or use a proper logging library.',
    documentation: 'https://eslint.org/docs/rules/no-console',
    autoFixable: false,
  },
  'eqeqeq': {
    category: 'maintainability', severity: 'warning',
    message: 'Loose equality (== or !=) detected',
    explanation: 'Loose equality can lead to unexpected type coercion.',
    suggestion: 'Use strict equality (=== or !==) instead.',
    documentation: 'https://eslint.org/docs/rules/eqeqeq',
    autoFixable: true,
  },
  'no-implicit-globals': {
    category: 'maintainability', severity: 'warning',
    message: 'Implicit global variable detected',
    explanation: 'Implicit globals can cause naming conflicts and hard-to-find bugs.',
    suggestion: 'Use explicit declarations with const, let, or var.',
    documentation: 'https://eslint.org/docs/rules/no-implicit-globals',
    autoFixable: false,
  },
};

/** ESLint config object for the Linter class. */
export const ESLINT_CONFIG = {
  rules: Object.fromEntries(
    Object.keys(RULE_MAP).map(rule => [rule, 'warn'])
  ),
};

/** Get the CodeAnalyzer mapping for an ESLint rule, or a fallback. */
export function getMappingForRule(ruleId: string): RuleMapping {
  return RULE_MAP[ruleId] || {
    category: 'maintainability',
    severity: 'info',
    message: `ESLint: ${ruleId}`,
    explanation: '',
    suggestion: '',
    documentation: `https://eslint.org/docs/rules/${ruleId}`,
    autoFixable: false,
  };
}
