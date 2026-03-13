#!/usr/bin/env npx tsx
// ---------------------------------------------------------------------------
// Benchmark runner — loads fixtures, runs analysis, classifies results
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { RegexBackend } from '../src/lib/analysis/regex-backend';
import type { StaticFinding, AnalysisContext } from '../src/lib/analysis/types';

const BENCHMARKS_DIR = resolve(__dirname);

interface FixtureEntry {
  rule: string;
  category: string;
  truePositives: string[];
  trueNegatives: string[];
}

interface Manifest {
  version: number;
  fixtures: FixtureEntry[];
}

interface RuleResult {
  rule: string;
  category: string;
  tp: number; // true positives
  fp: number; // false positives
  tn: number; // true negatives
  fn: number; // false negatives
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

// Parse CLI args
const args = process.argv.slice(2);
const mode = args.find(a => a.startsWith('--mode='))?.split('=')[1] || 'regex';
const outputJson = args.includes('--json');

async function main() {
  const manifestPath = join(BENCHMARKS_DIR, 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error('manifest.json not found');
    process.exit(1);
  }

  const manifest: Manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  const backend = new RegexBackend();

  const results: RuleResult[] = [];
  let totalFixtures = 0;
  let totalLOC = 0;
  const startTime = performance.now();

  for (const fixture of manifest.fixtures) {
    let tp = 0, fp = 0, tn = 0, fn = 0;
    const ruleStart = performance.now();

    // Test true positives (should detect the rule)
    for (const tpFile of fixture.truePositives) {
      const filePath = join(BENCHMARKS_DIR, tpFile);
      if (!existsSync(filePath)) {
        console.warn(`  Missing: ${tpFile}`);
        continue;
      }

      const code = readFileSync(filePath, 'utf-8');
      totalLOC += code.split('\n').length;
      totalFixtures++;

      const findings = await backend.analyze({ code, language: 'typescript' });
      const detected = findings.some(f => matchesRule(f, fixture.rule));

      if (detected) {
        tp++;
      } else {
        fn++;
        if (!outputJson) console.warn(`  FN: ${tpFile} — ${fixture.rule} not detected`);
      }
    }

    // Test true negatives (should NOT detect the rule)
    for (const tnFile of fixture.trueNegatives) {
      const filePath = join(BENCHMARKS_DIR, tnFile);
      if (!existsSync(filePath)) {
        console.warn(`  Missing: ${tnFile}`);
        continue;
      }

      const code = readFileSync(filePath, 'utf-8');
      totalLOC += code.split('\n').length;
      totalFixtures++;

      const findings = await backend.analyze({ code, language: 'typescript' });
      const detected = findings.some(f => matchesRule(f, fixture.rule));

      if (detected) {
        fp++;
        if (!outputJson) console.warn(`  FP: ${tnFile} — ${fixture.rule} falsely detected`);
      } else {
        tn++;
      }
    }

    const ruleTimeMs = performance.now() - ruleStart;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const f1 = recall + precision > 0 ? 2 * (recall * precision) / (recall + precision) : 0;

    results.push({
      rule: fixture.rule,
      category: fixture.category,
      tp, fp, tn, fn,
      recall,
      precision,
      f1,
      timeMs: ruleTimeMs,
    });
  }

  const totalTimeMs = performance.now() - startTime;
  const avgRecall = results.reduce((s, r) => s + r.recall, 0) / results.length;
  const avgPrecision = results.reduce((s, r) => s + r.precision, 0) / results.length;
  const avgF1 = results.reduce((s, r) => s + r.f1, 0) / results.length;
  const locsPerSecond = totalLOC / (totalTimeMs / 1000);

  const benchmarkResult: BenchmarkResult = {
    timestamp: new Date().toISOString(),
    mode,
    totalFixtures,
    totalTimeMs,
    rules: results,
    summary: {
      avgRecall,
      avgPrecision,
      avgF1,
      locsPerSecond,
    },
  };

  if (outputJson) {
    console.log(JSON.stringify(benchmarkResult, null, 2));
  } else {
    printReport(benchmarkResult);
  }

  // Check for regressions against baseline
  const baselinePath = join(BENCHMARKS_DIR, 'results', 'baseline.json');
  if (existsSync(baselinePath)) {
    const baseline: BenchmarkResult = JSON.parse(readFileSync(baselinePath, 'utf-8'));
    checkRegressions(benchmarkResult, baseline);
  }
}

function matchesRule(finding: StaticFinding, rule: string): boolean {
  // Match both prefixed (e.g., "regex-sql-injection") and unprefixed
  return finding.ruleId === rule ||
    finding.ruleId.endsWith(`-${rule}`) ||
    finding.ruleId.startsWith(`${rule}-`);
}

function printReport(result: BenchmarkResult) {
  console.log('\n========================================');
  console.log('  CodeAnalyzer Detection Benchmark');
  console.log('========================================\n');
  console.log(`Mode: ${result.mode}`);
  console.log(`Fixtures: ${result.totalFixtures}`);
  console.log(`Time: ${result.totalTimeMs.toFixed(1)}ms`);
  console.log(`LOC/sec: ${result.summary.locsPerSecond.toFixed(0)}\n`);

  console.log('Rule                     | TP | FP | TN | FN | Recall | Precision | F1');
  console.log('-------------------------+----+----+----+----+--------+-----------+------');

  for (const r of result.rules) {
    const name = r.rule.padEnd(24);
    const tp = String(r.tp).padStart(2);
    const fp = String(r.fp).padStart(2);
    const tn = String(r.tn).padStart(2);
    const fn = String(r.fn).padStart(2);
    const recall = (r.recall * 100).toFixed(0).padStart(5) + '%';
    const precision = (r.precision * 100).toFixed(0).padStart(8) + '%';
    const f1 = (r.f1 * 100).toFixed(0).padStart(4) + '%';
    console.log(`${name} | ${tp} | ${fp} | ${tn} | ${fn} | ${recall} | ${precision} | ${f1}`);
  }

  console.log('\n--- Summary ---');
  console.log(`Avg Recall:    ${(result.summary.avgRecall * 100).toFixed(1)}%`);
  console.log(`Avg Precision: ${(result.summary.avgPrecision * 100).toFixed(1)}%`);
  console.log(`Avg F1:        ${(result.summary.avgF1 * 100).toFixed(1)}%`);
}

function checkRegressions(current: BenchmarkResult, baseline: BenchmarkResult) {
  let hasRegression = false;

  for (const rule of current.rules) {
    const baselineRule = baseline.rules.find(r => r.rule === rule.rule);
    if (!baselineRule) continue;

    if (rule.recall < baselineRule.recall - 0.01) {
      console.error(`REGRESSION: ${rule.rule} recall dropped from ${(baselineRule.recall * 100).toFixed(0)}% to ${(rule.recall * 100).toFixed(0)}%`);
      hasRegression = true;
    }
  }

  if (hasRegression) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
