import * as vscode from 'vscode';

interface Finding {
  ruleId: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  category: string;
  message: string;
  lineStart: number;
  lineEnd: number;
  codeSnippet?: string;
  suggestion?: string;
}

interface ReviewResponse {
  summary: string;
  qualityScore: number;
  passed: boolean;
  findings: Finding[];
  counts: {
    critical: number;
    error: number;
    warning: number;
    info: number;
  };
}

const LANGUAGE_MAP: Record<string, string> = {
  javascript: 'javascript',
  javascriptreact: 'javascript',
  typescript: 'typescript',
  typescriptreact: 'typescript',
  python: 'python',
  java: 'java',
  go: 'go',
  rust: 'rust',
  csharp: 'csharp',
  php: 'php',
  ruby: 'ruby',
};

const diagnosticCollection = vscode.languages.createDiagnosticCollection('codeReviewAir');
let statusBarItem: vscode.StatusBarItem;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

export function activate(context: vscode.ExtensionContext) {
  // Status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'codeReviewAir.reviewFile';
  statusBarItem.text = '$(shield) AIR';
  statusBarItem.tooltip = 'AI Code Review';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codeReviewAir.reviewFile', () => reviewFile()),
    vscode.commands.registerCommand('codeReviewAir.reviewSelection', () => reviewSelection()),
    diagnosticCollection
  );

  // Auto-review on save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      const config = vscode.workspace.getConfiguration('codeReviewAir');
      if (!config.get<boolean>('autoReview')) return;

      const languageId = document.languageId;
      if (!LANGUAGE_MAP[languageId]) return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        reviewFile(document);
      }, 2000);
    })
  );
}

export function deactivate() {
  diagnosticCollection.clear();
  if (debounceTimer) clearTimeout(debounceTimer);
}

async function reviewFile(document?: vscode.TextDocument) {
  const editor = vscode.window.activeTextEditor;
  const doc = document || editor?.document;

  if (!doc) {
    vscode.window.showWarningMessage('No active file to review.');
    return;
  }

  const language = LANGUAGE_MAP[doc.languageId];
  if (!language) {
    vscode.window.showWarningMessage(`Language "${doc.languageId}" is not supported for review.`);
    return;
  }

  const code = doc.getText();
  await performReview(code, language, doc.uri);
}

async function reviewSelection() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor.');
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showWarningMessage('No text selected. Select code to review.');
    return;
  }

  const language = LANGUAGE_MAP[editor.document.languageId];
  if (!language) {
    vscode.window.showWarningMessage(`Language "${editor.document.languageId}" is not supported for review.`);
    return;
  }

  const code = editor.document.getText(selection);
  await performReview(code, language, editor.document.uri, selection.start.line);
}

async function performReview(code: string, language: string, uri: vscode.Uri, lineOffset: number = 0) {
  const config = vscode.workspace.getConfiguration('codeReviewAir');
  const serverUrl = config.get<string>('serverUrl') || 'http://localhost:3000';
  const preset = config.get<string>('preset') || 'full';

  statusBarItem.text = '$(loading~spin) AIR: Reviewing...';

  try {
    const response = await fetch(`${serverUrl}/api/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language, preset }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    const result: ReviewResponse = await response.json();

    // Update status bar
    const icon = result.passed ? '$(check)' : '$(warning)';
    statusBarItem.text = `${icon} AIR: ${result.qualityScore}/100`;

    // Create diagnostics
    updateDiagnostics(uri, result.findings, lineOffset);

    // Show results in WebView
    showResultsPanel(result, uri);
  } catch (err) {
    statusBarItem.text = '$(error) AIR: Failed';
    const message = err instanceof Error ? err.message : 'Unknown error';
    vscode.window.showErrorMessage(`Code review failed: ${message}`);
  }
}

function mapSeverity(severity: Finding['severity']): vscode.DiagnosticSeverity {
  switch (severity) {
    case 'critical':
    case 'error':
      return vscode.DiagnosticSeverity.Error;
    case 'warning':
      return vscode.DiagnosticSeverity.Warning;
    case 'info':
      return vscode.DiagnosticSeverity.Information;
  }
}

function updateDiagnostics(uri: vscode.Uri, findings: Finding[], lineOffset: number) {
  const diagnostics: vscode.Diagnostic[] = findings.map((finding) => {
    const startLine = Math.max(0, finding.lineStart - 1 + lineOffset);
    const endLine = Math.max(startLine, finding.lineEnd - 1 + lineOffset);
    const range = new vscode.Range(startLine, 0, endLine, Number.MAX_SAFE_INTEGER);

    const diagnostic = new vscode.Diagnostic(range, finding.message, mapSeverity(finding.severity));
    diagnostic.source = 'AIR';
    diagnostic.code = finding.ruleId;
    return diagnostic;
  });

  diagnosticCollection.set(uri, diagnostics);
}

function severityColor(severity: Finding['severity']): string {
  switch (severity) {
    case 'critical': return '#dc2626';
    case 'error': return '#ef4444';
    case 'warning': return '#f59e0b';
    case 'info': return '#3b82f6';
  }
}

function severityBadge(severity: Finding['severity']): string {
  const color = severityColor(severity);
  return `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;text-transform:uppercase;">${severity}</span>`;
}

function showResultsPanel(result: ReviewResponse, uri: vscode.Uri) {
  const panel = vscode.window.createWebviewPanel(
    'codeReviewResults',
    `AIR Review: ${uri.path.split('/').pop()}`,
    vscode.ViewColumn.Beside,
    { enableScripts: false }
  );

  const scoreColor = result.qualityScore >= 80 ? '#22c55e' : result.qualityScore >= 60 ? '#f59e0b' : '#ef4444';
  const passedBadge = result.passed
    ? '<span style="background:#22c55e;color:#fff;padding:4px 12px;border-radius:4px;font-weight:600;">PASSED</span>'
    : '<span style="background:#ef4444;color:#fff;padding:4px 12px;border-radius:4px;font-weight:600;">FAILED</span>';

  const findingsHtml = result.findings
    .map(
      (f) => `
      <div style="border:1px solid #333;border-left:4px solid ${severityColor(f.severity)};border-radius:6px;padding:12px;margin-bottom:10px;background:#1e1e1e;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          ${severityBadge(f.severity)}
          <span style="color:#888;font-size:12px;">${f.ruleId}</span>
          <span style="color:#888;font-size:12px;margin-left:auto;">Lines ${f.lineStart}–${f.lineEnd}</span>
        </div>
        <div style="color:#d4d4d4;margin-bottom:6px;">${escapeHtml(f.message)}</div>
        ${f.codeSnippet ? `<pre style="background:#111;padding:8px;border-radius:4px;overflow-x:auto;font-size:12px;color:#9cdcfe;">${escapeHtml(f.codeSnippet)}</pre>` : ''}
        ${f.suggestion ? `<div style="color:#4ec9b0;font-size:13px;margin-top:4px;"><strong>Suggestion:</strong> ${escapeHtml(f.suggestion)}</div>` : ''}
      </div>`
    )
    .join('');

  panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: #1a1a1a; color: #d4d4d4; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .header { margin-bottom: 24px; }
    .score { font-size: 48px; font-weight: 700; color: ${scoreColor}; }
    .counts { display: flex; gap: 16px; margin: 12px 0; }
    .count-item { text-align: center; }
    .count-value { font-size: 20px; font-weight: 700; }
    .count-label { font-size: 11px; text-transform: uppercase; color: #888; }
    .summary { background: #252525; padding: 12px; border-radius: 6px; margin-bottom: 20px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="header">
    <h1>AI Code Review Results</h1>
    <div style="display:flex;align-items:center;gap:16px;margin-top:12px;">
      <span class="score">${result.qualityScore}</span>
      <span style="font-size:14px;color:#888;">/100</span>
      ${passedBadge}
    </div>
    <div class="counts">
      <div class="count-item"><div class="count-value" style="color:#dc2626;">${result.counts.critical}</div><div class="count-label">Critical</div></div>
      <div class="count-item"><div class="count-value" style="color:#ef4444;">${result.counts.error}</div><div class="count-label">Error</div></div>
      <div class="count-item"><div class="count-value" style="color:#f59e0b;">${result.counts.warning}</div><div class="count-label">Warning</div></div>
      <div class="count-item"><div class="count-value" style="color:#3b82f6;">${result.counts.info}</div><div class="count-label">Info</div></div>
    </div>
  </div>
  <div class="summary">${escapeHtml(result.summary)}</div>
  <h2 style="font-size:16px;margin-bottom:12px;">Findings (${result.findings.length})</h2>
  ${findingsHtml || '<p style="color:#888;">No findings. Clean code!</p>'}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
