// ---------------------------------------------------------------------------
// cross-file-analysis.ts – Cross-file dependency detection for multi-file reviews
// ---------------------------------------------------------------------------

import { analyzeSyntax } from './syntax-analysis';
import type { ImportInfo, ExportInfo } from './syntax-analysis';

export interface FileInfo {
  fileName: string;
  content: string;
  language: string;
}

export interface CrossFileResult {
  circularDeps: string[][];
  unusedExports: Array<{ file: string; export: string }>;
  missingImports: Array<{ file: string; import: string; from: string }>;
  sharedDependencies: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise an import source to a canonical file key so that
 * `./utils`, `./utils.ts`, `../lib/utils` can be matched against file names
 * in the provided set. Returns `null` if the import is an external package.
 */
function resolveImportSource(
  importSource: string,
  importerFile: string,
  fileNames: Set<string>
): string | null {
  // Skip bare-specifier / package imports (no relative or alias path)
  if (
    !importSource.startsWith('.') &&
    !importSource.startsWith('/') &&
    !importSource.startsWith('@/')
  ) {
    return null;
  }

  // Handle Next.js / TS path alias @/
  let resolved = importSource;
  if (resolved.startsWith('@/')) {
    resolved = resolved.replace(/^@\//, 'src/');
  }

  // Resolve relative paths
  if (resolved.startsWith('.')) {
    const importerDir = importerFile.substring(
      0,
      importerFile.lastIndexOf('/') + 1
    );
    resolved = normalisePath(importerDir + resolved);
  }

  // Try direct match first
  if (fileNames.has(resolved)) return resolved;

  // Try common extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
  for (const ext of extensions) {
    if (fileNames.has(resolved + ext)) return resolved + ext;
  }

  // Try index files
  for (const ext of extensions) {
    const indexPath = resolved.replace(/\/$/, '') + '/index' + ext;
    if (fileNames.has(indexPath)) return indexPath;
  }

  return null;
}

/** Simple path normalisation – resolves `.` and `..` segments. */
function normalisePath(p: string): string {
  const parts = p.split('/');
  const stack: string[] = [];
  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      stack.pop();
    } else {
      stack.push(part);
    }
  }
  return stack.join('/');
}

// ---------------------------------------------------------------------------
// Circular dependency detection via DFS
// ---------------------------------------------------------------------------

function detectCircularDeps(
  adjacency: Map<string, Set<string>>
): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): void {
    if (inStack.has(node)) {
      // Found a cycle – extract from the point where this node first appears
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        const cycle = [...path.slice(cycleStart), node];
        // Avoid duplicate cycle reporting (canonical form: start from smallest)
        const minIdx = cycle.indexOf(
          cycle.reduce((a, b) => (a < b ? a : b))
        );
        const canonical = [
          ...cycle.slice(minIdx),
          ...cycle.slice(0, minIdx),
        ];
        // Check if we already recorded this cycle
        const key = canonical.join(' -> ');
        if (!seenCycles.has(key)) {
          seenCycles.add(key);
          cycles.push(canonical);
        }
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    const neighbours = adjacency.get(node);
    if (neighbours) {
      for (const n of neighbours) {
        dfs(n);
      }
    }

    path.pop();
    inStack.delete(node);
  }

  const seenCycles = new Set<string>();
  for (const node of adjacency.keys()) {
    visited.clear();
    inStack.clear();
    path.length = 0;
    dfs(node);
  }

  return cycles;
}

// ---------------------------------------------------------------------------
// Main public API
// ---------------------------------------------------------------------------

export function analyzeCrossFileDependencies(
  files: FileInfo[]
): CrossFileResult {
  const fileNames = new Set(files.map((f) => f.fileName));

  // Analyse each file
  const analysisMap = new Map<
    string,
    { imports: ImportInfo[]; exports: ExportInfo[] }
  >();

  for (const file of files) {
    const result = analyzeSyntax(file.content, file.language);
    analysisMap.set(file.fileName, {
      imports: result.imports,
      exports: result.exports,
    });
  }

  // Build adjacency list (file -> files it imports)
  const adjacency = new Map<string, Set<string>>();
  // Track which exports are consumed elsewhere
  const consumedExports = new Map<string, Set<string>>(); // file -> set of consumed export names

  // Track shared external dependencies
  const externalDeps = new Map<string, string[]>(); // package -> list of files that import it

  // Track imports that reference files in the set
  const missingImports: Array<{
    file: string;
    import: string;
    from: string;
  }> = [];

  for (const [fileName, analysis] of analysisMap) {
    if (!adjacency.has(fileName)) {
      adjacency.set(fileName, new Set());
    }

    for (const imp of analysis.imports) {
      const resolved = resolveImportSource(imp.source, fileName, fileNames);

      if (resolved) {
        // Internal import – add edge
        adjacency.get(fileName)!.add(resolved);

        // Mark these specifiers as consumed
        if (!consumedExports.has(resolved)) {
          consumedExports.set(resolved, new Set());
        }
        for (const spec of imp.specifiers) {
          consumedExports.get(resolved)!.add(spec);
        }
        // If no specifiers (side-effect import), mark all exports as consumed
        if (imp.specifiers.length === 0) {
          const targetAnalysis = analysisMap.get(resolved);
          if (targetAnalysis) {
            for (const exp of targetAnalysis.exports) {
              consumedExports.get(resolved)!.add(exp.name);
            }
          }
        }
      } else if (
        imp.source.startsWith('.') ||
        imp.source.startsWith('@/')
      ) {
        // Looks like an internal import but could not be resolved
        missingImports.push({
          file: fileName,
          import: imp.specifiers.join(', ') || imp.source,
          from: imp.source,
        });
      } else {
        // External package
        if (!externalDeps.has(imp.source)) {
          externalDeps.set(imp.source, []);
        }
        externalDeps.get(imp.source)!.push(fileName);
      }
    }
  }

  // Detect circular dependencies
  const circularDeps = detectCircularDeps(adjacency);

  // Detect unused exports
  const unusedExports: Array<{ file: string; export: string }> = [];
  for (const [fileName, analysis] of analysisMap) {
    const consumed = consumedExports.get(fileName) || new Set();
    for (const exp of analysis.exports) {
      if (!consumed.has(exp.name) && !consumed.has('default')) {
        unusedExports.push({ file: fileName, export: exp.name });
      }
    }
  }

  // Build shared dependencies (only packages imported by 2+ files)
  const sharedDependencies: Record<string, string[]> = {};
  for (const [pkg, importers] of externalDeps) {
    if (importers.length >= 2) {
      sharedDependencies[pkg] = [...new Set(importers)];
    }
  }

  return {
    circularDeps,
    unusedExports,
    missingImports,
    sharedDependencies,
  };
}
