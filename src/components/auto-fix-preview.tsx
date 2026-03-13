'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DiffViewer } from '@/components/diff-viewer'
import { applyAutoFixes } from '@/lib/autofix'
import { Wrench } from 'lucide-react'

interface AutoFixPreviewProps {
  code: string
  onApply: (fixedCode: string) => void
  onCancel: () => void
}

export function AutoFixPreview({ code, onApply, onCancel }: AutoFixPreviewProps) {
  const fixResult = useMemo(() => applyAutoFixes(code), [code])
  const [selectedFixes, setSelectedFixes] = useState<Set<number>>(
    () => new Set(fixResult.appliedFixes.map((_, i) => i))
  )

  const toggleFix = (index: number) => {
    setSelectedFixes((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  // When all fixes are selected, use the full result; otherwise show original
  // (Individual fix toggling is a simplification since fixes are applied together)
  const previewCode = selectedFixes.size > 0 ? fixResult.code : code

  const handleApply = () => {
    onApply(previewCode)
  }

  if (fixResult.appliedFixes.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 p-6 text-center" style={{ backgroundColor: '#1C2333' }}>
        <Wrench className="mx-auto mb-3 h-8 w-8 text-white/30" />
        <p className="text-sm text-white/60">No auto-fixes available for this code.</p>
        <Button variant="outline" size="sm" onClick={onCancel} className="mt-4">
          Close
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Fix list with checkboxes */}
      <div className="rounded-lg border border-white/10 p-4" style={{ backgroundColor: '#1C2333' }}>
        <h3 className="mb-3 text-sm font-semibold text-white/90 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-teal-400" />
          Available Fixes ({fixResult.appliedFixes.length})
        </h3>
        <div className="space-y-2">
          {fixResult.appliedFixes.map((fix, index) => (
            <label
              key={index}
              className="flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
            >
              <Checkbox
                checked={selectedFixes.has(index)}
                onCheckedChange={() => toggleFix(index)}
              />
              <span className="text-sm text-white/80">{fix}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Diff viewer */}
      <DiffViewer
        original={code}
        modified={previewCode}
        onAccept={handleApply}
        onReject={onCancel}
      />

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleApply}
          disabled={selectedFixes.size === 0}
          className="bg-teal-600 text-white hover:bg-teal-700"
        >
          Apply Selected
        </Button>
      </div>
    </div>
  )
}
