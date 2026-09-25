// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      The ONE writer for a tenant's delivery rings, with a change log.
// DEPENDENCIES: business_delivery_rings (20260924f) · audit_log · deliveryRings (the columns).
// OUTPUTS:      planRingSave() · saveRings().
//
// ═════════════════════════════════════════════════════════════════════════════
// 🔴 WHY A WRITER AND NOT A `.upsert()` AT THE SCREEN
// ═════════════════════════════════════════════════════════════════════════════
// Rings are MONEY. Moving ring 3 from 21 to 25 miles changes what every customer between those
// distances is charged, for ever, with no invoice to look back at. §6 r21: one writer per domain,
// every change recorded. A screen writing this table directly is the second writer that later
// disagrees with the first.
//
// ── RETIRE, NEVER DELETE ([[R-133]]) ────────────────────────────────────────────────────────
// A removed ring is set `active = false`, not deleted. The partial unique index is
// (business_id, outer_radius_miles) WHERE active, so retiring a 7.1-mile ring frees that radius
// for a new one — proven in the migration's own harness. Deleting would erase the fact that LAWNS
// once charged $50 out to 7.1 miles, which is exactly what someone will want to know when an old
// invoice is questioned.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js';
import { DELIVERY_RING_COLUMNS, type DeliveryRing } from './deliveryRings';

export interface RingEdit {
  id?: string | null;
  outer_radius_miles: number;
  charge: number;
  origin_note?: string | null;
}

export type RingRefusal = { kind: 'refused'; reason: string };
export type RingPlan = { kind: 'ok'; keep: RingEdit[]; retire: string[] };

/**
 * Check a set of rings before any of it is written.
 *
 * 🔴 IT REFUSES THE WHOLE SET, NEVER PART OF IT. Half-saved rings are worse than none: the gap
 * between ring 2 and ring 4 would quietly price at ring 4's charge, and nobody would see that a
 * ring was missing rather than deliberately wide.
 */
export function planRingSave(edits: readonly RingEdit[], existing: readonly DeliveryRing[]): RingPlan | RingRefusal {
  for (const e of edits) {
    if (!Number.isFinite(e.outer_radius_miles) || e.outer_radius_miles <= 0) {
      return { kind: 'refused', reason: 'A ring needs a distance greater than zero.' };
    }
    if (!Number.isFinite(e.charge) || e.charge < 0) {
      // 0 is legitimate — a free local ring. Negative is not a price.
      return { kind: 'refused', reason: 'A ring charge cannot be negative. Zero is fine — that is a free ring.' };
    }
  }
  const radii = edits.map(e => Math.round(e.outer_radius_miles * 10) / 10);
  if (new Set(radii).size !== radii.length) {
    // 🔴 The database would refuse this too, but a unique-violation reaching a person as a Postgres
    // string is not an answer. Said in words, here, before anything is written.
    return { kind: 'refused', reason: 'Two rings cannot end at the same distance — one of them would never be used.' };
  }
  const keptIds = new Set(edits.map(e => e.id).filter(Boolean) as string[]);
  const retire = existing.filter(r => r.id && r.active !== false && !keptIds.has(r.id)).map(r => r.id as string);
  return { kind: 'ok', keep: edits.map((e, i) => ({ ...e, outer_radius_miles: radii[i] })), retire };
}

export interface RingSaveOutcome {
  saved: number;
  retired: number;
  error: string | null;
  /** False when the rings saved but the change log did not — said, never swallowed. */
  logged: boolean;
}

/**
 * Write the rings and record what changed.
 *
 * ⚠️ THE LOG NEVER BLOCKS THE SAVE, AND ITS FAILURE IS NEVER SILENT. A change log that cannot be
 * written must not undo the change it describes (the contactWriter lesson), but a save reported
 * as complete while its history vanished is the quiet half of the same defect — so `logged`
 * comes back and the screen says so.
 */
export async function saveRings(
  db: SupabaseClient,
  x: { businessId: string; actorUserId?: string | null; edits: readonly RingEdit[]; existing: readonly DeliveryRing[] },
): Promise<RingSaveOutcome | RingRefusal> {
  const plan = planRingSave(x.edits, x.existing);
  if (plan.kind === 'refused') return plan;

  const before = new Map(x.existing.filter(r => r.id).map(r => [r.id as string, r]));
  let saved = 0;

  for (const e of plan.keep) {
    const row = {
      business_id: x.businessId,
      outer_radius_miles: e.outer_radius_miles,
      charge: e.charge,
      origin_note: e.origin_note ?? null,
      active: true,
      updated_at: new Date().toISOString(),
    };
    const q = e.id
      ? db.from('business_delivery_rings').update(row).eq('id', e.id).eq('business_id', x.businessId).select('id')
      : db.from('business_delivery_rings').insert(row).select('id');
    const { data, error } = await q;
    // R-12: an update matching zero rows returns success with no error — the count is the signal.
    if (error) return { saved, retired: 0, error: error.message, logged: false };
    saved += (data ?? []).length;
  }

  let retired = 0;
  if (plan.retire.length > 0) {
    const { data, error } = await db.from('business_delivery_rings')
      .update({ active: false, updated_at: new Date().toISOString() })
      .in('id', plan.retire).eq('business_id', x.businessId).select('id');
    if (error) return { saved, retired: 0, error: error.message, logged: false };
    retired = (data ?? []).length;
  }

  // ── the change log ────────────────────────────────────────────────────────────────────────
  const rows = [
    ...plan.keep.map(e => {
      const was = e.id ? before.get(e.id) : null;
      return {
        business_id: x.businessId, actor_user_id: x.actorUserId ?? null,
        action: was ? 'delivery_ring.update' : 'delivery_ring.create',
        target_type: 'delivery_ring', target_id: e.id ?? null,
        // Both sides, because "ring 3 changed" is not a fact anyone can act on.
        detail: was
          ? { from: { miles: was.outer_radius_miles, charge: was.charge }, to: { miles: e.outer_radius_miles, charge: e.charge } }
          : { to: { miles: e.outer_radius_miles, charge: e.charge }, note: e.origin_note ?? null },
        outcome: 'success',
      };
    }),
    ...plan.retire.map(id => ({
      business_id: x.businessId, actor_user_id: x.actorUserId ?? null,
      action: 'delivery_ring.retire', target_type: 'delivery_ring', target_id: id,
      detail: { from: before.get(id) ? { miles: before.get(id)!.outer_radius_miles, charge: before.get(id)!.charge } : null },
      outcome: 'success',
    })),
  ];
  let logged = true;
  if (rows.length > 0) {
    // 🔴 NO `.select()`: returning the rows needs audit_log:read, which an owner editing rings
    // need not hold — with it, every log write under RLS was refused (contactWriter measured this).
    try {
      const { error } = await db.from('audit_log').insert(rows);
      if (error) logged = false;
    } catch { logged = false; }
  }
  return { saved, retired, error: null, logged };
}

export { DELIVERY_RING_COLUMNS };
