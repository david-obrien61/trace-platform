// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: finishing a stop FULFILS its order, and undoing the stop puts the order back
//   (tech-debt #319 · David, 2026-09-21: *"lift it for the office door now; the crew door keeps
//   holding until teams land"*). The truck run is the moment the plant leaves the property, and
//   until now a completed run left every order open — so nothing was ever consumed.
// DEPENDENCIES: the supabase client (passed in) · `/api/orders/submit` action `status`, which is
//   the ONE place an order's status changes and the only place stock moves on fulfilment.
// OUTPUTS: fulfilOrderForStop · restoreOrderForStop · stopOrderNote.
//
// ═════════════════════════════════════════════════════════════════════════════
// 🔴 THIS FILE CHANGES NO STOCK ITSELF, AND THAT IS THE DESIGN.
// ═════════════════════════════════════════════════════════════════════════════
// `handleStatus` in `api/orders/submit.ts` already owns the whole of it: `movesOnHand()` decides
// whether the transition moves stock, each line with a lot is adjusted through `adjustLotQty`,
// and every one of those calls takes a REQUIRED test-mode gate (R-158 / ledger #342) so nothing
// writes the record while the switch is off. Re-implementing any of that here would be a second
// copy of the one rule that must never drift (§6 r8) — so this asks the endpoint, exactly as the
// order screen's own status control does.
//
// ✏️ THE CREW-DOOR HOLD IS LIFTED — David, 2026-09-26 (ledger #416; the hold was recorded here on
// 2026-09-21 as *"lift it for the office door now; the crew's keeps holding until teams land"*).
// Teams have landed (#362; `delivery_teams` verified live), and David has now ruled explicitly:
// **the crew's Done tap on an INSTALL stop issues its kit from stock through the same
// test-mode-gated path, and Undo reverses it.** The Google review ask stays HELD (2026-09-15/17) —
// that hold is untouched and is a separate question.
//
// 🔴 WHAT IS STILL TRUE OF THIS FILE: it changes no stock itself, and the crew door still does not
// call it. `fulfilOrderForStop` moves the ORDER (and, through `/api/orders/submit`, the trees that
// were SOLD). The KIT — mix, T-posts, rope, water monitors — is a different movement with a
// different source (`install_kit_components`, ledger #411) and it is NOT wired yet.
// ⚠️ UNTIL THE KIT IS SEEDED, DONE ISSUES NOTHING AND SAYS WHY (David's words). A kit whose
// components carry no `qb_item_id` can issue nothing, and `evaluateKit` already reports exactly
// that — `unlinked` names each one and `issuable` is false. Wiring the crew tap to a kit that
// would silently issue nothing is the failure this sequencing avoids.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js';
import { updateStop } from './stopWrites';

/** What happened to the ORDER when a stop was finished or reopened. The stop's own write has
 *  already succeeded by the time any of these are returned — they never mean the stop failed. */
// Not exported: nothing outside this module names the type — the two functions and the one
// sentence-maker are the whole surface. An exported type nobody imports is dead weight knip is
// right to flag (the same call as #345's `DeployedVersion`).
type StopOrderOutcome =
  | { kind: 'no-order' }
  | { kind: 'fulfilled'; from: string | null }
  | { kind: 'restored'; to: string }
  | { kind: 'already' }
  /** The caller may finish stops but may not change orders. Said out loud, never swallowed. */
  | { kind: 'not-allowed'; message: string }
  /** The order could not be moved. The stop stands; the sentence says what to do about it. */
  | { kind: 'failed'; message: string }
  /** Reopened, but nothing was remembered to put the order back to. */
  | { kind: 'nothing-remembered'; message: string };

const NOT_ALLOWED =
  'The stop is finished. Its order was NOT marked fulfilled, because that needs permission to '
  + 'change orders — ask an owner or manager to set it, or nothing will come off your stock.';

async function authHeader(supabase: SupabaseClient): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function setStatus(
  supabase: SupabaseClient, businessId: string, orderId: string, status: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch('/api/orders/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader(supabase)) },
      body: JSON.stringify({ action: 'status', status, orderId, businessId }),
    });
    const json = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok) return { ok: false, message: String((json as { error?: string }).error ?? `The order could not be updated (${res.status}).`) };
    return { ok: true };
  } catch (e) {
    // A dead zone is not an empty result (D-9): the stop is already saved, so say which half moved.
    return { ok: false, message: `The stop is saved, but the order could not be reached — ${(e as Error).message}.` };
  }
}

/**
 * Remember, on the stop, what its order was before we fulfilled it — so Undo can put it back.
 *
 * 🔴 TOLERANT BY DESIGN, AND THE REASON IS OPERATIONAL. The column arrives in `20260923`, which
 * David applies in the morning; this code may be live for a few hours before it exists. If the
 * write is refused, the fulfil still stands and the UNDO will say plainly that it cannot restore
 * the order automatically — which is honest, and better than refusing to finish a stop because a
 * bookkeeping column is missing.
 */
async function remember(
  supabase: SupabaseClient, businessId: string, stopId: string, status: string | null,
): Promise<void> {
  try {
    // 🔴 THROUGH `updateStop`, THE STOP'S ONE WRITER — not a second `deliveries` update of our
    // own (§6 r8). The write-paths cap flagged the forked version and was right to: a table with
    // two writers is a table whose count check, permission message and TRACE line drift apart.
    // The outcome is deliberately not surfaced — see the header: a missing column must not stop
    // a stop from finishing, and the UNDO is where the consequence is reported.
    await updateStop(supabase, businessId, stopId, { order_status_before_finish: status },
      'What this stop\'s order was before it was fulfilled');
  } catch { /* the column is not there yet — see the header */ }
}

/** What this stop remembered, or null — including when the column is not there yet (see below). */
async function rememberedStatus(
  supabase: SupabaseClient, businessId: string, stopId: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.from('deliveries')
      .select('order_status_before_finish')
      .eq('business_id', businessId).eq('id', stopId).maybeSingle();
    if (error || !data) return null;
    return (data as { order_status_before_finish: string | null }).order_status_before_finish ?? null;
  } catch { return null; }
}

/** The order's status right now, or null if it cannot be read. */
async function currentStatus(
  supabase: SupabaseClient, businessId: string, orderId: string,
): Promise<string | null> {
  const { data, error } = await supabase.from('orders')
    .select('status').eq('business_id', businessId).eq('id', orderId).maybeSingle();
  if (error || !data) return null;
  return (data as { status: string | null }).status ?? null;
}

/** FINISH → fulfil the order behind this stop. */
export async function fulfilOrderForStop(
  supabase: SupabaseClient, businessId: string,
  stop: { id: string; order_id: string | null }, mayChangeOrders: boolean,
): Promise<StopOrderOutcome> {
  // 🔴 A STOP WITH NO ORDER IS ORDINARY, NOT AN ERROR — one of LAWNS's 45 has none (measured
  // 2026-09-21). It finishes and there is nothing to fulfil.
  if (!stop.order_id) return { kind: 'no-order' };
  if (!mayChangeOrders) return { kind: 'not-allowed', message: NOT_ALLOWED };

  const before = await currentStatus(supabase, businessId, stop.order_id);
  if (before === 'fulfilled') return { kind: 'already' };

  const r = await setStatus(supabase, businessId, stop.order_id, 'fulfilled');
  if (!r.ok) return { kind: 'failed', message: `The stop is finished. ${r.message}` };
  await remember(supabase, businessId, stop.id, before);
  return { kind: 'fulfilled', from: before };
}

/** UNDO DONE → put the order back where it was, so stock returns with it. */
export async function restoreOrderForStop(
  supabase: SupabaseClient, businessId: string,
  stop: { id: string; order_id: string | null },
  mayChangeOrders: boolean,
): Promise<StopOrderOutcome> {
  if (!stop.order_id) return { kind: 'no-order' };

  // 🔴 READ IT HERE, NOT FROM THE SCHEDULE'S OWN SELECT, AND THE REASON IS DEPLOYMENT ORDER.
  // `order_status_before_finish` arrives in `20260923`, which David applies in the morning. Adding
  // it to the stop list's column string would make the ENTIRE schedule fail to load until then —
  // PostgREST refuses a select naming a column that does not exist. One tolerant read, on the one
  // path that needs it, keeps the page working either side of the migration.
  const back = await rememberedStatus(supabase, businessId, stop.id);
  if (!back) {
    // 🔴 NOTHING TO PUT BACK IS NOT THE SAME AS NOTHING TO DO, AND THE DIFFERENCE IS STOCK.
    // If the order is sitting at `fulfilled` and we cannot say what it was, the units are still
    // decremented. Say so rather than leaving a quiet mismatch.
    const now = await currentStatus(supabase, businessId, stop.order_id);
    if (now !== 'fulfilled') return { kind: 'no-order' };
    return { kind: 'nothing-remembered', message:
      'The stop is reopened, but its order is still marked fulfilled and we do not know what it '
      + 'was before — set it on the order itself, or the stock stays sold.' };
  }
  if (!mayChangeOrders) return { kind: 'not-allowed', message:
    'The stop is reopened. Its order is still marked fulfilled, because changing an order needs '
    + 'permission to change orders — ask an owner or manager.' };

  const r = await setStatus(supabase, businessId, stop.order_id, back);
  if (!r.ok) return { kind: 'failed', message: `The stop is reopened. ${r.message}` };
  await remember(supabase, businessId, stop.id, null);   // forget: there is nothing to put back now
  return { kind: 'restored', to: back };
}

/** The sentence a screen shows for an outcome, or null when there is nothing worth saying. */
export function stopOrderNote(o: StopOrderOutcome): { text: string; bad: boolean } | null {
  switch (o.kind) {
    case 'fulfilled': return { text: 'Stop finished, and its order is marked fulfilled.', bad: false };
    case 'restored':  return { text: `Stop reopened, and its order is back to ${o.to}.`, bad: false };
    case 'not-allowed':
    case 'failed':
    case 'nothing-remembered': return { text: o.message, bad: true };
    case 'no-order':
    case 'already':
    default: return null;
  }
}
