// ---------------------------------------------------------------------------
// syntax-analysis.ts – Regex-based AST approximation for code analysis
// ---------------------------------------------------------------------------

export interface FunctionInfo {
  name: string;
  startLine: number;
  endLine: number;
  paramCount: number;
  complexity: number;
  isAsync: boolean;
  isExported: boolean;
}

export interface ImportInfo {
  source: string;
  specifiers: string[];
  isDefault: boolean;
  isDynamic: boolean;
  line: number;
}

export interface ExportInfo {
  name: string;
  isDefault: boolean;
  line: number;
}

export interface SyntaxAnalysisResult {
  functions: FunctionInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  classes: string[];
  duplicateBlocks: Array<{
    lines: [number, number];
    duplicateOf: [number, number];
  }>;
  unusedImports: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count parameters from a parameter-list string (handles nested generics). */
function countParams(paramStr: string): number {
  const trimmed = paramStr.trim();
  if (trimmed === '' || trimmed === '()') return 0;

  // Remove outer parens if present
  const inner = trimmed.replace(/^\(/, '').replace(/\)$/, '').trim();
  if (inner === '') return 0;

  let depth = 0;
  let count = 1;
  for (const ch of inner) {
    if (ch === '<' || ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === '>' || ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === ',' && depth === 0) count++;
  }
  return count;
}

/** Find the matching closing brace for an opening brace at `startIndex`. */
function findMatchingBrace(code: string, startIndex: number): number {
  let depth = 0;
  let inString: string | null = null;
  let escaped = false;

  for (let i = startIndex; i < code.length; i++) {
    const ch = code[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (inString) {
      if (ch === inString) inString = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Return the line number (1-based) for a character index. */
function lineAt(code: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < code.length; i++) {
    if (code[i] === '\n') line++;
  }
  return line;
}

/** Calculate cyclomatic complexity for a code body string. */
function calcComplexity(body: string): number {
  let complexity = 1; // base path

  const patterns = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bfor\s*\(/g,
    /\bfor\s*\.\.\.\s*of/g,
    /\bwhile\s*\(/g,
    /\bcase\s+/g,
    /\bcatch\s*\(/g,
    /\?\?/g,
    /\?\./g,
    /&&/g,
    /\|\|/g,
    /\?\s*[^:]/g, // ternary (approximate)
  ];

  for (const pat of patterns) {
    const matches = body.match(pat);
    if (matches) complexity += matches.length;
  }

  return complexity;
}

// ---------------------------------------------------------------------------
// Static import extraction
// ---------------------------------------------------------------------------

function extractImports(code: string, lines: string[]): ImportInfo[] {
  const results: ImportInfo[] = [];

  // Static imports: import ... from '...'
  const staticRe =
    /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;

  while ((m = staticRe.exec(code)) !== null) {
    const specPart = m[1].trim();
    const source = m[2];
    const line = lineAt(code, m.index);
    const specifiers: string[] = [];
    let isDefault = false;

    // default import
    const defaultMatch = specPart.match(/^(\w+)/);
    if (defaultMatch && !specPart.startsWith('{') && !specPart.startsWith('*')) {
      isDefault = true;
      specifiers.push(defaultMatch[1]);
    }

    // named imports { a, b as c }
    const namedMatch = specPart.match(/\{([^}]+)\}/);
    if (namedMatch) {
      namedMatch[1].split(',').forEach((s) => {
        const parts = s.trim().split(/\s+as\s+/);
        const name = (parts[1] || parts[0]).trim();
        if (name) specifiers.push(name);
      });
    }

    // namespace import * as X
    const nsMatch = specPart.match(/\*\s+as\s+(\w+)/);
    if (nsMatch) {
      specifiers.push(nsMatch[1]);
      isDefault = true;
    }

    results.push({ source, specifiers, isDefault, isDynamic: false, line });
  }

  // Side-effect imports: import '...'
  const sideEffectRe = /import\s+['"]([^'"]+)['"]/g;
  while ((m = sideEffectRe.exec(code)) !== null) {
    // Avoid double-matching lines already captured above
    const line = lineAt(code, m.index);
    if (results.some((r) => r.line === line)) continue;
    results.push({
      source: m[1],
      specifiers: [],
      isDefault: false,
      isDynamic: false,
      line,
    });
  }

  // Dynamic imports: import('...')
  const dynRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = dynRe.exec(code)) !== null) {
    results.push({
      source: m[1],
      specifiers: [],
      isDefault: false,
      isDynamic: true,
      line: lineAt(code, m.index),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Export extraction
// ---------------------------------------------------------------------------

function extractExports(code: string): ExportInfo[] {
  const results: ExportInfo[] = [];

  // export default ...
  const defaultRe = /export\s+default\s+(?:function|class|abstract\s+class)?\s*(\w*)/g;
  let m: RegExpExecArray | null;
  while ((m = defaultRe.exec(code)) !== null) {
    results.push({
      name: m[1] || 'default',
      isDefault: true,
      line: lineAt(code, m.index),
    });
  }

  // export function / export class / export const|let|var
  const namedRe =
    /export\s+(?:async\s+)?(?:function\*?|class|abstract\s+class|const|let|var|enum|interface|type)\s+(\w+)/g;
  while ((m = namedRe.exec(code)) !== null) {
    results.push({
      name: m[1],
      isDefault: false,
      line: lineAt(code, m.index),
    });
  }

  // export { a, b as c }
  const bracketRe = /export\s*\{([^}]+)\}/g;
  while ((m = bracketRe.exec(code)) !== null) {
    const line = lineAt(code, m.index);
    m[1].split(',').forEach((s) => {
      const parts = s.trim().split(/\s+as\s+/);
      const name = (parts[1] || parts[0]).trim();
      if (name) {
        results.push({ name, isDefault: name === 'default', line });
      }
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Function extraction
// ---------------------------------------------------------------------------

function extractFunctions(code: string): FunctionInfo[] {
  const results: FunctionInfo[] = [];
  const lines = code.split('\n');

  // 1. Named function declarations
  //    export? async? function name(params) {
  const fnDeclRe =
    /(export\s+)?(?:async\s+)?function\s*\*?\s*(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;

  while ((m = fnDeclRe.exec(code)) !== null) {
    const isExported = !!m[1];
    const isAsync = /async/.test(m[0]);
    const name = m[2];
    const paramCount = countParams(m[3]);
    const startLine = lineAt(code, m.index);

    // find body
    const braceIdx = code.indexOf('{', m.index + m[0].length);
    let endLine = startLine;
    if (braceIdx !== -1) {
      const closeIdx = findMatchingBrace(code, braceIdx);
      if (closeIdx !== -1) {
        endLine = lineAt(code, closeIdx);
        const body = code.slice(braceIdx, closeIdx + 1);
        results.push({
          name,
          startLine,
          endLine,
          paramCount,
          complexity: calcComplexity(body),
          isAsync,
          isExported,
        });
        continue;
      }
    }
    results.push({
      name,
      startLine,
      endLine,
      paramCount,
      complexity: 1,
      isAsync,
      isExported,
    });
  }

  // 2. Arrow functions assigned to const/let/var
  //    export? const name = (async)? (params) => {
  const arrowRe =
    /(export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+?)?\s*=\s*(async\s+)?(?:\([^)]*\)|(\w+))\s*(?::\s*[^=]*?)?\s*=>/g;

  while ((m = arrowRe.exec(code)) !== null) {
    const isExported = !!m[1];
    const isAsync = !!m[3];
    const name = m[2];
    const startLine = lineAt(code, m.index);

    // Try to extract parameter count
    const paramMatch = m[0].match(/=\s*(?:async\s+)?\(([^)]*)\)/);
    const paramCount = paramMatch ? countParams(paramMatch[1]) : (m[4] ? 1 : 0);

    // find body
    const arrowIdx = code.indexOf('=>', m.index + m[0].length - 2);
    let endLine = startLine;
    let complexity = 1;

    if (arrowIdx !== -1) {
      const afterArrow = code.slice(arrowIdx + 2).trimStart();
      if (afterArrow.startsWith('{')) {
        const braceIdx = code.indexOf('{', arrowIdx + 2);
        const closeIdx = findMatchingBrace(code, braceIdx);
        if (closeIdx !== -1) {
          endLine = lineAt(code, closeIdx);
          complexity = calcComplexity(code.slice(braceIdx, closeIdx + 1));
        }
      } else {
        // single-expression arrow – find end by newline/semicolon at depth 0
        endLine = startLine;
        complexity = 1;
      }
    }

    results.push({
      name,
      startLine,
      endLine,
      paramCount,
      complexity,
      isAsync,
      isExported,
    });
  }

  // 3. Class methods (simplified)
  const methodRe =
    /(?:(?:public|private|protected|static|readonly|override|abstract|async)\s+)*(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*[^{]+?)?\s*\{/g;

  while ((m = methodRe.exec(code)) !== null) {
    const name = m[1];
    // Skip language keywords that look like method names
    if (['if', 'for', 'while', 'switch', 'catch', 'function', 'class', 'return', 'import', 'export', 'from', 'const', 'let', 'var', 'new', 'else'].includes(name)) {
      continue;
    }
    // Skip if already captured as a regular function
    const startLine = lineAt(code, m.index);
    if (results.some((r) => r.startLine === startLine)) continue;

    const paramCount = countParams(m[2]);
    const isAsync = /async/.test(m[0]);
    const braceIdx = code.indexOf('{', m.index + m[0].length - 1);
    let endLine = startLine;
    let complexity = 1;

    if (braceIdx !== -1) {
      const closeIdx = findMatchingBrace(code, braceIdx);
      if (closeIdx !== -1) {
        endLine = lineAt(code, closeIdx);
        complexity = calcComplexity(code.slice(braceIdx, closeIdx + 1));
      }
    }

    results.push({
      name,
      startLine,
      endLine,
      paramCount,
      complexity,
      isAsync,
      isExported: false,
    });
  }

  // Deduplicate by startLine
  const seen = new Set<number>();
  return results.filter((f) => {
    if (seen.has(f.startLine)) return false;
    seen.add(f.startLine);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Class extraction
// ---------------------------------------------------------------------------

function extractClasses(code: string): string[] {
  const re = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g;
  const classes: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    classes.push(m[1]);
  }
  return classes;
}

// ---------------------------------------------------------------------------
// Duplicate block detection (>3 identical consecutive lines appearing twice)
// ---------------------------------------------------------------------------

function detectDuplicateBlocks(
  lines: string[],
  minLines = 4
): Array<{ lines: [number, number]; duplicateOf: [number, number] }> {
  const results: Array<{ lines: [number, number]; duplicateOf: [number, number] }> = [];
  const blockMap = new Map<string, number>(); // hash -> first occurrence line (0-based)

  // Normalise lines for comparison (trim whitespace)
  const normalised = lines.map((l) => l.trim());

  for (let i = 0; i <= normalised.length - minLines; i++) {
    // Skip blank-only blocks
    const block = normalised.slice(i, i + minLines);
    if (block.every((l) => l === '')) continue;

    const key = block.join('\n');

    if (blockMap.has(key)) {
      const firstLine = blockMap.get(key)!;
      // Avoid overlapping ranges
      if (i >= firstLine + minLines) {
        results.push({
          lines: [i + 1, i + minLines],
          duplicateOf: [firstLine + 1, firstLine + minLines],
        });
      }
    } else {
      blockMap.set(key, i);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Unused import detection
// ---------------------------------------------------------------------------

function detectUnusedImports(
  code: string,
  imports: ImportInfo[]
): string[] {
  const unused: string[] = [];

  // Remove import lines from code for scanning usage
  const lines = code.split('\n');
  const importLines = new Set(imports.map((i) => i.line));
  const codeWithoutImports = lines
    .filter((_, idx) => !importLines.has(idx + 1))
    .join('\n');

  for (const imp of imports) {
    for (const spec of imp.specifiers) {
      // Check if the specifier name appears anywhere in the rest of the code
      const nameRe = new RegExp(`\\b${spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (!nameRe.test(codeWithoutImports)) {
        unused.push(spec);
      }
    }
  }

  return unused;
}

// ---------------------------------------------------------------------------
// Main public API
// ---------------------------------------------------------------------------

export function analyzeSyntax(
  code: string,
  language: string
): SyntaxAnalysisResult {
  const lines = code.split('\n');
  const imports = extractImports(code, lines);
  const exports = extractExports(code);
  const functions = extractFunctions(code);
  const classes = extractClasses(code);
  const duplicateBlocks = detectDuplicateBlocks(lines);
  const unusedImports = detectUnusedImports(code, imports);

  return {
    functions,
    imports,
    exports,
    classes,
    duplicateBlocks,
    unusedImports,
  };
}

export function analyzeComplexityPerFunction(code: string): FunctionInfo[] {
  return extractFunctions(code);
}
