'use client';

import { useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { OnMount, BeforeMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

// Lazy-load Monaco to avoid SSR issues
const MonacoEditor = dynamic(() => import('@monaco-editor/react').then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-lg bg-[#1C2333]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5B33F0] border-t-transparent" />
        <span className="font-mono text-sm text-[#5E6F8A]">Loading editor...</span>
      </div>
    </div>
  ),
});

export interface HighlightAnnotation {
  line: number;
  severity: 'critical' | 'error' | 'warning' | 'info';
}

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  readOnly?: boolean;
  highlights?: HighlightAnnotation[];
}

const SEVERITY_STYLES: Record<
  HighlightAnnotation['severity'],
  { className: string; glyphClassName: string }
> = {
  critical: {
    className: 'highlight-critical',
    glyphClassName: 'glyph-critical',
  },
  error: {
    className: 'highlight-error',
    glyphClassName: 'glyph-error',
  },
  warning: {
    className: 'highlight-warning',
    glyphClassName: 'glyph-warning',
  },
  info: {
    className: 'highlight-info',
    glyphClassName: 'glyph-info',
  },
};

function injectDecorationStyles() {
  const styleId = 'code-editor-decoration-styles';
  if (typeof document === 'undefined' || document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .highlight-critical {
      background-color: #1A0505 !important;
      border-left: 3px solid #F87171 !important;
    }
    .highlight-error {
      background-color: #1A1205 !important;
      border-left: 3px solid #F59E0B !important;
    }
    .highlight-warning {
      background-color: #1A1205 !important;
      border-left: 3px solid #F59E0B !important;
    }
    .highlight-info {
      background-color: #050D1A !important;
      border-left: 3px solid #60A5FA !important;
    }
    .glyph-critical,
    .glyph-error,
    .glyph-warning,
    .glyph-info {
      margin-left: 3px;
    }
  `;
  document.head.appendChild(style);
}

function defineAirDarkTheme(monaco: Parameters<BeforeMount>[0]) {
  monaco.editor.defineTheme('air-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'F0F4FF', background: '1C2333' },
      { token: 'comment', foreground: '5E6F8A', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'A78BFA' },
      { token: 'string', foreground: '2DD4BF' },
      { token: 'number', foreground: 'F59E0B' },
      { token: 'type', foreground: '60A5FA' },
      { token: 'function', foreground: 'B3FC4F' },
      { token: 'variable', foreground: 'F0F4FF' },
      { token: 'operator', foreground: '5B33F0' },
    ],
    colors: {
      'editor.background': '#1C2333',
      'editor.foreground': '#F0F4FF',
      'editorLineNumber.foreground': '#5E6F8A',
      'editorLineNumber.activeForeground': '#F0F4FF',
      'editor.selectionBackground': '#232E45',
      'editor.inactiveSelectionBackground': '#232E4580',
      'editorCursor.foreground': '#5B33F0',
      'editor.lineHighlightBackground': '#232E4540',
      'editor.lineHighlightBorder': '#232E4500',
      'editorGutter.background': '#1C2333',
      'editorWidget.background': '#111827',
      'editorWidget.border': '#1F2D45',
      'input.background': '#1C2333',
      'input.border': '#1F2D45',
      'input.foreground': '#F0F4FF',
      'dropdown.background': '#111827',
      'dropdown.border': '#1F2D45',
      'list.hoverBackground': '#232E45',
      'list.activeSelectionBackground': '#232E45',
      'minimap.background': '#1C2333',
      'scrollbarSlider.background': '#2E3F5C80',
      'scrollbarSlider.hoverBackground': '#2E3F5CA0',
      'scrollbarSlider.activeBackground': '#2E3F5CC0',
      'editorOverviewRuler.border': '#1F2D45',
      'focusBorder': '#5B33F0',
    },
  });
}

export function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  highlights = [],
}: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);

  const applyHighlights = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const decorations: editor.IModelDeltaDecoration[] = highlights.map((h) => {
      const styles = SEVERITY_STYLES[h.severity];
      return {
        range: {
          startLineNumber: h.line,
          startColumn: 1,
          endLineNumber: h.line,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: styles.className,
          glyphMarginClassName: styles.glyphClassName,
          overviewRuler: {
            color:
              h.severity === 'critical'
                ? '#F87171'
                : h.severity === 'error'
                  ? '#F59E0B'
                  : h.severity === 'warning'
                    ? '#F59E0B'
                    : '#60A5FA',
            position: 1, // Right lane
          },
        },
      };
    });

    if (decorationsRef.current) {
      decorationsRef.current.clear();
    }
    decorationsRef.current = editor.createDecorationsCollection(decorations);
  }, [highlights]);

  useEffect(() => {
    applyHighlights();
  }, [applyHighlights]);

  const handleBeforeMount: BeforeMount = (monaco) => {
    defineAirDarkTheme(monaco);
  };

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    injectDecorationStyles();
    applyHighlights();
  };

  const handleChange = (val: string | undefined) => {
    onChange(val ?? '');
  };

  return (
    <div className="h-full w-full overflow-hidden rounded-lg border border-[#1F2D45]">
      <MonacoEditor
        value={value}
        onChange={handleChange}
        language={language}
        theme="air-dark"
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        options={{
          readOnly,
          lineNumbers: 'on',
          minimap: { enabled: true },
          wordWrap: 'on',
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
          fontLigatures: true,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          renderLineHighlight: 'line',
          scrollBeyondLastLine: false,
          padding: { top: 12, bottom: 12 },
          glyphMargin: highlights.length > 0,
          folding: true,
          bracketPairColorization: { enabled: true },
          automaticLayout: true,
          tabSize: 2,
          overviewRulerBorder: false,
          scrollbar: {
            verticalScrollbarSize: 6,
            horizontalScrollbarSize: 6,
          },
        }}
      />
    </div>
  );
}
