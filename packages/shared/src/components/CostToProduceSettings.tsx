/**
 * ── COST-TO-PRODUCE CONFIG PANEL (shared, general) · THUNDER BUILD · 2026-06-14 ──
 *   STEP 7 RE-POINT (2026-06-17): recurring-cost entry now writes first-class cost_objects
 *   rows (node_type='COST'), NOT business_modules.config.recurring[]. This closes the
 *   step-6 disconnect (the tile reads cost_objects; the editor must write them).
 *
 * PURPOSE
 *   The TUNE surface for Cost-to-Produce. Owner enters/adjusts the inputs the engine prices
 *   from. Two storage homes now:
 *     • RECURRING costs   → cost_objects rows (node_type=COST · nature picker default OPEX ·
 *                           source MANUAL · shape selector · cadence · project picker→parent_id ·
 *                           substantiation). Per-ROW writes (insert/update/delete-by-id).
 *     • Labor / margin / denominators / overhead / reference → still business_modules.config
 *       (R3 — labor stays in config this pass; margin+denoms are pricing knobs, not costs).
 *
 * DEPENDENCIES
 *   - ../supabase/client (cost_objects + business_modules read/write — member-scoped RLS)
 *   - ../context/BusinessProvider (businessId)
 *   - ../business-logic/CostToProduce (config types + EMPTY_COST_CONFIG default)
 *
 * OUTPUTS
 *   - cost_objects: one row per recurring cost. INSERT (new), UPDATE (existing by id),
 *     DELETE (explicitly removed by id). cost_source='MANUAL'.
 *   - business_modules.config: labor/margin/denominators/overhead/reference. config.recurring
 *     is PRESERVED untouched (dormant backup; the flipped tile ignores it once COST rows exist).
 *
 * TRUNCATION-GUARD INTENT (preserved in the row model): a row is deleted ONLY when the owner
 *   explicitly removes it (tracked in removedIds) — never because a short/failed read showed
 *   fewer rows. There is NO bulk "overwrite the whole array" write, so a partial load cannot
 *   silently drop costs. A failed cost_objects read BLOCKS saving (loadError), same as before.
 *
 * SURFACE HONESTY
 *   - UNKNOWN confidence ⇒ amount stored NULL (never $0).
 *   - Shape selector offers only the two FULLY-CAPTURABLE shapes (RECURRING_FIXED, PER_OCCASION);
 *     prepaid/incremental/variable are withheld until their input fields exist (no fake surface).
 *   - Project picker lists REAL PROJECT nodes only (+ "None"); nature/shape offer real values only.
 *
 * INSTRUMENTATION (STD-003): `[TRACE:COST]` emits on LOAD (COST rows + projects read, or
 *   load-FAILED→save-blocked) and on SAVE (inserts/updates/deletes + config write) — ON BY
 *   DEFAULT until David owner-proves the path through the real UI under RLS; then comment out.
 */
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import { useBusinessContext } from '../context/BusinessProvider';
import { EMPTY_COST_CONFIG } from '../business-logic/CostToProduce';
import type {
  CostToProduceConfig, CostConfidence, CostPeriod, CostLocation,
} from '../business-logic/CostToProduce';

const MODULE_KEY = 'cost_to_produce';

const GREEN = '#27500A';
const GRAY  = '#6b7280';
const DARK  = '#111827';
const RED   = '#A32D2D';

const CONFIDENCE_OPTS: CostConfidence[] = ['CONFIRMED', 'DERIVED', 'ESTIMATED', 'UNKNOWN'];
const CONFIDENCE_COLOR: Record<CostConfidence, { bg: string; fg: string }> = {
  CONFIRMED: { bg: '#dcfce7', fg: '#166534' },
  DERIVED:   { bg: '#dbeafe', fg: '#1d4ed8' },
  ESTIMATED: { bg: '#fef9c3', fg: '#854d0e' },
  UNKNOWN:   { bg: '#fee2e2', fg: '#991b1b' },
};

// Cost-object pickers — REAL DB values only (CHECK-constraint-valid).
type Cadence = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
type CostShape = 'RECURRING_FIXED' | 'PER_OCCASION';   // only the two fully-capturable shapes (D-9)
type CostNature = 'OPEX' | 'COGS' | 'CAPEX';
type Substantiation = 'OWNER_ASSERTED' | 'SUBSTANTIATED';
const CADENCE_OPTS: Cadence[] = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'];
const SHAPE_OPTS: CostShape[]  = ['RECURRING_FIXED', 'PER_OCCASION'];
const NATURE_OPTS: CostNature[] = ['OPEX', 'COGS', 'CAPEX'];
const SUBSTANTIATION_OPTS: Substantiation[] = ['OWNER_ASSERTED', 'SUBSTANTIATED'];

/** An editable recurring cost — backed by a cost_objects row (id null = new, unsaved). */
interface CostObjectLine {
  id: string | null;
  name: string;
  recurring_amount: number | null;  // null = UNKNOWN, never 0
  cadence: Cadence;
  cost_confidence: CostConfidence;
  cost_shape: CostShape;
  cost_nature: CostNature;
  substantiation: Substantiation;
  parent_id: string | null;          // project (PROJECT node) or null = company-level
  notes: string | null;
}
interface ProjectOption { id: string; name: string; }

const cell: React.CSSProperties = {
  boxSizing: 'border-box', padding: '8px 10px', border: '1.5px solid #d1d5db',
  borderRadius: 8, fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit',
  color: DARK, background: '#fff',
};

function deepClone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

/** Defensive parse: jsonb usually arrives as an object, but tolerate a JSON string. */
function parseConfig(raw: unknown): CostToProduceConfig | null {
  let c: unknown = raw;
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch { return null; } }
  if (c && typeof c === 'object' && Array.isArray((c as CostToProduceConfig).locations)) {
    return c as CostToProduceConfig;
  }
  return null;
}

const newLine = (): CostObjectLine => ({
  id: null, name: '', recurring_amount: 0, cadence: 'MONTHLY', cost_confidence: 'ESTIMATED',
  cost_shape: 'RECURRING_FIXED', cost_nature: 'OPEX', substantiation: 'OWNER_ASSERTED',
  parent_id: null, notes: null,
});

export function CostToProduceSettings() {
  const { businessId } = useBusinessContext();
  const [config, setConfig]   = useState<CostToProduceConfig>(() => deepClone(EMPTY_COST_CONFIG));
  const [rows, setRows]       = useState<CostObjectLine[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);  // explicit deletes only
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [loadError, setLoadError] = useState('');

  // Single editable location for config-side knobs (labor/overhead); persisted in locations[].
  const loc: CostLocation = config.locations[0] ?? deepClone(EMPTY_COST_CONFIG.locations[0]);

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError('');
      setRemovedIds([]);
      const [modRes, objRes, projRes] = await Promise.all([
        supabase.from('business_modules').select('config').eq('business_id', businessId).eq('module_key', MODULE_KEY).maybeSingle(),
        supabase.from('cost_objects')
          .select('id,name,recurring_amount,cadence,cost_confidence,cost_shape,cost_nature,substantiation,parent_id,notes')
          .eq('business_id', businessId).eq('node_type', 'COST'),
        supabase.from('cost_objects').select('id,name').eq('business_id', businessId).eq('node_type', 'PROJECT'),
      ]);
      if (cancelled) return;

      // A failed cost_objects read BLOCKS saving — never operate on a bad/short read.
      if (objRes.error) {
        console.log('[TRACE:COST] cost_objects load FAILED (save blocked)', { businessId, error: objRes.error.message });
        setLoadError(objRes.error.message);
        setLoading(false);
        return;
      }

      const stored = parseConfig(modRes.data?.config);
      setConfig(stored && stored.locations.length ? stored : deepClone(EMPTY_COST_CONFIG));

      const loaded: CostObjectLine[] = (objRes.data ?? []).map((r: any) => ({
        id: String(r.id),
        name: r.name ?? '',
        recurring_amount: r.recurring_amount == null ? null : Number(r.recurring_amount),
        cadence: (CADENCE_OPTS.includes(r.cadence) ? r.cadence : 'MONTHLY') as Cadence,
        cost_confidence: (CONFIDENCE_OPTS.includes(r.cost_confidence) ? r.cost_confidence : 'ESTIMATED') as CostConfidence,
        cost_shape: (SHAPE_OPTS.includes(r.cost_shape) ? r.cost_shape : 'RECURRING_FIXED') as CostShape,
        cost_nature: (NATURE_OPTS.includes(r.cost_nature) ? r.cost_nature : 'OPEX') as CostNature,
        substantiation: (SUBSTANTIATION_OPTS.includes(r.substantiation) ? r.substantiation : 'OWNER_ASSERTED') as Substantiation,
        parent_id: r.parent_id ?? null,
        notes: r.notes ?? null,
      }));
      setRows(loaded);
      setProjects((projRes.data ?? []).map((p: any) => ({ id: String(p.id), name: p.name ?? 'Untitled project' })));

      console.log('[TRACE:COST] settings load', {
        businessId, costRowsRead: loaded.length, projectsRead: projRes.data?.length ?? 0,
        hadConfig: !!(stored && stored.locations.length),
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [businessId]);

  // ── Mutators ──
  function patchLoc(mut: (l: CostLocation) => void) {
    setConfig(prev => {
      const next = deepClone(prev);
      if (!next.locations.length) next.locations.push(deepClone(EMPTY_COST_CONFIG.locations[0]));
      mut(next.locations[0]);
      return next;
    });
  }
  function patchConfig(mut: (c: CostToProduceConfig) => void) {
    setConfig(prev => { const next = deepClone(prev); mut(next); return next; });
  }
  function addRow() { setRows(rs => [...rs, newLine()]); }
  function editRow(i: number, patch: Partial<CostObjectLine>) {
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }
  function removeRow(i: number) {
    setRows(rs => {
      const r = rs[i];
      if (r?.id) setRemovedIds(ids => [...ids, r.id as string]); // explicit delete of a saved row
      return rs.filter((_, idx) => idx !== i);
    });
  }

  async function save() {
    if (!businessId) return;
    if (loadError) { setSaveMsg('Cannot save: costs did not load (' + loadError + '). Reload before editing.'); return; }
    setSaving(true);
    setSaveMsg('');

    // ── 1. cost_objects: per-row writes. UNKNOWN ⇒ amount NULL (never $0). Skip blank names. ──
    const payload = (r: CostObjectLine) => ({
      business_id: businessId,
      node_type: 'COST',
      cost_source: 'MANUAL',
      name: r.name.trim(),
      recurring_amount: r.cost_confidence === 'UNKNOWN' ? null : r.recurring_amount,
      cadence: r.cadence,
      cost_confidence: r.cost_confidence,
      cost_shape: r.cost_shape,
      cost_nature: r.cost_nature,
      substantiation: r.substantiation,
      parent_id: r.parent_id,
      notes: r.notes,
      acquisition_cost: null, // recurring, not capex
    });
    const named = rows.filter(r => r.name.trim().length > 0);
    const inserts = named.filter(r => !r.id).map(payload);
    const updates = named.filter(r => r.id);

    let insErr = null, updErr = null, delErr = null;
    if (inserts.length) {
      const { error } = await supabase.from('cost_objects').insert(inserts);
      insErr = error;
    }
    for (const r of updates) {
      if (insErr) break;
      const { error } = await supabase.from('cost_objects').update(payload(r)).eq('id', r.id as string).eq('business_id', businessId);
      if (error) { updErr = error; break; }
    }
    // Deletes: ONLY rows the owner explicitly removed (tracked) — never an unloaded row.
    if (!insErr && !updErr && removedIds.length) {
      const { error } = await supabase.from('cost_objects').delete().in('id', removedIds).eq('business_id', businessId).eq('node_type', 'COST');
      delErr = error;
    }

    // ── 2. config: labor/margin/denominators/overhead/reference. config.recurring PRESERVED. ──
    let cfgErr = null;
    if (!insErr && !updErr && !delErr) {
      const { error } = await supabase.from('business_modules').upsert(
        { business_id: businessId, module_key: MODULE_KEY, enabled: true, configured: true, config },
        { onConflict: 'business_id,module_key' },
      );
      cfgErr = error;
    }

    console.log('[TRACE:COST] settings save', {
      businessId, inserts: inserts.length, updates: updates.length, deletes: removedIds.length,
      result: insErr ? 'INSERT_ERR' : updErr ? 'UPDATE_ERR' : delErr ? 'DELETE_ERR' : cfgErr ? 'CONFIG_ERR' : 'OK',
    });

    setSaving(false);
    const err = insErr || updErr || delErr || cfgErr;
    if (err) { setSaveMsg('Error: ' + err.message); return; }
    setSaveMsg('Saved'); setRemovedIds([]);
    // Reload so new rows pick up their DB ids (avoids a duplicate insert on next save).
    const { data: fresh } = await supabase.from('cost_objects')
      .select('id,name,recurring_amount,cadence,cost_confidence,cost_shape,cost_nature,substantiation,parent_id,notes')
      .eq('business_id', businessId).eq('node_type', 'COST');
    if (fresh) setRows(fresh.map((r: any) => ({
      id: String(r.id), name: r.name ?? '',
      recurring_amount: r.recurring_amount == null ? null : Number(r.recurring_amount),
      cadence: r.cadence, cost_confidence: r.cost_confidence, cost_shape: r.cost_shape,
      cost_nature: r.cost_nature, substantiation: r.substantiation, parent_id: r.parent_id ?? null, notes: r.notes ?? null,
    })));
    setTimeout(() => setSaveMsg(''), 2000);
  }

  if (loading) {
    return <div style={cardStyle}><Heading /><p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Loading…</p></div>;
  }
  if (loadError) {
    return (
      <div style={cardStyle}>
        <Heading />
        <p style={{ fontSize: '0.875rem', color: RED, lineHeight: 1.5 }}>Couldn’t load your costs: {loadError}</p>
        <p style={{ fontSize: '0.8125rem', color: GRAY, lineHeight: 1.5 }}>
          Editing is disabled until it loads cleanly (this protects your stored cost rows from being
          dropped). Reload the page; if it persists, confirm you’re an active member of this business.
        </p>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <Heading />
      <p style={{ fontSize: '0.8125rem', color: GRAY, lineHeight: 1.5, margin: '0 0 16px' }}>
        Enter your real recurring costs. Mark each one's confidence honestly — <b>UNKNOWN</b> stays
        unknown (never $0). Tag each cost's <b>nature</b> (how it's recovered), <b>shape</b> (how it's
        billed), and optionally the <b>project</b> it belongs to. The tile divides the loaded monthly
        cost by your target customers (N) and suggests a price at your margin.
      </p>

      {/* ── Recurring cost rows (cost_objects) ── */}
      <SubLabel>Recurring &amp; operating costs</SubLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {rows.map((r, i) => {
          const cc = CONFIDENCE_COLOR[r.cost_confidence];
          const isUnknown = r.cost_confidence === 'UNKNOWN';
          return (
            <div key={r.id ?? `new-${i}`} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input value={r.name} onChange={e => editRow(i, { name: e.target.value })}
                  placeholder="Cost name (e.g. Claude Pro)" style={{ ...cell, flex: 2 }} />
                <MoneyInput value={isUnknown ? null : r.recurring_amount} onChange={v => editRow(i, { recurring_amount: v })}
                  placeholder={isUnknown ? 'unknown' : '$0.00'} disabled={isUnknown}
                  style={{ ...cell, flex: 1, background: isUnknown ? '#f3f4f6' : '#fff', color: isUnknown ? '#9ca3af' : DARK }} />
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                <select value={r.cadence} onChange={e => editRow(i, { cadence: e.target.value as Cadence })} style={{ ...cell, flex: 1, minWidth: 110 }}>
                  {CADENCE_OPTS.map(c => <option key={c} value={c}>{c.toLowerCase()}</option>)}
                </select>
                <select value={r.cost_confidence}
                  onChange={e => { const v = e.target.value as CostConfidence; editRow(i, v === 'UNKNOWN' ? { cost_confidence: v, recurring_amount: null } : { cost_confidence: v, recurring_amount: r.recurring_amount ?? 0 }); }}
                  style={{ ...cell, flex: 1, minWidth: 110, background: cc.bg, color: cc.fg, fontWeight: 700 }}>
                  {CONFIDENCE_OPTS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={() => removeRow(i)} style={{ background: '#fef2f2', border: 'none', borderRadius: 7, padding: '8px 11px', color: RED, fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <LabeledSelect label="nature" value={r.cost_nature} onChange={v => editRow(i, { cost_nature: v as CostNature })} opts={NATURE_OPTS} />
                <LabeledSelect label="shape" value={r.cost_shape} onChange={v => editRow(i, { cost_shape: v as CostShape })} opts={SHAPE_OPTS} />
                <LabeledSelect label="proof" value={r.substantiation} onChange={v => editRow(i, { substantiation: v as Substantiation })} opts={SUBSTANTIATION_OPTS} />
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1.4, minWidth: 150 }}>
                  <span style={pickLabel}>project</span>
                  <select value={r.parent_id ?? ''} onChange={e => editRow(i, { parent_id: e.target.value || null })} style={{ ...cell }}>
                    <option value="">None (company-level)</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={addRow} style={dashedBtn}>+ Add cost</button>
      {projects.length === 0 && (
        <p style={{ fontSize: '0.6875rem', color: '#9ca3af', margin: '0 0 12px' }}>
          No projects yet — costs stay company-level. Create projects in the cost view (/costs) to assign them.
        </p>
      )}

      {/* ── Labor (stays in config — R3) ── */}
      <SubLabel>Labor</SubLabel>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <MoneyInput value={loc.labor.rate} onChange={v => patchLoc(l => { l.labor.rate = v; })} placeholder="rate $/hr" style={{ ...cell, flex: 1 }} />
        <input type="number" step="0.5" value={loc.labor.hours == null ? '' : String(loc.labor.hours)}
          onChange={e => patchLoc(l => { l.labor.hours = e.target.value === '' ? null : parseFloat(e.target.value); })}
          placeholder="hours" style={{ ...cell, flex: 1 }} />
        <select value={loc.labor.period} onChange={e => patchLoc(l => { l.labor.period = e.target.value as CostPeriod; })} style={{ ...cell, flex: 1 }}>
          <option value="monthly">hr / month</option>
          <option value="annual">hr / year</option>
        </select>
      </div>
      <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0 0 12px' }}>
        Owner/family time at an owner-set rate (design §4.3). Stays in config this pass.
      </p>

      {/* ── Overhead per unit ── */}
      <SubLabel>Overhead per unit (optional)</SubLabel>
      <MoneyInput value={loc.overheadPerUnit ?? 0} onChange={v => patchLoc(l => { l.overheadPerUnit = v ?? 0; })} placeholder="$0.00" style={{ ...cell, width: '100%', marginBottom: 12 }} />

      {/* ── Margin policy ── */}
      <SubLabel>Margin policy</SubLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: '0.8125rem', color: GRAY }}>Baseline margin</span>
        <input type="number" step="0.01" min="0" max="0.99" value={String(config.margin.baseline)}
          onChange={e => patchConfig(c => { c.margin.baseline = parseFloat(e.target.value) || 0; })} style={{ ...cell, width: 90 }} />
        <span style={{ fontSize: '0.8125rem', color: GRAY }}>({(config.margin.baseline * 100).toFixed(0)}%)</span>
      </div>

      {/* ── Denominators + reference price ── */}
      <SubLabel>Target customers (sensitivity set)</SubLabel>
      <input value={config.denominators.join(', ')}
        onChange={e => patchConfig(c => { c.denominators = e.target.value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n) && n > 0); })}
        placeholder="1, 5, 20, 100" style={{ ...cell, width: '100%', marginBottom: 12 }} />

      <SubLabel>Reference price (optional)</SubLabel>
      <MoneyInput value={config.priceReference ?? null} onChange={v => patchConfig(c => { c.priceReference = v; })} placeholder="$149.00" style={{ ...cell, width: '100%', marginBottom: 16 }} />

      <button onClick={save} disabled={saving}
        style={{ width: '100%', padding: '13px 20px', background: saving ? '#e5e7eb' : GREEN, color: saving ? GRAY : '#fff', fontWeight: 700, fontSize: '0.9375rem', borderRadius: 10, border: 'none', cursor: saving ? 'default' : 'pointer' }}>
        {saving ? 'Saving…' : 'Save Cost-to-Produce config'}
      </button>
      {saveMsg && <p style={{ fontSize: '0.875rem', color: saveMsg.startsWith('Error') ? RED : GREEN, marginTop: 8, textAlign: 'center' }}>{saveMsg}</p>}
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 14, padding: '18px 16px', border: '1px solid #e5e7eb' };
const dashedBtn: React.CSSProperties = { marginBottom: 8, width: '100%', padding: '10px', borderRadius: 9, border: '1.5px dashed #d1d5db', cursor: 'pointer', background: 'transparent', color: GREEN, fontWeight: 700, fontSize: '0.8125rem' };
const pickLabel: React.CSSProperties = { fontSize: '0.5625rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 };

function LabeledSelect({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts: string[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 96 }}>
      <span style={pickLabel}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...cell }}>
        {opts.map(o => <option key={o} value={o}>{o.toLowerCase()}</option>)}
      </select>
    </div>
  );
}

function Heading() {
  return (
    <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
      Cost-to-Produce
    </p>
  );
}
function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '4px 0 8px' }}>
      {children}
    </p>
  );
}

/**
 * Money input: displays $X.XX when blurred, the raw numeric string while focused.
 * Stored value stays a number (cents-rounded on blur) — null when empty.
 */
function MoneyInput({ value, onChange, placeholder, disabled, style }: {
  value: number | null; onChange: (v: number | null) => void; placeholder?: string; disabled?: boolean; style?: React.CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  const display = focused ? text : (value == null ? '' : `$${value.toFixed(2)}`);
  return (
    <input
      type="text" inputMode="decimal" value={display} placeholder={placeholder} disabled={disabled}
      onFocus={() => { setFocused(true); setText(value == null ? '' : String(value)); }}
      onChange={e => { const raw = e.target.value.replace(/[^0-9.\-]/g, ''); setText(raw); const n = parseFloat(raw); onChange(raw === '' || !Number.isFinite(n) ? null : n); }}
      onBlur={() => { setFocused(false); if (value != null) onChange(Math.round(value * 100) / 100); }}
      style={style}
    />
  );
}
