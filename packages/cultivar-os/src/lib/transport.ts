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
//
// 🔴 #251 FIXED 2026-09-23 (ledger #386, David's ruling (e)). EVERY staff/flat row is now offered,
//    not just the first. WAS: `staff.find(o => o.price_type === 'flat')` — a single `find`, so a
//    business with TWO per-order staff services had its second one offered NOWHERE and named in NO
//    flag. LAWNS has exactly that: Trip Charge AND Tailgate Delivery are both staff, both charged
//    once per order, and under the old shape whichever sorted second simply did not exist at
//    checkout. David, 2026-09-23: *"without it tailgate, backyard and Trip Charge are three
//    staff/flat rows and only the first is ever offered."*
//    THE CONSEQUENCE FOR THE TYPE: a branch can no longer be a bare string, because
//    "delivery only" no longer names one thing. A TransportChoice now carries the ID of the row it
//    charges, which is what it always meant and what the old three-string union could not say.
//
// 🔴 THE PREDICATE IS THE MODE AND NOTHING ELSE (R-120, confirmed 2026-09-11). A transport row is
//    a role only if `transport_mode` is 'self' or 'staff'. A row with NO mode matches neither, so
//    before this date it fell out of every role WITH NO FLAG NAMING IT — LAWNS's Trip Charge on
//    2026-09-09, and the screen said no transport was set up. It is now collected in `unbound` and
//    its own flag names it FIRST. It is still not OFFERED — which mode it carries is the owner's
//    fact, and guessing one here would put a price on an order nobody agreed to.
// ============================================================
import type { ServiceOffering } from '../types/plant';

/** The SHAPE of a branch. Which ROW it charges is the other half — see TransportChoice. */
export type TransportKind = 'delivery_planting' | 'delivery_only' | 'self';

/**
 * One option on the radio: a shape AND the row it charges.
 *
 * 🔴 `transportId` IS NOT DECORATION — IT IS WHAT MAKES #251 FIXABLE. With two staff/flat rows
 * there are two distinct "delivery only" branches and two distinct "delivery + planting"
 * branches, and nothing but the id tells them apart. A three-string union could only ever name
 * one of each, which is exactly how Tailgate Delivery came to be invisible.
 */
export interface TransportChoice {
  kind: TransportKind;
  /** `service_offerings.id` of the transport row this branch charges. */
  transportId: string;
}

/** Are these the same branch? Compared by VALUE — a choice round-trips through the cart store. */
export function sameChoice(a: TransportChoice | null, b: TransportChoice | null): boolean {
  return !!a && !!b && a.kind === b.kind && a.transportId === b.transportId;
}

/** service_offerings rows classified into transport ROLES by shape. */
export interface TransportRoles {
  /** transport_mode === 'self' — the "haul it myself" branch that triggers netting. */
  self:     ServiceOffering | null;
  /**
   * EVERY staff transport row charged once per order (price_type 'flat'), in sort order.
   * ✏️ #251: this was `delivery: ServiceOffering | null` — ONE row. The plural is the fix.
   */
  deliveries: ServiceOffering[];
  /** staff transport, price_type 'per_unit' — the per-plant planting fee (×N). */
  planting: ServiceOffering | null;
  /** the single fused legacy "delivery + planting" per-plant row, present when no delivery row is. */
  fused:    ServiceOffering | null;
  /** transport rows that say NOTHING about who transports — never offered, always named (R-120). */
  unbound:  ServiceOffering[];
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
  const unbound = transportOfferings.filter(o => o.transport_mode !== 'self' && o.transport_mode !== 'staff');
  // #251: filter, not find. The array order is the caller's (useServices sorts by sort_order).
  const deliveries = staff.filter(o => o.price_type === 'flat');     // per-order
  const planting   = staff.find(o => o.price_type === 'per_unit') ?? null; // per-plant

  const flags: string[] = [];
  let fused: ServiceOffering | null = null;

  // FIRST, because it is the one an owner cannot see anywhere else on this screen: a service that
  // IS set up and is not offered. Named, so the heads-up line says which row, not that "something" is off.
  if (unbound.length > 0) {
    const names = unbound.map(o => `"${o.name}"`).join(', ');
    flags.push(
      unbound.length === 1
        ? `${names} is set up as transport but does not say who transports (transport_mode is empty), so it is never offered — choose a transport mode for it in Settings.`
        : `${names} are set up as transport but do not say who transports (transport_mode is empty), so they are never offered — choose a transport mode for them in Settings.`,
    );
  }

  // FLAG: only a per-plant staff row exists (the fused "We deliver and plant" legacy shape).
  // "Delivery + planting" runs on that one row (scales ×N) but there's no separate per-order
  // delivery fee, and "Delivery only" cannot be offered. Owner splits it via the editor.
  if (planting && deliveries.length === 0) {
    fused = planting;
    flags.push(
      'no per-order delivery row (staff · flat): "Delivery + planting" runs on a single ' +
      'fused per-plant row (no separate delivery fee) and "Delivery only" is unavailable — ' +
      'split it into a delivery + a planting service in Settings.',
    );
  }
  if (!self) {
    flags.push('no self-transport row (transport_mode=self): the "No thank you / netting" branch is unavailable.');
  }
  if (deliveries.length === 0 && !planting) {
    flags.push('no staff transport row: neither delivery nor planting is available.');
  }

  return { self, deliveries, planting, fused, unbound, flags };
}

/**
 * Which branches can be assembled from the resolved roles — ONE PER ROW, not one per shape.
 *
 * 🔴 THE COUNT IS THE POINT. With LAWNS's four transport rows after step 0 (Trip Charge, Tailgate,
 * Installation, self-collect) this returns FIVE branches: each of the two per-order rows on its
 * own and with planting attached, plus self-collect. The old code returned three and silently
 * dropped Tailgate.
 */
export function availableChoices(roles: TransportRoles): TransportChoice[] {
  const out: TransportChoice[] = [];
  for (const d of roles.deliveries) {
    if (roles.planting) out.push({ kind: 'delivery_planting', transportId: d.id });
    out.push({ kind: 'delivery_only', transportId: d.id });
  }
  // Fused fallback (flagged above): the per-plant row IS the whole "delivery + planting".
  if (roles.deliveries.length === 0 && roles.fused) {
    out.push({ kind: 'delivery_planting', transportId: roles.fused.id });
  }
  if (roles.self) out.push({ kind: 'self', transportId: roles.self.id });
  return out;
}

/** Every row a branch could name, so a lookup by id never has to know which role it came from. */
function rowsOf(roles: TransportRoles): ServiceOffering[] {
  const rows = [...roles.deliveries];
  if (roles.planting) rows.push(roles.planting);
  if (roles.fused && !rows.includes(roles.fused)) rows.push(roles.fused);
  if (roles.self) rows.push(roles.self);
  return rows;
}

/**
 * Map a branch to the concrete service selections it attaches.
 *
 * ⚠️ AN UNKNOWN id YIELDS A NULL TRANSPORT RATHER THAN A SUBSTITUTE. It can happen honestly — the
 * offerings reload while a choice is held in the cart, and the row was retired in between. Falling
 * back to "some other delivery row" would put a price on an order nobody agreed to, which is the
 * same failure R-120 was written about one field over.
 */
export function choiceToSelection(choice: TransportChoice, roles: TransportRoles): TransportSelection {
  const transport = rowsOf(roles).find(o => o.id === choice.transportId) ?? null;
  if (choice.kind === 'delivery_planting') {
    // The fused row IS both halves; it must not also attach itself as planting (that would charge twice).
    const isFused = !!roles.fused && transport?.id === roles.fused.id;
    return { transport, planting: isFused ? null : roles.planting };
  }
  return { transport, planting: null };
}

/**
 * What the radio shows for a branch.
 *
 * 🔴 §6 r18 — A LABEL IS A CLAIM. "Delivery only" is a true and sufficient label when a business
 * has ONE per-order row. With two it is false twice over, because it names neither. So the row's
 * own name is used the moment there is more than one to tell apart, and the generic wording
 * survives only where it is still true. This is the same rule that says a section header must
 * hold for every row beneath it.
 */
export function choiceMeta(choice: TransportChoice, roles: TransportRoles): { label: string; sub: string } {
  const row = rowsOf(roles).find(o => o.id === choice.transportId) ?? null;
  const many = roles.deliveries.length > 1;
  const name = row?.name ?? 'Transport';
  switch (choice.kind) {
    case 'self':
      return { label: row?.name ?? "No thank you — I'll haul it myself", sub: 'Pick up today — secure-your-load notice applies' };
    case 'delivery_only':
      return many
        ? { label: name, sub: row?.description || 'We bring it to your property' }
        : { label: 'Delivery only', sub: 'We bring it to your property' };
    case 'delivery_planting': {
      const plantingName = roles.planting?.name ?? 'planting';
      return many
        ? { label: `${name} + ${plantingName.toLowerCase()}`, sub: 'We deliver and plant it in for you' }
        : { label: 'Delivery + planting', sub: 'We deliver and plant it in for you' };
    }
  }
}
