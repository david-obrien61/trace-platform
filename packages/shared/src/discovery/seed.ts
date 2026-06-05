import type { SupabaseClient } from '@supabase/supabase-js';
import type { BusinessDiscoveryProfile, SuggestedOffering } from './types';

const VALID_CATEGORIES = new Set(['transport', 'addon', 'maintenance', 'inspection', 'subscription']);
const VALID_PRICE_UNITS = new Set(['order', 'plant', 'vehicle', 'visit']);

function toCategory(raw: string): string {
  return VALID_CATEGORIES.has(raw) ? raw : 'addon';
}

function toPriceUnit(raw: string): string {
  return VALID_PRICE_UNITS.has(raw) ? raw : 'order';
}

/**
 * Maps suggestedOfferings from a BusinessDiscoveryProfile into service_offerings rows.
 * Inserted with is_active=false — owner reviews and activates.
 * Idempotent: skips any offering whose name already exists for this business.
 *
 * Does NOT require discovery persistence tables — call immediately after runAnalysis
 * while the profile is in memory.
 */
export async function seedServiceOfferings(
  profile: BusinessDiscoveryProfile,
  businessId: string,
  supabase: SupabaseClient,
): Promise<{ seeded: number }> {
  if (!profile.suggestedOfferings?.length) return { seeded: 0 };

  const { data: existing } = await supabase
    .from('service_offerings')
    .select('name')
    .eq('business_id', businessId);

  const existingNames = new Set(
    (existing ?? []).map((r: { name: string }) => r.name.toLowerCase()),
  );

  const rows = profile.suggestedOfferings
    .filter((o: SuggestedOffering) => !existingNames.has(o.name.toLowerCase()))
    .map((o: SuggestedOffering, i: number) => ({
      business_id: businessId,
      name:        o.name,
      description: o.description ?? null,
      category:    toCategory(o.category),
      price_type:  o.price_type ?? 'flat',
      price_unit:  toPriceUnit(o.price_unit),
      price:       0,
      is_active:   false,
      sort_order:  i,
    }));

  if (!rows.length) return { seeded: 0 };

  const { error } = await supabase.from('service_offerings').insert(rows);

  if (error) throw new Error(`seedServiceOfferings: ${error.message}`);

  return { seeded: rows.length };
}
