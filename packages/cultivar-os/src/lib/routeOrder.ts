// ============================================================
// routeOrder — SAVING the order Lauren just planned (ledger #351)
//
// PURPOSE:      "Route this day" optimises the stops in the browser and, until now, threw the answer
//               away: the list and the driver's text were derived from it and nothing was written, so
//               the crew page could only show the order the stops were created in. David, 2026-09-17:
//               *"Lauren's ROUTE THIS DAY optimisation is a feature she values and uses every delivery
//               day. If the driver follows the phone, he works against the order she planned."*
//               This is the one client call that writes it: `save_route_order` (20260917e) checks
//               `deliveries:update` server-side and refuses any id that is not that day's stop.
// DEPENDENCIES: a Supabase client (Lauren's own session).
// OUTPUTS:      saveRouteOrder · routeOrderLine (what a reader is told about the plan) · dayRoutedAt
//               · routeRefusalText (the server's refusal, in the words the person needs)
//
// 🔴 ONE TEAM AT A TIME ([[R-169]], David 2026-09-22 — ledger #362 piece 2). Saturday 2026-09-19:
//    Lauren routed Team 1's four stops and Team 2's saved order vanished, twice. The cause was one
//    clause of `save_route_order` clearing every stop ON THE DAY that was not in the list. The
//    writer is now team-scoped, and this caller PASSES THE TEAM it is routing. Two refusals it
//    must surface rather than swallow: a stop with no team (named), and a set spanning two teams.
//
// 🔴 NEVER SAVE AN UN-OPTIMISED LIST. David's ruling, agreed 2026-09-17: a saved order is a claim
//    that a plan was made. The caller passes the OPTIMISER's answer or nothing at all; a day where
//    Directions could not run stays "not routed" and every surface says so in plain words.
// AC-1: no vertical noun. A stop is a stop, a day is a day.
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js';

const TRACE_ROUTE = true; // [TRACE:ROUTE] STD-003 — ON until David owner-proves

type SaveRouteOutcome =
  | { ok: true; saved: number; droppedFromPlan: number; routedAt: string; teamName: string | null }
  | { ok: false; code: string; message: string };

/** What the optimiser reported for this route, kept AS AT THE SAVE and never recomputed.
 *  NOT exported: every caller passes an object literal, so structural typing covers it and an
 *  exported type nobody imports is dead surface. */
interface RouteEffort { miles?: number | null; minutes?: number | null }

/**
 * Write the day's sequence. `stopIds` is the optimised order, first stop first.
 * Re-routing replaces: the same call with a new order overwrites the old one and re-stamps it —
 * 🔴 but ONLY within `teamId`. A null `teamId` routes the unsplit day, which is what a business
 * that has never split one has, and is the behaviour every day had before teams existed.
 *
 * `effort` is the optimiser's OWN miles and minutes. They are stored as a SNAPSHOT: piece 2.5's
 * learning loop compares what was estimated against what happened, and a number recomputed later
 * from changed settings would be comparing the estimate against itself.
 */
export async function saveRouteOrder(
  db: SupabaseClient, businessId: string, serviceDate: string, stopIds: string[],
  teamId: string | null = null, effort: RouteEffort = {},
): Promise<SaveRouteOutcome> {
  const { data, error } = await db.rpc('save_route_order', {
    p_business_id: businessId, p_service_date: serviceDate, p_stop_ids: stopIds,
    p_team_id: teamId, p_miles: effort.miles ?? null, p_minutes: effort.minutes ?? null,
  });
  if (error) {
    // The deploy-order case, named rather than left as a raw PostgREST code: this screen shipped
    // before the migration was applied only if something went wrong, and it should say which.
    const code = (error as { code?: string }).code;
    if (TRACE_ROUTE) console.log('[TRACE:ROUTE] save_route_order failed', { serviceDate, code, message: error.message });
    if (code === 'PGRST202') {
      // ✏️ NAMES 20260923b, NOT 20260917e. The call now carries six arguments, so an un-applied
      // piece-2 migration is what PostgREST cannot resolve — pointing at the older migration would
      // send David to a file he already applied ([[R-26]]'s shape, in an error message).
      return { ok: false, code: 'needs_migration',
        message: 'Routing by team needs the database update (20260923b) — it has not been applied yet.' };
    }
    return { ok: false, code: 'error', message: error.message };
  }
  const d = data as { ok: boolean; code?: string; message?: string; saved?: number; dropped_from_plan?: number; routed_at?: string; team_name?: string | null };
  if (TRACE_ROUTE) console.log('[TRACE:ROUTE] route order saved', { serviceDate, teamId, ok: d?.ok, code: d?.code, saved: d?.saved, dropped: d?.dropped_from_plan });
  if (!d?.ok) return { ok: false, code: d?.code ?? 'error', message: d?.message ?? 'The route order was not saved.' };
  return { ok: true, saved: d.saved ?? stopIds.length, droppedFromPlan: d.dropped_from_plan ?? 0,
           routedAt: d.routed_at ?? '', teamName: d.team_name ?? null };
}

/**
 * The refusal, in the words the person needs. 🔴 THE SERVER'S MESSAGE WINS whenever it sent one:
 * it is the only party that knows WHICH stop has no team or WHICH other team is in the set, and a
 * local rewording would drop exactly the part that makes the refusal actionable ([[R-169]]).
 */
export function routeRefusalText(code: string, serverMessage?: string | null): string {
  if (serverMessage && serverMessage.trim()) return serverMessage.trim();
  switch (code) {
    case 'stop_without_team':
      return 'One of these stops has no team — assign it to a team first.';
    case 'mixed_teams':
      return 'That set covers more than one team. Route one team at a time.';
    case 'team_required':
      return 'These stops belong to a team. Open the day for that team and route it on its own.';
    case 'team_not_available':
      return 'That team is not on this business, or it has been retired.';
    case 'not_permitted':
      return 'You need permission to change deliveries to save a route.';
    case 'needs_migration':
      return 'Routing by team needs the database update (20260923b) — it has not been applied yet.';
    default:
      return 'The route order was not saved.';
  }
}

/**
 * What a reader is told about the plan. ONE function, so the surfaces cannot drift apart (STD-011) —
 * but TWO audiences for the unplanned case, by David's ruling (2026-09-18):
 *   · `crew`   — the crew's phone and the printed day sheet: *"Not the planned route — follow the
 *                order in Lauren's text."* The reader cannot fix it; they are told what to follow.
 *   · `office` — Lauren's own schedule: *"Not routed yet — press Route this day."* She is the one
 *                person who CAN fix it, so her screen names the action rather than the workaround.
 * A PLANNED day reads the same everywhere: "route order · planned 9:12 AM".
 */
export function routeOrderLine(routedAt: string | null | undefined, audience: 'crew' | 'office'): string {
  if (!routedAt) {
    return audience === 'office'
      ? 'Not routed yet — press Route this day.'
      : 'Not the planned route — follow the order in Lauren’s text.';
  }
  const t = new Date(routedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `route order · planned ${t}`;
}

/**
 * When a day was planned, from its own stops: the latest `routed_at` among the stops IN the plan.
 * The crew page gets the same answer from the server (`crew_day_read`); the schedule and the printed
 * day sheet compute it here from the ONE read they already hold, so the three agree by construction.
 */
export function dayRoutedAt(stops: { route_position?: number | null; routed_at?: string | null }[]): string | null {
  let latest: string | null = null;
  for (const s of stops) {
    if (s.route_position == null || !s.routed_at) continue;
    if (!latest || s.routed_at > latest) latest = s.routed_at;
  }
  return latest;
}
