// ---------------------------------------------------------------------------
// Tree-sitter analysis backend
// ---------------------------------------------------------------------------

import type { AnalysisBackend, AnalysisContext, StaticFinding } from '../types';
import { parseCode, getSupportedLanguages, isLanguageAvailable } from './parser-pool';
import { getQueriesForLanguage } from './queries';
import { isInNonCodeContext, getLineRange } from './ast-utils';
export class TreeSitterBackend implements AnalysisBackend {
  readonly name = 'treesitter';
  readonly priority = 10; // highest priority — most accurate
  readonly supportedLanguages = getSupportedLanguages();

  async isAvailable(): Promise<boolean> {
    try {
      // Check if web-tree-sitter module can be loaded
      await import('web-tree-sitter');
      return true;
    } catch {
      return false;
    }
  }

  async analyze(ctx: AnalysisContext): Promise<StaticFinding[]> {
    const { code, language, enabledCategories } = ctx;

    // Check language availability
    if (!(await isLanguageAvailable(language))) {
      return [];
    }

    const tree = await parseCode(code, language);
    if (!tree) return [];

    const queries = getQueriesForLanguage(language, enabledCategories);
    const findings: StaticFinding[] = [];
    const lines = code.split('\n');

    for (const queryRule of queries) {
      try {
        const matches = runQuery(tree, code, queryRule.pattern, language);

        for (const match of matches) {
          // Filter out matches inside comments or strings
          if (isInNonCodeContext(match.node)) continue;

          const lineStart = match.node.startPosition.row + 1;
          const lineEnd = match.node.endPosition.row + 1;

          const snippetStart = Math.max(1, lineStart - 1);
          const snippetEnd = Math.min(lines.length, lineEnd + 1);
          const codeSnippet = getLineRange(code, snippetStart, snippetEnd);

          findings.push({
            ruleId: queryRule.id,
            severity: queryRule.severity,
            category: queryRule.category,
            message: queryRule.message,
            lineStart,
            lineEnd,
            codeSnippet,
            suggestion: queryRule.suggestion,
            explanation: queryRule.explanation,
            documentation: queryRule.documentation,
            autoFixable: queryRule.autoFixable,
          });
        }
      } catch {
        // Query failed for this rule — skip it
      }
    }

    return findings;
  }
}

interface QueryMatch {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any;
}

function runQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tree: any,
  code: string,
  pattern: string,
  language: string,
): QueryMatch[] {
  const results: QueryMatch[] = [];

  try {
    const lang = tree.rootNode.tree.getLanguage();
    const query = lang.query(pattern);
    const matches = query.matches(tree.rootNode);

    for (const match of matches) {
      // Use the first capture as the match node
      if (match.captures.length > 0) {
        results.push({ node: match.captures[0].node });
      }
    }
  } catch {
    // Query syntax error or unsupported — skip
  }

  return results;
}
