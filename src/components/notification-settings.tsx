'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  loadNotificationConfig,
  saveNotificationConfig,
  formatSlackMessage,
  formatTeamsMessage,
  type NotificationConfig,
  type ReviewResult,
} from '@/lib/notifications';

const SAMPLE_RESULT: ReviewResult = {
  summary: 'Test notification from AI Code Review. This is a sample review result to verify your webhook configuration.',
  qualityScore: 72,
  passed: false,
  counts: { critical: 1, error: 2, warning: 3, info: 1 },
  findingsCount: 7,
};

export function NotificationSettings() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [type, setType] = useState<NotificationConfig['type']>('slack');
  const [events, setEvents] = useState<NotificationConfig['events']>('all_failures');
  const [status, setStatus] = useState<'idle' | 'saving' | 'testing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const config = loadNotificationConfig();
    if (config) {
      setWebhookUrl(config.webhookUrl);
      setType(config.type);
      setEvents(config.events);
    }
  }, []);

  function handleSave() {
    if (!webhookUrl.trim()) {
      setStatus('error');
      setStatusMessage('Webhook URL is required.');
      return;
    }

    try {
      new URL(webhookUrl);
    } catch {
      setStatus('error');
      setStatusMessage('Invalid URL format.');
      return;
    }

    saveNotificationConfig({ type, webhookUrl: webhookUrl.trim(), events });
    setStatus('success');
    setStatusMessage('Configuration saved.');
    setTimeout(() => setStatus('idle'), 3000);
  }

  function handleClear() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('codeReviewAir_notificationConfig');
    }
    setWebhookUrl('');
    setType('slack');
    setEvents('all_failures');
    setStatus('success');
    setStatusMessage('Configuration cleared.');
    setTimeout(() => setStatus('idle'), 3000);
  }

  async function handleTest() {
    if (!webhookUrl.trim()) {
      setStatus('error');
      setStatusMessage('Enter a webhook URL first.');
      return;
    }

    setStatus('testing');
    setStatusMessage('Sending test notification...');

    try {
      const message =
        type === 'slack'
          ? formatSlackMessage(SAMPLE_RESULT)
          : type === 'teams'
            ? formatTeamsMessage(SAMPLE_RESULT)
            : SAMPLE_RESULT;

      const response = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: webhookUrl.trim(), type, message }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      setStatus('success');
      setStatusMessage('Test notification sent successfully!');
    } catch (err) {
      setStatus('error');
      setStatusMessage(err instanceof Error ? err.message : 'Failed to send test notification.');
    }

    setTimeout(() => setStatus('idle'), 5000);
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg">Notification Settings</CardTitle>
          <Badge variant="outline" className="text-xs font-normal">
            Mediagenix AIR
          </Badge>
        </div>
        <CardDescription>
          Configure webhook notifications for code review results. Supports Slack, Microsoft Teams, and generic webhooks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Type selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Notification Type</label>
          <Select value={type} onValueChange={(v) => setType(v as NotificationConfig['type'])}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="slack">Slack</SelectItem>
              <SelectItem value="teams">Microsoft Teams</SelectItem>
              <SelectItem value="webhook">Generic Webhook</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Webhook URL */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Webhook URL</label>
          <Input
            type="url"
            placeholder="https://hooks.slack.com/services/..."
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {type === 'slack' && 'Enter your Slack Incoming Webhook URL.'}
            {type === 'teams' && 'Enter your Microsoft Teams Incoming Webhook URL.'}
            {type === 'webhook' && 'Enter any HTTPS endpoint that accepts JSON POST requests.'}
          </p>
        </div>

        {/* Event filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Event Filter</label>
          <Select value={events} onValueChange={(v) => setEvents(v as NotificationConfig['events'])}>
            <SelectTrigger>
              <SelectValue placeholder="Select events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical_only">Critical findings only</SelectItem>
              <SelectItem value="all_failures">All failed reviews</SelectItem>
              <SelectItem value="all">All reviews</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status message */}
        {status !== 'idle' && (
          <div
            className={`text-sm px-3 py-2 rounded-md ${
              status === 'error'
                ? 'bg-destructive/10 text-destructive'
                : status === 'success'
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            {statusMessage}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={status === 'testing'}>
            Save
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={status === 'testing' || !webhookUrl.trim()}
          >
            {status === 'testing' ? 'Sending...' : 'Test'}
          </Button>
          <Button variant="ghost" onClick={handleClear} disabled={status === 'testing'}>
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
