#!/usr/bin/env npx tsx
// ---------------------------------------------------------------------------
// build-grammars.ts — Copy tree-sitter WASM grammar files to public/grammars/
// ---------------------------------------------------------------------------

import { cpSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

// WASM files we need — all sourced from the `tree-sitter-wasms` package
const GRAMMARS = [
  'tree-sitter-javascript.wasm',
  'tree-sitter-typescript.wasm',
  'tree-sitter-python.wasm',
  'tree-sitter-java.wasm',
  'tree-sitter-go.wasm',
  'tree-sitter-rust.wasm',
  'tree-sitter-c_sharp.wasm',
  'tree-sitter-php.wasm',
  'tree-sitter-ruby.wasm',
];

const wasmsDir = join(process.cwd(), 'node_modules', 'tree-sitter-wasms', 'out');
const outDir = join(process.cwd(), 'public', 'grammars');
mkdirSync(outDir, { recursive: true });

let copied = 0;
let missing = 0;

for (const wasmFile of GRAMMARS) {
  const src = join(wasmsDir, wasmFile);
  if (existsSync(src)) {
    cpSync(src, join(outDir, wasmFile));
    console.log(`  Copied: ${wasmFile}`);
    copied++;
  } else {
    console.warn(`  Missing: ${wasmFile}`);
    missing++;
  }
}

console.log(`\nDone: ${copied} copied, ${missing} missing.`);
if (missing > 0) {
  console.log('Install missing grammars and re-run this script.');
}
