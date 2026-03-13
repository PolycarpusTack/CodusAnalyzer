'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import type { HistoryReview } from '@/components/history-item'
import type { Finding } from '@/components/finding-card'

function formatReviewLabel(review: HistoryReview): string {
  const name = review.fileName || 'untitled'
  const date = new Date(review.createdAt).toLocaleString()
  return `${name} — ${date}`
}

function findingKey(f: Finding): string {
  return `${f.ruleId}::${f.severity}::${f.lineStart}-${f.lineEnd}::${f.message}`
}

interface FindingDiff {
  finding: Finding
  status: 'resolved' | 'new' | 'unchanged'
}

function diffFindings(oldFindings: Finding[], newFindings: Finding[]): FindingDiff[] {
  const oldKeys = new Set(oldFindings.map(findingKey))
  const newKeys = new Set(newFindings.map(findingKey))

  const results: FindingDiff[] = []

  for (const f of oldFindings) {
    const key = findingKey(f)
    if (!newKeys.has(key)) {
      results.push({ finding: f, status: 'resolved' })
    } else {
      results.push({ finding: f, status: 'unchanged' })
    }
  }

  for (const f of newFindings) {
    const key = findingKey(f)
    if (!oldKeys.has(key)) {
      results.push({ finding: f, status: 'new' })
    }
  }

  return results
}

const STATUS_COLORS: Record<FindingDiff['status'], { bg: string; text: string; border: string }> = {
  resolved: { bg: 'bg-[#2DD4BF]/10', text: 'text-[#2DD4BF]', border: 'border-[#2DD4BF]/30' },
  new: { bg: 'bg-[#F87171]/10', text: 'text-[#F87171]', border: 'border-[#F87171]/30' },
  unchanged: { bg: 'bg-[#5E6F8A]/10', text: 'text-[#5E6F8A]', border: 'border-[#5E6F8A]/30' },
}

const STATUS_LABELS: Record<FindingDiff['status'], string> = {
  resolved: 'Resolved',
  new: 'New',
  unchanged: 'Unchanged',
}

function ScoreTrend({ oldScore, newScore }: { oldScore: number | null; newScore: number | null }) {
  if (oldScore === null || newScore === null) {
    return <span className="text-sm text-[#5E6F8A]">N/A</span>
  }

  const delta = newScore - oldScore

  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[#2DD4BF] font-semibold">
        <ArrowUp className="h-4 w-4" />
        +{delta}
      </span>
    )
  }

  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[#F87171] font-semibold">
        <ArrowDown className="h-4 w-4" />
        {delta}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 text-[#5E6F8A] font-semibold">
      <Minus className="h-4 w-4" />
      0
    </span>
  )
}

export function ReviewComparison({ reviews }: { reviews: HistoryReview[] }) {
  const [leftId, setLeftId] = useState<string>('')
  const [rightId, setRightId] = useState<string>('')

  const leftReview = useMemo(() => reviews.find((r) => r.id === leftId) ?? null, [reviews, leftId])
  const rightReview = useMemo(() => reviews.find((r) => r.id === rightId) ?? null, [reviews, rightId])

  const diff = useMemo(() => {
    if (!leftReview || !rightReview) return null
    return diffFindings(leftReview.findings, rightReview.findings)
  }, [leftReview, rightReview])

  const counts = useMemo(() => {
    if (!diff) return { resolved: 0, new: 0, unchanged: 0 }
    return {
      resolved: diff.filter((d) => d.status === 'resolved').length,
      new: diff.filter((d) => d.status === 'new').length,
      unchanged: diff.filter((d) => d.status === 'unchanged').length,
    }
  }, [diff])

  const totalDelta = useMemo(() => {
    if (!leftReview || !rightReview) return null
    const leftTotal = leftReview.criticalCount + leftReview.errorCount + leftReview.warningCount + leftReview.infoCount
    const rightTotal = rightReview.criticalCount + rightReview.errorCount + rightReview.warningCount + rightReview.infoCount
    return rightTotal - leftTotal
  }, [leftReview, rightReview])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Review Comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Baseline (older)</label>
            <Select value={leftId} onValueChange={setLeftId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a review..." />
              </SelectTrigger>
              <SelectContent>
                {reviews.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {formatReviewLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Current (newer)</label>
            <Select value={rightId} onValueChange={setRightId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a review..." />
              </SelectTrigger>
              <SelectContent>
                {reviews.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {formatReviewLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Side-by-side summary */}
        {leftReview && rightReview && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Quality score */}
              <Card className="border border-border">
                <CardContent className="pt-4 pb-4 text-center space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Quality Score</p>
                  <div className="flex items-center justify-center gap-4">
                    <span className="text-2xl font-bold">{leftReview.qualityScore ?? '—'}</span>
                    <ScoreTrend oldScore={leftReview.qualityScore} newScore={rightReview.qualityScore} />
                    <span className="text-2xl font-bold">{rightReview.qualityScore ?? '—'}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Total findings delta */}
              <Card className="border border-border">
                <CardContent className="pt-4 pb-4 text-center space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Findings</p>
                  <div className="flex items-center justify-center gap-4">
                    <span className="text-2xl font-bold">
                      {leftReview.criticalCount + leftReview.errorCount + leftReview.warningCount + leftReview.infoCount}
                    </span>
                    <span
                      className={`font-semibold ${
                        totalDelta !== null && totalDelta < 0
                          ? 'text-[#2DD4BF]'
                          : totalDelta !== null && totalDelta > 0
                            ? 'text-[#F87171]'
                            : 'text-[#5E6F8A]'
                      }`}
                    >
                      {totalDelta !== null && totalDelta > 0 ? `+${totalDelta}` : totalDelta ?? '—'}
                    </span>
                    <span className="text-2xl font-bold">
                      {rightReview.criticalCount + rightReview.errorCount + rightReview.warningCount + rightReview.infoCount}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Resolved / New counts */}
              <Card className="border border-border">
                <CardContent className="pt-4 pb-4 text-center space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Changes</p>
                  <div className="flex items-center justify-center gap-3">
                    <Badge className="bg-[#2DD4BF]/15 text-[#2DD4BF] border border-[#2DD4BF]/30">
                      {counts.resolved} resolved
                    </Badge>
                    <Badge className="bg-[#F87171]/15 text-[#F87171] border border-[#F87171]/30">
                      {counts.new} new
                    </Badge>
                    <Badge className="bg-[#5E6F8A]/15 text-[#5E6F8A] border border-[#5E6F8A]/30">
                      {counts.unchanged} unchanged
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Findings diff list */}
            {diff && diff.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Findings Diff</h3>
                <div className="space-y-2">
                  {diff.map((item, idx) => {
                    const colors = STATUS_COLORS[item.status]
                    return (
                      <div
                        key={idx}
                        className={`flex items-start gap-3 rounded-lg border p-3 ${colors.bg} ${colors.border}`}
                      >
                        <Badge
                          variant="outline"
                          className={`shrink-0 ${colors.text} border-current text-xs`}
                        >
                          {STATUS_LABELS[item.status]}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{item.finding.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.finding.category} &middot; {item.finding.severity} &middot; Line{' '}
                            {item.finding.lineStart}
                            {item.finding.lineEnd !== item.finding.lineStart &&
                              `–${item.finding.lineEnd}`}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {diff && diff.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No findings in either review to compare.
              </p>
            )}
          </>
        )}

        {(!leftId || !rightId) && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Select two reviews above to compare them side by side.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
