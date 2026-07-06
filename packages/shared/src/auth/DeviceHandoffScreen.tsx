import React, { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

// DeviceHandoff — shared new-device landing page for self-device-handoff via QR (D-31).
//
// HOW IT WORKS (the new, session-less device):
//   1. Reads ?token= from the URL (the QR the authenticated member generated).
//   2. Reads/creates this device's stable `device_fingerprint` (same localStorage key the
//      device spine uses), so the consumed handoff + the enrolled member_devices row agree.
//   3. POSTs { action:'handoff-exchange', token, deviceFingerprint, deviceLabel } to the
//      members endpoint — the server validates + single-use-consumes + device-binds + mints
//      a passwordless magic-link token + enrolls the device, returning { tokenHash }.
//   4. Calls supabase.auth.verifyOtp({ token_hash, type:'magiclink' }) → a REAL session AS the
//      member. No typing. Redirects into the app.
//
// PROPS mirror AcceptInvite (apiBase / onRedirectTo / navigate) + the supabase client (needed
// for verifyOtp — the session is established client-side). Agnostic: no vertical nouns.

interface Props {
  supabase: SupabaseClient;
  apiBase?: string;
  onRedirectTo: string;
  navigate?: (to: string) => void;
}

type Phase = 'loading' | 'done' | 'error';

const green = '#27500A';
const bg    = '#EAF3DE';
const red   = '#A32D2D';

function getOrCreateFingerprint(): string {
  try {
    let fp = localStorage.getItem('device_fingerprint');
    if (!fp) { fp = crypto.randomUUID(); localStorage.setItem('device_fingerprint', fp); }
    return fp;
  } catch {
    return crypto.randomUUID();
  }
}

function deviceLabel(): string {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  return ua.includes('iPhone') ? 'iPhone'
    : ua.includes('iPad')    ? 'iPad'
    : ua.includes('Android') ? 'Android Device'
    : ua.includes('Mac')     ? 'Mac'
    : 'Browser';
}

export function DeviceHandoff({ supabase, apiBase = '', onRedirectTo, navigate }: Props) {
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [phase, setPhase]       = useState<Phase>(token ? 'loading' : 'error');
  const [errorMsg, setErrorMsg] = useState(token ? '' : 'No handoff token found in this link.');
  const ran = useRef(false);   // exchange is single-use — never fire twice (StrictMode/double-mount)

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;

    void (async () => {
      try {
        const res = await fetch(`${apiBase}/api/members/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'handoff-exchange',
            token,
            deviceFingerprint: getOrCreateFingerprint(),
            deviceLabel: deviceLabel(),
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          const msg =
            data.error === 'USED'          ? 'This device link has already been used. Generate a new one from your other device.' :
            data.error === 'EXPIRED'       ? 'This device link has expired (links last ~15 minutes). Generate a new one.' :
            data.error === 'INVALID_TOKEN' ? 'This device link is not valid.' :
            'Could not add this device. Please try again.';
          console.log('[TRACE:HANDOFF] refuse', { reason: data.error });
          setErrorMsg(msg);
          setPhase('error');
          return;
        }

        // Establish the real session AS the member — passwordless.
        const { error: otpErr } = await supabase.auth.verifyOtp({
          token_hash: data.tokenHash,
          type: 'magiclink',
        });
        if (otpErr) {
          console.log('[TRACE:HANDOFF] verifyOtp failed', { error: otpErr.message });
          setErrorMsg('Could not sign this device in. Please try again.');
          setPhase('error');
          return;
        }

        console.log('[TRACE:HANDOFF] scan ok — session established', { businessId: data.businessId, memberId: data.memberId });
        setPhase('done');
        setTimeout(() => {
          if (navigate) navigate(onRedirectTo);
          else window.location.href = onRedirectTo;
        }, 1200);
      } catch {
        setErrorMsg('Could not reach the server. Check your connection and try again.');
        setPhase('error');
      }
    })();
  }, [token, apiBase, supabase, onRedirectTo, navigate]);

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 400, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', textAlign: 'center' }}>
        {phase === 'loading' && (
          <div style={{ padding: '40px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>📲</div>
            <p style={{ color: green, fontWeight: 700, fontSize: '1rem' }}>Adding this device…</p>
          </div>
        )}
        {phase === 'done' && (
          <div style={{ padding: '40px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: green, marginBottom: 8 }}>You're in!</h1>
            <p style={{ color: '#555', fontSize: '0.9rem' }}>This device is now signed in. Taking you in…</p>
          </div>
        )}
        {phase === 'error' && (
          <div style={{ padding: '24px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: red, marginBottom: 12 }}>Couldn't add this device</h1>
            <p style={{ color: '#555', fontSize: '0.9rem', lineHeight: 1.5 }}>{errorMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}
