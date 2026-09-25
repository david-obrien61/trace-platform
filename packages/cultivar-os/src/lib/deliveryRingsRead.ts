// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      Read what a ring price needs — the yard and the active rings — in ONE place.
// DEPENDENCIES: lib/supabase · shared/business-logic/deliveryRings (the column lists + types).
// OUTPUTS:      readRingInputs().
//
// 🔴 A READ, NOT A DECISION. It returns what the database holds; `tripChargeFor` decides the
// money, and `api/orders/submit` decides it again server-side over its own read. Nothing here
// prices anything.
//
// 🔴 WHY IT IS A MODULE AND NOT FOUR LINES IN CartReview: the divergence cap counts any .tsx
// that does `.from(…).select(…)` and `.map(…)` as a RECORD-LIST SURFACE measured against the
// shared grid standard — and CartReview is a cart, not a grid. Putting the query here keeps the
// page a page, and keeps the cap's population honest instead of buying silence with a
// declaration that would assert something untrue about this screen. It is also where a SECOND
// caller goes when one appears (§6 r8).
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase';
import {
  DELIVERY_RING_COLUMNS, BUSINESS_DEPOT_COLUMNS, normalizeRingRows,
  type DeliveryRing, type Point,
} from '@trace/shared/business-logic/deliveryRings';

/** Not exported: `readRingInputs`'s return type is the only thing a caller needs, and an
 *  exported type nobody names is the dead-export knip counts. */
interface RingInputs {
  /** The yard, ONLY when its coordinate was actually found. Null otherwise — never a guess. */
  depot: Point | null;
  /**
   * 🔴 NULL MEANS "WE DO NOT KNOW", `[]` MEANS "NONE ARE SET UP", AND THEY ARE NOT THE SAME.
   * A failed read returning `[]` would make the screen say *no rings set up yet* and quietly show
   * the flat price — a claim about the owner's settings that a network error is not entitled to
   * make. The caller shows nothing extra until it knows (§6 r24's shape, one layer up).
   */
  rings: DeliveryRing[] | null;
}

export async function readRingInputs(businessId: string): Promise<RingInputs> {
  try {
    const [biz, ringRows] = await Promise.all([
      supabase.from('businesses').select(BUSINESS_DEPOT_COLUMNS).eq('id', businessId).maybeSingle(),
      supabase.from('business_delivery_rings').select(DELIVERY_RING_COLUMNS)
        .eq('business_id', businessId).eq('active', true),
    ]);
    const b = biz.data as { latitude?: number | null; longitude?: number | null; geocode_status?: string | null } | null;
    // ⚠️ `found` IS REQUIRED, NOT JUST TWO NUMBERS. A row can hold a coordinate from a `confirm`
    // era answer nobody agreed to; measuring rings from it would price every delivery off a pin
    // the owner never accepted.
    const depot = (b?.geocode_status === 'found'
      && typeof b.latitude === 'number' && typeof b.longitude === 'number')
      ? { latitude: b.latitude, longitude: b.longitude } : null;
    // 🔴 numeric → number HERE, at the boundary. PostgREST hands back "250.00" as a STRING and
    // a string amount concatenates in the checkout total instead of adding.
    return { depot, rings: ringRows.error ? null : normalizeRingRows(ringRows.data) };
  } catch {
    return { depot: null, rings: null };
  }
}
