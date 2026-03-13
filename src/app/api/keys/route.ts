import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { generateApiKey } from '@/lib/auth';

/** GET /api/keys — List API keys for the authenticated user. */
export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const keys = await db.apiKey.findMany({
    where: { userId: token.userId as string },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      rateLimit: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ keys });
}

/** POST /api/keys — Create a new API key. Returns the plaintext key ONCE. */
export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json();
  const { name, rateLimit: customRateLimit, expiresInDays } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  // Limit number of keys per user
  const existingCount = await db.apiKey.count({
    where: { userId: token.userId as string },
  });
  if (existingCount >= 10) {
    return NextResponse.json({ error: 'Maximum of 10 API keys allowed' }, { status: 400 });
  }

  const { plaintext, hash, prefix } = generateApiKey();

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const apiKey = await db.apiKey.create({
    data: {
      name: name.trim(),
      keyHash: hash,
      keyPrefix: prefix,
      userId: token.userId as string,
      rateLimit: customRateLimit || 60,
      expiresAt,
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      rateLimit: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    ...apiKey,
    key: plaintext, // Only returned once at creation time
  }, { status: 201 });
}
