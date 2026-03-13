import { NextResponse } from 'next/server';

/** GET /api/github-app/install — Redirect to GitHub App installation page. */
export async function GET() {
  const appSlug = process.env.GITHUB_APP_SLUG;
  if (!appSlug) {
    return NextResponse.json({ error: 'GITHUB_APP_SLUG not configured' }, { status: 500 });
  }

  const installUrl = `https://github.com/apps/${appSlug}/installations/new`;
  return NextResponse.redirect(installUrl);
}
