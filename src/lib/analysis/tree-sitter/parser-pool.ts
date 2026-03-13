// ---------------------------------------------------------------------------
// Tree-sitter parser pool — lazy-loads parsers per language, caches instances
// ---------------------------------------------------------------------------

// NOTE: web-tree-sitter is loaded dynamically to avoid breaking the build
// when the module isn't installed. Use `any` for the type since we can't
// import the type without Turbopack trying to resolve the module.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Parser = any;

// Language → WASM grammar file name
const GRAMMAR_MAP: Record<string, string> = {
  javascript: 'tree-sitter-javascript.wasm',
  typescript: 'tree-sitter-typescript.wasm',
  python: 'tree-sitter-python.wasm',
  java: 'tree-sitter-java.wasm',
  go: 'tree-sitter-go.wasm',
  rust: 'tree-sitter-rust.wasm',
  csharp: 'tree-sitter-c_sharp.wasm',
  php: 'tree-sitter-php.wasm',
  ruby: 'tree-sitter-ruby.wasm',
  // Smalltalk: no tree-sitter grammar available — falls back to regex backend
};

let TreeSitter: typeof Parser | null = null;
let initPromise: Promise<void> | null = null;
const parserCache = new Map<string, Parser>();
const languageCache = new Map<string, Parser.Language>();

/** Ensure the Tree-sitter WASM runtime is initialized. */
async function ensureInit(): Promise<typeof Parser> {
  if (TreeSitter) return TreeSitter;

  if (!initPromise) {
    initPromise = (async () => {
      const mod = await import('web-tree-sitter');
      const TS = mod.default || mod;
      await TS.init();
      TreeSitter = TS;
    })();
  }

  await initPromise;
  return TreeSitter!;
}

/** Resolve the path to a grammar WASM file. */
function grammarPath(fileName: string): string {
  // In Next.js, WASM files are served from /public/grammars/
  if (typeof window !== 'undefined') {
    return `/grammars/${fileName}`;
  }
  // Server-side: resolve from filesystem
  const path = require('path');
  return path.join(process.cwd(), 'public', 'grammars', fileName);
}

/** Get (or create) a parser for the given language. */
export async function getParser(language: string): Promise<Parser | null> {
  const grammarFile = GRAMMAR_MAP[language];
  if (!grammarFile) return null;

  if (parserCache.has(language)) {
    return parserCache.get(language)!;
  }

  try {
    const TS = await ensureInit();

    let lang = languageCache.get(language);
    if (!lang) {
      lang = await TS.Language.load(grammarPath(grammarFile));
      languageCache.set(language, lang);
    }

    const parser = new TS();
    parser.setLanguage(lang);
    parserCache.set(language, parser);
    return parser;
  } catch {
    // Grammar file missing or failed to load
    return null;
  }
}

/** Check if tree-sitter is available for a language. */
export async function isLanguageAvailable(language: string): Promise<boolean> {
  if (!GRAMMAR_MAP[language]) return false;
  try {
    const parser = await getParser(language);
    return parser !== null;
  } catch {
    return false;
  }
}

/** Supported languages. */
export function getSupportedLanguages(): string[] {
  return Object.keys(GRAMMAR_MAP);
}

/** Parse source code and return the tree. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function parseCode(code: string, language: string): Promise<any | null> {
  const parser = await getParser(language);
  if (!parser) return null;
  return parser.parse(code);
}
