'use client'

import { Badge } from '@/components/ui/badge'
import { FileCode } from 'lucide-react'
import type { Finding } from '@/components/finding-card'

export interface HistoryReview {
  id: string
  codeContent: string
  language: string
  fileName: string | null
  summary: string | null
  positiveAspects: string | null
  qualityScore: number | null
  totalLines: number | null
  passed: boolean
  criticalCount: number
  errorCount: number
  warningCount: number
  infoCount: number
  createdAt: string
  findings: Finding[]
}

export function HistoryItem({ review, onSelect }: { review: HistoryReview; onSelect: () => void }) {
  return (
    <div
      className="p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{review.fileName || 'untitled'}</span>
        </div>
        {review.passed ? (
          <Badge variant="outline" className="text-green-500 border-green-500/30">
            Passed
          </Badge>
        ) : (
          <Badge variant="outline" className="text-red-500 border-red-500/30">
            Failed
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="capitalize">{review.language}</span>
        <span>{review.totalLines} lines</span>
        <span>Score: {review.qualityScore}</span>
      </div>
      <div className="flex gap-2 mt-2">
        {review.criticalCount > 0 && (
          <Badge className="bg-red-500 text-xs">{review.criticalCount} critical</Badge>
        )}
        {review.errorCount > 0 && (
          <Badge className="bg-orange-500 text-xs">{review.errorCount} error</Badge>
        )}
        {review.warningCount > 0 && (
          <Badge className="bg-yellow-500 text-xs">{review.warningCount} warning</Badge>
        )}
      </div>
      <div className="text-xs text-muted-foreground mt-2">
        {new Date(review.createdAt).toLocaleString()}
      </div>
    </div>
  )
}
