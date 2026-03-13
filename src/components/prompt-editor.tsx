'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RotateCcw, Save, Plus } from 'lucide-react'
import {
  DEFAULT_REVIEW_PROMPT,
  loadCustomPrompt,
  saveCustomPrompt,
  clearCustomPrompt,
} from '@/lib/prompt-config'

const TEMPLATE_VARIABLES = [
  { name: '{{language}}', description: 'The programming language of the submitted code' },
  { name: '{{preset}}', description: 'The selected review preset (full, security, performance, etc.)' },
  { name: '{{staticFindings}}', description: 'Static analysis findings already detected before AI review' },
]

const PRESET_SNIPPETS = [
  {
    label: 'Be more strict',
    text: '\nBe very strict in your review. Flag any deviation from best practices, even minor ones. Prefer higher severity ratings when in doubt.',
  },
  {
    label: 'Focus on testing',
    text: '\nFocus heavily on test coverage and testability. Suggest specific test cases for every function and code path. Flag untestable code as a warning.',
  },
  {
    label: 'Explain like I\'m a junior developer',
    text: '\nExplain all findings in detail as if the reader is a junior developer. Include background context, link concepts, and avoid jargon without explanation.',
  },
  {
    label: 'Only report high-confidence issues',
    text: '\nOnly report issues you are highly confident about. Avoid speculative or stylistic feedback. Every finding must be clearly justified with concrete reasoning.',
  },
]

export function PromptEditor() {
  const [mode, setMode] = useState<'default' | 'custom'>('default')
  const [customPrompt, setCustomPrompt] = useState('')
  const [saved, setSaved] = useState(false)

  // Load persisted prompt on mount
  useEffect(() => {
    const stored = loadCustomPrompt()
    if (stored !== null) {
      setCustomPrompt(stored)
      setMode('custom')
    } else {
      setCustomPrompt(DEFAULT_REVIEW_PROMPT)
    }
  }, [])

  const handleSave = useCallback(() => {
    saveCustomPrompt(customPrompt)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [customPrompt])

  const handleReset = useCallback(() => {
    clearCustomPrompt()
    setCustomPrompt(DEFAULT_REVIEW_PROMPT)
    setMode('default')
    setSaved(false)
  }, [])

  const handleInsertSnippet = useCallback(
    (snippet: string) => {
      setCustomPrompt((prev) => prev + snippet)
      setMode('custom')
    },
    [],
  )

  const handleTabChange = useCallback(
    (value: string) => {
      const newMode = value as 'default' | 'custom'
      setMode(newMode)
      if (newMode === 'default') {
        setCustomPrompt(DEFAULT_REVIEW_PROMPT)
      }
    },
    [],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">AI Prompt Configuration</CardTitle>
        <CardDescription>
          Customize the system prompt sent to the AI reviewer. Use template variables to inject
          dynamic context.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Template variables */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Template Variables</h3>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_VARIABLES.map((v) => (
              <div key={v.name} className="group relative">
                <Badge
                  variant="outline"
                  className="font-mono text-xs border-[#2DD4BF]/40 text-[#2DD4BF] cursor-help"
                >
                  {v.name}
                </Badge>
                <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-10 w-56 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md">
                  {v.description}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Preset snippets */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Quick Snippets</h3>
          <div className="flex flex-wrap gap-2">
            {PRESET_SNIPPETS.map((snippet) => (
              <Button
                key={snippet.label}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => handleInsertSnippet(snippet.text)}
              >
                <Plus className="h-3 w-3 mr-1" />
                {snippet.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Mode tabs */}
        <Tabs value={mode} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="default">Default</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>

          <TabsContent value="default" className="mt-4">
            <textarea
              readOnly
              value={DEFAULT_REVIEW_PROMPT}
              className="w-full min-h-[320px] rounded-md border border-border bg-muted/50 p-3 font-mono text-xs text-muted-foreground resize-y focus:outline-none cursor-default"
              aria-label="Default system prompt (read-only)"
            />
            <p className="text-xs text-muted-foreground mt-2">
              This is the built-in default prompt. Switch to <strong>Custom</strong> to edit.
            </p>
          </TabsContent>

          <TabsContent value="custom" className="mt-4 space-y-3">
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="w-full min-h-[320px] rounded-md border border-[#2DD4BF]/30 bg-background p-3 font-mono text-xs resize-y focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/40"
              aria-label="Custom system prompt"
              placeholder="Write your custom system prompt here..."
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSave} className="bg-[#2DD4BF] hover:bg-[#2DD4BF]/80 text-black">
                <Save className="h-3 w-3 mr-1" />
                {saved ? 'Saved!' : 'Save Prompt'}
              </Button>
              <Button size="sm" variant="outline" onClick={handleReset}>
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset to Default
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
