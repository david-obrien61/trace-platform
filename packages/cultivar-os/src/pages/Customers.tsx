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
  DataSheet, TextCell, sheetStyles as SS,
  type DataSheetColumn,
} from '../components/datasheet/DataSheet';
import {
  CustomerFields, EMPTY_CUSTOMER_FORM, type CustomerFormState,
} from '../components/customers/CustomerFields';
import {
  coerceCustomerField, persistCustomerField, type CustomerTextField,
} from '../components/customers/customerEdit';

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
  source: string | null;
  qb_customer_id: string | null;
  created_at: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
const tierStyle: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 700, color: '#3730a3', background: '#e0e7ff', borderRadius: 6, padding: '2px 7px' };
const sourceStyle: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 600, color: '#374151', background: '#f3f4f6', borderRadius: 6, padding: '2px 7px' };

export function Customers() {
  const { businessId } = useBusinessContext();

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CustomerFormState>(EMPTY_CUSTOMER_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadCustomers = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    console.log('[TRACE:customers] loadCustomers → customers', { businessId });
    const { data, error } = await supabase
      .from('customers')
      .select('id,first_name,last_name,phone,email,address_line1,city,state,zip,price_tier,source,qb_customer_id,created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    if (error) { console.error('[TRACE:customers] loadCustomers error', error.message); setListError(error.message); setListLoading(false); return; }
    console.log('[TRACE:customers] loadCustomers ok', { count: data?.length ?? 0 });
    setCustomers((data ?? []) as CustomerRow[]);
    setListLoading(false);
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    void loadCustomers();
  }, [businessId, loadCustomers]);

  // ── Inline edit: one immediate write per field, RLS-scoped (owner-only). Shares the exact
  //    coercion + write rules with CustomerEditModal via customerEdit.ts (no drift). Kept
  //    sync (void return) so the TextCell onCommit callbacks stay void-returning. ──
  function onText(c: CustomerRow, field: CustomerTextField, raw: string | null) {
    if (!businessId) return;
    const bid = businessId;
    const r = coerceCustomerField(c as unknown as Record<string, unknown>, field, raw);
    if (r.skip) return;
    void (async () => {
      const res = await persistCustomerField({
        id: c.id, businessId: bid, field,
        from: (c as unknown as Record<string, unknown>)[field], value: r.value,
      });
      if (res.error) { setListError(res.error); return; }
      await loadCustomers();
    })();
  }

  // ── Column config ──
  const columns: DataSheetColumn<CustomerRow>[] = [
    { key: 'first_name', header: 'First', sortable: true, sortVal: r => r.first_name.toLowerCase(), frozen: true,
      render: r => <TextCell key={`fn-${r.id}-${r.created_at}`} value={r.first_name} width={120} onCommit={v => onText(r, 'first_name', v)} /> },
    { key: 'last_name', header: 'Last', sortable: true, sortVal: r => r.last_name.toLowerCase(),
      render: r => <TextCell key={`ln-${r.id}-${r.created_at}`} value={r.last_name} width={120} placeholder="—" onCommit={v => onText(r, 'last_name', v)} /> },
    { key: 'phone', header: 'Phone', sortable: true, sortVal: r => (r.phone ?? '').toLowerCase(),
      render: r => <TextCell key={`ph-${r.id}-${r.created_at}`} value={r.phone} width={130} placeholder="—" onCommit={v => onText(r, 'phone', v)} /> },
    { key: 'email', header: 'Email', sortable: true, sortVal: r => (r.email ?? '').toLowerCase(),
      render: r => <TextCell key={`em-${r.id}-${r.created_at}`} value={r.email} width={180} placeholder="—" onCommit={v => onText(r, 'email', v)} /> },
    { key: 'address_line1', header: 'Address', sortable: true, sortVal: r => (r.address_line1 ?? '').toLowerCase(),
      render: r => <TextCell key={`ad-${r.id}-${r.created_at}`} value={r.address_line1} width={170} placeholder="—" onCommit={v => onText(r, 'address_line1', v)} /> },
    { key: 'city', header: 'City', sortable: true, sortVal: r => (r.city ?? '').toLowerCase(),
      render: r => <TextCell key={`ci-${r.id}-${r.created_at}`} value={r.city} width={110} placeholder="—" onCommit={v => onText(r, 'city', v)} /> },
    { key: 'state', header: 'State', sortable: true, sortVal: r => (r.state ?? '').toLowerCase(),
      render: r => <TextCell key={`st-${r.id}-${r.created_at}`} value={r.state} width={60} placeholder="—" onCommit={v => onText(r, 'state', v)} /> },
    { key: 'zip', header: 'ZIP', sortable: true, sortVal: r => (r.zip ?? '').toLowerCase(),
      render: r => <TextCell key={`zp-${r.id}-${r.created_at}`} value={r.zip} width={80} placeholder="—" onCommit={v => onText(r, 'zip', v)} /> },
    { key: 'price_tier', header: 'Tier', sortable: true, sortVal: r => (r.price_tier ?? '').toLowerCase(),
      render: r => <span style={tierStyle}>{r.price_tier ?? 'retail'}</span> },
    { key: 'source', header: 'Source', sortable: true, sortVal: r => (r.source ?? '').toLowerCase(),
      render: r => <span style={sourceStyle}>{SOURCE_LABEL[r.source ?? ''] ?? r.source ?? '—'}</span> },
    { key: 'qb_customer_id', header: 'QuickBooks', sortable: true, sortVal: r => (r.qb_customer_id ? 1 : 0), defaultVisible: false,
      render: r => r.qb_customer_id ? <span style={{ ...sourceStyle, color: '#166534', background: '#dcfce7' }}>Synced</span> : <span style={SS.muted}>—</span> },
    { key: 'created_at', header: 'Added', sortable: true, sortVal: r => r.created_at,
      render: r => <span style={SS.muted}>{fmtDate(r.created_at)}</span> },
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
    setSaveSuccess(true); setSaving(false); setForm(EMPTY_CUSTOMER_FORM);
    setTimeout(() => { setShowForm(false); setSaveSuccess(false); void loadCustomers(); }, 900);
  }

  return (
    <>
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
              <button type="submit" style={saving ? SS.submitBtnDisabled : SS.submitBtn} disabled={saving}>
                {saving ? 'Saving…' : 'Save Customer'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
