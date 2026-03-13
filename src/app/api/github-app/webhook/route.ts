import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/webhook-verify';
import { logger } from '@/lib/logger';
import { handlePRReview } from '@/lib/github-pr-review';
import { db } from '@/lib/db';

// Deduplication: track processed delivery IDs
const processedDeliveries = new Set<string>();
const MAX_DELIVERY_CACHE = 1000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-hub-signature-256') || '';
    const event = request.headers.get('x-github-event') || '';
    const deliveryId = request.headers.get('x-github-delivery') || '';

    // Verify webhook signature
    const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;
    if (secret && !verifyWebhookSignature(body, signature, secret)) {
      logger.warn('Invalid webhook signature', { deliveryId });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Deduplicate
    if (deliveryId && processedDeliveries.has(deliveryId)) {
      return NextResponse.json({ status: 'duplicate' });
    }
    if (deliveryId) {
      processedDeliveries.add(deliveryId);
      // Trim cache
      if (processedDeliveries.size > MAX_DELIVERY_CACHE) {
        const first = processedDeliveries.values().next().value;
        if (first) processedDeliveries.delete(first);
      }
    }

    const payload = JSON.parse(body);

    // Route events
    switch (event) {
      case 'pull_request':
        await handlePullRequestEvent(payload);
        break;

      case 'installation':
        await handleInstallationEvent(payload);
        break;

      case 'installation_repositories':
        await handleInstallationReposEvent(payload);
        break;

      default:
        logger.info('Unhandled webhook event', { event });
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    logger.error('Webhook handler error', { error: String(error) });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function handlePullRequestEvent(payload: {
  action: string;
  pull_request: {
    number: number;
    head: { sha: string };
  };
  repository: {
    owner: { login: string };
    name: string;
    full_name: string;
  };
  installation?: { id: number };
}) {
  const { action, pull_request, repository, installation } = payload;

  // Only review on opened or synchronized (new commits pushed)
  if (action !== 'opened' && action !== 'synchronize') return;

  if (!installation?.id) {
    logger.warn('PR webhook missing installation ID');
    return;
  }

  // Check if this repo has auto-review enabled
  const repo = await db.gitHubRepository.findUnique({
    where: { fullName: repository.full_name },
  });

  if (!repo?.autoReview || !repo?.reviewEnabled) {
    logger.info('Auto-review disabled for repo', { repo: repository.full_name });
    return;
  }

  // Fire and forget — the review runs asynchronously
  handlePRReview({
    installationId: installation.id,
    owner: repository.owner.login,
    repo: repository.name,
    prNumber: pull_request.number,
    headSha: pull_request.head.sha,
    repositoryId: repo.id,
    preset: repo.reviewPreset as 'full' | 'security' | 'performance' | 'maintainability',
    maxComments: repo.maxComments,
    minSeverity: repo.minSeverity,
  }).catch(err => {
    logger.error('PR review failed', { error: String(err), pr: pull_request.number });
  });
}

async function handleInstallationEvent(payload: {
  action: string;
  installation: {
    id: number;
    account: { login: string; type: string };
  };
  repositories?: Array<{ full_name: string; name: string }>;
}) {
  const { action, installation: inst, repositories } = payload;

  if (action === 'created') {
    // New installation
    const installation = await db.gitHubInstallation.upsert({
      where: { installationId: inst.id },
      create: {
        installationId: inst.id,
        accountLogin: inst.account.login,
        accountType: inst.account.type,
      },
      update: {
        accountLogin: inst.account.login,
        accountType: inst.account.type,
      },
    });

    // Register repositories
    if (repositories) {
      for (const repo of repositories) {
        const [owner, name] = repo.full_name.split('/');
        await db.gitHubRepository.upsert({
          where: { fullName: repo.full_name },
          create: {
            installationId: installation.id,
            owner,
            name,
            fullName: repo.full_name,
          },
          update: { installationId: installation.id },
        });
      }
    }
  } else if (action === 'deleted') {
    await db.gitHubInstallation.deleteMany({
      where: { installationId: inst.id },
    });
  }
}

async function handleInstallationReposEvent(payload: {
  action: string;
  installation: { id: number };
  repositories_added?: Array<{ full_name: string; name: string }>;
  repositories_removed?: Array<{ full_name: string }>;
}) {
  const { installation: inst, repositories_added, repositories_removed } = payload;

  const installation = await db.gitHubInstallation.findUnique({
    where: { installationId: inst.id },
  });

  if (!installation) return;

  if (repositories_added) {
    for (const repo of repositories_added) {
      const [owner, name] = repo.full_name.split('/');
      await db.gitHubRepository.upsert({
        where: { fullName: repo.full_name },
        create: {
          installationId: installation.id,
          owner,
          name,
          fullName: repo.full_name,
        },
        update: {},
      });
    }
  }

  if (repositories_removed) {
    for (const repo of repositories_removed) {
      await db.gitHubRepository.deleteMany({
        where: { fullName: repo.full_name },
      });
    }
  }
}
