import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';

/** DELETE /api/keys/[id] — Revoke an API key. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id } = await params;

  // Ensure the key belongs to the user
  const apiKey = await db.apiKey.findUnique({ where: { id } });
  if (!apiKey || apiKey.userId !== token.userId) {
    return NextResponse.json({ error: 'API key not found' }, { status: 404 });
  }

  await db.apiKey.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
