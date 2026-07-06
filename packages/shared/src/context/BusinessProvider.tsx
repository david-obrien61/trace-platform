import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase/client';
import { can as sharedCan } from '../auth/permissions';
import { applyFinancialDependencies } from '../auth/financialPermissions';

const SM_DEBUG = false; // flip to true to re-enable legacy [SM-TRACE] diagnostics

// Write-then-read race guard (HAR-confirmed 2026-06-24): a brand-new signup creates the
// businesses row and runs the dashboard resolution read ~1ms later, before the write is
// visible to that request — so the first read returns empty even though the row exists and
// every read is 200 (no RLS reject). Retry the resolution a SMALL bounded number of times
// before settling on no_business. TIGHT bound: this is "row is a few ms behind," not "user
// has no business" — a genuinely business-less user must settle within the cap, never spin.
const RESOLVE_MAX_ATTEMPTS = 3;       // first attempt + up to 2 retries
const RESOLVE_RETRY_DELAY_MS = 500;   // ~1s total wait across 2 retries — well under a 2s cap
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// Transient (offline/network) read failure vs a real server error (session-persistence fix,
// 2026-06-29, recon #65 / docs/decisions/2026-06-29-session-persistence-recon.md). PostgREST
// returns a non-empty `code` (a Postgres SQLSTATE like '42P17', or a 'PGRST…' code) ONLY when
// a server actually responded with an error — an RLS reject, an embed/recursion, an expired-token
// 401. A network/offline failure resolves with a CODELESS error ('' code, message ~ "Failed to
// fetch"/"NetworkError"). So: codeless error ⇒ transport/offline ⇒ TRANSIENT (keep last-known,
// the local session is still valid); coded error ⇒ a server spoke ⇒ NOT transient (existing
// read_error path). This distinguishes "the network flickered" from "the query genuinely failed
// server-side" without touching token validation or RLS.
function isTransientReadError(err: { code?: string | null } | null | undefined): boolean {
  if (!err) return false;                       // no error → not transient
  const code = (err.code ?? '').toString().trim();
  return code === '';                           // codeless ⇒ transport/offline flicker; coded ⇒ a server responded
}

// Per-vertical localStorage key — isolates Cultivar selection from Ignition selection
const activeBusinessKey = (businessType: string) =>
  `trace_active_business_${businessType}`;

// ─── Device spine: enrollment + is_active gate (agnostic, opt-in) ─────────────
// Runs on the REAL email-session (auth.uid() non-null — Auth Locked Rule) once a
// business_members row is resolved, so the member_devices RLS INSERT (md_self /
// md_owner_all) passes. A disabled device is REFUSED and NEVER silently revived.
// Any read/write failure returns 'error' so the caller fails OPEN — a failed device
// write must never lock out a legitimate user; only an explicit is_active=false does.
// NOTE: the correct home for this is the shared autoEnrollDevice in supabase/auth.ts,
// but that file is OFF-LIMITS (PIN-auth refactor, permission-locked) and its
// autoEnrollDevice is dead code (reachable only via the never-instantiated shop_members
// PIN strategy) still carrying the shop_id column drift. This live copy uses the
// correct business_id column; consolidate the two when auth.ts is unlocked.
type DeviceAuthStatus = 'enrolled' | 'active' | 'disabled' | 'error';

async function enrollAndGateDevice(memberId: string, businessId: string): Promise<DeviceAuthStatus> {
  let fingerprint = '';
  try {
    fingerprint = localStorage.getItem('device_fingerprint') ?? '';
    if (!fingerprint) {
      fingerprint = crypto.randomUUID();
      localStorage.setItem('device_fingerprint', fingerprint);
    }
  } catch { /* non-fatal */ }
  if (!fingerprint) return 'error';

  const { data: existing, error: readErr } = await supabase
    .from('member_devices')
    .select('id, is_active')
    .eq('member_id', memberId)
    .eq('device_fingerprint', fingerprint)
    .maybeSingle();

  if (readErr) {
    console.log('[TRACE:DEVICE] device read failed — failing OPEN', {
      memberId, businessId, code: readErr.code, message: readErr.message,
    });
    return 'error';
  }

  const now = new Date().toISOString();

  if (!existing) {
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    const label = ua.includes('iPhone') ? 'iPhone'
      : ua.includes('iPad')    ? 'iPad'
      : ua.includes('Android') ? 'Android Device'
      : ua.includes('Mac')     ? 'Mac'
      : 'Browser';
    const { error: insErr } = await supabase.from('member_devices').insert({
      member_id:          memberId,
      business_id:        businessId,   // FK → businesses (correct column; the drift was `shop_id`)
      device_fingerprint: fingerprint,
      device_label:       label,
      is_active:          true,
      last_seen:          now,
    });
    if (insErr) {
      console.log('[TRACE:DEVICE] device enroll INSERT failed — failing OPEN', {
        memberId, businessId, code: insErr.code, message: insErr.message,
      });
      return 'error';
    }
    console.log('[TRACE:DEVICE] device-enrolled', { memberId, businessId, deviceLabel: label });
    return 'enrolled';
  }

  const row = existing as { id: string; is_active: boolean };

  // Enforce the gate: a DISABLED device is refused and NOT revived (no last_seen bump).
  if (row.is_active === false) {
    console.log('[TRACE:DEVICE] device-REFUSED-disabled', { memberId, businessId, deviceId: row.id });
    return 'disabled';
  }

  await supabase.from('member_devices').update({ last_seen: now }).eq('id', row.id);
  console.log('[TRACE:DEVICE] device-authenticated', { memberId, businessId, deviceId: row.id });
  return 'active';
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  tax_rate: number;
  business_type: string;
  accounting_type: string | null;
  accounting_needs_reconnect: boolean;
  accounting_company_id: string | null;
  trial_started_at: string | null;
  created_at: string;
}

interface ResolvedBusiness {
  business: Business;
  isOwner: boolean;
  permissions: string[] | null; // null = owner (full access implied)
  role: string | null;          // member's raw business_members.role; null for owners
  memberName: string | null;    // business_members.name for members; null for owners (no member row)
  memberId: string | null;      // business_members.id — device spine key. Present for members AND
                                // owners (OwnerSignup gives owners an active member row); null only
                                // for legacy owners predating the member-row model → device no-op.
}

export interface BusinessContextValue {
  business: Business | null;
  businessId: string | null;
  businesses: Business[];                    // all resolved businesses for this user+vertical
  activeBusinessId: string | null;          // currently selected business id
  setActiveBusinessId: (id: string) => void; // switch active business
  businessError: string | null;
  loading: boolean;
  reload: () => void;
  // null = owner (full access implied). string[] = member's explicit permission list.
  userPermissions: string[] | null;
  isOwner: boolean;
  // Canonical identity surface for the persistent header (consumed by <AppHeader>, never
  // re-fetched). userEmail = the signed-in Supabase user's email. role = display-ready role
  // for the ACTIVE business: 'OWNER' for owners, else the member's role uppercased (the 3
  // roles Cultivar runs today — OWNER / MANAGER / STAFF; inherits the 5-role model for free
  // when Role Machine lands, because it reads the resolved role, not a hardcoded list).
  // userName = the person's display name: the member's business_members.name for a member,
  // else the signed-in user's auth metadata full name, else the email (never blank).
  userEmail: string | null;
  userName: string | null;
  role: string | null;
  // THE permission chokepoint (decision 2026-06-21). Single true checker for the
  // active business: owner ⇒ true; member ⇒ shared can() over their explicit list
  // with the view_margin⊆view_costs dependency applied. DEFAULT-DENY. Route every
  // permission gate through this — do not inline `.includes()` at call sites.
  can: (permissionId: string) => boolean;
}

const BusinessContext = createContext<BusinessContextValue>({
  business: null,
  businessId: null,
  businesses: [],
  activeBusinessId: null,
  setActiveBusinessId: () => {},
  businessError: null,
  loading: true,
  reload: () => {},
  userPermissions: null,
  isOwner: false,
  userEmail: null,
  userName: null,
  role: null,
  can: () => false,
});

// ─── Business picker ──────────────────────────────────────────────────────────
// Shown only when 2+ businesses resolved and no valid persisted selection.
// Inline-styled per platform policy (no Tailwind).

function BusinessPicker({
  businesses,
  onSelect,
  addBusinessHref,
}: {
  businesses: Business[];
  onSelect: (id: string) => void;
  addBusinessHref?: string;
}) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#EAF3DE',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: '2rem',
        maxWidth: 400,
        width: '90%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        <h2 style={{ margin: '0 0 0.5rem', color: '#27500A', fontSize: '1.25rem', fontWeight: 600 }}>
          Select a business
        </h2>
        <p style={{ margin: '0 0 1.5rem', color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5 }}>
          You have access to multiple businesses. Choose which one to open.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {businesses.map(b => (
            <button
              key={b.id}
              onClick={() => onSelect(b.id)}
              style={{
                textAlign: 'left',
                background: '#f8faf5',
                border: '1.5px solid #c8e6c9',
                borderRadius: 8,
                padding: '0.875rem 1rem',
                cursor: 'pointer',
                fontSize: '0.95rem',
                color: '#1a2e0a',
                fontWeight: 500,
              }}
            >
              {b.name}
              <span style={{
                display: 'block',
                fontSize: '0.78rem',
                color: '#64748b',
                fontWeight: 400,
                marginTop: 2,
                textTransform: 'capitalize',
              }}>
                {b.business_type}
              </span>
            </button>
          ))}

          {addBusinessHref && (
            <a
              href={addBusinessHref}
              style={{
                display: 'block',
                textAlign: 'center',
                background: 'none',
                border: '1.5px dashed #86efac',
                borderRadius: 8,
                padding: '0.875rem 1rem',
                cursor: 'pointer',
                fontSize: '0.9rem',
                color: '#15803d',
                fontWeight: 600,
                textDecoration: 'none',
                marginTop: 4,
              }}
            >
              + Add a business
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Device-locked screen ─────────────────────────────────────────────────────
// Shown when the active member's device row is is_active=false. The session has
// already been signed out by the gate; this is the terminal deny state.

function DeviceLockedScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#EAF3DE',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: '2rem',
        maxWidth: 400,
        width: '90%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔒</div>
        <h2 style={{ margin: '0 0 0.5rem', color: '#A32D2D', fontSize: '1.25rem', fontWeight: 600 }}>
          This device is disabled
        </h2>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Access from this device has been turned off by an administrator.
          Contact the business owner to re-enable it.
        </p>
      </div>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function BusinessProvider({
  children,
  businessType,
  addBusinessHref,
  deviceEnrollment = false,
}: {
  children: React.ReactNode;
  businessType: string;
  addBusinessHref?: string;  // when provided, "Add a business" link appears in BusinessPicker
  // Opt-in device spine (agnostic — a boolean the vertical supplies, NO vertical noun here).
  // OFF (absent/false) → the device gate effect + lockout render are a pure no-op, so verticals
  // that don't opt in (Ignition) are byte-for-byte unchanged. Cultivar passes true.
  deviceEnrollment?: boolean;
}) {
  // All businesses this user can access in this vertical
  const [resolvedBusinesses, setResolvedBusinesses] = useState<ResolvedBusiness[]>([]);
  // Ref mirror of resolvedBusinesses so resolve() (defined inside the [tick, businessType]
  // effect, which closes over the mount-time state) can read the CURRENT last-known list when
  // it re-runs via onAuthStateChange. Without this the keep-last-known guard would always see
  // the stale [] captured at mount. (session-persistence fix, 2026-06-29.)
  const resolvedRef = useRef<ResolvedBusiness[]>([]);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  // Signed-in user's email — the canonical identity value the header displays (no re-fetch).
  const [userEmail, setUserEmail] = useState<string | null>(null);
  // Signed-in user's auth display name (user_metadata.full_name / name) — the owner-path name
  // source (owners have no business_members row). Falls back to email at the context layer.
  const [authName, setAuthName] = useState<string | null>(null);

  // Persisted active selection — initialized from localStorage, survives reload
  const [activeBusinessId, setActiveBusinessIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(activeBusinessKey(businessType)); } catch { return null; }
  });

  const setActiveBusinessId = (id: string) => {
    try { localStorage.setItem(activeBusinessKey(businessType), id); } catch {}
    setActiveBusinessIdState(id);
  };

  // Keep the ref in sync with the latest resolved list (read by resolve()'s keep-last-known guard).
  useEffect(() => { resolvedRef.current = resolvedBusinesses; }, [resolvedBusinesses]);

  // [SM-TRACE] legacy state transition log (gated — keep for re-enable)
  useEffect(() => {
    if (SM_DEBUG) console.log('[SM-TRACE] BusinessProvider state →', {
      loading,
      businessId: resolvedBusinesses.find(r => r.business.id === activeBusinessId)?.business.id ?? null,
      businessError,
      businessType,
    });
  }, [loading, resolvedBusinesses, businessError, activeBusinessId, businessType]);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      setLoading(true);
      setBusinessError(null);

      // Read the LOCALLY persisted session (offline-safe), not the network getUser() that was
      // here before — a transient offline getUser() returned null and was treated as a logout,
      // wiping resolved context (recon #65). session.user is the SAME User object (id / email /
      // user_metadata, all consumed locally). This matches the route guard's existing-correct
      // getSession() pattern (configureAuth.tsx:65,96). NO token re-validation is removed: the
      // bearer token is still sent on every PostgREST call and RLS still enforces tenant
      // isolation server-side. (session-persistence fix, 2026-06-29.)
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;

      console.log('[TRACE:SESSION] resolve: session read (local getSession)', {
        hasSession: !!session,
        userId: user?.id ?? null,
        businessType,
      });

      if (!user) {
        // Genuine no-session: getSession is LOCAL, so a null here means the stored session is
        // actually absent (real sign-out / never-logged-in / cleared) — NOT a network flicker.
        // Wipe is correct (real logout intact).
        console.log('[TRACE:SESSION] resolve: no local session → settled logged-out (wipe)', { businessType });
        if (!cancelled) {
          setResolvedBusinesses([]);
          setBusinessError(null);
          setUserEmail(null);
          setAuthName(null);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setUserEmail(user.email ?? null);
        // Owner display-name source: auth metadata (full_name, else name). Null → context
        // falls back to email. Stated at build: owners have no business_members row, so this
        // (not the member name) is the owner-name source.
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const fullName = (meta.full_name ?? meta.name) as string | undefined;
        setAuthName(fullName?.trim() || null);
      }

      // Capture once in the narrowed (non-null) outer scope — TS narrowing from the
      // `if (!user) return` above does not flow into the nested attemptResolution().
      const userId = user.id;

      // Owner + member resolution as ONE retryable unit. The two reads + the resolved[]
      // build are wrapped so the write-then-read race can be retried without duplicating
      // logic. Returns the resolved list + any query errors.
      async function attemptResolution() {
        const resolved: ResolvedBusiness[] = [];

        // 1. Owner path — fetch ALL businesses this user owns
        //    [TEMP — OPEN ACCESS] business_type filter bypassed so David sees ALL his
        //    businesses to operate now (TRACE Enterprises=general, LAWNS=nursery, etc.).
        //    Re-scope to per-app-type model later when one-app-skinned routing is built.
        //    Restore: uncomment the .eq('business_type', businessType) line below.
        const { data: ownedBizzes, error: ownerError } = await supabase
          .from('businesses')
          .select('*')
          .eq('owner_id', userId);
          // .eq('business_type', businessType); // [TEMP — OPEN ACCESS] restore to re-scope

        console.log('[TRACE:BUSINESS] owner path', {
          userId: userId,
          businessType,
          count: ownedBizzes?.length ?? 0,
          ids: ownedBizzes?.map(b => b.id) ?? [],
        });

        // Surface a query error instead of letting null data masquerade as "no rows".
        // A SELECT that ERRORS (RLS reject, embed/recursion) returns data=null — without
        // this, data?.length ?? 0 reads it as an empty result → false no_business.
        if (ownerError) {
          console.log('[TRACE:BUSINESS] owner path ERROR', {
            userId: userId,
            businessType,
            code: ownerError.code,
            message: ownerError.message,
            details: ownerError.details,
            hint: ownerError.hint,
          });
        }

        for (const biz of (ownedBizzes ?? [])) {
          resolved.push({ business: biz as Business, isOwner: true, permissions: null, role: null, memberName: null, memberId: null });
        }

        // 2. Member path — fetch ALL business_members rows for this user, active=true
        //    Filter by business_type to prevent cross-vertical data exposure (audit #13)
        //    (was .single(); now returns the full array)
        const { data: memberships, error: memberError } = await supabase
          .from('business_members')
          .select('id, business_id, role, permissions, name, businesses(*)')
          .eq('user_id', userId)
          .eq('active', true);

        console.log('[TRACE:BUSINESS] member path', {
          userId: userId,
          businessType,
          membershipCount: memberships?.length ?? 0,
        });

        // Same surfacing for the member path. Note the businesses(*) embed: if the
        // join/RLS errors, memberships is null here, not an empty member list.
        if (memberError) {
          console.log('[TRACE:BUSINESS] member path ERROR', {
            userId: userId,
            businessType,
            code: memberError.code,
            message: memberError.message,
            details: memberError.details,
            hint: memberError.hint,
          });
        }

        const ownedIds = new Set(resolved.map(r => r.business.id));
        for (const m of (memberships ?? [])) {
          const memberBiz = (m.businesses as any) as Business | null;
          if (!memberBiz) continue;
          // [TEMP — OPEN ACCESS] vertical fence bypassed — all member businesses resolve
          // regardless of type. Restore line below to re-scope:
          // if (memberBiz.business_type !== businessType) continue; // vertical fence (audit #13)
          if (ownedIds.has(memberBiz.id)) continue; // already included via owner path
          resolved.push({
            business: memberBiz,
            isOwner: false,
            permissions: (m.permissions as string[]) ?? [],
            role: (m.role as string) ?? null,
            memberName: ((m as { name?: string | null }).name ?? null) || null,
            memberId: ((m as { id?: string }).id ?? null),
          });
        }

        // Device-spine member_id: OwnerSignup gives owners an active business_members row too,
        // so the memberships query above returns an id for owners as well — but their row is
        // deduped out of the member loop (already resolved via the owner path). Patch owner
        // entries' memberId from the raw memberships list here. (null for legacy owners with no
        // member row → the device gate no-ops for them.)
        const memberIdByBusiness = new Map<string, string>();
        for (const m of (memberships ?? [])) {
          const bId = (m as { business_id?: string }).business_id;
          const mId = (m as { id?: string }).id;
          if (bId && mId) memberIdByBusiness.set(bId, mId);
        }
        for (const r of resolved) {
          if (r.isOwner && r.memberId === null) {
            r.memberId = memberIdByBusiness.get(r.business.id) ?? null;
          }
        }

        return { resolved, ownerError, memberError };
      }

      // Bounded retry (write-then-read race): a fresh signup may run this read a few ms
      // before the create write is visible to it (HAR-confirmed — every read 200, just
      // empty). Re-resolve up to RESOLVE_MAX_ATTEMPTS times; STOP early on first non-empty
      // result OR on a real query error (an error is a different problem than empty —
      // read_error handling below surfaces it; retrying wouldn't help). loading stays true
      // across retries → the redirect guard renders the loading state, not a bounce, until
      // the resolution is SETTLED (rows found, or retries exhausted).
      let resolution = await attemptResolution();
      if (cancelled) return;
      for (
        let attempt = 1;
        attempt < RESOLVE_MAX_ATTEMPTS
          && resolution.resolved.length === 0
          && !resolution.ownerError && !resolution.memberError;
        attempt++
      ) {
        console.log('[TRACE:BUSINESS] resolution retry', {
          attempt,
          of: RESOLVE_MAX_ATTEMPTS - 1,
          reason: 'empty_with_session',
          delayMs: RESOLVE_RETRY_DELAY_MS,
        });
        await sleep(RESOLVE_RETRY_DELAY_MS);
        if (cancelled) return;
        resolution = await attemptResolution();
        if (cancelled) return;
      }

      const { resolved, ownerError, memberError } = resolution;

      if (cancelled) return;

      if (resolved.length === 0) {
        // KEEP-LAST-KNOWN (session-persistence fix, 2026-06-29 — Option B). When the owner/member
        // SELECTs fail with a TRANSIENT (offline/network) error AND we already hold last-known
        // resolved businesses in memory, do NOT wipe and do NOT set a booting error — the local
        // session is still valid (getSession above succeeded), the network just flickered. Keeping
        // resolvedBusinesses intact + businessError null means businessId stays populated, so
        // Dashboard.tsx:359 (boots on businessError || !businessId) does NOT bounce to /onboarding.
        // Read CURRENT state via the ref (resolve() closes over stale mount-time state).
        const transient = isTransientReadError(ownerError) || isTransientReadError(memberError);
        if (transient && resolvedRef.current.length > 0) {
          console.log('[TRACE:SESSION] resolve: transient read error — KEEPING last-known businesses (no wipe, no bounce)', {
            userId: userId,
            businessType,
            lastKnownCount: resolvedRef.current.length,
            ownerErrorCode: ownerError?.code ?? null,
            memberErrorCode: memberError?.code ?? null,
          });
          setLoading(false); // clear the skeleton; resolvedBusinesses + businessError left intact
          return;
        }

        // Distinguish an errored read (rows may exist but the SELECT failed) from a
        // genuinely empty result. Without this, an RLS/embed error looks identical to
        // a brand-new user with no business → false no_business → onboarding bounce.
        if (ownerError || memberError) {
          console.log('[TRACE:BUSINESS] result: read_error — a resolution query errored (rows may exist)', {
            userId: userId,
            businessType,
            ownerErrorCode: ownerError?.code ?? null,
            memberErrorCode: memberError?.code ?? null,
          });
          setBusinessError('read_error');
          setResolvedBusinesses([]);
          setLoading(false);
          return;
        }
        // SETTLED no_business — reached only after the bounded retry above is exhausted,
        // so this is a genuine business-less user, not the in-flight race. loading→false
        // here is the settled signal the redirect guard waits for.
        console.log('[TRACE:BUSINESS] result: no_business (settled) — both paths empty after retries', { userId: userId, businessType });
        setBusinessError('no_business');
        setResolvedBusinesses([]);
        setLoading(false);
        return;
      }

      setBusinessError(null);
      setResolvedBusinesses(resolved);

      if (resolved.length === 1) {
        // REGRESSION-CRITICAL: single business → auto-select, NO picker shown, identical to prior behavior
        const autoId = resolved[0].business.id;
        console.log('[TRACE:BUSINESS] result: auto-select (single business)', {
          id: autoId,
          name: resolved[0].business.name,
          isOwner: resolved[0].isOwner,
        });
        setActiveBusinessIdState(autoId);
        try { localStorage.setItem(activeBusinessKey(businessType), autoId); } catch {}
      } else {
        // 2+ businesses — validate that the persisted selection is still in the resolved list
        let persistedId: string | null = null;
        try { persistedId = localStorage.getItem(activeBusinessKey(businessType)); } catch {}
        const stillValid = persistedId !== null && resolved.some(r => r.business.id === persistedId);
        console.log('[TRACE:BUSINESS] result: multi-business', {
          count: resolved.length,
          ids: resolved.map(r => r.business.id),
          names: resolved.map(r => r.business.name),
          persistedId,
          stillValid,
          selectionPath: stillValid ? 'persisted' : 'picker',
        });
        if (!stillValid) {
          // Stale or missing selection — clear so the picker shows
          setActiveBusinessIdState(null);
          try { localStorage.removeItem(activeBusinessKey(businessType)); } catch {}
        }
        // If stillValid, setActiveBusinessIdState was already initialized from localStorage
        // and the current React state already holds the right value — no-op needed.
      }

      setLoading(false);
    }

    resolve();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      if (!cancelled) resolve();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [tick, businessType]);

  // Derive active business from the resolved list + current activeBusinessId
  const activeResolved = resolvedBusinesses.find(r => r.business.id === activeBusinessId) ?? null;
  const activeBusiness = activeResolved?.business ?? null;
  const allBusinesses = resolvedBusinesses.map(r => r.business);

  // ─── Permission chokepoint ───────────────────────────────────────────────────
  // The single true checker for the active business. Owner ⇒ full access (matches
  // the existing isOwner=>userPermissions=null contract). Member ⇒ the shared can()
  // helper over their explicit list, with view_margin⊆view_costs enforced so the
  // margin verdict never resolves true for a session denied its cost inputs.
  // Phase 1: this ESTABLISHES the chokepoint. It is not yet wired into every gate
  // (the existing inline .includes() gates are migrated in the render-gate phase).
  const isOwnerActive = activeResolved?.isOwner ?? false;
  const activePermissions = activeResolved?.permissions ?? null;

  // Display-ready role for the active business. Owner ⇒ OWNER; member ⇒ their raw role
  // uppercased (the role they ACTUALLY hold — rendered live, not a hardcoded list; falls
  // back to STAFF only when a member row carries no role). null when nothing is resolved.
  const activeRole: string | null = activeResolved
    ? (isOwnerActive ? 'OWNER' : (activeResolved.role ?? 'STAFF').toUpperCase())
    : null;

  // Display name for the active session. PERSON NAME source of truth = auth full_name, so
  // precedence is full_name → business_members.name → email (member.name is invite-bootstrap /
  // display-fallback only). Owner has no member row → full_name → email. Null only before resolve.
  const activeName: string | null = activeResolved
    ? (isOwnerActive
        ? (authName ?? userEmail)
        : (authName ?? activeResolved.memberName ?? userEmail))
    : (authName ?? userEmail);
  const can = React.useCallback(
    (permissionId: string): boolean => {
      if (isOwnerActive) return true; // owner: full access (userPermissions === null)
      const effective = applyFinancialDependencies(activePermissions ?? []);
      return sharedCan({ permissions: effective }, permissionId);
    },
    [isOwnerActive, activePermissions],
  );

  // [TRACE:PERM] resolved permission snapshot for the active business — ON by
  // default (STD-003). Emits once per active-business resolution, not per can() call.
  useEffect(() => {
    if (!activeResolved) return;
    console.log('[TRACE:PERM] active business permissions', {
      businessId: activeResolved.business.id,
      isOwner: isOwnerActive,
      // owner ⇒ all access implied; member ⇒ dependency-resolved explicit list
      effectivePermissions: isOwnerActive
        ? 'OWNER_ALL'
        : applyFinancialDependencies(activePermissions ?? []),
    });
  }, [activeResolved, isOwnerActive, activePermissions]);

  // ─── Device spine gate (Fix 2 enrollment + Fix 3 is_active lockout) ──────────
  // FLAG-GATED: the entire effect early-returns when deviceEnrollment is false, so
  // for a vertical that does not opt in (Ignition) there is NO enrollment call, NO
  // member_devices read, NO signOut — a pure no-op. Enrollment/lockout run on the
  // real email session (auth.uid() non-null) once an active member is resolved.
  const activeMemberId = activeResolved?.memberId ?? null;
  const activeBusinessResolvedId = activeResolved?.business.id ?? null;
  const [deviceLocked, setDeviceLocked] = useState(false);
  const deviceGatedRef = useRef<string | null>(null); // member_id last gated (idempotency)

  useEffect(() => {
    if (!deviceEnrollment) return;                      // opt-in OFF → inert
    if (loading) return;                                // wait for a settled resolution
    if (!activeMemberId || !activeBusinessResolvedId) return; // no member row (legacy owner) → no-op
    if (deviceGatedRef.current === activeMemberId) return;    // already gated this member
    deviceGatedRef.current = activeMemberId;

    let cancelled = false;
    enrollAndGateDevice(activeMemberId, activeBusinessResolvedId)
      .then(status => {
        if (cancelled) return;
        if (status === 'disabled') {
          // Disabled device: deny access even though the password session was minted —
          // PIN/device are unlock gestures ON TOP of the session, and this device is revoked.
          setDeviceLocked(true);
          void supabase.auth.signOut();
        }
      })
      .catch(() => { /* fail OPEN — never lock out on an unexpected error */ });

    return () => { cancelled = true; };
  }, [deviceEnrollment, loading, activeMemberId, activeBusinessResolvedId]);

  // Picker is needed when: not loading, no error, 2+ businesses, no valid selection
  const needsPicker =
    !loading &&
    businessError === null &&
    resolvedBusinesses.length > 1 &&
    activeResolved === null;

  return (
    <BusinessContext.Provider value={{
      business: activeBusiness,
      businessId: activeBusiness?.id ?? null,
      businesses: allBusinesses,
      activeBusinessId: activeBusiness?.id ?? null,
      setActiveBusinessId,
      businessError,
      loading,
      reload: () => setTick(t => t + 1),
      userPermissions: activeResolved?.permissions ?? null,
      isOwner: isOwnerActive,
      userEmail,
      userName: activeName,
      role: activeRole,
      can,
    }}>
      {deviceEnrollment && deviceLocked
        ? <DeviceLockedScreen />
        : needsPicker
          ? <BusinessPicker businesses={allBusinesses} onSelect={setActiveBusinessId} addBusinessHref={addBusinessHref} />
          : children}
    </BusinessContext.Provider>
  );
}

export function useBusinessContext(): BusinessContextValue {
  return useContext(BusinessContext);
}

// Convenience hook for the permission chokepoint. Prefer this over inline
// userPermissions.includes() at gate sites so all checks route through one path.
export function useCan(): (permissionId: string) => boolean {
  return useContext(BusinessContext).can;
}
