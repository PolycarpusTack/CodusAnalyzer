'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { MessageSquare, Send, Trash2 } from 'lucide-react'

interface Comment {
  id: string
  text: string
  findingId?: string
  timestamp: string
}

const STORAGE_PREFIX = 'review-comments-'

function loadComments(reviewId: string): Comment[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + reviewId)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveComments(reviewId: string, comments: Comment[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_PREFIX + reviewId, JSON.stringify(comments))
}

export function ReviewComments({ reviewId, findingId }: { reviewId: string; findingId?: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [input, setInput] = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    setComments(loadComments(reviewId))
  }, [reviewId])

  const filtered = findingId
    ? comments.filter(c => c.findingId === findingId)
    : comments.filter(c => !c.findingId)

  const handleAdd = () => {
    if (!input.trim()) return
    const comment: Comment = {
      id: crypto.randomUUID(),
      text: input.trim(),
      findingId,
      timestamp: new Date().toISOString(),
    }
    const updated = [...comments, comment]
    setComments(updated)
    saveComments(reviewId, updated)
    setInput('')
  }

  const handleDelete = (id: string) => {
    const updated = comments.filter(c => c.id !== id)
    setComments(updated)
    saveComments(reviewId, updated)
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setShowForm(s => !s)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {filtered.length > 0 ? `${filtered.length} comment${filtered.length > 1 ? 's' : ''}` : 'Add comment'}
      </button>

      {showForm && (
        <div className="space-y-2 pl-5">
          {filtered.map(c => (
            <div key={c.id} className="flex items-start gap-2 text-xs p-2 rounded bg-muted/50">
              <div className="flex-1">
                <p>{c.text}</p>
                <span className="text-muted-foreground">{new Date(c.timestamp).toLocaleString()}</span>
              </div>
              <button onClick={() => handleDelete(c.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              placeholder="Add a comment..."
              className="flex-1 px-2 py-1 text-xs border rounded bg-background"
            />
            <Button variant="ghost" size="sm" onClick={handleAdd} disabled={!input.trim()} className="h-7 px-2">
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
