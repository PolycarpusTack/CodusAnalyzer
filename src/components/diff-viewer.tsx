'use client'

import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'

interface DiffLine {
  type: 'unchanged' | 'removed' | 'added'
  content: string
  leftLineNo: number | null
  rightLineNo: number | null
}

function computeDiff(original: string, modified: string): DiffLine[] {
  const originalLines = original.split('\n')
  const modifiedLines = modified.split('\n')
  const lines: DiffLine[] = []

  let leftNo = 1
  let rightNo = 1
  let i = 0
  let j = 0

  while (i < originalLines.length || j < modifiedLines.length) {
    if (i < originalLines.length && j < modifiedLines.length) {
      if (originalLines[i] === modifiedLines[j]) {
        lines.push({
          type: 'unchanged',
          content: originalLines[i],
          leftLineNo: leftNo++,
          rightLineNo: rightNo++,
        })
        i++
        j++
      } else {
        // Look ahead to find the next matching line
        let foundInModified = -1
        let foundInOriginal = -1

        for (let k = j; k < Math.min(j + 10, modifiedLines.length); k++) {
          if (originalLines[i] === modifiedLines[k]) {
            foundInModified = k
            break
          }
        }

        for (let k = i; k < Math.min(i + 10, originalLines.length); k++) {
          if (originalLines[k] === modifiedLines[j]) {
            foundInOriginal = k
            break
          }
        }

        if (foundInOriginal !== -1 && (foundInModified === -1 || foundInOriginal - i <= foundInModified - j)) {
          // Lines were removed from original
          while (i < foundInOriginal) {
            lines.push({
              type: 'removed',
              content: originalLines[i],
              leftLineNo: leftNo++,
              rightLineNo: null,
            })
            i++
          }
        } else if (foundInModified !== -1) {
          // Lines were added in modified
          while (j < foundInModified) {
            lines.push({
              type: 'added',
              content: modifiedLines[j],
              leftLineNo: null,
              rightLineNo: rightNo++,
            })
            j++
          }
        } else {
          // Replace: show removed then added
          lines.push({
            type: 'removed',
            content: originalLines[i],
            leftLineNo: leftNo++,
            rightLineNo: null,
          })
          lines.push({
            type: 'added',
            content: modifiedLines[j],
            leftLineNo: null,
            rightLineNo: rightNo++,
          })
          i++
          j++
        }
      }
    } else if (i < originalLines.length) {
      lines.push({
        type: 'removed',
        content: originalLines[i],
        leftLineNo: leftNo++,
        rightLineNo: null,
      })
      i++
    } else {
      lines.push({
        type: 'added',
        content: modifiedLines[j],
        leftLineNo: null,
        rightLineNo: rightNo++,
      })
      j++
    }
  }

  return lines
}

interface DiffViewerProps {
  original: string
  modified: string
  onAccept: () => void
  onReject: () => void
}

export function DiffViewer({ original, modified, onAccept, onReject }: DiffViewerProps) {
  const diffLines = computeDiff(original, modified)

  const leftLines = diffLines.filter((l) => l.type === 'unchanged' || l.type === 'removed')
  const rightLines = diffLines.filter((l) => l.type === 'unchanged' || l.type === 'added')

  return (
    <div className="rounded-lg border border-white/10 overflow-hidden" style={{ backgroundColor: '#1C2333' }}>
      <div className="flex border-b border-white/10">
        <div className="flex-1 px-4 py-2 text-sm font-medium text-red-400 border-r border-white/10">
          Original
        </div>
        <div className="flex-1 px-4 py-2 text-sm font-medium text-teal-400">
          Modified
        </div>
      </div>

      <div className="flex max-h-[500px] overflow-auto">
        {/* Left panel — original */}
        <div className="flex-1 border-r border-white/10 overflow-x-auto">
          {leftLines.map((line, idx) => (
            <div
              key={`left-${idx}`}
              className="flex"
              style={{
                backgroundColor: line.type === 'removed' ? '#1A0505' : 'transparent',
                borderLeft: line.type === 'removed' ? '3px solid #F87171' : '3px solid transparent',
              }}
            >
              <span
                className="select-none text-right px-2 py-0.5 text-xs text-white/30 shrink-0"
                style={{ fontFamily: "'JetBrains Mono', monospace", minWidth: '3rem' }}
              >
                {line.leftLineNo ?? ''}
              </span>
              <pre
                className="py-0.5 px-2 text-sm text-white/80 whitespace-pre"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {line.content}
              </pre>
            </div>
          ))}
        </div>

        {/* Right panel — modified */}
        <div className="flex-1 overflow-x-auto">
          {rightLines.map((line, idx) => (
            <div
              key={`right-${idx}`}
              className="flex"
              style={{
                backgroundColor: line.type === 'added' ? '#051412' : 'transparent',
                borderLeft: line.type === 'added' ? '3px solid #2DD4BF' : '3px solid transparent',
              }}
            >
              <span
                className="select-none text-right px-2 py-0.5 text-xs text-white/30 shrink-0"
                style={{ fontFamily: "'JetBrains Mono', monospace", minWidth: '3rem' }}
              >
                {line.rightLineNo ?? ''}
              </span>
              <pre
                className="py-0.5 px-2 text-sm text-white/80 whitespace-pre"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {line.content}
              </pre>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onReject}
          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
        >
          <X className="mr-1.5 h-4 w-4" />
          Reject
        </Button>
        <Button
          size="sm"
          onClick={onAccept}
          className="bg-teal-600 text-white hover:bg-teal-700"
        >
          <Check className="mr-1.5 h-4 w-4" />
          Accept
        </Button>
      </div>
    </div>
  )
}
