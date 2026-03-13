'use client'

interface TrendPoint {
  score: number
  date: string
}

export function QualityTrend({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) return null

  const width = 280
  const height = 80
  const padding = { top: 8, right: 8, bottom: 20, left: 30 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const minScore = Math.min(...points.map(p => p.score))
  const maxScore = Math.max(...points.map(p => p.score))
  const range = Math.max(maxScore - minScore, 10) // minimum range of 10

  const toX = (i: number) => padding.left + (i / (points.length - 1)) * chartW
  const toY = (score: number) => padding.top + chartH - ((score - minScore + 5) / (range + 10)) * chartH

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.score)}`)
    .join(' ')

  // Gradient fill area
  const areaD = `${pathD} L ${toX(points.length - 1)} ${padding.top + chartH} L ${toX(0)} ${padding.top + chartH} Z`

  const latest = points[points.length - 1]
  const previous = points[points.length - 2]
  const diff = latest.score - previous.score
  // Mediagenix AIR operational palette
  const trendColor = diff >= 0 ? '#2DD4BF' : '#F87171'
  const lineColor = diff >= 0 ? '#2DD4BF' : '#F59E0B'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{points.length} reviews</span>
        <span style={{ color: trendColor }} className="font-medium">
          {diff > 0 ? '+' : ''}{diff} pts
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" aria-label="Quality score trend">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].filter(v => v >= minScore - 5 && v <= maxScore + 5).map(v => (
          <g key={v}>
            <line
              x1={padding.left} y1={toY(v)}
              x2={width - padding.right} y2={toY(v)}
              stroke="currentColor" strokeOpacity={0.1} strokeDasharray="2,2"
            />
            <text x={padding.left - 4} y={toY(v) + 3} textAnchor="end" fontSize={8} fill="currentColor" opacity={0.4}>
              {v}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaD} fill={lineColor} fillOpacity={0.1} />

        {/* Line */}
        <path d={pathD} fill="none" stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {points.map((p, i) => (
          <circle key={i} cx={toX(i)} cy={toY(p.score)} r={3} fill={lineColor} stroke="#0B0F19" strokeWidth={1}>
            <title>{`${p.score}/100 — ${new Date(p.date).toLocaleDateString()}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  )
}
