interface WebhookConfig {
  url: string
  events: string[]
  enabled: boolean
}

interface ReviewPayload {
  fileName?: string
  language: string
  qualityScore: number
  passed: boolean
  findingsCount: number
  summary: string
}

export function getWebhookConfig(): WebhookConfig | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem('webhook-config')
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export function saveWebhookConfig(config: WebhookConfig) {
  localStorage.setItem('webhook-config', JSON.stringify(config))
}

export async function sendWebhookNotification(payload: ReviewPayload): Promise<boolean> {
  const config = getWebhookConfig()
  if (!config?.enabled || !config.url) return false
  if (!config.events.includes('review.completed')) return false

  try {
    const score = Math.round(payload.qualityScore * 10) / 10

    const body = {
      text: `${payload.passed ? '\u2705' : '\u274C'} Code Review: ${payload.fileName || 'untitled'} \u2014 Score: ${score}/100 (${payload.findingsCount} findings)`,
      content: `${payload.passed ? '\u2705' : '\u274C'} **Code Review:** ${payload.fileName || 'untitled'} \u2014 Score: ${score}/100 (${payload.findingsCount} findings)`,
      embeds: [{
        title: `Code Review: ${payload.fileName || 'untitled'}`,
        color: payload.passed ? 0x22c55e : 0xef4444,
        fields: [
          { name: 'Score', value: `${score}/100`, inline: true },
          { name: 'Status', value: payload.passed ? 'Passed' : 'Failed', inline: true },
          { name: 'Findings', value: String(payload.findingsCount), inline: true },
          { name: 'Language', value: payload.language, inline: true },
        ],
        description: payload.summary.substring(0, 200),
      }],
    }

    await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return true
  } catch {
    return false
  }
}
