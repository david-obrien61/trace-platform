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
//               EDIT: auto-save — text fields commit on blur, selects/number/date on change, and the
//               tax exemption is a VALIDATED trio ("Save exemption" — cannot mark exempt without a
//               reason, mirrors D-40's server refusal). Each write is an owner-only RLS UPDATE.
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
import { sheetStyles as SS } from '../datasheet/DataSheet';
import {
  coerceCustomerField, persistCustomerField, persistCustomerPatch, insertCustomer, type CustomerTextField,
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
const BILLING_MIRROR: Record<string, string> = {
  billing_line1: 'address_line1', billing_city: 'city', billing_state: 'state', billing_zip: 'zip',
};

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

// Centered dialog (mirrors CustomerEditModal — not the SS bottom-sheet; a tall grouped form must
// stay in view). Caps at 88vh with internal scroll.
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16,
};
const dialog: React.CSSProperties = {
  background: '#fff', borderRadius: 16, padding: '1.5rem',
  width: '100%', maxWidth: 680, maxHeight: '88vh', overflowY: 'auto',
  boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
};
const groupTitle: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase',
  letterSpacing: '0.06em', margin: '18px 0 8px', paddingBottom: 4, borderBottom: '1px solid #f0f0f0',
};
const PAYMENT_TERMS_SUGGESTIONS = ['due_on_receipt', 'net_15', 'net_30', 'net_60'];

const DATALIST_ID = 'party-payment-terms';

export function CustomerPartyEditor({ customer, mode = 'edit', tierOptions, onClose, onSaved }: Props) {
  const { businessId } = useBusinessContext();
  const creating = mode === 'create';
  const [draft, setDraft] = useState<PartyCustomer>(customer);
  const [error, setError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);
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

  // ── Nullable-text field on blur. CREATE = buffer into draft only (one INSERT on Save Customer).
  //    EDIT = persist (billing fields mirror to the legacy consumed address_* — see BILLING_MIRROR). ──
  async function commitText(field: CustomerTextField, raw: string) {
    if (!businessId) return;
    const r = coerceCustomerField(draft as unknown as Record<string, unknown>, field, raw);
    if (r.skip) return;
    if (creating) { set({ [field]: r.value } as Partial<PartyCustomer>); return; }
    const mirror = BILLING_MIRROR[field];
    setSavingField(field);
    const res = mirror
      ? await persistCustomerPatch({ id: draft.id, businessId, patch: { [field]: r.value, [mirror]: r.value } })
      : await persistCustomerField({ id: draft.id, businessId, field, from: (draft as any)[field], value: r.value });
    setSavingField(null);
    if (res.error) { setError(res.error); return; }
    set({ [field]: r.value } as Partial<PartyCustomer>);
    setError(null); onSaved();
  }

  // ── Typed/select field on change. CREATE = buffer; EDIT = one patch write. ──
  async function commitPatch(patch: Record<string, unknown>, local: Partial<PartyCustomer>) {
    if (creating) { set(local); return; }
    if (!businessId) return;
    const res = await persistCustomerPatch({ id: draft.id, businessId, patch });
    if (res.error) { setError(res.error); return; }
    set(local); setError(null); onSaved();
  }

  // ── credit_limit numeric on blur (blank → null; NaN rejected). CREATE buffers; EDIT persists. ──
  async function commitCredit(raw: string) {
    const t = raw.trim();
    let val: number | null;
    if (t === '') val = null;
    else { const n = Number(t.replace(/[$,]/g, '')); if (Number.isNaN(n)) { setError('Credit limit must be a number.'); return; } val = n; }
    if (val === (draft.credit_limit ?? null)) return;
    await commitPatch({ credit_limit: val }, { credit_limit: val });
  }

  // ── Tax exemption toggle. CREATE = buffer the flag only (validated at Save Customer). EDIT: ON
  //    reveals the validated trio; OFF is an immediate safe-default clear. ──
  function toggleExempt(checked: boolean) {
    if (creating) { setExempt(checked); if (!checked) setTaxErr(null); return; }
    if (checked) setExempt(true); else void clearExemption();
  }

  // ── EDIT-mode exemption save — VALIDATED. Turning ON requires a reason before it persists
  //    (D-40: never zero tax without a recorded reason). ──
  async function saveExemption() {
    if (!businessId) return;
    const reason = reasonCode === 'other' ? otherText.trim() : reasonCode;
    if (!reason) { setTaxErr('A reason is required to make a customer tax-exempt.'); return; }
    setTaxErr(null);
    await commitPatch(
      { tax_exempt: true, tax_exempt_reason: reason, tax_exempt_cert_ref: certRef.trim() || null, tax_exempt_expires: expires || null },
      { tax_exempt: true, tax_exempt_reason: reason, tax_exempt_cert_ref: certRef.trim() || null, tax_exempt_expires: expires || null },
    );
    setExempt(true);
  }
  async function clearExemption() {
    setExempt(false); setTaxErr(null);
    await commitPatch(
      { tax_exempt: false, tax_exempt_reason: null, tax_exempt_cert_ref: null, tax_exempt_expires: null },
      { tax_exempt: false, tax_exempt_reason: null, tax_exempt_cert_ref: null, tax_exempt_expires: null },
    );
  }

  // ── CREATE — validate (first_name required; exempt requires a reason) then ONE insert. Same rules
  //    as edit; billing mirrored to the legacy consumed address_*; tax_id/credit_limit masked (BENCH-C). ──
  async function saveCreate() {
    if (!businessId) return;
    const first = draft.first_name.trim();
    if (!first) { setError('First name is required.'); return; }
    let taxReason: string | null = null;
    if (exempt) {
      taxReason = reasonCode === 'other' ? otherText.trim() : reasonCode;
      if (!taxReason) { setTaxErr('A reason is required to make a customer tax-exempt.'); return; }
    }
    setTaxErr(null); setError(null);

    const values: Record<string, unknown> = {
      source: 'manual',
      first_name: first,
      last_name: (draft.last_name ?? '').trim(), // NOT NULL — '' when blank, never null
      customer_type: draft.customer_type ?? 'person',
      price_tier: draft.price_tier ?? 'retail',
      status: draft.status ?? 'active',
    };
    const addText = (k: keyof PartyCustomer) => {
      const v = ((draft[k] as string) ?? '').trim();
      if (v) values[k] = v;
    };
    (['organization_name', 'display_name', 'email', 'phone',
      'billing_line1', 'billing_line2', 'billing_city', 'billing_state', 'billing_zip',
      'tax_id', 'payment_terms', 'notes'] as (keyof PartyCustomer)[]).forEach(addText);
    // legacy consumed-address mirror (billing_line2 has no legacy equivalent)
    for (const [billing, legacy] of Object.entries(BILLING_MIRROR)) {
      if (values[billing] != null) values[legacy] = values[billing];
    }
    if (draft.credit_limit != null) values.credit_limit = draft.credit_limit;
    if (exempt) {
      values.tax_exempt = true;
      values.tax_exempt_reason = taxReason;
      values.tax_exempt_cert_ref = certRef.trim() || null;
      values.tax_exempt_expires = expires || null;
    }

    setSavingNew(true);
    const res = await insertCustomer({ businessId, values });
    setSavingNew(false);
    if (res.error) { setError(res.error); return; }
    onSaved();
    onClose();
  }

  const input = (field: keyof PartyCustomer, extra?: React.CSSProperties): React.InputHTMLAttributes<HTMLInputElement> => ({
    style: { ...SS.input, ...extra },
    value: (draft[field] as string) ?? '',
    onChange: e => set({ [field]: e.target.value } as Partial<PartyCustomer>),
    disabled: savingField === field,
  });

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={dialog}>
        <div style={SS.sheetHeader}>
          <h2 style={{ ...SS.sectionTitle, margin: 0 }}>{creating ? 'Add Customer' : 'Edit customer'}</h2>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} onClick={onClose}>
            <X size={20} color="#6b7280" />
          </button>
        </div>
        {error && <div style={SS.error}>{error}</div>}

        {/* ── IDENTITY ── */}
        <div style={groupTitle}>Identity</div>
        <div style={{ ...SS.row2, ...SS.field }}>
          <div>
            <label style={SS.label}>First name *</label>
            <input {...input('first_name')} onBlur={e => { void commitText('first_name', e.target.value); }} placeholder="e.g. Marcus" />
          </div>
          <div>
            <label style={SS.label}>Last name</label>
            <input {...input('last_name')} onBlur={e => { void commitText('last_name', e.target.value); }} placeholder="e.g. Webb" />
          </div>
        </div>
        <div style={{ ...SS.row2, ...SS.field }}>
          <div>
            <label style={SS.label}>Organization name</label>
            <input {...input('organization_name')} onBlur={e => { void commitText('organization_name', e.target.value); }} placeholder="e.g. Cedar Park HOA" />
          </div>
          <div>
            <label style={SS.label}>Display name (invoice)</label>
            <input {...input('display_name')} onBlur={e => { void commitText('display_name', e.target.value); }} placeholder="Optional" />
          </div>
        </div>
        <div style={SS.field}>
          <label style={SS.label}>Type</label>
          <select style={SS.input} value={draft.customer_type ?? 'person'}
            onChange={e => { void commitPatch({ customer_type: e.target.value }, { customer_type: e.target.value }); }}>
            <option value="person">Person</option>
            <option value="organization">Organization</option>
          </select>
        </div>

        {/* ── CONTACT ── */}
        <div style={groupTitle}>Contact</div>
        <div style={{ ...SS.row2, ...SS.field }}>
          <div>
            <label style={SS.label}>Email</label>
            <input {...input('email')} type="email" onBlur={e => { void commitText('email', e.target.value); }} placeholder="Optional" />
          </div>
          <div>
            <label style={SS.label}>Phone</label>
            <input {...input('phone')} onBlur={e => { void commitText('phone', e.target.value); }} placeholder="Optional" />
          </div>
        </div>

        {/* ── BILLING ADDRESS (L1; shipping is order-time, not here) ── */}
        <div style={groupTitle}>Billing address</div>
        <div style={SS.field}>
          <label style={SS.label}>Line 1</label>
          <input {...input('billing_line1')} onBlur={e => { void commitText('billing_line1', e.target.value); }} placeholder="Street address" />
        </div>
        <div style={SS.field}>
          <label style={SS.label}>Line 2</label>
          <input {...input('billing_line2')} onBlur={e => { void commitText('billing_line2', e.target.value); }} placeholder="Suite, unit (optional)" />
        </div>
        <div style={{ ...SS.row3, ...SS.field }}>
          <div>
            <label style={SS.label}>City</label>
            <input {...input('billing_city')} onBlur={e => { void commitText('billing_city', e.target.value); }} placeholder="City" />
          </div>
          <div>
            <label style={SS.label}>State</label>
            <input {...input('billing_state')} onBlur={e => { void commitText('billing_state', e.target.value); }} placeholder="TX" />
          </div>
          <div>
            <label style={SS.label}>ZIP</label>
            <input {...input('billing_zip')} onBlur={e => { void commitText('billing_zip', e.target.value); }} placeholder="ZIP" />
          </div>
        </div>

        {/* ── TAX ── */}
        <div style={groupTitle}>Tax</div>
        <div style={SS.field}>
          <label style={SS.label}>Tax ID (EIN / resale no.)</label>
          <input {...input('tax_id')} onBlur={e => { void commitText('tax_id', e.target.value); }} placeholder="Optional" />
        </div>
        <div style={{ ...SS.field, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={exempt}
            onChange={e => toggleExempt(e.target.checked)}
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
              <select style={SS.input} value={reasonCode} onChange={e => setReasonCode(e.target.value)}>
                {TAX_EXEMPTION_REASONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
              </select>
            </div>
            {reasonCode === 'other' && (
              <div style={SS.field}>
                <input style={SS.input} value={otherText} onChange={e => setOtherText(e.target.value)} placeholder="Reason (required)" />
              </div>
            )}
            <div style={{ ...SS.row2, ...SS.field }}>
              <div>
                <label style={SS.label}>Certificate #</label>
                <input style={SS.input} value={certRef} onChange={e => setCertRef(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label style={SS.label}>Cert expires</label>
                <input style={SS.input} type="date" value={expires} onChange={e => setExpires(e.target.value)} />
              </div>
            </div>
            {/* STD-010 SLOT — deferred: the on-file cert document upload rides the Receipt Keeper
                ingest pattern later. Present but disabled so the hook is visible. */}
            <button type="button" disabled title="Coming soon — upload the certificate document"
              style={{ ...SS.input, cursor: 'not-allowed', color: '#9ca3af', background: '#f3f4f6', textAlign: 'left' }}>
              Attach certificate document (coming soon)
            </button>
            {taxErr && <div style={SS.error}>{taxErr}</div>}
            {/* EDIT persists the exemption atomically here; CREATE buffers it and saves with the row. */}
            {!creating && <button type="button" onClick={() => { void saveExemption(); }} style={{ ...SS.submitBtn, marginTop: 8 }}>Save exemption</button>}
          </div>
        )}

        {/* ── COMMERCIAL TERMS ── */}
        <div style={groupTitle}>Commercial terms</div>
        <div style={{ ...SS.row2, ...SS.field }}>
          <div>
            <label style={SS.label}>Price tier</label>
            <select style={SS.input} value={draft.price_tier ?? 'retail'}
              onChange={e => { void commitPatch({ price_tier: e.target.value }, { price_tier: e.target.value }); }}>
              {tierOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={SS.label}>Payment terms</label>
            <input {...input('payment_terms')} list={DATALIST_ID} onBlur={e => { void commitText('payment_terms', e.target.value); }} placeholder="e.g. net_30" />
            <datalist id={DATALIST_ID}>{PAYMENT_TERMS_SUGGESTIONS.map(t => <option key={t} value={t} />)}</datalist>
          </div>
        </div>
        <div style={SS.field}>
          <label style={SS.label}>Credit limit</label>
          <input style={SS.input} defaultValue={draft.credit_limit != null ? String(draft.credit_limit) : ''} inputMode="decimal"
            onBlur={e => { void commitCredit(e.target.value); }} placeholder="Optional" />
        </div>

        {/* ── STATUS ── */}
        <div style={groupTitle}>Status</div>
        <div style={SS.field}>
          <label style={SS.label}>Account status</label>
          <select style={SS.input} value={draft.status ?? 'active'}
            onChange={e => { void commitPatch({ status: e.target.value }, { status: e.target.value }); }}>
            <option value="active">Active</option>
            <option value="inactive">Inactive (soft-deactivated)</option>
          </select>
        </div>
        <div style={SS.field}>
          <label style={SS.label}>Notes (internal)</label>
          <textarea style={{ ...SS.input, minHeight: 64, resize: 'vertical' }}
            value={draft.notes ?? ''} onChange={e => set({ notes: e.target.value })}
            onBlur={e => { void commitText('notes', e.target.value); }} placeholder="Internal memo — not shown to the customer" />
        </div>

        {creating ? (
          <button type="button" onClick={() => { void saveCreate(); }} disabled={savingNew}
            style={savingNew ? SS.submitBtnDisabled : { ...SS.submitBtn, marginTop: 6 }}>
            {savingNew ? 'Saving…' : 'Save Customer'}
          </button>
        ) : (
          <p style={SS.hint}>Changes save automatically as you edit. Close when you're done.</p>
        )}
      </div>
    </div>
  );
}
