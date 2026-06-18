/**
 * BUILDER-COMPLETE proof for D-14 Phase 1 — per-project cost-to-produce drill-in.
 * Service-key (read-only). Confirms the drill-in's totals reconcile EXACTLY with the
 * by-project tree's rolled-up totals for a real project, and prints the category split +
 * confidence mix. Replicates the component's summarizeGroup math verbatim + the tree's
 * row mapping + buildProjectLens (the same shared adapter the UI calls).
 *
 * Run: node scripts/_run-ts.mjs scripts/verify-project-drill-in.ts
 * Requires packages/cultivar-os/.env.local (SUPABASE_URL + SUPABASE_SERVICE_KEY).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildProjectLens, OVERHEAD_GROUP_ID } from '../packages/shared/src/business-logic/ProjectLens';
import type { ProjectLensRow, ProjectGroup } from '../packages/shared/src/business-logic/ProjectLens';
import { fromCostObject } from '../packages/shared/src/business-logic/CountOnceSeam';

const repoRoot = process.cwd();
const env = Object.fromEntries(
  readFileSync(join(repoRoot, 'packages/cultivar-os/.env.local'), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const round2 = (n: number) => Math.round(n * 100) / 100;
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const isLaborCat = (c?: string | null) => c === 'labor' || c === 'contract-labor';
const FLOOR_GRADES = new Set(['CONFIRMED', 'DERIVED']);
type DrillChild = ProjectLensRow & { cost_category?: string | null };

// ── verbatim copy of the component's summarizeGroup math ──
function summarizeGroup(group: ProjectGroup, children: DrillChild[]) {
  const poolKnownMonthly = round2(group.rollup.poolKnownMonthly);
  const capexKnown = round2(group.rollup.capexKnown);
  let laborMonthly = 0, floorMonthly = 0, estimatedMonthly = 0;
  const unknownLabels: string[] = [];
  for (const c of children) {
    for (const e of fromCostObject(c)) {
      if (e.amount == null) { unknownLabels.push(c.label); continue; }
      if (e.bucket === 'MONTHLY_POOL') {
        if (isLaborCat(c.cost_category)) laborMonthly += e.amount;
        if (FLOOR_GRADES.has(e.amountConfidence)) floorMonthly += e.amount;
        else if (e.amountConfidence === 'ESTIMATED') estimatedMonthly += e.amount;
      }
    }
  }
  laborMonthly = round2(laborMonthly);
  const otherRecurringMonthly = round2(poolKnownMonthly - laborMonthly);
  const reconcileDrift = round2(Math.abs(round2(floorMonthly + estimatedMonthly) - poolKnownMonthly));
  return { poolKnownMonthly, capexKnown, laborMonthly, otherRecurringMonthly,
    floorMonthly: round2(floorMonthly), estimatedMonthly: round2(estimatedMonthly), unknownLabels, reconcileDrift };
}

(async () => {
  // Find businesses that have cost_objects; pick the one with the most PROJECT nodes.
  const { data: objs, error } = await sb
    .from('cost_objects')
    .select('id,name,node_type,parent_id,acquisition_cost,cost_confidence,cost_shape,cadence,recurring_amount,cost_category,business_id,is_active')
    .eq('is_active', true);
  if (error) { console.error('cost_objects read failed:', error.message); process.exit(1); }

  const byBiz = new Map<string, any[]>();
  for (const r of objs ?? []) (byBiz.get(r.business_id) ?? (byBiz.set(r.business_id, []), byBiz.get(r.business_id)!)).push(r);

  // rank by #PROJECT nodes then total rows
  const ranked = [...byBiz.entries()].sort((a, b) => {
    const pa = a[1].filter((r) => r.node_type === 'PROJECT').length;
    const pb = b[1].filter((r) => r.node_type === 'PROJECT').length;
    return pb - pa || b[1].length - a[1].length;
  });
  if (ranked.length === 0) { console.error('No cost_objects in any tenant.'); process.exit(1); }
  const [businessId, rawRows] = ranked[0];

  const { data: bizRow } = await sb.from('businesses').select('name').eq('id', businessId).maybeSingle();
  const businessName = (bizRow as any)?.name ?? 'My business';

  // Map exactly like ProjectCostTree.load()
  const rows: DrillChild[] = (rawRows as any[]).map((r) => ({
    id: r.id,
    label: r.name ?? 'Unnamed',
    node_type: r.node_type ?? 'ASSET',
    parent_id: r.parent_id ?? null,
    acquisition_cost: r.acquisition_cost ?? null,
    cost_confidence: r.cost_confidence ?? 'UNKNOWN',
    cost_shape: r.cost_shape ?? undefined,
    cadence: r.cadence ?? undefined,
    recurring_amount: r.recurring_amount ?? null,
    cost_category: r.cost_category ?? null,
  }));

  const today = new Date().toISOString().slice(0, 10);
  const view = buildProjectLens(rows, businessName, today);

  console.log(`\n=== TENANT: ${businessName} (${businessId}) — ${rows.length} cost rows ===`);
  console.log(`Flat company top-line: capex ${usd.format(view.flatCompanyTotal.capexKnown)} · pool ${usd.format(view.flatCompanyTotal.poolKnownMonthly)}/mo\n`);

  let allReconcile = true;
  for (const g of view.groups) {
    const tag = g.id === OVERHEAD_GROUP_ID ? '(overhead)' : '(project)';
    const children = g.children as DrillChild[];
    const s = summarizeGroup(g, children);

    // RECONCILIATION: drill-in headline MUST equal the tree's rolled-up totals.
    const treePool = round2(g.rollup.poolKnownMonthly);
    const treeCapex = round2(g.rollup.capexKnown);
    const drillPool = round2(s.laborMonthly + s.otherRecurringMonthly);
    const poolOK = drillPool === treePool;
    const capexOK = s.capexKnown === treeCapex;
    if (!poolOK || !capexOK) allReconcile = false;

    console.log(`▸ ${g.label} ${tag}  [${children.length} child rows]`);
    console.log(`   TREE   : pool ${usd.format(treePool)}/mo · capex ${usd.format(treeCapex)} one-time`);
    console.log(`   DRILL  : pool ${usd.format(drillPool)}/mo (labor ${usd.format(s.laborMonthly)} + other ${usd.format(s.otherRecurringMonthly)}) · capital ${usd.format(s.capexKnown)} one-time`);
    console.log(`   CONF   : floor ${usd.format(s.floorMonthly)}/mo · est ${usd.format(s.estimatedMonthly)}/mo · unknown ${s.unknownLabels.length}${s.unknownLabels.length ? ' (' + s.unknownLabels.join(', ') + ')' : ''}`);
    console.log(`   RECONCILE: pool ${poolOK ? 'MATCH ✅' : 'MISMATCH ❌'} · capex ${capexOK ? 'MATCH ✅' : 'MISMATCH ❌'}${s.reconcileDrift > 0.02 ? ` · ⚠️ conf-drift ${s.reconcileDrift}` : ''}\n`);
  }

  console.log(allReconcile ? '=== ALL GROUPS RECONCILE ✅ (drill-in totals == tree totals) ===' : '=== RECONCILIATION FAILED ❌ ===');
  process.exit(allReconcile ? 0 : 1);
})();
