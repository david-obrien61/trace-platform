/**
 * capture-cost-before.ts — Unified Cost Model, BUILD step 0: the BEFORE-NUMBER anchor.
 *
 * Trust-but-verify gate for the staged migration. Reads the LIVE production state and
 * runs the REAL shared engine (not a re-implementation) EXACTLY as the /costs tile does
 * (CostToProduce.tsx): business_modules.config + business_inventory UNKNOWN-fold +
 * cost_objects → fromCostObject → rollupEvents → analyze(cfg, unknownInv, {rollupEvents}).
 *
 * It prints + snapshots floorMonthly / estimatedMonthly / knownMonthly / unknownCount per
 * tenant. Run it:
 *   • BEFORE the fromCostObject shape change (step 0) → records the anchor.
 *   • AFTER  the fromCostObject shape change (step 3) → must be BYTE-IDENTICAL (no data
 *     moved, migration not applied → no row carries cost_shape → CAPEX branch → same number).
 *
 * Bundle + run (mirrors verify-cost-to-produce.ts):
 *   node_modules/.bin/esbuild scripts/capture-cost-before.ts --bundle --platform=node \
 *     --format=cjs --external:'@supabase/supabase-js' | node
 *
 * Requires packages/cultivar-os/.env.local (SUPABASE_URL + SUPABASE_SERVICE_KEY). Read-only
 * (SELECT only) — service key is used purely to bypass RLS so ALL tenants are captured.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { analyze } from '../packages/shared/src/business-logic/CostToProduce';
import type { CostToProduceConfig } from '../packages/shared/src/business-logic/CostToProduce';
import { fromCostObject } from '../packages/shared/src/business-logic/CountOnceSeam';
import type { CostEvent, CostObjectNodeRow } from '../packages/shared/src/business-logic/CountOnceSeam';

const repoRoot = process.cwd(); // invoke from repo root
const env = Object.fromEntries(
  readFileSync(join(repoRoot, 'packages/cultivar-os/.env.local'), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY in .env.local'); process.exit(1); }

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const MODULE_KEY = 'cost_to_produce';

async function main() {
  // All tenants that have a cost_to_produce config (the rows the tile reads).
  const { data: mods, error: modErr } = await sb
    .from('business_modules').select('business_id, config').eq('module_key', MODULE_KEY);
  if (modErr) { console.error('business_modules read failed:', modErr.message); process.exit(1); }

  const snapshot: any[] = [];
  for (const m of mods ?? []) {
    const businessId = (m as any).business_id as string;
    const cfg = (m as any).config as CostToProduceConfig | undefined;
    if (!cfg || !Array.isArray(cfg.locations) || !cfg.locations.length) continue;

    // Inventory UNKNOWN-fold (mirrors the page).
    const { data: invRows } = await sb
      .from('business_inventory').select('name, unit_cost, cost_confidence').eq('business_id', businessId);
    const unknownInv = (invRows ?? [])
      .filter((r: any) => (r.cost_confidence ?? '').toUpperCase() === 'UNKNOWN' || r.unit_cost == null)
      .map((r: any) => `Inventory: ${r.name}`);

    // cost_objects → rollupEvents (mirrors the page select EXACTLY — no cost_shape selected
    // yet, so fromCostObject's recurring branch is dormant; everything is CAPEX → excluded).
    let rollupEvents: CostEvent[] = [];
    const { data: objs, error: objErr } = await sb
      .from('cost_objects').select('id,name,node_type,domain,acquisition_cost,cost_confidence,status')
      .eq('business_id', businessId);
    if (!objErr && Array.isArray(objs) && objs.length) {
      rollupEvents = (objs as Array<Record<string, unknown>>).flatMap((r) => fromCostObject({
        id: String(r.id),
        label: String(r.name ?? 'Unnamed cost object'),
        node_type: (r.node_type as CostObjectNodeRow['node_type']) ?? 'ASSET',
        domain: (r.domain as string | null) ?? null,
        acquisition_cost: (r.acquisition_cost as number | null) ?? null,
        cost_confidence: (r.cost_confidence as CostObjectNodeRow['cost_confidence']) ?? 'UNKNOWN',
        status: (r.status as string | null) ?? null,
      }));
    }

    const result = analyze(cfg, unknownInv, { rollupEvents });
    const row = {
      businessId,
      unitLabel: result.unitLabel,
      floorMonthly: result.confidence.floorMonthly,
      estimatedMonthly: result.confidence.estimatedMonthly,
      knownMonthly: result.confidence.knownMonthly,
      unknownCount: result.confidence.unknownCount,
      computable: result.confidence.computable,
      fedFromRollup: result.confidence.fedFromRollup ?? false,
      capexExcluded: result.confidence.capexExcluded ?? 0,
      costObjects: objErr ? `unavailable(${objErr.code ?? 'err'})` : (objs?.length ?? 0),
      sensitivity: result.sensitivity.map((s) => ({ n: s.n, costFloor: s.costFloor, costKnown: s.costKnown, priceFloor: s.priceFloor, priceKnown: s.priceKnown })),
    };
    snapshot.push(row);
    console.log(`\n── tenant ${businessId} (${row.unitLabel}) ──`);
    console.log(`  floor=$${row.floorMonthly.toFixed(2)}/mo  estimated=$${row.estimatedMonthly.toFixed(2)}/mo  KNOWN=$${row.knownMonthly.toFixed(2)}/mo  unknown=${row.unknownCount}  capexExcluded=$${row.capexExcluded.toFixed(2)}  costObjects=${row.costObjects}`);
  }

  const outDir = join(repoRoot, 'docs/cost-to-produce');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, 'BEFORE-NUMBER-snapshot.json');
  writeFileSync(outFile, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`\n✓ captured ${snapshot.length} tenant(s) → ${outFile}`);
  console.log('  Re-run AFTER the fromCostObject change; diff this file — it MUST be identical.');
}
main();
