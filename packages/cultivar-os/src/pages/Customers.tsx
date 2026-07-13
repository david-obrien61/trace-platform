// ============================================================
// Customers — the customer ROSTER datasheet (Cultivar OS)
// PURPOSE:      The desktop roster + edit surface for the `customers` table — the list Lauren/
//               David expect (every customer created via OCR-invoice capture, QR checkout, or
//               added directly here) AND the inline-edit surface, in one. Runs through the SAME
//               shared <DataSheet> engine /inventory + /assets use (the 3rd consumer — one
//               engine, three configs; AC-4 settle-once). Reached via its owner-only nav node.
//               The Add-Customer sheet and inline edits now share their form body
//               (<CustomerFields>) and their coercion/write rules (customerEdit.ts) with the
//               in-context CustomerEditModal a delivery card opens — one form, one rule set,
//               no drift.
// SCOPE (v1):   customers table ONLY. The person spine (customers.person_id → people) is DEFERRED
//               — it stays populated-on-create by the OCR/service-key path and needs nothing from
//               this list; people RLS (people_self_all, auth_user_id-keyed) blocks an owner from
//               reading OTHER person rows anyway, so cross-role ("also a vendor") display is not
//               possible here. person_id is not shown.
// DEPENDENCIES: supabase (customers rows, business_id-scoped), useBusinessContext (businessId →
//               RLS scope), DataSheet cell components. NO migration, NO new dep, NO endpoint.
// OUTPUTS:      Per-row immediate UPDATE on customers (.eq('id').eq('business_id')) — first_name,
//               last_name, phone, email, address_line1, city, state, zip. Create via the
//               Add-Customer sheet (direct insert, source='manual'). Reflects on that customer's
//               deliveries via the deliveries→customers join.
// GATE:         OWNER-ONLY — the /customers route sits in an owner-only PermissionRoute group
//               (like /costs), matching the customers_business_owner RLS (owner-only, FOR ALL).
//               Staff hold no access at either layer → nav never opens onto an empty RLS wall.
// INSTRUMENTATION (STD-003): `[TRACE:customers]` on load + every inline edit + insert.
//               ON BY DEFAULT — standing owner instruction (do NOT comment out).
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import {
  DataSheet, SelectCell, sheetStyles as SS,
  type DataSheetColumn,
} from '../components/datasheet/DataSheet';
import {
  CustomerFields, EMPTY_CUSTOMER_FORM, type CustomerFormState,
} from '../components/customers/CustomerFields';
import { CustomerPartyEditor, type PartyCustomer } from '../components/customers/CustomerPartyEditor';
import { readPricingConfig, normalizeDiscountTypes, RETAIL_TIER_NAME, taxExemptionLabel, type DiscountType } from '@trace/shared/business-logic';

const SOURCE_LABEL: Record<string, string> = {
  'qr-scan':     'QR checkout',
  'ocr-invoice': 'Invoice scan',
  'manual':      'Added by hand',
};

interface CustomerRow {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  price_tier: string | null;
  customer_type: string | null;
  // D-40: the persistent tax exemption (gated cols 20260713; optional so a pre-migration read is safe).
  tax_exempt?: boolean | null;
  tax_exempt_reason?: string | null;
  tax_exempt_cert_ref?: string | null;
  // Party-record cols (2026-07-13, gated) — optional so a pre-migration read is safe (deploy-window).
  organization_name?: string | null;
  display_name?: string | null;
  billing_line1?: string | null;
  billing_line2?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_zip?: string | null;
  tax_id?: string | null;
  tax_exempt_expires?: string | null;
  payment_terms?: string | null;
  credit_limit?: number | null;
  status?: string | null;
  notes?: string | null;
  source: string | null;
  qb_customer_id: string | null;
  created_at: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
const sourceStyle: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 600, color: '#374151', background: '#f3f4f6', borderRadius: 6, padding: '2px 7px' };
const tierSelectStyle = (): React.CSSProperties => ({ color: '#3730a3', fontWeight: 700 });

export function Customers() {
  const { businessId } = useBusinessContext();

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CustomerFormState>(EMPTY_CUSTOMER_FORM);
  const [newTier, setNewTier] = useState('retail');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Configured discount types × tiers (from business_pricing_config.config — set on the Discounts
  // screen). READ is business-scoped (readPricingConfig), NOT owner-restricted — the tier picker
  // resolves the full set independently of the /discounts admin route. aiEnabled gates the AI slot.
  const [discountTypes, setDiscountTypes] = useState<DiscountType[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);

  const loadCustomers = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    console.log('[TRACE:customers] loadCustomers → customers', { businessId });
    // CORE = guaranteed-live set (everything pre-2026-07-13). FULL adds the D-40 exemption trio +
    // the party-record cols (both gated 20260713). Deploy-window-safe: try FULL, retry CORE on a
    // missing-column error so the roster never breaks before the migrations apply.
    const CORE = 'id,first_name,last_name,phone,email,address_line1,city,state,zip,price_tier,customer_type,source,qb_customer_id,created_at';
    const FULL = `${CORE},tax_exempt,tax_exempt_reason,tax_exempt_cert_ref,organization_name,display_name,billing_line1,billing_line2,billing_city,billing_state,billing_zip,tax_id,tax_exempt_expires,payment_terms,credit_limit,status,notes`;
    const run = (cols: string) => supabase.from('customers').select(cols).eq('business_id', businessId).order('created_at', { ascending: false });
    let { data, error } = await run(FULL);
    if (error && ((error as any).code === '42703' || (error as any).code === 'PGRST204')) {
      console.log('[TRACE:customers] party/exemption cols absent — roster retrying with CORE (migration pending)', { code: (error as any).code });
      ({ data, error } = await run(CORE));
    }
    if (error) { console.error('[TRACE:customers] loadCustomers error', error.message); setListError(error.message); setListLoading(false); return; }
    console.log('[TRACE:customers] loadCustomers ok', { count: data?.length ?? 0 });
    setCustomers((data ?? []) as unknown as CustomerRow[]);
    setListLoading(false);
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    void loadCustomers();
  }, [businessId, loadCustomers]);

  // Load the configured discount types (business-scoped read; forward-migrates legacy pricingTiers).
  // Feeds the inline tier picker + the Add-Customer form. Also reads the AI-advisory toggle.
  useEffect(() => {
    if (!businessId) return;
    void (async () => {
      const { data } = await readPricingConfig(supabase, businessId);
      const cfg = (data?.config ?? {}) as Record<string, unknown>;
      setDiscountTypes(normalizeDiscountTypes(cfg));
      setAiEnabled(cfg.aiBiEnabled === true);
    })();
  }, [businessId]);

  // Inline tier edit — one immediate RLS-scoped write (owner-only). price_tier drives the checkout
  // discount (submit.ts) — tagging a customer 'contractor' is how they get contractor pricing.
  function onTier(c: CustomerRow, v: string) {
    if (!businessId || v === (c.price_tier ?? 'retail')) return;
    const bid = businessId;
    console.log('[TRACE:customers] tier edit', { id: c.id, from: c.price_tier, to: v });
    void (async () => {
      const { error } = await supabase.from('customers').update({ price_tier: v }).eq('id', c.id).eq('business_id', bid);
      if (error) { setListError(error.message); return; }
      await loadCustomers();
    })();
  }

  // Options for a row's tier select — the retail floor + every tier across every configured type
  // (label "Type · Tier", value = the tier NAME stored in customers.price_tier) ∪ the row's current
  // value (so a legacy/removed tier still displays and can be changed). Dynamic — no hardcoded set.
  const tierOptions = (current: string | null) => {
    const opts: { value: string; label: string }[] = [{ value: RETAIL_TIER_NAME, label: 'Retail (no discount)' }];
    for (const ty of discountTypes) for (const ti of ty.tiers) opts.push({ value: ti.name, label: `${ty.name} · ${ti.name}` });
    const cur = current ?? RETAIL_TIER_NAME;
    if (!opts.some(o => o.value === cur)) opts.push({ value: cur, label: cur });
    return opts;
  };

  // ── Status inline (quick soft-deactivate; full editor also carries it). Immediate RLS write. ──
  function onStatus(c: CustomerRow, v: string) {
    if (!businessId || v === (c.status ?? 'active')) return;
    const bid = businessId;
    console.log('[TRACE:customers] status edit', { id: c.id, from: c.status, to: v });
    void (async () => {
      const { error } = await supabase.from('customers').update({ status: v }).eq('id', c.id).eq('business_id', bid);
      if (error) { setListError(error.message); return; }
      await loadCustomers();
    })();
  }

  // The full grouped party editor — opened per-row from the roster. Everything beyond the at-a-glance
  // columns (name/type/tier/tax/status) is edited HERE, not inline (the DataSheet is hand-declared,
  // and the party record is ~18 fields — too many for grid columns).
  const [partyEditing, setPartyEditing] = useState<CustomerRow | null>(null);

  const displayName = (r: CustomerRow) =>
    r.customer_type === 'organization'
      ? (r.organization_name?.trim() || r.first_name)
      : `${r.first_name} ${r.last_name}`.trim() || r.first_name;

  // ── Column config — the LEAN at-a-glance roster (name/type/tier/tax/status/added + Edit).
  //    The full field set lives in CustomerPartyEditor (opened via the name or the Edit button). ──
  const columns: DataSheetColumn<CustomerRow>[] = [
    { key: 'first_name', header: 'Name', sortable: true, sortVal: r => displayName(r).toLowerCase(), frozen: true, frozenWidth: 200,
      render: r => (
        <button onClick={() => setPartyEditing(r)} title="Open customer record"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>
          {displayName(r) || '—'}
        </button>
      ) },
    { key: 'customer_type', header: 'Type', sortable: true, sortVal: r => (r.customer_type ?? 'person'),
      render: r => <span style={sourceStyle}>{r.customer_type === 'organization' ? 'Organization' : 'Person'}</span> },
    { key: 'price_tier', header: 'Tier', sortable: true, sortVal: r => (r.price_tier ?? '').toLowerCase(),
      render: r => <SelectCell value={r.price_tier ?? 'retail'} options={tierOptions(r.price_tier)} onChange={v => onTier(r, v)} styleFor={tierSelectStyle} title="Customer price tier — drives the checkout discount" /> },
    { key: 'tax_exempt', header: 'Tax', sortable: true, sortVal: r => (r.tax_exempt ? 1 : 0),
      render: r => (
        <button onClick={() => setPartyEditing(r)} title="Tax exemption — click to edit" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
          {r.tax_exempt
            ? <span style={{ ...sourceStyle, color: '#166534', background: '#dcfce7' }}>Exempt · {taxExemptionLabel(r.tax_exempt_reason)}</span>
            : <span style={{ ...SS.muted, textDecoration: 'underline dotted' }}>Taxable</span>}
        </button>
      ) },
    { key: 'status', header: 'Status', sortable: true, sortVal: r => (r.status ?? 'active'),
      render: r => <SelectCell value={r.status ?? 'active'} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} onChange={v => onStatus(r, v)} title="Account status — inactive soft-deactivates" /> },
    { key: 'source', header: 'Source', sortable: true, sortVal: r => (r.source ?? '').toLowerCase(), defaultVisible: false,
      render: r => <span style={sourceStyle}>{SOURCE_LABEL[r.source ?? ''] ?? r.source ?? '—'}</span> },
    { key: 'created_at', header: 'Added', sortable: true, sortVal: r => r.created_at,
      render: r => <span style={SS.muted}>{fmtDate(r.created_at)}</span> },
    { key: 'edit', header: '', hideable: false, sortable: false, systemManaged: false,
      render: r => (
        <button onClick={() => setPartyEditing(r)} style={{ ...sourceStyle, cursor: 'pointer', border: '1px solid #d1d5db', background: '#fff' }}>Edit</button>
      ) },
  ];

  // ── Add-Customer form (create path — direct insert, source='manual') ──
  function set(field: keyof CustomerFormState, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;
    if (!form.first_name.trim()) { setSaveError('First name is required.'); return; }
    setSaving(true); setSaveError(null); setSaveSuccess(false);
    const payload: Record<string, unknown> = {
      business_id: businessId,
      source: 'manual',
      price_tier: newTier, // explicit (was omitted → silently defaulted retail); owner can set a tier on create
      first_name: form.first_name.trim(),
      last_name:  form.last_name.trim(), // NOT NULL — empty string is fine, never null
    };
    if (form.phone.trim())         payload.phone         = form.phone.trim();
    if (form.email.trim())         payload.email         = form.email.trim();
    if (form.address_line1.trim()) payload.address_line1 = form.address_line1.trim();
    if (form.city.trim())          payload.city          = form.city.trim();
    if (form.state.trim())         payload.state         = form.state.trim();
    if (form.zip.trim())           payload.zip           = form.zip.trim();
    console.log('[TRACE:customers] insert → customers', { source: 'manual', name: `${payload.first_name} ${payload.last_name}` });
    const { error } = await supabase.from('customers').insert(payload);
    if (error) { console.error('[TRACE:customers] insert error', error.message); setSaveError(error.message); setSaving(false); return; }
    console.log('[TRACE:customers] insert ok');
    setSaveSuccess(true); setSaving(false); setForm(EMPTY_CUSTOMER_FORM); setNewTier('retail');
    setTimeout(() => { setShowForm(false); setSaveSuccess(false); void loadCustomers(); }, 900);
  }

  return (
    <>
      {/* AI_BI advisory slot (toggle-gated, owner setting on the Discounts screen; default OFF).
          WIRED PLACEHOLDER — reads nothing yet (no spend aggregation) and changes nothing (never
          auto-assigns a tier); it's a suggestion the owner acts on or ignores (D-38 advisory-only).
          The real inference (orders summed per person → threshold suggestion) is the AIEngine port,
          post-demo — this pass wires the surface + toggle + placeholder ONLY. */}
      {aiEnabled && <AiAdvisorySlot />}

      <DataSheet<CustomerRow>
        title="Customers"
        rows={customers}
        loading={listLoading}
        error={listError}
        getRowId={r => r.id}
        columns={columns}
        searchText={r => [r.first_name, r.last_name, r.phone, r.email, r.address_line1, r.city, r.state, r.zip].filter(Boolean).join(' ')}
        searchPlaceholder="Search name, phone, email, city…"
        statusFilter={{ label: 'sources', options: ['qr-scan', 'ocr-invoice', 'manual'], get: r => r.source ?? '' }}
        defaultSortKey="created_at"
        defaultSortDir="desc"
        itemNoun="customers"
        emptyIcon={<Users size={32} color="#d1d5db" style={{ marginBottom: 8 }} />}
        emptyText="No customers yet. They appear here from checkout + invoice scans, or add one."
        actions={
          <button style={SS.addBtn} onClick={() => { setShowForm(true); setSaveError(null); setSaveSuccess(false); }}>
            <Plus size={16} /> Add Customer
          </button>
        }
      />

      {/* Add Customer bottom sheet */}
      {showForm && (
        <div style={SS.modal} onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div style={SS.sheet}>
            <div style={SS.sheetHeader}>
              <h2 style={{ ...SS.sectionTitle, margin: 0 }}>Add Customer</h2>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} onClick={() => setShowForm(false)}>
                <X size={20} color="#6b7280" />
              </button>
            </div>
            {saveError && <div style={SS.error}>{saveError}</div>}
            {saveSuccess && <div style={SS.success}>Customer saved.</div>}
            <form onSubmit={e => { void handleSubmit(e); }}>
              <CustomerFields values={form} onChange={set} requireFirstName />
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Price tier</label>
                <select value={newTier} onChange={e => setNewTier(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1.5px solid #d1d5db', borderRadius: 9, fontSize: '0.9rem', background: '#fff', color: '#111827' }}>
                  {tierOptions(newTier).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <button type="submit" style={saving ? SS.submitBtnDisabled : SS.submitBtn} disabled={saving}>
                {saving ? 'Saving…' : 'Save Customer'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* The full grouped party-record editor (owner-only). All fields beyond the lean roster cols
          are edited here, including the D-40 tax set (id / exempt / reason / cert / expiry). */}
      {partyEditing && (
        <CustomerPartyEditor
          customer={partyEditing as unknown as PartyCustomer}
          tierOptions={tierOptions(partyEditing.price_tier)}
          onClose={() => setPartyEditing(null)}
          onSaved={() => { void loadCustomers(); }}
        />
      )}
    </>
  );
}

// AI_BI advisory PLACEHOLDER — the wired, toggle-gated slot on the customer surface. Renders a
// suggestion card only; the real spend→tier inference is the post-demo AIEngine port (see above).
function AiAdvisorySlot() {
  useEffect(() => { console.log('[TRACE:AI_BI] advisory slot rendered (placeholder — no inference yet)'); }, []);
  return (
    <div style={{ border: '1px solid #ddd6fe', background: '#f5f3ff', borderRadius: 12, padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ fontSize: '1.1rem', lineHeight: 1.2 }}>💡</span>
      <div>
        <div style={{ fontWeight: 700, color: '#4c1d95', fontSize: '0.875rem' }}>Spend-based suggestion (advisory)</div>
        <div style={{ fontSize: '0.8125rem', color: '#6d28d9', marginTop: 2, lineHeight: 1.5 }}>
          When a customer's order history suggests a discount tier might fit, it'll surface here for you to act on or
          ignore. Advisory only — it never assigns a tier or changes a price. (Suggestions arrive in a later update.)
        </div>
      </div>
    </div>
  );
}
