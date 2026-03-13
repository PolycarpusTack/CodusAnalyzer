#!/usr/bin/env npx tsx
// ---------------------------------------------------------------------------
// Benchmark reporter — generates markdown and JSON reports
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const RESULTS_DIR = resolve(__dirname, 'results');

interface RuleResult {
  rule: string;
  category: string;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  recall: number;
  precision: number;
  f1: number;
  timeMs: number;
}

interface BenchmarkResult {
  timestamp: string;
  mode: string;
  totalFixtures: number;
  totalTimeMs: number;
  rules: RuleResult[];
  summary: {
    avgRecall: number;
    avgPrecision: number;
    avgF1: number;
    locsPerSecond: number;
  };
}

function generateMarkdown(result: BenchmarkResult): string {
  const lines: string[] = [];

  lines.push('# CodeAnalyzer Benchmark Report\n');
  lines.push(`**Date:** ${result.timestamp}`);
  lines.push(`**Mode:** ${result.mode}`);
  lines.push(`**Fixtures:** ${result.totalFixtures}`);
  lines.push(`**Total Time:** ${result.totalTimeMs.toFixed(1)}ms`);
  lines.push(`**LOC/sec:** ${result.summary.locsPerSecond.toFixed(0)}\n`);

  lines.push('## Summary\n');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Avg Recall | ${(result.summary.avgRecall * 100).toFixed(1)}% |`);
  lines.push(`| Avg Precision | ${(result.summary.avgPrecision * 100).toFixed(1)}% |`);
  lines.push(`| Avg F1 | ${(result.summary.avgF1 * 100).toFixed(1)}% |`);
  lines.push('');

  lines.push('## Per-Rule Results\n');
  lines.push('| Rule | Category | TP | FP | TN | FN | Recall | Precision | F1 | Time |');
  lines.push('|------|----------|----|----|----|----|--------|-----------|-----|------|');

  for (const r of result.rules) {
    const recall = `${(r.recall * 100).toFixed(0)}%`;
    const precision = `${(r.precision * 100).toFixed(0)}%`;
    const f1 = `${(r.f1 * 100).toFixed(0)}%`;
    const time = `${r.timeMs.toFixed(1)}ms`;
    lines.push(`| ${r.rule} | ${r.category} | ${r.tp} | ${r.fp} | ${r.tn} | ${r.fn} | ${recall} | ${precision} | ${f1} | ${time} |`);
  }

  // Baseline comparison
  const baselinePath = join(RESULTS_DIR, 'baseline.json');
  if (existsSync(baselinePath)) {
    const baseline: BenchmarkResult = JSON.parse(readFileSync(baselinePath, 'utf-8'));
    lines.push('\n## Baseline Comparison\n');
    lines.push('| Rule | Baseline Recall | Current Recall | Delta |');
    lines.push('|------|----------------|----------------|-------|');

    for (const r of result.rules) {
      const base = baseline.rules.find(b => b.rule === r.rule);
      if (base) {
        const delta = r.recall - base.recall;
        const sign = delta >= 0 ? '+' : '';
        const emoji = delta < 0 ? ' !!!' : '';
        lines.push(`| ${r.rule} | ${(base.recall * 100).toFixed(0)}% | ${(r.recall * 100).toFixed(0)}% | ${sign}${(delta * 100).toFixed(0)}%${emoji} |`);
      }
    }
  }

  return lines.join('\n');
}

// Main
const args = process.argv.slice(2);
const inputFile = args[0] || join(RESULTS_DIR, 'latest.json');

if (!existsSync(inputFile)) {
  console.error(`Input file not found: ${inputFile}`);
  console.error('Run the benchmark first: npx tsx benchmarks/runner.ts --json > benchmarks/results/latest.json');
  process.exit(1);
}

const result: BenchmarkResult = JSON.parse(readFileSync(inputFile, 'utf-8'));
const markdown = generateMarkdown(result);

// Write markdown report
const mdPath = join(RESULTS_DIR, 'report.md');
writeFileSync(mdPath, markdown);
console.log(`Markdown report written to: ${mdPath}`);

// Print to stdout as well
console.log('\n' + markdown);
