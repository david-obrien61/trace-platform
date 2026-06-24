import React, { useState, useEffect } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { authenticate as pinAuthenticate } from '../supabase/auth';

export type VerticalId = string;

export interface AuthConfig {
  strategy: 'email' | 'pin';
  vertical: VerticalId;
  tenantTable: string;
  defaultRole: string;
  redirectAfterLogin: string;
}

export interface SessionUser {
  id: string;
  email?: string;
  role: string;
}

export interface UseSessionResult {
  session: unknown;
  user: SessionUser | null;
  role: string;
  isAuthenticated: boolean;
  loading: boolean;
}

export interface AuthObject {
  signIn: (firstArg: string, secondArg: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  useSession: () => UseSessionResult;
  PrivateRoute: () => React.JSX.Element | null;
  SignUp: () => React.JSX.Element | null;
}

function storageKeyFor(vertical: string): string {
  return `${vertical.toUpperCase().replace(/-/g, '_')}_DATA`;
}

export function configureAuth(config: AuthConfig): AuthObject {
  return config.strategy === 'email'
    ? buildEmailAuth(config)
    : buildPinAuth(config);
}

// ── Email strategy ─────────────────────────────────────────────────────────────

function buildEmailAuth(config: AuthConfig): AuthObject {
  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message };
  };

  const signOut = async (): Promise<void> => {
    await supabase.auth.signOut();
  };

  const useSession = (): UseSessionResult => {
    const [session, setSession] = useState<unknown>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      supabase.auth.getSession().then(({ data }) => {
        setSession(data.session);
        setLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
        setSession(s);
      });

      return () => subscription.unsubscribe();
    }, []);

    const raw = session as { user?: { id: string; email?: string } } | null;
    const user: SessionUser | null = raw?.user
      ? { id: raw.user.id, email: raw.user.email, role: config.defaultRole }
      : null;

    return { session, user, role: user?.role ?? config.defaultRole, isAuthenticated: !!session, loading };
  };

  const PrivateRoute = (): React.JSX.Element | null => {
    const { session, loading } = useSession();

    if (loading) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <div className="skeleton" style={{ width: 120, height: 20, borderRadius: 4 }} />
        </div>
      );
    }

    return session ? <Outlet /> : <Navigate to="/login" replace />;
  };

  const SignUp = (): React.JSX.Element | null => {
    const navigate = useNavigate();
    const [name, setName]         = useState('');
    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');
    const [error, setError]       = useState('');
    const [isLoading, setIsLoading]             = useState(false);
    const [confirmationPending, setConfirmPending] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      setError('');

      // PERSON NAME source of truth = auth.user_metadata.full_name — seed it from the
      // captured signup name (mirrors OwnerSignup) so the person displays, not the email.
      const { data, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (authErr) {
        setError(authErr.message);
        setIsLoading(false);
        return;
      }

      // Email confirmation may be required — session won't exist until confirmed
      if (!data.session) {
        setConfirmPending(true);
        setIsLoading(false);
        return;
      }

      // Insert tenant row — non-fatal if schema differs (e.g. nurseries already seeded)
      const { error: dbErr } = await supabase.from(config.tenantTable).insert({
        owner_id: data.user!.id,
        name,
        email,
        role: config.defaultRole,
      });
      if (dbErr) console.warn('[auth] tenant row insert failed:', dbErr.message);

      navigate(config.redirectAfterLogin);
    };

    if (confirmationPending) {
      return (
        <div className="page" style={{ justifyContent: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>📬</div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--green-primary)', marginBottom: 8 }}>
              Check your email
            </h1>
            <p style={{ color: 'var(--gray-600)', fontSize: '0.875rem' }}>
              We sent a confirmation link to <strong>{email}</strong>.
              Click it to activate your account.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="page" style={{ justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🌳</div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--green-primary)' }}>
            Create account
          </h1>
          <p style={{ color: 'var(--gray-600)', fontSize: '0.875rem' }}>
            Set up your owner login
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="text"
            placeholder="Nursery name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            style={inputStyle}
          />

          {error && (
            <p style={{ color: 'var(--red-border)', fontSize: '0.875rem', textAlign: 'center' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
            style={{ marginTop: 8 }}
          >
            {isLoading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.875rem', color: 'var(--gray-600)' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: 'var(--green-primary)', textDecoration: 'none', fontWeight: 600 }}>
            Sign in
          </a>
        </p>
      </div>
    );
  };

  return { signIn, signOut, useSession, PrivateRoute, SignUp };
}

// ── PIN strategy ───────────────────────────────────────────────────────────────

function buildPinAuth(config: AuthConfig): AuthObject {
  const storageKey = storageKeyFor(config.vertical);

  const signIn = async (pin: string, tenantId: string): Promise<{ error?: string }> => {
    const session = await pinAuthenticate(tenantId, pin);
    return { error: session ? undefined : 'Invalid PIN' };
  };

  const signOut = async (): Promise<void> => {
    if (typeof window === 'undefined') return;
    try {
      const store = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
      store.current_user = null;
      localStorage.setItem(storageKey, JSON.stringify(store));
    } catch { /* non-fatal */ }
  };

  const readUser = (): SessionUser | null => {
    if (typeof window === 'undefined') return null;
    try {
      const store = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
      return (store.current_user as SessionUser) ?? null;
    } catch {
      return null;
    }
  };

  const useSession = (): UseSessionResult => {
    const [user, setUser] = useState<SessionUser | null>(readUser);

    useEffect(() => {
      const onStorage = () => setUser(readUser());
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }, []);

    return {
      session: user,
      user,
      role: user?.role ?? config.defaultRole,
      isAuthenticated: !!user,
      loading: false,
    };
  };

  const PrivateRoute = (): React.JSX.Element | null => {
    const { user } = useSession();
    return user ? <Outlet /> : <Navigate to="/login" replace />;
  };

  // PIN strategy does not use email-based signup
  const SignUp = (): React.JSX.Element | null => null;

  return { signIn, signOut, useSession, PrivateRoute, SignUp };
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border: '1.5px solid var(--gray-200)',
  borderRadius: 8,
  fontSize: '1rem',
  fontFamily: 'inherit',
  outline: 'none',
};
