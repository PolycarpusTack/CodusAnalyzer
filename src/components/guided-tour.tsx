'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

const TOUR_STEPS = [
  {
    target: '[data-tour="editor"]',
    title: 'Code Editor',
    content: 'Paste your code here, drag & drop files, or fetch from a GitHub URL.',
    position: 'bottom' as const,
  },
  {
    target: '[data-tour="presets"]',
    title: 'Review Presets',
    content: 'Choose a focus area: full review, security audit, performance, or maintainability.',
    position: 'top' as const,
  },
  {
    target: '[data-tour="review-btn"]',
    title: 'Start Review',
    content: 'Click here or press Ctrl+Enter to analyze your code.',
    position: 'top' as const,
  },
  {
    target: '[data-tour="tabs"]',
    title: 'Navigation',
    content: 'Switch between editor, results, history, comparisons, and the dashboard.',
    position: 'bottom' as const,
  },
]

const TOUR_KEY = 'codeanalyzer-tour-completed'

export function GuidedTour() {
  const [step, setStep] = useState(-1)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (localStorage.getItem(TOUR_KEY)) return
    const timer = setTimeout(() => setStep(0), 1000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (step < 0 || step >= TOUR_STEPS.length) return
    const el = document.querySelector(TOUR_STEPS[step].target)
    if (!el) { advance(); return }

    const rect = el.getBoundingClientRect()
    const stepDef = TOUR_STEPS[step]

    let top: number, left: number
    if (stepDef.position === 'bottom') {
      top = rect.bottom + 12
      left = rect.left + rect.width / 2
    } else {
      top = rect.top - 12
      left = rect.left + rect.width / 2
    }

    setPosition({ top, left })
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const advance = () => {
    if (step >= TOUR_STEPS.length - 1) {
      dismiss()
    } else {
      setStep(s => s + 1)
    }
  }

  const dismiss = () => {
    setStep(-1)
    localStorage.setItem(TOUR_KEY, 'true')
  }

  if (step < 0 || step >= TOUR_STEPS.length) return null

  const currentStep = TOUR_STEPS[step]

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[60]" onClick={dismiss} />
      <div
        className="fixed z-[61] w-72 bg-popover border rounded-lg shadow-lg p-4"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          transform: currentStep.position === 'bottom'
            ? 'translateX(-50%)'
            : 'translateX(-50%) translateY(-100%)',
        }}
      >
        <button
          onClick={dismiss}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">{currentStep.title}</h3>
          <p className="text-sm text-muted-foreground">{currentStep.content}</p>
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              {step + 1} of {TOUR_STEPS.length}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={dismiss}>
                Skip
              </Button>
              <Button size="sm" onClick={advance}>
                {step === TOUR_STEPS.length - 1 ? 'Done' : 'Next'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
