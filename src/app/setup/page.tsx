'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SetupState {
  // Step tracking
  step: number;

  // App config
  appUrl: string;

  // GitHub OAuth
  githubClientId: string;
  githubClientSecret: string;

  // GitHub App (optional)
  githubAppId: string;
  githubAppPrivateKey: string;
  githubAppWebhookSecret: string;
  githubAppSlug: string;
  githubAppClientId: string;
  githubAppClientSecret: string;

  // Analysis
  analysisBackends: string;

  // Admin
  adminEmail: string;
  adminName: string;
}

const STEPS = [
  { title: 'Welcome', description: 'First-time setup' },
  { title: 'Application', description: 'Basic app settings' },
  { title: 'GitHub OAuth', description: 'User authentication' },
  { title: 'GitHub App', description: 'PR auto-review (optional)' },
  { title: 'Analysis', description: 'Analysis backends' },
  { title: 'Admin', description: 'Admin account' },
  { title: 'Review', description: 'Confirm and apply' },
];

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [state, setState] = useState<SetupState>({
    step: 0,
    appUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
    githubClientId: '',
    githubClientSecret: '',
    githubAppId: '',
    githubAppPrivateKey: '',
    githubAppWebhookSecret: '',
    githubAppSlug: '',
    githubAppClientId: '',
    githubAppClientSecret: '',
    analysisBackends: 'regex',
    adminEmail: '',
    adminName: '',
  });

  useEffect(() => {
    fetch('/api/setup')
      .then(r => r.json())
      .then(data => {
        if (data.setupComplete) {
          router.replace('/');
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [router]);

  const update = (fields: Partial<SetupState>) => setState(prev => ({ ...prev, ...fields }));
  const next = () => update({ step: state.step + 1 });
  const prev = () => update({ step: state.step - 1 });

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appUrl: state.appUrl,
          githubClientId: state.githubClientId,
          githubClientSecret: state.githubClientSecret,
          githubAppId: state.githubAppId || undefined,
          githubAppPrivateKey: state.githubAppPrivateKey || undefined,
          githubAppWebhookSecret: state.githubAppWebhookSecret || undefined,
          githubAppSlug: state.githubAppSlug || undefined,
          githubAppClientId: state.githubAppClientId || undefined,
          githubAppClientSecret: state.githubAppClientSecret || undefined,
          analysisBackends: state.analysisBackends,
          adminEmail: state.adminEmail,
          adminName: state.adminName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Setup failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Checking setup status...</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md p-8 text-center space-y-4">
          <div className="text-4xl">&#10003;</div>
          <h1 className="text-2xl font-bold">Setup Complete!</h1>
          <p className="text-muted-foreground">
            Configuration has been saved to <code className="text-xs bg-muted/50 px-1 rounded">.env</code>.
            Restart the server for all changes to take effect.
          </p>
          <pre className="text-xs bg-muted/30 p-3 rounded text-left">
{`# Restart with:
npm run dev`}
          </pre>
          <p className="text-muted-foreground text-sm">
            After restart, sign in with GitHub using the admin email you provided.
            The first user matching <strong>{state.adminEmail}</strong> will be promoted to admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {STEPS.map((s, i) => (
              <div
                key={i}
                className={`text-xs ${i <= state.step ? 'text-foreground' : 'text-muted-foreground/40'}`}
              >
                {i + 1}
              </div>
            ))}
          </div>
          <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-foreground transition-all duration-300 rounded-full"
              style={{ width: `${(state.step / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>

        <div className="border border-border rounded-lg p-8 space-y-6">
          <div>
            <h1 className="text-xl font-bold">{STEPS[state.step].title}</h1>
            <p className="text-sm text-muted-foreground">{STEPS[state.step].description}</p>
          </div>

          {/* Step content */}
          {state.step === 0 && <StepWelcome />}
          {state.step === 1 && <StepApp state={state} update={update} />}
          {state.step === 2 && <StepGitHubOAuth state={state} update={update} />}
          {state.step === 3 && <StepGitHubApp state={state} update={update} />}
          {state.step === 4 && <StepAnalysis state={state} update={update} />}
          {state.step === 5 && <StepAdmin state={state} update={update} />}
          {state.step === 6 && <StepReview state={state} />}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <button
              onClick={prev}
              disabled={state.step === 0}
              className="px-4 py-2 rounded-md border border-border text-sm disabled:opacity-30"
            >
              Back
            </button>
            {state.step < STEPS.length - 1 ? (
              <button
                onClick={next}
                className="px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90"
              >
                Next
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={submitting || !state.githubClientId || !state.githubClientSecret || !state.adminEmail}
                className="px-6 py-2 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Complete Setup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step components ──────────────────────────────────────────────────────────

function StepWelcome() {
  return (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p>Welcome to CodeAnalyzer. This wizard will configure your instance.</p>
      <p>You'll need:</p>
      <ul className="list-disc list-inside space-y-1 ml-2">
        <li>A <strong>GitHub OAuth App</strong> for user login (required)</li>
        <li>A <strong>GitHub App</strong> for automatic PR reviews (optional)</li>
        <li>An email for the <strong>admin account</strong></li>
      </ul>
      <p>All settings are saved to <code className="text-xs bg-muted/50 px-1 rounded">.env</code> and can be changed later.</p>
    </div>
  );
}

function StepApp({ state, update }: { state: SetupState; update: (f: Partial<SetupState>) => void }) {
  return (
    <div className="space-y-4">
      <Field
        label="Application URL"
        value={state.appUrl}
        onChange={v => update({ appUrl: v })}
        placeholder="http://localhost:3000"
        help="The URL where CodeAnalyzer is hosted. Used for OAuth callbacks."
      />
    </div>
  );
}

function StepGitHubOAuth({ state, update }: { state: SetupState; update: (f: Partial<SetupState>) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Create a GitHub OAuth App at{' '}
        <code className="text-xs bg-muted/50 px-1 rounded">github.com/settings/developers</code>.
        Set the callback URL to <code className="text-xs bg-muted/50 px-1 rounded">{state.appUrl}/api/auth/callback/github</code>.
      </p>
      <Field
        label="Client ID"
        value={state.githubClientId}
        onChange={v => update({ githubClientId: v })}
        placeholder="Ov23li..."
        required
      />
      <Field
        label="Client Secret"
        value={state.githubClientSecret}
        onChange={v => update({ githubClientSecret: v })}
        placeholder="secret..."
        type="password"
        required
      />
    </div>
  );
}

function StepGitHubApp({ state, update }: { state: SetupState; update: (f: Partial<SetupState>) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Optional: Create a GitHub App for automatic PR reviews. Skip this step if you only need manual reviews.
      </p>
      <Field
        label="App ID"
        value={state.githubAppId}
        onChange={v => update({ githubAppId: v })}
        placeholder="123456"
      />
      <Field
        label="App Slug"
        value={state.githubAppSlug}
        onChange={v => update({ githubAppSlug: v })}
        placeholder="my-code-analyzer"
        help="The URL-friendly name of your GitHub App."
      />
      <Field
        label="Private Key (base64)"
        value={state.githubAppPrivateKey}
        onChange={v => update({ githubAppPrivateKey: v })}
        placeholder="base64-encoded PEM..."
        type="password"
        help="Base64-encode the .pem file: base64 -w0 < private-key.pem"
      />
      <Field
        label="Webhook Secret"
        value={state.githubAppWebhookSecret}
        onChange={v => update({ githubAppWebhookSecret: v })}
        placeholder="Leave blank to auto-generate"
        help="Leave empty to generate a random secret."
      />
    </div>
  );
}

function StepAnalysis({ state, update }: { state: SetupState; update: (f: Partial<SetupState>) => void }) {
  const backends = state.analysisBackends.split(',').map(s => s.trim());
  const toggle = (name: string) => {
    const current = new Set(backends.filter(Boolean));
    if (current.has(name)) current.delete(name);
    else current.add(name);
    if (current.size === 0) current.add('regex');
    update({ analysisBackends: Array.from(current).join(',') });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select which analysis backends to enable. Regex is always recommended as a fallback.
      </p>
      <div className="space-y-2">
        {[
          { id: 'regex', label: 'Regex Patterns', desc: 'Fast pattern matching. Always available.' },
          { id: 'treesitter', label: 'Tree-sitter AST', desc: 'Accurate AST parsing. Requires grammar WASM files.' },
          { id: 'eslint', label: 'ESLint', desc: 'In-process ESLint rules. JS/TS only.' },
        ].map(b => (
          <label key={b.id} className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/20">
            <input
              type="checkbox"
              checked={backends.includes(b.id)}
              onChange={() => toggle(b.id)}
              className="mt-0.5"
            />
            <div>
              <div className="text-sm font-medium">{b.label}</div>
              <div className="text-xs text-muted-foreground">{b.desc}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

function StepAdmin({ state, update }: { state: SetupState; update: (f: Partial<SetupState>) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        The first admin user. After setup, sign in with GitHub using this email to get admin access.
      </p>
      <Field
        label="Admin Email"
        value={state.adminEmail}
        onChange={v => update({ adminEmail: v })}
        placeholder="admin@example.com"
        type="email"
        required
      />
      <Field
        label="Admin Name"
        value={state.adminName}
        onChange={v => update({ adminName: v })}
        placeholder="Admin"
      />
    </div>
  );
}

function StepReview({ state }: { state: SetupState }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Review your configuration before applying.</p>
      <div className="bg-muted/20 rounded-lg p-4 space-y-2 text-sm font-mono">
        <Row label="App URL" value={state.appUrl} />
        <Row label="GitHub OAuth" value={state.githubClientId ? `${state.githubClientId.slice(0, 8)}...` : 'Not set'} ok={!!state.githubClientId} />
        <Row label="GitHub App" value={state.githubAppId || 'Skipped'} ok={!!state.githubAppId} optional />
        <Row label="Backends" value={state.analysisBackends} />
        <Row label="Admin" value={state.adminEmail} ok={!!state.adminEmail} />
        <Row label="NEXTAUTH_SECRET" value="(auto-generated)" />
      </div>
    </div>
  );
}

// ── Shared components ────────────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, type = 'text', help, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; help?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-md border border-input bg-transparent text-sm"
      />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

function Row({ label, value, ok, optional }: { label: string; value: string; ok?: boolean; optional?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={ok === false && !optional ? 'text-destructive' : ''}>
        {value}
      </span>
    </div>
  );
}
