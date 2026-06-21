import type { SupabaseClient } from '@supabase/supabase-js';
import type { BusinessDiscoveryProfile, SuggestedOffering } from './types';

const VALID_CATEGORIES = new Set(['transport', 'addon', 'maintenance', 'inspection', 'subscription']);
const VALID_PRICE_UNITS = new Set(['order', 'plant', 'vehicle', 'visit']);

/**
 * classifyCategory — D-9 honesty (replaces the old silent unknown→'addon' coercion).
 *
 * The previous toCategory() mapped any unrecognized category to 'addon' — a quiet
 * LIE: it asserted a thing was an add-on when we had no idea what it was. D-9:
 * surface uncertainty, never coerce it into a confident-looking value. Unknown
 * categories are now tagged 'uncategorized' (a value that makes no claim) and
 * flagged so the owner reviews them — never silently filed as 'addon'.
 */
export function classifyCategory(raw: string | null | undefined): { category: string; flagged: boolean; reason: string | null } {
  const v = (raw ?? '').toString().trim().toLowerCase();
  if (VALID_CATEGORIES.has(v)) return { category: v, flagged: false, reason: null };
  return {
    category: 'uncategorized',
    flagged: true,
    reason: `category "${raw ?? '(none)'}" not recognized — assign one before activating`,
  };
}

function toPriceUnit(raw: string): string {
  return VALID_PRICE_UNITS.has(raw) ? raw : 'order';
}

/**
 * Maps suggestedOfferings from a BusinessDiscoveryProfile into service_offerings rows.
 * Inserted with is_active=false — owner reviews and activates.
 * Idempotent: skips any offering whose name already exists for this business.
 *
 * D-9 honesty:
 *   - Unknown category → 'uncategorized' + a flag in service_note (never silent 'addon').
 *   - Price is UNKNOWN at seed time (the site states none). service_offerings.price is
 *     NOT NULL, so the row carries 0 strictly as a NON-NULL PLACEHOLDER and is flagged
 *     "price not set" in service_note + held is_active=false — so 0 can never read as a
 *     real "free" price or be sold. (A fully-null price + price_confidence column is the
 *     clean fix; it needs an ALTER on service_offerings, deferred here to keep this
 *     migration's byte-identical discipline — see handoff residual.)
 *
 * Does NOT require discovery persistence tables — call immediately after runAnalysis
 * while the profile is in memory.
 */
export async function seedServiceOfferings(
  profile: BusinessDiscoveryProfile,
  businessId: string,
  supabase: SupabaseClient,
): Promise<{ seeded: number; flagged: number }> {
  if (!profile.suggestedOfferings?.length) return { seeded: 0, flagged: 0 };

  const { data: existing } = await supabase
    .from('service_offerings')
    .select('name')
    .eq('business_id', businessId);

  const existingNames = new Set(
    (existing ?? []).map((r: { name: string }) => r.name.toLowerCase()),
  );

  const rows = profile.suggestedOfferings
    .filter((o: SuggestedOffering) => !existingNames.has(o.name.toLowerCase()))
    .map((o: SuggestedOffering, i: number) => {
      const cat = classifyCategory(o.category);
      // Price is unknown for a suggested offering — flag it; never let 0 read as "free".
      const noteParts = ['Suggested by discovery — price not set; confirm before activating'];
      if (cat.flagged && cat.reason) noteParts.push(cat.reason);
      return {
        business_id: businessId,
        name:        o.name,
        description: o.description ?? null,
        category:    cat.category,
        price_type:  o.price_type ?? 'flat',
        price_unit:  toPriceUnit(o.price_unit),
        price:       0,                         // NON-NULL placeholder only (column is NOT NULL); flagged unset below
        is_active:   false,
        sort_order:  i,
        service_note: noteParts.join(' · '),
      };
    });

  if (!rows.length) return { seeded: 0, flagged: 0 };

  const { error } = await supabase.from('service_offerings').insert(rows);

  if (error) throw new Error(`seedServiceOfferings: ${error.message}`);

  return { seeded: rows.length, flagged: rows.filter(r => r.category === 'uncategorized').length };
}
