// ============================================================
// BusinessAssets — asset registry DATASHEET (Cultivar OS)
// PURPOSE:      The desktop registry + reconcile surface for ASSET-type cost objects. Now runs
//               through the SAME shared <DataSheet> engine /inventory uses (one engine, two
//               configs — AC-4 settle-once; retires the old pre-datasheet fixed table that
//               couldn't sort/search/hide-columns). Every field is inline-editable on the row:
//               name, make, model, serial_number, year, location, project (parent_id), category
//               (cost_category), status, estimated_value (what-it's-worth), acquisition_cost
//               (what-was-paid), notes. Create still happens via the Add-Asset sheet; camera
//               capture via /assets/capture.
// AMOUNT:       The primary AMOUNT column reads estimated_value (what-it's-worth), NOT
//               acquisition_cost — this dissolves the old "CONFIRMED…unknown" display bug where
//               the column read acquisition_cost (null for Vision-captured assets). acquisition_cost
//               ("Paid") is its own hideable column. estimated_value edit → estimated_value_confidence
//               CONFIRMED (owner asserted it); clearing → UNKNOWN (Surface Honesty coherence).
// DEPENDENCIES: supabase (cost_objects node_type='ASSET' rows + node_type='PROJECT' for the project
//               picker), useBusinessContext (businessId → RLS scope), @trace/shared/business-logic
//               CATEGORY_OPTS, DataSheet cell components.
// OUTPUTS:      Per-row immediate UPDATE on cost_objects (.eq('id').eq('business_id').eq('node_type',
//               'ASSET')) — parent_id, cost_category, status, make, model, serial_number, year,
//               location, name, notes, estimated_value(+_confidence), acquisition_cost(+cost_confidence).
//               Categorizing / assigning recomputes /costs flat + by-project totals (same rows).
// GATE:         Inherits the /assets VIEW_COSTS route gate + cost_objects RLS (owner_all + member_all).
// INSTRUMENTATION (STD-003): `[TRACE:assets]` on load + every inline edit (assetId, field, from→to).
//               ON BY DEFAULT — standing owner instruction (do NOT comment out).
// ============================================================
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Package, Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { CATEGORY_OPTS } from '@trace/shared/business-logic';
import {
  DataSheet, TextCell, NumberCell, AmountCell, SelectCell, confidenceStyleFor, sheetStyles as SS,
  type DataSheetColumn,
} from '../components/datasheet/DataSheet';

const STATUS_OPTIONS = ['ACTIVE', 'IN_REPAIR', 'OFFLINE', 'RETIRED'] as const;
type AssetStatus = typeof STATUS_OPTIONS[number];

// Inline edit shows the FULL confidence set so a seeded CONFIRMED/DERIVED row stays selectable.
const CONFIDENCE_OPTS = ['CONFIRMED', 'DERIVED', 'ESTIMATED', 'UNKNOWN'] as const;
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
  estimated_value: number | null;
  estimated_value_confidence: CostConfidence | null;
  parent_id: string | null;     // project (PROJECT node) or null = company-level
  cost_category: string | null; // Schedule C category or null = uncategorized
  serial_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

interface FormState {
  name: string; asset_type: string; make: string; model: string; serial_number: string;
  year: string; location: string; status: AssetStatus; acquisition_cost: string;
  cost_confidence: CostConfidence; notes: string;
}
const EMPTY_FORM: FormState = {
  name: '', asset_type: '', make: '', model: '', serial_number: '', year: '',
  location: '', status: 'ACTIVE', acquisition_cost: '', cost_confidence: 'ESTIMATED', notes: '',
};

const STATUS_COLOR: Record<string, React.CSSProperties> = {
  ACTIVE:    { background: '#dcfce7', color: '#166534' },
  IN_REPAIR: { background: '#fef3c7', color: '#92400e' },
  OFFLINE:   { background: '#fef3c7', color: '#92400e' },
  RETIRED:   { background: '#fee2e2', color: '#b91c1c' },
};
function statusStyleFor(v: string): React.CSSProperties {
  return { border: '1.5px solid #d1d5db', borderRadius: 6, padding: '3px 5px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', maxWidth: 130, ...(STATUS_COLOR[v] ?? {}) };
}
function catStyleFor(v: string): React.CSSProperties {
  return v === '' ? { color: '#92400e', fontStyle: 'italic' } : {};
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function BusinessAssets() {
  const { businessId } = useBusinessContext();
  const navigate = useNavigate();

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
      .select('id,name,asset_type,make,model,year,location,status,acquisition_cost,cost_confidence,estimated_value,estimated_value_confidence,parent_id,cost_category,serial_number,notes,created_at,updated_at')
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
    setProjects((data ?? []).map((p: { id: string; name: string | null }) => ({ id: String(p.id), name: p.name ?? 'Untitled project' })));
  }

  // ── Inline edit: one immediate write per field, RLS-scoped, ASSET-guarded. ──
  async function writeAsset(asset: AssetRow, patch: Record<string, unknown>, field: string, to: unknown) {
    const from = (asset as unknown as Record<string, unknown>)[field];
    console.log('[TRACE:assets] edit', { assetId: asset.id, field, from, to });
    const { error } = await supabase
      .from('cost_objects')
      .update(patch)
      .eq('id', asset.id)
      .eq('business_id', businessId)
      .eq('node_type', 'ASSET');
    if (error) { console.error('[TRACE:assets] edit error', field, error.message); setListError(error.message); return; }
    await loadAssets(); // reload → /costs recomputes from the same fresh rows
  }

  function onText(asset: AssetRow, field: 'name' | 'make' | 'model' | 'serial_number' | 'location' | 'notes', raw: string | null) {
    const trimmed = (raw ?? '').trim();
    if (field === 'name' && trimmed === '') return; // name is NOT NULL
    const value = trimmed === '' ? null : trimmed;
    if (value === (asset as unknown as Record<string, unknown>)[field]) return;
    void writeAsset(asset, { [field]: value }, field, value);
  }
  function onYear(asset: AssetRow, value: number | null) {
    if (value === (asset.year ?? null)) return;
    void writeAsset(asset, { year: value }, 'year', value);
  }
  function onProject(asset: AssetRow, sel: string) {
    const parent_id = sel === COMPANY_LEVEL ? null : sel;
    if (parent_id === asset.parent_id) return;
    void writeAsset(asset, { parent_id }, 'parent_id', parent_id);
  }
  function onCategory(asset: AssetRow, val: string) {
    const cost_category = val || null;
    if (cost_category === asset.cost_category) return;
    void writeAsset(asset, { cost_category }, 'cost_category', cost_category);
  }
  function onStatus(asset: AssetRow, val: string) {
    if (val === asset.status) return;
    void writeAsset(asset, { status: val }, 'status', val);
  }
  // estimated_value (what-it's-worth) coherence: owner typing a value = CONFIRMED; clearing → UNKNOWN.
  function onEstimatedValue(asset: AssetRow, value: number | null) {
    if (value === (asset.estimated_value ?? null)) return;
    const patch = value == null
      ? { estimated_value: null, estimated_value_confidence: 'UNKNOWN' }
      : { estimated_value: value, estimated_value_confidence: 'CONFIRMED' };
    void writeAsset(asset, patch, 'estimated_value', value);
  }
  function onEstimatedConfidence(asset: AssetRow, conf: CostConfidence) {
    if (conf === asset.estimated_value_confidence) return;
    const patch = conf === 'UNKNOWN' ? { estimated_value_confidence: 'UNKNOWN', estimated_value: null } : { estimated_value_confidence: conf };
    void writeAsset(asset, patch, 'estimated_value_confidence', conf);
  }
  // acquisition_cost (what-was-paid) coherence: manual entry = ESTIMATED; clearing → UNKNOWN.
  function onAcquisitionCost(asset: AssetRow, value: number | null) {
    if (value === (asset.acquisition_cost ?? null)) return;
    const patch = value == null
      ? { acquisition_cost: null, cost_confidence: 'UNKNOWN' }
      : { acquisition_cost: value, cost_confidence: asset.cost_confidence === 'UNKNOWN' || asset.cost_confidence == null ? 'ESTIMATED' : asset.cost_confidence };
    void writeAsset(asset, patch, 'acquisition_cost', value);
  }
  function onCostConfidence(asset: AssetRow, conf: CostConfidence) {
    if (conf === asset.cost_confidence) return;
    const patch = conf === 'UNKNOWN' ? { cost_confidence: 'UNKNOWN', acquisition_cost: null } : { cost_confidence: conf };
    void writeAsset(asset, patch, 'cost_confidence', conf);
  }

  const projectOpts = [{ value: COMPANY_LEVEL, label: 'Company-level' }, ...projects.map(p => ({ value: p.id, label: p.name }))];
  const categoryOpts = [{ value: '', label: 'uncategorized' }, ...CATEGORY_OPTS.map(c => ({ value: c, label: c }))];

  // ── Column config ──
  const columns: DataSheetColumn<AssetRow>[] = [
    { key: 'name', header: 'Name', sortable: true, sortVal: r => r.name.toLowerCase(), frozen: true, frozenWidth: 180,
      render: r => <TextCell key={`name-${r.id}-${r.updated_at}`} value={r.name} width={150} onCommit={v => onText(r, 'name', v)} /> },
    { key: 'make', header: 'Make', sortable: true, sortVal: r => (r.make ?? '').toLowerCase(),
      render: r => <TextCell key={`make-${r.id}-${r.updated_at}`} value={r.make} width={100} placeholder="—" onCommit={v => onText(r, 'make', v)} /> },
    { key: 'model', header: 'Model', sortable: true, sortVal: r => (r.model ?? '').toLowerCase(),
      render: r => <TextCell key={`model-${r.id}-${r.updated_at}`} value={r.model} width={110} placeholder="—" onCommit={v => onText(r, 'model', v)} /> },
    { key: 'location', header: 'Location', sortable: true, sortVal: r => (r.location ?? '').toLowerCase(),
      render: r => <TextCell key={`loc-${r.id}-${r.updated_at}`} value={r.location} width={100} placeholder="—" onCommit={v => onText(r, 'location', v)} /> },
    { key: 'status', header: 'Status', sortable: true, sortVal: r => r.status,
      render: r => <SelectCell value={r.status} options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))} onChange={v => onStatus(r, v)} styleFor={statusStyleFor} title="Asset status" /> },
    { key: 'parent_id', header: 'Project', sortable: false,
      render: r => <SelectCell value={r.parent_id ?? COMPANY_LEVEL} options={projectOpts} onChange={v => onProject(r, v)} title="Assign this asset to a project" /> },
    { key: 'cost_category', header: 'Category', sortable: true, sortVal: r => (r.cost_category ?? '').toLowerCase(),
      render: r => <SelectCell value={r.cost_category ?? ''} options={categoryOpts} onChange={v => onCategory(r, v)} styleFor={catStyleFor} title="Schedule C category" /> },
    { key: 'estimated_value', header: 'Value (worth)', sortable: true, sortVal: r => r.estimated_value ?? -1,
      render: r => <AmountCell key={`ev-${r.id}-${r.updated_at}`} value={r.estimated_value} onCommit={v => onEstimatedValue(r, v)} /> },
    { key: 'estimated_value_confidence', header: 'Worth conf.', sortable: true, sortVal: r => r.estimated_value_confidence ?? '',
      render: r => <SelectCell value={r.estimated_value_confidence ?? 'UNKNOWN'} options={CONFIDENCE_OPTS.map(o => ({ value: o, label: o }))} onChange={v => onEstimatedConfidence(r, v as CostConfidence)} styleFor={confidenceStyleFor} title="How sure of the worth?" /> },
    { key: 'acquisition_cost', header: 'Paid', sortable: true, sortVal: r => r.acquisition_cost ?? -1, defaultVisible: false,
      render: r => <AmountCell key={`ac-${r.id}-${r.updated_at}`} value={r.acquisition_cost} onCommit={v => onAcquisitionCost(r, v)} /> },
    { key: 'cost_confidence', header: 'Paid conf.', sortable: true, sortVal: r => r.cost_confidence ?? '', defaultVisible: false,
      render: r => <SelectCell value={r.cost_confidence ?? 'UNKNOWN'} options={CONFIDENCE_OPTS.map(o => ({ value: o, label: o }))} onChange={v => onCostConfidence(r, v as CostConfidence)} styleFor={confidenceStyleFor} title="How sure of what was paid?" /> },
    { key: 'serial_number', header: 'Serial', sortable: true, sortVal: r => (r.serial_number ?? '').toLowerCase(), defaultVisible: false,
      render: r => <TextCell key={`sn-${r.id}-${r.updated_at}`} value={r.serial_number} width={110} placeholder="—" onCommit={v => onText(r, 'serial_number', v)} /> },
    { key: 'year', header: 'Year', sortable: true, sortVal: r => r.year ?? -1, defaultVisible: false,
      render: r => <NumberCell key={`year-${r.id}-${r.updated_at}`} value={r.year} onCommit={v => onYear(r, v)} /> },
    { key: 'notes', header: 'Notes', sortable: false, defaultVisible: false,
      render: r => <TextCell key={`notes-${r.id}-${r.updated_at}`} value={r.notes} width={160} placeholder="—" onCommit={v => onText(r, 'notes', v)} /> },
    { key: 'created_at', header: 'Added', sortable: true, sortVal: r => r.created_at,
      render: r => <span style={SS.muted}>{fmtDate(r.created_at)}</span> },
  ];

  // ── Add-Asset form (create path) ──
  function set(field: keyof FormState, value: string) {
    setForm(f => {
      const next = { ...f, [field]: value };
      if (field === 'acquisition_cost' && value && f.cost_confidence === 'UNKNOWN') next.cost_confidence = 'ESTIMATED';
      return next;
    });
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;
    if (!form.name.trim()) { setSaveError('Name is required.'); return; }
    setSaving(true); setSaveError(null); setSaveSuccess(false);
    const payload: Record<string, unknown> = {
      business_id: businessId, node_type: 'ASSET', name: form.name.trim(), status: form.status, cost_confidence: form.cost_confidence,
    };
    if (form.asset_type.trim())    payload.asset_type    = form.asset_type.trim();
    if (form.make.trim())          payload.make          = form.make.trim();
    if (form.model.trim())         payload.model         = form.model.trim();
    if (form.serial_number.trim()) payload.serial_number = form.serial_number.trim();
    if (form.year.trim())          payload.year          = parseInt(form.year, 10);
    if (form.location.trim())      payload.location      = form.location.trim();
    if (form.notes.trim())         payload.notes         = form.notes.trim();
    if (form.acquisition_cost.trim()) {
      const parsed = parseFloat(form.acquisition_cost);
      if (!isNaN(parsed)) payload.acquisition_cost = parsed;
    }
    console.log('[TRACE:assets] insert → cost_objects', { node_type: 'ASSET', name: payload.name });
    const { error } = await supabase.from('cost_objects').insert(payload);
    if (error) { console.error('[TRACE:assets] insert error', error.message); setSaveError(error.message); setSaving(false); return; }
    console.log('[TRACE:assets] insert ok');
    setSaveSuccess(true); setSaving(false); setForm(EMPTY_FORM);
    setTimeout(() => { setShowForm(false); setSaveSuccess(false); loadAssets(); }, 900);
  }

  return (
    <>
      <DataSheet<AssetRow>
        title="Assets"
        rows={assets}
        loading={listLoading}
        error={listError}
        getRowId={r => r.id}
        columns={columns}
        searchText={r => [r.name, r.make, r.model, r.serial_number, r.location, r.cost_category, r.notes].filter(Boolean).join(' ')}
        searchPlaceholder="Search name, make, model, serial…"
        statusFilter={{ label: 'statuses', options: [...STATUS_OPTIONS], get: r => r.status }}
        defaultSortKey="name"
        itemNoun="assets"
        emptyIcon={<Package size={32} color="#d1d5db" style={{ marginBottom: 8 }} />}
        emptyText="No assets yet. Add your first one."
        actions={
          <>
            <button style={SS.primaryBtn} onClick={() => navigate('/assets/capture')}>
              <Camera size={16} /> Capture
            </button>
            <button style={SS.addBtn} onClick={() => { setShowForm(true); setSaveError(null); setSaveSuccess(false); }}>
              <Plus size={16} /> Add Asset
            </button>
          </>
        }
      />

      {/* Add Asset bottom sheet */}
      {showForm && (
        <div style={SS.modal} onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div style={SS.sheet}>
            <div style={SS.sheetHeader}>
              <h2 style={{ ...SS.sectionTitle, margin: 0 }}>Add Asset</h2>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} onClick={() => setShowForm(false)}>
                <X size={20} color="#6b7280" />
              </button>
            </div>
            {saveError && <div style={SS.error}>{saveError}</div>}
            {saveSuccess && <div style={SS.success}>Asset saved.</div>}
            <form onSubmit={handleSubmit}>
              <div style={SS.field}>
                <label style={SS.label}>Name *</label>
                <input style={SS.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Mahindra tractor" required />
              </div>
              <div style={{ ...SS.row2, ...SS.field }}>
                <div>
                  <label style={SS.label}>Asset Type</label>
                  <input style={SS.input} value={form.asset_type} onChange={e => set('asset_type', e.target.value)} placeholder="e.g. Equipment, Vehicle" />
                </div>
                <div>
                  <label style={SS.label}>Status</label>
                  <select style={SS.select} value={form.status} onChange={e => set('status', e.target.value as AssetStatus)}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ ...SS.row2, ...SS.field }}>
                <div>
                  <label style={SS.label}>Make</label>
                  <input style={SS.input} value={form.make} onChange={e => set('make', e.target.value)} placeholder="e.g. Mahindra" />
                </div>
                <div>
                  <label style={SS.label}>Model</label>
                  <input style={SS.input} value={form.model} onChange={e => set('model', e.target.value)} placeholder="e.g. 4025" />
                </div>
              </div>
              <div style={{ ...SS.row2, ...SS.field }}>
                <div>
                  <label style={SS.label}>Year</label>
                  <input style={SS.input} type="number" value={form.year} onChange={e => set('year', e.target.value)} placeholder="e.g. 2019" min="1900" max="2100" />
                </div>
                <div>
                  <label style={SS.label}>Serial Number</label>
                  <input style={SS.input} value={form.serial_number} onChange={e => set('serial_number', e.target.value)} placeholder="Optional" />
                </div>
              </div>
              <div style={SS.field}>
                <label style={SS.label}>Location</label>
                <input style={SS.input} value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Barn, Lot B, Site 3" />
              </div>
              <div style={{ ...SS.row2, ...SS.field }}>
                <div>
                  <label style={SS.label}>Acquisition Cost (paid)</label>
                  <input style={SS.input} type="number" step="0.01" min="0" value={form.acquisition_cost} onChange={e => set('acquisition_cost', e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label style={SS.label}>Cost Confidence</label>
                  <select style={SS.select} value={form.cost_confidence} onChange={e => set('cost_confidence', e.target.value as CostConfidence)}>
                    <option value="ESTIMATED">Estimated (my best guess)</option>
                    <option value="UNKNOWN">Unknown</option>
                  </select>
                  <p style={SS.hint}>Manual entry = Estimated. Value (worth) is set inline or by camera capture.</p>
                </div>
              </div>
              <div style={SS.field}>
                <label style={SS.label}>Notes</label>
                <textarea style={SS.textarea} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Condition, history, anything relevant…" />
              </div>
              <button type="submit" style={saving ? SS.submitBtnDisabled : SS.submitBtn} disabled={saving}>
                {saving ? 'Saving…' : 'Save Asset'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
