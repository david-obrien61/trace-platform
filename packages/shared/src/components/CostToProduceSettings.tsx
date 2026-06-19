/**
 * ── COST-TO-PRODUCE CONFIG PANEL (shared, general) · THUNDER BUILD · 2026-06-14 ──
 *   STEP 7 RE-POINT (2026-06-17): recurring-cost entry writes first-class cost_objects rows.
 *   D-11/D-12 STAGE 4 (2026-06-18): reorganized into 4 DISTINCT blocks; LABOR is now its own
 *   real labor-model block (reads/writes labor_resources + applied-labor cost_objects);
 *   cost_category picker added to cost rows (D-11); config.labor write-path debt CLOSED.
 *   D-14.6 SEVER (2026-06-18): BLOCK 1 (recurring & operating costs) NO LONGER WRITES cost_objects.
 *   It is now a READ-ONLY pricing scratchpad — it DISPLAYS the recurring costs and points to
 *   /operating-costs (the owner-proven datasheet HOME) for all add/edit/delete. /operating-costs is
 *   the SOLE writer of recurring COST rows; the two-surface/two-save-model split is ended. Block 2
 *   (LABOR, D-12) is UNTOUCHED and remains a live cost_objects writer.
 *
 * PURPOSE
 *   The TUNE surface for Cost-to-Produce, in 4 clearly-separated blocks:
 *     1. RECURRING & OPERATING COSTS → READ-ONLY scratchpad (DISPLAY only). Entry/edit lives at
 *                                      /operating-costs. This block writes NOTHING (D-14.6 sever).
 *     2. LABOR                       → labor_resources (role/rate) + applied-labor cost_objects
 *                                      (node_type=COST, cost_category 'labor'|'contract-labor').
 *     3. MARGIN POLICY               → business_modules.config (baseline margin, overhead, reference).
 *     4. TARGET CUSTOMERS            → business_modules.config (denominator sensitivity set).
 *
 * STORAGE
 *   - cost_objects: applied-labor rows ONLY (Block 2). Per-ROW writes (insert/update/delete-by-id).
 *     Recurring COST rows are READ here (for the Block-1 scratchpad display) but WRITTEN only by
 *     /operating-costs (OperatingCosts.tsx) — this component no longer inserts/updates/deletes them.
 *   - labor_resources: one row per labor role/person; cost_rate = base_wage + burden (UI COMPUTES it
 *     on every edit so it can't drift). Per-row writes.
 *   - business_modules.config: margin / denominators / overhead / reference. config.labor is NO
 *     LONGER WRITTEN from any UI input (D-12 Stage 4 — labor is now a cost_object). On save, for a
 *     MIGRATED tenant (a labor cost_object exists) config.labor.rate/hours are CLEARED so the dead
 *     value isn't carried forever; un-migrated tenants KEEP config.labor for the read-path R1 fallback.
 *     Byte-identical either way — the read guard strips config.labor when a labor cost_object exists.
 *     config.recurring preserved (dormant backup). Button: "Save Cost-to-Produce" (saves costs + config).
 *
 * TRUNCATION-GUARD INTENT (preserved, LABOR): labor resources are deleted ONLY when the owner
 *   explicitly removes them (tracked in removedLabor) — never because a short/failed read showed
 *   fewer rows. No bulk array overwrite. A failed cost_objects/labor_resources read BLOCKS saving.
 *
 * SURFACE HONESTY
 *   - UNKNOWN confidence ⇒ amount stored NULL (never $0) — recurring AND labor.
 *   - Shape selector offers only the two fully-capturable shapes (RECURRING_FIXED, PER_OCCASION).
 *   - Pickers list REAL values only (categories = the Schedule C set; projects = real PROJECT nodes;
 *     nature/shape = CHECK-valid). Category honest-null ("uncategorized") allowed — no forced fake.
 *
 * BYTE-IDENTICAL: the reorg + labor re-point must NOT move the number. Owner line round-trips to
 *   cost_rate 75 × 160 hr = $12,000/mo (recurring_amount preserved) → floor $12,123 / known $12,280.67.
 *
 * INSTRUMENTATION (STD-003): `[TRACE:COST]` on LOAD + SAVE — ON BY DEFAULT until David owner-proves
 *   Stage 4 through the real UI under RLS; then comment out (not delete).
 */
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import { useBusinessContext } from '../context/BusinessProvider';
import { EMPTY_COST_CONFIG } from '../business-logic/CostToProduce';
import type { CostToProduceConfig, CostConfidence, CostLocation } from '../business-logic/CostToProduce';
// D-11 Schedule C category set — SHARED canonical list (also used by /assets capital-row picker).
import { CATEGORY_OPTS } from '../business-logic/costCategories';

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
const CADENCE_LABEL: Record<Cadence, string> = { WEEKLY: '/wk', MONTHLY: '/mo', QUARTERLY: '/qtr', ANNUAL: '/yr' };
const SHAPE_OPTS: CostShape[]  = ['RECURRING_FIXED', 'PER_OCCASION'];
const NATURE_OPTS: CostNature[] = ['OPEX', 'COGS', 'CAPEX'];
const SUBSTANTIATION_OPTS: Substantiation[] = ['OWNER_ASSERTED', 'SUBSTANTIATED'];

// CATEGORY_OPTS is imported above from the SHARED canonical list (business-logic/costCategories).

type ResourceType = 'EMPLOYEE' | 'CONTRACTOR';
type RateBasis = 'HOURLY' | 'FLAT_FEE';
const RESOURCE_TYPE_OPTS: ResourceType[] = ['EMPLOYEE', 'CONTRACTOR'];
const RATE_BASIS_OPTS: RateBasis[] = ['HOURLY', 'FLAT_FEE'];

/** An editable recurring cost — backed by a cost_objects row (id null = new, unsaved). */
interface CostObjectLine {
  id: string | null;
  name: string;
  recurring_amount: number | null;  // null = UNKNOWN, never 0
  cadence: Cadence;
  cost_confidence: CostConfidence;
  cost_shape: CostShape;
  cost_nature: CostNature;
  cost_category: string | null;      // D-11 — null = uncategorized (honest)
  substantiation: Substantiation;
  parent_id: string | null;          // project (PROJECT node) or null = company-level
  notes: string | null;
}

/** An editable labor line — a labor_resources row + its applied-labor cost_object (one entry). */
interface LaborEntry {
  resourceId: string | null;  // labor_resources.id (null = new)
  costId: string | null;      // applied cost_objects.id (null = new)
  resource_type: ResourceType;
  name: string;
  rate_basis: RateBasis;
  // EMPLOYEE economics
  base_wage: number | null;
  burden: number | null;      // single value now (components deferred — D-12)
  bill_rate: number | null;   // optional (deferred margin engine's input; present, not load-bearing)
  // CONTRACTOR economics
  rate: number | null;                  // HOURLY rate (FLAT_FEE uses flat_amount)
  pass_through_expenses: number | null; // materials/travel they bill you, separate from rate
  // applied
  labor_hours: number | null;   // HOURLY: monthly hours
  flat_amount: number | null;   // FLAT_FEE: the flat monthly figure
  cost_confidence: CostConfidence;
  cost_nature: CostNature;
  parent_id: string | null;
}
interface ProjectOption { id: string; name: string; }

const cell: React.CSSProperties = {
  boxSizing: 'border-box', padding: '8px 10px', border: '1.5px solid #d1d5db',
  borderRadius: 8, fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit',
  color: DARK, background: '#fff',
};

function deepClone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }
const num = (v: number | null | undefined) => (v == null ? 0 : v);

/** cost_rate = base_wage + burden. UI COMPUTES + stores it on every edit so it can't drift. */
function computeCostRate(e: LaborEntry): number { return num(e.base_wage) + num(e.burden); }

/** Monthly cost of one labor line (the recurring_amount written to the cost_object). */
function computeLaborMonthly(e: LaborEntry): number {
  if (e.rate_basis === 'HOURLY') {
    const perHour = e.resource_type === 'EMPLOYEE' ? computeCostRate(e) : num(e.rate);
    const base = perHour * num(e.labor_hours);
    return e.resource_type === 'CONTRACTOR' ? base + num(e.pass_through_expenses) : base;
  }
  // FLAT_FEE
  const flat = num(e.flat_amount);
  return e.resource_type === 'CONTRACTOR' ? flat + num(e.pass_through_expenses) : flat;
}

/** Defensive parse: jsonb usually arrives as an object, but tolerate a JSON string. */
function parseConfig(raw: unknown): CostToProduceConfig | null {
  let c: unknown = raw;
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch { return null; } }
  if (c && typeof c === 'object' && Array.isArray((c as CostToProduceConfig).locations)) {
    return c as CostToProduceConfig;
  }
  return null;
}

// (newLine removed 2026-06-18 D-14.6 — Block 1 no longer adds/edits recurring rows; entry is at /operating-costs.)

const newLabor = (): LaborEntry => ({
  resourceId: null, costId: null, resource_type: 'CONTRACTOR', name: '', rate_basis: 'HOURLY',
  base_wage: null, burden: null, bill_rate: null, rate: null, pass_through_expenses: null,
  labor_hours: null, flat_amount: null, cost_confidence: 'ESTIMATED', cost_nature: 'OPEX', parent_id: null,
});

export function CostToProduceSettings() {
  const { businessId } = useBusinessContext();
  const [config, setConfig]   = useState<CostToProduceConfig>(() => deepClone(EMPTY_COST_CONFIG));
  const [rows, setRows]       = useState<CostObjectLine[]>([]);  // recurring rows — READ-ONLY display (D-14.6)
  const [labor, setLabor]     = useState<LaborEntry[]>([]);
  const [removedLabor, setRemovedLabor] = useState<Array<{ costId: string | null; resourceId: string | null }>>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [loadError, setLoadError] = useState('');

  // Single editable location for config-side knobs (overhead); persisted in locations[].
  const loc: CostLocation = config.locations[0] ?? deepClone(EMPTY_COST_CONFIG.locations[0]);

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError('');
      setRemovedLabor([]);
      const [modRes, objRes, projRes, resRes] = await Promise.all([
        supabase.from('business_modules').select('config').eq('business_id', businessId).eq('module_key', MODULE_KEY).maybeSingle(),
        supabase.from('cost_objects')
          .select('id,name,recurring_amount,cadence,cost_confidence,cost_shape,cost_nature,cost_category,substantiation,parent_id,notes,resource_id,labor_hours')
          .eq('business_id', businessId).eq('node_type', 'COST'),
        supabase.from('cost_objects').select('id,name').eq('business_id', businessId).eq('node_type', 'PROJECT'),
        supabase.from('labor_resources')
          .select('id,resource_type,name,rate_basis,base_wage,burden,cost_rate,bill_rate,rate,pass_through_expenses')
          .eq('business_id', businessId),
      ]);
      if (cancelled) return;

      // A failed cost_objects OR labor read BLOCKS saving — never operate on a bad/short read.
      if (objRes.error || resRes.error) {
        const msg = objRes.error?.message || resRes.error?.message || 'read failed';
        console.log('[TRACE:COST] cost load FAILED (save blocked)', { businessId, error: msg });
        setLoadError(msg);
        setLoading(false);
        return;
      }

      const stored = parseConfig(modRes.data?.config);
      setConfig(stored && stored.locations.length ? stored : deepClone(EMPTY_COST_CONFIG));

      const allCost = (objRes.data ?? []) as any[];
      const isLaborCat = (c: any) => c === 'labor' || c === 'contract-labor';

      // ── RECURRING rows = COST rows that are NOT labor/contract-labor (null category included). ──
      const loaded: CostObjectLine[] = allCost.filter(r => !isLaborCat(r.cost_category)).map((r: any) => ({
        id: String(r.id),
        name: r.name ?? '',
        recurring_amount: r.recurring_amount == null ? null : Number(r.recurring_amount),
        cadence: (CADENCE_OPTS.includes(r.cadence) ? r.cadence : 'MONTHLY') as Cadence,
        cost_confidence: (CONFIDENCE_OPTS.includes(r.cost_confidence) ? r.cost_confidence : 'ESTIMATED') as CostConfidence,
        cost_shape: (SHAPE_OPTS.includes(r.cost_shape) ? r.cost_shape : 'RECURRING_FIXED') as CostShape,
        cost_nature: (NATURE_OPTS.includes(r.cost_nature) ? r.cost_nature : 'OPEX') as CostNature,
        cost_category: r.cost_category ?? null,
        substantiation: (SUBSTANTIATION_OPTS.includes(r.substantiation) ? r.substantiation : 'OWNER_ASSERTED') as Substantiation,
        parent_id: r.parent_id ?? null,
        notes: r.notes ?? null,
      }));
      setRows(loaded);

      // ── LABOR entries = applied-labor COST rows joined to their labor_resources. ──
      const resById = new Map<string, any>((resRes.data ?? []).map((x: any) => [String(x.id), x]));
      const laborCostRows = allCost.filter(r => isLaborCat(r.cost_category));
      const usedResourceIds = new Set<string>();
      const entries: LaborEntry[] = laborCostRows.map((r: any) => {
        const res = r.resource_id ? resById.get(String(r.resource_id)) : undefined;
        if (res) usedResourceIds.add(String(res.id));
        const rt: ResourceType = (res?.resource_type === 'EMPLOYEE' || res?.resource_type === 'CONTRACTOR')
          ? res.resource_type : (r.cost_category === 'labor' ? 'EMPLOYEE' : 'CONTRACTOR');
        const rb: RateBasis = (res?.rate_basis === 'FLAT_FEE') ? 'FLAT_FEE' : (r.labor_hours != null ? 'HOURLY' : (res?.rate_basis === 'HOURLY' ? 'HOURLY' : 'HOURLY'));
        return {
          resourceId: res ? String(res.id) : null,
          costId: String(r.id),
          resource_type: rt,
          name: res?.name ?? (r.name ?? ''),
          rate_basis: rb,
          base_wage: res?.base_wage == null ? null : Number(res.base_wage),
          burden: res?.burden == null ? null : Number(res.burden),
          bill_rate: res?.bill_rate == null ? null : Number(res.bill_rate),
          rate: res?.rate == null ? null : Number(res.rate),
          pass_through_expenses: res?.pass_through_expenses == null ? null : Number(res.pass_through_expenses),
          labor_hours: r.labor_hours == null ? null : Number(r.labor_hours),
          flat_amount: rb === 'FLAT_FEE' ? (r.recurring_amount == null ? null : Number(r.recurring_amount) - (rt === 'CONTRACTOR' ? num(res?.pass_through_expenses) : 0)) : null,
          cost_confidence: (CONFIDENCE_OPTS.includes(r.cost_confidence) ? r.cost_confidence : 'ESTIMATED') as CostConfidence,
          cost_nature: (NATURE_OPTS.includes(r.cost_nature) ? r.cost_nature : 'OPEX') as CostNature,
          parent_id: r.parent_id ?? null,
        };
      });
      // Resources with no applied-labor cost yet → surface as empty entries (don't lose them).
      for (const [id, res] of resById) {
        if (usedResourceIds.has(id)) continue;
        entries.push({
          resourceId: id, costId: null,
          resource_type: (res.resource_type === 'CONTRACTOR' ? 'CONTRACTOR' : 'EMPLOYEE'),
          name: res.name ?? '', rate_basis: (res.rate_basis === 'FLAT_FEE' ? 'FLAT_FEE' : 'HOURLY'),
          base_wage: res.base_wage == null ? null : Number(res.base_wage),
          burden: res.burden == null ? null : Number(res.burden),
          bill_rate: res.bill_rate == null ? null : Number(res.bill_rate),
          rate: res.rate == null ? null : Number(res.rate),
          pass_through_expenses: res.pass_through_expenses == null ? null : Number(res.pass_through_expenses),
          labor_hours: null, flat_amount: null, cost_confidence: 'ESTIMATED', cost_nature: 'OPEX', parent_id: null,
        });
      }
      setLabor(entries);

      setProjects((projRes.data ?? []).map((p: any) => ({ id: String(p.id), name: p.name ?? 'Untitled project' })));

      console.log('[TRACE:COST] settings load', {
        businessId, recurringRows: loaded.length, laborEntries: entries.length,
        projectsRead: projRes.data?.length ?? 0, laborResources: resRes.data?.length ?? 0,
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
  // (Recurring mutators addRow/editRow/removeRow removed 2026-06-18 D-14.6 — Block 1 is read-only;
  //  recurring costs are added/edited/deleted at /operating-costs, the sole writer.)
  function addLabor() { setLabor(ls => [...ls, newLabor()]); }
  function editLabor(i: number, patch: Partial<LaborEntry>) {
    setLabor(ls => ls.map((e, idx) => idx === i ? { ...e, ...patch } : e));
  }
  function removeLabor(i: number) {
    setLabor(ls => {
      const e = ls[i];
      if (e?.costId || e?.resourceId) setRemovedLabor(x => [...x, { costId: e.costId, resourceId: e.resourceId }]);
      return ls.filter((_, idx) => idx !== i);
    });
  }

  async function save() {
    if (!businessId) return;
    if (loadError) { setSaveMsg('Cannot save: costs did not load (' + loadError + '). Reload before editing.'); return; }
    setSaving(true);
    setSaveMsg('');

    // ── 1. RECURRING cost_objects: SEVERED (D-14.6, 2026-06-18). Block 1 no longer writes recurring
    //    COST rows — they are added/edited/deleted at /operating-costs (the owner-proven sole writer).
    //    This save() persists ONLY labor (Block 2) + config (Blocks 3/4). `rows` is read-only display. ──
    let err: { message: string } | null = null;

    // ── 2. LABOR: labor_resources (role/rate) + applied-labor cost_objects. Per-row. ──
    let laborInserts = 0, laborUpdates = 0;
    const namedLabor = labor.filter(e => e.name.trim().length > 0);
    for (const e of namedLabor) {
      if (err) break;
      const category = e.resource_type === 'EMPLOYEE' ? 'labor' : 'contract-labor';
      // 2a. resource (cost_rate recomputed every save — never drifts from base_wage+burden).
      const resPayload = {
        business_id: businessId, resource_type: e.resource_type, name: e.name.trim(), rate_basis: e.rate_basis,
        base_wage: e.resource_type === 'EMPLOYEE' ? e.base_wage : null,
        burden: e.resource_type === 'EMPLOYEE' ? e.burden : null,
        cost_rate: e.resource_type === 'EMPLOYEE' ? computeCostRate(e) : null,
        bill_rate: e.resource_type === 'EMPLOYEE' ? e.bill_rate : null,
        rate: e.resource_type === 'CONTRACTOR' ? (e.rate_basis === 'FLAT_FEE' ? e.flat_amount : e.rate) : null,
        pass_through_expenses: e.resource_type === 'CONTRACTOR' ? e.pass_through_expenses : null,
      };
      let resourceId = e.resourceId;
      if (!resourceId) {
        const { data, error } = await supabase.from('labor_resources').insert(resPayload).select('id').single();
        if (error) { err = error; break; }
        resourceId = String(data.id);
      } else {
        const { error } = await supabase.from('labor_resources').update(resPayload).eq('id', resourceId).eq('business_id', businessId);
        if (error) { err = error; break; }
      }
      // 2b. applied-labor cost_object. UNKNOWN ⇒ amount NULL (coherence).
      const monthly = e.cost_confidence === 'UNKNOWN' ? null : Math.round(computeLaborMonthly(e) * 100) / 100;
      const costPayload = {
        business_id: businessId, node_type: 'COST', cost_source: 'MANUAL',
        name: e.name.trim() + (category === 'labor' ? ' (labor)' : ' (contract)'),
        cost_category: category, cost_nature: e.cost_nature, cost_shape: 'RECURRING_FIXED' as const,
        cadence: 'MONTHLY' as const, recurring_amount: monthly, cost_confidence: e.cost_confidence,
        substantiation: 'OWNER_ASSERTED', acquisition_cost: null, parent_id: e.parent_id,
        resource_id: resourceId, labor_hours: e.rate_basis === 'HOURLY' ? e.labor_hours : null,
      };
      if (!e.costId) {
        const { error } = await supabase.from('cost_objects').insert(costPayload); if (error) { err = error; break; }
        laborInserts++;
      } else {
        const { error } = await supabase.from('cost_objects').update(costPayload).eq('id', e.costId).eq('business_id', businessId); if (error) { err = error; break; }
        laborUpdates++;
      }
    }

    // ── 3. Deletes: ONLY explicitly-removed LABOR rows. (Recurring deletes severed — D-14.6;
    //    recurring costs are removed at /operating-costs.) ──
    for (const d of removedLabor) {
      if (err) break;
      if (d.costId) { const { error } = await supabase.from('cost_objects').delete().eq('id', d.costId).eq('business_id', businessId).eq('node_type', 'COST'); if (error) { err = error; break; } }
      if (d.resourceId) { const { error } = await supabase.from('labor_resources').delete().eq('id', d.resourceId).eq('business_id', businessId); if (error) { err = error; break; } }
    }

    // ── 4. config: margin / denominators / overhead / reference. config.recurring PRESERVED.
    //    config.labor — D-12 Stage 4: labor now lives as a cost_object. For a MIGRATED tenant (a
    //    labor cost_object will exist after this save) we CLEAR the now-dead config.labor.rate/hours
    //    so the stale value isn't carried forever. BYTE-IDENTICAL: the read-path guard already strips
    //    config.labor when a labor cost_object exists (hasMigratedLabor), so the stored value never
    //    reaches the floor math — clearing it changes no number. Un-migrated tenants (no labor line)
    //    KEEP config.labor untouched (R1 read fallback). ──
    const hasLaborObject = namedLabor.length > 0;
    const configToWrite = hasLaborObject
      ? { ...config, locations: config.locations.map(l => ({ ...l, labor: { ...l.labor, rate: null, hours: null } })) }
      : config;
    let cfgErr: { message: string } | null = null;
    if (!err) {
      const { error } = await supabase.from('business_modules').upsert(
        { business_id: businessId, module_key: MODULE_KEY, enabled: true, configured: true, config: configToWrite },
        { onConflict: 'business_id,module_key' },
      );
      cfgErr = error;
    }

    console.log('[TRACE:COST] settings save', {
      businessId, recurring: 'READ_ONLY (severed D-14.6 — managed at /operating-costs)',
      laborInserts, laborUpdates, laborDeletes: removedLabor.length,
      result: err ? 'COST_ERR' : cfgErr ? 'CONFIG_ERR' : 'OK',
    });

    setSaving(false);
    const finalErr = err || cfgErr;
    if (finalErr) { setSaveMsg('Error: ' + finalErr.message); return; }
    setSaveMsg('Saved'); setRemovedLabor([]);
    // Reload so new rows pick up DB ids (avoids duplicate insert on next save).
    await reload();
    setTimeout(() => setSaveMsg(''), 2000);
  }

  async function reload() {
    if (!businessId) return;
    const [objRes, resRes] = await Promise.all([
      supabase.from('cost_objects')
        .select('id,name,recurring_amount,cadence,cost_confidence,cost_shape,cost_nature,cost_category,substantiation,parent_id,notes,resource_id,labor_hours')
        .eq('business_id', businessId).eq('node_type', 'COST'),
      supabase.from('labor_resources')
        .select('id,resource_type,name,rate_basis,base_wage,burden,cost_rate,bill_rate,rate,pass_through_expenses')
        .eq('business_id', businessId),
    ]);
    if (objRes.error || resRes.error) return;
    const allCost = (objRes.data ?? []) as any[];
    const isLaborCat = (c: any) => c === 'labor' || c === 'contract-labor';
    setRows(allCost.filter(r => !isLaborCat(r.cost_category)).map((r: any) => ({
      id: String(r.id), name: r.name ?? '',
      recurring_amount: r.recurring_amount == null ? null : Number(r.recurring_amount),
      cadence: r.cadence, cost_confidence: r.cost_confidence, cost_shape: r.cost_shape,
      cost_nature: r.cost_nature, cost_category: r.cost_category ?? null, substantiation: r.substantiation,
      parent_id: r.parent_id ?? null, notes: r.notes ?? null,
    })));
    const resById = new Map<string, any>((resRes.data ?? []).map((x: any) => [String(x.id), x]));
    const used = new Set<string>();
    const entries: LaborEntry[] = allCost.filter(r => isLaborCat(r.cost_category)).map((r: any) => {
      const res = r.resource_id ? resById.get(String(r.resource_id)) : undefined;
      if (res) used.add(String(res.id));
      const rt: ResourceType = (res?.resource_type === 'CONTRACTOR') ? 'CONTRACTOR' : 'EMPLOYEE';
      const rb: RateBasis = (res?.rate_basis === 'FLAT_FEE') ? 'FLAT_FEE' : 'HOURLY';
      return {
        resourceId: res ? String(res.id) : null, costId: String(r.id), resource_type: rt, name: res?.name ?? (r.name ?? ''),
        rate_basis: rb, base_wage: res?.base_wage == null ? null : Number(res.base_wage),
        burden: res?.burden == null ? null : Number(res.burden), bill_rate: res?.bill_rate == null ? null : Number(res.bill_rate),
        rate: res?.rate == null ? null : Number(res.rate), pass_through_expenses: res?.pass_through_expenses == null ? null : Number(res.pass_through_expenses),
        labor_hours: r.labor_hours == null ? null : Number(r.labor_hours),
        flat_amount: rb === 'FLAT_FEE' ? (r.recurring_amount == null ? null : Number(r.recurring_amount) - (rt === 'CONTRACTOR' ? num(res?.pass_through_expenses) : 0)) : null,
        cost_confidence: r.cost_confidence, cost_nature: r.cost_nature, parent_id: r.parent_id ?? null,
      };
    });
    for (const [id, res] of resById) {
      if (used.has(id)) continue;
      entries.push({ resourceId: id, costId: null, resource_type: res.resource_type === 'CONTRACTOR' ? 'CONTRACTOR' : 'EMPLOYEE',
        name: res.name ?? '', rate_basis: res.rate_basis === 'FLAT_FEE' ? 'FLAT_FEE' : 'HOURLY',
        base_wage: res.base_wage == null ? null : Number(res.base_wage), burden: res.burden == null ? null : Number(res.burden),
        bill_rate: res.bill_rate == null ? null : Number(res.bill_rate), rate: res.rate == null ? null : Number(res.rate),
        pass_through_expenses: res.pass_through_expenses == null ? null : Number(res.pass_through_expenses),
        labor_hours: null, flat_amount: null, cost_confidence: 'ESTIMATED', cost_nature: 'OPEX', parent_id: null });
    }
    setLabor(entries);
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
        Enter your costs honestly — mark each one's confidence (<b>UNKNOWN</b> stays unknown, never $0).
        The tile divides your loaded monthly cost by your target customers (N) and suggests a price at
        your margin.
      </p>

      {/* ════ BLOCK 1 — RECURRING & OPERATING COSTS · READ-ONLY SCRATCHPAD (D-14.6) ════ */}
      {/* Severed 2026-06-18: this block no longer writes cost_objects. It DISPLAYS the recurring
          costs (so the page still shows what feeds the price) and points to /operating-costs — the
          owner-proven datasheet HOME — for all add/edit/delete. No editable field, no Save here. */}
      <Block title="1 · Recurring & operating costs (read-only)" hint="Subscriptions, utilities, fees that recur regardless of labor. Shown here for reference — add or edit them on the Operating Costs page.">
        {rows.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {rows.map((r) => {
              const cc = CONFIDENCE_COLOR[r.cost_confidence];
              const isUnknown = r.cost_confidence === 'UNKNOWN';
              const projName = r.parent_id ? (projects.find(p => p.id === r.parent_id)?.name ?? 'Project') : 'Company-level';
              return (
                <div key={r.id ?? r.name} style={{ ...rowBox, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontWeight: 700, color: DARK, fontSize: '0.875rem' }}>{r.name}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 700, color: isUnknown ? '#9ca3af' : GREEN, fontSize: '0.875rem' }}>
                        {isUnknown || r.recurring_amount == null ? 'unknown' : `$${r.recurring_amount.toFixed(2)} ${CADENCE_LABEL[r.cadence]}`}
                      </span>
                      <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '2px 7px', borderRadius: 12, background: cc.bg, color: cc.fg }}>{r.cost_confidence}</span>
                    </span>
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: GRAY }}>
                    {r.cost_category ?? 'uncategorized'} · {projName}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '0 0 12px' }}>
            No recurring costs yet — add your first subscription, utility, or fee on the Operating Costs page.
          </p>
        )}
        {/* Pointer to the sole writer. Plain anchor (shared component stays router-agnostic; the
            authenticated Supabase session re-hydrates on load, /operating-costs is a PrivateRoute). */}
        <a href="/operating-costs" style={{ ...dashedBtn, display: 'block', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>
          Manage recurring &amp; operating costs →
        </a>
      </Block>

      {/* ════ BLOCK 2 — LABOR (labor_resources + applied-labor cost_objects) ════ */}
      <Block title="2 · Labor" hint="Owner/employee time (cost = wage + burden) or contractors (you pay what they bill). Each line becomes a real, projectable cost.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {labor.map((e, i) => {
            const cc = CONFIDENCE_COLOR[e.cost_confidence];
            const isUnknown = e.cost_confidence === 'UNKNOWN';
            const monthly = computeLaborMonthly(e);
            const isEmp = e.resource_type === 'EMPLOYEE';
            return (
              <div key={e.costId ?? e.resourceId ?? `newL-${i}`} style={rowBox}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input value={e.name} onChange={ev => editLabor(i, { name: ev.target.value })}
                    placeholder={isEmp ? 'Name / role (e.g. Owner)' : 'Contractor name (e.g. Connor)'} style={{ ...cell, flex: 2 }} />
                  <LabeledSelect label="type" value={e.resource_type} onChange={v => editLabor(i, { resource_type: v as ResourceType })} opts={RESOURCE_TYPE_OPTS} />
                  <LabeledSelect label="basis" value={e.rate_basis} onChange={v => editLabor(i, { rate_basis: v as RateBasis })} opts={RATE_BASIS_OPTS} />
                  <button onClick={() => removeLabor(i)} style={{ ...removeBtn, alignSelf: 'flex-end' }}>✕</button>
                </div>

                {/* economics — employee vs contractor */}
                {isEmp ? (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                    <LabeledMoney label="base wage $/hr" value={e.base_wage} onChange={v => editLabor(i, { base_wage: v })} />
                    <LabeledMoney label="burden $/hr" value={e.burden} onChange={v => editLabor(i, { burden: v })} />
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 96 }}>
                      <span style={pickLabel}>cost rate $/hr</span>
                      <div style={{ ...cell, background: '#f3f4f6', color: GREEN, fontWeight: 700 }}>${computeCostRate(e).toFixed(2)}</div>
                    </div>
                    <LabeledMoney label="bill rate $/hr (opt)" value={e.bill_rate} onChange={v => editLabor(i, { bill_rate: v })} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                    {e.rate_basis === 'HOURLY'
                      ? <LabeledMoney label="rate $/hr" value={e.rate} onChange={v => editLabor(i, { rate: v })} />
                      : <LabeledMoney label="flat fee $/mo" value={e.flat_amount} onChange={v => editLabor(i, { flat_amount: v })} />}
                    <LabeledMoney label="pass-through $/mo" value={e.pass_through_expenses} onChange={v => editLabor(i, { pass_through_expenses: v })} />
                  </div>
                )}

                {/* applied: hours (HOURLY) or flat amount (employee FLAT_FEE) + confidence + project */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                  {e.rate_basis === 'HOURLY' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 96 }}>
                      <span style={pickLabel}>hours / mo</span>
                      <input type="number" step="0.5" value={e.labor_hours == null ? '' : String(e.labor_hours)}
                        onChange={ev => editLabor(i, { labor_hours: ev.target.value === '' ? null : parseFloat(ev.target.value) })}
                        placeholder="hours" style={{ ...cell }} />
                    </div>
                  ) : isEmp ? (
                    <LabeledMoney label="amount $/mo" value={e.flat_amount} onChange={v => editLabor(i, { flat_amount: v })} />
                  ) : null}
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 110 }}>
                    <span style={pickLabel}>confidence</span>
                    <select value={e.cost_confidence}
                      onChange={ev => editLabor(i, { cost_confidence: ev.target.value as CostConfidence })}
                      style={{ ...cell, background: cc.bg, color: cc.fg, fontWeight: 700 }}>
                      {CONFIDENCE_OPTS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1.4, minWidth: 140 }}>
                    <span style={pickLabel}>project</span>
                    <select value={e.parent_id ?? ''} onChange={ev => editLabor(i, { parent_id: ev.target.value || null })} style={{ ...cell }}>
                      <option value="">None (company-level)</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '0.6875rem', color: GRAY }}>
                  Monthly cost: <b style={{ color: isUnknown ? '#9ca3af' : GREEN }}>{isUnknown ? 'unknown' : `$${monthly.toFixed(2)}/mo`}</b>
                  {' '}· category <b>{isEmp ? 'labor' : 'contract-labor'}</b>{e.rate_basis === 'HOURLY' && !isUnknown ? ` (${isEmp ? '$' + computeCostRate(e).toFixed(2) : '$' + num(e.rate).toFixed(2)}/hr × ${num(e.labor_hours)} hr)` : ''}
                </p>
              </div>
            );
          })}
        </div>
        <button onClick={addLabor} style={dashedBtn}>+ Add labor</button>
      </Block>

      {/* ════ BLOCK 3 — MARGIN POLICY ════ */}
      <Block title="3 · Margin policy" hint="Your baseline gross margin and (optional) overhead + reference price.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: '0.8125rem', color: GRAY, minWidth: 120 }}>Baseline margin</span>
          <input type="number" step="0.01" min="0" max="0.99" value={String(config.margin.baseline)}
            onChange={e => patchConfig(c => { c.margin.baseline = parseFloat(e.target.value) || 0; })} style={{ ...cell, width: 90 }} />
          <span style={{ fontSize: '0.8125rem', color: GRAY }}>({(config.margin.baseline * 100).toFixed(0)}%)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: '0.8125rem', color: GRAY, minWidth: 120 }}>Overhead / unit (opt)</span>
          <MoneyInput value={loc.overheadPerUnit ?? 0} onChange={v => patchLoc(l => { l.overheadPerUnit = v ?? 0; })} placeholder="$0.00" style={{ ...cell, width: 120 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8125rem', color: GRAY, minWidth: 120 }}>Reference price (opt)</span>
          <MoneyInput value={config.priceReference ?? null} onChange={v => patchConfig(c => { c.priceReference = v; })} placeholder="$149.00" style={{ ...cell, width: 120 }} />
        </div>
      </Block>

      {/* ════ BLOCK 4 — TARGET CUSTOMERS ════ */}
      <Block title="4 · Target customers" hint="The sensitivity set — your loaded cost ÷ each N gives the per-customer cost + suggested price.">
        <input value={config.denominators.join(', ')}
          onChange={e => patchConfig(c => { c.denominators = e.target.value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n) && n > 0); })}
          placeholder="1, 5, 20, 100" style={{ ...cell, width: '100%' }} />
      </Block>

      <button onClick={save} disabled={saving}
        style={{ width: '100%', padding: '13px 20px', background: saving ? '#e5e7eb' : GREEN, color: saving ? GRAY : '#fff', fontWeight: 700, fontSize: '0.9375rem', borderRadius: 10, border: 'none', cursor: saving ? 'default' : 'pointer', marginTop: 4 }}>
        {saving ? 'Saving…' : 'Save Cost-to-Produce'}
      </button>
      {saveMsg && <p style={{ fontSize: '0.875rem', color: saveMsg.startsWith('Error') ? RED : GREEN, marginTop: 8, textAlign: 'center' }}>{saveMsg}</p>}
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 14, padding: '18px 16px', border: '1px solid #e5e7eb' };
const rowBox: React.CSSProperties = { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 };
const dashedBtn: React.CSSProperties = { width: '100%', padding: '10px', borderRadius: 9, border: '1.5px dashed #d1d5db', cursor: 'pointer', background: 'transparent', color: GREEN, fontWeight: 700, fontSize: '0.8125rem' };
const removeBtn: React.CSSProperties = { background: '#fef2f2', border: 'none', borderRadius: 7, padding: '8px 11px', color: RED, fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' };
const pickLabel: React.CSSProperties = { fontSize: '0.5625rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 };

/** A visually distinct titled block (D-12 Stage 4 — the 4-block reorg). */
function Block({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 12px', marginBottom: 14, background: '#fcfcfb' }}>
      <p style={{ fontSize: '0.75rem', fontWeight: 800, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 2px' }}>{title}</p>
      {hint && <p style={{ fontSize: '0.6875rem', color: GRAY, lineHeight: 1.4, margin: '0 0 12px' }}>{hint}</p>}
      {children}
    </div>
  );
}

function LabeledSelect({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts: string[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 96 }}>
      <span style={pickLabel}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...cell }}>
        {opts.map(o => <option key={o} value={o}>{o.toLowerCase().replace('_', ' ')}</option>)}
      </select>
    </div>
  );
}

function LabeledMoney({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 96 }}>
      <span style={pickLabel}>{label}</span>
      <MoneyInput value={value} onChange={onChange} placeholder="$0.00" style={{ ...cell }} />
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
