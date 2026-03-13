// ---------------------------------------------------------------------------
// Next.js middleware — route protection, setup redirect, API key validation
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/api/auth',         // NextAuth routes
  '/login',            // Login page
  '/setup',            // First-run setup wizard
  '/api/setup',        // Setup API
  '/api/github-app/webhook', // GitHub App webhooks (verified by HMAC)
];

// API routes that accept anonymous access (with IP rate limiting)
const ANONYMOUS_API_PATHS = [
  '/api/review',       // Keep review API accessible for unauthenticated usage
  '/api/github',       // GitHub file fetching
  '/api/webhook',      // Legacy webhook
  '/api/notify',       // Notifications
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Static assets and Next.js internals: always pass through ---
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // --- First-run setup redirect ---
  // If NEXTAUTH_SECRET is not set, the app hasn't been configured yet.
  // Redirect everything except /setup and /api/setup to the setup wizard.
  const isConfigured = !!process.env.NEXTAUTH_SECRET;
  if (!isConfigured) {
    if (pathname === '/setup' || pathname === '/api/setup') {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/setup', request.url));
  }

  // --- Public routes: pass through ---
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // --- API routes with Bearer token (API key auth) ---
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const apiKey = authHeader.slice(7);

    if (apiKey.startsWith('ca_live_')) {
      // API key authentication — validated in the route handler
      // We pass the key along via a header so routes can validate it
      const response = NextResponse.next();
      response.headers.set('x-api-key', apiKey);
      return response;
    }
  }

  // --- Session-based auth (JWT from NextAuth) ---
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (token) {
    // Authenticated session — pass through with user info
    const response = NextResponse.next();
    response.headers.set('x-user-id', token.userId as string || '');
    response.headers.set('x-user-role', token.role as string || 'USER');
    return response;
  }

  // --- Anonymous API access (allowed routes with rate limiting) ---
  if (ANONYMOUS_API_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // --- Unauthenticated web page access: redirect to login ---
  if (!pathname.startsWith('/api')) {
    // Allow the main page without auth (it's the app landing page)
    if (pathname === '/') {
      return NextResponse.next();
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // --- Unauthenticated API access to protected routes ---
  return NextResponse.json(
    { error: 'Authentication required' },
    { status: 401 }
  );
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
