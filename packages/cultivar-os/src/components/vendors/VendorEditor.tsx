// ============================================================
// VendorEditor — the ONE vendor record editor (E1), as a modal over the opened record (E7).
//
// PURPOSE:      A vendor row had a CREATE path and no EDIT path — half a record. Sixteen columns
//               exist, eleven of them had no writer anywhere in the application, and the ONE thing
//               editable was the preference, inline on the list row. This is the other half:
//               every field of a vendor, edited where the vendor is opened.
//
// E7 (2026-09-04, R-83): the preference control and its note live HERE, not on the row. The row
//               carries a read-only mark of the result. `/vendors` is the surface that provoked
//               the clause and the first that meets it.
//
// E1:           This is the ONLY component that edits a vendor. `ReceiptKeeper` CREATES one at
//               capture (name + whatever the document carried) and never edits; that is a
//               non-panel writer, explicitly OUT of E1/E2 by E6's own sentence, and it consumes
//               the SAME field list rather than a second one.
//
// E2 — COMMIT MODEL, ONE PER SURFACE AND THE SAME IN BOTH MODES: the RECORD is the unit of work,
//               so this is a FORM. Every field buffers into `draft`; NOTHING is written until
//               Save; Cancel genuinely discards. Create and edit differ ONLY in title and
//               insert-vs-update — the exact loophole E2 was rewritten to close after
//               CustomerPartyEditor shipped two models separated by a prop.
//
// UI STANDARD (§6 r16 — name the standard, then decide): the established pattern for editing one
//               record from a list is a MODAL FORM over the opened record, and this platform has
//               a shared one — `sheetStyles.modal` (M1: centered on every viewport). Taken as
//               standard, unmodified. ⚠️ M3 (escape-to-close), M4 (backdrop behaviour) and M5
//               (focus trap) are the platform's KNOWN reds; this surface inherits them and does
//               NOT silently claim them. Fixing them is a change to the shared control, for every
//               consumer at once — not a per-consumer copy (R-74 ②).
//
// GATE:         READ + text edits are MEMBERSHIP-scoped (`vendors_member_update`). The PREFERENCE
//               pair is OWNER-ONLY and enforced SERVER-SIDE by a trigger on INSERT and UPDATE
//               alike. This component hides the control from a non-owner AND says why (§6 r13 —
//               locked WITH an explanation, never mystery-locked). The hiding is not the
//               enforcement; owner-test CARD 6 proves the refusal by attempting it.
//
// DEPENDENCIES: `./vendorEdit` (every decision) · `sheetStyles` from the shared DataSheet (the
//               modal chrome — M1) · `../../lib/supabase` (one insert OR one update, RLS-enforced;
//               NO new endpoint, the 12/12 function ceiling is untouched).
//
// INSTRUMENTATION (STD-003): `[TRACE:VENDOR]` on open, on save, on refusal. ON by default.
// ============================================================
import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { sheetStyles as SS } from '@trace/shared/components/datasheet/DataSheet';
import { VENDOR_EDITABLE_FIELDS, type VendorRow } from '@trace/shared/business-logic';
import {
  buildVendorPatch, draftFromVendor, emptyVendorDraft, patchIsEmpty, vendorWriteFailure,
  type PreferenceDraft, type VendorDraft,
} from './vendorEdit';

const TRACE_VENDOR = true;

/** Label + placeholder per field. ONE map, keyed on the shared field list — never a second list. */
const FIELD_LABEL: Record<string, { label: string; placeholder?: string; hint?: string }> = {
  name:           { label: 'Vendor name', placeholder: 'e.g. Bailey Bark Materials, Inc.',
                    hint: 'Required. Vendor names are unique within your business.' },
  email:          { label: 'Email', placeholder: 'orders@example.com' },
  phone:          { label: 'Phone', placeholder: '(512) 555-0100' },
  // 🔴 THE LABEL IS THE WHOLE POINT OF THIS FIELD. The column comment says it and the screen must
  //    too: this is OUR customer number WITH them, not their number. Called `account_number` on a
  //    form with no sentence, it reads backwards the first time somebody types their EIN into it.
  account_number: { label: 'Our account number with them', placeholder: 'e.g. SLAW040',
                    hint: 'The number THEY use for US — printed on their invoice to you. Not their company number.' },
  address_line1:  { label: 'Street address', placeholder: '1200 Industrial Blvd' },
  address_city:   { label: 'City', placeholder: 'Leander' },
  address_state:  { label: 'State', placeholder: 'TX' },
  address_zip:    { label: 'ZIP', placeholder: '78641' },
  website:        { label: 'Website', placeholder: 'example.com' },
  notes:          { label: 'Notes', placeholder: 'Anything worth remembering about this vendor.' },
};

// 🔴 GROUPING IS PRESENTATIONAL; THE FIELD SET IS NOT. This array decides ORDER and HEADINGS
//    only — it is NOT allowed to decide which fields exist, because that is exactly the parallel
//    list that produced tech-debt #179 one layer down. Any editable field this array forgets is
//    appended by `GROUPED_FIELDS` below rather than silently dropped, so a column added to
//    VENDOR_EDITABLE_FIELDS always reaches the form even if nobody remembers to group it.
const GROUPS: Array<{ title: string; fields: string[] }> = [
  { title: 'Identity', fields: ['name'] },
  { title: 'Contact',  fields: ['email', 'phone', 'website', 'account_number'] },
  { title: 'Address',  fields: ['address_line1', 'address_city', 'address_state', 'address_zip'] },
  { title: 'Notes',    fields: ['notes'] },
];

/**
 * The groups actually rendered = the declared groups, plus a catch-all for anything in the shared
 * editable set that no group claims. `ungrouped` is EMPTY today and a probe asserts it stays that
 * way — but if it ever fills, the field appears on the form under "Other" instead of vanishing.
 * Failing loudly-and-visibly beats failing silently: a missing input is invisible; a stray heading
 * is not.
 */
const GROUPED_FIELDS: Array<{ title: string; fields: string[] }> = (() => {
  const claimed = new Set(GROUPS.flatMap(g => g.fields));
  const ungrouped = VENDOR_EDITABLE_FIELDS.filter(f => !claimed.has(f));
  return ungrouped.length === 0 ? GROUPS : [...GROUPS, { title: 'Other', fields: [...ungrouped] }];
})();

const LOCKED: React.CSSProperties = {
  fontSize: '0.8125rem', color: '#6b7280', background: '#f9fafb',
  border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px',
};
const PREF_BOX: React.CSSProperties = {
  background: '#f7faf2', border: '1px solid #cfe0b8', borderRadius: 10, padding: '12px 14px',
};
const ERR_INPUT: React.CSSProperties = { ...SS.input, borderColor: '#b91c1c' };

export default function VendorEditor(props: {
  vendor: VendorRow | null;              // null = create
  businessId: string;
  canSetPreference: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { vendor, businessId, canSetPreference, onClose, onSaved } = props;
  const creating = vendor === null;

  // TWO VALUES, SPLIT (E4). `draft` is the working copy; `vendor` is the persisted row, and the
  // diff is one against the other. A surface keeping ONE object for both is structurally
  // incapable of detecting a change.
  const [draft, setDraft] = useState<VendorDraft>(() =>
    vendor ? draftFromVendor(vendor) : emptyVendorDraft());
  const [preference, setPreference] = useState<PreferenceDraft>(() => ({
    preferred: vendor?.preferred === true,
    note: vendor?.preference_note ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<string | null>(null);

  const set = (f: string, v: string) => {
    setDraft(d => ({ ...d, [f]: v }));
    if (invalidField === f) { setInvalidField(null); setError(null); }
  };

  async function save() {
    setError(null); setInvalidField(null);
    const { values, error: invalid } = buildVendorPatch({
      saved: vendor, draft, preference, creating, canSetPreference,
    });
    if (invalid) {
      // M2 — surfaced, never a silently-greyed button and never a silent save.
      setError(invalid);
      setInvalidField(invalid.includes('name') ? 'name' : invalid.includes('email') ? 'email' : null);
      return;
    }
    if (!creating && patchIsEmpty(values)) {
      // A Save that changed nothing says so. It does NOT report a write it did not make (E5).
      setError('Nothing on this vendor was different, so nothing was saved.');
      return;
    }

    setSaving(true);
    const attemptedPreference = 'preferred' in values || 'preference_note' in values;
    if (TRACE_VENDOR) console.log('[TRACE:VENDOR] save —', creating ? 'create' : 'update',
      vendor?.id ?? '(new)', 'fields:', Object.keys(values).join(',') || '(none)',
      'preference:', attemptedPreference);

    // 🔴 `.select('id')` IS LOAD-BEARING ON BOTH PATHS (E5). A row-level refusal is not an error:
    //    if the policy filters the row out, PostgREST returns SUCCESS with ZERO ROWS, and an
    //    error-only check reports "saved" while nothing changed.
    const res = creating
      ? await supabase.from('vendors').insert({ ...values, business_id: businessId }).select('id')
      : await supabase.from('vendors').update(values)
          .eq('id', vendor.id)
          .eq('business_id', businessId)     // AC-3: never reach past the tenant
          .select('id');
    setSaving(false);

    // 🔴 THE ZERO-ROW REFUSAL IS NAMED HERE, AT THE WRITE — not only inside the translator.
    //    A PostgREST write filtered out by its policy returns SUCCESS with an EMPTY ARRAY, so
    //    `!error` is not evidence that anything landed (A8 / E5 / STD-023). Keeping the test
    //    visible at the call site is deliberate on two counts: a reader looking for "can this
    //    report a refused write?" looks HERE, and so does `verify-zero-row-writes`, which cannot
    //    follow the rule across a file boundary — it flagged this line as NEEDS_CHECK when the
    //    comparison lived only in `vendorWriteFailure`, and it was right to.
    //    The WORDING still has exactly one home, in that function, where a probe reaches it.
    const matchedRows = res.data ? res.data.length : null;
    const refusedSilently = !res.error && res.data?.length === 0;
    const failure = res.error || refusedSilently
      ? vendorWriteFailure({
          errorCode: res.error?.code ?? null,
          errorMessage: res.error?.message ?? null,
          matchedRows,
          attemptedPreference,
        })
      : null;
    if (failure) {
      if (TRACE_VENDOR) console.log('[TRACE:VENDOR] save REFUSED —', res.error?.code, failure);
      setError(failure);
      return;
    }
    if (TRACE_VENDOR) console.log('[TRACE:VENDOR] saved —', creating ? 'created' : 'updated');
    onSaved();
  }

  return (
    <div style={SS.modal} role="dialog" aria-modal="true" aria-label={creating ? 'Add vendor' : `Edit ${vendor?.name ?? 'vendor'}`}>
      <div style={SS.sheet}>
        <div style={SS.sheetHeader}>
          <h3 style={SS.sectionTitle}>{creating ? 'Add vendor' : `Edit ${vendor?.name}`}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} aria-label="Close">
            <X size={20} color="#6b7280" />
          </button>
        </div>

        {/* E3 — the copy states the commit model, and it is true of every field on this surface. */}
        <p style={{ ...SS.hint, marginTop: -8, marginBottom: 14 }}>
          Nothing is saved until you press Save. Cancel discards everything you have typed.
        </p>

        {error && <div style={SS.error}>{error}</div>}

        {GROUPED_FIELDS.map(g => (
          <div key={g.title} style={{ marginBottom: 18 }}>
            <div style={{ ...SS.label, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.6875rem', color: '#94a3b8', marginBottom: 8 }}>
              {g.title}
            </div>
            {g.fields.map(f => {
              // A field the label map has not been told about still renders, under its column
              // name. An unlabelled input is a poor experience; an absent one is a lost value.
              const meta = FIELD_LABEL[f] ?? { label: f };
              const bad = invalidField === f;
              return (
                <div key={f} style={SS.field}>
                  <label style={SS.label} htmlFor={`vendor-${f}`}>{meta.label}</label>
                  {f === 'notes' ? (
                    <textarea id={`vendor-${f}`} style={SS.textarea} value={draft[f] ?? ''}
                      placeholder={meta.placeholder} onChange={e => set(f, e.target.value)} />
                  ) : (
                    <input id={`vendor-${f}`} style={bad ? ERR_INPUT : SS.input} value={draft[f] ?? ''}
                      placeholder={meta.placeholder} onChange={e => set(f, e.target.value)} />
                  )}
                  {meta.hint && <div style={SS.hint}>{meta.hint}</div>}
                </div>
              );
            })}
          </div>
        ))}

        {/* ── THE PREFERENCE — E7's whole point. It lives HERE, with its reason, not on the row. ── */}
        <div style={{ ...SS.label, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.6875rem', color: '#94a3b8', marginBottom: 8 }}>
          Preference
        </div>
        {canSetPreference ? (
          <div style={PREF_BOX}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minHeight: 44 }}>
              <input type="checkbox" checked={preference.preferred} style={{ width: 20, height: 20, cursor: 'pointer' }}
                onChange={e => setPreference(p => ({ ...p, preferred: e.target.checked }))} />
              <span style={{ fontWeight: 700, color: '#1f2937', fontSize: '0.9375rem' }}>
                This is my preferred vendor
              </span>
            </label>
            {creating && (
              <div style={{ ...SS.hint, marginTop: 6 }}>
                A new vendor cannot be created already preferred — save it first, then mark it.
              </div>
            )}
            <div style={{ ...SS.label, marginTop: 12 }}>Why is this vendor preferred?</div>
            <textarea
              style={SS.textarea}
              value={preference.note}
              placeholder="e.g. Stock quality is better, even though the price is higher."
              onChange={e => setPreference(p => ({ ...p, note: e.target.value }))}
            />
            {/* 🔴 THE NOTE IS THE ASSET, AND THE SCREEN SAYS SO. The flag says which row to look
                at; the reason is what Lauren needs on the day the preferred vendor is out. */}
            <div style={SS.hint}>
              This is the part that matters. The mark says which vendor; the reason is what someone
              else needs when the preferred vendor is out of stock.
            </div>
          </div>
        ) : (
          // §6 r13 — locked WITH an explanation. A control that is simply absent reads as a
          // missing feature; this says what sets the field and why it is not editable here.
          <div style={LOCKED}>
            <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>
              {preference.preferred ? 'Marked preferred by the owner' : 'Not marked preferred'}
            </div>
            {preference.preferred && (
              preference.note
                ? <div style={{ color: '#1f2937', marginBottom: 6 }}>{preference.note}</div>
                : <div style={{ marginBottom: 6 }}>Marked preferred, but no reason was recorded.</div>
            )}
            The preferred vendor is set by the owner. You can see the mark and the reason, and they
            cannot be changed from your account. Everything else on this form you can edit.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button style={saving ? SS.submitBtnDisabled : SS.submitBtn} disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : creating ? 'Save vendor' : 'Save changes'}
          </button>
          <button style={{ ...SS.addBtn, minHeight: 48, justifyContent: 'center', flex: '0 0 auto' }}
            disabled={saving} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
