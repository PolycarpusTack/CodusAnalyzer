'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';

interface ApiKeyInfo {
  id: string;
  name: string;
  keyPrefix: string;
  rateLimit: number;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function ApiKeysPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [expiresIn, setExpiresIn] = useState('never');
  const [rateLimit, setRateLimit] = useState('60');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    const res = await fetch('/api/keys');
    if (res.ok) {
      const data = await res.json();
      setKeys(data.keys);
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/settings/keys');
      return;
    }
    if (status === 'authenticated') {
      fetchKeys();
    }
  }, [status, router, fetchKeys]);

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName.trim(),
          expiresInDays: expiresIn !== 'never' ? parseInt(expiresIn) : undefined,
          rateLimit: parseInt(rateLimit),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewKey(data.key);
        setNewKeyName('');
        fetchKeys();
        toast.success('API key created');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to create key');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    await fetch(`/api/keys/${id}`, { method: 'DELETE' });
    fetchKeys();
    toast.success('API key revoked');
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create and manage API keys for programmatic access to CodeAnalyzer.
          </p>
        </div>

        <div className="border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">Create New Key</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. CI Pipeline)"
              className="flex-1 px-3 py-2 rounded-md border border-input bg-transparent text-sm"
              onKeyDown={(e) => e.key === 'Enter' && createKey()}
            />
            <button
              onClick={createKey}
              disabled={loading || !newKeyName.trim()}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              Create
            </button>
          </div>
          <div className="flex gap-3">
            <select
              value={expiresIn}
              onChange={e => setExpiresIn(e.target.value)}
              className="px-3 py-2 text-sm border rounded-md bg-background"
            >
              <option value="never">No expiration</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
            </select>
            <select
              value={rateLimit}
              onChange={e => setRateLimit(e.target.value)}
              className="px-3 py-2 text-sm border rounded-md bg-background"
            >
              <option value="30">30 req/min</option>
              <option value="60">60 req/min (default)</option>
              <option value="120">120 req/min</option>
            </select>
          </div>

          {newKey && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-green-400">
                Key created! Copy it now — it won't be shown again.
              </p>
              <code className="block text-xs bg-background/50 p-2 rounded font-mono break-all select-all">
                {newKey}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(newKey);
                  toast.success('Key copied to clipboard');
                  setNewKey(null);
                }}
                className="text-xs text-green-400 hover:underline"
              >
                Copy & dismiss
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Active Keys</h2>
          {keys.length === 0 ? (
            <p className="text-muted-foreground text-sm">No API keys yet.</p>
          ) : (
            <div className="space-y-2">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between border border-border rounded-lg p-4"
                >
                  <div className="space-y-1">
                    <div className="font-medium text-sm">{key.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {key.keyPrefix}...
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Rate limit: {key.rateLimit}/min
                      {key.expiresAt && ` · Expires: ${new Date(key.expiresAt).toLocaleDateString()}`}
                      {key.lastUsedAt && ` · Last used: ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                    </div>
                  </div>
                  <button
                    onClick={() => setRevokeKeyId(key.id)}
                    className="px-3 py-1.5 rounded-md border border-destructive/30 text-destructive text-xs hover:bg-destructive/10"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border border-border rounded-lg p-6 space-y-3">
          <h2 className="text-lg font-semibold">Usage</h2>
          <pre className="text-xs bg-muted/30 p-3 rounded-md overflow-x-auto font-mono">
{`curl -X POST ${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/review \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"code": "const x = eval(input)", "language": "javascript"}'`}
          </pre>
        </div>
      </div>

      <ConfirmDialog
        open={!!revokeKeyId}
        onOpenChange={(open) => !open && setRevokeKeyId(null)}
        title="Revoke API key?"
        description="This key will immediately stop working. Any applications using it will lose access."
        confirmLabel="Revoke"
        onConfirm={() => { handleRevoke(revokeKeyId!); setRevokeKeyId(null) }}
      />
    </div>
  );
}
