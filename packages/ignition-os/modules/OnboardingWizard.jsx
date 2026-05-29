import React, { useState } from 'react';
import { supabase } from '../supabase';
import DataBridge from '../DataBridge';

const INPUT = {
  width: '100%', boxSizing: 'border-box', padding: '12px 14px',
  background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
  color: '#f1f5f9', fontSize: '0.9375rem', fontFamily: 'inherit', outline: 'none',
};

const PIN_INPUT = {
  ...INPUT,
  fontSize: '1.5rem', letterSpacing: '0.4em', textAlign: 'center',
  fontWeight: 700,
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

async function hashPin(shopId, pin) {
  const raw = new TextEncoder().encode(`${shopId}:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', raw);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function OnboardingWizard({ onComplete }) {
  const [step, setStep]     = useState('WELCOME');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [form, setForm]     = useState({
    shopName: '', ownerName: '', phone: '', address: '',
    email: '', password: '', confirmPassword: '',
    pin: '', confirmPin: '',
  });

  function f(key) {
    return e => setForm(prev => ({ ...prev, [key]: e.target.value }));
  }

  function numericOnly(key) {
    return e => {
      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
      setForm(prev => ({ ...prev, [key]: val }));
    };
  }

  async function finalize() {
    if (form.pin.length < 4) { setError('PIN must be at least 4 digits.'); return; }
    if (form.pin !== form.confirmPin) { setError('PINs do not match.'); return; }

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

      // 2. Shared UUID for businesses + shops
      const sharedId = crypto.randomUUID();

      // 3. businesses row (owner anchor)
      const { error: bizErr } = await supabase.from('businesses').insert({
        id:               sharedId,
        owner_id:         userId,
        name:             form.shopName.trim(),
        phone:            form.phone.trim()     || null,
        address:          form.address.trim()   || null,
        email:            form.email.trim().toLowerCase(),
        business_type:    'shop',
        trial_started_at: new Date().toISOString(),
      });
      if (bizErr) throw new Error(`Could not create business record: ${bizErr.message}`);

      // 4. shops row (same ID — DataBridge queries shops by ID)
      const { error: shopErr } = await supabase.from('shops').insert({
        id:               sharedId,
        name:             form.shopName.trim(),
        phone:            form.phone.trim()     || null,
        address:          form.address.trim()   || null,
        owner_id:         userId,
        tier:             'TRIAL',
        trial_started_at: new Date().toISOString(),
      });
      if (shopErr) throw new Error(`Could not create shop record: ${shopErr.message}`);

      // 5. shop_members row — owner as ADMIN with hashed PIN
      const pinHash = await hashPin(sharedId, form.pin);
      const ownerName = form.ownerName.trim() || 'Owner';
      const { data: memberRow, error: memberErr } = await supabase.from('shop_members').insert({
        shop_id:     sharedId,
        name:        ownerName,
        role:        'ADMIN',
        pin_hash:    pinHash,
        active:      true,
        permissions: ['ADMIN', 'TECH', 'VIEW_ALL'],
      }).select().single();
      if (memberErr) throw new Error(`Could not create owner account: ${memberErr.message}`);

      // 6. Seed DataBridge — shop identity + current user session
      DataBridge.setShopId(sharedId);
      DataBridge.setShopName(form.shopName.trim());
      const session = {
        id:          memberRow.id,
        member_id:   memberRow.id,
        shop_id:     sharedId,
        name:        ownerName,
        role:        'ADMIN',
        permissions: ['ADMIN', 'TECH', 'VIEW_ALL'],
      };
      DataBridge.save('current_user', session);
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
        <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>Step 1 of 3 — Shop Info</p>
        <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#f1f5f9', marginBottom: 20 }}>Tell us about your shop</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 5 }}>Shop name *</label>
            <input style={INPUT} placeholder="Precision Auto & Diesel" value={form.shopName} onChange={f('shopName')} autoFocus />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 5 }}>Your name</label>
            <input style={INPUT} placeholder="David" value={form.ownerName} onChange={f('ownerName')} />
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
        <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>Step 2 of 3 — Owner Account</p>
        <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#f1f5f9', marginBottom: 6 }}>Create your account</h2>
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: 20 }}>Your login email and password. Staff join separately via invite link.</p>

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
          style={{ ...BTN_PRIMARY, background: (form.email.trim() && form.password && form.password === form.confirmPassword && form.password.length >= 8) ? '#22c55e' : '#1e293b', color: (form.email.trim() && form.password && form.password === form.confirmPassword && form.password.length >= 8) ? '#fff' : '#475569' }}
          disabled={!form.email.trim() || !form.password || form.password !== form.confirmPassword || form.password.length < 8}
          onClick={() => { setError(''); setStep('PIN'); }}
        >
          Continue →
        </button>
        <button style={{ ...BTN_GHOST, width: '100%', marginTop: 10 }} onClick={() => { setError(''); setStep('SHOP'); }}>← Back</button>
      </div>
    </div>
  );

  if (step === 'PIN') return (
    <div style={wrap}>
      <div style={card}>
        <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>Step 3 of 3 — Access PIN</p>
        <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#f1f5f9', marginBottom: 6 }}>Set your PIN</h2>
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: 24 }}>4–6 digits. You'll enter this every time you open Ignition OS.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 5 }}>PIN</label>
            <input style={PIN_INPUT} placeholder="••••" value={form.pin} onChange={numericOnly('pin')} type="password" inputMode="numeric" pattern="[0-9]*" autoFocus />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 5 }}>Confirm PIN</label>
            <input style={PIN_INPUT} placeholder="••••" value={form.confirmPin} onChange={numericOnly('confirmPin')} type="password" inputMode="numeric" pattern="[0-9]*" />
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
        <button style={{ ...BTN_GHOST, width: '100%', marginTop: 10 }} onClick={() => { setError(''); setStep('ACCOUNT'); }}>← Back</button>
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
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: 32 }}>Your PIN is set. Staff can join from any device using the invite link in Admin settings.</p>
        <button style={BTN_PRIMARY} onClick={onComplete}>Open Command Grid →</button>
      </div>
    </div>
  );
}
