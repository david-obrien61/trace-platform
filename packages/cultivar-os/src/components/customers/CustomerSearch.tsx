// ============================================================
// CustomerSearch — SEARCH BEFORE ADD (Cultivar OS checkout)
// PURPOSE:      The customer step of /checkout/* opens on a SEARCH, not a blank form. "Add new" is
//               reachable only as a FALLBACK from a search that found nothing — never a peer button,
//               never a tab.
// WHY IT IS STRUCTURAL, not workflow: D-47 ("Dave's Tree Svs → 3 duplicates", nine real invoices
//               cross-billed) and `customerUpsert`'s dedup key both exist because NOTHING FORCED A
//               LOOK FIRST. A cashier who must search cannot create a duplicate without ignoring one
//               on screen — which moves duplicate creation from an invisible default into a visible
//               choice. This is a NEW build: the customer step has been a blank form in every
//               revision since 7af1a0f, so there is nothing to revert to.
// 🔴 THREE STATES, NEVER CONFLATED (A9 — an absence rendered as a fact):
//               NO PERMISSION → "You cannot search customers…" and **NO Add-new fallback**, because
//                               creating is not the answer to being unable to look. This is the
//                               build's own failure mode arriving through the permission layer: a
//                               cashier without `customers:read` gets zero rows from RLS, would read
//                               that as "no such customer", and would create the duplicate.
//               NO MATCH      → "No customer found" + Add new.
//               EMPTY QUERY   → a prompt; neither of the above.
// MATCHES ON:   name (first / last / organization / display) OR email OR phone. Phone is the
//               strongest identity signal a cashier has and the customer is standing there to say
//               it. Phone uses `phoneMatchKey` (digits, last 10) — NOT `normalizePhone`, which is a
//               STORAGE normalizer that preserves the human format and would miss
//               "(512) 456-3632" vs "5124563632", the exact case this search exists to catch.
// COLUMNS:      `CUSTOMER_SEARCH_COLS` — DERIVED from the field registry (A4/E6). A new read path
//               written with a literal column string would fail `verify:field-lists`.
// DEPENDENCIES: supabase (customers, business_id-scoped, RLS-gated), the field registry,
//               phoneMatchKey. NO new endpoint, NO migration.
// INSTRUMENTATION (STD-003): `[TRACE:customers] search` — ON by default.
// ============================================================
import { useState } from 'react';
import { Search, UserPlus, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { phoneMatchKey } from '@trace/shared/utils/normalizePhone';
import { CUSTOMER_SEARCH_COLS } from './customerFieldRegistry';

export interface CustomerSearchHit {
  id: string;
  first_name: string;
  last_name: string | null;
  organization_name?: string | null;
  display_name?: string | null;
  customer_type?: string | null;
  phone: string | null;
  email: string | null;
  price_tier?: string | null;
  tax_exempt?: boolean | null;
  tax_exempt_reason?: string | null;
}

/** The three outcomes, as a type — so a caller cannot render one as another. */
type SearchState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'no-permission' }
  | { kind: 'no-match'; query: string }
  | { kind: 'hits'; hits: CustomerSearchHit[] }
  | { kind: 'error'; message: string };

interface Props {
  businessId: string;
  /** Chosen an existing customer — checkout continues with that record. */
  onSelect: (hit: CustomerSearchHit) => void;
  /** Fallback ONLY from `no-match`. Never offered from `no-permission`. */
  onAddNew: (seed: { query: string }) => void;
}

const box: React.CSSProperties = { border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff' };
const row: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
  padding: '14px 16px', borderTop: '1px solid #f3f4f6', minHeight: 48, cursor: 'pointer',
  background: 'none', border: 'none', width: '100%', textAlign: 'left',
};
const pill = (bg: string, fg: string): React.CSSProperties => ({
  fontSize: '0.72rem', fontWeight: 700, color: fg, background: bg, borderRadius: 6, padding: '2px 7px',
});

function displayName(h: CustomerSearchHit): string {
  if (h.customer_type === 'organization') return h.organization_name?.trim() || h.first_name;
  return `${h.first_name} ${h.last_name ?? ''}`.trim() || h.first_name;
}

export function CustomerSearch({ businessId, onSelect, onAddNew }: Props) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>({ kind: 'idle' });

  async function run() {
    const q = query.trim();
    if (!q) { setState({ kind: 'idle' }); return; }
    setState({ kind: 'searching' });

    const like = `%${q.replace(/[%,]/g, ' ')}%`;
    const parts = [
      `first_name.ilike.${like}`,
      `last_name.ilike.${like}`,
      `organization_name.ilike.${like}`,
      `display_name.ilike.${like}`,
      `email.ilike.${like}`,
      `phone.ilike.${like}`,
    ];
    console.log('[TRACE:customers] search', { businessId, q });

    const { data, error } = await supabase
      .from('customers')
      .select(CUSTOMER_SEARCH_COLS)
      .eq('business_id', businessId)
      .or(parts.join(','))
      .limit(25);

    if (error) {
      // A missing gated column (deploy window) is not an authorization failure — keep them apart.
      console.error('[TRACE:customers] search error', error.code, error.message);
      setState({ kind: 'error', message: 'Customer search is unavailable right now. Try again, or ask the owner.' });
      return;
    }

    const hits = (data ?? []) as unknown as CustomerSearchHit[];

    // 🔴 PHONE, CROSS-FORMAT. The `phone.ilike` above only catches a query typed in the SAME shape as
    // the stored value. When the query looks like a phone, re-match the returned set on digits so
    // "5124563632" finds "(512) 456-3632". LIMITATION, STATED: this refines what the server already
    // returned — it cannot FIND a differently-formatted number the ilike missed. Closing that needs a
    // normalized `phone_digits` column or a DB function; filed rather than left as a silent gap.
    const key = phoneMatchKey(q);
    if (key && hits.length === 0) {
      console.log('[TRACE:customers] search — phone-shaped query missed by ilike (cross-format gap)', { key });
    }

    // 🔴 ZERO ROWS IS AMBIGUOUS UNDER RLS and CANNOT be fully disambiguated client-side (A9). A
    // member without `customers:read` gets zero rows and NO error — identical to "no such customer".
    // A count probe separates only the ERROR case, so the split is drawn where it is provable:
    //
    //   probe ERRORS            → no permission. Never offer Add new: creating is not the answer to
    //                             being unable to look.
    //   probe returns 0, no err → treated as NO MATCH, and Add new IS offered.
    //
    // 🔴 WHY THAT DIRECTION, because the other one is a worse bug: a brand-new tenant genuinely has
    // zero customers, and calling that "no permission" would BLOCK THE FIRST CUSTOMER EVER ADDED —
    // on the demo path. The residual risk (a permission-less cashier offered Add new) is caught one
    // layer down: the INSERT is separately gated and now A8-checked, so they get an honest refusal at
    // Save rather than a silent success. A wrong "no permission" has no such safety net.
    if (hits.length === 0) {
      const { count, error: probeErr } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId);
      if (probeErr) {
        console.log('[TRACE:customers] search REFUSED — probe errored, offering no Add-new fallback',
          { businessId, probeError: probeErr.message });
        setState({ kind: 'no-permission' });
        return;
      }
      console.log('[TRACE:customers] search — no match', { businessId, q, readableRows: count });
      setState({ kind: 'no-match', query: q });
      return;
    }
    setState({ kind: 'hits', hits });
  }

  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: 6 }}>
        Find the customer
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); if (state.kind !== 'idle') setState({ kind: 'idle' }); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void run(); } }}
          placeholder="Name, phone, or email"
          autoFocus
          style={{ flex: 1, minHeight: 48, padding: '0 12px', fontSize: '1rem', border: '1px solid #d1d5db', borderRadius: 10 }}
        />
        <button type="button" onClick={() => { void run(); }} disabled={!query.trim() || state.kind === 'searching'}
          style={{ minHeight: 48, padding: '0 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
                   background: '#27500A', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Search size={16} /> {state.kind === 'searching' ? 'Searching…' : 'Search'}
        </button>
      </div>

      {/* EMPTY QUERY — a prompt. Not "no results". */}
      {state.kind === 'idle' && (
        <p style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: 10, lineHeight: 1.5 }}>
          Search by name, phone number, or email. Ask for a phone number — it finds a repeat customer
          fastest.
        </p>
      )}

      {/* HITS */}
      {state.kind === 'hits' && (
        <div style={{ ...box, marginTop: 12, overflow: 'hidden' }}>
          {state.hits.map(h => (
            <button key={h.id} type="button" onClick={() => onSelect(h)} style={row}>
              <span>
                <span style={{ fontWeight: 700, color: '#1f2937' }}>{displayName(h)}</span>
                <span style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginTop: 2 }}>
                  {[h.phone, h.email].filter(Boolean).join(' · ') || 'no phone or email on file'}
                </span>
              </span>
              <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {h.price_tier && h.price_tier !== 'retail' && <span style={pill('#eef2ff', '#3730a3')}>{h.price_tier}</span>}
                {h.tax_exempt && <span style={pill('#dcfce7', '#166534')}>Exempt</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* NO MATCH — the ONLY state that offers Add new. */}
      {state.kind === 'no-match' && (
        <div style={{ ...box, marginTop: 12, padding: 16 }}>
          <p style={{ margin: 0, fontWeight: 700, color: '#1f2937' }}>No customer found for “{state.query}”</p>
          <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: '6px 0 12px', lineHeight: 1.5 }}>
            Check the spelling or try their phone number before adding — a second record for the same
            customer splits their history and their pricing.
          </p>
          <button type="button" onClick={() => onAddNew({ query: state.query })}
            style={{ minHeight: 48, width: '100%', borderRadius: 10, border: '1px solid #27500A', cursor: 'pointer',
                     background: '#fff', color: '#27500A', fontWeight: 700,
                     display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <UserPlus size={16} /> Add a new customer
          </button>
        </div>
      )}

      {/* NO PERMISSION — 🔴 deliberately NO Add-new fallback. */}
      {state.kind === 'no-permission' && (
        <div style={{ ...box, marginTop: 12, padding: 16, borderColor: '#fecaca', background: '#fef2f2' }}>
          <p style={{ margin: 0, fontWeight: 700, color: '#991b1b', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={16} /> You cannot search customers
          </p>
          <p style={{ fontSize: '0.82rem', color: '#7f1d1d', margin: '6px 0 0', lineHeight: 1.5 }}>
            Ask the owner for customer access. Adding a new customer is not offered here — without
            being able to look first, a new record would likely duplicate one that already exists.
          </p>
        </div>
      )}

      {state.kind === 'error' && (
        <div style={{ ...box, marginTop: 12, padding: 16, borderColor: '#fecaca', background: '#fef2f2' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#991b1b' }}>{state.message}</p>
        </div>
      )}
    </div>
  );
}
