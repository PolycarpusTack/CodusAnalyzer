'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const SHORTCUTS = [
  { keys: ['Ctrl', 'Enter'], desc: 'Start review' },
  { keys: ['?'], desc: 'Show keyboard shortcuts' },
  { keys: ['Ctrl', 'Shift', 'C'], desc: 'Copy report as Markdown' },
  { keys: ['Ctrl', 'Shift', 'E'], desc: 'Export report' },
  { keys: ['Ctrl', 'Shift', 'S'], desc: 'Load sample code' },
  { keys: ['Escape'], desc: 'Close dialogs' },
]

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        if ((e.target as HTMLElement)?.isContentEditable) return
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-muted-foreground">{s.desc}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, j) => (
                  <span key={j}>
                    {j > 0 && <span className="text-muted-foreground mx-0.5">+</span>}
                    <kbd className="px-2 py-1 text-xs font-mono rounded border bg-muted">{k}</kbd>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
