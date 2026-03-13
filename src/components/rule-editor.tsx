'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertCircle,
  Check,
  Download,
  Plus,
  Trash2,
  Upload,
  X,
  FileCode,
  Pencil,
} from 'lucide-react'
import {
  type CustomRule,
  loadCustomRules,
  saveCustomRules,
  validateRule,
} from '@/lib/custom-rules'

const SEVERITY_OPTIONS = ['critical', 'error', 'warning', 'info'] as const
type Severity = (typeof SEVERITY_OPTIONS)[number]

const CATEGORY_OPTIONS = [
  'security',
  'performance',
  'maintainability',
  'style',
  'bug',
  'testing',
  'custom',
]

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: 'bg-[#F87171] text-white',
  error: 'bg-red-500/80 text-white',
  warning: 'bg-amber-500 text-white',
  info: 'bg-[#5B33F0] text-white',
}

function generateId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
}

function emptyRule(): CustomRule {
  return {
    id: generateId(),
    name: '',
    pattern: '',
    severity: 'warning',
    category: 'custom',
    message: '',
    suggestion: '',
    enabled: true,
  }
}

interface RegexValidation {
  valid: boolean
  error?: string
  matchCount: number
}

function testRegex(pattern: string, sample: string): RegexValidation {
  if (!pattern.trim()) {
    return { valid: false, error: 'Pattern is empty.', matchCount: 0 }
  }
  try {
    const regex = new RegExp(pattern, 'gi')
    const matches = sample.match(regex)
    return { valid: true, matchCount: matches ? matches.length : 0 }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { valid: false, error: msg, matchCount: 0 }
  }
}

export function RuleEditor() {
  const [rules, setRules] = useState<CustomRule[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<CustomRule>(emptyRule())
  const [sampleText, setSampleText] = useState(
    '// sample code for regex testing\nconst password = "secret123";\nconsole.log(password);'
  )
  const [regexResult, setRegexResult] = useState<RegexValidation>({
    valid: false,
    error: 'Pattern is empty.',
    matchCount: 0,
  })
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load rules on mount
  useEffect(() => {
    setRules(loadCustomRules())
  }, [])

  // Live regex validation
  useEffect(() => {
    setRegexResult(testRegex(editingRule.pattern, sampleText))
  }, [editingRule.pattern, sampleText])

  const persistRules = useCallback((updated: CustomRule[]) => {
    setRules(updated)
    saveCustomRules(updated)
  }, [])

  const handleToggle = (id: string) => {
    const updated = rules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    )
    persistRules(updated)
  }

  const handleDelete = (id: string) => {
    if (deleteConfirmId === id) {
      const updated = rules.filter((r) => r.id !== id)
      persistRules(updated)
      setDeleteConfirmId(null)
    } else {
      setDeleteConfirmId(id)
      // Auto-clear confirmation after 3 seconds
      setTimeout(() => setDeleteConfirmId(null), 3000)
    }
  }

  const handleSaveRule = () => {
    setFormError(null)
    const validation = validateRule(editingRule)
    if (!validation.valid) {
      setFormError(validation.error || 'Invalid rule.')
      return
    }

    const existingIndex = rules.findIndex((r) => r.id === editingRule.id)
    let updated: CustomRule[]
    if (existingIndex >= 0) {
      updated = [...rules]
      updated[existingIndex] = editingRule
    } else {
      updated = [...rules, editingRule]
    }

    persistRules(updated)
    setEditingRule(emptyRule())
    setShowForm(false)
    setFormError(null)
  }

  const handleEditExisting = (rule: CustomRule) => {
    setEditingRule({ ...rule })
    setShowForm(true)
    setFormError(null)
  }

  const handleCancelForm = () => {
    setShowForm(false)
    setEditingRule(emptyRule())
    setFormError(null)
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(rules, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'custom-review-rules.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string)
        if (!Array.isArray(imported)) {
          setFormError('Import failed: file must contain a JSON array of rules.')
          return
        }

        // Validate each rule and assign new IDs to avoid conflicts
        const validRules: CustomRule[] = []
        const errors: string[] = []

        for (let i = 0; i < imported.length; i++) {
          const rule = {
            ...imported[i],
            id: imported[i].id || generateId(),
            enabled: imported[i].enabled !== false,
          } as CustomRule

          const validation = validateRule(rule)
          if (validation.valid) {
            validRules.push(rule)
          } else {
            errors.push(`Rule ${i + 1} ("${rule.name || 'unnamed'}"): ${validation.error}`)
          }
        }

        if (errors.length > 0 && validRules.length === 0) {
          setFormError(`Import failed. ${errors.join(' ')}`)
          return
        }

        // Merge: skip duplicates by id
        const existingIds = new Set(rules.map((r) => r.id))
        const newRules = validRules.filter((r) => !existingIds.has(r.id))
        const merged = [...rules, ...newRules]
        persistRules(merged)

        if (errors.length > 0) {
          setFormError(
            `Imported ${newRules.length} rules. Skipped ${errors.length} invalid rules.`
          )
        }
      } catch {
        setFormError('Import failed: could not parse JSON file.')
      }
    }
    reader.readAsText(file)

    // Reset input so the same file can be imported again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const updateField = <K extends keyof CustomRule>(
    field: K,
    value: CustomRule[K]
  ) => {
    setEditingRule((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Card className="border-[#3805E3]/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileCode className="h-5 w-5 text-[#5B33F0]" />
              Custom Rules
            </CardTitle>
            <CardDescription>
              Define regex-based rules for your code reviews
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="border-[#3805E3]/30 text-[#5B33F0] hover:bg-[#5B33F0]/10"
            >
              <Upload className="mr-1 h-4 w-4" />
              Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={rules.length === 0}
              className="border-[#3805E3]/30 text-[#5B33F0] hover:bg-[#5B33F0]/10"
            >
              <Download className="mr-1 h-4 w-4" />
              Export
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingRule(emptyRule())
                setShowForm(true)
                setFormError(null)
              }}
              className="bg-[#3805E3] hover:bg-[#5B33F0] text-white"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Rule
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Global error / info bar */}
        {formError && !showForm && (
          <div className="flex items-center gap-2 rounded-md border border-[#F87171]/30 bg-[#F87171]/10 px-3 py-2 text-sm text-[#F87171]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {formError}
            <button
              onClick={() => setFormError(null)}
              className="ml-auto"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Inline form */}
        {showForm && (
          <Card className="border-[#5B33F0]/30 bg-[#5B33F0]/5">
            <CardContent className="space-y-4 pt-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="rule-name">Name *</Label>
                  <Input
                    id="rule-name"
                    placeholder="e.g. No magic numbers"
                    value={editingRule.name}
                    onChange={(e) => updateField('name', e.target.value)}
                  />
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <Label htmlFor="rule-category">Category *</Label>
                  <Select
                    value={editingRule.category}
                    onValueChange={(val) => updateField('category', val)}
                  >
                    <SelectTrigger id="rule-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Severity */}
                <div className="space-y-1.5">
                  <Label htmlFor="rule-severity">Severity *</Label>
                  <Select
                    value={editingRule.severity}
                    onValueChange={(val) =>
                      updateField('severity', val as Severity)
                    }
                  >
                    <SelectTrigger id="rule-severity">
                      <SelectValue placeholder="Select severity" />
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITY_OPTIONS.map((sev) => (
                        <SelectItem key={sev} value={sev}>
                          {sev.charAt(0).toUpperCase() + sev.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Message */}
                <div className="space-y-1.5">
                  <Label htmlFor="rule-message">Message *</Label>
                  <Input
                    id="rule-message"
                    placeholder="e.g. Magic number detected; use a named constant"
                    value={editingRule.message}
                    onChange={(e) => updateField('message', e.target.value)}
                  />
                </div>
              </div>

              {/* Pattern */}
              <div className="space-y-1.5">
                <Label htmlFor="rule-pattern">
                  Pattern (regex) *
                </Label>
                <Input
                  id="rule-pattern"
                  placeholder="e.g. \\b\\d{3,}\\b"
                  value={editingRule.pattern}
                  onChange={(e) => updateField('pattern', e.target.value)}
                  className={
                    editingRule.pattern.trim() && !regexResult.valid
                      ? 'border-[#F87171] focus-visible:ring-[#F87171]/30'
                      : editingRule.pattern.trim() && regexResult.valid
                        ? 'border-[#2DD4BF] focus-visible:ring-[#2DD4BF]/30'
                        : ''
                  }
                />
                {editingRule.pattern.trim() && (
                  <div className="mt-1 text-xs">
                    {regexResult.valid ? (
                      <span className="flex items-center gap-1 text-[#2DD4BF]">
                        <Check className="h-3 w-3" />
                        Valid regex &mdash; {regexResult.matchCount} match
                        {regexResult.matchCount !== 1 ? 'es' : ''} in sample
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[#F87171]">
                        <AlertCircle className="h-3 w-3" />
                        {regexResult.error}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Sample text for regex testing */}
              <div className="space-y-1.5">
                <Label htmlFor="rule-sample">Sample text (for testing)</Label>
                <Textarea
                  id="rule-sample"
                  rows={3}
                  placeholder="Paste sample code here to test your regex..."
                  value={sampleText}
                  onChange={(e) => setSampleText(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              {/* Suggestion */}
              <div className="space-y-1.5">
                <Label htmlFor="rule-suggestion">Suggestion</Label>
                <Input
                  id="rule-suggestion"
                  placeholder="e.g. Extract the number into a named constant"
                  value={editingRule.suggestion}
                  onChange={(e) => updateField('suggestion', e.target.value)}
                />
              </div>

              {/* Form-level error */}
              {formError && showForm && (
                <div className="flex items-center gap-2 rounded-md border border-[#F87171]/30 bg-[#F87171]/10 px-3 py-2 text-sm text-[#F87171]">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {formError}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelForm}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveRule}
                  className="bg-[#3805E3] hover:bg-[#5B33F0] text-white"
                >
                  {rules.some((r) => r.id === editingRule.id)
                    ? 'Update Rule'
                    : 'Save Rule'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rules list */}
        {rules.length === 0 && !showForm && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#3805E3]/20 py-10 text-center text-sm text-muted-foreground">
            <FileCode className="mb-2 h-8 w-8 text-[#5B33F0]/40" />
            <p>No custom rules defined yet.</p>
            <p className="text-xs">
              Click &quot;Add Rule&quot; to create your first regex-based review
              rule.
            </p>
          </div>
        )}

        {rules.map((rule) => (
          <div
            key={rule.id}
            className={`flex items-center justify-between gap-4 rounded-lg border px-4 py-3 transition-colors ${
              rule.enabled
                ? 'border-[#3805E3]/15 bg-background'
                : 'border-muted bg-muted/30 opacity-60'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Switch
                checked={rule.enabled}
                onCheckedChange={() => handleToggle(rule.id)}
                aria-label={`Toggle rule ${rule.name}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">
                    {rule.name}
                  </span>
                  <Badge
                    className={`text-[10px] px-1.5 py-0 ${SEVERITY_COLORS[rule.severity]}`}
                  >
                    {rule.severity}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {rule.category}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                    /{rule.pattern}/gi
                  </code>
                  <span className="ml-2">{rule.message}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEditExisting(rule)}
                className="h-8 w-8 p-0 text-[#5B33F0] hover:bg-[#5B33F0]/10"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(rule.id)}
                className={`h-8 w-8 p-0 ${
                  deleteConfirmId === rule.id
                    ? 'bg-[#F87171]/10 text-[#F87171] hover:bg-[#F87171]/20'
                    : 'text-muted-foreground hover:text-[#F87171] hover:bg-[#F87171]/10'
                }`}
              >
                {deleteConfirmId === rule.id ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        ))}

        {rules.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">
            {rules.filter((r) => r.enabled).length} of {rules.length} rules
            enabled
          </p>
        )}
      </CardContent>
    </Card>
  )
}
