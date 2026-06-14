/**
 * Verification harness for the Cost-to-Produce engine.
 * Runs the REAL shared engine (not a re-implementation) against the exact TRACE
 * tenant-zero seed config and prints the numbers the tile will produce.
 * Bundle + run:  npx esbuild scripts/verify-cost-to-produce.ts --bundle --platform=node --format=esm | node --input-type=module
 */
import { analyze } from '../packages/shared/src/business-logic/CostToProduce';
import type { CostToProduceConfig } from '../packages/shared/src/business-logic/CostToProduce';

// EXACT seed JSON that goes into business_modules.config (mirrors the seed migration).
const TRACE_SEED: CostToProduceConfig = {
  version: 1,
  unitLabel: 'customer-month',
  denominators: [1, 5, 20, 100],
  margin: {
    baseline: 0.4,
    tiers: [
      { name: 'walk-in', marginOverride: 0.4, isDefault: true },
      { name: 'friends-family', marginOverride: 0.2 },
      { name: 'contractor', marginOverride: 0.3 },
    ],
  },
  priceReference: 149,
  locations: [
    {
      id: 'base',
      name: 'TRACE (base)',
      kind: 'base',
      overheadPerUnit: 0,
      labor: { rate: 75, hours: 0, period: 'monthly', confidence: 'CONFIRMED' },
      recurring: [
        { label: 'Claude Pro (incl. Claude Code)', amount: 17, period: 'monthly', confidence: 'CONFIRMED', note: 'may be Pro Max ~$100 — David verify' },
        { label: 'Gemini Advanced', amount: 20, period: 'monthly', confidence: 'CONFIRMED' },
        { label: 'TX sales tax on AI subs', amount: 3, period: 'monthly', confidence: 'DERIVED' },
        { label: 'Infrastructure (Vercel/Supabase/GitHub)', amount: 0, period: 'monthly', confidence: 'CONFIRMED', note: 'free tier' },
        { label: 'CoolRunnings hardware', amount: null, period: 'monthly', confidence: 'UNKNOWN' },
        { label: 'Claude API usage', amount: null, period: 'monthly', confidence: 'UNKNOWN' },
        { label: '6 domains (GoDaddy)', amount: null, period: 'annual', confidence: 'UNKNOWN' },
        { label: 'Blotato', amount: null, period: 'monthly', confidence: 'UNKNOWN' },
        { label: 'Resend', amount: null, period: 'monthly', confidence: 'UNKNOWN' },
        { label: 'Twilio', amount: null, period: 'monthly', confidence: 'UNKNOWN' },
      ],
    },
  ],
};

function run(label: string, cfg: CostToProduceConfig) {
  const r = analyze(cfg);
  console.log(`\n=== ${label} ===`);
  console.log(`unit: ${r.unitLabel} · baseline margin: ${(r.baselineMargin * 100).toFixed(0)}% · price ref: $${r.priceReference}`);
  console.log(`floor (confirmed+derived): $${r.confidence.floorMonthly.toFixed(2)}/mo · estimated: $${r.confidence.estimatedMonthly.toFixed(2)}/mo · known: $${r.confidence.knownMonthly.toFixed(2)}/mo`);
  console.log(`UNKNOWN (count=${r.confidence.unknownCount}, never zeroed): ${r.confidence.unknownLabels.join(', ')}`);
  console.log(`computable: ${r.confidence.computable}`);
  console.log('N\tcost/unit (floor→known)\tsuggested price (floor→known)\trealized margin');
  for (const s of r.sensitivity) {
    console.log(`${s.n}\t$${s.costFloor.toFixed(2)} → $${s.costKnown.toFixed(2)}\t\t$${s.priceFloor.toFixed(2)} → $${s.priceKnown.toFixed(2)}\t\t${s.marginPct}%`);
  }
}

run('TRACE tenant-zero (labor hours = 0, the seed default)', TRACE_SEED);

// Tune-loop proof: David sets labor to 10 hr/mo and N changes → recompute.
const tuned: CostToProduceConfig = JSON.parse(JSON.stringify(TRACE_SEED));
tuned.locations[0].labor.hours = 10;
run('After tune: labor 75/hr × 10 hr/mo', tuned);

// Honesty proof: all-unknown config must NOT compute a fake $0 price.
const allUnknown: CostToProduceConfig = {
  ...TRACE_SEED,
  locations: [{ ...TRACE_SEED.locations[0], recurring: TRACE_SEED.locations[0].recurring.filter((l) => l.confidence === 'UNKNOWN'), labor: { rate: null, hours: null, period: 'monthly', confidence: 'UNKNOWN' } }],
};
run('All-unknown (must be non-computable, no fake $0 price)', allUnknown);
