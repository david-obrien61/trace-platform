// PURPOSE:      Agnostic RESET-SCREEN (D-31 PIN-reset spine). A member opens the owner-issued link
//               (/reset-pin?m={memberId}); if not signed in they sign in (email/password — the real
//               auth boundary per the locked auth rule), then set a new PIN for their own membership
//               and are rerouted to login to use it. Mirrors AcceptInvite's shape. NO Vercel
//               function — validate/set run client-side under bm_self_select / bm_self_update.
// DEPENDENCIES: pinReset (loadOwnMemberships/setOwnPin) · a supabase client + the vertical's signIn.
//               SMS-coded-link delivery is STUBBED (disabled) — David-action to provision Twilio.
// OUTPUTS:      <ResetPin/> — each vertical mounts it at /reset-pin, supplying supabase + signIn +
//               navigate (+ optional theme). Agnostic: no vertical nouns, colors are props.

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadOwnMemberships, setOwnPin } from '../../auth/pinReset';
import type { OwnMembership } from '../../auth/pinReset';

interface Props {
  supabase: SupabaseClient;
  /** The vertical's sign-in (same one AcceptInvite uses). */
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  navigate?: (to: string) => void;
  /** Where to send the member after the PIN is set (their login screen). Default '/login'. */
  redirectTo?: string;
  pinLength?: number;
  primary?: string;
  bg?: string;
}

type Phase = 'loading' | 'signin' | 'form' | 'done' | 'error';

export function ResetPin({
  supabase, signIn, navigate,
  redirectTo = '/login', pinLength = 4,
  primary = '#27500A', bg = '#EAF3DE',
}: Props) {
  const red = '#A32D2D';
  const targetMemberId = new URLSearchParams(window.location.search).get('m') ?? '';

  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [membership, setMembership] = useState<OwnMembership | null>(null);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);

  // Resolve the signed-in user → their membership to reset (?m hint, else first armed, else first).
  async function resolveMembership(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPhase('signin'); return; }
    try {
      const mine = await loadOwnMemberships(supabase, user.id);
      if (mine.length === 0) {
        setErrorMsg('This account has no membership to reset a PIN for.');
        setPhase('error');
        return;
      }
      const pick =
        (targetMemberId && mine.find((m) => m.id === targetMemberId)) ||
        mine.find((m) => m.pin_armed) ||
        mine[0];
      setMembership(pick);
      console.log('[TRACE:PINRESET] reset screen ready', {
        memberId: pick.id, businessId: pick.business_id, armed: pick.pin_armed, hintMatched: pick.id === targetMemberId,
      });
      setPhase('form');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not load your membership.');
      setPhase('error');
    }
  }

  useEffect(() => { void resolveMembership(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErrorMsg('');
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) { setErrorMsg(error); return; }
    setPhase('loading');
    await resolveMembership();
  }

  async function handleSetPin(e: React.FormEvent) {
    e.preventDefault();
    if (!membership) return;
    const val = pin.trim();
    if (val.length !== pinLength || !/^\d+$/.test(val)) { setErrorMsg(`PIN must be ${pinLength} digits.`); return; }
    if (val !== confirmPin.trim()) { setErrorMsg('PINs do not match.'); return; }
    setBusy(true); setErrorMsg('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPhase('signin'); setBusy(false); return; }
      await setOwnPin(supabase, membership.id, membership.business_id, user.id, val);
      console.log('[TRACE:PINRESET] set new PIN', { memberId: membership.id, businessId: membership.business_id });
      setPhase('done');
      setTimeout(() => { if (navigate) navigate(redirectTo); else window.location.href = redirectTo; }, 1400);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not set your PIN.');
      setBusy(false);
    }
  }

  const wrap: React.CSSProperties = { minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 };
  const card: React.CSSProperties = { background: '#fff', borderRadius: 18, padding: 28, maxWidth: 420, width: '100%', boxShadow: '0 6px 24px rgba(0,0,0,0.08)' };
  const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid #D8E2C8', borderRadius: 10, fontSize: 16, outline: 'none', marginBottom: 12 };
  const btn: React.CSSProperties = { width: '100%', background: primary, color: '#fff', fontWeight: 800, padding: '13px', borderRadius: 11, border: 'none', fontSize: 15, cursor: 'pointer' };
  const h = (t: string) => <h1 style={{ color: primary, fontSize: 22, fontWeight: 800, margin: '0 0 6px' }}>{t}</h1>;

  return (
    <div style={wrap}>
      <div style={card}>
        {phase === 'loading' && <p style={{ color: primary }}>Loading…</p>}

        {phase === 'signin' && (
          <form onSubmit={(e) => { void handleSignIn(e); }}>
            {h('Reset your PIN')}
            <p style={{ color: '#5B6B47', fontSize: 14, margin: '0 0 18px' }}>Sign in first — your PIN is a daily unlock on your account.</p>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={input} autoComplete="email" />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={input} autoComplete="current-password" />
            {errorMsg && <p style={{ color: red, fontSize: 13, margin: '0 0 12px' }}>{errorMsg}</p>}
            <button type="submit" disabled={busy} style={{ ...btn, opacity: busy ? 0.5 : 1 }}>{busy ? 'Signing in…' : 'Continue'}</button>
          </form>
        )}

        {phase === 'form' && membership && (
          <form onSubmit={(e) => { void handleSetPin(e); }}>
            {h('Set a new PIN')}
            <p style={{ color: '#5B6B47', fontSize: 14, margin: '0 0 18px' }}>
              For <strong>{membership.name}</strong>{membership.business_name ? <> at <strong>{membership.business_name}</strong></> : null}. Your PIN unlocks the dashboard each day.
            </p>
            <input inputMode="numeric" pattern={`\\d{${pinLength}}`} maxLength={pinLength} placeholder={`${pinLength}-digit PIN`} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} style={input} />
            <input inputMode="numeric" pattern={`\\d{${pinLength}}`} maxLength={pinLength} placeholder="Confirm PIN" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))} style={input} />
            {errorMsg && <p style={{ color: red, fontSize: 13, margin: '0 0 12px' }}>{errorMsg}</p>}
            <button type="submit" disabled={busy} style={{ ...btn, opacity: busy ? 0.5 : 1 }}>{busy ? 'Saving…' : 'Set PIN'}</button>
          </form>
        )}

        {phase === 'done' && (
          <div>
            {h('PIN updated ✓')}
            <p style={{ color: '#5B6B47', fontSize: 14 }}>Taking you to login — sign in with your new PIN.</p>
          </div>
        )}

        {phase === 'error' && (
          <div>
            {h('Reset unavailable')}
            <p style={{ color: red, fontSize: 14 }}>{errorMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}
