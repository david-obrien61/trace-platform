// ============================================================
// stopWrites — THE ONE CLIENT WRITE PATH TO A STOP, AND THE SHIP-TO EDIT.
//
// PURPOSE:      Every change a person makes to a stop from a screen — the fulfilment tap, the date
//               move, the review-ask record and the ship-to address — lands through `updateStop`
//               here, so the schedule, the route and the order screen cannot write a stop three
//               ways (§6 r8; the write-path cap counts files). Before ledger #301 these writes lived
//               inline in DeliverySchedule.tsx, which is why the route could do none of them.
//
//               🔴 THE SHIP-TO EDIT WRITES `deliveries` AND NEVER `customers`. D-41 L1 (2026-07-13):
//               a customer has ONE billing address, stored on the customer; the ship-to belongs to
//               the ORDER and is snapshotted onto the stop. Changing where THIS load goes must never
//               move the customer's billing record. This file names no other table but `audit_log`,
//               and `stopWrites.test.ts` asserts that against a recording client.
//
//               🔴 AND THE EDIT IS EVIDENCE, SO IT IS RECORDED (David, 2026-09-11). D-41 deferred the
//               saved ship-to address book (`customer_addresses`, the L2 hook) pending an empirical
//               answer: do customers reorder to the SAME sites often enough to want them saved? A
//               repeated edit of one customer's ship-to to one address IS that answer. So every saved
//               edit writes an `audit_log` row carrying the customer, the order, and the address
//               before and after — a question that can later be asked of the log in one query.
//               ⚠️ That is a deliberate exception to `normalisationConsent.ts`'s "no address in
//               `detail`" line: the address is the datum the question is about.
//
// DEPENDENCIES: a supabase client passed in (never constructed here). Pure otherwise.
// OUTPUTS:      SHIP_TO_FIELDS · ShipToForm · ShipToSaveOutcome · SHIP_TO_AUDIT_ACTION ·
//               shipToLine · shipToFormOf · planShipToEdit · shipToAuditRow · updateStop · saveShipTo
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

const TRACE_STOP = true; // [TRACE:STOP] STD-003 — ON until David owner-proves

export const SHIP_TO_FIELDS = ['address_line1', 'city', 'state', 'zip'] as const;
type ShipToField = typeof SHIP_TO_FIELDS[number];
type ShipTo = Record<ShipToField, string | null>;
export type ShipToForm = Record<ShipToField, string>;

type StopWriteOutcome = { ok: true } | { ok: false; error: string };

const clean = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
};

function shipToOf(s: Partial<ShipTo>): ShipTo {
  return { address_line1: s.address_line1 ?? null, city: s.city ?? null, state: s.state ?? null, zip: s.zip ?? null };
}

/** The address as one line — what the card shows, and what the route hands to Google Maps. */
export function shipToLine(s: Partial<ShipTo>): string {
  return SHIP_TO_FIELDS.map(f => clean(s[f])).filter((v): v is string => v !== null).join(', ');
}

export function shipToFormOf(s: Partial<ShipTo>): ShipToForm {
  return { address_line1: s.address_line1 ?? '', city: s.city ?? '', state: s.state ?? '', zip: s.zip ?? '' };
}

type ShipToPlan =
  | { kind: 'no_change' }
  | { kind: 'refused'; reason: string }
  | { kind: 'write'; before: ShipTo; after: ShipTo; changedFields: ShipToField[] };

/**
 * What a Save of the ship-to form would do. A VALUE, so the refusals are asserted, not rendered.
 *
 * All four fields are written together, always: an address is one fact, not four independent ones,
 * and a partial write would leave the stop pointing at a street from one place in a city from another.
 */
export function planShipToEdit(before: Partial<ShipTo>, form: ShipToForm): ShipToPlan {
  const after: ShipTo = {
    address_line1: clean(form.address_line1), city: clean(form.city), state: clean(form.state), zip: clean(form.zip),
  };
  const changedFields = SHIP_TO_FIELDS.filter(f => clean(before[f]) !== after[f]);
  if (changedFields.length === 0) return { kind: 'no_change' };
  // §1.6 item 3 — validated before write, and refused in words. A truck cannot go to a city, and a
  // street with neither a city nor a ZIP is what made two of LAWNS's live routes unbuildable on
  // 2026-09-09 (tech-debt #226/#227): Google could not place them.
  if (!after.address_line1) return { kind: 'refused', reason: 'A delivery address needs a street.' };
  if (!after.city && !after.zip) return { kind: 'refused', reason: 'Add a city or a ZIP code — without one the map cannot find this address.' };
  return { kind: 'write', before: shipToOf(before), after, changedFields };
}

export const SHIP_TO_AUDIT_ACTION = 'delivery.ship_to_changed';

export function shipToAuditRow(x: {
  businessId: string; actorUserId: string | null; stopId: string;
  customerId: string | null; orderId: string | null;
  before: ShipTo; after: ShipTo; changedFields: ShipToField[]; at: Date;
}) {
  return {
    business_id: x.businessId,
    actor_user_id: x.actorUserId,
    action: SHIP_TO_AUDIT_ACTION,
    target_type: 'delivery',
    target_id: x.stopId,
    outcome: 'success' as const,
    detail: {
      // The customer and the address are the two facts the address-book question groups on.
      customer_id: x.customerId,
      order_id: x.orderId,
      before: x.before,
      after: x.after,
      changed_fields: x.changedFields,
      changed_at: x.at.toISOString(),
    },
  };
}

/**
 * THE ONE client UPDATE of a stop. R-12 / A8: a PostgREST update RLS refused returns NO ERROR and
 * zero rows, so success is the COUNT — exactly one row — and anything else is a failure in words.
 * `what` names the thing that was not saved ("That stop", "That delivery date", "The address").
 */
export async function updateStop(
  db: SupabaseClient, businessId: string, stopId: string, patch: Record<string, unknown>, what: string,
): Promise<StopWriteOutcome> {
  const { data, error } = await db.from('deliveries').update(patch)
    .eq('id', stopId).eq('business_id', businessId).select('id');
  if (error) {
    if (TRACE_STOP) console.log('[TRACE:STOP] write FAILED', { stopId, keys: Object.keys(patch), error: error.message });
    return { ok: false, error: error.message };
  }
  if ((data ?? []).length !== 1) {
    if (TRACE_STOP) console.log('[TRACE:STOP] write landed on', (data ?? []).length, 'rows, not 1', { stopId, keys: Object.keys(patch) });
    return { ok: false, error: `${what} was not saved — you may not have permission, or the stop was removed.` };
  }
  if (TRACE_STOP) console.log('[TRACE:STOP] write', { stopId, keys: Object.keys(patch), rows: 1 });
  return { ok: true };
}

export type ShipToSaveOutcome =
  | { kind: 'no_change' }
  | { kind: 'refused'; reason: string }
  | { kind: 'failed'; error: string }
  | { kind: 'saved'; audited: true }
  | { kind: 'saved'; audited: false; auditError: string };

/**
 * Save a stop's ship-to, then record that it changed.
 *
 * ⚠️ TWO WRITES, NO TRANSACTION, AND THE ORDER IS CHOSEN ON WHAT A HALF-LANDED SAVE LEAVES. The
 * address first, the history row second: a history row written before a refused update would record
 * a change that never happened, which is a lie in an append-only table nobody can correct. A history
 * row that fails AFTER the address landed is reported as exactly that — saved, not recorded.
 */
export async function saveShipTo(db: SupabaseClient, x: {
  businessId: string;
  stop: { id: string; customer_id: string | null; order_id: string | null } & Partial<ShipTo>;
  form: ShipToForm;
  actorUserId: string | null;
  now: Date;
}): Promise<ShipToSaveOutcome> {
  const plan = planShipToEdit(x.stop, x.form);
  if (plan.kind !== 'write') return plan;

  const wrote = await updateStop(db, x.businessId, x.stop.id, { ...plan.after }, 'The address');
  if (!wrote.ok) return { kind: 'failed', error: wrote.error };

  const row = shipToAuditRow({
    businessId: x.businessId, actorUserId: x.actorUserId, stopId: x.stop.id,
    customerId: x.stop.customer_id, orderId: x.stop.order_id,
    before: plan.before, after: plan.after, changedFields: plan.changedFields, at: x.now,
  });
  const { data, error } = await db.from('audit_log').insert(row).select('id');
  const rows = (data ?? []).length;
  if (TRACE_STOP) console.log('[TRACE:STOP] ship-to recorded', { stopId: x.stop.id, changed: plan.changedFields, rows, error: error?.message ?? null });
  if (error) return { kind: 'saved', audited: false, auditError: error.message };
  if (rows !== 1) return { kind: 'saved', audited: false, auditError: `the history row came back ${rows} times` };
  return { kind: 'saved', audited: true };
}
