// ============================================================
// Vendors — who we buy from, which one is preferred, and WHY.
//
// PURPOSE:      Terry buys the same tree from two vendors. A is cheaper and the stock is lower
//               quality; B costs more and is better. "Quality" is not a field on anything — it is
//               his judgement from having bought from both. This screen is where that judgement
//               is recorded and where Lauren reads it when he is not on site.
//
//               🔴 THE NOTE IS THE ASSET. THE FLAG IS NOT. The mark says which row to look at;
//               the note says why — and why is what she needs when the preferred vendor is out
//               of stock. Ignition captured exactly this judgement as an owner-set `priority`
//               integer, rendered it on a card, and never read it: zero sorts, zero comparisons,
//               zero decisions, with vendor selection done by `vendors[idx % vendors.length]`.
//               Here the mark is read — by this screen, and by the capture resolver.
//
// 🔴 E7 / R-83 (2026-09-04) — THE CONTROL MOVED AND THE ROW KEPT ONLY THE RESULT.
//               This page used to hold *"Why is this vendor preferred?"* and *"Save as preferred"*
//               INSIDE the row. It no longer does: the control and its note live in
//               `VendorEditor`, the modal over the opened record, and the row carries a
//               READ-ONLY `PREFERRED` chip. Two constraints travel with that chip and both are
//               asserted rather than intended:
//                 · §5 cl.4 — it carries what only THIS row knows (preferred-ness), never what
//                   the subhead already said.
//                 · G8 — it must NOT read as clickable. No onClick, no cursor:pointer, no
//                   role/tabIndex, and `aria-hidden` on nothing it needs. A mark that looks like
//                   a control and is not is a DEAD AFFORDANCE — the defect this clause would
//                   otherwise trade for the one it fixes.
//
// ⚠️ THE ROW IS NOT A CLICK TARGET, AND THAT IS G10's OWN EXCLUSION, NOT AN OMISSION. G10 makes
//               a row clickable *"ONLY on a grid that HAS an expansion — a grid without one must
//               not acquire a mystery click target."* This is a card list with no disclosure, so
//               the record is opened by an explicit named button per row.
//
// ⚠️ THE NOTE NOW LIVES IN THE MODAL, BY DAVID'S RULING 2026-09-04 (*"the control and the note go
//               in the modal, together"*). A manager still SEES it — `VendorEditor` renders the
//               mark and the reason read-only, with the explanation of why it is not editable —
//               but she opens the record to read it instead of scanning it off the list. That is
//               a real change in what one glance buys, taken deliberately, and owner-test CARD 7
//               is rewritten to the new surface rather than left asserting the old one.
//
//               BOTH VENDORS ALWAYS APPEAR. A preference MARKS; it does not filter — and the
//               order is alphabetical, not preference-first, because a sort is the quiet form of
//               a filter and the unmarked vendor IS the answer on the day the preferred one is
//               out of stock. That decision lives in `orderVendorsForDisplay` where a probe can
//               reach it (tech-debt #134 — a render condition inside a .tsx cannot be asserted).
//
// UI STANDARD (§6 r16 — name the standard, then decide): the established pattern for a
//               homogeneous record set is a DATA GRID, and this platform has one (`<DataSheet>`).
//               DEVIATED DELIBERATELY: at 8 distinct vendor strings across the whole database
//               there is nothing here to virtualise, sort or filter, and the row carries a
//               free-prose `notes` field a grid cell would truncate. Pattern taken instead: the
//               standard RECORD LIST — a scannable row per record, opening into a modal form.
//               ⚠️ THE ORIGINAL REASON FOR THIS DEVIATION NO LONGER APPLIES AND IS RECORDED AS
//               WITHDRAWN RATHER THAN QUIETLY DROPPED: it argued the grid was wrong because
//               `preference_note` had to be displayed WITH the mark on the row. Under E7 the note
//               is in the modal, so that argument is gone. The deviation still holds on the
//               remaining grounds above — but it is now a WEAKER case than it was, and the next
//               session to touch this file should re-answer it rather than inherit it.
//               Its clause-by-clause answers live in docs/decisions/ui-standard-divergences.json.
//
// GATE:         READING is MEMBERSHIP-scoped and deliberately NOT `costs:read`. A
//               vendor's NAME is not its cost basis; binding the two would put the preferred mark
//               behind the confidential-cost gate and Lauren would lose sight of the thing this
//               screen is for. `vendors` carries owner + member RLS on business_id
//               (20260902_vendor_identity_and_preference.sql §5) and the nav node is
//               required_permission: 'member' — nav and route agree by construction.
//
//               SETTING the preference is OWNER-ONLY and enforced SERVER-SIDE by a trigger on
//               both INSERT and UPDATE (§4 of that migration). The UI hides the control from a
//               non-owner AND says why (§6 r13: locked-with-explanation, never mystery-locked) —
//               but the hiding is not the enforcement, and acceptance proves it by attempting.
//
// DEPENDENCIES: `../lib/supabase` (TWO SELECTS ONLY — this page no longer writes) ·
//               `../components/vendors/VendorEditor` (every write, E1) · `@trace/shared/context`
//               (businessId, can) · `@trace/shared/business-logic` (orderVendorsForDisplay,
//               vendorListHeading — every decision, so probes can reach them).
//               NO new endpoint, NO new api/ function, the 12/12 ceiling is untouched.
//
// OUTPUTS:      /vendors. Reads vendors + vendor_aliases. All WRITES go through `VendorEditor`
//               (E1 — this page performs none): the full editable set for any active member, plus
//               `preferred`/`preference_note` for an owner only, enforced by trigger.
//
// INSTRUMENTATION (STD-003): `[TRACE:VENDOR]` on load and on opening a record; the write trail
//               lives with the writer, in `VendorEditor`. ON BY DEFAULT until OWNER-PROVEN.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import {
  orderVendorsForDisplay, vendorListHeading, VENDORS_SELECT, VENDOR_ALIASES_SELECT,
  type VendorRow, type VendorAliasRow,
} from '@trace/shared/business-logic';
import VendorEditor from '../components/vendors/VendorEditor';

const TRACE_VENDOR = true;

type Phase =
  | { phase: 'loading' }
  | { phase: 'failed'; message: string }
  | { phase: 'loaded'; vendors: VendorRow[]; aliases: VendorAliasRow[] };

const PAGE: React.CSSProperties = { padding: '1.25rem', maxWidth: 880, margin: '0 auto' };
const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: '1.25rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 16,
};
const H: React.CSSProperties = { fontSize: '1.125rem', fontWeight: 700, color: '#27500A', margin: 0 };
const SUB: React.CSSProperties = { fontSize: '0.8125rem', color: '#64748b', marginTop: 4 };
const ROW: React.CSSProperties = {
  border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', marginTop: 12,
};
const NAME: React.CSSProperties = { fontWeight: 700, color: '#1f2937', fontSize: '0.9375rem' };
const META: React.CSSProperties = { fontSize: '0.8125rem', color: '#64748b' };
const LINE1: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'baseline', justifyContent: 'space-between',
};
const MARK: React.CSSProperties = {
  display: 'inline-block', padding: '2px 8px', borderRadius: 999,
  fontSize: '0.6875rem', fontWeight: 700, color: '#27500A', background: '#eaf3de',
  border: '1px solid #cfe0b8',
};
const ABSENCE: React.CSSProperties = {
  fontSize: '0.8125rem', color: '#6b7280', background: '#f9fafb',
  border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', marginTop: 8,
};
const BTN: React.CSSProperties = {
  minHeight: 44, padding: '0 14px', borderRadius: 8, border: '1px solid #27500A',
  background: '#fff', color: '#27500A', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
};
const SECTION_LABEL: React.CSSProperties = {
  fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: '#94a3b8', marginTop: 10, marginBottom: 4,
};

export default function Vendors() {
  const { businessId, can } = useBusinessContext();

  // 🔴 THIS WAS `role === 'OWNER'` AND capA REFUSED IT, CORRECTLY. Authority comes from a
  //    permission string the session HOLDS, never from a role compare — the cap is build-failing
  //    precisely so a fourth surface does not re-key authority on identity the way
  //    20260828_owner_role_carries_authority.sql catalogued on three.
  //
  //    `owner-only` is the platform's existing sentinel for this and is already the accepted
  //    idiom (AppLayout's owner-only render gate, Dashboard's readout fallback). It gives the
  //    exact semantics needed here, AND it covers the case the role compare was reaching for:
  //    a session whose ROLE is OWNER resolves to OWNER_LOCKED_SET, so Lauren Bishop — role OWNER
  //    at LAWNS, and NOT `businesses.owner_id`, measured live 2026-09-02 — passes without
  //    `owner_id` being consulted at all. Two owners are expressible; a role compare was the
  //    long way round to a worse version of what `can()` already does.
  const canSetPreference = can('owner-only');

  const [state, setState] = useState<Phase>({ phase: 'loading' });
  // `undefined` = closed · `null` = open in CREATE mode · a row = open in EDIT mode.
  // Three states, because "closed" and "creating" are genuinely different and a single nullable
  // cannot say which is which.
  const [editing, setEditing] = useState<VendorRow | null | undefined>(undefined);

  const load = useCallback(async () => {
    if (!businessId) return;
    setState({ phase: 'loading' });
    const [v, a] = await Promise.all([
      supabase.from('vendors')
        .select(VENDORS_SELECT)
        .eq('business_id', businessId)
        // ⚠️ `.returns<>()` IS REQUIRED HERE AND IT IS A CONSEQUENCE OF E6, NOT A SHORTCUT.
        //    supabase-js infers the row shape from a LITERAL select string. `VENDORS_SELECT` is
        //    now DERIVED from the field lists (tech-debt #179), so its type is plain `string` and
        //    the client can no longer infer — it widens to GenericStringError[]. Stating the row
        //    type at the boundary is the honest fix; casting the result through `unknown` would
        //    silence the same problem while asserting more.
        .returns<VendorRow[]>(),
      supabase.from('vendor_aliases')
        .select(VENDOR_ALIASES_SELECT)
        .eq('business_id', businessId),
    ]);
    if (v.error) {
      if (TRACE_VENDOR) console.log('[TRACE:VENDOR] load failed —', v.error.message);
      setState({ phase: 'failed', message: v.error.message });
      return;
    }
    const vendors = v.data ?? [];
    const aliases = (a.data ?? []) as VendorAliasRow[];
    if (TRACE_VENDOR) {
      console.log('[TRACE:VENDOR] loaded — vendors:', vendors.length,
        'aliases:', aliases.length,
        'preferred:', vendors.filter(x => x.preferred).length,
        'canSetPreference:', canSetPreference,
        aliases.length === 0 && a.error ? `aliases read failed: ${a.error.message}` : '');
    }
    setState({ phase: 'loaded', vendors, aliases });
  }, [businessId, canSetPreference]);

  useEffect(() => { void load(); }, [load]);

  if (!businessId) return <div style={PAGE}><div style={CARD}><p style={META}>No business selected.</p></div></div>;

  if (state.phase === 'loading') {
    return <div style={PAGE}><div style={CARD}><h2 style={H}>Vendors</h2><p style={SUB}>Loading…</p></div></div>;
  }

  if (state.phase === 'failed') {
    return (
      <div style={PAGE}><div style={CARD}>
        <h2 style={H}>Vendors</h2>
        <div style={ABSENCE}>The vendor list could not be read. {state.message}</div>
        <button style={{ ...BTN, marginTop: 12 }} onClick={() => void load()}>Try again</button>
      </div></div>
    );
  }

  const ordered = orderVendorsForDisplay(state.vendors);
  const { heading, subhead } = vendorListHeading(state.vendors, { canSetPreference });

  return (
    <div style={PAGE}>
      <div style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={H}>{heading}</h2>
            <p style={SUB}>{subhead}</p>
          </div>
          <button style={BTN} onClick={() => setEditing(null)}>Add vendor</button>
        </div>

        {ordered.length === 0 && (
          <div style={ABSENCE}>
            No vendors yet. One is recorded the first time you capture a document from them — or
            add one here.
          </div>
        )}

        {ordered.map((v) => {
          const aliases = state.aliases.filter(a => a.vendor_id === v.id);
          const contact = [
            v.email, v.phone,
            v.account_number ? `Acct ${v.account_number}` : null,
            v.website,
          ].filter(Boolean);
          const address = [v.address_line1, v.address_city, v.address_state, v.address_zip]
            .filter(Boolean).join(', ');
          return (
            <div key={v.id} style={ROW}>
              <div style={LINE1}>
                <span style={NAME}>{v.name}</span>
                {/* 🔴 READ-ONLY MARK (E7 + G8). No onClick, no cursor:pointer, no role, no
                    tabIndex — it states a fact about this row and offers nothing. The control
                    that SETS it is in the modal. A chip that looked pressable and did nothing
                    would be the dead affordance G8 forbids. */}
                {v.preferred === true && <span style={MARK}>PREFERRED</span>}
              </div>

              {contact.length > 0 && (
                <>
                  <div style={SECTION_LABEL}>Contact</div>
                  <div style={META}>{contact.join('  ·  ')}</div>
                </>
              )}

              {address && (
                <>
                  <div style={SECTION_LABEL}>Address</div>
                  <div style={META}>{address}</div>
                </>
              )}

              {aliases.length > 0 && (
                <>
                  <div style={SECTION_LABEL}>Also bills as</div>
                  <div style={META}>{aliases.map(a => a.alias).join('  ·  ')}</div>
                </>
              )}

              {/* The record is OPENED here. This button navigates; it changes nothing (E7). Its
                  label says what the actor can actually do, because a manager may edit every
                  field except the preference pair and "View" would understate that. */}
              <div style={{ marginTop: 10 }}>
                <button
                  style={BTN}
                  onClick={() => {
                    if (TRACE_VENDOR) console.log('[TRACE:VENDOR] open record —', v.id, v.name);
                    setEditing(v);
                  }}
                >Edit vendor</button>
              </div>
            </div>
          );
        })}
      </div>

      {editing !== undefined && (
        <VendorEditor
          vendor={editing}
          businessId={businessId}
          canSetPreference={canSetPreference}
          onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); void load(); }}
        />
      )}
    </div>
  );
}
