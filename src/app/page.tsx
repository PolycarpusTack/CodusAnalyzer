'use client'

import { useState, useCallback, useRef, useEffect, type DragEvent, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertCircle,
  CheckCircle2,
  Code,
  History,
  Play,
  Shield,
  Zap,
  Lightbulb,
  BookOpen,
  XCircle,
  Loader2,
  Trash2,
  RefreshCw,
  Upload,
  Copy,
  Download,
  Wrench,
  Target,
  Settings,
  FileCode,
  Github,
  Share2,
  GitPullRequest,
  Pencil,
  BarChart3,
  LayoutDashboard,
  ListTodo,
  Bell,
  FolderCog,
  Search,
} from 'lucide-react'
import { FindingCard, severityConfig, categoryIcons } from '@/components/finding-card'
import type { Finding } from '@/components/finding-card'
import { QualityGauge } from '@/components/quality-gauge'
import { HistoryItem } from '@/components/history-item'
import type { HistoryReview } from '@/components/history-item'
import { QualityTrend } from '@/components/quality-trend'
import { ReviewComments } from '@/components/review-comments'
import { detectLanguage } from '@/lib/language'
import { exportAsMarkdown, exportAsJSON, exportAsCSV, downloadFile } from '@/lib/export'
import { applyAutoFixes } from '@/lib/autofix'
import { isGitHubUrl } from '@/lib/github'
import { ThemeToggle } from '@/components/theme-toggle'
import { ReviewSkeleton, HistorySkeleton } from '@/components/loading-skeleton'
import { loadRuleConfig, saveRuleConfig, type RuleConfig } from '@/lib/rule-config'
import { CodeEditor } from '@/components/code-editor'
import { FindingResolution } from '@/components/finding-resolution'
import { ReviewComparison } from '@/components/review-comparison'
import { RuleEditor } from '@/components/rule-editor'
import { PromptEditor } from '@/components/prompt-editor'
import { loadCustomRules, runCustomRules } from '@/lib/custom-rules'
import { parseSSE } from '@/lib/streaming'
import { loadCustomPrompt } from '@/lib/prompt-config'
import { SyntaxReport } from '@/components/syntax-report'
import { analyzeSyntax, type SyntaxAnalysisResult } from '@/lib/syntax-analysis'
import { DiffViewer } from '@/components/diff-viewer'
import { AutoFixPreview } from '@/components/auto-fix-preview'
import { SeverityCalibrator } from '@/components/severity-calibrator'
import { TeamDashboard } from '@/components/team-dashboard'
import { ProjectProfileSelector } from '@/components/project-profile-selector'
import { NotificationSettings } from '@/components/notification-settings'
import { JobQueue } from '@/components/job-queue'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts'
import { GuidedTour } from '@/components/guided-tour'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { sendWebhookNotification } from '@/lib/webhook-notify'

interface ReviewResult {
  reviewId?: string
  summary: string
  positiveAspects: string[]
  qualityScore: number
  totalLines: number
  passed: boolean
  counts: {
    critical: number
    error: number
    warning: number
    info: number
  }
  findings: Finding[]
  testingSuggestions: string[]
}

const REVIEW_PRESETS = [
  { id: 'full', label: 'Full Review', desc: 'Comprehensive analysis of all aspects', icon: Target },
  { id: 'security', label: 'Security Audit', desc: 'Focus on vulnerabilities and exploits', icon: Shield },
  { id: 'performance', label: 'Performance', desc: 'Focus on speed and efficiency', icon: Zap },
  { id: 'maintainability', label: 'Maintainability', desc: 'Focus on readability and structure', icon: Code },
] as const

type PresetId = typeof REVIEW_PRESETS[number]['id']

const SAMPLE_CODE = `// Example code with various issues for review
const apiKey = "sk-1234567890abcdef"; // Hardcoded secret!

async function fetchUserData(userId) {
  const query = "SELECT * FROM users WHERE id = " + userId; // SQL injection!

  const result = db.execute(query);
  return result;
}

function processItems(items) {
  for (let i = 0; i < items.length; i++) {
    const data = await fetchData(items[i].id); // N+1 query pattern
    console.log(data); // Console log in production
  }
}

var oldStyleVariable = "use let or const"; // var usage

function veryLongFunction() {
  // ... imagine 100+ lines here
  // This is a maintainability issue
}

// TODO: Fix this later - untracked TODO
try {
  doSomething();
} catch (e) {
  // Empty catch block!
}

eval(userInput); // Dangerous eval!`

export default function CodeReviewAgent() {
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('javascript')
  const [fileName, setFileName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState('editor')
  const [history, setHistory] = useState<HistoryReview[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [preset, setPreset] = useState<PresetId>('full')
  const [fixApplied, setFixApplied] = useState(false)
  const [ruleConfig, setRuleConfig] = useState<RuleConfig>({ security: true, performance: true, maintainability: true, style: true })
  const [showSettings, setShowSettings] = useState(false)
  const [githubUrl, setGithubUrl] = useState('')
  const [isLoadingGithub, setIsLoadingGithub] = useState(false)
  const [streamStatus, setStreamStatus] = useState<string | null>(null)
  const [useMonaco, setUseMonaco] = useState(true)
  const [syntaxResult, setSyntaxResult] = useState<SyntaxAnalysisResult | null>(null)
  const [showAutoFixPreview, setShowAutoFixPreview] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [findingSearch, setFindingSearch] = useState('')
  const [findingSeverityFilter, setFindingSeverityFilter] = useState<string>('all')
  const [findingCategoryFilter, setFindingCategoryFilter] = useState<string>('all')
  const [historyPage, setHistoryPage] = useState(1)
  const [historySearch, setHistorySearch] = useState('')
  const [historyTotal, setHistoryTotal] = useState(0)
  const [resolvedFindings, setResolvedFindings] = useState<Record<string, string>>({})
  const HISTORY_PAGE_SIZE = 20

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && code.trim() && !isLoading) {
        e.preventDefault()
        handleReview()
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C' && result) {
        e.preventDefault()
        handleCopyMarkdown()
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E' && result) {
        e.preventDefault()
        handleDownloadReport()
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        handleLoadSample()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  useEffect(() => {
    setRuleConfig(loadRuleConfig())

    // Load shared review from URL param
    const params = new URLSearchParams(window.location.search)
    const reviewId = params.get('review')
    if (reviewId) {
      fetch(`/api/review/${reviewId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (!data?.review) return
          const review = data.review
          setCode(review.codeContent)
          setLanguage(review.language)
          setFileName(review.fileName || '')
          let positiveAspects: string[] = []
          try { if (review.positiveAspects) positiveAspects = JSON.parse(review.positiveAspects) } catch {}
          setResult({
            reviewId: review.id,
            summary: review.summary || '',
            positiveAspects,
            qualityScore: review.qualityScore || 0,
            totalLines: review.totalLines || 0,
            passed: review.passed,
            counts: {
              critical: review.criticalCount,
              error: review.errorCount,
              warning: review.warningCount,
              info: review.infoCount
            },
            findings: review.findings,
            testingSuggestions: []
          })
          setActiveTab('results')
        })
        .catch(() => {})
    }
  }, [])

  const historyLoaded = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // --- File handling ---
  const handleFileContent = useCallback((content: string, name: string) => {
    setCode(content)
    setFileName(name)
    setError(null)
    const detected = detectLanguage(name)
    if (detected) setLanguage(detected)
  }, [])

  const handleMultipleFiles = useCallback((files: File[]) => {
    if (files.length === 0) return
    if (files.length === 1) {
      const reader = new FileReader()
      reader.onload = () => handleFileContent(reader.result as string, files[0].name)
      reader.onerror = () => setError('Failed to read file')
      reader.readAsText(files[0])
      return
    }
    // Multiple files: concatenate with headers
    const readers = files.map(file => {
      return new Promise<{ name: string; content: string }>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve({ name: file.name, content: reader.result as string })
        reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
        reader.readAsText(file)
      })
    })
    Promise.all(readers).then(results => {
      const combined = results.map(r => `// ===== FILE: ${r.name} =====\n${r.content}`).join('\n\n')
      const names = results.map(r => r.name).join(', ')
      setCode(combined)
      setFileName(names)
      setError(null)
      const detected = detectLanguage(results[0].name)
      if (detected) setLanguage(detected)
    }).catch(() => setError('Failed to read one or more files'))
  }, [handleFileContent])

  const handleFileUpload = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    handleMultipleFiles(files)
    e.target.value = ''
  }, [handleMultipleFiles])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files || [])
    handleMultipleFiles(files)
  }, [handleMultipleFiles])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  // --- GitHub fetch ---
  const handleGitHubFetch = async () => {
    if (!githubUrl.trim() || !isGitHubUrl(githubUrl)) {
      toast.error('Enter a valid GitHub file URL (e.g. https://github.com/owner/repo/blob/main/src/file.ts)')
      return
    }
    setIsLoadingGithub(true)
    setError(null)
    try {
      const res = await fetch('/api/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: githubUrl })
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Failed to fetch (${res.status})`)
      }
      const data = await res.json()
      handleFileContent(data.content, data.fileName)
      setGithubUrl('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch from GitHub')
    } finally {
      setIsLoadingGithub(false)
    }
  }

  // --- History ---
  const loadHistory = useCallback(async (force = false, page = 1) => {
    if (!force && historyLoaded.current && page === historyPage) return
    setIsLoadingHistory(true)
    try {
      const res = await fetch(`/api/review?limit=${HISTORY_PAGE_SIZE}&offset=${(page - 1) * HISTORY_PAGE_SIZE}`)
      if (!res.ok) throw new Error('Failed to load history')
      const data = await res.json()
      setHistory(data.reviews || [])
      setHistoryTotal(data.total || data.reviews?.length || 0)
      setHistoryPage(page)
      historyLoaded.current = true
    } catch (err) {
      console.error('Failed to load history:', err)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [historyPage, HISTORY_PAGE_SIZE])

  // --- Review ---
  const handleReview = async () => {
    if (!code.trim()) return
    setIsLoading(true)
    setError(null)
    setFixApplied(false)
    setResult(null)
    setActiveTab('results')
    setStreamStatus('Starting review...')
    try {
      const customPrompt = loadCustomPrompt()
      const res = await fetch('/api/review/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language, fileName, preset, enabledCategories: ruleConfig, customPrompt, saveHistory: true })
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Review failed (${res.status})`)
      }
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = parseSSE(buffer)
        buffer = ''
        for (const evt of events) {
          if (evt.event === 'status') setStreamStatus(evt.data)
          else if (evt.event === 'result') {
            const data = JSON.parse(evt.data)
            setResult(data)
            setSyntaxResult(analyzeSyntax(code, language))
            loadHistory(true)
            sendWebhookNotification({
              fileName: fileName || undefined,
              language,
              qualityScore: data.qualityScore,
              passed: data.passed,
              findingsCount: data.findings?.length || 0,
              summary: data.summary || '',
            }).catch(() => {})
          } else if (evt.event === 'error') {
            throw new Error(evt.data)
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Review failed')
      setActiveTab('editor')
    } finally {
      setIsLoading(false)
      setStreamStatus(null)
    }
  }

  // --- Auto-fix ---
  const handleAutoFix = () => {
    setShowAutoFixPreview(true)
  }

  const handleApplyFix = (fixedCode: string) => {
    setCode(fixedCode)
    setFixApplied(true)
    setResult(null)
    setShowAutoFixPreview(false)
    toast.success('Auto-fixes applied! Re-run review to verify.')
  }

  // --- Export ---
  const handleCopyMarkdown = async () => {
    if (!result) return
    const md = exportAsMarkdown(result, fileName || undefined)
    await navigator.clipboard.writeText(md)
    toast.success('Report copied to clipboard')
  }

  const handleDownloadReport = () => {
    if (!result) return
    const md = exportAsMarkdown(result, fileName || undefined)
    const reportName = fileName ? `${fileName.replace(/\.[^.]+$/, '')}-review.md` : 'code-review.md'
    downloadFile(md, reportName)
  }

  const handleDownloadJSON = () => {
    if (!result) return
    const json = exportAsJSON(result, fileName || undefined)
    const reportName = fileName ? `${fileName.replace(/\.[^.]+$/, '')}-review.json` : 'code-review.json'
    downloadFile(json, reportName)
  }

  const handleDownloadCSV = () => {
    if (!result) return
    const csv = exportAsCSV(result)
    const reportName = fileName ? `${fileName.replace(/\.[^.]+$/, '')}-review.csv` : 'code-review.csv'
    downloadFile(csv, reportName)
  }

  const handleShare = async () => {
    if (!result?.reviewId) return
    const shareUrl = `${window.location.origin}?review=${result.reviewId}`
    await navigator.clipboard.writeText(shareUrl)
    toast.success('Share link copied to clipboard')
  }

  // --- Misc ---
  const handleLoadSample = () => {
    setCode(SAMPLE_CODE)
    setLanguage('javascript')
    setFileName('example.js')
    setFixApplied(false)
  }

  const handleClear = () => {
    setCode('')
    setFileName('')
    setResult(null)
    setExpandedFindings(new Set())
    setError(null)
    setFixApplied(false)
  }

  const toggleFinding = (ruleId: string) => {
    setExpandedFindings(prev => {
      const next = new Set(prev)
      if (next.has(ruleId)) next.delete(ruleId)
      else next.add(ruleId)
      return next
    })
  }

  const handleSelectHistory = (review: HistoryReview) => {
    setCode(review.codeContent)
    setLanguage(review.language)
    setFileName(review.fileName || '')
    setFixApplied(false)
    let positiveAspects: string[] = []
    try {
      if (review.positiveAspects) positiveAspects = JSON.parse(review.positiveAspects)
    } catch { /* ignore parse errors */ }
    setResult({
      reviewId: review.id,
      summary: review.summary || '',
      positiveAspects,
      qualityScore: review.qualityScore || 0,
      totalLines: review.totalLines || 0,
      passed: review.passed,
      counts: {
        critical: review.criticalCount,
        error: review.errorCount,
        warning: review.warningCount,
        info: review.infoCount
      },
      findings: review.findings,
      testingSuggestions: []
    })
    setActiveTab('results')
  }

  const toggleRuleCategory = (key: keyof RuleConfig) => {
    const updated = { ...ruleConfig, [key]: !ruleConfig[key] }
    setRuleConfig(updated)
    saveRuleConfig(updated)
  }

  const autoFixableCount = result?.findings.filter(f => f.autoFixable).length ?? 0
  const filteredFindings = result?.findings.filter(f => {
    if (findingSeverityFilter !== 'all' && f.severity !== findingSeverityFilter) return false
    if (findingCategoryFilter !== 'all' && f.category !== findingCategoryFilter) return false
    if (findingSearch) {
      const q = findingSearch.toLowerCase()
      return f.message.toLowerCase().includes(q) ||
        f.ruleId.toLowerCase().includes(q) ||
        (f.suggestion?.toLowerCase().includes(q) ?? false)
    }
    return true
  }) || []

  const filteredGroupedFindings = filteredFindings.reduce((acc, finding) => {
    if (!acc[finding.severity]) acc[finding.severity] = []
    acc[finding.severity].push(finding)
    return acc
  }, {} as Record<string, Finding[]>)

  const displayedHistory = history.filter(r => {
    if (!historySearch) return true
    const q = historySearch.toLowerCase()
    return (r.fileName?.toLowerCase().includes(q)) || r.language.toLowerCase().includes(q)
  })

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-[7px]" style={{ background: 'linear-gradient(135deg, #3805E3 0%, #5B33F0 100%)' }}>
                <Code className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">AI Code Review Agent</h1>
                <p className="text-sm text-muted-foreground font-mono text-xs tracking-wider uppercase">
                  Mediagenix AIR Platform
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden sm:flex">
                <Shield className="h-3 w-3 mr-1" />
                Security Analysis
              </Badge>
              <Badge variant="outline" className="hidden sm:flex">
                <Zap className="h-3 w-3 mr-1" />
                Performance
              </Badge>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-4xl grid-cols-7" data-tour="tabs">
            <TabsTrigger value="editor">
              <Code className="h-4 w-4 mr-2" />
              Editor
            </TabsTrigger>
            <TabsTrigger value="results" disabled={!result && !isLoading}>
              <AlertCircle className="h-4 w-4 mr-2" />
              Results
            </TabsTrigger>
            <TabsTrigger value="history" onClick={() => loadHistory()}>
              <History className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
            <TabsTrigger value="compare" onClick={() => loadHistory()}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Compare
            </TabsTrigger>
            <TabsTrigger value="dashboard" onClick={() => loadHistory()}>
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="queue">
              <ListTodo className="h-4 w-4 mr-2" />
              Queue
            </TabsTrigger>
            <TabsTrigger value="tools">
              <Pencil className="h-4 w-4 mr-2" />
              Tools
            </TabsTrigger>
          </TabsList>

          {/* Editor Tab */}
          <TabsContent value="editor" className="space-y-4">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg" data-tour="editor">Code Input</CardTitle>
                      <div className="flex items-center gap-2">
                        <Select value={language} onValueChange={setLanguage}>
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="javascript">JavaScript</SelectItem>
                            <SelectItem value="typescript">TypeScript</SelectItem>
                            <SelectItem value="python">Python</SelectItem>
                            <SelectItem value="java">Java</SelectItem>
                            <SelectItem value="go">Go</SelectItem>
                            <SelectItem value="rust">Rust</SelectItem>
                            <SelectItem value="csharp">C#</SelectItem>
                            <SelectItem value="php">PHP</SelectItem>
                            <SelectItem value="ruby">Ruby</SelectItem>
                            <SelectItem value="smalltalk">Smalltalk</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <CardDescription>
                      Paste code, type it, or drag &amp; drop a file
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <input
                      type="text"
                      placeholder="File name (optional)"
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                    />
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="GitHub file URL (e.g. https://github.com/owner/repo/blob/main/file.ts)"
                          value={githubUrl}
                          onChange={(e) => setGithubUrl(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleGitHubFetch() }}
                          className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGitHubFetch}
                        disabled={!githubUrl.trim() || isLoadingGithub}
                        className="shrink-0"
                      >
                        {isLoadingGithub ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fetch'}
                      </Button>
                    </div>
                    <div
                      className={`relative rounded-md border-2 transition-colors ${
                        isDragging
                          ? 'border-primary border-dashed bg-primary/5'
                          : 'border-transparent'
                      }`}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                    >
                      {isDragging && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-primary/10">
                          <div className="flex flex-col items-center gap-2 text-primary">
                            <Upload className="h-8 w-8" />
                            <span className="text-sm font-medium">Drop file(s) here</span>
                          </div>
                        </div>
                      )}
                      {useMonaco ? (
                        <div className="h-96 rounded-md overflow-hidden border">
                          <CodeEditor
                            value={code}
                            onChange={(v) => setCode(v)}
                            language={language}
                            highlights={result?.findings.map(f => ({ line: f.lineStart, severity: f.severity })) || []}
                          />
                        </div>
                      ) : (
                        <textarea
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          placeholder="// Paste your code here or drag & drop file(s)..."
                          className="w-full h-96 p-4 font-mono text-sm border rounded-md bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                          spellCheck={false}
                        />
                      )}
                      <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                        {code.split('\n').length} lines
                      </div>
                    </div>

                    {/* Review preset selector */}
                    <div className="flex gap-2 flex-wrap" data-tour="presets">
                      {REVIEW_PRESETS.map((p) => {
                        const Icon = p.icon
                        return (
                          <Button
                            key={p.id}
                            variant={preset === p.id ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPreset(p.id)}
                            title={p.desc}
                          >
                            <Icon className="h-3.5 w-3.5 mr-1.5" />
                            {p.label}
                          </Button>
                        )
                      })}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleReview}
                        disabled={!code.trim() || isLoading}
                        className="flex-1"
                        data-tour="review-btn"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Start Review
                            <kbd className="ml-2 text-xs opacity-60 hidden sm:inline">Ctrl+Enter</kbd>
                          </>
                        )}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept=".js,.jsx,.ts,.tsx,.py,.java,.go,.rs,.cs,.php,.rb,.mjs,.cjs,.mts"
                        multiple
                        onChange={handleFileUpload}
                      />
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-1" />
                        Upload
                      </Button>
                      <Button variant="outline" onClick={handleLoadSample}>
                        Sample
                      </Button>
                      <Button variant="ghost" onClick={() => code ? setConfirmClear(true) : undefined} disabled={!code}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {fixApplied && (
                      <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 border border-green-500/30 text-sm text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                        Auto-fixes applied. Click &quot;Start Review&quot; to re-analyze.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Analysis Features</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {[
                        { icon: Shield, label: 'Security Vulnerabilities', desc: 'OWASP Top 10, SQL injection, XSS' },
                        { icon: Zap, label: 'Performance Issues', desc: 'N+1 queries, memory leaks' },
                        { icon: Code, label: 'Code Quality', desc: 'Complexity, duplication, dead code' },
                        { icon: BookOpen, label: 'Best Practices', desc: 'Framework-specific patterns' },
                        { icon: Wrench, label: 'Auto-fixes', desc: 'One-click corrections for common issues' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                          <div className="p-1 rounded bg-primary/10">
                            <item.icon className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="text-sm font-medium">{item.label}</div>
                            <div className="text-xs text-muted-foreground">{item.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => setShowSettings(s => !s)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowSettings(s => !s) } }}
                    >
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Rule Settings
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {Object.values(ruleConfig).filter(Boolean).length}/4
                      </Badge>
                    </div>
                  </CardHeader>
                  {showSettings && (
                    <CardContent className="space-y-3">
                      {([
                        { key: 'security' as const, label: 'Security', desc: 'SQL injection, XSS, secrets', icon: Shield },
                        { key: 'performance' as const, label: 'Performance', desc: 'N+1 queries, sync ops', icon: Zap },
                        { key: 'maintainability' as const, label: 'Maintainability', desc: 'Complexity, empty catch, any type', icon: Code },
                        { key: 'style' as const, label: 'Style', desc: 'var usage, console.log, TODOs', icon: FileCode },
                      ]).map((item) => (
                        <label key={item.key} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={ruleConfig[item.key]}
                            onChange={() => toggleRuleCategory(item.key)}
                            className="rounded border-muted-foreground"
                          />
                          <item.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div>
                            <div className="text-sm font-medium">{item.label}</div>
                            <div className="text-xs text-muted-foreground">{item.desc}</div>
                          </div>
                        </label>
                      ))}
                    </CardContent>
                  )}
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results" className="space-y-4">
            {isLoading && !result && (
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  {streamStatus && (
                    <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-sm font-mono">{streamStatus}</span>
                    </div>
                  )}
                  <ReviewSkeleton />
                </div>
                <div className="space-y-4">
                  <div className="rounded-lg border p-6 animate-pulse">
                    <div className="h-5 bg-muted rounded w-28 mb-4" />
                    <div className="h-32 bg-muted rounded" />
                  </div>
                </div>
              </div>
            )}
            {result && (
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  {/* Summary */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Review Summary</CardTitle>
                          <CardDescription className="mt-1">{result.summary}</CardDescription>
                        </div>
                        {result.passed ? (
                          <Badge className="bg-green-500 text-base px-4 py-1">
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Passed
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500 text-base px-4 py-1">
                            <XCircle className="h-4 w-4 mr-1" />
                            Failed
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                          { label: 'Critical', count: result.counts.critical, color: 'bg-red-500' },
                          { label: 'Errors', count: result.counts.error, color: 'bg-orange-500' },
                          { label: 'Warnings', count: result.counts.warning, color: 'bg-yellow-500' },
                          { label: 'Info', count: result.counts.info, color: 'bg-blue-500' },
                        ].map((item) => (
                          <div key={item.label} className="text-center p-3 rounded-lg bg-muted/50">
                            <div className={`text-2xl font-bold ${item.color.replace('bg-', 'text-')}`}>
                              {item.count}
                            </div>
                            <div className="text-xs text-muted-foreground">{item.label}</div>
                          </div>
                        ))}
                      </div>

                      {result.findings.length === 0 && (
                        <div className="text-center py-6 space-y-2">
                          <div className="text-4xl">&#127881;</div>
                          <p className="text-lg font-medium text-green-600 dark:text-green-400">Clean code!</p>
                          <p className="text-sm text-muted-foreground">No issues found. Great work!</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2 border-t">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="sm" onClick={handleCopyMarkdown}>
                                <Copy className="h-4 w-4 mr-1.5" />
                                Copy Report
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy review as Markdown</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Download className="h-4 w-4 mr-1.5" />
                              Export
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={handleDownloadReport}>
                              Markdown (.md)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleDownloadJSON}>
                              JSON (.json)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleDownloadCSV}>
                              CSV (.csv)
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {result.reviewId && (
                          <Button variant="outline" size="sm" onClick={handleShare}>
                            <Share2 className="h-4 w-4 mr-1.5" />
                            Share
                          </Button>
                        )}
                        {autoFixableCount > 0 && (
                          <Button variant="outline" size="sm" onClick={handleAutoFix} className="ml-auto">
                            <Wrench className="h-4 w-4 mr-1.5" />
                            Apply {autoFixableCount} fix{autoFixableCount > 1 ? 'es' : ''}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Review Comments */}
                  {result.reviewId && (
                    <ReviewComments reviewId={result.reviewId} />
                  )}

                  {/* Auto-fix Preview */}
                  {showAutoFixPreview && (
                    <AutoFixPreview
                      code={code}
                      onApply={handleApplyFix}
                      onCancel={() => setShowAutoFixPreview(false)}
                    />
                  )}

                  {/* Positive Aspects */}
                  {result.positiveAspects.length > 0 && (
                    <Card className="border-green-500/30 bg-green-500/5">
                      <CardHeader>
                        <CardTitle className="text-lg text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-5 w-5 inline mr-2" />
                          Positive Aspects
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {result.positiveAspects.map((aspect, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              {aspect}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {result.findings.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search findings..."
                          value={findingSearch}
                          onChange={e => setFindingSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background"
                        />
                      </div>
                      <Select value={findingSeverityFilter} onValueChange={setFindingSeverityFilter}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Severity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Severity</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                          <SelectItem value="error">Error</SelectItem>
                          <SelectItem value="warning">Warning</SelectItem>
                          <SelectItem value="info">Info</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={findingCategoryFilter} onValueChange={setFindingCategoryFilter}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          <SelectItem value="security">Security</SelectItem>
                          <SelectItem value="performance">Performance</SelectItem>
                          <SelectItem value="maintainability">Maintainability</SelectItem>
                          <SelectItem value="style">Style</SelectItem>
                          <SelectItem value="bug">Bug</SelectItem>
                        </SelectContent>
                      </Select>
                      {(findingSearch || findingSeverityFilter !== 'all' || findingCategoryFilter !== 'all') && (
                        <Button variant="ghost" size="sm" onClick={() => { setFindingSearch(''); setFindingSeverityFilter('all'); setFindingCategoryFilter('all') }}>
                          Clear filters
                        </Button>
                      )}
                    </div>
                  )}

                  {(['critical', 'error', 'warning', 'info'] as const).map((severity) => {
                    const findings = filteredGroupedFindings[severity] || []
                    if (findings.length === 0) return null
                    return (
                      <Card key={severity}>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {(() => {
                              const Icon = severityConfig[severity].icon
                              return <Icon className={`h-5 w-5 ${severityConfig[severity].color}`} />
                            })()}
                            {severity.charAt(0).toUpperCase() + severity.slice(1)} Findings
                            <Badge variant="outline">{findings.length}</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {findings.map((finding, i) => (
                              <div key={`${finding.ruleId}-${i}`} className="space-y-1">
                                <FindingCard
                                  finding={finding}
                                  isExpanded={expandedFindings.has(`${finding.ruleId}-${i}`)}
                                  onToggle={() => toggleFinding(`${finding.ruleId}-${i}`)}
                                />
                                {expandedFindings.has(`${finding.ruleId}-${i}`) && (
                                  <div className="pl-12 flex items-center gap-3">
                                    <SeverityCalibrator
                                      ruleId={finding.ruleId}
                                      currentSeverity={finding.severity}
                                    />
                                    {result.reviewId && (
                                      <FindingResolution
                                        findingId={finding.ruleId}
                                        reviewId={result.reviewId}
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}

                  {filteredFindings.length === 0 && result.findings.length > 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No findings match your filters</p>
                    </div>
                  )}

                  {/* Testing Suggestions */}
                  {result.testingSuggestions.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          <Lightbulb className="h-5 w-5 inline mr-2" />
                          Testing Suggestions
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {result.testingSuggestions.map((suggestion, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              {suggestion}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Metrics Sidebar */}
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Quality Score</CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                      <QualityGauge score={result.qualityScore} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Metrics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Lines</span>
                          <span className="font-medium">{result.totalLines}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Findings</span>
                          <span className="font-medium">{result.findings.length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Auto-fixable</span>
                          <span className="font-medium">{autoFixableCount}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Resolved</span>
                          <span className="font-medium">{Object.keys(resolvedFindings).length}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Category Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {['security', 'performance', 'maintainability', 'style', 'bug'].map((cat) => {
                        const count = result.findings.filter(f => f.category === cat).length
                        const percentage = result.findings.length > 0
                          ? (count / result.findings.length) * 100
                          : 0
                        const Icon = categoryIcons[cat] || Code
                        return (
                          <div key={cat} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2 capitalize">
                                <Icon className="h-4 w-4" />
                                {cat}
                              </span>
                              <span>{count}</span>
                            </div>
                            <Progress value={percentage} className="h-2" />
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>

                  {syntaxResult && (
                    <SyntaxReport result={syntaxResult} />
                  )}

                  <Button
                    className="w-full"
                    onClick={() => {
                      setResult(null)
                      setSyntaxResult(null)
                      setActiveTab('editor')
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    New Review
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            {history.length >= 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quality Trend</CardTitle>
                  <CardDescription>Score progression over recent reviews</CardDescription>
                </CardHeader>
                <CardContent>
                  <QualityTrend
                    points={[...history].reverse().map(r => ({
                      score: r.qualityScore ?? 0,
                      date: r.createdAt
                    }))}
                  />
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Review History</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => loadHistory(true)}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
                <CardDescription>Your recent code reviews</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Search by filename or language..."
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                  />
                </div>
                {isLoadingHistory ? (
                  <HistorySkeleton />
                ) : history.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground space-y-3">
                    <History className="h-12 w-12 mx-auto opacity-50" />
                    <p className="font-medium">No review history yet</p>
                    <p className="text-sm">Run your first code review to see results here.</p>
                    <Button variant="outline" size="sm" onClick={() => setActiveTab('editor')}>
                      Go to Editor
                    </Button>
                  </div>
                ) : (
                  <>
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-3">
                        {displayedHistory.map((review) => (
                          <HistoryItem
                            key={review.id}
                            review={review}
                            onSelect={() => handleSelectHistory(review)}
                          />
                        ))}
                        {displayedHistory.length === 0 && historySearch && (
                          <div className="text-center py-8 text-muted-foreground">
                            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No reviews match your search</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                    {historyTotal > HISTORY_PAGE_SIZE && (
                      <div className="flex items-center justify-between pt-4 border-t mt-4">
                        <span className="text-sm text-muted-foreground">
                          Page {historyPage} of {Math.ceil(historyTotal / HISTORY_PAGE_SIZE)}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={historyPage <= 1}
                            onClick={() => loadHistory(true, historyPage - 1)}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={historyPage >= Math.ceil(historyTotal / HISTORY_PAGE_SIZE)}
                            onClick={() => loadHistory(true, historyPage + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Compare Tab */}
          <TabsContent value="compare" className="space-y-4">
            <ReviewComparison reviews={history} />
          </TabsContent>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4">
            <TeamDashboard reviews={history.map(r => ({
              qualityScore: r.qualityScore,
              passed: r.passed,
              criticalCount: r.criticalCount,
              errorCount: r.errorCount,
              warningCount: r.warningCount,
              infoCount: r.infoCount,
              language: r.language,
              createdAt: r.createdAt,
              fileName: r.fileName,
            }))} />
          </TabsContent>

          {/* Queue Tab */}
          <TabsContent value="queue" className="space-y-4">
            <JobQueue onViewResult={(jobResult) => {
              setResult(jobResult)
              setActiveTab('results')
            }} />
          </TabsContent>

          {/* Tools Tab */}
          <TabsContent value="tools" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Pencil className="h-5 w-5" />
                    Custom Rules
                  </CardTitle>
                  <CardDescription>Create regex-based rules for your codebase</CardDescription>
                </CardHeader>
                <CardContent>
                  <RuleEditor />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    AI Prompt
                  </CardTitle>
                  <CardDescription>Customize the AI reviewer behavior</CardDescription>
                </CardHeader>
                <CardContent>
                  <PromptEditor />
                </CardContent>
              </Card>
            </div>
            <div className="grid lg:grid-cols-2 gap-6">
              <ProjectProfileSelector
                currentPreset={preset}
                currentRuleConfig={ruleConfig}
                onApply={(newRuleConfig, newPreset) => {
                  setRuleConfig(newRuleConfig)
                  saveRuleConfig(newRuleConfig)
                  setPreset(newPreset as PresetId)
                }}
              />
              <NotificationSettings />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background/80 backdrop-blur-sm mt-auto">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono tracking-wider uppercase">
            <div className="flex items-center gap-2">
              <Code className="h-3.5 w-3.5" />
              <span>Mediagenix AIR</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Static Analysis + AI</span>
            </div>
          </div>
        </div>
      </footer>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear editor?"
        description="This will remove all code and review results. This action cannot be undone."
        confirmLabel="Clear"
        onConfirm={() => { handleClear(); setConfirmClear(false) }}
      />
      <KeyboardShortcuts />
      <GuidedTour />
    </div>
  )
}
