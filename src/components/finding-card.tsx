'use client'

import { Badge } from '@/components/ui/badge'
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Code,
  ExternalLink,
  FileCode,
  Info,
  Lightbulb,
  Shield,
  XCircle,
  Zap,
  CheckCircle2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export interface Finding {
  ruleId: string
  severity: 'critical' | 'error' | 'warning' | 'info'
  category: string
  message: string
  lineStart: number
  lineEnd: number
  codeSnippet?: string
  suggestion?: string
  explanation?: string
  documentation?: string
  autoFixable: boolean
}

export const severityConfig = {
  critical: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  error: { icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  warning: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' }
}

export const categoryIcons: Record<string, typeof Shield> = {
  security: Shield,
  performance: Zap,
  maintainability: Code,
  style: FileCode,
  bug: AlertCircle,
  testing: CheckCircle2
}

export function FindingCard({ finding, isExpanded, onToggle }: {
  finding: Finding
  isExpanded: boolean
  onToggle: () => void
}) {
  const config = severityConfig[finding.severity]
  const Icon = config.icon
  const CategoryIcon = categoryIcons[finding.category] || Code

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`rounded-lg border ${config.border} ${config.bg} overflow-hidden`}
    >
      <div
        className="p-4 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
      >
        <div className="flex items-start gap-3">
          <div className={`p-1 rounded ${config.bg}`}>
            <Icon className={`h-5 w-5 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="capitalize">
                <CategoryIcon className="h-3 w-3 mr-1" />
                {finding.category}
              </Badge>
              <Badge className={`capitalize ${
                finding.severity === 'critical' ? 'bg-red-500' :
                finding.severity === 'error' ? 'bg-orange-500' :
                finding.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
              }`}>
                {finding.severity}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Line {finding.lineStart}{finding.lineEnd !== finding.lineStart && `-${finding.lineEnd}`}
              </span>
            </div>
            <p className="mt-2 text-sm font-medium">{finding.message}</p>
          </div>
          <div className="flex items-center gap-2">
            {finding.autoFixable && (
              <Badge variant="outline" className="text-green-500 border-green-500/30">
                Auto-fixable
              </Badge>
            )}
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t"
          >
            <div className="p-4 space-y-4 bg-background/50">
              {finding.explanation && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <BookOpen className="h-4 w-4" />
                    Explanation
                  </div>
                  <p className="text-sm text-muted-foreground pl-6">
                    {finding.explanation}
                  </p>
                </div>
              )}

              {finding.codeSnippet && finding.suggestion ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Code className="h-4 w-4" />
                    Diff View
                  </div>
                  <div className="rounded-md border overflow-hidden text-xs font-mono">
                    <div className="bg-red-500/10 border-l-4 border-red-500 px-3 py-2">
                      <span className="select-none text-red-400 mr-2">-</span>
                      <code className="text-red-600 dark:text-red-400 whitespace-pre-wrap">{finding.codeSnippet.trim()}</code>
                    </div>
                    <div className="bg-green-500/10 border-l-4 border-green-500 px-3 py-2">
                      <span className="select-none text-green-400 mr-2">+</span>
                      <code className="text-green-600 dark:text-green-400 whitespace-pre-wrap">{finding.suggestion}</code>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {finding.suggestion && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                        <Lightbulb className="h-4 w-4" />
                        Suggestion
                      </div>
                      <p className="text-sm text-muted-foreground pl-6">
                        {finding.suggestion}
                      </p>
                    </div>
                  )}

                  {finding.codeSnippet && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Code Context</div>
                      <pre className="p-3 rounded-md bg-muted text-xs overflow-x-auto">
                        <code>{finding.codeSnippet}</code>
                      </pre>
                    </div>
                  )}
                </>
              )}

              {finding.documentation && (
                <a
                  href={finding.documentation}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Learn more
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
