// ---------------------------------------------------------------------------
// static-analysis.ts — Shared entry point for running static analysis.
// Delegates to the analysis orchestrator which manages all backends.
// ---------------------------------------------------------------------------

import { orchestrator } from './analysis/analyzer';
import { RegexBackend } from './analysis/regex-backend';
import { TreeSitterBackend } from './analysis/tree-sitter/backend';
import { ESLintBackend } from './analysis/eslint/backend';
import type { StaticFinding, EnabledCategories, AnalysisContext } from './analysis/types';

// Re-export types so consumers don't need to reach into analysis/
export type { StaticFinding, EnabledCategories, AnalysisContext } from './analysis/types';

// ── Register all backends on first import ──────────────────────────────────
let initialized = false;

function ensureInitialized() {
  if (initialized) return;
  initialized = true;

  // Priority order: tree-sitter (10) > eslint (20) > regex (100)
  orchestrator.register(new TreeSitterBackend());
  orchestrator.register(new ESLintBackend());
  orchestrator.register(new RegexBackend());
}

/**
 * Run all enabled analysis backends against the provided code.
 * Drop-in replacement for the old inline `runStaticAnalysis`.
 */
export async function runStaticAnalysis(
  code: string,
  language: string,
  enabledCategories?: EnabledCategories,
): Promise<StaticFinding[]> {
  ensureInitialized();

  const ctx: AnalysisContext = { code, language, enabledCategories };
  return orchestrator.analyze(ctx);
}
