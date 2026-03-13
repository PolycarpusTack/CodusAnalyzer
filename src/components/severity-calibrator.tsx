'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { saveCalibration, getCalibratedSeverity } from '@/lib/severity-calibration'
import { useState } from 'react'

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical', color: '#F87171' },
  { value: 'error', label: 'Error', color: '#F59E0B' },
  { value: 'warning', label: 'Warning', color: '#F59E0B' },
  { value: 'info', label: 'Info', color: '#60A5FA' },
] as const

interface SeverityCalibratorProps {
  ruleId: string
  currentSeverity: string
  onCalibrate?: (newSeverity: string) => void
}

export function SeverityCalibrator({ ruleId, currentSeverity, onCalibrate }: SeverityCalibratorProps) {
  const [severity, setSeverity] = useState<string>(
    () => getCalibratedSeverity(ruleId, currentSeverity)
  )

  const isCalibrated = severity !== currentSeverity

  const handleChange = (newSeverity: string) => {
    setSeverity(newSeverity)
    saveCalibration({
      ruleId,
      originalSeverity: currentSeverity,
      userSeverity: newSeverity,
      timestamp: Date.now(),
    })
    onCalibrate?.(newSeverity)
  }

  const activeSeverity = SEVERITY_OPTIONS.find((s) => s.value === severity)

  return (
    <div className="inline-flex items-center gap-1.5">
      <Select value={severity} onValueChange={handleChange}>
        <SelectTrigger
          className="h-7 w-[110px] text-xs border-white/10"
          style={{ color: activeSeverity?.color }}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SEVERITY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span style={{ color: option.color }}>{option.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isCalibrated && (
        <Badge
          variant="outline"
          className="h-5 text-[10px] px-1.5 border-teal-500/30 text-teal-400"
        >
          calibrated
        </Badge>
      )}
    </div>
  )
}
