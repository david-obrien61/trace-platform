// ============================================================
// netting — the attach-rule engine over a multi-item cart (ZERO migration).
// PURPOSE:  A multi-item order (N plants) must attach each service by its EXISTING rule
//           (R1–R5 recon): service_offerings.price_type × price_unit already encode the
//           attach rule — 'flat'/'order' collapses to ×1 for the whole order (delivery:
//           5 trees → 1 truck fee), 'per_unit'/'plant' scales to the plant count (planting:
//           5 trees → 5 fees; netting: 5 → 5). This runs that arithmetic across the cart's
//           line items so the proposed itemization can be SHOWN and adjusted before submit
//           (Regina Principle / D-9 — surface, don't silently apply). No new schema, no new
//           field — submit.ts already ran this exact per-unit?×qty:×1 math for one item.
// DEPENDENCIES: ../types/order (CartItem, ServiceSelection), ../types/plant (ServiceOffering).
// OUTPUTS:  totalPlantCount, nettedQuantity (the attach rule), isNettingOffering, lineSubtotal.
//           CartReview composes these into the interactive proposal; submit.ts + the email use
//           the same nettedQuantity/lineSubtotal so display and charge cannot drift (§6.8).
// SCOPE:    per-order + per-plant attach classes only. The third class — quantity-bearing
//           WITH a spec (fertilizer "5 × 30gal each") — is DEFERRED (its own recon + a
//           small additive migration); this engine leaves that seam untouched.
// ============================================================
import type { CartItem } from '../types/order';
import type { ServiceOffering } from '../types/plant';

/** Total plants across all cart lines — the denominator for a per-plant (per_unit) service. */
export function totalPlantCount(items: CartItem[]): number {
  return items.reduce((sum, l) => sum + (l.quantity || 0), 0);
}

/** Is this offering the self-transport netting add-on (the compliance/Regina one)? */
export function isNettingOffering(o: ServiceOffering): boolean {
  return o.trigger_transport_mode === 'self' && o.category === 'addon';
}

/**
 * THE ATTACH RULE. per_unit ('plant') scales to the plant count; flat ('order') collapses
 * to 1 no matter how many plants. This is exactly what submit.ts did for a single item
 * (per_unit ? quantity : 1), generalized to the whole cart's plant count.
 */
export function nettedQuantity(o: ServiceOffering, plantCount: number): number {
  return o.price_type === 'per_unit' ? plantCount : 1;
}

/** A service line's money: price × quantity (flat ⇒ qty 1 ⇒ price; honors an owner override). */
export function lineSubtotal(o: ServiceOffering, quantity: number): number {
  return Number(o.price) * quantity;
}
