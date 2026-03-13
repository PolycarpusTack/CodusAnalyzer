'use client'

export function ReviewSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Summary skeleton */}
      <div className="rounded-lg border p-6 space-y-4">
        <div className="flex justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-5 bg-muted rounded w-40" />
            <div className="h-4 bg-muted rounded w-3/4" />
          </div>
          <div className="h-8 bg-muted rounded w-20" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="text-center p-3 rounded-lg bg-muted/50">
              <div className="h-8 bg-muted rounded w-8 mx-auto mb-1" />
              <div className="h-3 bg-muted rounded w-12 mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Findings skeleton */}
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-muted rounded" />
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <div className="h-5 bg-muted rounded w-20" />
                <div className="h-5 bg-muted rounded w-16" />
              </div>
              <div className="h-4 bg-muted rounded w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function HistorySkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="p-4 rounded-lg border space-y-2">
          <div className="flex justify-between">
            <div className="h-4 bg-muted rounded w-32" />
            <div className="h-5 bg-muted rounded w-16" />
          </div>
          <div className="flex gap-4">
            <div className="h-3 bg-muted rounded w-16" />
            <div className="h-3 bg-muted rounded w-12" />
            <div className="h-3 bg-muted rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}
