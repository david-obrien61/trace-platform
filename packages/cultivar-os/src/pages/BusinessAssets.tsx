// ============================================================
// BusinessAssets — asset registry page (Cultivar OS)
// PURPOSE:      List + add ASSET-type cost objects for a business, AND edit each row
//               inline: project assignment (parent_id), Schedule C category
//               (cost_category), amount (acquisition_cost), confidence (cost_confidence).
//               Edits write immediately (reassign() pattern) under RLS — categorizing /
//               assigning here recomputes the /costs flat + by-project totals, which read
//               the SAME cost_objects rows (THUNDER 2026-06-18 editable-assign pass).
// DEPENDENCIES: supabase (cost_objects, node_type='ASSET' rows + node_type='PROJECT' for
//               the project picker), useBusinessContext (businessId → RLS scope),
//               @trace/shared/business-logic CATEGORY_OPTS (the shared Schedule C set).
// OUTPUTS:      Reads cost_objects ASSET rows; per-row immediate UPDATEs of parent_id,
//               cost_category, acquisition_cost, cost_confidence (RLS-scoped by business_id).
// SCOPE:        EDIT ONLY — no split, no delete. The existing Add-Asset form (create) stays.
// NOTE:         Table renamed business_assets → cost_objects (2026-06-15, Core-1). Queries are
//               ASSET-scoped via node_type since cost_objects also holds PROJECT/PRODUCT nodes.
// SURFACE HONESTY: every inline control writes or is absent — UNKNOWN ⟺ no amount (setting a
//               confidence of UNKNOWN clears the amount; entering an amount on an UNKNOWN row
//               bumps it to ESTIMATED), mirroring the by-project tree's coherence rule.
// INSTRUMENTATION (STD-003): `[TRACE:assets]` emits on load + every inline edit
//               (assetId, field, from→to). ON BY DEFAULT (standing owner instruction — do NOT
//               comment out until David lifts it, even after owner-proof).
// ============================================================
import { useState, useEffect } from 'react';
import { Plus, X, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { CATEGORY_OPTS } from '@trace/shared/business-logic';

const STATUS_OPTIONS = ['ACTIVE', 'IN_REPAIR', 'OFFLINE', 'RETIRED'] as const;
type AssetStatus = typeof STATUS_OPTIONS[number];

// Surface Honesty: manual cost entry = ESTIMATED unless receipt-backed.
// CONFIRMED requires a receipt link (future flow). DERIVED is AI-only.
// The Add form offers only ESTIMATED/UNKNOWN, but inline edit shows the FULL set so a seeded
// CONFIRMED/DERIVED row displays and stays selectable.
const CONFIDENCE_EDIT_OPTIONS = ['CONFIRMED', 'DERIVED', 'ESTIMATED', 'UNKNOWN'] as const;
type CostConfidence = 'CONFIRMED' | 'DERIVED' | 'ESTIMATED' | 'UNKNOWN';

const COMPANY_LEVEL = '__company__'; // <select> sentinel for parent_id = null

interface ProjectOption { id: string; name: string; }

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
  parent_id: string | null;        // project (PROJECT node) or null = company-level
  cost_category: string | null;    // Schedule C category or null = uncategorized
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
  th: { textAlign: 'left' as const, padding: '0.5rem 0.75rem', borderBottom: '2px solid #e5e7eb', color: '#374151', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const } as React.CSSProperties,
  td: { padding: '0.625rem 0.75rem', borderBottom: '1px solid #f3f4f6', color: '#111827', verticalAlign: 'top' as const } as React.CSSProperties,
  badge: (color: string): React.CSSProperties => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, background: color === 'green' ? '#dcfce7' : color === 'amber' ? '#fef3c7' : color === 'red' ? '#fee2e2' : '#f3f4f6', color: color === 'green' ? '#166534' : color === 'amber' ? '#92400e' : color === 'red' ? '#b91c1c' : '#6b7280' }),
  empty: { textAlign: 'center' as const, color: '#6b7280', padding: '2rem', fontSize: '0.9rem' } as React.CSSProperties,
  modal: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 } as React.CSSProperties,
  sheet: { background: '#fff', borderRadius: '16px 16px 0 0', padding: '1.5rem', width: '100%', maxWidth: 640, maxHeight: '92vh', overflowY: 'auto' as const } as React.CSSProperties,
  sheetHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' } as React.CSSProperties,
  // Inline-edit controls (immediate write). Compact, obviously editable, match the cell idiom.
  inlineSelect: { border: '1.5px solid #d1d5db', borderRadius: 7, padding: '4px 6px', fontSize: '0.8rem', color: '#111827', background: '#fff', cursor: 'pointer', maxWidth: 160 } as React.CSSProperties,
  inlineAmount: { width: 84, border: '1.5px solid #d1d5db', borderRadius: 7, padding: '4px 6px', fontSize: '0.8rem', color: '#111827', background: '#fff', textAlign: 'right' as const } as React.CSSProperties,
  confSelect: (c: CostConfidence | null): React.CSSProperties => {
    const weak = c === 'UNKNOWN' || c === 'ESTIMATED' || c == null;
    return { border: '1.5px solid #d1d5db', borderRadius: 7, padding: '4px 6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', background: weak ? '#fee2e2' : '#dcfce7', color: weak ? '#991b1b' : '#166534' };
  },
  catUncat: { color: '#92400e', fontStyle: 'italic' as const } as React.CSSProperties,
};

const STATUS_COLOR: Record<AssetStatus, string> = {
  ACTIVE: 'green',
  IN_REPAIR: 'amber',
  OFFLINE: 'amber',
  RETIRED: 'red',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function BusinessAssets() {
  const { businessId } = useBusinessContext();

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
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
    loadProjects();
  }, [businessId]);

  async function loadAssets() {
    setListLoading(true);
    setListError(null);
    console.log('[TRACE:assets] loadAssets → cost_objects (node_type=ASSET)', { businessId });
    const { data, error } = await supabase
      .from('cost_objects')
      .select('id,name,asset_type,make,model,year,location,status,acquisition_cost,cost_confidence,parent_id,cost_category,serial_number,notes,created_at')
      .eq('business_id', businessId)
      .eq('node_type', 'ASSET')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) { console.error('[TRACE:assets] loadAssets error', error.message); setListError(error.message); setListLoading(false); return; }
    console.log('[TRACE:assets] loadAssets ok', { count: data?.length ?? 0 });
    setAssets((data ?? []) as AssetRow[]);
    setListLoading(false);
  }

  // PROJECT nodes for the inline project picker (same source the Settings + tree pickers use).
  async function loadProjects() {
    const { data, error } = await supabase
      .from('cost_objects')
      .select('id,name')
      .eq('business_id', businessId)
      .eq('node_type', 'PROJECT')
      .eq('is_active', true);
    if (error) { console.warn('[TRACE:assets] loadProjects error', error.message); return; }
    setProjects((data ?? []).map((p: any) => ({ id: String(p.id), name: p.name ?? 'Untitled project' })));
  }

  // ── Inline edit: one immediate write per field, matching reassign()'s pattern, RLS-scoped. ──
  async function writeAsset(asset: AssetRow, patch: Record<string, unknown>, field: string, to: unknown) {
    const from = (asset as any)[field];
    console.log('[TRACE:assets] edit', { assetId: asset.id, field, from, to });
    const { error } = await supabase
      .from('cost_objects')
      .update(patch)
      .eq('id', asset.id)
      .eq('business_id', businessId)
      .eq('node_type', 'ASSET');
    if (error) { console.error('[TRACE:assets] edit error', field, error.message); setListError(error.message); return; }
    await loadAssets(); // reload → /costs (flat + by-project) recomputes from the same fresh rows
  }

  function onProject(asset: AssetRow, sel: string) {
    const parent_id = sel === COMPANY_LEVEL ? null : sel;
    if (parent_id === asset.parent_id) return;
    writeAsset(asset, { parent_id }, 'parent_id', parent_id);
  }
  function onCategory(asset: AssetRow, val: string) {
    const cost_category = val || null;
    if (cost_category === asset.cost_category) return;
    writeAsset(asset, { cost_category }, 'cost_category', cost_category);
  }
  // Coherence (UNKNOWN ⟺ no amount): UNKNOWN clears the amount; any other grade keeps it.
  function onConfidence(asset: AssetRow, conf: CostConfidence) {
    if (conf === asset.cost_confidence) return;
    const patch = conf === 'UNKNOWN'
      ? { cost_confidence: 'UNKNOWN', acquisition_cost: null }
      : { cost_confidence: conf };
    writeAsset(asset, patch, 'cost_confidence', conf);
  }
  // Coherence: clearing the amount → UNKNOWN; entering an amount on an UNKNOWN row → ESTIMATED.
  function onAmount(asset: AssetRow, value: number | null) {
    if (value === (asset.acquisition_cost ?? null)) return;
    const patch = value == null
      ? { acquisition_cost: null, cost_confidence: 'UNKNOWN' }
      : { acquisition_cost: value, cost_confidence: asset.cost_confidence === 'UNKNOWN' ? 'ESTIMATED' : (asset.cost_confidence ?? 'ESTIMATED') };
    writeAsset(asset, patch, 'acquisition_cost', value);
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
      node_type: 'ASSET',
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

    console.log('[TRACE:assets] insert → cost_objects', { node_type: 'ASSET', name: payload.name });
    const { error } = await supabase.from('cost_objects').insert(payload);

    if (error) {
      console.error('[TRACE:assets] insert error', error.message);
      setSaveError(error.message);
      setSaving(false);
      return;
    }
    console.log('[TRACE:assets] insert ok');

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
          <>
            <p style={{ ...S.hint, marginTop: 0, marginBottom: 10 }}>
              Assign each asset to a project and give it a category — those choices feed your
              cost-to-produce by project. Changes save as you make them.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Name</th>
                    <th style={S.th}>Make / Model</th>
                    <th style={S.th}>Location</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}>Project</th>
                    <th style={S.th}>Category</th>
                    <th style={S.th}>Amount</th>
                    <th style={S.th}>Confidence</th>
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
                      <td style={S.td}>
                        {[a.make, a.model, a.year ? String(a.year) : null].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td style={S.td}>{a.location ?? '—'}</td>
                      <td style={S.td}>
                        <span style={S.badge(STATUS_COLOR[a.status])}>{a.status}</span>
                      </td>

                      {/* ── Project (parent_id) — immediate write ── */}
                      <td style={S.td}>
                        <select
                          style={S.inlineSelect}
                          value={a.parent_id ?? COMPANY_LEVEL}
                          onChange={e => onProject(a, e.target.value)}
                          title="Assign this asset to a project"
                        >
                          <option value={COMPANY_LEVEL}>Company-level</option>
                          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </td>

                      {/* ── Category (cost_category) — immediate write ── */}
                      <td style={S.td}>
                        <select
                          style={{ ...S.inlineSelect, ...(a.cost_category ? {} : S.catUncat) }}
                          value={a.cost_category ?? ''}
                          onChange={e => onCategory(a, e.target.value)}
                          title="Schedule C category"
                        >
                          <option value="">uncategorized</option>
                          {CATEGORY_OPTS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>

                      {/* ── Amount (acquisition_cost) — immediate write on blur/Enter ── */}
                      <td style={S.td}>
                        <AmountCell key={String(a.acquisition_cost)} value={a.acquisition_cost} onCommit={v => onAmount(a, v)} />
                      </td>

                      {/* ── Confidence (cost_confidence) — immediate write ── */}
                      <td style={S.td}>
                        <select
                          style={S.confSelect(a.cost_confidence)}
                          value={a.cost_confidence ?? 'ESTIMATED'}
                          onChange={e => onConfidence(a, e.target.value as CostConfidence)}
                          title="How sure are you of this cost?"
                        >
                          {CONFIDENCE_EDIT_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>

                      <td style={{ ...S.td, color: '#6b7280', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{fmtDate(a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
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

/**
 * Inline amount cell — text input that commits the parsed number on blur/Enter (null when empty).
 * Mirrors the by-project tree's AmountInput coherence: empty → null routes to UNKNOWN upstream.
 * Re-syncs to the latest stored value via key when the row reloads.
 */
function AmountCell({ value, onCommit }: { value: number | null; onCommit: (v: number | null) => void }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const commit = () => {
    const raw = text.replace(/[^0-9.]/g, '');
    const n = parseFloat(raw);
    onCommit(raw === '' || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);
  };
  return (
    <input
      inputMode="decimal"
      value={text}
      placeholder="unknown"
      onChange={e => setText(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
      onBlur={commit}
      style={S.inlineAmount}
    />
  );
}
