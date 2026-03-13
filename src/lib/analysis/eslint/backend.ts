// ---------------------------------------------------------------------------
// ESLint programmatic analysis backend (JS/TS only, in-process)
// ---------------------------------------------------------------------------

import type { AnalysisBackend, AnalysisContext, StaticFinding } from '../types';
import { getMappingForRule } from './rule-map';

const JS_TS_LANGUAGES = ['javascript', 'typescript'];

export class ESLintBackend implements AnalysisBackend {
  readonly name = 'eslint';
  readonly priority = 20; // between tree-sitter (10) and regex (100)
  readonly supportedLanguages = JS_TS_LANGUAGES;

  private linterPromise: Promise<typeof import('eslint')> | null = null;

  private getLinter() {
    if (!this.linterPromise) {
      this.linterPromise = import('eslint');
    }
    return this.linterPromise;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.getLinter();
      return true;
    } catch {
      return false;
    }
  }

  async analyze(ctx: AnalysisContext): Promise<StaticFinding[]> {
    const { code, language, enabledCategories } = ctx;
    const eslintMod = await this.getLinter();

    // Use the flat Linter API (in-process, no disk I/O)
    const Linter = eslintMod.Linter;
    const linter = new Linter();

    // Build rule configuration based on enabled categories
    const rules: Record<string, string> = {};

    // Security rules
    if (!enabledCategories || enabledCategories.security) {
      rules['no-eval'] = 'warn';
    }

    // Quality/style rules
    if (!enabledCategories || enabledCategories.style || enabledCategories.maintainability) {
      rules['no-var'] = 'warn';
      rules['no-empty'] = 'warn';
      rules['no-console'] = 'warn';
      rules['eqeqeq'] = 'warn';
    }

    const isTS = language === 'typescript';

    const config = {
      languageOptions: {
        ecmaVersion: 2024 as const,
        sourceType: 'module' as const,
        ...(isTS ? {} : {}),
      },
      rules,
    };

    let messages;
    try {
      messages = linter.verify(code, config);
    } catch {
      return [];
    }

    const lines = code.split('\n');
    const findings: StaticFinding[] = [];

    for (const msg of messages) {
      if (!msg.ruleId) continue;

      const mapping = getMappingForRule(msg.ruleId);
      const lineStart = msg.line || 1;
      const lineEnd = msg.endLine || lineStart;

      const snippetStart = Math.max(0, lineStart - 2);
      const snippetEnd = Math.min(lines.length, lineEnd + 1);
      const codeSnippet = lines.slice(snippetStart, snippetEnd).join('\n');

      findings.push({
        ruleId: msg.ruleId.replace('/', '-'),
        severity: mapping.severity,
        category: mapping.category,
        message: mapping.message || msg.message,
        lineStart,
        lineEnd,
        codeSnippet,
        suggestion: mapping.suggestion,
        explanation: mapping.explanation || msg.message,
        documentation: mapping.documentation,
        autoFixable: mapping.autoFixable || !!msg.fix,
      });
    }

    return findings;
  }
}
