// ---------------------------------------------------------------------------
// Analysis orchestrator — registers backends, runs in priority order,
// deduplicates findings across backends.
// ---------------------------------------------------------------------------

import type { AnalysisBackend, AnalysisContext, StaticFinding } from './types';

const DEFAULT_BACKENDS = (process.env.ANALYSIS_BACKENDS || 'regex').split(',').map(s => s.trim()).filter(Boolean);

class AnalysisOrchestrator {
  private backends: AnalysisBackend[] = [];

  /** Register a backend. Backends are sorted by priority (lower = higher). */
  register(backend: AnalysisBackend): void {
    this.backends.push(backend);
    this.backends.sort((a, b) => a.priority - b.priority);
  }

  /** Return only backends that are enabled via ANALYSIS_BACKENDS env var. */
  private getEnabledBackends(): AnalysisBackend[] {
    return this.backends.filter(b => DEFAULT_BACKENDS.includes(b.name));
  }

  /**
   * Run all enabled & available backends, merge and deduplicate findings.
   * Higher-priority backends win when two findings overlap on the same rule+line.
   */
  async analyze(ctx: AnalysisContext): Promise<StaticFinding[]> {
    const enabled = this.getEnabledBackends();
    const available: AnalysisBackend[] = [];

    for (const backend of enabled) {
      // Skip backends that don't support this language
      if (
        backend.supportedLanguages.length > 0 &&
        !backend.supportedLanguages.includes(ctx.language)
      ) {
        continue;
      }
      try {
        if (await backend.isAvailable()) {
          available.push(backend);
        }
      } catch {
        // Backend unavailable — skip silently
      }
    }

    // Run all available backends in parallel
    const resultSets = await Promise.allSettled(
      available.map(b => b.analyze(ctx))
    );

    // Collect findings, prefixing ruleIds with backend name
    const allFindings: StaticFinding[] = [];
    for (let i = 0; i < resultSets.length; i++) {
      const result = resultSets[i];
      if (result.status === 'fulfilled') {
        for (const finding of result.value) {
          allFindings.push({
            ...finding,
            ruleId: finding.ruleId.startsWith(`${available[i].name}-`)
              ? finding.ruleId
              : `${available[i].name}-${finding.ruleId}`,
          });
        }
      }
    }

    return deduplicateFindings(allFindings);
  }

  /** Expose registered backend names (for debugging / health checks). */
  getRegisteredNames(): string[] {
    return this.backends.map(b => b.name);
  }
}

/**
 * Two findings are considered duplicates when they share the same base rule
 * (ignoring backend prefix) AND overlap on the same line. The first occurrence
 * wins (comes from a higher-priority backend because backends are sorted).
 */
function deduplicateFindings(findings: StaticFinding[]): StaticFinding[] {
  const seen = new Set<string>();
  return findings.filter(f => {
    const baseRule = f.ruleId.replace(/^[a-z]+-/, '');
    const key = `${baseRule}:${f.lineStart}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Singleton orchestrator
export const orchestrator = new AnalysisOrchestrator();
