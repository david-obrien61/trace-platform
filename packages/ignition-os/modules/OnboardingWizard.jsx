import React, { useState } from 'react';
import { supabase } from '../supabase';
import DataBridge from '../DataBridge';

const STEPS = ['WELCOME', 'SHOP', 'ACCOUNT', 'DONE'];

const INPUT = {
  width: '100%', boxSizing: 'border-box', padding: '12px 14px',
  background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
  color: '#f1f5f9', fontSize: '0.9375rem', fontFamily: 'inherit', outline: 'none',
};

const BTN_PRIMARY = {
  width: '100%', padding: '14px 20px', borderRadius: 10, border: 'none',
  background: '#22c55e', color: '#fff', fontWeight: 700, fontSize: '1rem',
  cursor: 'pointer', letterSpacing: '0.02em',
};

const BTN_GHOST = {
  background: 'none', border: 'none', color: '#64748b',
  fontSize: '0.875rem', cursor: 'pointer', padding: '8px 0',
};

export default function OnboardingWizard({ onComplete }) {
  const [step, setStep]   = useState('WELCOME');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [form, setForm]     = useState({
    shopName: '', phone: '', address: '',
    email: '', password: '', confirmPassword: '',
  });

  function f(key) {
    return e => setForm(prev => ({ ...prev, [key]: e.target.value }));
  }

  async function finalize() {
    if (!form.shopName.trim()) { setError('Shop name is required.'); return; }
    if (!form.email.trim())    { setError('Email is required.'); return; }
    if (!form.password)        { setError('Password is required.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }

    setSaving(true);
    setError('');

    try {
      // 1. Create owner Supabase auth account
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email:    form.email.trim().toLowerCase(),
        password: form.password,
      });
      if (authErr) throw new Error(authErr.message);
      const userId = authData.user?.id;
      if (!userId) throw new Error('Account created — check your email to confirm, then return to set up your shop.');

      // 2. Use a single shared UUID for businesses + shops (businesses.id = shops.id)
      const sharedId = crypto.randomUUID();

      // 3. Create businesses row (owner anchor)
      const { error: bizErr } = await supabase.from('businesses').insert({
        id:               sharedId,
        owner_id:         userId,
        name:             form.shopName.trim(),
        phone:            form.phone.trim()   || null,
        address:          form.address.trim() || null,
        email:            form.email.trim().toLowerCase(),
        business_type:    'shop',
        trial_started_at: new Date().toISOString(),
      });
      if (bizErr) throw new Error(`Could not create business record: ${bizErr.message}`);

      // 4. Create shops row (same ID — DataBridge queries shops by ID)
      const { error: shopErr } = await supabase.from('shops').insert({
        id:               sharedId,
        name:             form.shopName.trim(),
        phone:            form.phone.trim()   || null,
        address:          form.address.trim() || null,
        owner_id:         userId,
        tier:             'TRIAL',
        trial_started_at: new Date().toISOString(),
      });
      if (shopErr) throw new Error(`Could not create shop record: ${shopErr.message}`);

      // 5. Persist shop identity so DataBridge resolves on next render
      DataBridge.setShopId(sharedId);
      DataBridge.setShopName(form.shopName.trim());
      DataBridge.save('shop_policy', {
        ...(DataBridge.load('shop_policy') || {}),
        onboarding_complete: true,
      });

      setStep('DONE');
    } catch (e) {
      setError(e.message || 'Setup failed — please try again.');
    } finally {
      setSaving(false);
    }
  }

  const wrap = {
    minHeight: '100vh', background: '#020617', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: '24px 16px',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  };

  const card = {
    width: '100%', maxWidth: 420, background: '#0f172a', borderRadius: 16,
    padding: '32px 24px', border: '1px solid #1e293b',
  };

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
        <button style={BTN_PRIMARY} onClick={() => setStep('SHOP')}>Get started →</button>
      </div>
    </div>
  );

  if (step === 'SHOP') return (
    <div style={wrap}>
      <div style={card}>
        <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>Step 1 of 2 — Shop Info</p>
        <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#f1f5f9', marginBottom: 20 }}>Tell us about your shop</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 5 }}>Shop name *</label>
            <input style={INPUT} placeholder="Precision Auto & Diesel" value={form.shopName} onChange={f('shopName')} autoFocus />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 5 }}>Phone (optional)</label>
            <input style={INPUT} placeholder="(512) 555-0100" value={form.phone} onChange={f('phone')} type="tel" />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 5 }}>Address (optional)</label>
            <input style={INPUT} placeholder="123 Main St, Austin TX 78701" value={form.address} onChange={f('address')} />
          </div>
        </div>

        <button
          style={{ ...BTN_PRIMARY, background: form.shopName.trim() ? '#22c55e' : '#1e293b', color: form.shopName.trim() ? '#fff' : '#475569', cursor: form.shopName.trim() ? 'pointer' : 'default' }}
          disabled={!form.shopName.trim()}
          onClick={() => { setError(''); setStep('ACCOUNT'); }}
        >
          Continue →
        </button>
      </div>
    </div>
  );

  if (step === 'ACCOUNT') return (
    <div style={wrap}>
      <div style={card}>
        <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>Step 2 of 2 — Owner Account</p>
        <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#f1f5f9', marginBottom: 6 }}>Create your account</h2>
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: 20 }}>This is your owner login. Staff join separately via invite link.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 5 }}>Email *</label>
            <input style={INPUT} placeholder="owner@yourshop.com" value={form.email} onChange={f('email')} type="email" autoFocus />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 5 }}>Password *</label>
            <input style={INPUT} placeholder="At least 8 characters" value={form.password} onChange={f('password')} type="password" />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 5 }}>Confirm password *</label>
            <input style={INPUT} placeholder="Same password again" value={form.confirmPassword} onChange={f('confirmPassword')} type="password" />
          </div>
        </div>

        {error && <p style={{ fontSize: '0.875rem', color: '#f87171', marginBottom: 12 }}>{error}</p>}

        <button
          style={{ ...BTN_PRIMARY, background: saving ? '#1e293b' : '#22c55e', color: saving ? '#475569' : '#fff', cursor: saving ? 'default' : 'pointer' }}
          disabled={saving}
          onClick={finalize}
        >
          {saving ? 'Setting up…' : 'Launch Ignition OS →'}
        </button>

        <button style={{ ...BTN_GHOST, width: '100%', marginTop: 10 }} onClick={() => { setError(''); setStep('SHOP'); }}>← Back</button>
      </div>
    </div>
  );

  // DONE
  return (
    <div style={wrap}>
      <div style={{ ...card, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔥</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f1f5f9', marginBottom: 8 }}>You're in.</h2>
        <p style={{ fontSize: '0.9375rem', color: '#94a3b8', marginBottom: 8 }}><strong style={{ color: '#f1f5f9' }}>{form.shopName}</strong> is live on Ignition OS.</p>
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: 32 }}>Staff can join from any device using the invite link in Admin settings.</p>
        <button style={BTN_PRIMARY} onClick={onComplete}>Open Command Grid →</button>
      </div>
    </div>
  );
}
