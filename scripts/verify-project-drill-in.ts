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
const categoryLabel = (c?: string | null) => (c && c.trim() ? c : 'Uncategorized');
type DrillChild = ProjectLensRow & { cost_category?: string | null; receipt_id?: string | null };
interface LineItem { name: string; amount: number; confidence: string; category: string; isUncategorized: boolean; receiptId: string | null; }

// ── verbatim copy of the component's summarizeGroup math (Phase 1.1 — real positive group-bys) ──
function summarizeGroup(group: ProjectGroup, children: DrillChild[]) {
  const poolKnownMonthly = round2(group.rollup.poolKnownMonthly);
  const capexKnown = round2(group.rollup.capexKnown);
  const laborItems: LineItem[] = [], otherItems: LineItem[] = [], capitalItems: LineItem[] = [];
  let laborMonthly = 0, otherRecurringMonthly = 0, capitalOneTime = 0;
  const unknownLabels: string[] = [];
  for (const c of children) {
    const cat = categoryLabel(c.cost_category);
    const uncat = cat === 'Uncategorized';
    for (const e of fromCostObject(c)) {
      if (e.amount == null) { unknownLabels.push(c.label); continue; }
      const item: LineItem = { name: c.label, amount: e.amount, confidence: e.amountConfidence, category: cat,
        isUncategorized: uncat && e.bucket === 'MONTHLY_POOL' && !isLaborCat(c.cost_category), receiptId: c.receipt_id ?? null };
      if (e.bucket === 'MONTHLY_POOL') {
        if (isLaborCat(c.cost_category)) { laborItems.push(item); laborMonthly += e.amount; }
        else { otherItems.push(item); otherRecurringMonthly += e.amount; }
      } else { capitalItems.push(item); capitalOneTime += e.amount; }
    }
  }
  laborMonthly = round2(laborMonthly); otherRecurringMonthly = round2(otherRecurringMonthly); capitalOneTime = round2(capitalOneTime);
  return { poolKnownMonthly, capexKnown, laborItems, otherItems, capitalItems,
    laborMonthly, otherRecurringMonthly, capitalOneTime,
    anyUncategorized: otherItems.some((i) => i.isUncategorized), unknownLabels };
}
const sumItems = (items: LineItem[]) => round2(items.reduce((a, i) => a + i.amount, 0));

(async () => {
  // Find businesses that have cost_objects; pick the one with the most PROJECT nodes.
  const { data: objs, error } = await sb
    .from('cost_objects')
    .select('id,name,node_type,parent_id,acquisition_cost,cost_confidence,cost_shape,cadence,recurring_amount,cost_category,receipt_id,business_id,is_active')
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
    receipt_id: r.receipt_id ?? null,
  }));

  const today = new Date().toISOString().slice(0, 10);
  const view = buildProjectLens(rows, businessName, today);

  console.log(`\n=== TENANT: ${businessName} (${businessId}) — ${rows.length} cost rows ===`);
  console.log(`Flat company top-line: capex ${usd.format(view.flatCompanyTotal.capexKnown)} · pool ${usd.format(view.flatCompanyTotal.poolKnownMonthly)}/mo\n`);

  const printItems = (title: string, items: LineItem[], aggregate: number, suffix: string) => {
    const itemSum = sumItems(items);
    const ok = itemSum === round2(aggregate);
    console.log(`     ${title}: aggregate ${usd.format(aggregate)}${suffix} · Σ items ${usd.format(itemSum)}${suffix} · ${ok ? 'ITEMS SUM ✅' : 'MISMATCH ❌'}`);
    for (const it of items) {
      console.log(`        • ${it.name}  ${usd.format(it.amount)}${suffix}  [${it.confidence}]  cat=${it.category}${it.isUncategorized ? ' ⚠️UNCATEGORIZED' : ''}${it.receiptId ? '  🧾receipt' : ''}`);
    }
    return ok;
  };

  let allReconcile = true;
  let anyUncat = false;
  for (const g of view.groups) {
    const tag = g.id === OVERHEAD_GROUP_ID ? '(overhead)' : '(project)';
    const children = g.children as DrillChild[];
    const s = summarizeGroup(g, children);

    // RECONCILIATION: aggregates === tree totals AND Σ line items === each aggregate.
    const treePool = round2(g.rollup.poolKnownMonthly);
    const treeCapex = round2(g.rollup.capexKnown);
    const drillPool = round2(s.laborMonthly + s.otherRecurringMonthly);
    const poolOK = drillPool === treePool;
    const capexOK = s.capitalOneTime === treeCapex;
    if (s.anyUncategorized) anyUncat = true;

    console.log(`▸ ${g.label} ${tag}  [${children.length} child rows]`);
    console.log(`   TREE   : pool ${usd.format(treePool)}/mo · capex ${usd.format(treeCapex)} one-time`);
    console.log(`   DRILL  : pool ${usd.format(drillPool)}/mo (labor ${usd.format(s.laborMonthly)} + other ${usd.format(s.otherRecurringMonthly)}) · capital ${usd.format(s.capitalOneTime)} one-time`);
    const laborItemsOK = printItems('Labor', s.laborItems, s.laborMonthly, '/mo');
    const otherItemsOK = printItems('Other recurring', s.otherItems, s.otherRecurringMonthly, '/mo');
    const capItemsOK = printItems('Captured capital', s.capitalItems, s.capitalOneTime, '');
    if (s.unknownLabels.length) console.log(`     Unknown (no amount, not summed): ${s.unknownLabels.join(', ')}`);
    const groupOK = poolOK && capexOK && laborItemsOK && otherItemsOK && capItemsOK;
    if (!groupOK) allReconcile = false;
    console.log(`   RECONCILE: pool→tree ${poolOK ? '✅' : '❌'} · capex→tree ${capexOK ? '✅' : '❌'} · items→aggregates ${laborItemsOK && otherItemsOK && capItemsOK ? '✅' : '❌'}\n`);
  }

  console.log(anyUncat ? '⚠️  UNCATEGORIZED line items surfaced (honest visibility, not a failure — see ⚠️UNCATEGORIZED above).' : 'ℹ️  No Uncategorized line items in any group.');
  console.log(allReconcile ? '=== ALL GROUPS RECONCILE ✅ (Σ items === aggregate, aggregates === tree totals) ===' : '=== RECONCILIATION FAILED ❌ ===');
  process.exit(allReconcile ? 0 : 1);
})();
