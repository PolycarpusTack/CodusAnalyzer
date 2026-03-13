// ---------------------------------------------------------------------------
// Unified diff parser — extract commentable lines and map positions
// ---------------------------------------------------------------------------

export interface DiffFile {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  patch?: string;
  /** Maps original file line numbers to diff positions (for PR review comments). */
  lineToPosition: Map<number, number>;
  /** Lines that were added or modified (commentable). */
  commentableLines: Set<number>;
}

/**
 * Parse a unified diff patch and extract line-to-position mapping.
 * GitHub requires a "position" (1-based offset within the diff hunk)
 * to post review comments on specific lines.
 */
export function parsePatch(patch: string): {
  lineToPosition: Map<number, number>;
  commentableLines: Set<number>;
} {
  const lineToPosition = new Map<number, number>();
  const commentableLines = new Set<number>();

  if (!patch) return { lineToPosition, commentableLines };

  const lines = patch.split('\n');
  let position = 0;
  let currentLine = 0;

  for (const line of lines) {
    position++;

    // Hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    const hunkMatch = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
    if (hunkMatch) {
      currentLine = parseInt(hunkMatch[1], 10) - 1;
      continue;
    }

    if (line.startsWith('+')) {
      // Added line
      currentLine++;
      lineToPosition.set(currentLine, position);
      commentableLines.add(currentLine);
    } else if (line.startsWith('-')) {
      // Removed line — don't advance currentLine
      // Still has a position in the diff
    } else {
      // Context line
      currentLine++;
      lineToPosition.set(currentLine, position);
    }
  }

  return { lineToPosition, commentableLines };
}

/**
 * Parse a list of PR files into DiffFile objects.
 */
export function parsePRFiles(
  files: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
  }>
): DiffFile[] {
  return files.map(file => {
    const { lineToPosition, commentableLines } = file.patch
      ? parsePatch(file.patch)
      : { lineToPosition: new Map<number, number>(), commentableLines: new Set<number>() };

    return {
      filename: file.filename,
      status: file.status as DiffFile['status'],
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch,
      lineToPosition,
      commentableLines,
    };
  });
}

/**
 * Map a finding's line number to a diff position.
 * Returns null if the line is not commentable in the diff.
 */
export function findingToDiffPosition(
  lineStart: number,
  diffFile: DiffFile,
): number | null {
  // Exact match
  const position = diffFile.lineToPosition.get(lineStart);
  if (position !== undefined && diffFile.commentableLines.has(lineStart)) {
    return position;
  }

  // Try nearby lines (within 2 lines)
  for (let offset = 1; offset <= 2; offset++) {
    for (const delta of [offset, -offset]) {
      const nearbyLine = lineStart + delta;
      const nearbyPos = diffFile.lineToPosition.get(nearbyLine);
      if (nearbyPos !== undefined && diffFile.commentableLines.has(nearbyLine)) {
        return nearbyPos;
      }
    }
  }

  return null;
}
