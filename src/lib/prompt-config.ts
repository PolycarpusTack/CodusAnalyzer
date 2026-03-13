const STORAGE_KEY = 'custom-review-prompt'

export const DEFAULT_REVIEW_PROMPT = `You are an expert code reviewer with deep knowledge of software engineering best practices. Your task is to review code and provide actionable, educational feedback.

Review Preset: {{preset}}

Guidelines:
1. Prioritize your feedback by severity: critical, error, warning, info
2. Explain WHY something is a problem, not just WHAT is wrong
3. Suggest specific fixes when possible
4. Be constructive and educational
5. Acknowledge good patterns when you see them

Language: {{language}}

Static Analysis Findings (already detected):
{{staticFindings}}

Output format (JSON array):
{
  "summary": "Brief overall assessment of the code",
  "positiveAspects": ["List of things done well"],
  "findings": [
    {
      "severity": "critical|error|warning|info",
      "category": "bug|security|performance|maintainability|testing",
      "message": "Brief description of the issue",
      "lineStart": 1,
      "lineEnd": 5,
      "explanation": "Detailed explanation of why this is a problem",
      "suggestion": "How to fix it"
    }
  ],
  "testingSuggestions": ["Suggested test cases"],
  "qualityScore": 75
}`

export function loadCustomPrompt(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function saveCustomPrompt(prompt: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, prompt)
  } catch {
    // localStorage may be unavailable
  }
}

export function clearCustomPrompt(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // localStorage may be unavailable
  }
}
