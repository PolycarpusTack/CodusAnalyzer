/**
 * Evaluation utilities module.
 *
 * NOTE: This module does NOT use eval(). The naming refers to
 * "evaluation" in the mathematical/logical sense.
 */

interface EvalResult {
  score: number;
  passed: boolean;
  details: string;
}

export function computeEvalResult(input: number, threshold: number): EvalResult {
  const evalScore = input / threshold;
  const evalPassed = evalScore >= 1.0;

  return {
    score: evalScore,
    passed: evalPassed,
    details: `Evaluation complete: score=${evalScore.toFixed(2)}`,
  };
}

// Store evaluation results for later review
const evalResults: EvalResult[] = [];

export function storeEvalResult(result: EvalResult): void {
  evalResults.push(result);
}
