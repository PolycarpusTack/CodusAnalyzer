'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

// Mediagenix AIR colors
const COBALT = '#3805E3'
const TEAL = '#2DD4BF'
const AMBER = '#F59E0B'
const RED = '#F87171'
const PURPLE = '#A78BFA'

const CATEGORY_COLORS: Record<string, string> = {
  security: RED,
  performance: AMBER,
  maintainability: PURPLE,
  style: COBALT,
  bug: RED,
  testing: TEAL,
}

const LANG_COLORS = [COBALT, TEAL, AMBER, PURPLE, RED, '#60A5FA', '#34D399', '#FB923C']

interface ReviewData {
  qualityScore: number | null
  passed: boolean
  criticalCount: number
  errorCount: number
  warningCount: number
  infoCount: number
  language: string
  createdAt: string
  fileName: string | null
}

interface TeamDashboardProps {
  reviews: ReviewData[]
}

export function TeamDashboard({ reviews }: TeamDashboardProps) {
  const stats = useMemo(() => {
    if (reviews.length === 0) {
      return null
    }

    // Average quality score
    const scored = reviews.filter((r) => r.qualityScore !== null)
    const avgScore =
      scored.length > 0
        ? scored.reduce((sum, r) => sum + (r.qualityScore ?? 0), 0) / scored.length
        : 0

    // Trend: compare last 5 vs previous 5
    const sorted = [...scored].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    const last5 = sorted.slice(0, 5)
    const prev5 = sorted.slice(5, 10)
    const last5Avg =
      last5.length > 0
        ? last5.reduce((s, r) => s + (r.qualityScore ?? 0), 0) / last5.length
        : 0
    const prev5Avg =
      prev5.length > 0
        ? prev5.reduce((s, r) => s + (r.qualityScore ?? 0), 0) / prev5.length
        : 0
    const trend = prev5.length > 0 ? last5Avg - prev5Avg : 0

    // Pass rate
    const passRate = (reviews.filter((r) => r.passed).length / reviews.length) * 100

    // Issue categories
    const categories = reviews.reduce(
      (acc, r) => {
        acc.critical += r.criticalCount
        acc.error += r.errorCount
        acc.warning += r.warningCount
        acc.info += r.infoCount
        return acc
      },
      { critical: 0, error: 0, warning: 0, info: 0 }
    )
    const maxCategory = Math.max(categories.critical, categories.error, categories.warning, categories.info, 1)

    // Language distribution
    const langCounts: Record<string, number> = {}
    for (const r of reviews) {
      langCounts[r.language] = (langCounts[r.language] || 0) + 1
    }
    const langEntries = Object.entries(langCounts).sort((a, b) => b[1] - a[1])
    const totalLangCount = reviews.length

    // Reviews per day (last 7 days)
    const now = new Date()
    const days: { label: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      const label = d.toLocaleDateString('en-US', { weekday: 'short' })
      const count = reviews.filter((r) => r.createdAt.startsWith(key)).length
      days.push({ label, count })
    }
    const maxDayCount = Math.max(...days.map((d) => d.count), 1)

    return {
      avgScore: Math.round(avgScore * 10) / 10,
      trend,
      passRate: Math.round(passRate * 10) / 10,
      categories,
      maxCategory,
      langEntries,
      totalLangCount,
      days,
      maxDayCount,
      totalReviews: reviews.length,
    }
  }, [reviews])

  if (!stats) {
    return (
      <Card className="border-[#1F2D45] bg-[#0B1221]">
        <CardContent className="p-8 text-center text-muted-foreground">
          No review data available yet. Run some code reviews to see team metrics.
        </CardContent>
      </Card>
    )
  }

  const scoreColor = stats.avgScore >= 80 ? TEAL : stats.avgScore >= 60 ? AMBER : RED
  const passColor = stats.passRate >= 80 ? TEAL : stats.passRate >= 60 ? AMBER : RED

  // SVG ring for pass rate
  const passCircumference = 2 * Math.PI * 40
  const passDashoffset = passCircumference - (stats.passRate / 100) * passCircumference

  return (
    <div className="space-y-6">
      {/* Top row: score + pass rate */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Average Quality Score */}
        <Card className="border-[#1F2D45] bg-[#0B1221]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Quality Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <span className="text-4xl font-bold" style={{ color: scoreColor }}>
                {stats.avgScore}
              </span>
              {stats.trend !== 0 && (
                <span
                  className="flex items-center text-sm font-medium"
                  style={{ color: stats.trend > 0 ? TEAL : RED }}
                >
                  {stats.trend > 0 ? '\u2191' : '\u2193'}
                  {Math.abs(Math.round(stats.trend * 10) / 10)}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on {stats.totalReviews} reviews
            </p>
          </CardContent>
        </Card>

        {/* Pass Rate Ring */}
        <Card className="border-[#1F2D45] bg-[#0B1221]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pass Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 96 96">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#1F2D45"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke={passColor}
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={passCircumference}
                  strokeDashoffset={passDashoffset}
                  className="transition-all duration-700"
                />
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center text-lg font-bold"
                style={{ color: passColor }}
              >
                {stats.passRate}%
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {reviews.filter((r) => r.passed).length} passed /{' '}
              {reviews.filter((r) => !r.passed).length} failed
            </div>
          </CardContent>
        </Card>

        {/* Total summary */}
        <Card className="border-[#1F2D45] bg-[#0B1221]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Findings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">
                Critical
              </Badge>
              <span className="font-mono font-bold text-red-400">{stats.categories.critical}</span>
            </div>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="border-orange-500/30 text-orange-400">
                Error
              </Badge>
              <span className="font-mono font-bold text-orange-400">{stats.categories.error}</span>
            </div>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="border-amber-500/30 text-amber-400">
                Warning
              </Badge>
              <span className="font-mono font-bold text-amber-400">{stats.categories.warning}</span>
            </div>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                Info
              </Badge>
              <span className="font-mono font-bold text-blue-400">{stats.categories.info}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Issue categories bar chart */}
      <Card className="border-[#1F2D45] bg-[#0B1221]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Most Common Issue Categories
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Critical', count: stats.categories.critical, color: RED },
            { label: 'Error', count: stats.categories.error, color: AMBER },
            { label: 'Warning', count: stats.categories.warning, color: PURPLE },
            { label: 'Info', count: stats.categories.info, color: COBALT },
          ].map(({ label, count, color }) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono" style={{ color }}>
                  {count}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#1F2D45] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(count / stats.maxCategory) * 100}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Bottom row: language distribution + reviews per day */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Language Distribution */}
        <Card className="border-[#1F2D45] bg-[#0B1221]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Language Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Horizontal stacked bar */}
            <div className="h-6 rounded-full overflow-hidden flex bg-[#1F2D45]">
              {stats.langEntries.map(([lang, count], i) => (
                <div
                  key={lang}
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${(count / stats.totalLangCount) * 100}%`,
                    backgroundColor: LANG_COLORS[i % LANG_COLORS.length],
                  }}
                  title={`${lang}: ${count}`}
                />
              ))}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-3">
              {stats.langEntries.map(([lang, count], i) => (
                <div key={lang} className="flex items-center gap-1.5 text-xs">
                  <div
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: LANG_COLORS[i % LANG_COLORS.length] }}
                  />
                  <span className="text-muted-foreground">
                    {lang}{' '}
                    <span className="font-mono">
                      ({Math.round((count / stats.totalLangCount) * 100)}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Reviews Per Day */}
        <Card className="border-[#1F2D45] bg-[#0B1221]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Reviews Per Day (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-2 h-32">
              {stats.days.map((day) => (
                <div key={day.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-mono" style={{ color: TEAL }}>
                    {day.count > 0 ? day.count : ''}
                  </span>
                  <div className="w-full flex flex-col justify-end" style={{ height: '80px' }}>
                    <div
                      className="w-full rounded-t transition-all duration-500"
                      style={{
                        height: `${day.count > 0 ? (day.count / stats.maxDayCount) * 100 : 4}%`,
                        backgroundColor: day.count > 0 ? COBALT : '#1F2D45',
                        minHeight: day.count > 0 ? '4px' : '2px',
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{day.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Recurring Rule Violations */}
      <Card className="border-[#1F2D45] bg-[#0B1221]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Top Recurring Rule Violations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TopViolations reviews={reviews} />
        </CardContent>
      </Card>
    </div>
  )
}

/** Separate sub-component to keep main render clean */
function TopViolations({ reviews }: { reviews: ReviewData[] }) {
  // We only have aggregate severity counts on the review level here,
  // so we show the severity breakdown as a proxy. In a full implementation
  // the caller would pass findings data; for now this shows aggregate severity info.
  const violationCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of reviews) {
      if (r.criticalCount > 0) counts['Critical issues'] = (counts['Critical issues'] || 0) + r.criticalCount
      if (r.errorCount > 0) counts['Error issues'] = (counts['Error issues'] || 0) + r.errorCount
      if (r.warningCount > 0) counts['Warning issues'] = (counts['Warning issues'] || 0) + r.warningCount
      if (r.infoCount > 0) counts['Info issues'] = (counts['Info issues'] || 0) + r.infoCount
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  }, [reviews])

  const max = violationCounts.length > 0 ? violationCounts[0][1] : 1

  if (violationCounts.length === 0) {
    return <p className="text-sm text-muted-foreground">No violations recorded yet.</p>
  }

  return (
    <div className="space-y-2">
      {violationCounts.map(([message, count]) => {
        const color = message.startsWith('Critical')
          ? RED
          : message.startsWith('Error')
            ? AMBER
            : message.startsWith('Warning')
              ? PURPLE
              : COBALT
        return (
          <div key={message} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground truncate mr-2">{message}</span>
              <span className="font-mono flex-shrink-0" style={{ color }}>
                {count}
              </span>
            </div>
            <Progress
              value={(count / max) * 100}
              className="h-1.5"
              style={{ '--progress-color': color } as React.CSSProperties}
            />
          </div>
        )
      })}
    </div>
  )
}
