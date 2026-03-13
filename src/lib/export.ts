import type { Finding } from '@/components/finding-card';

interface ReviewResult {
  summary: string;
  positiveAspects: string[];
  qualityScore: number;
  totalLines: number;
  passed: boolean;
  counts: { critical: number; error: number; warning: number; info: number };
  findings: Finding[];
  testingSuggestions: string[];
}

export function exportAsMarkdown(result: ReviewResult, fileName?: string): string {
  const lines: string[] = [];

  lines.push(`# Code Review Report${fileName ? ` — ${fileName}` : ''}`);
  lines.push('');
  lines.push(`**Status:** ${result.passed ? 'PASSED' : 'FAILED'}  `);
  lines.push(`**Quality Score:** ${result.qualityScore}/100  `);
  lines.push(`**Lines Analyzed:** ${result.totalLines}  `);
  lines.push(`**Findings:** ${result.counts.critical} critical, ${result.counts.error} errors, ${result.counts.warning} warnings, ${result.counts.info} info`);
  lines.push('');
  lines.push(`## Summary`);
  lines.push('');
  lines.push(result.summary);
  lines.push('');

  if (result.positiveAspects.length > 0) {
    lines.push('## Positive Aspects');
    lines.push('');
    result.positiveAspects.forEach(a => lines.push(`- ${a}`));
    lines.push('');
  }

  const severities = ['critical', 'error', 'warning', 'info'] as const;
  for (const sev of severities) {
    const findings = result.findings.filter(f => f.severity === sev);
    if (findings.length === 0) continue;
    lines.push(`## ${sev.charAt(0).toUpperCase() + sev.slice(1)} (${findings.length})`);
    lines.push('');
    findings.forEach(f => {
      lines.push(`### [${f.category}] ${f.message}`);
      lines.push(`**Line ${f.lineStart}${f.lineEnd !== f.lineStart ? `-${f.lineEnd}` : ''}**${f.autoFixable ? ' (auto-fixable)' : ''}`);
      lines.push('');
      if (f.explanation) lines.push(`> ${f.explanation}`);
      if (f.suggestion) lines.push(`\n**Suggestion:** ${f.suggestion}`);
      if (f.codeSnippet) {
        lines.push('');
        lines.push('```');
        lines.push(f.codeSnippet);
        lines.push('```');
      }
      lines.push('');
    });
  }

  if (result.testingSuggestions.length > 0) {
    lines.push('## Testing Suggestions');
    lines.push('');
    result.testingSuggestions.forEach(s => lines.push(`- ${s}`));
    lines.push('');
  }

  return lines.join('\n');
}

export function exportAsJSON(result: ReviewResult, fileName?: string): string {
  return JSON.stringify({
    fileName: fileName || 'untitled',
    exportedAt: new Date().toISOString(),
    summary: result.summary,
    qualityScore: result.qualityScore,
    passed: result.passed,
    counts: result.counts,
    findings: result.findings.map((f) => ({
      ruleId: f.ruleId,
      severity: f.severity,
      category: f.category,
      message: f.message,
      lineStart: f.lineStart,
      lineEnd: f.lineEnd,
      suggestion: f.suggestion,
    })),
  }, null, 2)
}

export function exportAsCSV(result: ReviewResult): string {
  const headers = ['Rule ID', 'Severity', 'Category', 'Line', 'Message', 'Suggestion']
  const rows = result.findings.map((f) => [
    f.ruleId,
    f.severity,
    f.category,
    f.lineStart || '',
    `"${(f.message || '').replace(/"/g, '""')}"`,
    `"${(f.suggestion || '').replace(/"/g, '""')}"`,
  ])
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

export function downloadFile(content: string, filename: string, type = 'text/markdown') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
