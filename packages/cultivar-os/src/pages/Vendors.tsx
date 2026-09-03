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
//               BOTH VENDORS ALWAYS APPEAR. A preference MARKS; it does not filter — and the
//               order is alphabetical, not preference-first, because a sort is the quiet form of
//               a filter and the unmarked vendor IS the answer on the day the preferred one is
//               out of stock. That decision lives in `orderVendorsForDisplay` where a probe can
//               reach it (tech-debt #134 — a render condition inside a .tsx cannot be asserted).
//
// UI STANDARD (§6 r16 — name the standard, then decide): the established pattern for a
//               homogeneous record set is a DATA GRID, and this platform has one (`<DataSheet>`).
//               DEVIATED DELIBERATELY: the load-bearing field here is `preference_note`, free
//               prose of unbounded length that must be READ, not scanned — and a grid cell either
//               truncates it or forces a hover, both of which hide the one thing this screen
//               exists to show (§4: the note is displayed WITH the mark, not behind a hover or a
//               click). Pattern taken instead: the standard RECORD LIST with inline detail, the
//               same shape ReceiptsList uses. At 8 distinct vendor strings across the whole
//               database there is nothing here to virtualise.
//
// GATE:         MEMBERSHIP, not a permission string, and deliberately NOT `costs:read`. A
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
// DEPENDENCIES: `../lib/supabase` (two selects, one update — all RLS-enforced; NO new endpoint,
//               NO new api/ function, the 12/12 ceiling is untouched) · `@trace/shared/context`
//               (businessId, role) · `@trace/shared/business-logic` (orderVendorsForDisplay,
//               vendorListHeading — every decision, so probes can reach them).
//
// OUTPUTS:      /vendors. Reads vendors + vendor_aliases. Writes ONLY `preferred` and
//               `preference_note`, and only when the actor is an owner.
//
// INSTRUMENTATION (STD-003): `[TRACE:VENDOR]` on load, on every preference write, and on refusal.
//               ON BY DEFAULT and stays on until OWNER-PROVEN.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import {
  orderVendorsForDisplay, vendorListHeading,
  type VendorRow, type VendorAliasRow,
} from '@trace/shared/business-logic';

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
// The note is given the visual weight of content, not of a caption — it is the reason, and the
// reason is the point of the screen.
const NOTE: React.CSSProperties = {
  fontSize: '0.875rem', color: '#1f2937', marginTop: 8, lineHeight: 1.5,
  background: '#f7faf2', border: '1px solid #e3edd3', borderRadius: 8, padding: '8px 10px',
};
const ABSENCE: React.CSSProperties = {
  fontSize: '0.8125rem', color: '#6b7280', background: '#f9fafb',
  border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', marginTop: 8,
};
const BTN: React.CSSProperties = {
  minHeight: 44, padding: '0 14px', borderRadius: 8, border: '1px solid #27500A',
  background: '#fff', color: '#27500A', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
};
const TEXTAREA: React.CSSProperties = {
  width: '100%', minHeight: 72, marginTop: 8, padding: '8px 10px', borderRadius: 8,
  border: '1px solid #cbd5e1', fontSize: '0.875rem', fontFamily: 'inherit', lineHeight: 1.5,
};
const SECTION_LABEL: React.CSSProperties = {
  fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: '#94a3b8', marginTop: 10, marginBottom: 4,
};

export default function Vendors() {
  const { businessId, role } = useBusinessContext();

  // The client mirror of the SERVER predicate `public.is_business_owner`. `role` is 'OWNER' both
  // for the account holder and for an OWNER-ROLE member who is not — which is exactly the
  // disjunction the trigger tests. Measured live 2026-09-02: Lauren Bishop is the second case, so
  // an `isOwner`-only check here would disagree with the database on her session.
  const canSetPreference = role === 'OWNER';

  const [state, setState] = useState<Phase>({ phase: 'loading' });
  const [editing, setEditing] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId) return;
    setState({ phase: 'loading' });
    const [v, a] = await Promise.all([
      supabase.from('vendors')
        .select('id, business_id, name, email, phone, account_number, website, preferred, preference_note, notes')
        .eq('business_id', businessId),
      supabase.from('vendor_aliases')
        .select('id, business_id, vendor_id, alias, source')
        .eq('business_id', businessId),
    ]);
    if (v.error) {
      if (TRACE_VENDOR) console.log('[TRACE:VENDOR] load failed —', v.error.message);
      setState({ phase: 'failed', message: v.error.message });
      return;
    }
    const vendors = (v.data ?? []) as VendorRow[];
    const aliases = (a.data ?? []) as VendorAliasRow[];
    if (TRACE_VENDOR) {
      console.log('[TRACE:VENDOR] loaded — vendors:', vendors.length,
        'aliases:', aliases.length,
        'preferred:', vendors.filter(x => x.preferred).length,
        'role:', role, 'canSetPreference:', canSetPreference,
        aliases.length === 0 && a.error ? `aliases read failed: ${a.error.message}` : '');
    }
    setState({ phase: 'loaded', vendors, aliases });
  }, [businessId, role, canSetPreference]);

  useEffect(() => { void load(); }, [load]);

  async function writePreference(v: VendorRow, preferred: boolean, note: string | null) {
    setSaving(true); setWriteError(null);
    if (TRACE_VENDOR) console.log('[TRACE:VENDOR] preference write —', v.id, 'preferred:', preferred, 'note len:', (note ?? '').length);
    const { error } = await supabase
      .from('vendors')
      .update({ preferred, preference_note: note })
      .eq('id', v.id)
      .eq('business_id', v.business_id);   // AC-3: never reach past the tenant
    setSaving(false);
    if (error) {
      // The trigger raises 42501. Surfaced honestly rather than swallowed — a control that
      // appears to work and silently does not is worse than one that refuses out loud.
      if (TRACE_VENDOR) console.log('[TRACE:VENDOR] preference REFUSED —', error.code, error.message);
      setWriteError(
        error.message.includes('owner-only') || error.code === '42501'
          ? 'Only an owner can set the preferred vendor. Your change was not saved.'
          : `Could not save: ${error.message}`);
      return;
    }
    setEditing(null);
    await load();
  }

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
        <h2 style={H}>{heading}</h2>
        <p style={SUB}>{subhead}</p>

        {writeError && <div style={{ ...ABSENCE, color: '#A32D2D', borderColor: '#e7c6c6', background: '#fdf5f5' }}>{writeError}</div>}

        {ordered.length === 0 && (
          <div style={ABSENCE}>
            No vendors yet. One is recorded the first time you capture a document from them.
          </div>
        )}

        {ordered.map((v) => {
          const aliases = state.aliases.filter(a => a.vendor_id === v.id);
          const isEditing = editing === v.id;
          return (
            <div key={v.id} style={ROW}>
              <div style={LINE1}>
                <span style={NAME}>{v.name}</span>
                {v.preferred === true && <span style={MARK}>PREFERRED</span>}
              </div>

              {/* The note travels with the mark. Not a hover, not a click — §4. */}
              {v.preferred === true && !isEditing && (
                v.preference_note
                  ? <div style={NOTE}>{v.preference_note}</div>
                  : <div style={ABSENCE}>Marked preferred, but no reason was recorded.</div>
              )}

              {(v.email || v.phone || v.account_number || v.website) && (
                <>
                  <div style={SECTION_LABEL}>Contact</div>
                  <div style={META}>
                    {[v.email, v.phone, v.account_number ? `Acct ${v.account_number}` : null, v.website]
                      .filter(Boolean).join('  ·  ')}
                  </div>
                </>
              )}

              {aliases.length > 0 && (
                <>
                  <div style={SECTION_LABEL}>Also bills as</div>
                  <div style={META}>{aliases.map(a => a.alias).join('  ·  ')}</div>
                </>
              )}

              {isEditing ? (
                <div style={{ marginTop: 10 }}>
                  <div style={SECTION_LABEL}>Why is this vendor preferred?</div>
                  <textarea
                    style={TEXTAREA}
                    value={draftNote}
                    placeholder="e.g. Stock quality is better, even though the price is higher."
                    onChange={(e) => setDraftNote(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <button
                      style={{ ...BTN, background: '#27500A', color: '#fff' }}
                      disabled={saving}
                      onClick={() => void writePreference(v, true, draftNote.trim() || null)}
                    >{saving ? 'Saving…' : 'Save as preferred'}</button>
                    <button style={BTN} disabled={saving} onClick={() => { setEditing(null); setWriteError(null); }}>
                      Cancel
                    </button>
                    {v.preferred === true && (
                      <button
                        style={{ ...BTN, borderColor: '#A32D2D', color: '#A32D2D' }}
                        disabled={saving}
                        onClick={() => void writePreference(v, false, null)}
                      >Remove preference</button>
                    )}
                  </div>
                </div>
              ) : canSetPreference ? (
                <div style={{ marginTop: 10 }}>
                  <button
                    style={BTN}
                    onClick={() => { setEditing(v.id); setDraftNote(v.preference_note ?? ''); setWriteError(null); }}
                  >{v.preferred === true ? 'Edit preference' : 'Mark preferred'}</button>
                </div>
              ) : (
                // §6 r13 — locked WITH an explanation. A control that is simply absent reads as a
                // missing feature; this says what sets the field and why it is not editable here.
                <div style={{ ...ABSENCE, marginTop: 10 }}>
                  The preferred vendor is set by the owner. You can see the mark and the reason, and
                  they cannot be changed from your account.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
