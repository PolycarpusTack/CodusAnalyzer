export interface CalibrationEntry {
  ruleId: string
  originalSeverity: string
  userSeverity: string
  timestamp: number
}

const STORAGE_KEY = 'severity-calibrations'

export function loadCalibrations(): CalibrationEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as CalibrationEntry[]
  } catch {
    return []
  }
}

export function saveCalibration(entry: CalibrationEntry): void {
  const calibrations = loadCalibrations()
  const existingIndex = calibrations.findIndex((c) => c.ruleId === entry.ruleId)

  if (existingIndex !== -1) {
    calibrations[existingIndex] = entry
  } else {
    calibrations.push(entry)
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(calibrations))
}

export function getCalibratedSeverity(ruleId: string, originalSeverity: string): string {
  const calibrations = loadCalibrations()
  const match = calibrations.find((c) => c.ruleId === ruleId)
  return match ? match.userSeverity : originalSeverity
}

export function clearCalibrations(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
