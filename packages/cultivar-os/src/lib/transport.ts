// ============================================================
// transport — the three-branch transport model over service_offerings (ZERO migration).
// PURPOSE:  RESTORE the May-18 proven transport/netting workflow onto the current
//           service_offerings pricing. Transport is a single-select radio of THREE
//           mutually-exclusive branches (canonical spec: docs/specs/
//           SPEC-transport-netting-decline-workflow-2026-07-08.md):
//             1. DELIVERY + PLANTING → delivery (per-order, flat, ×1) + planting
//                (per-plant, per_unit, ×N). 5 trees = 1× delivery + 5× planting.
//             2. DELIVERY ONLY       → delivery (per-order, flat, ×1), no planting.
//             3. NO THANK YOU (self) → no transport charge; the netting/tarp offer shows.
//           This resolver classifies raw service_offerings rows into ROLES by shape so
//           the workflow reads delivery + planting as TWO correctly-ruled services
//           (the multi-item rewrite bd02a58 had collapsed them into one fused row).
// DEPENDENCIES: ../types/plant (ServiceOffering).
// OUTPUTS:  TransportChoice, TransportRoles, resolveTransportRoles, choiceToSelection,
//           availableChoices, CHOICE_META. netted math lives in ./netting (per_unit ×N,
//           flat ×1) — this file only maps branch → (transport, planting) selections.
// SCOPE:    role resolution + branch mapping only. It NEVER hand-migrates data: when the
//           two correctly-ruled rows aren't both present it FLAGS (D-9 Surface Honesty)
//           and best-efforts on whatever exists, never silently mischarging. The owner
//           reshapes the rows via the Settings offerings editor (a separate task).
// AC-1:     generic — no vertical noun leaks here; the Ch.725 copy lives in the row's
//           compliance_title/compliance_body, not in code.
// ============================================================
import type { ServiceOffering } from '../types/plant';

/** The three mutually-exclusive transport branches (the radio). */
export type TransportChoice = 'delivery_planting' | 'delivery_only' | 'self';

/** service_offerings rows classified into transport ROLES by shape. */
export interface TransportRoles {
  /** transport_mode === 'self' — the "haul it myself" branch that triggers netting. */
  self:     ServiceOffering | null;
  /** staff transport, price_type 'flat' / price_unit 'order' — the per-order delivery fee (×1). */
  delivery: ServiceOffering | null;
  /** staff transport, price_type 'per_unit' / price_unit 'plant' — the per-plant planting fee (×N). */
  planting: ServiceOffering | null;
  /** the single fused legacy "delivery + planting" per-plant row, present when delivery is absent. */
  fused:    ServiceOffering | null;
  /** D-9 honesty: data-shape problems surfaced (never silently mischarged). */
  flags:    string[];
}

/** The concrete selections a branch attaches. transport → selectedTransport (drives
 *  transport_method + the netting trigger); planting → the separate per-plant service. */
export interface TransportSelection {
  transport: ServiceOffering | null;
  planting:  ServiceOffering | null;
}

/** Classify the business's transport offerings into roles by SHAPE (not by name). */
export function resolveTransportRoles(transportOfferings: ServiceOffering[]): TransportRoles {
  const self  = transportOfferings.find(o => o.transport_mode === 'self') ?? null;
  const staff = transportOfferings.filter(o => o.transport_mode === 'staff');
  const delivery = staff.find(o => o.price_type === 'flat')     ?? null; // per-order
  const planting = staff.find(o => o.price_type === 'per_unit') ?? null; // per-plant

  const flags: string[] = [];
  let fused: ServiceOffering | null = null;

  // FLAG: only a per-plant staff row exists (the fused "We deliver and plant" legacy shape).
  // "Delivery + planting" runs on that one row (scales ×N) but there's no separate per-order
  // delivery fee, and "Delivery only" cannot be offered. Owner splits it via the editor.
  if (planting && !delivery) {
    fused = planting;
    flags.push(
      'no per-order delivery row (staff · flat/order): "Delivery + planting" runs on a single ' +
      'fused per-plant row (no separate delivery fee) and "Delivery only" is unavailable — ' +
      'split it into a delivery + a planting service in Settings.',
    );
  }
  if (!self) {
    flags.push('no self-transport row (transport_mode=self): the "No thank you / netting" branch is unavailable.');
  }
  if (!delivery && !planting) {
    flags.push('no staff transport row: neither delivery nor planting is available.');
  }

  return { self, delivery, planting, fused, flags };
}

/** Which of the three branches can be assembled from the resolved roles. */
export function availableChoices(roles: TransportRoles): TransportChoice[] {
  const out: TransportChoice[] = [];
  if (roles.delivery && roles.planting) out.push('delivery_planting');
  else if (roles.fused)                 out.push('delivery_planting'); // fused fallback (flagged)
  if (roles.delivery)                   out.push('delivery_only');
  if (roles.self)                       out.push('self');
  return out;
}

/** Map a branch to the concrete service selections it attaches. */
export function choiceToSelection(choice: TransportChoice, roles: TransportRoles): TransportSelection {
  switch (choice) {
    case 'self':
      return { transport: roles.self, planting: null };
    case 'delivery_only':
      return { transport: roles.delivery, planting: null };
    case 'delivery_planting':
      if (roles.delivery && roles.planting) return { transport: roles.delivery, planting: roles.planting };
      // Fused fallback: the single per-plant row IS the whole "delivery + planting" (scales ×N).
      if (roles.fused)                      return { transport: roles.fused, planting: null };
      return { transport: roles.delivery ?? roles.planting, planting: null };
  }
}

/** Static branch presentation (label + sub). Prices are appended from the resolved rows. */
export const CHOICE_META: Record<TransportChoice, { label: string; sub: string }> = {
  delivery_planting: { label: 'Delivery + planting',      sub: 'We deliver and plant it in for you' },
  delivery_only:     { label: 'Delivery only',            sub: 'We bring it to your property' },
  self:              { label: "No thank you — I'll haul it myself", sub: 'Pick up today — secure-your-load notice applies' },
};
