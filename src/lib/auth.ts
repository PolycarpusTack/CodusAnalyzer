// ---------------------------------------------------------------------------
// NextAuth.js configuration — GitHub OAuth + JWT strategy
// ---------------------------------------------------------------------------

import type { NextAuthOptions } from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import GithubProvider from 'next-auth/providers/github';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from '@/lib/db';
import crypto from 'crypto';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as Adapter,
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      profile(profile) {
        // Auto-promote to ADMIN if this email matches the ADMIN_EMAIL from setup
        const adminEmail = process.env.ADMIN_EMAIL;
        const isAdmin = adminEmail && profile.email && profile.email.toLowerCase() === adminEmail.toLowerCase();

        return {
          id: String(profile.id),
          name: profile.name || profile.login,
          email: profile.email,
          image: profile.avatar_url,
          githubId: String(profile.id),
          role: isAdmin ? 'ADMIN' : 'USER',
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // If ADMIN_EMAIL matches, ensure the DB record has ADMIN role
      // (handles the case where setup pre-created the user before first OAuth login)
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail && user.email && user.email.toLowerCase() === adminEmail.toLowerCase()) {
        try {
          await db.user.updateMany({
            where: { email: { equals: user.email } },
            data: { role: 'ADMIN' },
          });
        } catch {
          // Non-fatal — user may not exist yet (PrismaAdapter will create it)
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.userId = user.id;
        token.role = (user as { role?: string }).role || 'USER';

        // Re-check admin status from DB to pick up setup-seeded role
        if (user.email) {
          try {
            const dbUser = await db.user.findUnique({ where: { email: user.email } });
            if (dbUser?.role === 'ADMIN') {
              token.role = 'ADMIN';
            }
          } catch {
            // Non-fatal
          }
        }
      }
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.userId as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};

// ── API Key utilities ──────────────────────────────────────────────────────

const API_KEY_PREFIX = 'ca_live_';

/** Generate a new API key. Returns { plaintext, hash, prefix }. */
export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const random = crypto.randomBytes(32).toString('base64url');
  const plaintext = `${API_KEY_PREFIX}${random}`;
  const hash = crypto.createHash('sha256').update(plaintext).digest('hex');
  const prefix = plaintext.slice(0, 16);
  return { plaintext, hash, prefix };
}

/** Hash an API key for lookup. */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/** Validate an API key and return the associated user, or null. */
export async function validateApiKey(key: string) {
  const keyHash = hashApiKey(key);
  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    include: { user: true },
  });

  if (!apiKey) return null;

  // Check expiration
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  // Update last used timestamp (fire and forget)
  db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  return {
    user: apiKey.user,
    apiKeyId: apiKey.id,
    rateLimit: apiKey.rateLimit,
  };
}
