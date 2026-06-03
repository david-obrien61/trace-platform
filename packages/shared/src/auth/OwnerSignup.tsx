import React, { useState } from 'react';
import { supabase } from '../supabase/client';
import { hashPin } from '../supabase/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VerticalStepProps {
  businessId: string;
  memberId: string;
  onNext: () => void;
  onError: (msg: string) => void;
}

export interface VerticalStep {
  label: string;
  render: (props: VerticalStepProps) => React.ReactNode;
}

export interface OwnerSignupConfig {
  businessLabel: string;         // "nursery" | "shop" | "org" — shown in copy
  businessType: string;          // stored in businesses.business_type
  logo?: string;                  // emoji or image URL shown at top
  primaryColor?: string;          // defaults to TRACE green
  backgroundColor?: string;       // defaults to Cultivar sage (#EAF3DE)
  cardColor?: string;             // defaults to white (#fff)
  pinLength?: number;             // defaults to 4
  memberTable: 'business_members' | 'shop_members';
  memberFKColumn: 'business_id' | 'shop_id';
  ownerRole: string;              // 'OWNER' | 'ADMIN' etc.
  ownerPermissions: string[];
  signInPath: string;             // '/login' — shown in already-registered error
  collectPhone?: boolean;         // default true
  collectAddress?: boolean;       // default true
  collectWebsite?: boolean;       // default true
  examples?: {
    businessName?: string;        // placeholder for business name input
    address?: string;             // placeholder for address input
  };
  verticalSteps?: VerticalStep[]; // optional steps after biometric
  onSuccess: (businessId: string, memberId: string) => void;
}

// ── Step IDs ─────────────────────────────────────────────────────────────────

type StepId = 'OWNER_INFO' | 'PIN_SETUP' | 'BIOMETRIC' | `VERTICAL_${number}`;

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_GREEN = '#27500A';
const BG            = '#EAF3DE';
const RED           = '#A32D2D';

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  config: OwnerSignupConfig;
  navigate?: (to: string) => void;
}

interface SubmittedData {
  businessId: string;
  memberId: string;
}

export function OwnerSignup({ config, navigate }: Props) {
  const {
    businessLabel,
    businessType,
    logo = '🏢',
    primaryColor = DEFAULT_GREEN,
    backgroundColor = BG,
    cardColor = '#fff',
    pinLength = 4,
    memberTable,
    memberFKColumn,
    ownerRole,
    ownerPermissions,
    signInPath,
    collectPhone  = true,
    collectAddress = true,
    collectWebsite = true,
    examples = {},
    verticalSteps = [],
    onSuccess,
  } = config;

  // ── Step 0: Owner Info fields
  const [businessName, setBusinessName] = useState('');
  const [ownerName,    setOwnerName]    = useState('');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [confirmPw,    setConfirmPw]    = useState('');
  const [phone,        setPhone]        = useState('');
  const [address,      setAddress]      = useState('');
  const [website,      setWebsite]      = useState('');

  // ── Step 1: PIN fields
  const [pin,        setPin]        = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // ── Multi-step state
  const [step,          setStep]          = useState<StepId>('OWNER_INFO');
  const [submitting,    setSubmitting]    = useState(false);
  const [errorMsg,      setErrorMsg]      = useState('');
  const [submitted,     setSubmitted]     = useState<SubmittedData | null>(null);
  const [biometricDone, setBiometricDone] = useState(false);

  const green = primaryColor;

  // ── Navigation helpers ────────────────────────────────────────────────────

  function goTo(s: StepId) {
    setErrorMsg('');
    setStep(s);
  }

  function navTo(path: string) {
    if (navigate) navigate(path);
    else window.location.href = path;
  }

  // ── Step 0 → 1: validate Owner Info and advance ───────────────────────────

  function handleOwnerInfoNext(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    if (!businessName.trim()) { setErrorMsg('Business name is required.'); return; }
    if (!ownerName.trim())    { setErrorMsg('Your name is required.'); return; }
    if (!email.trim())        { setErrorMsg('Email is required.'); return; }
    if (password.length < 6)  { setErrorMsg('Password must be at least 6 characters.'); return; }
    if (password !== confirmPw) { setErrorMsg('Passwords do not match.'); return; }
    goTo('PIN_SETUP');
  }

  // ── Step 1: submit (create account + businesses + member) ─────────────────

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');

    const pinVal = pin.trim();
    if (pinVal.length !== pinLength || !/^\d+$/.test(pinVal)) {
      setErrorMsg(`PIN must be ${pinLength} digits.`);
      return;
    }
    if (pinVal !== confirmPin.trim()) {
      setErrorMsg('PINs do not match.');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Create Supabase auth user (or recover orphaned one)
      let userId: string;

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        const msg = signUpError.message ?? '';
        if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already been registered')) {
          // Orphaned account (prior partial signup) — try to sign in
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (signInError || !signInData.user) {
            setErrorMsg(
              `This email is already registered. If you started signing up before, try signing in at ${signInPath}. ` +
              `If you forgot your password, use the reset link there.`
            );
            setSubmitting(false);
            return;
          }
          userId = signInData.user.id;
          // Check if this orphaned account already has a businesses row
          const { data: existingBiz } = await supabase
            .from('businesses')
            .select('id')
            .eq('owner_id', userId)
            .maybeSingle();
          if (existingBiz) {
            setErrorMsg(
              `An account with this email already has a ${businessLabel} set up. Sign in at ${signInPath}.`
            );
            setSubmitting(false);
            return;
          }
        } else {
          setErrorMsg(signUpError.message ?? 'Could not create account. Try again.');
          setSubmitting(false);
          return;
        }
      } else if (signUpData.user) {
        userId = signUpData.user.id;
      } else {
        setErrorMsg('Account creation did not return a user. Check your email for a confirmation link, or try again.');
        setSubmitting(false);
        return;
      }

      // 2. Create businesses row
      const bizInsert: Record<string, unknown> = {
        owner_id:      userId,
        name:          businessName.trim(),
        email:         email.trim(),
        business_type: businessType,
      };
      if (collectPhone && phone.trim())    bizInsert.phone   = phone.trim();
      if (collectAddress && address.trim()) bizInsert.address = address.trim();
      if (collectWebsite && website.trim()) bizInsert.website = website.trim();

      const { data: bizData, error: bizError } = await supabase
        .from('businesses')
        .insert(bizInsert)
        .select('id')
        .single();

      if (bizError || !bizData) {
        setErrorMsg('Could not create your ' + businessLabel + ' profile. ' + (bizError?.message ?? ''));
        setSubmitting(false);
        return;
      }
      const businessId = bizData.id as string;

      // 3. Hash PIN using same algorithm as authenticate() in auth.ts
      const pinHash = await hashPin(businessId, pinVal);

      // 4. Create member row (owner) in the vertical's member table
      const memberInsert: Record<string, unknown> = {
        [memberFKColumn]: businessId,
        name:        ownerName.trim(),
        email:       email.trim(),
        role:        ownerRole,
        permissions: ownerPermissions,
        pin_hash:    pinHash,
        active:      true,
      };
      // business_members also needs user_id for Supabase auth linkage
      if (memberTable === 'business_members') {
        memberInsert.user_id = userId;
      }

      const { data: memberData, error: memberError } = await supabase
        .from(memberTable)
        .insert(memberInsert)
        .select('id')
        .single();

      if (memberError || !memberData) {
        setErrorMsg('Could not create owner account: ' + (memberError?.message ?? 'unknown error'));
        setSubmitting(false);
        return;
      }
      const memberId = memberData.id as string;

      setSubmitted({ businessId, memberId });
      setSubmitting(false);

      // Advance to biometric step (or vertical steps, or done)
      if (typeof window !== 'undefined' && window.PublicKeyCredential) {
        goTo('BIOMETRIC');
      } else if (verticalSteps.length > 0) {
        goTo('VERTICAL_0');
      } else {
        onSuccess(businessId, memberId);
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected error. Please try again.';
      setErrorMsg(msg);
      setSubmitting(false);
    }
  }

  // ── Biometric step ────────────────────────────────────────────────────────

  async function handleRegisterBiometric() {
    if (!submitted) return;
    setErrorMsg('');
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      await navigator.credentials.create({
        publicKey: {
          challenge,
          rp:   { name: businessName, id: window.location.hostname },
          user: {
            id:          new TextEncoder().encode(submitted.memberId),
            name:        email,
            displayName: ownerName,
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7  },
            { type: 'public-key', alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification:        'preferred',
          },
          timeout: 60000,
        },
      });

      setBiometricDone(true);
    } catch {
      // Non-fatal — user may have declined or hardware unsupported
      setErrorMsg('');
    }
  }

  function advanceFromBiometric() {
    if (!submitted) return;
    if (verticalSteps.length > 0) {
      goTo('VERTICAL_0');
    } else {
      onSuccess(submitted.businessId, submitted.memberId);
    }
  }

  // ── Vertical steps ────────────────────────────────────────────────────────

  function currentVerticalIndex(): number {
    if (typeof step === 'string' && step.startsWith('VERTICAL_')) {
      return parseInt(step.replace('VERTICAL_', ''), 10);
    }
    return -1;
  }

  function handleVerticalNext() {
    if (!submitted) return;
    const idx = currentVerticalIndex();
    if (idx < verticalSteps.length - 1) {
      goTo(`VERTICAL_${idx + 1}`);
    } else {
      onSuccess(submitted.businessId, submitted.memberId);
    }
  }

  // ── Step labels for progress indicator ───────────────────────────────────

  const stepLabels: string[] = [
    'Your info',
    'Set PIN',
    ...(typeof window !== 'undefined' && window.PublicKeyCredential ? ['Biometric'] : []),
    ...verticalSteps.map(s => s.label),
  ];

  function currentStepIndex(): number {
    if (step === 'OWNER_INFO')  return 0;
    if (step === 'PIN_SETUP')   return 1;
    if (step === 'BIOMETRIC')   return 2;
    const vi = currentVerticalIndex();
    return vi >= 0
      ? (typeof window !== 'undefined' && window.PublicKeyCredential ? 3 : 2) + vi
      : 0;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      background: backgroundColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{
        background: cardColor,
        borderRadius: 16,
        padding: '32px 28px',
        width: '100%',
        maxWidth: 420,
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>{logo}</div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: green, margin: 0 }}>
            Set up your {businessLabel}
          </h1>
        </div>

        {/* Progress dots */}
        {stepLabels.length > 1 && (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
            {stepLabels.map((label, i) => (
              <div key={i} title={label} style={{
                width: 10, height: 10, borderRadius: '50%',
                background: i === currentStepIndex() ? green
                  : i < currentStepIndex()            ? '#a0c080'
                  : '#ddd',
                transition: 'background 0.2s',
              }} />
            ))}
          </div>
        )}

        {/* Step 0: Owner Info */}
        {step === 'OWNER_INFO' && (
          <form onSubmit={handleOwnerInfoNext} style={formStyle}>
            <p style={stepLabel}>Step 1 of {stepLabels.length} — Your info</p>

            <Field label={`${businessLabel.charAt(0).toUpperCase() + businessLabel.slice(1)} name`}>
              <input style={inputStyle} type="text" value={businessName}
                onChange={e => setBusinessName(e.target.value)} required
                placeholder={examples.businessName ?? 'e.g. Your Business Name'} />
            </Field>

            <Field label="Your name">
              <input style={inputStyle} type="text" value={ownerName}
                onChange={e => setOwnerName(e.target.value)} required
                placeholder="First and last name" />
            </Field>

            <Field label="Email">
              <input style={inputStyle} type="email" value={email}
                onChange={e => setEmail(e.target.value)} required
                placeholder="you@example.com" />
            </Field>

            <Field label="Password">
              <input style={inputStyle} type="password" value={password}
                onChange={e => setPassword(e.target.value)} required
                minLength={6} placeholder="At least 6 characters" />
            </Field>

            <Field label="Confirm password">
              <input style={inputStyle} type="password" value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)} required
                placeholder="Same password again" />
            </Field>

            {collectPhone && (
              <Field label="Phone (optional)">
                <input style={inputStyle} type="tel" value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(512) 555-0100" />
              </Field>
            )}

            {collectAddress && (
              <Field label="Address (optional)">
                <input style={inputStyle} type="text" value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder={examples.address ?? '123 Main St, Austin TX'} />
              </Field>
            )}

            {collectWebsite && (
              <Field label="Website (optional)">
                <input style={inputStyle} type="url" value={website}
                  onChange={e => setWebsite(e.target.value)}
                  placeholder="https://yoursite.com" />
              </Field>
            )}

            {errorMsg && <p style={errorStyle}>{errorMsg}</p>}

            <button type="submit" style={btnStyle(green)}>Continue →</button>

            <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#888', marginTop: 8 }}>
              Already have an account?{' '}
              <span onClick={() => navTo(signInPath)}
                style={{ color: green, cursor: 'pointer', textDecoration: 'underline' }}>
                Sign in
              </span>
            </p>
          </form>
        )}

        {/* Step 1: PIN Setup */}
        {step === 'PIN_SETUP' && (
          <form onSubmit={handlePinSubmit} style={formStyle}>
            <p style={stepLabel}>Step 2 of {stepLabels.length} — Set your PIN</p>

            <p style={{ fontSize: '0.88rem', color: '#555', lineHeight: 1.5, marginBottom: 4 }}>
              Your PIN is how you unlock the {businessLabel} dashboard each day.
              It works on your device without typing your password every time.
            </p>

            <Field label={`${pinLength}-digit PIN`}>
              <input
                style={{ ...inputStyle, letterSpacing: '0.3em', fontSize: '1.4rem', textAlign: 'center' }}
                type="password"
                inputMode="numeric"
                pattern={`\\d{${pinLength}}`}
                maxLength={pinLength}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, pinLength))}
                required
                placeholder={'•'.repeat(pinLength)}
                autoComplete="new-password"
              />
            </Field>

            <Field label={`Confirm PIN`}>
              <input
                style={{ ...inputStyle, letterSpacing: '0.3em', fontSize: '1.4rem', textAlign: 'center' }}
                type="password"
                inputMode="numeric"
                pattern={`\\d{${pinLength}}`}
                maxLength={pinLength}
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, pinLength))}
                required
                placeholder={'•'.repeat(pinLength)}
                autoComplete="new-password"
              />
            </Field>

            {errorMsg && <p style={errorStyle}>{errorMsg}</p>}

            <button type="submit" disabled={submitting} style={btnStyle(green, submitting)}>
              {submitting ? 'Creating your account…' : 'Set PIN →'}
            </button>

            <button type="button" onClick={() => goTo('OWNER_INFO')}
              style={{ ...ghostBtnStyle, marginTop: 8 }}>
              ← Back
            </button>
          </form>
        )}

        {/* Step 2: Biometric (optional) */}
        {step === 'BIOMETRIC' && (
          <div style={formStyle}>
            <p style={stepLabel}>Step 3 of {stepLabels.length} — Quick unlock</p>

            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>
                {biometricDone ? '✅' : '🔑'}
              </div>
              {biometricDone ? (
                <p style={{ color: green, fontWeight: 700, fontSize: '1rem' }}>
                  Biometric registered! You can use Face ID or fingerprint to unlock.
                </p>
              ) : (
                <p style={{ color: '#555', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  Register your face or fingerprint for even faster access.
                  Your PIN always works as a backup.
                </p>
              )}
            </div>

            {errorMsg && <p style={errorStyle}>{errorMsg}</p>}

            {!biometricDone && (
              <button type="button" onClick={handleRegisterBiometric} style={btnStyle(green)}>
                Register biometric
              </button>
            )}

            <button type="button" onClick={advanceFromBiometric}
              style={{ ...ghostBtnStyle, marginTop: biometricDone ? 0 : 8 }}>
              {biometricDone ? 'Continue →' : 'Skip for now →'}
            </button>
          </div>
        )}

        {/* Vertical steps */}
        {step.startsWith('VERTICAL_') && submitted && (() => {
          const idx = currentVerticalIndex();
          const vStep = verticalSteps[idx];
          if (!vStep) return null;
          return (
            <div style={formStyle}>
              <p style={stepLabel}>
                Step {(typeof window !== 'undefined' && window.PublicKeyCredential ? 3 : 2) + idx + 1} of {stepLabels.length} — {vStep.label}
              </p>
              {errorMsg && <p style={errorStyle}>{errorMsg}</p>}
              {vStep.render({
                businessId: submitted.businessId,
                memberId:   submitted.memberId,
                onNext:     handleVerticalNext,
                onError:    msg => setErrorMsg(msg),
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      fontSize: '0.85rem', fontWeight: 600, color: '#333',
    }}>
      {label}
      {children}
    </label>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const stepLabel: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#aaa',
  margin: 0,
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

const errorStyle: React.CSSProperties = {
  color: RED,
  fontSize: '0.85rem',
  textAlign: 'center',
  margin: 0,
};

const ghostBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#888',
  fontSize: '0.9rem',
  cursor: 'pointer',
  padding: '8px 0',
  fontFamily: 'inherit',
  width: '100%',
  textAlign: 'center',
};

function btnStyle(color: string, disabled = false): React.CSSProperties {
  return {
    background: color,
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '14px 0',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.7 : 1,
    minHeight: 48,
    width: '100%',
    fontFamily: 'inherit',
  };
}
