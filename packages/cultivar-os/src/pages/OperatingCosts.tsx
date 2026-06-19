// ============================================================
// OperatingCosts — recurring / operating cost datasheet (Cultivar OS)
// PURPOSE:      List + add + inline-edit RECURRING, non-labor cost_objects (node_type='COST')
//               — subscriptions, utilities, fees (Claude Pro, Gemini, domains, TX tax). This is
//               the DATASHEET HOME for recurring operating costs, the sibling of /assets (capital
//               ASSET rows) and /inventory (materials). Built 2026-06-18 so recurring costs have a
//               real entry surface BEFORE the cost-to-produce ESTIMATOR (CostToProduceSettings
//               Block 1) is severed (David: "build recurring home first"). Until that sever, BOTH
//               surfaces can write — they target the same rows; this is the durable record.
// DEPENDENCIES: supabase (cost_objects node_type='COST' rows + node_type='PROJECT' for the project
//               picker), useBusinessContext (businessId → RLS scope), @trace/shared/business-logic
//               CATEGORY_OPTS (the shared Schedule C set — which DELIBERATELY excludes
//               'labor'/'contract-labor', so this page can never relabel a row into the labor model).
// OUTPUTS:      Reads non-labor COST rows; per-row immediate INSERT/UPDATE/DELETE of recurring_amount,
//               cadence, cost_category, parent_id (project), cost_confidence (RLS-scoped by
//               business_id). Inserts mirror the estimator's proven recPayload (cost_shape
//               RECURRING_FIXED, cost_nature OPEX, cost_source MANUAL, substantiation OWNER_ASSERTED,
//               acquisition_cost NULL) so every CHECK constraint is satisfied.
// SCOPE:        NON-LABOR recurring costs ONLY. LABOR rows (cost_category 'labor'|'contract-labor')
//               are owned by the Settings → Labor block (D-12, owner-proven) and are FILTERED OUT
//               here on load — they never appear and are never targeted (edits/deletes act only on
//               loaded non-labor ids), so labor is structurally untouchable from this page.
// SURFACE HONESTY: UNKNOWN ⟺ no amount — setting confidence UNKNOWN clears the amount; entering an
//               amount on an UNKNOWN row bumps it to ESTIMATED (mirrors /assets + the by-project tree).
// INSTRUMENTATION (STD-003): `[TRACE:opcosts]` emits on load + every inline edit + add + delete.
//               ON BY DEFAULT (standing owner instruction — do NOT comment out until David lifts it,
//               even after owner-proof).
// ============================================================
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Repeat } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { CATEGORY_OPTS } from '@trace/shared/business-logic';

type Cadence = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
const CADENCE_OPTS: Cadence[] = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'];

const CONFIDENCE_OPTS = ['CONFIRMED', 'DERIVED', 'ESTIMATED', 'UNKNOWN'] as const;
type CostConfidence = typeof CONFIDENCE_OPTS[number];

// D-16 Model B — recovery basis. COST_TO_SERVE feeds the ÷N per-customer price; PLATFORM_INVESTMENT
// is held out on the payback line (founder/platform labor). recovery_basis_source = DERIVED (the
// system's backfill guess, owner has NOT vetted) | EXPLICIT (owner-set). An owner override here
// flips DERIVED → EXPLICIT — the "derived first, then explicit" learning loop.
const RECOVERY_BASIS_OPTS = ['COST_TO_SERVE', 'PLATFORM_INVESTMENT'] as const;
type RecoveryBasis = typeof RECOVERY_BASIS_OPTS[number];
const RECOVERY_BASIS_LABEL: Record<RecoveryBasis, string> = {
  COST_TO_SERVE: 'cost to serve',
  PLATFORM_INVESTMENT: 'investment',
};

const COMPANY_LEVEL = '__company__'; // <select> sentinel for parent_id = null
// Labor categories live on the Settings labor block — a row here can never carry one.
const LABOR_CATS = new Set(['labor', 'contract-labor']);

interface ProjectOption { id: string; name: string; }

interface CostRow {
  id: string;
  name: string;
  recurring_amount: number | null;  // null = UNKNOWN, never 0
  cadence: Cadence;
  cost_category: string | null;
  cost_confidence: CostConfidence | null;
  parent_id: string | null;         // project (PROJECT node) or null = company-level
  recovery_basis: RecoveryBasis;            // D-16 Model B classification
  recovery_basis_source: 'DERIVED' | 'EXPLICIT'; // DERIVED = system guess; EXPLICIT = owner-vetted
  created_at: string;
}

interface FormState {
  name: string;
  recurring_amount: string;
  cadence: Cadence;
  cost_confidence: CostConfidence;
  cost_category: string;
  parent_id: string; // COMPANY_LEVEL sentinel or a project id
}

const EMPTY_FORM: FormState = {
  name: '',
  recurring_amount: '',
  cadence: 'MONTHLY',
  cost_confidence: 'ESTIMATED',
  cost_category: '',
  parent_id: COMPANY_LEVEL,
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
  empty: { textAlign: 'center' as const, color: '#6b7280', padding: '2rem', fontSize: '0.9rem' } as React.CSSProperties,
  modal: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 } as React.CSSProperties,
  sheet: { background: '#fff', borderRadius: '16px 16px 0 0', padding: '1.5rem', width: '100%', maxWidth: 640, maxHeight: '92vh', overflowY: 'auto' as const } as React.CSSProperties,
  sheetHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' } as React.CSSProperties,
  inlineSelect: { border: '1.5px solid #d1d5db', borderRadius: 7, padding: '4px 6px', fontSize: '0.8rem', color: '#111827', background: '#fff', cursor: 'pointer', maxWidth: 160 } as React.CSSProperties,
  inlineAmount: { width: 84, border: '1.5px solid #d1d5db', borderRadius: 7, padding: '4px 6px', fontSize: '0.8rem', color: '#111827', background: '#fff', textAlign: 'right' as const } as React.CSSProperties,
  confSelect: (c: CostConfidence | null): React.CSSProperties => {
    const weak = c === 'UNKNOWN' || c === 'ESTIMATED' || c == null;
    return { border: '1.5px solid #d1d5db', borderRadius: 7, padding: '4px 6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', background: weak ? '#fee2e2' : '#dcfce7', color: weak ? '#991b1b' : '#166534' };
  },
  catUncat: { color: '#92400e', fontStyle: 'italic' as const } as React.CSSProperties,
  derivedTag: { fontSize: '0.625rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', borderRadius: 5, padding: '1px 5px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' } as React.CSSProperties,
  explicitTag: { fontSize: '0.625rem', fontWeight: 700, color: '#166534', background: '#dcfce7', borderRadius: 5, padding: '1px 5px' } as React.CSSProperties,
  removeBtn: { background: '#fef2f2', border: 'none', borderRadius: 7, padding: '4px 9px', color: '#A32D2D', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' } as React.CSSProperties,
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
const cadenceSuffix: Record<Cadence, string> = { WEEKLY: '/wk', MONTHLY: '/mo', QUARTERLY: '/qtr', ANNUAL: '/yr' };

export function OperatingCosts() {
  const navigate = useNavigate();
  const { businessId } = useBusinessContext();

  const [costs, setCosts] = useState<CostRow[]>([]);
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
    loadCosts();
    loadProjects();
  }, [businessId]);

  // Load recurring COST rows, EXCLUDING labor (owned by the Settings labor block).
  async function loadCosts() {
    setListLoading(true);
    setListError(null);
    console.log('[TRACE:opcosts] loadCosts → cost_objects (node_type=COST, non-labor)', { businessId });
    const { data, error } = await supabase
      .from('cost_objects')
      .select('id,name,recurring_amount,cadence,cost_category,cost_confidence,parent_id,recovery_basis,recovery_basis_source,created_at')
      .eq('business_id', businessId)
      .eq('node_type', 'COST')
      .order('created_at', { ascending: false });

    if (error) { console.error('[TRACE:opcosts] loadCosts error', error.message); setListError(error.message); setListLoading(false); return; }
    const nonLabor = (data ?? []).filter((r: any) => !LABOR_CATS.has(r.cost_category));
    console.log('[TRACE:opcosts] loadCosts ok', { total: data?.length ?? 0, nonLabor: nonLabor.length, laborExcluded: (data?.length ?? 0) - nonLabor.length });
    setCosts(nonLabor.map((r: any) => ({
      id: String(r.id),
      name: r.name ?? '',
      recurring_amount: r.recurring_amount == null ? null : Number(r.recurring_amount),
      cadence: (CADENCE_OPTS.includes(r.cadence) ? r.cadence : 'MONTHLY') as Cadence,
      cost_category: r.cost_category ?? null,
      cost_confidence: (r.cost_confidence ?? null) as CostConfidence | null,
      parent_id: r.parent_id ?? null,
      recovery_basis: (RECOVERY_BASIS_OPTS.includes(r.recovery_basis) ? r.recovery_basis : 'COST_TO_SERVE') as RecoveryBasis,
      recovery_basis_source: (r.recovery_basis_source === 'EXPLICIT' ? 'EXPLICIT' : 'DERIVED'),
      created_at: r.created_at,
    })));
    setListLoading(false);
  }

  // PROJECT nodes for the inline project picker (same source the Settings + tree + assets pickers use).
  async function loadProjects() {
    const { data, error } = await supabase
      .from('cost_objects')
      .select('id,name')
      .eq('business_id', businessId)
      .eq('node_type', 'PROJECT')
      .eq('is_active', true);
    if (error) { console.warn('[TRACE:opcosts] loadProjects error', error.message); return; }
    setProjects((data ?? []).map((p: any) => ({ id: String(p.id), name: p.name ?? 'Untitled project' })));
  }

  // ── Inline edit: one immediate write per field, RLS-scoped, node_type='COST' guarded. Targets
  //    only loaded NON-LABOR ids, so labor rows are never touched. ──
  async function writeCost(row: CostRow, patch: Record<string, unknown>, field: string, to: unknown) {
    const from = (row as any)[field];
    console.log('[TRACE:opcosts] edit', { costId: row.id, field, from, to });
    const { error } = await supabase
      .from('cost_objects')
      .update(patch)
      .eq('id', row.id)
      .eq('business_id', businessId)
      .eq('node_type', 'COST');
    if (error) { console.error('[TRACE:opcosts] edit error', field, error.message); setListError(error.message); return; }
    await loadCosts(); // reload → /costs (flat + by-project) recomputes from the same fresh rows
  }

  function onCadence(row: CostRow, val: Cadence) {
    if (val === row.cadence) return;
    writeCost(row, { cadence: val }, 'cadence', val);
  }
  function onCategory(row: CostRow, val: string) {
    const cost_category = val || null;
    if (cost_category === row.cost_category) return;
    writeCost(row, { cost_category }, 'cost_category', cost_category);
  }
  function onProject(row: CostRow, sel: string) {
    const parent_id = sel === COMPANY_LEVEL ? null : sel;
    if (parent_id === row.parent_id) return;
    writeCost(row, { parent_id }, 'parent_id', parent_id);
  }
  // Coherence (UNKNOWN ⟺ no amount): UNKNOWN clears the amount; any other grade keeps it.
  function onConfidence(row: CostRow, conf: CostConfidence) {
    if (conf === row.cost_confidence) return;
    const patch = conf === 'UNKNOWN'
      ? { cost_confidence: 'UNKNOWN', recurring_amount: null }
      : { cost_confidence: conf };
    writeCost(row, patch, 'cost_confidence', conf);
  }
  // D-16 Model B override: changing the basis flips recovery_basis_source DERIVED → EXPLICIT (the
  // owner has now vetted it). Writes both columns in one immediate write. The /costs price table
  // re-partitions the pool on reload — a row moved to PLATFORM_INVESTMENT leaves the ÷N divide.
  function onRecoveryBasis(row: CostRow, val: RecoveryBasis) {
    if (val === row.recovery_basis) return;
    writeCost(row, { recovery_basis: val, recovery_basis_source: 'EXPLICIT' }, 'recovery_basis', val);
  }
  // Coherence: clearing the amount → UNKNOWN; entering an amount on an UNKNOWN row → ESTIMATED.
  function onAmount(row: CostRow, value: number | null) {
    if (value === (row.recurring_amount ?? null)) return;
    const patch = value == null
      ? { recurring_amount: null, cost_confidence: 'UNKNOWN' }
      : { recurring_amount: value, cost_confidence: row.cost_confidence === 'UNKNOWN' ? 'ESTIMATED' : (row.cost_confidence ?? 'ESTIMATED') };
    writeCost(row, patch, 'recurring_amount', value);
  }

  // Remove a recurring cost (hard delete — mirrors the estimator; /costs reads all rows with no
  // is_active filter, so soft-deactivate would still count. Guarded to node_type='COST' + the row's
  // own id, which is always non-labor here). Owner-confirmed.
  async function onRemove(row: CostRow) {
    if (!window.confirm(`Remove "${row.name}"? This deletes the cost from your cost-to-produce.`)) return;
    console.log('[TRACE:opcosts] delete', { costId: row.id, name: row.name });
    const { error } = await supabase
      .from('cost_objects')
      .delete()
      .eq('id', row.id)
      .eq('business_id', businessId)
      .eq('node_type', 'COST');
    if (error) { console.error('[TRACE:opcosts] delete error', error.message); setListError(error.message); return; }
    await loadCosts();
  }

  function set(field: keyof FormState, value: string) {
    setForm(f => {
      const next = { ...f, [field]: value };
      // Surface Honesty: typing an amount while confidence is UNKNOWN bumps to ESTIMATED.
      if (field === 'recurring_amount' && value && f.cost_confidence === 'UNKNOWN') next.cost_confidence = 'ESTIMATED';
      // Choosing UNKNOWN clears the amount.
      if (field === 'cost_confidence' && value === 'UNKNOWN') next.recurring_amount = '';
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;
    if (!form.name.trim()) { setSaveError('Name is required.'); return; }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const isUnknown = form.cost_confidence === 'UNKNOWN';
    let amount: number | null = null;
    if (!isUnknown && form.recurring_amount.trim()) {
      const parsed = parseFloat(form.recurring_amount);
      if (!isNaN(parsed)) amount = Math.round(parsed * 100) / 100;
    }

    // Mirror the estimator's proven recPayload so every CHECK constraint is satisfied.
    const payload: Record<string, unknown> = {
      business_id: businessId,
      node_type: 'COST',
      cost_source: 'MANUAL',
      name: form.name.trim(),
      recurring_amount: amount,
      cadence: form.cadence,
      cost_confidence: form.cost_confidence,
      cost_shape: 'RECURRING_FIXED',
      cost_nature: 'OPEX',
      cost_category: form.cost_category || null,
      substantiation: 'OWNER_ASSERTED',
      parent_id: form.parent_id === COMPANY_LEVEL ? null : form.parent_id,
      acquisition_cost: null,
      // D-16 Model B: a new operating cost is marginal cost-to-serve by default (the system's
      // guess); recovery_basis_source DERIVED until the owner vets it on the row control.
      recovery_basis: 'COST_TO_SERVE',
      recovery_basis_source: 'DERIVED',
    };

    console.log('[TRACE:opcosts] insert → cost_objects', { name: payload.name, cadence: payload.cadence, amount });
    const { error } = await supabase.from('cost_objects').insert(payload);

    if (error) {
      console.error('[TRACE:opcosts] insert error', error.message);
      setSaveError(error.message);
      setSaving(false);
      return;
    }
    console.log('[TRACE:opcosts] insert ok');

    setSaveSuccess(true);
    setSaving(false);
    setForm(EMPTY_FORM);
    setTimeout(() => {
      setShowForm(false);
      setSaveSuccess(false);
      loadCosts();
    }, 900);
  }

  return (
    <div style={S.page}>

      {/* Header */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate('/costs')}>
          <ArrowLeft size={22} color="#27500A" />
        </button>
        <h1 style={S.title}>Operating Costs</h1>
        <div style={{ flex: 1 }} />
        <button style={S.addBtn} onClick={() => { setShowForm(true); setSaveError(null); setSaveSuccess(false); }}>
          <Plus size={16} />
          Add Cost
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
        {!listLoading && !listError && costs.length === 0 && (
          <div style={S.empty}>
            <Repeat size={32} color="#d1d5db" style={{ marginBottom: 8 }} />
            <p style={{ margin: 0 }}>No recurring costs yet. Add your first subscription, utility, or fee.</p>
          </div>
        )}
        {!listLoading && costs.length > 0 && (
          <>
            <p style={{ ...S.hint, marginTop: 0, marginBottom: 10 }}>
              Your recurring subscriptions, utilities, and fees — the costs that recur regardless of
              labor. Mark each one’s confidence honestly (<b>UNKNOWN</b> stays unknown, never $0).
              Changes save as you make them and feed your cost-to-produce.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Name</th>
                    <th style={S.th}>Amount</th>
                    <th style={S.th}>Cadence</th>
                    <th style={S.th}>Category</th>
                    <th style={S.th}>Project</th>
                    <th style={S.th}>Recovery basis</th>
                    <th style={S.th}>Confidence</th>
                    <th style={S.th}>Added</th>
                    <th style={S.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {costs.map(c => (
                    <tr key={c.id}>
                      <td style={{ ...S.td, fontWeight: 600 }}>{c.name}</td>

                      {/* ── Amount (recurring_amount) — immediate write on blur/Enter ── */}
                      <td style={S.td}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <AmountCell key={String(c.recurring_amount)} value={c.recurring_amount} onCommit={v => onAmount(c, v)} />
                          <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>{cadenceSuffix[c.cadence]}</span>
                        </span>
                      </td>

                      {/* ── Cadence — immediate write ── */}
                      <td style={S.td}>
                        <select style={S.inlineSelect} value={c.cadence} onChange={e => onCadence(c, e.target.value as Cadence)} title="Billing cadence">
                          {CADENCE_OPTS.map(cad => <option key={cad} value={cad}>{cad.toLowerCase()}</option>)}
                        </select>
                      </td>

                      {/* ── Category (cost_category) — immediate write ── */}
                      <td style={S.td}>
                        <select
                          style={{ ...S.inlineSelect, ...(c.cost_category ? {} : S.catUncat) }}
                          value={c.cost_category ?? ''}
                          onChange={e => onCategory(c, e.target.value)}
                          title="Schedule C category"
                        >
                          <option value="">uncategorized</option>
                          {CATEGORY_OPTS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </td>

                      {/* ── Project (parent_id) — immediate write ── */}
                      <td style={S.td}>
                        <select
                          style={S.inlineSelect}
                          value={c.parent_id ?? COMPANY_LEVEL}
                          onChange={e => onProject(c, e.target.value)}
                          title="Assign this cost to a project"
                        >
                          <option value={COMPANY_LEVEL}>Company-level</option>
                          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </td>

                      {/* ── Recovery basis (D-16 Model B) — immediate write; flips source to EXPLICIT ── */}
                      <td style={S.td}>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                          <select
                            style={{ ...S.inlineSelect, ...(c.recovery_basis === 'PLATFORM_INVESTMENT' ? { background: '#eef2ff', color: '#3730a3', fontWeight: 700 } : {}) }}
                            value={c.recovery_basis}
                            onChange={e => onRecoveryBasis(c, e.target.value as RecoveryBasis)}
                            title="Cost to serve feeds the per-customer price; investment is shown separately on the payback line."
                          >
                            {RECOVERY_BASIS_OPTS.map(rb => <option key={rb} value={rb}>{RECOVERY_BASIS_LABEL[rb]}</option>)}
                          </select>
                          {c.recovery_basis_source === 'DERIVED'
                            ? <span style={S.derivedTag} title="The system's guess — not yet vetted. Change it to confirm.">derived</span>
                            : <span style={S.explicitTag} title="You set this.">✓ you set this</span>}
                        </span>
                      </td>

                      {/* ── Confidence (cost_confidence) — immediate write ── */}
                      <td style={S.td}>
                        <select
                          style={S.confSelect(c.cost_confidence)}
                          value={c.cost_confidence ?? 'ESTIMATED'}
                          onChange={e => onConfidence(c, e.target.value as CostConfidence)}
                          title="How sure are you of this cost?"
                        >
                          {CONFIDENCE_OPTS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </td>

                      <td style={{ ...S.td, color: '#6b7280', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{fmtDate(c.created_at)}</td>

                      {/* ── Remove ── */}
                      <td style={S.td}>
                        <button style={S.removeBtn} onClick={() => onRemove(c)} title="Remove this cost">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Add Cost bottom sheet */}
      {showForm && (
        <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div style={S.sheet}>
            <div style={S.sheetHeader}>
              <h2 style={{ ...S.sectionTitle, margin: 0 }}>Add Recurring Cost</h2>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                onClick={() => setShowForm(false)}
              >
                <X size={20} color="#6b7280" />
              </button>
            </div>

            {saveError && <div style={S.error}>{saveError}</div>}
            {saveSuccess && <div style={S.success}>Cost saved.</div>}

            <form onSubmit={handleSubmit}>
              <div style={S.field}>
                <label style={S.label}>Name *</label>
                <input style={S.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Claude Pro, Gemini, 6 domains" required />
              </div>

              <div style={{ ...S.row2, ...S.field }}>
                <div>
                  <label style={S.label}>Amount</label>
                  <input
                    style={S.input}
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.recurring_amount}
                    onChange={e => set('recurring_amount', e.target.value)}
                    placeholder={form.cost_confidence === 'UNKNOWN' ? 'unknown' : '0.00'}
                    disabled={form.cost_confidence === 'UNKNOWN'}
                  />
                </div>
                <div>
                  <label style={S.label}>Cadence</label>
                  <select style={S.select} value={form.cadence} onChange={e => set('cadence', e.target.value as Cadence)}>
                    {CADENCE_OPTS.map(cad => <option key={cad} value={cad}>{cad.toLowerCase()}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ ...S.row2, ...S.field }}>
                <div>
                  <label style={S.label}>Confidence</label>
                  <select style={S.select} value={form.cost_confidence} onChange={e => set('cost_confidence', e.target.value as CostConfidence)}>
                    {CONFIDENCE_OPTS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  <p style={S.hint}>UNKNOWN stays unknown — never counted as $0.</p>
                </div>
                <div>
                  <label style={S.label}>Category</label>
                  <select style={S.select} value={form.cost_category} onChange={e => set('cost_category', e.target.value)}>
                    <option value="">uncategorized</option>
                    {CATEGORY_OPTS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>

              <div style={S.field}>
                <label style={S.label}>Project</label>
                <select style={S.select} value={form.parent_id} onChange={e => set('parent_id', e.target.value)}>
                  <option value={COMPANY_LEVEL}>Company-level</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <p style={S.hint}>Assign to a project, or leave company-level. Feeds your cost-to-produce by project.</p>
              </div>

              <button
                type="submit"
                style={saving ? S.submitBtnDisabled : S.submitBtn}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Cost'}
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
 * Mirrors /assets' AmountCell coherence: empty → null routes to UNKNOWN upstream.
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
