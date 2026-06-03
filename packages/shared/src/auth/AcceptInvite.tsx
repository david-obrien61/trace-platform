import React, { useEffect, useState } from 'react';

// AcceptInvite — shared React component for email-based invite acceptance.
//
// HOW IT WORKS:
//   1. Reads ?token= from current URL search params.
//   2. Calls GET {apiBase}/api/members/preview-invite?token={token}
//      to validate the token and get the business name (unauthenticated).
//   3. Shows a "Join {Business Name}" form: email + password.
//      If ?email= is pre-populated in the URL, it pre-fills the field.
//   4. On submit: calls POST {apiBase}/api/members/accept-invite
//      Body: { token, email, password }
//   5. On success: signs the new user in, redirects to onRedirectTo.
//
// PROPS:
//   apiBase        — base URL for Vercel API functions (usually '' in same-origin Vercel deployments)
//   onRedirectTo   — the path to navigate to after successful acceptance
//   supabaseSignIn — the vertical's signIn function (email, password) → { error? }
//                    Pass the auth.signIn from configureAuth({ strategy: 'email' })
//
// VERTICAL INTEGRATION:
//   - Add a route at the path your invite links point to (e.g. /join or /accept)
//   - Render <AcceptInvite apiBase="" onRedirectTo="/dashboard" supabaseSignIn={auth.signIn} />
//   - Create two Vercel functions:
//       GET  api/members/preview-invite.ts  (calls previewInvitation from shared)
//       POST api/members/accept-invite.ts   (calls acceptInvitation from shared)
//   - See packages/shared/auth/README.md for the full API contract.

interface Props {
  apiBase?: string;
  onRedirectTo: string;
  supabaseSignIn: (email: string, password: string) => Promise<{ error?: string }>;
  navigate?: (to: string) => void; // provide react-router's navigate; falls back to window.location
}

type Phase =
  | 'loading'    // checking token
  | 'form'       // valid token, show email+password form
  | 'submitting' // POST in flight
  | 'done'       // success, about to redirect
  | 'error';     // invalid/expired token or server error

const green = '#27500A';
const bg    = '#EAF3DE';
const red   = '#A32D2D';

export function AcceptInvite({ apiBase = '', onRedirectTo, supabaseSignIn, navigate }: Props) {
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const prefilledEmail = new URLSearchParams(window.location.search).get('email') ?? '';

  const [phase, setPhase]             = useState<Phase>(token ? 'loading' : 'error');
  const [preview, setPreview]         = useState<{ businessName: string; invitedName: string; role: string } | null>(null);
  const [errorMsg, setErrorMsg]       = useState('');
  const [email, setEmail]             = useState(prefilledEmail);
  const [password, setPassword]       = useState('');
  const [confirmPw, setConfirmPw]     = useState('');

  useEffect(() => {
    if (!token) {
      setErrorMsg('No invite token found in this URL.');
      setPhase('error');
      return;
    }

    fetch(`${apiBase}/api/members/preview-invite?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then((data: { valid: boolean; businessName?: string; invitedName?: string; role?: string; reason?: string }) => {
        if (!data.valid) {
          const msg =
            data.reason === 'used'    ? 'This invite link has already been used.' :
            data.reason === 'expired' ? 'This invite link has expired (links are valid for 7 days). Ask the owner to send a new one.' :
            'This invite link is invalid.';
          setErrorMsg(msg);
          setPhase('error');
        } else {
          setPreview({
            businessName: data.businessName!,
            invitedName: data.invitedName!,
            role: data.role!,
          });
          setPhase('form');
        }
      })
      .catch(() => {
        setErrorMsg('Could not reach the server. Check your connection and try again.');
        setPhase('error');
      });
  }, [token, apiBase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (password !== confirmPw) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setPhase('submitting');

    try {
      const res = await fetch(`${apiBase}/api/members/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg =
          data.error === 'INVALID_TOKEN'  ? 'This invite link is invalid or has already been used.' :
          data.error === 'AUTH_CREATE_FAILED' ? 'Could not create your account. Try a different email.' :
          data.error ?? 'Something went wrong. Please try again.';
        setErrorMsg(msg);
        setPhase('form');
        return;
      }

      // Sign in with the newly created (or existing) account
      const { error: signInErr } = await supabaseSignIn(email, password);
      if (signInErr) {
        // Account was created but sign-in failed — unlikely, but tell them to try logging in manually
        setErrorMsg(`Account created! Sign in at the login page: ${signInErr}`);
        setPhase('done');
        return;
      }

      setPhase('done');
      setTimeout(() => {
        if (navigate) {
          navigate(onRedirectTo);
        } else {
          window.location.href = onRedirectTo;
        }
      }, 1500);
    } catch {
      setErrorMsg('Network error. Check your connection and try again.');
      setPhase('form');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: 32,
        width: '100%',
        maxWidth: 400,
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}>

        {/* Loading */}
        {phase === 'loading' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
            <p style={{ color: green, fontWeight: 700, fontSize: '1rem' }}>Checking your invite…</p>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: red, marginBottom: 12 }}>
              Invite not valid
            </h1>
            <p style={{ color: '#555', fontSize: '0.9rem', lineHeight: 1.5 }}>{errorMsg}</p>
          </div>
        )}

        {/* Form */}
        {(phase === 'form' || phase === 'submitting') && preview && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🤝</div>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: green, marginBottom: 4 }}>
                Join {preview.businessName}
              </h1>
              <p style={{ color: '#666', fontSize: '0.85rem' }}>
                You've been invited as <strong>{preview.role}</strong>.
                Create your account to get started.
              </p>
              {preview.invitedName && (
                <p style={{
                  marginTop: 8,
                  fontSize: '0.8rem',
                  color: green,
                  background: bg,
                  padding: '4px 12px',
                  borderRadius: 20,
                  display: 'inline-block',
                }}>
                  Invite for: {preview.invitedName}
                </p>
              )}
            </div>

            <label style={labelStyle}>
              Email
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={phase === 'submitting'}
                placeholder="you@example.com"
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Password
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={phase === 'submitting'}
                placeholder="At least 6 characters"
                minLength={6}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Confirm password
              <input
                type="password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                required
                disabled={phase === 'submitting'}
                placeholder="Same password again"
                style={inputStyle}
              />
            </label>

            {errorMsg && (
              <p style={{ color: red, fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={phase === 'submitting'}
              style={{
                background: green,
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '14px 0',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: phase === 'submitting' ? 'not-allowed' : 'pointer',
                opacity: phase === 'submitting' ? 0.7 : 1,
                minHeight: 48,
                width: '100%',
                marginTop: 4,
              }}
            >
              {phase === 'submitting' ? 'Creating account…' : 'Join team'}
            </button>
          </form>
        )}

        {/* Done */}
        {phase === 'done' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: green, marginBottom: 8 }}>
              You're in!
            </h1>
            <p style={{ color: '#555', fontSize: '0.9rem' }}>Taking you to your dashboard…</p>
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#333',
};

const inputStyle: React.CSSProperties = {
  padding: '12px 14px',
  border: '1.5px solid #ddd',
  borderRadius: 8,
  fontSize: '1rem',
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};
