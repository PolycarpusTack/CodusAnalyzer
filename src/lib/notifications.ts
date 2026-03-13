export interface ReviewResult {
  summary: string;
  qualityScore: number;
  passed: boolean;
  counts: {
    critical: number;
    error: number;
    warning: number;
    info: number;
  };
  findingsCount: number;
}

export interface NotificationConfig {
  type: 'slack' | 'teams' | 'webhook';
  webhookUrl: string;
  events: 'critical_only' | 'all_failures' | 'all';
}

const STORAGE_KEY = 'codeReviewAir_notificationConfig';

export function loadNotificationConfig(): NotificationConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as NotificationConfig;
  } catch {
    return null;
  }
}

export function saveNotificationConfig(config: NotificationConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function scoreEmoji(score: number): string {
  if (score >= 90) return ':white_check_mark:';
  if (score >= 70) return ':warning:';
  return ':x:';
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return '#dc2626';
    case 'error': return '#ef4444';
    case 'warning': return '#f59e0b';
    case 'info': return '#3b82f6';
    default: return '#6b7280';
  }
}

export function formatSlackMessage(result: ReviewResult): object {
  const statusText = result.passed ? ':white_check_mark: Review Passed' : ':x: Review Failed';
  const scoreText = `${scoreEmoji(result.qualityScore)} Quality Score: *${result.qualityScore}/100*`;

  const countsLine = [
    result.counts.critical > 0 ? `:red_circle: ${result.counts.critical} Critical` : null,
    result.counts.error > 0 ? `:large_orange_circle: ${result.counts.error} Error` : null,
    result.counts.warning > 0 ? `:large_yellow_circle: ${result.counts.warning} Warning` : null,
    result.counts.info > 0 ? `:large_blue_circle: ${result.counts.info} Info` : null,
  ]
    .filter(Boolean)
    .join('  |  ');

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'AI Code Review Report',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${statusText}\n${scoreText}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: countsLine || '_No findings_',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Summary:* ${result.summary}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `${result.findingsCount} total findings | Powered by Mediagenix AIR`,
          },
        ],
      },
    ],
  };
}

export function formatTeamsMessage(result: ReviewResult): object {
  const statusText = result.passed ? 'Review Passed' : 'Review Failed';
  const statusColor = result.passed ? 'good' : 'attention';

  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              text: 'AI Code Review Report',
              size: 'Large',
              weight: 'Bolder',
            },
            {
              type: 'TextBlock',
              text: statusText,
              color: statusColor,
              weight: 'Bolder',
              size: 'Medium',
            },
            {
              type: 'FactSet',
              facts: [
                { title: 'Quality Score', value: `${result.qualityScore}/100` },
                { title: 'Critical', value: `${result.counts.critical}` },
                { title: 'Errors', value: `${result.counts.error}` },
                { title: 'Warnings', value: `${result.counts.warning}` },
                { title: 'Info', value: `${result.counts.info}` },
                { title: 'Total Findings', value: `${result.findingsCount}` },
              ],
            },
            {
              type: 'TextBlock',
              text: result.summary,
              wrap: true,
            },
            {
              type: 'TextBlock',
              text: 'Powered by Mediagenix AIR',
              size: 'Small',
              isSubtle: true,
            },
          ],
        },
      },
    ],
  };
}
