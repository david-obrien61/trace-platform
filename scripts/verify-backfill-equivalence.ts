/**
 * verify-backfill-equivalence.ts — Unified Cost Model, BUILD step 5: THE GATE.
 *
 * Proves the backfill is LOSSLESS by simulating the POST-FLIP read path and checking the
 * flat total still equals the locked before-number ($12,239.67/mo per tenant):
 *   • config with recurring[] EMPTIED but labor KEPT (R3 — labor stays in config), AND
 *   • ALL cost_objects fed shape-aware through fromCostObject (the migrated COST rows →
 *     MONTHLY_POOL; ASSET capex → excluded), through the ONE count-once seam.
 * If knownMonthly == the snapshot → lossless, safe to flip (step 6). If not → STOP, report delta.
 *
 * Also: catalog-count — node_type='COST' rows inserted == config recurring lines counted.
 *
 * Bundle + run:
 *   node_modules/.bin/esbuild scripts/verify-backfill-equivalence.ts --bundle \
 *     --platform=node --format=esm | node --input-type=module
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { analyze } from '../packages/shared/src/business-logic/CostToProduce';
import type { CostToProduceConfig } from '../packages/shared/src/business-logic/CostToProduce';
import { fromCostObject } from '../packages/shared/src/business-logic/CountOnceSeam';
import type { CostEvent, CostObjectNodeRow } from '../packages/shared/src/business-logic/CountOnceSeam';

const repoRoot = process.cwd();
const env = Object.fromEntries(
  readFileSync(join(repoRoot, 'packages/cultivar-os/.env.local'), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
const snapshot: any[] = JSON.parse(readFileSync(join(repoRoot, 'docs/cost-to-produce/BEFORE-NUMBER-snapshot.json'), 'utf8'));
const cent = (a: number, b: number) => Math.abs(a - b) < 0.005; // exact-to-the-cent

let failed = 0;
async function main() {
  const { data: mods } = await sb.from('business_modules').select('business_id, config').eq('module_key', 'cost_to_produce');
  for (const m of mods ?? []) {
    const businessId = (m as any).business_id as string;
    const cfg = (m as any).config as CostToProduceConfig;
    if (!cfg || !Array.isArray(cfg.locations) || !cfg.locations.length) continue;
    const anchor = snapshot.find((s) => s.businessId === businessId);
    if (!anchor) { console.log(`[${businessId}] no anchor in snapshot — skip`); continue; }

    const configRecurringCount = cfg.locations.reduce((s, l) => s + (l.recurring?.length ?? 0), 0);

    // POST-FLIP config: recurring emptied, EVERYTHING ELSE (labor/margin/denoms) kept.
    const postFlip: CostToProduceConfig = JSON.parse(JSON.stringify(cfg));
    postFlip.locations.forEach((l) => { l.recurring = []; });

    // Inventory UNKNOWN fold (mirrors the page).
    const { data: invRows } = await sb.from('business_inventory').select('name, unit_cost, cost_confidence').eq('business_id', businessId);
    const unknownInv = (invRows ?? [])
      .filter((r: any) => (r.cost_confidence ?? '').toUpperCase() === 'UNKNOWN' || r.unit_cost == null)
      .map((r: any) => `Inventory: ${r.name}`);

    // ALL cost_objects, NOW selecting the new shape columns → shape-aware fromCostObject.
    const { data: objs } = await sb.from('cost_objects')
      .select('id,name,node_type,domain,acquisition_cost,cost_confidence,status,cost_shape,cadence,recurring_amount')
      .eq('business_id', businessId);
    const rollupEvents: CostEvent[] = (objs ?? []).flatMap((r: any) => fromCostObject({
      id: String(r.id), label: String(r.name ?? 'Unnamed'),
      node_type: (r.node_type as CostObjectNodeRow['node_type']) ?? 'ASSET',
      domain: r.domain ?? null,
      acquisition_cost: (r.acquisition_cost as number | null) ?? null,
      cost_confidence: (r.cost_confidence as CostObjectNodeRow['cost_confidence']) ?? 'UNKNOWN',
      status: r.status ?? null,
      cost_shape: r.cost_shape ?? null,
      cadence: r.cadence ?? null,
      recurring_amount: (r.recurring_amount as number | null) ?? null,
    }));
    const costNodeCount = (objs ?? []).filter((r: any) => r.node_type === 'COST').length;

    const sim = analyze(postFlip, unknownInv, { rollupEvents });
    const a = sim.confidence;

    console.log(`\n── tenant ${businessId} ──`);
    console.log(`  ANCHOR  : floor=$${anchor.floorMonthly}  est=$${anchor.estimatedMonthly}  KNOWN=$${anchor.knownMonthly}`);
    console.log(`  POST-FLIP: floor=$${a.floorMonthly}  est=$${a.estimatedMonthly}  KNOWN=$${a.knownMonthly}  (capexExcluded=$${a.capexExcluded ?? 0})`);

    const okKnown = cent(a.knownMonthly, anchor.knownMonthly);
    const okFloor = cent(a.floorMonthly, anchor.floorMonthly);
    const okEst   = cent(a.estimatedMonthly, anchor.estimatedMonthly);
    const okCount = costNodeCount === configRecurringCount;
    const okCapex = cent(a.capexExcluded ?? 0, anchor.capexExcluded ?? 0);

    const tag = (b: boolean) => (b ? '✅' : '❌');
    console.log(`  ${tag(okKnown)} flat total matches  ${tag(okFloor)} floor  ${tag(okEst)} estimated  ${tag(okCapex)} capexExcluded unchanged`);
    console.log(`  ${tag(okCount)} catalog-count: ${costNodeCount} COST rows == ${configRecurringCount} config recurring lines`);
    if (!(okKnown && okFloor && okEst && okCount && okCapex)) {
      failed++;
      console.log(`  ⚠️  DELTA — known Δ=$${(a.knownMonthly - anchor.knownMonthly).toFixed(4)} · floor Δ=$${(a.floorMonthly - anchor.floorMonthly).toFixed(4)} · est Δ=$${(a.estimatedMonthly - anchor.estimatedMonthly).toFixed(4)}`);
    }
  }
  console.log(`\n=== ${failed === 0 ? '✓ GATE PASSED — backfill is lossless, safe to flip (step 6)' : '✗ GATE FAILED — DO NOT FLIP, diagnose the delta'} ===\n`);
  process.exit(failed ? 1 : 0);
}
main();
