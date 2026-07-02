/**
 * capture-cost-before.ts — Unified Cost Model cost-tile MIRROR.
 *   • Step 0 produced the locked BEFORE-NUMBER anchor (docs/.../BEFORE-NUMBER-snapshot.json).
 *   • Step 6 (FLIPPED): now mirrors the post-flip /costs tile (selects shape columns, feeds
 *     migrated COST rows as the pool, strips config.recurring when migrated) and writes
 *     AFTER-FLIP-snapshot.json, asserting the live KNOWN total == the locked anchor.
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

    // cost_objects → rollupEvents. STEP 6 FLIP (2026-06-17): mirrors the FLIPPED page —
    // selects the shape columns so RECURRING_FIXED COST rows feed the monthly pool, and
    // strips config.recurring once migrated COST rows exist (R1-safe guard).
    let rollupEvents: CostEvent[] = [];
    let hasMigratedRecurring = false;
    let hasMigratedLabor = false;
    const { data: objs, error: objErr } = await sb
      .from('cost_objects').select('id,name,node_type,domain,acquisition_cost,cost_confidence,status,cost_shape,cadence,recurring_amount,cost_category')
      .eq('business_id', businessId);
    if (!objErr && Array.isArray(objs) && objs.length) {
      rollupEvents = (objs as Array<Record<string, unknown>>)
        // Match the live read path (CostToProduce.tsx): PROJECT/PRODUCT rows are buckets, not costs.
        .filter((r) => r.node_type === 'ASSET' || r.node_type === 'COST')
        .flatMap((r) => fromCostObject({
          id: String(r.id),
          label: String(r.name ?? 'Unnamed cost object'),
          node_type: (r.node_type as CostObjectNodeRow['node_type']) ?? 'ASSET',
          domain: (r.domain as string | null) ?? null,
          acquisition_cost: (r.acquisition_cost as number | null) ?? null,
          cost_confidence: (r.cost_confidence as CostObjectNodeRow['cost_confidence']) ?? 'UNKNOWN',
          status: (r.status as string | null) ?? null,
          cost_shape: (r.cost_shape as CostObjectNodeRow['cost_shape']) ?? null,
          cadence: (r.cadence as CostObjectNodeRow['cadence']) ?? null,
          recurring_amount: (r.recurring_amount as number | null) ?? null,
        }));
      hasMigratedRecurring = (objs as Array<Record<string, unknown>>).some((r) => r.node_type === 'COST');
      // D-12 STEP 3 GUARD — MUST mirror CostToProduce.tsx exactly, or the byte-identical proof reads
      // the double-count and FALSE-passes. Strip config.labor iff a COST row tagged cost_category
      // 'labor'|'contract-labor' (exact lowercase) exists. R1-safe (un-migrated tenant keeps config.labor).
      hasMigratedLabor = (objs as Array<Record<string, unknown>>).some(
        (r) => r.node_type === 'COST' && (r.cost_category === 'labor' || r.cost_category === 'contract-labor'));
    }

    // Margin/denominators stay in config (R3). recurring dropped once cost_objects supplies it;
    // config.labor dropped once a labor cost_object exists — exactly one source per pool input.
    const pricingCfg = {
      ...cfg,
      locations: (cfg.locations ?? []).map((l) => ({
        ...l,
        recurring: hasMigratedRecurring ? [] : l.recurring,
        labor: hasMigratedLabor ? { ...l.labor, rate: null, hours: null } : l.labor,
      })),
    };
    const result = analyze(pricingCfg, unknownInv, { rollupEvents });
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
  // Diagnostic OUTPUT goes to a gitignored scratch dir so re-running this script can NEVER
  // clobber the committed proof anchors (BEFORE-NUMBER / AFTER-FLIP). Anchor READS still come
  // from outDir (the committed, locked files); only WRITES are redirected here.
  const scratchDir = join(outDir, '.scratch');
  mkdirSync(scratchDir, { recursive: true });

  // D-12 STEP 3 labor-stage modes (do NOT touch the unified-model BEFORE/AFTER-FLIP snapshots):
  //   LABOR_STAGE=3a → record the guard-DORMANT baseline (no labor row seeded yet).
  //   LABOR_STAGE=3b → compare the guard-ACTIVE result (labor seeded) to the 3a baseline; floor AND
  //                    known must be byte-identical (the guard prevented the R2 double-count).
  const stage = process.env.LABOR_STAGE;
  if (stage === '3a' || stage === '3b') {
    const baseFile  = join(scratchDir, 'LABOR-3a-snapshot.json');
    const stageFile = join(scratchDir, `LABOR-${stage}-snapshot.json`);
    writeFileSync(stageFile, JSON.stringify(snapshot, null, 2) + '\n');
    if (stage === '3a') {
      console.log(`\n✓ STEP 3a baseline recorded (labor guard DORMANT — no labor cost_object) → ${stageFile}`);
      process.exit(0);
    }
    const base: any[] = JSON.parse(readFileSync(baseFile, 'utf8'));
    let failed = 0;
    for (const row of snapshot) {
      const a = base.find((x) => x.businessId === row.businessId);
      const ok = a && Math.abs(a.floorMonthly - row.floorMonthly) < 0.005 && Math.abs(a.knownMonthly - row.knownMonthly) < 0.005;
      if (!ok) failed++;
      console.log(`  ${ok ? '✅' : '❌'} ${row.businessId}: 3b floor=$${row.floorMonthly.toFixed(2)} known=$${row.knownMonthly.toFixed(2)} vs 3a floor=$${a?.floorMonthly?.toFixed?.(2)} known=$${a?.knownMonthly?.toFixed?.(2)}`);
    }
    console.log(`\n${failed === 0 ? '✓ 3b == 3a — labor migrated byte-identical; guard prevented the double-count' : '✗ MISMATCH — labor double-counted or guard failed; STOP'} → ${stageFile}`);
    process.exit(failed ? 1 : 0);
  }

  // Legacy unified-model behavior (LABOR_STAGE unset): AFTER-FLIP vs locked BEFORE-NUMBER.
  const afterFile = join(scratchDir, 'AFTER-FLIP-snapshot.json');
  writeFileSync(afterFile, JSON.stringify(snapshot, null, 2) + '\n');
  // Read the LOCKED, committed anchor from outDir — never from scratch.
  const anchor: any[] = JSON.parse(readFileSync(join(outDir, 'BEFORE-NUMBER-snapshot.json'), 'utf8'));
  let failed = 0;
  for (const row of snapshot) {
    const a = anchor.find((x) => x.businessId === row.businessId);
    const ok = a && Math.abs(a.knownMonthly - row.knownMonthly) < 0.005;
    if (!ok) failed++;
    console.log(`  ${ok ? '✅' : '❌'} ${row.businessId}: live KNOWN $${row.knownMonthly.toFixed(2)}/mo vs anchor $${(a?.knownMonthly ?? NaN).toFixed?.(2)}/mo`);
  }
  console.log(`\n${failed === 0 ? '✓ LIVE POST-FLIP TILE MATCHES the locked before-number' : '✗ MISMATCH — do not proceed'} → ${afterFile}`);
  process.exit(failed ? 1 : 0);
}
main();
