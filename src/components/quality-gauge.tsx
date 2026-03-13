'use client'

export function QualityGauge({ score }: { score: number }) {
  // Mediagenix AIR operational palette
  const getColor = (s: number) => {
    if (s >= 80) return '#2DD4BF' // teal
    if (s >= 60) return '#F59E0B' // amber
    if (s >= 40) return '#F59E0B' // amber
    return '#F87171'              // red
  }

  const getLabel = (s: number) => {
    if (s >= 80) return 'Excellent'
    if (s >= 60) return 'Good'
    if (s >= 40) return 'Needs Work'
    return 'Poor'
  }

  const color = getColor(score)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="#1F2D45"
            strokeWidth="12"
            fill="none"
          />
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke={color}
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${score * 3.52} 352`}
            style={{ filter: `drop-shadow(0 0 6px ${color}50)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold font-mono" style={{ color }}>{score}</span>
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{getLabel(score)}</span>
        </div>
      </div>
    </div>
  )
}
