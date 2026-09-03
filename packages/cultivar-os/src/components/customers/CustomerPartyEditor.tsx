// ============================================================
// CustomerPartyEditor — the full GROUPED party-record editor (Cultivar OS)
// PURPOSE:      The ONE customer/party form (STD-011) — BOTH the "Add Customer" (create) and
//               "Edit customer" surfaces on the /customers roster render THIS component, so a field
//               added to the party record can never drift between two forms. The old flat Add form
//               is retired. The DataSheet is hand-declared and the party record is ~18 fields — far
//               too many for inline grid columns — so the full set lives HERE, in labeled sections
//               (Identity · Contact · Billing address · Tax · Commercial terms · Status). The roster
//               surfaces only the at-a-glance columns. This is where the tax set (id / exempt /
//               reason / cert / expiry) is UI-editable — closing the D-40 owner-prove blocker.
// MODES:        The ONLY differences between create and edit are (a) title, (b) empty-vs-populated
//               initial values, (c) insert-vs-update on save. Everything else is identical.
//               COMMIT MODEL (A3/E2, phase B — ONE MODEL, BOTH MODES): the RECORD is the unit of
//               work, so this panel is a FORM. Every field BUFFERS into `draft`; nothing is written
//               until Save; Cancel genuinely discards. Create and edit differ ONLY in title and
//               insert-vs-update. The per-field writers are gone, and with them three defects:
//               Cancel that meant "keep everything so far", a tax group that needed its own button
//               the footer said did not exist, and validation that ran per field instead of once.
//               The diff + coercion + the D-40 tax invariant live in ONE pure function,
//               `buildCustomerPatch` (customerEdit.ts), over the registry's derived field list.
//               CREATE: all fields buffer locally; ONE "Save Customer" INSERT (owner-only RLS, no
//               endpoint) after validation (first_name required; exempt requires a reason).
//               Billing address is mirrored to the legacy consumed address_* on save (both modes) —
//               a bridge until D-41 follow-up (b) repoints checkout/delivery readers to billing_*.
// ADDRESS (L1): BILLING only. Shipping is NOT a customer attribute — it is order-time, snapshotted
//               onto the delivery row. No shipping block here (deliberate).
// DEPENDENCIES: useBusinessContext (businessId → RLS scope), sheetStyles (SS), the shared
//               coerce/persist helpers (customerEdit.ts), TAX_EXEMPTION_REASONS/taxExemptionLabel
//               (shared business-logic). tierOptions passed in by the roster (it already loads the
//               configured discount tiers). NO migration, NO new dep, NO endpoint.
// GATE:         OWNER-ONLY — mounted from the owner-only /customers roster; customers RLS is
//               owner-only FOR ALL (+ member SELECT), so staff never open it.
// INSTRUMENTATION (STD-003): `[TRACE:customers] edit` via the shared helpers (ON by default —
//               standing owner instruction), with tax_id / credit_limit VALUE-MASKED (BENCH-C).
// ============================================================
import { useState } from 'react';
import { X } from 'lucide-react';
import { useBusinessContext } from '@trace/shared/context';
import { sheetStyles as SS } from '@trace/shared/components/datasheet/DataSheet';
import {
  persistCustomerPatch, insertCustomer, buildCustomerPatch, type CustomerTextField,
} from './customerEdit';
import { TAX_EXEMPTION_REASONS } from '@trace/shared/business-logic';

// The full party row the editor reads. Party-record cols (2026-07-13) are optional so a
// pre-migration row (cols stripped by the roster's deploy-safe fallback) still opens cleanly.
export interface PartyCustomer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  customer_type?: string | null;
  organization_name?: string | null;
  display_name?: string | null;
  billing_line1?: string | null;
  billing_line2?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_zip?: string | null;
  tax_id?: string | null;
  tax_exempt?: boolean | null;
  tax_exempt_reason?: string | null;
  tax_exempt_cert_ref?: string | null;
  tax_exempt_expires?: string | null;
  price_tier?: string | null;
  payment_terms?: string | null;
  credit_limit?: number | null;
  status?: string | null;
  notes?: string | null;
}

/** A blank party seed for CREATE mode (the retired flat Add form's replacement start-state). */
export const BLANK_PARTY_CUSTOMER: PartyCustomer = {
  id: '', first_name: '', last_name: '', email: null, phone: null,
  customer_type: 'person', price_tier: 'retail', status: 'active',
};

// Billing → legacy consumed-address mirror (line2 has no legacy equivalent). D-41 shipped billing_*
// as the address home, but checkout/delivery/order-detail still READ the unprefixed address_* today
// (follow-up (b) will repoint them). To avoid regressing a manually-added customer's checkout address,
// the shared editor writes billing AND the legacy field together — in BOTH create and edit — keeping
// the consumed field in sync until (b) folds address_* into billing_* and drops this mirror.

interface Props {
  customer: PartyCustomer;
  /** 'edit' (default) = per-field auto-save on an existing row. 'create' = buffer all fields, one
   *  INSERT on "Save Customer" (the unified Add path — same component, only title/empty/insert differ). */
  mode?: 'create' | 'edit';
  /** Retail floor + configured tiers, resolved by the roster (readPricingConfig). */
  tierOptions: { value: string; label: string }[];
  onClose: () => void;
  /** Fired after any successful write (edit) or the insert (create) so the roster reloads. */
  onSaved: () => void;
}

// A5 — the modal comes from the SHARED vocabulary (M1 centered, one convention). This component
// used to carry its own `overlay`/`dialog` style objects; that was the last own-copy modal on the
// /customers surface AND, since phase C mounted this editor over /delivery-schedule, on that one
// too — so this single edit moves BOTH surfaces from HALF to SHARED.
const overlay: React.CSSProperties = SS.modal;                                  // the shared centered backdrop
const dialog: React.CSSProperties = { ...SS.sheet, maxWidth: 680, maxHeight: '88vh' }; // shared sheet, wider for 6 groups
const groupTitle: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase',
  letterSpacing: '0.06em', margin: '18px 0 8px', paddingBottom: 4, borderBottom: '1px solid #f0f0f0',
};
const PAYMENT_TERMS_SUGGESTIONS = ['due_on_receipt', 'net_15', 'net_30', 'net_60'];

const DATALIST_ID = 'party-payment-terms';

export function CustomerPartyEditor({ customer, mode = 'edit', tierOptions, onClose, onSaved }: Props) {
  const { businessId } = useBusinessContext();
  const creating = mode === 'create';
  // TWO values, deliberately: `draft` is the ON-SCREEN working copy (every keystroke lands here via
  // `input()`), `saved` is the LAST PERSISTED row. Collapsing them is the defect fixed 2026-07-29 —
  // an unchanged-check that reads the working copy can never see a change. `saved` is now the DIFF BASE.
  const [draft, setDraft] = useState<PartyCustomer>(customer);
  const [saved, setSaved] = useState<PartyCustomer>(customer);
  const [error, setError] = useState<string | null>(null);
  const [savingNew, setSavingNew] = useState(false);

  // Tax-exemption sub-state (validated trio). Seed from the row; when exempt is ON but no reason
  // yet, the "Save exemption" is blocked (mirrors D-40 — never zero tax without a recorded reason).
  const storedReason = draft.tax_exempt_reason ?? '';
  const knownCode = TAX_EXEMPTION_REASONS.find(x => x.code === storedReason && x.code !== 'other');
  const [exempt, setExempt] = useState<boolean>(!!draft.tax_exempt);
  const [reasonCode, setReasonCode] = useState<string>(
    draft.tax_exempt ? (knownCode?.code ?? (storedReason ? 'other' : 'resale')) : 'resale');
  const [otherText, setOtherText] = useState<string>(knownCode ? '' : storedReason);
  const [certRef, setCertRef] = useState<string>(draft.tax_exempt_cert_ref ?? '');
  const [expires, setExpires] = useState<string>(draft.tax_exempt_expires ?? '');
  const [taxErr, setTaxErr] = useState<string | null>(null);

  const set = (patch: Partial<PartyCustomer>) => setDraft(d => ({ ...d, ...patch }));

  // ── A3 / E2 PHASE B — ONE COMMIT MODEL, BOTH MODES. The record is the unit of work here, so this
  //    panel is a FORM: every field BUFFERS into `draft` and NOTHING is written until Save. The
  //    per-field writers (commitText / commitPatch / commitCredit / commitExemption) are GONE.
  //    Three things fall out of that and each was a real defect:
  //      · CANCEL MEANS DISCARD. It used to mean "stop, keeping every write so far" — there was no
  //        way to back out of a partial edit, and the X implied one.
  //      · THE TAX SET NEEDS NO SPECIAL ATOMIC PATH. commitExemption existed only because everything
  //        around it was per-field; under one Save every multi-field invariant is atomic by shape.
  //      · VALIDATION RUNS ONCE, in buildCustomerPatch, for create and edit alike.
  //    `saved` survives phase A and gets MORE useful: it is now the DIFF BASE. ──
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved) ||
    exempt !== !!saved.tax_exempt ||
    (certRef || null) !== (saved.tax_exempt_cert_ref ?? null) ||
    (expires || null) !== (saved.tax_exempt_expires ?? null);

  async function save() {
    if (!businessId) return;
    const { values, error: vErr } = buildCustomerPatch({
      saved: saved as unknown as Record<string, unknown>,
      draft: draft as unknown as Record<string, unknown>,
      tax: { exempt, reasonCode, otherText, certRef, expires },
      creating,
    });
    if (vErr) { setError(vErr); setTaxErr(vErr.includes('tax-exempt') ? vErr : null); return; }

    // A no-op Save is not an error and not a write — say so plainly and close (STD-023's shape:
    // the write does not run, rather than running and being ignored).
    if (!creating && Object.keys(values).length === 0) { setError(null); onClose(); return; }

    setSavingNew(true); setError(null); setTaxErr(null);
    const res = creating
      ? await insertCustomer({ businessId, values })
      : await persistCustomerPatch({ id: draft.id, businessId, patch: values });
    setSavingNew(false);
    if (res.error) { setError(res.error); return; }   // includes the A8 zero-row refusal message
    setSaved({ ...draft, ...(values as Partial<PartyCustomer>) });
    onSaved();
    onClose();
  }

  // Cancel now genuinely discards. Guard only when there is something to lose.
  function cancel() {
    if (dirty && !window.confirm('Discard your changes to this customer?')) return;
    onClose();
  }

  const set2 = (field: CustomerTextField, v: string) => set({ [field]: v } as Partial<PartyCustomer>);

  const input = (field: keyof PartyCustomer, extra?: React.CSSProperties): React.InputHTMLAttributes<HTMLInputElement> => ({
    style: { ...SS.input, ...extra },
    value: (draft[field] as string) ?? '',
    onChange: e => set({ [field]: e.target.value } as Partial<PartyCustomer>),
    disabled: savingNew,
  });

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) cancel(); }}>
      <div style={dialog}>
        <div style={SS.sheetHeader}>
          <h2 style={{ ...SS.sectionTitle, margin: 0 }}>{creating ? 'Add Customer' : 'Edit customer'}</h2>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} onClick={cancel}>
            <X size={20} color="#6b7280" />
          </button>
        </div>
        {error && <div style={SS.error}>{error}</div>}

        {/* ── IDENTITY ── */}
        <div style={groupTitle}>Identity</div>
        <div style={{ ...SS.row2, ...SS.field }}>
          <div>
            <label style={SS.label}>First name *</label>
            <input {...input('first_name')} onBlur={e => { set2('first_name', e.target.value); }} placeholder="e.g. Marcus" />
          </div>
          <div>
            <label style={SS.label}>Last name</label>
            <input {...input('last_name')} onBlur={e => { set2('last_name', e.target.value); }} placeholder="e.g. Webb" />
          </div>
        </div>
        <div style={{ ...SS.row2, ...SS.field }}>
          <div>
            <label style={SS.label}>Organization name</label>
            <input {...input('organization_name')} onBlur={e => { set2('organization_name', e.target.value); }} placeholder="e.g. Cedar Park HOA" />
          </div>
          <div>
            <label style={SS.label}>Display name (invoice)</label>
            <input {...input('display_name')} onBlur={e => { set2('display_name', e.target.value); }} placeholder="Optional" />
          </div>
        </div>
        <div style={SS.field}>
          <label style={SS.label}>Type</label>
          <select style={SS.input} value={draft.customer_type ?? 'person'}
            onChange={e => { set({ customer_type: e.target.value }); }}>
            <option value="person">Person</option>
            <option value="organization">Organization</option>
          </select>
        </div>

        {/* ── CONTACT ── */}
        <div style={groupTitle}>Contact</div>
        <div style={{ ...SS.row2, ...SS.field }}>
          <div>
            <label style={SS.label}>Email</label>
            <input {...input('email')} type="email" onBlur={e => { set2('email', e.target.value); }} placeholder="Optional" />
          </div>
          <div>
            <label style={SS.label}>Phone</label>
            <input {...input('phone')} onBlur={e => { set2('phone', e.target.value); }} placeholder="Optional" />
          </div>
        </div>

        {/* ── BILLING ADDRESS (L1; shipping is order-time, not here) ── */}
        <div style={groupTitle}>Billing address</div>
        <div style={SS.field}>
          <label style={SS.label}>Line 1</label>
          <input {...input('billing_line1')} onBlur={e => { set2('billing_line1', e.target.value); }} placeholder="Street address" />
        </div>
        <div style={SS.field}>
          <label style={SS.label}>Line 2</label>
          <input {...input('billing_line2')} onBlur={e => { set2('billing_line2', e.target.value); }} placeholder="Suite, unit (optional)" />
        </div>
        <div style={{ ...SS.row3, ...SS.field }}>
          <div>
            <label style={SS.label}>City</label>
            <input {...input('billing_city')} onBlur={e => { set2('billing_city', e.target.value); }} placeholder="City" />
          </div>
          <div>
            <label style={SS.label}>State</label>
            <input {...input('billing_state')} onBlur={e => { set2('billing_state', e.target.value); }} placeholder="TX" />
          </div>
          <div>
            <label style={SS.label}>ZIP</label>
            <input {...input('billing_zip')} onBlur={e => { set2('billing_zip', e.target.value); }} placeholder="ZIP" />
          </div>
        </div>

        {/* ── TAX ── */}
        <div style={groupTitle}>Tax</div>
        <div style={SS.field}>
          <label style={SS.label}>Tax ID (EIN / resale no.)</label>
          <input {...input('tax_id')} onBlur={e => { set2('tax_id', e.target.value); }} placeholder="Optional" />
        </div>
        <div style={{ ...SS.field, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={exempt}
            onChange={e => { setExempt(e.target.checked); setTaxErr(null); }}
            style={{ width: 18, height: 18 }} />
          <label style={{ ...SS.label, margin: 0 }}>Tax-exempt customer</label>
        </div>
        {exempt && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginBottom: 12, background: '#fafafa' }}>
            <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '0 0 10px' }}>
              An exempt customer is not charged sales tax on any order. A documented reason is required.
            </p>
            <div style={SS.field}>
              <label style={SS.label}>Reason</label>
              <select style={SS.input} value={reasonCode}
                onChange={e => { setReasonCode(e.target.value); setTaxErr(null); }}>
                {TAX_EXEMPTION_REASONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
              </select>
            </div>
            {reasonCode === 'other' && (
              <div style={SS.field}>
                <input style={SS.input} value={otherText} onChange={e => setOtherText(e.target.value)}
                  placeholder="Reason (required)" />
              </div>
            )}
            <div style={{ ...SS.row2, ...SS.field }}>
              <div>
                <label style={SS.label}>Certificate #</label>
                <input style={SS.input} value={certRef} onChange={e => setCertRef(e.target.value)}
                  placeholder="Optional" />
              </div>
              <div>
                <label style={SS.label}>Cert expires</label>
                <input style={SS.input} type="date" value={expires}
                  onChange={e => setExpires(e.target.value)} />
              </div>
            </div>
            {/* The certificate DOCUMENT is deliberately not stored here (2026-07-29 ruling). TRACE
                captures a document only to EXTRACT data from it, or to PASS it through to the system
                that is the record — nothing extracts from a resale certificate and it is in transit
                nowhere. It is the CUSTOMER's proof, held in the customer's own drive. We keep the
                facts that answer "is this exemption valid today?" — the reference and the expiry. */}
            <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: '2px 0 0', lineHeight: 1.5 }}>
              Keep the certificate itself on file with your own records — TRACE stores its number and
              expiry date so orders can check the exemption is still valid, not the document.
            </p>
            {taxErr && <div style={SS.error}>{taxErr}</div>}
          </div>
        )}

        {/* ── COMMERCIAL TERMS ── */}
        <div style={groupTitle}>Commercial terms</div>
        <div style={{ ...SS.row2, ...SS.field }}>
          <div>
            <label style={SS.label}>Price tier</label>
            <select style={SS.input} value={draft.price_tier ?? 'retail'}
              onChange={e => { set({ price_tier: e.target.value }); }}>
              {tierOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={SS.label}>Payment terms</label>
            <input {...input('payment_terms')} list={DATALIST_ID} onBlur={e => { set2('payment_terms', e.target.value); }} placeholder="e.g. net_30" />
            <datalist id={DATALIST_ID}>{PAYMENT_TERMS_SUGGESTIONS.map(t => <option key={t} value={t} />)}</datalist>
          </div>
        </div>
        <div style={SS.field}>
          <label style={SS.label}>Credit limit</label>
          <input style={SS.input} value={draft.credit_limit != null ? String(draft.credit_limit) : ''} inputMode="decimal"
            onChange={e => set({ credit_limit: e.target.value as unknown as number })} placeholder="Optional" />
        </div>

        {/* ── STATUS ── */}
        <div style={groupTitle}>Status</div>
        <div style={SS.field}>
          <label style={SS.label}>Account status</label>
          <select style={SS.input} value={draft.status ?? 'active'}
            onChange={e => { set({ status: e.target.value }); }}>
            <option value="active">Active</option>
            <option value="inactive">Inactive (soft-deactivated)</option>
          </select>
        </div>
        <div style={SS.field}>
          <label style={SS.label}>Notes (internal)</label>
          <textarea style={{ ...SS.input, minHeight: 64, resize: 'vertical' }}
            value={draft.notes ?? ''} onChange={e => set({ notes: e.target.value })}
            onBlur={e => { set2('notes', e.target.value); }} placeholder="Internal memo — not shown to the customer" />
        </div>

        {/* E3 — the copy states the model and the surface implements it. The old footer promised
            auto-save; this panel is a FORM in both modes, so it has one button in both modes. */}
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button type="button" onClick={() => { void save(); }} disabled={savingNew}
            style={savingNew ? SS.submitBtnDisabled : { ...SS.submitBtn, flex: 1 }}>
            {savingNew ? 'Saving…' : creating ? 'Save Customer' : 'Save changes'}
          </button>
          <button type="button" onClick={cancel} disabled={savingNew}
            style={{ ...SS.input, width: 'auto', padding: '0 18px', cursor: 'pointer', background: '#fff' }}>
            Cancel
          </button>
        </div>
        <p style={SS.hint}>Nothing is saved until you press Save. Cancel discards your changes.</p>
      </div>
    </div>
  );
}
