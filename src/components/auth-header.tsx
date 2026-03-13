'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link';

export function AuthHeader() {
  const { data: session, status } = useSession();

  if (status === 'loading') return null;

  return (
    <div className="fixed top-0 right-0 z-50 p-3 flex items-center gap-3">
      {session?.user ? (
        <>
          <Link
            href="/settings/keys"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            API Keys
          </Link>
          <div className="flex items-center gap-2">
            {session.user.image && (
              <img
                src={session.user.image}
                alt=""
                className="w-6 h-6 rounded-full"
              />
            )}
            <span className="text-xs text-muted-foreground">
              {session.user.name}
            </span>
          </div>
          <button
            onClick={() => signOut()}
            className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </>
      ) : (
        <button
          onClick={() => signIn('github')}
          className="text-xs px-3 py-1.5 rounded bg-foreground text-background font-medium hover:opacity-90 transition-opacity"
        >
          Sign in
        </button>
      )}
    </div>
  );
}
