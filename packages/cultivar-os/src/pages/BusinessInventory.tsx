import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Archive } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';

type CostConfidence = 'CONFIRMED' | 'DERIVED' | 'ESTIMATED' | 'UNKNOWN';

interface InventoryRow {
  id: string;
  name: string;
  sku: string | null;
  qty: number;
  unit_cost: number | null;
  location: string | null;
  status: string;
  serial_number: string | null;
  cost_confidence: CostConfidence | null;
  received_at: string | null;
  notes: string | null;
  created_at: string;
}

interface FormState {
  name: string;
  sku: string;
  qty: string;
  unit_cost: string;
  location: string;
  status: string;
  serial_number: string;
  cost_confidence: CostConfidence;
  received_at: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  sku: '',
  qty: '0',
  unit_cost: '',
  location: '',
  status: 'available',
  serial_number: '',
  cost_confidence: 'ESTIMATED',
  received_at: '',
  notes: '',
};

// receipt_id is intentionally absent from manual form — linked by receipt flow later.

const STATUS_OPTIONS = ['available', 'reserved', 'depleted', 'damaged', 'returned'];

const S = {
  page: { minHeight: '100vh', background: '#EAF3DE', padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif' } as React.CSSProperties,
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 } as React.CSSProperties,
  backBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' } as React.CSSProperties,
  title: { fontSize: '1.25rem', fontWeight: 700, color: '#1a2e0a', margin: 0 } as React.CSSProperties,
  card: { background: '#fff', borderRadius: 12, padding: '1.25rem', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as React.CSSProperties,
  sectionTitle: { fontSize: '1rem', fontWeight: 600, color: '#27500A', margin: '0 0 1rem' } as React.CSSProperties,
  field: { marginBottom: 14 } as React.CSSProperties,
  label: { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 4 } as React.CSSProperties,
  input: { width: '100%', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.95rem', color: '#111827', boxSizing: 'border-box', background: '#fff' } as React.CSSProperties,
  select: { width: '100%', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.95rem', color: '#111827', boxSizing: 'border-box', background: '#fff', cursor: 'pointer' } as React.CSSProperties,
  textarea: { width: '100%', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.95rem', color: '#111827', boxSizing: 'border-box', background: '#fff', minHeight: 72, resize: 'vertical' as const } as React.CSSProperties,
  hint: { fontSize: '0.75rem', color: '#6b7280', marginTop: 3 } as React.CSSProperties,
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } as React.CSSProperties,
  row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 } as React.CSSProperties,
  submitBtn: { width: '100%', minHeight: 48, background: '#27500A', color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
  submitBtnDisabled: { width: '100%', minHeight: 48, background: '#9ca3af', color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 600, cursor: 'not-allowed' } as React.CSSProperties,
  error: { color: '#b91c1c', background: '#fee2e2', borderRadius: 8, padding: '0.6rem 0.875rem', fontSize: '0.88rem', marginBottom: 12 } as React.CSSProperties,
  success: { color: '#166534', background: '#dcfce7', borderRadius: 8, padding: '0.6rem 0.875rem', fontSize: '0.88rem', marginBottom: 12 } as React.CSSProperties,
  addBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1.5px solid #27500A', borderRadius: 8, padding: '0.5rem 0.875rem', color: '#27500A', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.88rem' } as React.CSSProperties,
  th: { textAlign: 'left' as const, padding: '0.5rem 0.75rem', borderBottom: '2px solid #e5e7eb', color: '#374151', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase' as const } as React.CSSProperties,
  td: { padding: '0.625rem 0.75rem', borderBottom: '1px solid #f3f4f6', color: '#111827', verticalAlign: 'top' as const } as React.CSSProperties,
  badge: (ok: boolean): React.CSSProperties => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, background: ok ? '#dcfce7' : '#f3f4f6', color: ok ? '#166534' : '#6b7280' }),
  empty: { textAlign: 'center' as const, color: '#6b7280', padding: '2rem', fontSize: '0.9rem' } as React.CSSProperties,
  modal: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 } as React.CSSProperties,
  sheet: { background: '#fff', borderRadius: '16px 16px 0 0', padding: '1.5rem', width: '100%', maxWidth: 640, maxHeight: '92vh', overflowY: 'auto' as const } as React.CSSProperties,
  sheetHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' } as React.CSSProperties,
  qtyPill: { display: 'inline-block', minWidth: 36, textAlign: 'center' as const, background: '#f3f4f6', borderRadius: 20, padding: '2px 10px', fontWeight: 700, fontSize: '0.9rem' } as React.CSSProperties,
};

function confidenceLabel(c: CostConfidence | null): string {
  if (!c) return '—';
  return { CONFIRMED: 'Confirmed', DERIVED: 'AI-Derived', ESTIMATED: 'Estimated', UNKNOWN: 'Unknown' }[c];
}

function fmtMoney(n: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function BusinessInventory() {
  const navigate = useNavigate();
  const { businessId } = useBusinessContext();

  const [items, setItems] = useState<InventoryRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    loadItems();
  }, [businessId]);

  async function loadItems() {
    setListLoading(true);
    setListError(null);
    const { data, error } = await supabase
      .from('business_inventory')
      .select('id,name,sku,qty,unit_cost,location,status,serial_number,cost_confidence,received_at,notes,created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) { setListError(error.message); setListLoading(false); return; }
    setItems((data ?? []) as InventoryRow[]);
    setListLoading(false);
  }

  function set(field: keyof FormState, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;
    if (!form.name.trim()) { setSaveError('Name is required.'); return; }

    const qty = parseInt(form.qty, 10);
    if (isNaN(qty) || qty < 0) { setSaveError('Quantity must be 0 or greater.'); return; }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const payload: Record<string, unknown> = {
      business_id: businessId,
      name: form.name.trim(),
      qty,
      status: form.status,
      cost_confidence: form.cost_confidence,
      // receipt_id intentionally absent — linked by receipt flow later
    };

    if (form.sku.trim())           payload.sku           = form.sku.trim();
    if (form.location.trim())      payload.location      = form.location.trim();
    if (form.serial_number.trim()) payload.serial_number = form.serial_number.trim();
    if (form.notes.trim())         payload.notes         = form.notes.trim();
    if (form.received_at)          payload.received_at   = form.received_at;
    if (form.unit_cost.trim()) {
      const parsed = parseFloat(form.unit_cost);
      if (!isNaN(parsed)) payload.unit_cost = parsed;
    }

    const { error } = await supabase.from('business_inventory').insert(payload);

    if (error) {
      setSaveError(error.message);
      setSaving(false);
      return;
    }

    setSaveSuccess(true);
    setSaving(false);
    setForm(EMPTY_FORM);
    setTimeout(() => {
      setShowForm(false);
      setSaveSuccess(false);
      loadItems();
    }, 900);
  }

  return (
    <div style={S.page}>

      {/* Header */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={22} color="#27500A" />
        </button>
        <h1 style={S.title}>Inventory</h1>
        <div style={{ flex: 1 }} />
        <button style={S.addBtn} onClick={() => { setShowForm(true); setSaveError(null); setSaveSuccess(false); }}>
          <Plus size={16} />
          Add Item
        </button>
      </div>

      {/* List */}
      <div style={S.card}>
        {listLoading && (
          <p style={S.empty}>Loading…</p>
        )}
        {listError && (
          <p style={{ ...S.empty, color: '#b91c1c' }}>Error: {listError}</p>
        )}
        {!listLoading && !listError && items.length === 0 && (
          <div style={S.empty}>
            <Archive size={32} color="#d1d5db" style={{ marginBottom: 8 }} />
            <p style={{ margin: 0 }}>No inventory yet. Add your first item.</p>
          </div>
        )}
        {!listLoading && items.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Name / SKU</th>
                  <th style={S.th}>Qty</th>
                  <th style={S.th}>Unit Cost</th>
                  <th style={S.th}>Location</th>
                  <th style={S.th}>Status</th>
                  <th style={S.th}>Received</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td style={{ ...S.td, fontWeight: 600 }}>
                      {item.name}
                      {item.sku && (
                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 400 }}>
                          SKU {item.sku}
                        </span>
                      )}
                      {item.serial_number && (
                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 400 }}>
                          S/N {item.serial_number}
                        </span>
                      )}
                    </td>
                    <td style={S.td}>
                      <span style={S.qtyPill}>{item.qty}</span>
                    </td>
                    <td style={S.td}>
                      {fmtMoney(item.unit_cost)}
                      {item.cost_confidence && (
                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#9ca3af' }}>
                          {confidenceLabel(item.cost_confidence)}
                        </span>
                      )}
                    </td>
                    <td style={S.td}>{item.location ?? '—'}</td>
                    <td style={S.td}>
                      <span style={S.badge(item.status === 'available')}>{item.status}</span>
                    </td>
                    <td style={{ ...S.td, color: '#6b7280', fontSize: '0.8rem' }}>
                      {fmtDate(item.received_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Inventory bottom sheet */}
      {showForm && (
        <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div style={S.sheet}>
            <div style={S.sheetHeader}>
              <h2 style={{ ...S.sectionTitle, margin: 0 }}>Add Inventory Item</h2>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                onClick={() => setShowForm(false)}
              >
                <X size={20} color="#6b7280" />
              </button>
            </div>

            {saveError && <div style={S.error}>{saveError}</div>}
            {saveSuccess && <div style={S.success}>Item saved.</div>}

            <form onSubmit={handleSubmit}>
              <div style={S.field}>
                <label style={S.label}>Name *</label>
                <input style={S.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Fertilizer 10-10-10, Netting 6×12" required />
              </div>

              <div style={{ ...S.row3, ...S.field }}>
                <div>
                  <label style={S.label}>SKU</label>
                  <input style={S.input} value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label style={S.label}>Qty *</label>
                  <input style={S.input} type="number" min="0" value={form.qty} onChange={e => set('qty', e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>Status</label>
                  <select style={S.select} value={form.status} onChange={e => set('status', e.target.value)}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ ...S.row2, ...S.field }}>
                <div>
                  <label style={S.label}>Unit Cost</label>
                  <input style={S.input} type="number" step="0.01" min="0" value={form.unit_cost} onChange={e => set('unit_cost', e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label style={S.label}>Cost Confidence</label>
                  <select style={S.select} value={form.cost_confidence} onChange={e => set('cost_confidence', e.target.value as CostConfidence)}>
                    <option value="ESTIMATED">Estimated (my best guess)</option>
                    <option value="UNKNOWN">Unknown</option>
                  </select>
                  <p style={S.hint}>Receipt-link = Confirmed. Manual = Estimated.</p>
                </div>
              </div>

              <div style={{ ...S.row2, ...S.field }}>
                <div>
                  <label style={S.label}>Location</label>
                  <input style={S.input} value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Shed A, Greenhouse 2" />
                </div>
                <div>
                  <label style={S.label}>Serial Number</label>
                  <input style={S.input} value={form.serial_number} onChange={e => set('serial_number', e.target.value)} placeholder="Optional" />
                </div>
              </div>

              <div style={S.field}>
                <label style={S.label}>Date Received</label>
                <input style={S.input} type="date" value={form.received_at} onChange={e => set('received_at', e.target.value)} />
              </div>

              <div style={S.field}>
                <label style={S.label}>Notes</label>
                <textarea style={S.textarea} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Supplier, purchase context, storage notes…" />
              </div>

              <button
                type="submit"
                style={saving ? S.submitBtnDisabled : S.submitBtn}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Item'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
