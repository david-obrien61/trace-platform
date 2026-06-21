import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import { can as sharedCan } from '../auth/permissions';
import { applyFinancialDependencies } from '../auth/financialPermissions';

const SM_DEBUG = false; // flip to true to re-enable legacy [SM-TRACE] diagnostics

// Per-vertical localStorage key — isolates Cultivar selection from Ignition selection
const activeBusinessKey = (businessType: string) =>
  `trace_active_business_${businessType}`;

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

// ─── Provider ─────────────────────────────────────────────────────────────────

export function BusinessProvider({
  children,
  businessType,
  addBusinessHref,
}: {
  children: React.ReactNode;
  businessType: string;
  addBusinessHref?: string;  // when provided, "Add a business" link appears in BusinessPicker
}) {
  // All businesses this user can access in this vertical
  const [resolvedBusinesses, setResolvedBusinesses] = useState<ResolvedBusiness[]>([]);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  // Persisted active selection — initialized from localStorage, survives reload
  const [activeBusinessId, setActiveBusinessIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(activeBusinessKey(businessType)); } catch { return null; }
  });

  const setActiveBusinessId = (id: string) => {
    try { localStorage.setItem(activeBusinessKey(businessType), id); } catch {}
    setActiveBusinessIdState(id);
  };

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

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setResolvedBusinesses([]);
          setBusinessError(null);
          setLoading(false);
        }
        return;
      }

      const resolved: ResolvedBusiness[] = [];

      // 1. Owner path — fetch ALL businesses this user owns
      //    [TEMP — OPEN ACCESS] business_type filter bypassed so David sees ALL his
      //    businesses to operate now (TRACE Enterprises=general, LAWNS=nursery, etc.).
      //    Re-scope to per-app-type model later when one-app-skinned routing is built.
      //    Restore: uncomment the .eq('business_type', businessType) line below.
      const { data: ownedBizzes } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', user.id);
        // .eq('business_type', businessType); // [TEMP — OPEN ACCESS] restore to re-scope

      console.log('[TRACE:BUSINESS] owner path', {
        userId: user.id,
        businessType,
        count: ownedBizzes?.length ?? 0,
        ids: ownedBizzes?.map(b => b.id) ?? [],
      });

      for (const biz of (ownedBizzes ?? [])) {
        resolved.push({ business: biz as Business, isOwner: true, permissions: null });
      }

      // 2. Member path — fetch ALL business_members rows for this user, active=true
      //    Filter by business_type to prevent cross-vertical data exposure (audit #13)
      //    (was .single(); now returns the full array)
      const { data: memberships } = await supabase
        .from('business_members')
        .select('business_id, role, permissions, businesses(*)')
        .eq('user_id', user.id)
        .eq('active', true);

      console.log('[TRACE:BUSINESS] member path', {
        userId: user.id,
        businessType,
        membershipCount: memberships?.length ?? 0,
      });

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
        });
      }

      if (cancelled) return;

      if (resolved.length === 0) {
        console.log('[TRACE:BUSINESS] result: no_business — both paths returned nothing', { userId: user.id, businessType });
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
      can,
    }}>
      {needsPicker
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
