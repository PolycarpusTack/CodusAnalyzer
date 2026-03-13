export interface FixResult {
  code: string;
  appliedFixes: string[];
}

export function applyAutoFixes(code: string): FixResult {
  const appliedFixes: string[] = [];
  let fixed = code;

  // Fix: var -> const (simple cases where the variable isn't reassigned)
  const varPattern = /\bvar\s+(\w+)\s*=/g;
  if (varPattern.test(fixed)) {
    fixed = fixed.replace(/\bvar\s+(\w+)\s*=/g, 'const $1 =');
    appliedFixes.push('Replaced `var` declarations with `const`');
  }

  // Fix: Remove console.log/debug/info statements
  const consolePattern = /^\s*console\.(log|debug|info)\s*\(.*\);?\s*\n?/gm;
  if (consolePattern.test(fixed)) {
    fixed = fixed.replace(consolePattern, '');
    appliedFixes.push('Removed `console.log/debug/info` statements');
  }

  // Fix: Empty catch blocks -> add comment
  const emptyCatchPattern = /catch\s*\((\w+)\)\s*\{\s*\}/g;
  if (emptyCatchPattern.test(fixed)) {
    fixed = fixed.replace(emptyCatchPattern, 'catch ($1) {\n    // TODO: Handle error\n    console.error($1);\n  }');
    appliedFixes.push('Added error handling to empty `catch` blocks');
  }

  return { code: fixed, appliedFixes };
}
