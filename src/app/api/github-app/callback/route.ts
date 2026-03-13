import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { githubFetch, generateAppJWT } from '@/lib/github-app';
import { logger } from '@/lib/logger';

/** GET /api/github-app/callback — OAuth callback after GitHub App installation. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const installationId = searchParams.get('installation_id');
  const setupAction = searchParams.get('setup_action');

  if (!installationId) {
    return NextResponse.json({ error: 'Missing installation_id' }, { status: 400 });
  }

  try {
    // Fetch installation details from GitHub
    const jwt = generateAppJWT();
    const res = await githubFetch(
      `https://api.github.com/app/installations/${installationId}`,
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch installation: ${res.status}`);
    }

    const data = await res.json();

    // Upsert installation
    const installation = await db.gitHubInstallation.upsert({
      where: { installationId: parseInt(installationId) },
      create: {
        installationId: parseInt(installationId),
        accountLogin: data.account.login,
        accountType: data.account.type,
      },
      update: {
        accountLogin: data.account.login,
        accountType: data.account.type,
      },
    });

    // Fetch and register repositories
    const reposRes = await githubFetch(
      `https://api.github.com/installation/repositories?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
    );

    if (reposRes.ok) {
      const reposData = await reposRes.json();
      for (const repo of reposData.repositories || []) {
        await db.gitHubRepository.upsert({
          where: { fullName: repo.full_name },
          create: {
            installationId: installation.id,
            owner: repo.owner.login,
            name: repo.name,
            fullName: repo.full_name,
          },
          update: { installationId: installation.id },
        });
      }
    }

    // Redirect to settings page
    return NextResponse.redirect(new URL('/?tab=github-settings', request.url));
  } catch (error) {
    logger.error('GitHub App callback error', { error: String(error) });
    return NextResponse.redirect(new URL('/?error=github-install-failed', request.url));
  }
}
