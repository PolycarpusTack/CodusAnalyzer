import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { isSetupComplete, buildEnvContent, type SetupConfig } from '@/lib/setup';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

const ENV_PATH = join(process.cwd(), '.env');

/** GET /api/setup — Check if setup is needed. */
export async function GET() {
  return NextResponse.json({
    setupComplete: isSetupComplete(),
  });
}

/** POST /api/setup — Run first-time configuration. */
export async function POST(request: NextRequest) {
  // Block if already configured
  if (isSetupComplete()) {
    return NextResponse.json(
      { error: 'Setup has already been completed. To reconfigure, delete NEXTAUTH_SECRET from .env and restart.' },
      { status: 403 },
    );
  }

  try {
    const body: SetupConfig = await request.json();

    // Validate required fields
    if (!body.appUrl || !body.githubClientId || !body.githubClientSecret) {
      return NextResponse.json(
        { error: 'App URL, GitHub Client ID, and GitHub Client Secret are required.' },
        { status: 400 },
      );
    }

    if (!body.adminEmail) {
      return NextResponse.json(
        { error: 'Admin email is required.' },
        { status: 400 },
      );
    }

    // Normalize
    body.appUrl = body.appUrl.replace(/\/+$/, '');
    body.analysisBackends = body.analysisBackends || 'regex';

    // Write .env file
    const envContent = buildEnvContent(body);
    writeFileSync(ENV_PATH, envContent, 'utf-8');

    // Load the new values into the current process
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([A-Z_]+)="(.*)"/);
      if (match) {
        process.env[match[1]] = match[2];
      }
    }

    // Create admin user in database
    const adminUser = await db.user.upsert({
      where: { email: body.adminEmail },
      create: {
        email: body.adminEmail,
        name: body.adminName || 'Admin',
        role: 'ADMIN',
      },
      update: {
        role: 'ADMIN',
        name: body.adminName || undefined,
      },
    });

    logger.info('First-run setup completed', {
      adminEmail: body.adminEmail,
      appUrl: body.appUrl,
      backends: body.analysisBackends,
      githubAppConfigured: !!body.githubAppId,
    });

    return NextResponse.json({
      success: true,
      message: 'Setup complete! The server will need to be restarted for all changes to take effect.',
      adminUserId: adminUser.id,
      restartRequired: true,
    });
  } catch (error) {
    logger.error('Setup failed', { error: String(error) });
    return NextResponse.json(
      { error: `Setup failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}
