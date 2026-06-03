import React, { useState } from 'react';
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

const ignitionSignupConfig = {
  businessLabel:    'shop',
  businessType:     'shop',
  logo:             '⚡',
  primaryColor:     '#22c55e',
  backgroundColor:  '#020617',
  cardColor:        '#0f172a',
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
};

export default function OnboardingWizard({ onComplete }) {
  const [step,         setStep]         = useState('WELCOME');
  const [doneShopName, setDoneShopName] = useState('');
  // shopName is set from the URL when OwnerSignup onSuccess fires
  const [pendingShopName, setPendingShopName] = useState('');

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
          if (path === '/') setStep('WELCOME');
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
