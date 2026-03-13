const EXTENSION_MAP: Record<string, string> = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.py': 'python',
  '.pyw': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.cs': 'csharp',
  '.php': 'php',
  '.rb': 'ruby',
  '.st': 'smalltalk',
  '.cs2': 'smalltalk',  // VisualWorks Smalltalk chunk format
};

export function detectLanguage(filename: string): string | null {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return EXTENSION_MAP[ext] || null;
}
