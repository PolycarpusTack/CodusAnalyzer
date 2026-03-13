'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  Eye,
  ListTodo,
} from 'lucide-react'

interface QueuedJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  language: string
  fileName: string
  preset: string
  createdAt: string
  completedAt: string | null
  result: any
  error: string | null
  progress: string
}

interface JobQueueProps {
  onViewResult: (result: any) => void
}

const STATUS_CONFIG = {
  pending: {
    color: '#60A5FA',
    label: 'Pending',
    icon: Clock,
    bgClass: 'bg-blue-400/10',
    textClass: 'text-blue-400',
    borderClass: 'border-blue-400/30',
  },
  processing: {
    color: '#F59E0B',
    label: 'Processing',
    icon: Loader2,
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-500',
    borderClass: 'border-amber-500/30',
  },
  completed: {
    color: '#2DD4BF',
    label: 'Completed',
    icon: CheckCircle2,
    bgClass: 'bg-teal-400/10',
    textClass: 'text-teal-400',
    borderClass: 'border-teal-400/30',
  },
  failed: {
    color: '#F87171',
    label: 'Failed',
    icon: XCircle,
    bgClass: 'bg-red-400/10',
    textClass: 'text-red-400',
    borderClass: 'border-red-400/30',
  },
} as const

export function JobQueue({ onViewResult }: JobQueueProps) {
  const [jobs, setJobs] = useState<QueuedJob[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/review/queue')
      if (res.ok) {
        const data = await res.json()
        setJobs(data.jobs || [])
      }
    } catch {
      // Silently fail — will retry on next poll
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // Auto-poll every 3 seconds when there are active jobs
  useEffect(() => {
    const hasActiveJobs = jobs.some(
      (j) => j.status === 'pending' || j.status === 'processing'
    )
    if (!hasActiveJobs) return

    const interval = setInterval(fetchJobs, 3000)
    return () => clearInterval(interval)
  }, [jobs, fetchJobs])

  const handleDelete = async (jobId: string) => {
    try {
      const res = await fetch(`/api/review/queue/${jobId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j.id !== jobId))
      }
    } catch {
      // Ignore
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (isLoading) {
    return (
      <Card className="border-[#2A2A3E] bg-[#1A1A2E]">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (jobs.length === 0) {
    return (
      <Card className="border-[#2A2A3E] bg-[#1A1A2E]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <ListTodo className="h-4 w-4" />
            Background Jobs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No background review jobs. Submit code for async review to see jobs
            here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-[#2A2A3E] bg-[#1A1A2E]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-medium text-slate-300">
          <span className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            Background Jobs
          </span>
          <Badge variant="outline" className="border-[#2A2A3E] text-xs">
            {jobs.length} job{jobs.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="space-y-2 px-6 pb-6">
            {jobs.map((job) => {
              const config = STATUS_CONFIG[job.status]
              const StatusIcon = config.icon

              return (
                <div
                  key={job.id}
                  className={`rounded-lg border p-3 transition-colors ${config.borderClass} ${config.bgClass}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <StatusIcon
                          className={`h-4 w-4 flex-shrink-0 ${config.textClass} ${
                            job.status === 'processing' ? 'animate-spin' : ''
                          }`}
                          style={
                            job.status === 'processing'
                              ? {
                                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite, spin 1s linear infinite',
                                }
                              : undefined
                          }
                        />
                        <span className="truncate text-sm font-medium text-slate-200">
                          {job.fileName}
                        </span>
                        <Badge
                          variant="outline"
                          className="flex-shrink-0 text-xs"
                          style={{
                            borderColor: config.color,
                            color: config.color,
                          }}
                        >
                          {config.label}
                        </Badge>
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{job.language}</span>
                        <span>·</span>
                        <span>{job.preset}</span>
                        <span>·</span>
                        <span>{formatTime(job.createdAt)}</span>
                      </div>

                      <p className={`mt-1 text-xs ${config.textClass}`}>
                        {job.progress}
                      </p>

                      {job.status === 'completed' && job.result?.qualityScore != null && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">
                            Quality Score:
                          </span>
                          <span
                            className="text-xs font-semibold"
                            style={{
                              color:
                                job.result.qualityScore >= 80
                                  ? '#2DD4BF'
                                  : job.result.qualityScore >= 60
                                    ? '#F59E0B'
                                    : '#F87171',
                            }}
                          >
                            {job.result.qualityScore}/100
                          </span>
                        </div>
                      )}

                      {job.status === 'failed' && job.error && (
                        <p className="mt-1 text-xs text-red-400/80">
                          {job.error}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-1">
                      {job.status === 'completed' && job.result && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-teal-400 hover:bg-teal-400/10 hover:text-teal-300"
                          onClick={() => onViewResult(job.result)}
                          title="View results"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:bg-red-400/10 hover:text-red-400"
                        onClick={() => handleDelete(job.id)}
                        title="Delete job"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
