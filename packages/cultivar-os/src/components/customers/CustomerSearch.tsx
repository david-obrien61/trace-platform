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
// 🔴 THE ONE ORDER-PATH SEARCH (R-19, 2026-08-25). BOTH doors that put a customer on an order mount
//               THIS component: `/checkout/customer` (`CustomerCapture`) and the scan-loop attach
//               sheet (`ScanOrder`). The scan door used to carry its OWN search matching
//               `first_name`/`last_name` ONLY, with its own 14-column select literal — so "hoa"
//               found Cedar Park HOA there and Cedar Park HOA *plus Diane Foster* on the roster.
//               Two doors onto one act cannot answer "who exists" differently; tech-debt #116 and
//               #117 are retired by that mount, not by a second fix.
// MATCHES ON:   🔴 `CUSTOMER_SEARCH_FIELDS` — the registry's list, NOT this file's. It WAS a
//               hand-written SIX-field array here (first/last/organization/display/email/phone)
//               while the `/customers` roster searched TEN, so the two surfaces disagreed about
//               who exists: measured live, "cedar" returned TWO rows on the roster and ONE in
//               checkout, because the missed row matched on its CITY.
//               PLUS one derived term: a phone-shaped query adds `phone.ilike.%512%555%0101%`,
//               separators as wildcards, so any stored format of the same number is found. That
//               CLOSES the cross-format gap this header used to record as a limitation.
// ⚠️ NOT SHARED:  the IMPLEMENTATION, with the ROSTER. This composes a PostgREST `.or()` filter the
//               SERVER runs; the roster filters a client-side haystack over already-fetched rows.
//               Different layer, different output type — the FIELD SET is shared and nothing else
//               is. Consequence, stated rather than discovered: a MULTI-WORD term spanning two
//               columns ("foster 512") matches the roster's joined haystack and CANNOT match any
//               single `ilike` here. The two ORDER doors have no such gap — they are one component.
// COLUMNS:      `CUSTOMER_ORDER_COLS` — DERIVED from the field registry (A4/E6), with
//               `CUSTOMER_ORDER_COLS_CORE` as the ungated deploy-window retry. The projection now
//               carries the ADDRESS, which is what lets selection fill the form completely (B2).
// 🔴 B4:         a capped result SAYS SO — "Showing 25 of 34 matches" — because a truncated list
//               read as a complete one is how a cashier concludes someone is absent and creates the
//               duplicate this component exists to prevent.
// DEPENDENCIES: supabase (customers, business_id-scoped, RLS-gated), the field registry,
//               phoneMatchKey. NO new endpoint, NO migration.
// INSTRUMENTATION (STD-003): `[TRACE:customers] search` — ON by default.
// ============================================================
import { useState } from 'react';
import { Search, UserPlus, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { phoneMatchKey } from '@trace/shared/utils/normalizePhone';
import { CUSTOMER_ORDER_COLS, CUSTOMER_ORDER_COLS_CORE, CUSTOMER_SEARCH_FIELDS } from './customerFieldRegistry';

/** 🔴 R-19 · THE HIT CARRIES WHAT THE COPY NEEDS — INCLUDING THE ADDRESS.
 *  This interface used to stop at `tax_exempt_reason`, which is why `onSelectExisting` could not
 *  have filled City and ZIP however carefully it had been written: the columns were never fetched.
 *  Its shape is the projection `CUSTOMER_ORDER_FIELDS` declares, and `customerFieldCoverage.test.ts`
 *  §C asserts the two agree — a field added to the list and not to this type is a RED BUILD. */
export interface CustomerSearchHit {
  id: string;
  first_name: string;
  last_name: string | null;
  organization_name?: string | null;
  display_name?: string | null;
  customer_type?: string | null;
  phone: string | null;
  email: string | null;
  // the address, BOTH column sets — resolution is billing-first with a legacy fallback (D-41), and
  // a fallback needs both halves present to fall back TO.
  billing_line1?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_zip?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  price_tier?: string | null;
  tax_exempt?: boolean | null;
  tax_exempt_reason?: string | null;
  tax_exempt_cert_ref?: string | null;
  marketing_opt_in?: boolean | null;
}

/** The three outcomes, as a type — so a caller cannot render one as another. */
type SearchState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'no-permission' }
  | { kind: 'no-match'; query: string }
  /** `total` is the number of customers that MATCHED, which is not the number SHOWN when the
   *  server capped the page. B4: the two must never be conflated on screen. `null` = the count was
   *  not returned (see the retry path), and the notice is then withheld rather than guessed. */
  | { kind: 'hits'; hits: CustomerSearchHit[]; total: number | null }
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

/** How many matches one search shows. Named ONCE so the query and the notice cannot disagree about
 *  it — a hardcoded 25 in the `.limit()` and a hardcoded 25 in the copy is the two-representations
 *  problem in miniature, and the copy is the half that would drift. */
const PAGE = 25;

/** B4 · THE TRUNCATION NOTICE — the bar is "say when you narrow", so this renders the SHOWN and the
 *  TOTAL, never just one. `#114`'s pattern, matching `DataSheet.tsx:296`'s "N of M shown" pill,
 *  which the roster already does correctly. */
const noticeBox: React.CSSProperties = {
  marginTop: 12, padding: '10px 14px', borderRadius: 10,
  background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e',
  fontSize: '0.82rem', lineHeight: 1.5,
};

/** How a customer is NAMED on screen — an organization by its organization name, a person by
 *  first+last. EXPORTED (R-19) so the scan door's attach strip labels the customer exactly as the
 *  picker row it was chosen from did. Before this, the strip printed `first_name` unconditionally,
 *  so an organization customer could be picked as "Cedar Park HOA" and then attach as its contact. */
export function customerDisplayName(h: CustomerSearchHit): string {
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

    // 🔴 THE SANITISER STRIPS FOUR CHARACTERS, NOT TWO — AND THE TWO IT GAINED ARE THE ONES A
    // CASHIER ACTUALLY TYPES. `(` and `)` are PostgREST's own grouping syntax inside `.or(...)`, so
    // a pasted `(512) 555-0101` closed the group early and the whole filter failed to parse — an
    // honest error, but a dead end on the most natural way to look someone up by phone. `ScanOrder`
    // stripped all four and this file stripped two (tech-debt #117, the sanitiser split). Unifying
    // the two searches meant one regex had to win: it is the SAFER one, so retiring the third search
    // could not regress the door it replaced.
    const safe = q.replace(/[,%()]/g, ' ');
    const like = `%${safe}%`;
    // 🔴 ONE FIELD LIST, EVERY SEARCH. This was a SIX-field literal while the roster searched
    // TEN — so a customer visible on `/customers` could be unfindable at the register, and the
    // cashier's honest next move is to create the duplicate `CustomerSearch` exists to prevent.
    // DERIVED, never re-typed: a field added to `CUSTOMER_SEARCH_FIELDS` joins EVERY search at once.
    const parts = CUSTOMER_SEARCH_FIELDS.map(f => `${f}.ilike.${like}`);

    // 🔴 PHONE, CROSS-FORMAT — AND THIS IS WHY STRIPPING THE PARENS IS NOT ENOUGH ON ITS OWN.
    // After sanitising, `(512) 555-0101` is ` 512  555-0101`, which `ilike` will NOT match against
    // the stored `(512) 555-0101` — the separators differ. So a phone-shaped query gets ONE extra
    // term whose separators are WILDCARDS: `%512%555%0101%`. That matches every format the same
    // number can be stored in — `(512) 555-0101`, `512-555-0101`, `512.555.0101`, `5125550101` —
    // and it is the ONE place a `%` is legitimately a wildcard, because we built it from digits we
    // extracted ourselves rather than from anything the user typed. `phoneMatchKey` supplies the
    // last-10 rule so the digits agree with the platform's storage normalizer.
    const digits = phoneMatchKey(q);
    if (digits && digits.length === 10) {
      parts.push(`phone.ilike.%${digits.slice(0, 3)}%${digits.slice(3, 6)}%${digits.slice(6)}%`);
    }

    console.log('[TRACE:customers] search', {
      businessId, q,
      searchableFields: CUSTOMER_SEARCH_FIELDS.length,
      searchable: CUSTOMER_SEARCH_FIELDS.join(','),
      phoneDigits: digits ?? '(not phone-shaped)',
      terms: parts.length,
    });

    // 🔴 `count: 'exact'` IS WHAT MAKES B4 POSSIBLE. PostgREST returns the number of rows that
    // MATCHED independently of `.limit()`, so "25 of 34" is a measurement rather than an inference.
    // Without it the page can only ever say "25", which a cashier correctly reads as "that's all of
    // them" — and then creates the duplicate.
    const runSearch = (cols: string) => supabase
      .from('customers')
      .select(cols, { count: 'exact' })
      .eq('business_id', businessId)
      .or(parts.join(','))
      .limit(PAGE);

    let { data, error, count } = await runSearch(CUSTOMER_ORDER_COLS);

    // DEPLOY-WINDOW RETRY. The 2026-07-13 columns (`billing_*`, `organization_name`, `display_name`,
    // `tax_exempt*`) answer 42703 on a database that has not had those migrations applied. Retrying
    // with the UNGATED subset keeps the search WORKING — narrower, and it says so in the trace —
    // instead of failing the whole customer step. This is `ScanOrder`'s strip-and-retry, which this
    // component absorbed when it replaced that search; dropping it would have been a regression on
    // the door being retired, which is the one thing a consolidation must not do.
    if (error && (error.code === '42703' || error.code === 'PGRST204')) {
      console.log('[TRACE:customers] search — gated columns absent, retrying on the ungated subset (migration pending)',
        { code: error.code, cols: CUSTOMER_ORDER_COLS_CORE });
      ({ data, error, count } = await runSearch(CUSTOMER_ORDER_COLS_CORE));
    }

    if (error) {
      // A missing gated column (deploy window) is not an authorization failure — keep them apart.
      console.error('[TRACE:customers] search error', error.code, error.message);
      setState({ kind: 'error', message: 'Customer search is unavailable right now. Try again, or ask the owner.' });
      return;
    }

    const hits = (data ?? []) as unknown as CustomerSearchHit[];

    // ✅ THE CROSS-FORMAT PHONE GAP THIS BLOCK USED TO *REPORT* IS NOW CLOSED AT THE QUERY, above.
    // The old code re-matched the RETURNED set on digits and logged when a phone-shaped query came
    // back empty — which could refine what the server sent but could never FIND a differently
    // formatted number the `ilike` had already missed. It named its own limitation honestly and
    // that limitation was the defect. The wildcard-separator term does the finding; this line only
    // records what a phone-shaped query resolved to, so GATE 0 is readable from the console.
    if (digits) console.log('[TRACE:customers] search — phone-shaped query', { digits, matched: hits.length });

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
    setState({ kind: 'hits', hits, total: typeof count === 'number' ? count : null });
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

      {/* 🔴 B4 · SAY WHEN YOU NARROW — AND SAY IT ABOVE THE LIST, NOT UNDER IT.
          THE SCENE THIS EXISTS FOR: ~1,900 customers, a cashier searches "smith", sees a full-looking
          list, concludes the person is not there, and creates a duplicate. That is the call David
          does not want after he leaves, and a count printed BELOW twenty-five rows is a count nobody
          scrolled to. `total` is the server's exact match count, so this is measured, not inferred;
          when the count did not come back it is `null` and NOTHING is claimed (A9 — an unknown
          rendered as a fact is the failure this whole build is about). */}
      {state.kind === 'hits' && state.total !== null && state.total > state.hits.length && (
        <div style={noticeBox}>
          <strong>Showing {state.hits.length} of {state.total} matches.</strong>{' '}
          Add a last name, a phone number, or part of their address to narrow it down — the customer
          you want may be one of the {state.total - state.hits.length} not shown.
        </div>
      )}

      {/* HITS */}
      {state.kind === 'hits' && (
        <div style={{ ...box, marginTop: 12, overflow: 'hidden' }}>
          {state.hits.map(h => (
            <button key={h.id} type="button" onClick={() => onSelect(h)} style={row}>
              <span>
                <span style={{ fontWeight: 700, color: '#1f2937' }}>{customerDisplayName(h)}</span>
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
