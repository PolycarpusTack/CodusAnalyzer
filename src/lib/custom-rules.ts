import type { StaticFinding } from './analysis/types';

export type { StaticFinding };

export interface CustomRule {
  id: string;
  name: string;
  pattern: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  category: string;
  message: string;
  suggestion: string;
  enabled: boolean;
}

const STORAGE_KEY = 'custom-review-rules';

/**
 * Loads custom rules from localStorage.
 * Returns an empty array if no rules are stored or if running server-side.
 */
export function loadCustomRules(): CustomRule[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as CustomRule[];
  } catch {
    return [];
  }
}

/**
 * Saves custom rules to localStorage.
 */
export function saveCustomRules(rules: CustomRule[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

/**
 * Validates a custom rule, ensuring required fields are present and the regex compiles.
 */
export function validateRule(rule: CustomRule): { valid: boolean; error?: string } {
  if (!rule.id || typeof rule.id !== 'string' || rule.id.trim().length === 0) {
    return { valid: false, error: 'Rule ID is required.' };
  }

  if (!rule.name || typeof rule.name !== 'string' || rule.name.trim().length === 0) {
    return { valid: false, error: 'Rule name is required.' };
  }

  if (!rule.pattern || typeof rule.pattern !== 'string' || rule.pattern.trim().length === 0) {
    return { valid: false, error: 'Pattern (regex) is required.' };
  }

  if (!rule.message || typeof rule.message !== 'string' || rule.message.trim().length === 0) {
    return { valid: false, error: 'Message is required.' };
  }

  const validSeverities = ['critical', 'error', 'warning', 'info'];
  if (!validSeverities.includes(rule.severity)) {
    return { valid: false, error: `Severity must be one of: ${validSeverities.join(', ')}.` };
  }

  if (!rule.category || typeof rule.category !== 'string' || rule.category.trim().length === 0) {
    return { valid: false, error: 'Category is required.' };
  }

  // Validate regex compiles
  try {
    new RegExp(rule.pattern, 'gi');
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return { valid: false, error: `Invalid regex pattern: ${errorMessage}` };
  }

  return { valid: true };
}

/**
 * Executes all enabled custom rules against the provided code string.
 * Returns findings in the same StaticFinding format used by the review API.
 */
export function runCustomRules(code: string, rules: CustomRule[]): StaticFinding[] {
  const findings: StaticFinding[] = [];
  const lines = code.split('\n');

  for (const rule of rules) {
    if (!rule.enabled) {
      continue;
    }

    // Skip rules with invalid patterns
    const validation = validateRule(rule);
    if (!validation.valid) {
      continue;
    }

    let regex: RegExp;
    try {
      regex = new RegExp(rule.pattern, 'gi');
    } catch {
      continue;
    }

    let execResult: RegExpExecArray | null;
    while ((execResult = regex.exec(code)) !== null) {
      // Prevent infinite loops on zero-length matches
      if (execResult[0].length === 0) {
        regex.lastIndex++;
        continue;
      }

      // Calculate line number from match index
      const beforeMatch = code.substring(0, execResult.index);
      const lineNum = (beforeMatch.match(/\n/g) || []).length + 1;

      // Build a code snippet (the matched line plus one line of context on each side)
      const snippetStart = Math.max(0, lineNum - 2);
      const snippetEnd = Math.min(lines.length, lineNum + 1);
      const codeSnippet = lines.slice(snippetStart, snippetEnd).join('\n');

      findings.push({
        ruleId: `custom-${rule.id}`,
        severity: rule.severity,
        category: rule.category,
        message: rule.message,
        lineStart: lineNum,
        lineEnd: lineNum,
        codeSnippet,
        suggestion: rule.suggestion || '',
        explanation: `Matched custom rule "${rule.name}".`,
        documentation: '',
        autoFixable: false,
      });
    }
  }

  return findings;
}
