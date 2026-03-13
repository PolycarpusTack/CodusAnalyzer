'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GitPullRequest, Loader2, Eye, EyeOff, Save } from 'lucide-react'

interface PRFileEntry {
  filename: string
  status: 'added' | 'modified' | 'removed'
  patch: string
  rawUrl: string
}

interface PRInfoResponse {
  owner: string
  repo: string
  number: number
  title: string
  files: PRFileEntry[]
}

interface GitHubPRInputProps {
  onReviewFiles: (
    files: Array<{ name: string; content: string; language: string }>
  ) => void
}

const STATUS_COLORS: Record<string, string> = {
  added: 'bg-[#2DD4BF] text-white',
  modified: 'bg-[#F59E0B] text-white',
  removed: 'bg-[#F87171] text-white',
}

function getLanguageFromFilename(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  const map: Record<string, string> = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.mts': 'typescript',
    '.py': 'python',
    '.pyw': 'python',
    '.java': 'java',
    '.go': 'go',
    '.rs': 'rust',
    '.cs': 'csharp',
    '.php': 'php',
    '.rb': 'ruby',
  }
  return map[ext] || 'text'
}

export function GitHubPRInput({ onReviewFiles }: GitHubPRInputProps) {
  const [prUrl, setPrUrl] = useState('')
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prInfo, setPrInfo] = useState<PRInfoResponse | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())

  // Load saved token on mount
  useEffect(() => {
    const saved = localStorage.getItem('github-pr-token')
    if (saved) setToken(saved)
  }, [])

  const handleSaveToken = () => {
    localStorage.setItem('github-pr-token', token)
  }

  const handleFetchPR = async () => {
    setError(null)
    setPrInfo(null)
    setSelectedFiles(new Set())

    if (!prUrl.trim()) {
      setError('Please enter a GitHub PR URL.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/github/pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: prUrl.trim(),
          token: token || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || `Failed to fetch PR (${res.status})`)
        return
      }

      setPrInfo(data)

      // Auto-select non-removed files
      const autoSelected = new Set<string>()
      for (const file of data.files) {
        if (file.status !== 'removed') {
          autoSelected.add(file.filename)
        }
      }
      setSelectedFiles(autoSelected)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch PR.')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleFile = (filename: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(filename)) {
        next.delete(filename)
      } else {
        next.add(filename)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (!prInfo) return
    if (selectedFiles.size === prInfo.files.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(prInfo.files.map((f) => f.filename)))
    }
  }

  const handleReviewSelected = () => {
    if (!prInfo) return

    const filesToReview = prInfo.files
      .filter((f) => selectedFiles.has(f.filename))
      .map((f) => ({
        name: f.filename,
        content: f.patch,
        language: getLanguageFromFilename(f.filename),
      }))

    if (filesToReview.length === 0) {
      setError('Please select at least one file to review.')
      return
    }

    onReviewFiles(filesToReview)
  }

  return (
    <Card className="border-[#3805E3]/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <GitPullRequest className="h-5 w-5 text-[#5B33F0]" />
          GitHub PR Review
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* PR URL input */}
        <div className="space-y-1.5">
          <Label htmlFor="pr-url">Pull Request URL</Label>
          <div className="flex gap-2">
            <Input
              id="pr-url"
              placeholder="https://github.com/owner/repo/pull/123"
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFetchPR()
              }}
            />
            <Button
              onClick={handleFetchPR}
              disabled={loading}
              className="bg-[#3805E3] hover:bg-[#5B33F0] text-white shrink-0"
            >
              {loading ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : null}
              Fetch PR
            </Button>
          </div>
        </div>

        {/* Token input */}
        <div className="space-y-1.5">
          <Label htmlFor="gh-token">
            GitHub Token{' '}
            <span className="text-xs text-muted-foreground">
              (optional, for private repos)
            </span>
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="gh-token"
                type={showToken ? 'text' : 'password'}
                placeholder="ghp_..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <Button
              variant="outline"
              onClick={handleSaveToken}
              className="border-[#3805E3]/30 text-[#5B33F0] hover:bg-[#5B33F0]/10 shrink-0"
            >
              <Save className="mr-1 h-4 w-4" />
              Save token
            </Button>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="rounded-md border border-[#F87171]/30 bg-[#F87171]/10 px-3 py-2 text-sm text-[#F87171]">
            {error}
          </div>
        )}

        {/* PR files list */}
        {prInfo && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-sm">
                  {prInfo.title}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {prInfo.owner}/{prInfo.repo} #{prInfo.number} &mdash;{' '}
                  {prInfo.files.length} file
                  {prInfo.files.length !== 1 ? 's' : ''} changed
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="text-xs text-[#5B33F0] hover:bg-[#5B33F0]/10"
              >
                {selectedFiles.size === prInfo.files.length
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1 rounded-md border border-[#3805E3]/10 p-2">
              {prInfo.files.map((file) => (
                <label
                  key={file.filename}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-[#5B33F0]/5 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedFiles.has(file.filename)}
                    onCheckedChange={() => handleToggleFile(file.filename)}
                  />
                  <Badge
                    className={`text-[10px] px-1.5 py-0 shrink-0 ${STATUS_COLORS[file.status]}`}
                  >
                    {file.status.charAt(0).toUpperCase() + file.status.slice(1)}
                  </Badge>
                  <span className="text-sm font-mono truncate">
                    {file.filename}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleReviewSelected}
                disabled={selectedFiles.size === 0}
                className="bg-[#3805E3] hover:bg-[#5B33F0] text-white"
              >
                Review Selected ({selectedFiles.size})
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
