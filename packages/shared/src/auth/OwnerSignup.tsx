import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { hashPin } from '../supabase/auth';
import { runBusinessCreationGuards } from './businessGuards';
import { normalizePhone } from '../utils/normalizePhone';

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
  darkMode?: boolean;             // when true, flips card text/label/input colors for dark backgrounds
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
  debugAuth?: boolean;            // enable [AUTH-TRACE] diagnostic logs — set false after diagnosis
}

// ── Step IDs ─────────────────────────────────────────────────────────────────

type StepId =
  | 'OWNER_INFO'
  | 'PIN_SETUP'
  | 'BIOMETRIC'
  | 'LOGIN_TO_ADD'       // shown when email already exists; prompt sign-in to add business
  | `VERTICAL_${number}`;

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
    darkMode = false,
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
    debugAuth = false,
  } = config;

  const labelColor   = darkMode ? '#cbd5e1' : '#333';
  const bodyColor    = darkMode ? '#94a3b8' : '#555';
  const mutedColor   = darkMode ? '#64748b' : '#888';
  const inputBorder  = darkMode ? '#334155' : '#ddd';
  const inputBg      = darkMode ? '#1e293b' : '#fff';
  const inputColor   = darkMode ? '#f1f5f9' : 'inherit';

  const dynInputStyle: React.CSSProperties = {
    padding: '12px 14px',
    border: `1.5px solid ${inputBorder}`,
    borderRadius: 8,
    fontSize: '1rem',
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    background: inputBg,
    color: inputColor,
  };

  const dynGhostStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: mutedColor,
    fontSize: '0.9rem',
    cursor: 'pointer',
    padding: '8px 0',
    fontFamily: 'inherit',
    width: '100%',
    textAlign: 'center',
  };

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

  // ── Add-a-business state
  // detectedUserId: set on mount when an existing session is found; signals
  //   "skip auth — create business under this user's existing identity."
  const [detectedUserId, setDetectedUserId] = useState<string | null>(null);

  // loginPassword: used in LOGIN_TO_ADD step (distinct from the password field in OWNER_INFO,
  //   which is the "new account" password — not the user's existing password)
  const [loginPassword, setLoginPassword]   = useState('');

  // ── Multi-step state
  const [step,          setStep]          = useState<StepId>('OWNER_INFO');
  const [submitting,    setSubmitting]    = useState(false);
  const [errorMsg,      setErrorMsg]      = useState('');
  const [submitted,     setSubmitted]     = useState<SubmittedData | null>(null);
  const [biometricDone, setBiometricDone] = useState(false);

  const green = primaryColor;

  // ── Detect existing session on mount ─────────────────────────────────────
  // If the user is already authenticated, we skip the auth signup entirely and
  // create the new business under their existing identity. This is the
  // add-a-business path for logged-in users.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setDetectedUserId(session.user.id);
        setEmail(session.user.email ?? '');
        console.log('[TRACE:BUSINESS] add-a-business: session detected on mount — skipping auth', {
          uid: session.user.id,
          businessType,
          path: 'detected-on-mount',
        });
      } else {
        console.log('[TRACE:BUSINESS] add-a-business: no session on mount — will use normal signup path', {
          businessType,
          path: 'new-user',
        });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── [AUTH-TRACE] diagnostic instrumentation (gate: debugAuth) ─────────────

  useEffect(() => {
    if (debugAuth) console.log('[AUTH-TRACE] OwnerSignup MOUNTED', {
      step,
      signInPath,
      hasNavigateProp: !!navigate,
      businessLabel,
      businessType,
    });
    return () => {
      if (debugAuth) console.log('[AUTH-TRACE] OwnerSignup UNMOUNTED', { finalStep: step });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (debugAuth) console.log('[AUTH-TRACE] OwnerSignup step →', step);
  }, [step, debugAuth]);

  // ── Navigation helpers ────────────────────────────────────────────────────

  function goTo(s: StepId) {
    setErrorMsg('');
    setStep(s);
  }

  function navTo(path: string) {
    if (debugAuth) console.log('[AUTH-TRACE] OwnerSignup navTo() fired', {
      path,
      currentStep: step,
      hasNavigateProp: !!navigate,
      action: navigate ? `calling navigate('${path}')` : `window.location.href = '${path}'`,
    });
    if (navigate) navigate(path);
    else window.location.href = path;
  }

  // ── Step 0 → 1: validate Owner Info and advance ───────────────────────────
  // Skip password validation when an existing session was detected — the user
  // is already authenticated and we don't need a password for them.

  function handleOwnerInfoNext(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    if (!businessName.trim()) { setErrorMsg('Business name is required.'); return; }
    if (!ownerName.trim())    { setErrorMsg('Your name is required.'); return; }
    if (!email.trim())        { setErrorMsg('Email is required.'); return; }
    if (!detectedUserId) {
      if (password.length < 6)  { setErrorMsg('Password must be at least 6 characters.'); return; }
      if (password !== confirmPw) { setErrorMsg('Passwords do not match.'); return; }
    }
    goTo('PIN_SETUP');
  }

  // ── createBusinessAndMember ───────────────────────────────────────────────
  // Extracted helper — called from both handlePinSubmit (normal/detected-session
  // paths) and handleLoginToAdd (LOGIN_TO_ADD sign-in path). Assumes PIN state
  // is set. Returns { businessId, memberId } on success, null on failure (also
  // sets errorMsg).

  async function createBusinessAndMember(
    userId: string,
  ): Promise<{ businessId: string; memberId: string } | null> {
    const pinVal = pin.trim();

    // 1. Create businesses row
    const bizInsert: Record<string, unknown> = {
      owner_id:      userId,
      name:          businessName.trim(),
      email:         email.trim(),
      business_type: businessType,
    };
    const normalizedPhone = normalizePhone(phone);   // ONE shared storage normalization (R1/R3/profile)
    if (collectPhone && normalizedPhone)  bizInsert.phone   = normalizedPhone;
    if (collectAddress && address.trim()) bizInsert.address = address.trim();
    if (collectWebsite && website.trim()) bizInsert.website = website.trim();

    // ── Abuse guards (platform business logic, shipped OFF by default) ────────
    // Each guard is a genuine kill-switch. OFF = no effect on the flow below.
    // ON = enforces. See packages/shared/src/auth/businessGuards.ts for flags
    // and activation discipline.
    const guard = await runBusinessCreationGuards(userId, supabase);
    if (!guard.allowed) {
      setErrorMsg(guard.error ?? 'Account creation blocked. Please contact support.');
      return null;
    }
    // Merge guard patches (e.g. GUARD_A sets trial_started_at=null for non-first businesses)
    Object.assign(bizInsert, guard.insertPatch ?? {});
    if (guard.heldForReview) {
      console.log('[TRACE:BUSINESS] business creation held for review (GUARD_C)', {
        userId, businessType,
      });
    }

    const { data: bizData, error: bizError } = await supabase
      .from('businesses')
      .insert(bizInsert)
      .select('id')
      .single();

    if (bizError || !bizData) {
      setErrorMsg('Could not create your ' + businessLabel + ' profile. ' + (bizError?.message ?? ''));
      return null;
    }
    const businessId = bizData.id as string;

    // 2. Hash PIN using same algorithm as authenticate() in auth.ts
    const pinHash = await hashPin(businessId, pinVal);

    // 3. Create member row (owner) in the vertical's member table
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
      return null;
    }

    return { businessId, memberId: memberData.id as string };
  }

  // ── advanceAfterCreate ────────────────────────────────────────────────────
  // After a successful createBusinessAndMember(), store result and go to the
  // next step (biometric, vertical, or done).

  function advanceAfterCreate(businessId: string, memberId: string) {
    setSubmitted({ businessId, memberId });
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      goTo('BIOMETRIC');
    } else if (verticalSteps.length > 0) {
      goTo('VERTICAL_0');
    } else {
      onSuccess(businessId, memberId);
    }
  }

  // ── Step 1: submit ─────────────────────────────────────────────────────────

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
      let userId: string;

      if (detectedUserId) {
        // ── Already authenticated — skip auth signup entirely ──────────────
        // An existing session was detected on mount (or set via handleLoginToAdd).
        // Create the new business directly under the existing uid.
        userId = detectedUserId;
        console.log('[TRACE:BUSINESS] handlePinSubmit: using detectedUserId (authenticated path)', {
          uid: userId,
          businessType,
          path: 'skip-auth',
        });
      } else {
        // ── Normal path: brand-new user signup ────────────────────────────
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          // PERSON NAME source of truth = auth.user_metadata.full_name. The typed
          // ownerName (also written to business_members.name as display-fallback) must
          // land in auth metadata so the header/profile show the person, not the email.
          options: { data: { full_name: ownerName.trim() } },
        });

        if (signUpError) {
          const msg = signUpError.message ?? '';
          if (
            msg.toLowerCase().includes('already registered') ||
            msg.toLowerCase().includes('already been registered')
          ) {
            // Email belongs to an existing account.
            // Route to LOGIN_TO_ADD instead of dead-ending — the user needs to
            // sign in to add a new business under their existing identity.
            console.log('[TRACE:BUSINESS] handlePinSubmit: email-exists → routing to LOGIN_TO_ADD', {
              email: email.trim(),
              businessType,
              path: 'email-exists',
            });
            setSubmitting(false);
            goTo('LOGIN_TO_ADD');
            return;
          }
          setErrorMsg(signUpError.message ?? 'Could not create account. Try again.');
          setSubmitting(false);
          return;
        }

        if (!signUpData.user) {
          setErrorMsg('Account creation did not return a user. Check your email for a confirmation link, or try again.');
          setSubmitting(false);
          return;
        }

        userId = signUpData.user.id;
        console.log('[TRACE:BUSINESS] handlePinSubmit: new-user signUp success', {
          uid: userId,
          businessType,
          path: 'new-user',
        });
      }

      const result = await createBusinessAndMember(userId);
      if (!result) {
        setSubmitting(false);
        return;
      }

      setSubmitting(false);
      advanceAfterCreate(result.businessId, result.memberId);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected error. Please try again.';
      setErrorMsg(msg);
      setSubmitting(false);
    }
  }

  // ── LOGIN_TO_ADD: sign in with existing credentials, then create business ──
  // This step is reached when the user enters an email that already has a TRACE
  // account in the normal (non-authenticated) signup flow. Rather than dead-
  // ending with "already registered", we prompt for their existing password and
  // create the new business under their authenticated identity.

  async function handleLoginToAdd(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: loginPassword,
      });

      if (signInError || !signInData.user) {
        setErrorMsg('Sign in failed — check your password and try again.');
        setSubmitting(false);
        return;
      }

      const userId = signInData.user.id;
      console.log('[TRACE:BUSINESS] LOGIN_TO_ADD: signed in, creating business', {
        uid: userId,
        businessType,
        path: 'login-to-add',
      });

      const result = await createBusinessAndMember(userId);
      if (!result) {
        setSubmitting(false);
        return;
      }

      setDetectedUserId(userId); // mark authenticated for any follow-on flows
      setSubmitting(false);
      advanceAfterCreate(result.businessId, result.memberId);

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
    if (step === 'OWNER_INFO')   return 0;
    if (step === 'PIN_SETUP')    return 1;
    if (step === 'LOGIN_TO_ADD') return 1; // same position as PIN_SETUP
    if (step === 'BIOMETRIC')    return 2;
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
            {detectedUserId ? `Add a ${businessLabel}` : `Set up your ${businessLabel}`}
          </h1>
        </div>

        {/* Progress dots */}
        {stepLabels.length > 1 && step !== 'LOGIN_TO_ADD' && (
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

            {/* Authenticated badge — shown when a session was detected on mount */}
            {detectedUserId && (
              <div style={{
                background: '#f0fdf4',
                border: '1.5px solid #86efac',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: '0.85rem',
                lineHeight: 1.5,
              }}>
                <span style={{ fontWeight: 700, color: '#166534' }}>
                  Adding a new {businessLabel}
                </span>
                {' '}
                <span style={{ color: '#15803d' }}>to your account</span>
                <br />
                <span style={{ fontSize: '0.8rem', color: '#16a34a' }}>{email}</span>
              </div>
            )}

            <Field label={`${businessLabel.charAt(0).toUpperCase() + businessLabel.slice(1)} name`} labelColor={labelColor}>
              <input style={dynInputStyle} type="text" value={businessName}
                onChange={e => setBusinessName(e.target.value)} required
                placeholder={examples.businessName ?? 'e.g. Your Business Name'} />
            </Field>

            <Field label="Your name" labelColor={labelColor}>
              <input style={dynInputStyle} type="text" value={ownerName}
                onChange={e => setOwnerName(e.target.value)} required
                placeholder="First and last name" />
            </Field>

            {/* Show email + password fields only when NOT already authenticated */}
            {!detectedUserId && (
              <>
                <Field label="Email" labelColor={labelColor}>
                  <input style={dynInputStyle} type="email" value={email}
                    onChange={e => setEmail(e.target.value)} required
                    placeholder="you@example.com" />
                </Field>

                <Field label="Password" labelColor={labelColor}>
                  <input style={dynInputStyle} type="password" value={password}
                    onChange={e => setPassword(e.target.value)} required
                    minLength={6} placeholder="At least 6 characters" />
                </Field>

                <Field label="Confirm password" labelColor={labelColor}>
                  <input style={dynInputStyle} type="password" value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)} required
                    placeholder="Same password again" />
                </Field>
              </>
            )}

            {collectPhone && (
              <Field label="Phone (optional)" labelColor={labelColor}>
                <input style={dynInputStyle} type="tel" value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(512) 555-0100" />
              </Field>
            )}

            {collectAddress && (
              <Field label="Address (optional)" labelColor={labelColor}>
                <input style={dynInputStyle} type="text" value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder={examples.address ?? '123 Main St, Austin TX'} />
              </Field>
            )}

            {collectWebsite && (
              <Field label="Website (optional)" labelColor={labelColor}>
                <input style={dynInputStyle} type="url" value={website}
                  onChange={e => setWebsite(e.target.value)}
                  placeholder="https://yoursite.com" />
              </Field>
            )}

            {errorMsg && <p style={errorStyle}>{errorMsg}</p>}

            <button type="submit" style={btnStyle(green)}>Continue →</button>

            {!detectedUserId && (
              <p style={{ textAlign: 'center', fontSize: '0.8rem', color: mutedColor, marginTop: 8 }}>
                Already have an account?{' '}
                <span onClick={() => navTo(signInPath)}
                  style={{ color: green, cursor: 'pointer', textDecoration: 'underline' }}>
                  Sign in
                </span>
              </p>
            )}
          </form>
        )}

        {/* Step 1: PIN Setup */}
        {step === 'PIN_SETUP' && (
          <form onSubmit={handlePinSubmit} style={formStyle}>
            <p style={stepLabel}>Step 2 of {stepLabels.length} — Set your PIN</p>

            <p style={{ fontSize: '0.88rem', color: bodyColor, lineHeight: 1.5, marginBottom: 4 }}>
              Your PIN is how you unlock the {businessLabel} dashboard each day.
              It works on your device without typing your password every time.
            </p>

            <Field label={`${pinLength}-digit PIN`} labelColor={labelColor}>
              <input
                style={{ ...dynInputStyle, letterSpacing: '0.3em', fontSize: '1.4rem', textAlign: 'center' }}
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

            <Field label={`Confirm PIN`} labelColor={labelColor}>
              <input
                style={{ ...dynInputStyle, letterSpacing: '0.3em', fontSize: '1.4rem', textAlign: 'center' }}
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
              style={{ ...dynGhostStyle, marginTop: 8 }}>
              ← Back
            </button>
          </form>
        )}

        {/* LOGIN_TO_ADD: shown when a logged-out user's email already has a TRACE account.
            Instead of dead-ending, we prompt them to sign in with their EXISTING password
            and then create the new business under their authenticated identity. */}
        {step === 'LOGIN_TO_ADD' && (
          <form onSubmit={handleLoginToAdd} style={formStyle}>
            <p style={stepLabel}>Add a {businessLabel}</p>

            <div style={{
              background: '#fefce8',
              border: '1.5px solid #fde047',
              borderRadius: 8,
              padding: '12px 14px',
              fontSize: '0.875rem',
              color: '#713f12',
              lineHeight: 1.5,
            }}>
              <strong>{email}</strong> already has a TRACE account.
              Sign in with your existing password to add a new {businessLabel}.
            </div>

            <Field label="Your existing password" labelColor={labelColor}>
              <input
                style={dynInputStyle}
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                required
                autoFocus
                placeholder="Your password"
                autoComplete="current-password"
              />
            </Field>

            {errorMsg && <p style={errorStyle}>{errorMsg}</p>}

            <button type="submit" disabled={submitting} style={btnStyle(green, submitting)}>
              {submitting ? 'Signing in…' : 'Sign in & add →'}
            </button>

            <button
              type="button"
              onClick={() => { setLoginPassword(''); goTo('OWNER_INFO'); }}
              style={{ ...dynGhostStyle, marginTop: 8 }}
            >
              ← Use a different email
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
                <p style={{ color: bodyColor, fontSize: '0.9rem', lineHeight: 1.5 }}>
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
              style={{ ...dynGhostStyle, marginTop: biometricDone ? 0 : 8 }}>
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

function Field({ label, children, labelColor = '#333' }: { label: string; children: React.ReactNode; labelColor?: string }) {
  return (
    <label style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      fontSize: '0.85rem', fontWeight: 600, color: labelColor,
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

const errorStyle: React.CSSProperties = {
  color: RED,
  fontSize: '0.85rem',
  textAlign: 'center',
  margin: 0,
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
