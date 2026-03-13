// ---------------------------------------------------------------------------
// Canonical types for the analysis subsystem
// ---------------------------------------------------------------------------

export interface StaticFinding {
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

export interface EnabledCategories {
  security: boolean;
  performance: boolean;
  maintainability: boolean;
  style: boolean;
}

export interface AnalysisContext {
  code: string;
  language: string;
  fileName?: string;
  enabledCategories?: EnabledCategories;
}

/**
 * Every analysis backend (regex, tree-sitter, eslint, semgrep) implements
 * this interface so the orchestrator can treat them uniformly.
 */
export interface AnalysisBackend {
  /** Unique name used for logging and env-var toggling (e.g. "regex"). */
  readonly name: string;

  /** Lower number = higher priority when deduplicating overlapping findings. */
  readonly priority: number;

  /** Languages this backend supports. Empty array means "all". */
  readonly supportedLanguages: string[];

  /** Returns true when the backend is ready (e.g. WASM loaded, CLI found). */
  isAvailable(): Promise<boolean>;

  /** Run analysis and return findings. */
  analyze(ctx: AnalysisContext): Promise<StaticFinding[]>;
}
