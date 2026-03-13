import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const MAX_REQUESTS_PER_MINUTE = 3;

export async function POST(request: NextRequest) {
  // Rate limit by IP
  const ip = request.headers.get('x-forwarded-for') || 'anonymous';
  const rateLimitKey = `notify:${ip}`;
  const { allowed, remaining } = checkRateLimit(rateLimitKey);

  if (!allowed || remaining < (10 - MAX_REQUESTS_PER_MINUTE)) {
    logger.warn('Notification rate limit exceeded', { ip });
    return NextResponse.json(
      { error: 'Rate limit exceeded. Max 3 notifications per minute.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { webhookUrl, type, message } = body as {
      webhookUrl: string;
      type: 'slack' | 'teams' | 'webhook';
      message: object;
    };

    // Validate required fields
    if (!webhookUrl || !type || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: webhookUrl, type, message' },
        { status: 400 }
      );
    }

    // Validate webhook URL is HTTPS
    try {
      const url = new URL(webhookUrl);
      if (url.protocol !== 'https:') {
        return NextResponse.json(
          { error: 'Webhook URL must use HTTPS' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid webhook URL' },
        { status: 400 }
      );
    }

    // Validate type
    if (!['slack', 'teams', 'webhook'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be slack, teams, or webhook.' },
        { status: 400 }
      );
    }

    logger.info('Sending notification', { type, webhookUrl: webhookUrl.substring(0, 40) + '...' });

    // Send the notification
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Webhook delivery failed', {
        type,
        status: response.status,
        error: errorText.substring(0, 200),
      });
      return NextResponse.json(
        { error: `Webhook returned ${response.status}`, details: errorText.substring(0, 200) },
        { status: 502 }
      );
    }

    logger.info('Notification sent successfully', { type });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Notification error', { error: message });
    return NextResponse.json(
      { error: 'Failed to send notification', details: message },
      { status: 500 }
    );
  }
}
