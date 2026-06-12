import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';

const STATUS_OPTIONS = ['ACTIVE', 'IN_REPAIR', 'OFFLINE', 'RETIRED'] as const;
type AssetStatus = typeof STATUS_OPTIONS[number];

// Surface Honesty: manual cost entry = ESTIMATED unless receipt-backed.
// CONFIRMED requires a receipt link (future flow). DERIVED is AI-only.
const CONFIDENCE_OPTIONS = ['ESTIMATED', 'UNKNOWN'] as const;
type CostConfidence = 'CONFIRMED' | 'DERIVED' | 'ESTIMATED' | 'UNKNOWN';

interface AssetRow {
  id: string;
  name: string;
  asset_type: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  location: string | null;
  status: AssetStatus;
  acquisition_cost: number | null;
  cost_confidence: CostConfidence | null;
  serial_number: string | null;
  notes: string | null;
  created_at: string;
}

interface FormState {
  name: string;
  asset_type: string;
  make: string;
  model: string;
  serial_number: string;
  year: string;
  location: string;
  status: AssetStatus;
  acquisition_cost: string;
  cost_confidence: CostConfidence;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  asset_type: '',
  make: '',
  model: '',
  serial_number: '',
  year: '',
  location: '',
  status: 'ACTIVE',
  acquisition_cost: '',
  cost_confidence: 'ESTIMATED',
  notes: '',
};

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
  submitBtn: { width: '100%', minHeight: 48, background: '#27500A', color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
  submitBtnDisabled: { width: '100%', minHeight: 48, background: '#9ca3af', color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 600, cursor: 'not-allowed' } as React.CSSProperties,
  error: { color: '#b91c1c', background: '#fee2e2', borderRadius: 8, padding: '0.6rem 0.875rem', fontSize: '0.88rem', marginBottom: 12 } as React.CSSProperties,
  success: { color: '#166534', background: '#dcfce7', borderRadius: 8, padding: '0.6rem 0.875rem', fontSize: '0.88rem', marginBottom: 12 } as React.CSSProperties,
  addBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1.5px solid #27500A', borderRadius: 8, padding: '0.5rem 0.875rem', color: '#27500A', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.88rem' } as React.CSSProperties,
  th: { textAlign: 'left' as const, padding: '0.5rem 0.75rem', borderBottom: '2px solid #e5e7eb', color: '#374151', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase' as const } as React.CSSProperties,
  td: { padding: '0.625rem 0.75rem', borderBottom: '1px solid #f3f4f6', color: '#111827', verticalAlign: 'top' as const } as React.CSSProperties,
  badge: (color: string): React.CSSProperties => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, background: color === 'green' ? '#dcfce7' : color === 'amber' ? '#fef3c7' : color === 'red' ? '#fee2e2' : '#f3f4f6', color: color === 'green' ? '#166534' : color === 'amber' ? '#92400e' : color === 'red' ? '#b91c1c' : '#6b7280' }),
  empty: { textAlign: 'center' as const, color: '#6b7280', padding: '2rem', fontSize: '0.9rem' } as React.CSSProperties,
  modal: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 } as React.CSSProperties,
  sheet: { background: '#fff', borderRadius: '16px 16px 0 0', padding: '1.5rem', width: '100%', maxWidth: 640, maxHeight: '92vh', overflowY: 'auto' as const } as React.CSSProperties,
  sheetHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' } as React.CSSProperties,
};

const STATUS_COLOR: Record<AssetStatus, string> = {
  ACTIVE: 'green',
  IN_REPAIR: 'amber',
  OFFLINE: 'amber',
  RETIRED: 'red',
};

function confidenceLabel(c: CostConfidence | null): string {
  if (!c) return '—';
  return { CONFIRMED: 'Confirmed', DERIVED: 'AI-Derived', ESTIMATED: 'Estimated', UNKNOWN: 'Unknown' }[c];
}

function fmtMoney(n: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function BusinessAssets() {
  const navigate = useNavigate();
  const { businessId } = useBusinessContext();

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    loadAssets();
  }, [businessId]);

  async function loadAssets() {
    setListLoading(true);
    setListError(null);
    const { data, error } = await supabase
      .from('business_assets')
      .select('id,name,asset_type,make,model,year,location,status,acquisition_cost,cost_confidence,serial_number,notes,created_at')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) { setListError(error.message); setListLoading(false); return; }
    setAssets((data ?? []) as AssetRow[]);
    setListLoading(false);
  }

  function set(field: keyof FormState, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    // Surface Honesty: if cost is typed but confidence is UNKNOWN, bump to ESTIMATED
    if (field === 'acquisition_cost' && value && form.cost_confidence === 'UNKNOWN') {
      setForm(f => ({ ...f, acquisition_cost: value, cost_confidence: 'ESTIMATED' }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;
    if (!form.name.trim()) { setSaveError('Name is required.'); return; }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const payload: Record<string, unknown> = {
      business_id: businessId,
      name: form.name.trim(),
      status: form.status,
      cost_confidence: form.cost_confidence,
    };

    if (form.asset_type.trim())   payload.asset_type   = form.asset_type.trim();
    if (form.make.trim())         payload.make         = form.make.trim();
    if (form.model.trim())        payload.model        = form.model.trim();
    if (form.serial_number.trim()) payload.serial_number = form.serial_number.trim();
    if (form.year.trim())         payload.year         = parseInt(form.year, 10);
    if (form.location.trim())     payload.location     = form.location.trim();
    if (form.notes.trim())        payload.notes        = form.notes.trim();
    if (form.acquisition_cost.trim()) {
      const parsed = parseFloat(form.acquisition_cost);
      if (!isNaN(parsed)) payload.acquisition_cost = parsed;
    }

    const { error } = await supabase.from('business_assets').insert(payload);

    if (error) {
      setSaveError(error.message);
      setSaving(false);
      return;
    }

    setSaveSuccess(true);
    setSaving(false);
    setForm(EMPTY_FORM);
    // Delay closing so user sees success, then reload list
    setTimeout(() => {
      setShowForm(false);
      setSaveSuccess(false);
      loadAssets();
    }, 900);
  }

  return (
    <div style={S.page}>

      {/* Header */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={22} color="#27500A" />
        </button>
        <h1 style={S.title}>Assets</h1>
        <div style={{ flex: 1 }} />
        <button style={S.addBtn} onClick={() => { setShowForm(true); setSaveError(null); setSaveSuccess(false); }}>
          <Plus size={16} />
          Add Asset
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
        {!listLoading && !listError && assets.length === 0 && (
          <div style={S.empty}>
            <Package size={32} color="#d1d5db" style={{ marginBottom: 8 }} />
            <p style={{ margin: 0 }}>No assets yet. Add your first one.</p>
          </div>
        )}
        {!listLoading && assets.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Name</th>
                  <th style={S.th}>Type</th>
                  <th style={S.th}>Make / Model</th>
                  <th style={S.th}>Location</th>
                  <th style={S.th}>Status</th>
                  <th style={S.th}>Cost</th>
                  <th style={S.th}>Added</th>
                </tr>
              </thead>
              <tbody>
                {assets.map(a => (
                  <tr key={a.id}>
                    <td style={{ ...S.td, fontWeight: 600 }}>
                      {a.name}
                      {a.serial_number && (
                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 400 }}>
                          S/N {a.serial_number}
                        </span>
                      )}
                    </td>
                    <td style={S.td}>{a.asset_type ?? '—'}</td>
                    <td style={S.td}>
                      {[a.make, a.model, a.year ? String(a.year) : null].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td style={S.td}>{a.location ?? '—'}</td>
                    <td style={S.td}>
                      <span style={S.badge(STATUS_COLOR[a.status])}>{a.status}</span>
                    </td>
                    <td style={S.td}>
                      {fmtMoney(a.acquisition_cost)}
                      {a.cost_confidence && (
                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#9ca3af' }}>
                          {confidenceLabel(a.cost_confidence)}
                        </span>
                      )}
                    </td>
                    <td style={{ ...S.td, color: '#6b7280', fontSize: '0.8rem' }}>{fmtDate(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Asset bottom sheet */}
      {showForm && (
        <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div style={S.sheet}>
            <div style={S.sheetHeader}>
              <h2 style={{ ...S.sectionTitle, margin: 0 }}>Add Asset</h2>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                onClick={() => setShowForm(false)}
              >
                <X size={20} color="#6b7280" />
              </button>
            </div>

            {saveError && <div style={S.error}>{saveError}</div>}
            {saveSuccess && <div style={S.success}>Asset saved.</div>}

            <form onSubmit={handleSubmit}>
              <div style={S.field}>
                <label style={S.label}>Name *</label>
                <input style={S.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. John Deere Tractor" required />
              </div>

              <div style={{ ...S.row2, ...S.field }}>
                <div>
                  <label style={S.label}>Asset Type</label>
                  <input style={S.input} value={form.asset_type} onChange={e => set('asset_type', e.target.value)} placeholder="e.g. Equipment, Vehicle" />
                </div>
                <div>
                  <label style={S.label}>Status</label>
                  <select style={S.select} value={form.status} onChange={e => set('status', e.target.value as AssetStatus)}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ ...S.row2, ...S.field }}>
                <div>
                  <label style={S.label}>Make</label>
                  <input style={S.input} value={form.make} onChange={e => set('make', e.target.value)} placeholder="e.g. John Deere" />
                </div>
                <div>
                  <label style={S.label}>Model</label>
                  <input style={S.input} value={form.model} onChange={e => set('model', e.target.value)} placeholder="e.g. 1025R" />
                </div>
              </div>

              <div style={{ ...S.row2, ...S.field }}>
                <div>
                  <label style={S.label}>Year</label>
                  <input style={S.input} type="number" value={form.year} onChange={e => set('year', e.target.value)} placeholder="e.g. 2019" min="1900" max="2100" />
                </div>
                <div>
                  <label style={S.label}>Serial Number</label>
                  <input style={S.input} value={form.serial_number} onChange={e => set('serial_number', e.target.value)} placeholder="Optional" />
                </div>
              </div>

              <div style={S.field}>
                <label style={S.label}>Location</label>
                <input style={S.input} value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Barn, Lot B, Site 3" />
              </div>

              <div style={{ ...S.row2, ...S.field }}>
                <div>
                  <label style={S.label}>Acquisition Cost</label>
                  <input style={S.input} type="number" step="0.01" min="0" value={form.acquisition_cost} onChange={e => set('acquisition_cost', e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label style={S.label}>Cost Confidence</label>
                  <select style={S.select} value={form.cost_confidence} onChange={e => set('cost_confidence', e.target.value as CostConfidence)}>
                    <option value="ESTIMATED">Estimated (my best guess)</option>
                    <option value="UNKNOWN">Unknown</option>
                  </select>
                  <p style={S.hint}>Manual entry = Estimated. Receipt-link confirms cost later.</p>
                </div>
              </div>

              <div style={S.field}>
                <label style={S.label}>Notes</label>
                <textarea style={S.textarea} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Condition, history, anything relevant…" />
              </div>

              <button
                type="submit"
                style={saving ? S.submitBtnDisabled : S.submitBtn}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Asset'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
