// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      Seed a FULL business_pricing_config row at business creation.
// DEPENDENCIES: EMPTY_COST_CONFIG (./CostToProduce), a SupabaseClient.
// OUTPUTS:      seedPricingConfig(supabase, businessId)
//
// 🔴 THE DEFECT THIS CLOSES IS NOT THE TAX RATE — IT IS THE MISSING ROW.
// A fresh tenant had NO `business_pricing_config` row AT ALL until somebody typed into Settings.
// `mergePricingConfig` reads-then-writes and is only reached from that one form, and nothing at
// signup or onboarding created the row. So `get_business_tax_rate` had nothing to read — and so
// did every OTHER consumer of that config: the margin baseline, the tier overrides, the reference
// price, the denominators, the cost structure. The tax rate is the VISIBLE symptom because it
// renders a redline on the checkout screen; the rest simply behaved as though the business had
// never been configured, silently.
//
// ⚠️ taxRate SEEDS AS NULL, DELIBERATELY (David's ruling 2026-07-27). Do NOT hardcode a default.
// A WRONG RATE IS WORSE THAN NO RATE — it is money, computed confidently, on an invoice that goes
// to a customer. That is `resolveTaxRate`'s own argument: it already refuses to fabricate a rate
// and returns null so `computeOrderPricing` can render 'not_identified' with the redline. Seeding
// 0.0825 "because Texas" would make every tenant silently agree with a guess. Until the owner
// answers, the redline IS the correct state.
//
// The onboarding wizard asks for the rate, so "not identified" is a question that gets asked
// rather than a hole someone discovers at checkout.
import type { SupabaseClient } from '@supabase/supabase-js';
import { EMPTY_COST_CONFIG } from './CostToProduce';

export async function seedPricingConfig(
  supabase: SupabaseClient,
  businessId: string,
): Promise<{ error: { message: string } | null }> {
  // The WHOLE shape, not just the one key — a partial config is the same defect one field down.
  // taxRate is added explicitly as null so the key EXISTS and reads as "asked and unanswered"
  // rather than "never modelled". `?` on the jsonb finds it; `->>` gives null. That distinction is
  // what lets a future surface tell "no rate set" from "no config at all".
  const config = { ...EMPTY_COST_CONFIG, taxRate: null };

  // onConflict: a re-run must never CLOBBER a configured tenant. Seeding is a create-if-absent
  // act; ignoreDuplicates keeps it idempotent and keeps it out of the way of the real writers
  // (mergePricingConfig, set_business_tax_rate).
  const { error } = await supabase
    .from('business_pricing_config')
    .upsert({ business_id: businessId, config }, { onConflict: 'business_id', ignoreDuplicates: true });

  return { error: error ? { message: error.message } : null };
}
