/**
 * verify-model-b-split.ts — D-16 Model B price-split proof (read-only, service-key).
 *
 * Mirrors the /costs page EXACTLY (business_modules.config + business_inventory UNKNOWN-fold +
 * cost_objects → fromCostObject → rollupEvents → analyze), now SELECTING recovery_basis and
 * threading it into fromCostObject. Proves:
 *   (a) the sensitivity table now divides ONLY the COST_TO_SERVE pool by N (Model B);
 *   (b) the payback line surfaces PLATFORM_INVESTMENT monthly separately;
 *   (c) costToServe + investment reconciles to the OLD known-monthly ($12,930.67);
 *   (d) the honest-totals block (floor/known/capex) is UNCHANGED.
 *
 * Bundle + run from repo root:
 *   node_modules/.bin/esbuild scripts/verify-model-b-split.ts --bundle --platform=node \
 *     --format=cjs --external:'@supabase/supabase-js' | node
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { analyze, EMPTY_COST_CONFIG } from '../packages/shared/src/business-logic/CostToProduce';
import type { CostToProduceConfig } from '../packages/shared/src/business-logic/CostToProduce';
import { fromCostObject } from '../packages/shared/src/business-logic/CountOnceSeam';
import type { CostEvent, CostObjectNodeRow } from '../packages/shared/src/business-logic/CountOnceSeam';

const env = Object.fromEntries(
  readFileSync(join(process.cwd(), 'packages/cultivar-os/.env.local'), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
const BID = '45830ba7-9961-403f-b048-77f022fb48dc';
const round2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const { data: mod } = await sb.from('business_modules').select('config')
    .eq('business_id', BID).eq('module_key', 'cost_to_produce').maybeSingle();
  const cfg = (mod?.config as CostToProduceConfig | undefined) ?? null;

  const { data: invRows } = await sb.from('business_inventory')
    .select('name, unit_cost, cost_confidence').eq('business_id', BID);
  const unknownInv = (invRows ?? [])
    .filter((r: any) => (r.cost_confidence ?? '').toUpperCase() === 'UNKNOWN' || r.unit_cost == null)
    .map((r: any) => `Inventory: ${r.name}`);

  const { data: objs } = await sb.from('cost_objects')
    .select('id,name,node_type,domain,acquisition_cost,cost_confidence,status,cost_shape,cadence,recurring_amount,cost_category,receipt_id,recovery_basis')
    .eq('business_id', BID);

  const rows = (objs ?? []) as any[];
  const rollupEvents: CostEvent[] = rows
    .filter((r) => r.node_type === 'ASSET' || r.node_type === 'COST')
    .flatMap((r) => fromCostObject({
      id: String(r.id), label: String(r.name ?? 'Unnamed'),
      node_type: r.node_type, domain: r.domain ?? null,
      acquisition_cost: r.acquisition_cost ?? null, cost_confidence: r.cost_confidence ?? 'UNKNOWN',
      status: r.status ?? null, cost_shape: r.cost_shape ?? null, cadence: r.cadence ?? null,
      recurring_amount: r.recurring_amount ?? null, receipt_id: r.receipt_id ?? null,
      recovery_basis: r.recovery_basis ?? null,
    } as CostObjectNodeRow));

  const hasMigratedRecurring = rows.some((r) => r.node_type === 'COST');
  const hasMigratedLabor = rows.some((r) => r.node_type === 'COST' && (r.cost_category === 'labor' || r.cost_category === 'contract-labor'));
  const baseCfg = cfg ?? EMPTY_COST_CONFIG;
  const pricingCfg: CostToProduceConfig = {
    ...baseCfg,
    locations: baseCfg.locations.map((l) => ({
      ...l,
      recurring: hasMigratedRecurring ? [] : l.recurring,
      labor: hasMigratedLabor ? { ...l.labor, rate: null, hours: null } : l.labor,
    })),
  };

  const res = analyze(pricingCfg, unknownInv, { rollupEvents });
  const c = res.confidence;

  console.log('\n=== HONEST-TOTALS BLOCK (must be UNCHANGED) ===');
  console.log('floorMonthly    ', c.floorMonthly, '(anchor 11323)');
  console.log('estimatedMonthly', c.estimatedMonthly, '(anchor 1607.67)');
  console.log('knownMonthly    ', c.knownMonthly, '(anchor 12930.67)');
  console.log('capexExcluded   ', c.capexExcluded, '(anchor 6917.31)');
  console.log('unknownCount    ', c.unknownCount, '(anchor 2)');

  console.log('\n=== MODEL B SPLIT ===');
  console.log('costToServeMonthly       ', res.costToServeMonthly, '(expected ~1730.67)');
  console.log('platformInvestmentMonthly', res.platformInvestmentMonthly, '(expected 11200)');
  const sum = round2(res.costToServeMonthly + res.platformInvestmentMonthly);
  console.log('RECONCILE cts+inv =', sum, '=== knownMonthly', c.knownMonthly, '?', sum === c.knownMonthly ? 'YES ✓' : 'NO ✗');

  // Model A (old): divide WHOLE knownMonthly by N. Model B (new): res.sensitivity.
  console.log('\n=== PRICE TABLE: Model A (old, ÷ whole floor) vs Model B (new, ÷ cost-to-serve) ===');
  const mult = 1 / (1 - (pricingCfg.margin?.baseline ?? 0.4));
  for (const s of res.sensitivity) {
    const modelA_priceKnown = round2((c.knownMonthly / s.n) * mult);
    console.log(`N=${String(s.n).padStart(4)} | A priceKnown ~$${modelA_priceKnown.toFixed(2)} | B priceFloor $${s.priceFloor.toFixed(2)} priceKnown $${s.priceKnown.toFixed(2)} | contribution/mo $${s.contributionMonthly.toFixed(2)}`);
  }
  console.log('\n(Model A figures are illustrative recomputations of the OLD behavior for comparison.)');
}
main();
