import React, { useState, useEffect } from 'react';
import { OwnerSignup } from '@trace/shared/auth';
import { supabase }    from '../supabase';
import DataBridge      from '../DataBridge';

const BTN_PRIMARY = {
  width: '100%', padding: '14px 20px', borderRadius: 10, border: 'none',
  background: '#22c55e', color: '#fff', fontWeight: 700, fontSize: '1rem',
  cursor: 'pointer', letterSpacing: '0.02em',
};

const wrap = {
  minHeight: '100vh', background: '#020617', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', padding: '24px 16px',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
};

const card = {
  width: '100%', maxWidth: 420, background: '#0f172a', borderRadius: 16,
  padding: '32px 24px', border: '1px solid #1e293b',
};

// onSuccess callback creates the Ignition-specific shops row (same UUID as businesses.id)
// and seeds DataBridge with the owner session — then sets step to DONE.
async function createIgnitionShopAndSeedDataBridge(businessId, memberId, shopName, setDoneShopName, setStep) {
  try {
    // Query the member row to get name + role + permissions for DataBridge session
    const { data: member } = await supabase
      .from('shop_members')
      .select('name, role, permissions')
      .eq('id', memberId)
      .maybeSingle();

    // Query businesses row to get email + phone + address for shops table
    const { data: biz } = await supabase
      .from('businesses')
      .select('name, email, phone, address, owner_id, trial_started_at')
      .eq('id', businessId)
      .maybeSingle();

    // Create matching shops row (same UUID — DataBridge queries shops by ID)
    await supabase.from('shops').insert({
      id:               businessId,
      name:             shopName || biz?.name || '',
      phone:            biz?.phone  || null,
      address:          biz?.address || null,
      owner_id:         biz?.owner_id || null,
      tier:             'TRIAL',
      trial_started_at: biz?.trial_started_at || new Date().toISOString(),
    });

    // Seed DataBridge — shop identity
    DataBridge.setShopId(businessId);
    DataBridge.setShopName(shopName || biz?.name || '');

    // Seed current_user session
    const session = {
      id:          memberId,
      member_id:   memberId,
      shop_id:     businessId,
      name:        member?.name  || 'Owner',
      role:        member?.role  || 'ADMIN',
      permissions: member?.permissions || ['ADMIN', 'TECH', 'VIEW_ALL'],
    };
    DataBridge.save('current_user', session);
    DataBridge.save('shop_policy', {
      ...(DataBridge.load('shop_policy') || {}),
      onboarding_complete: true,
    });

    setDoneShopName(shopName || biz?.name || 'your shop');
    setStep('DONE');
  } catch {
    // Non-fatal — shops row creation failure should not block the wizard
    setDoneShopName(shopName || 'your shop');
    setStep('DONE');
  }
}

const AUTH_DEBUG = true; // [AUTH-TRACE] gate — set false after diagnosis

const ignitionSignupConfig = {
  businessLabel:    'shop',
  businessType:     'shop',
  logo:             '⚡',
  primaryColor:     '#22c55e',
  backgroundColor:  '#020617',
  cardColor:        '#0f172a',
  darkMode:         true,
  pinLength:        4,
  memberTable:      'shop_members',
  memberFKColumn:   'shop_id',
  ownerRole:        'ADMIN',
  ownerPermissions: ['ADMIN', 'TECH', 'VIEW_ALL'],
  signInPath:       '/',
  collectPhone:     true,
  collectAddress:   true,
  collectWebsite:   false,
  examples: {
    businessName: "e.g. Dave's Auto Shop",
    address:      '123 Commerce Dr, Austin TX',
  },
  debugAuth:        AUTH_DEBUG,
};

// Returning-owner sign-in. Built local to Ignition — should be extracted to
// packages/shared/src/auth/ before a second vertical needs this flow.
const SignInScreen = ({ onBack }) => {
  const [email,    setEmail]    = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading,  setLoading]  = React.useState(false);
  const [error,    setError]    = React.useState('');

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Email and password are required.'); return; }
    setLoading(true);
    setError('');
    if (AUTH_DEBUG) console.log('[AUTH-TRACE] SignInScreen: attempting signInWithPassword', { email: email.trim() });

    const { data, error: authErr } = await supabase.auth.signInWithPassword({
      email:    email.trim(),
      password,
    });

    if (authErr || !data?.user) {
      if (AUTH_DEBUG) console.log('[AUTH-TRACE] SignInScreen: FAILED', { error: authErr?.message });
      setError(authErr?.message ?? 'Sign-in failed — check your email and password.');
      setLoading(false);
      return;
    }

    if (AUTH_DEBUG) console.log('[AUTH-TRACE] SignInScreen: auth SUCCESS — verifying shop business…', { userId: data.user.id });

    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', data.user.id)
      .eq('business_type', 'shop')
      .maybeSingle();

    if (!biz) {
      if (AUTH_DEBUG) console.log('[AUTH-TRACE] SignInScreen: no shop found — signing out');
      await supabase.auth.signOut();
      setError('No shop found for this account. Use "Get started →" to create a new one.');
      setLoading(false);
      return;
    }

    if (AUTH_DEBUG) console.log('[AUTH-TRACE] SignInScreen: shop found', biz.id, '— waiting for OWNER SYNC to exit wizard');
    // Stay loading — BusinessProvider.onAuthStateChange → resolve() → owner lookup →
    // OWNER SYNC in CoreApp → setOnboardingDone(true) → wizard unmounts automatically.
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <p style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>IGNITION OS</p>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f1f5f9', marginBottom: 8, lineHeight: 1.2 }}>Welcome back</h2>
        <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: 28, lineHeight: 1.6 }}>
          Sign in with the email and password you used when setting up your shop.
        </p>
        <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>
            Email
            <input
              type="email" value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              placeholder="you@example.com" required autoComplete="email"
              style={{ padding: '12px 14px', border: '1.5px solid #334155', borderRadius: 8, fontSize: '1rem', fontFamily: 'inherit', outline: 'none', background: '#1e293b', color: '#f1f5f9', boxSizing: 'border-box', width: '100%' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>
            Password
            <input
              type="password" value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Your password" required autoComplete="current-password"
              style={{ padding: '12px 14px', border: '1.5px solid #334155', borderRadius: 8, fontSize: '1rem', fontFamily: 'inherit', outline: 'none', background: '#1e293b', color: '#f1f5f9', boxSizing: 'border-box', width: '100%' }}
            />
          </label>
          {error && (
            <p style={{ color: '#f87171', fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>{error}</p>
          )}
          <button
            type="submit" disabled={loading}
            style={{ ...BTN_PRIMARY, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>
          <button
            type="button" onClick={onBack}
            style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', cursor: 'pointer', padding: '8px 0', fontFamily: 'inherit', width: '100%', textAlign: 'center' }}
          >
            ← New to Ignition OS? Get started
          </button>
        </form>
      </div>
    </div>
  );
};

export default function OnboardingWizard({ onComplete }) {
  const [step,         setStep]         = useState('WELCOME');
  const [doneShopName, setDoneShopName] = useState('');
  // shopName is set from the URL when OwnerSignup onSuccess fires
  const [pendingShopName, setPendingShopName] = useState('');

  // [AUTH-TRACE] mount + step-change probes
  useEffect(() => {
    if (AUTH_DEBUG) console.log('[AUTH-TRACE] OnboardingWizard MOUNTED, initial step:', step);
    return () => {
      if (AUTH_DEBUG) console.log('[AUTH-TRACE] OnboardingWizard UNMOUNTED');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (AUTH_DEBUG) console.log('[AUTH-TRACE] OnboardingWizard step →', step);
  }, [step]);

  const config = {
    ...ignitionSignupConfig,
    onSuccess: async (businessId, memberId) => {
      await createIgnitionShopAndSeedDataBridge(
        businessId,
        memberId,
        pendingShopName,
        setDoneShopName,
        setStep,
      );
    },
  };

  if (step === 'SIGNIN') return (
    <SignInScreen onBack={() => setStep('WELCOME')} />
  );

  if (step === 'WELCOME') return (
    <div style={wrap}>
      <div style={card}>
        <p style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>IGNITION OS</p>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#f1f5f9', marginBottom: 8, lineHeight: 1.2 }}>
          Your shop.<br />Your command center.
        </h1>
        <p style={{ fontSize: '0.9375rem', color: '#94a3b8', marginBottom: 32, lineHeight: 1.6 }}>
          Ignition OS replaces the whiteboard, the clipboard, and the group text. Let's get your shop set up.
        </p>
        <button style={BTN_PRIMARY} onClick={() => setStep('SIGNUP')}>Get started →</button>
      </div>
    </div>
  );

  if (step === 'SIGNUP') {
    // Full-screen takeover by shared OwnerSignup.
    // OwnerSignup captures businessName in Step 0; we intercept it in onSuccess
    // via pendingShopName state (set when the user types it — we need a way to get it).
    // Solution: use a closure that captures the businessName at form-submit time.
    // OwnerSignup exposes no direct event for "businessName entered" so we query businesses
    // table in createIgnitionShopAndSeedDataBridge() for name fallback.
    return (
      <OwnerSignup
        config={config}
        navigate={(path) => {
          if (AUTH_DEBUG) console.log('[AUTH-TRACE] navigate() prop received →', {
            path,
            wizardStep: step,
            action: path === '/' ? 'setStep(SIGNIN)' : 'no-op (unhandled path)',
          });
          if (path === '/') setStep('SIGNIN');
        }}
      />
    );
  }

  // DONE
  return (
    <div style={wrap}>
      <div style={{ ...card, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔥</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f1f5f9', marginBottom: 8 }}>You're in.</h2>
        <p style={{ fontSize: '0.9375rem', color: '#94a3b8', marginBottom: 8 }}>
          <strong style={{ color: '#f1f5f9' }}>{doneShopName}</strong> is live on Ignition OS.
        </p>
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: 32 }}>
          Your PIN is set. Staff can join from any device using the invite link in Admin settings.
        </p>
        <button style={BTN_PRIMARY} onClick={onComplete}>Open Command Grid →</button>
      </div>
    </div>
  );
}
