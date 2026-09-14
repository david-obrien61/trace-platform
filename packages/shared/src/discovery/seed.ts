import type { SupabaseClient } from '@supabase/supabase-js';
import type { BusinessDiscoveryProfile, SuggestedOffering } from './types';
// R-120 — a transport service must say who transports; ONE rule, shared with every other writer.
import { transportBindingError } from '../business-logic/serviceOfferingShape';
// ONE price-unit rule, shared with the database constraint and the books review (§6 r8).
import { normalisePriceUnit } from '../business-logic/serviceOfferingEnums';

const VALID_CATEGORIES = new Set(['transport', 'addon', 'maintenance', 'inspection', 'subscription']);

/**
 * classifyCategory — D-9 honesty (replaces the old silent unknown→'addon' coercion).
 *
 * The previous toCategory() mapped any unrecognized category to 'addon' — a quiet
 * LIE: it asserted a thing was an add-on when we had no idea what it was. D-9:
 * surface uncertainty, never coerce it into a confident-looking value. Unknown
 * categories are now tagged 'uncategorized' (a value that makes no claim) and
 * flagged so the owner reviews them — never silently filed as 'addon'.
 *
 * ⚠️ 'uncategorized' IS NOT A VALUE THE DATABASE ACCEPTS (tech-debt #217). A flagged result is
 * therefore never WRITTEN — `seedServiceOfferings` holds the row back and reports it.
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

/**
 * classifyPriceUnit — D-9 honesty, and the SECOND silent coercion removed from this file.
 *
 * 🔴 `classifyCategory` above was written to replace a silent unknown→'addon' mapping. The
 * IDENTICAL defect sat four lines beneath it until 2026-09-14: `toPriceUnit` returned `'order'`
 * for any unit it did not recognise, against a hardcoded set of four. So a vertical's own unit
 * — 'household', 'bag' — was not rejected, it was **quietly rewritten to a different, plausible,
 * wrong one**, and every screen downstream then showed a confident "once per order".
 *
 * ⚠️ AND THE SET IT CHECKED AGAINST WAS THE PROBLEM, NOT THE FALLBACK. The column itself now
 * accepts any lowercase identifier (`20260914_price_unit_shape_not_enum.sql`), so the only
 * question left is whether the value is SHAPED like a unit — which is what this asks.
 *
 * Unknown-but-well-shaped is now simply WRITTEN: that is a vertical supplying its own vocabulary,
 * which is the entire point (AC-1). Only an unusable value is held back and reported.
 */
export function classifyPriceUnit(raw: string | null | undefined): { priceUnit: string | null; flagged: boolean; reason: string | null } {
  const v = normalisePriceUnit(raw);
  if (v) return { priceUnit: v, flagged: false, reason: null };
  return {
    priceUnit: null,
    flagged: true,
    reason: `price unit "${raw ?? '(none)'}" is not usable — it must be a short lowercase word such as order, visit or household`,
  };
}

/** A suggested offering this seed would NOT write, and why. Reported, never dropped silently. */
export interface HeldOffering { name: string; reason: string }

/**
 * Maps suggestedOfferings from a BusinessDiscoveryProfile into service_offerings rows.
 * Inserted with is_active=false — owner reviews and activates.
 * Idempotent: skips any offering whose name already exists for this business.
 *
 * D-9 honesty:
 *   - Price is UNKNOWN at seed time (the site states none). service_offerings.price is
 *     NOT NULL, so the row carries 0 strictly as a NON-NULL PLACEHOLDER and is flagged
 *     "price not set" in service_note + held is_active=false — so 0 can never read as a
 *     real "free" price or be sold. (A fully-null price + price_confidence column is the
 *     clean fix; it needs an ALTER on service_offerings, deferred here to keep this
 *     migration's byte-identical discipline — see handoff residual.)
 *
 * 🔴 A ROW THE DATABASE WOULD REFUSE IS HELD BACK AND REPORTED, NEVER SENT (tech-debt #217, R-120).
 * The insert is ONE array, so one refused row used to lose EVERY offering discovery found — and the
 * only caller logs that as "seed (non-fatal)". Two shapes are held back, each with its reason in `held`:
 *   · an unrecognised category — 'uncategorized' is not in the CHECK (#217);
 *   · a TRANSPORT suggestion — a suggestion carries no transport_mode (`SuggestedOffering` has no such
 *     field), and 'self' versus 'staff' is a fact about the business nobody can infer (R-120). Writing
 *     it would put a transport row on the menu that checkout can never offer.
 *
 * Does NOT require discovery persistence tables — call immediately after runAnalysis
 * while the profile is in memory.
 */
export async function seedServiceOfferings(
  profile: BusinessDiscoveryProfile,
  businessId: string,
  supabase: SupabaseClient,
): Promise<{ seeded: number; flagged: number; held: HeldOffering[] }> {
  if (!profile.suggestedOfferings?.length) return { seeded: 0, flagged: 0, held: [] };

  const { data: existing } = await supabase
    .from('service_offerings')
    .select('name')
    .eq('business_id', businessId);

  const existingNames = new Set(
    (existing ?? []).map((r: { name: string }) => r.name.toLowerCase()),
  );

  const held: HeldOffering[] = [];
  const rows: Record<string, unknown>[] = [];
  const fresh = profile.suggestedOfferings.filter((o: SuggestedOffering) => !existingNames.has(o.name.toLowerCase()));

  for (const o of fresh) {
    const cat = classifyCategory(o.category);
    if (cat.flagged) { held.push({ name: o.name, reason: cat.reason ?? 'category not recognized' }); continue; }
    // A suggestion states no mode, so a transport suggestion cannot be written (R-120).
    const bind = transportBindingError(cat.category, null);
    if (bind) { held.push({ name: o.name, reason: bind }); continue; }
    // Held back, never coerced — the column is NOT NULL and a guessed unit is a wrong one (D-9).
    const unit = classifyPriceUnit(o.price_unit);
    if (unit.flagged || !unit.priceUnit) {
      held.push({ name: o.name, reason: unit.reason ?? 'price unit not usable' });
      continue;
    }
    rows.push({
      business_id: businessId,
      name:        o.name,
      description: o.description ?? null,
      category:    cat.category,
      price_type:  o.price_type ?? 'flat',
      price_unit:  unit.priceUnit,
      price:       0,                         // NON-NULL placeholder only (column is NOT NULL); flagged unset below
      is_active:   false,
      sort_order:  rows.length,
      // Price is unknown for a suggested offering — flag it; never let 0 read as "free".
      service_note: 'Suggested by discovery — price not set; confirm before activating',
    });
  }

  if (held.length > 0) {
    console.log('[TRACE:SERVICE] discovery seed held back', { businessId, held });
  }
  if (!rows.length) return { seeded: 0, flagged: held.length, held };

  const { error } = await supabase.from('service_offerings').insert(rows);

  if (error) throw new Error(`seedServiceOfferings: ${error.message}`);

  return { seeded: rows.length, flagged: held.length, held };
}
