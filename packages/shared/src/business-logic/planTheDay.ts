// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      PLAN THE DAY — propose how a day's stops split into one route per crew, balancing
//               drive time + planting time against the day limit. Proposes; never decides.
// DEPENDENCIES: deliveryRings (distanceMiles). Pure — no network, no optimiser call, no React.
// OUTPUTS:      planTheDay() · plantingMinutes() · DayPlan · CrewPlan.
//
// ═════════════════════════════════════════════════════════════════════════════
// §6 r16 — THE STANDARD, NAMED
// ═════════════════════════════════════════════════════════════════════════════
// This is the VEHICLE ROUTING PROBLEM with a duration limit. At two crews and a few dozen stops
// the established approach is **CLUSTER-FIRST, ROUTE-SECOND** — specifically the SWEEP algorithm
// (Gillett & Miller, 1974): order the stops by their bearing from the depot, then cut that sweep
// into contiguous arcs. Contiguity is the whole point: a crew's stops end up in one wedge of the
// map rather than interleaved with the other crew's, which is what makes the routes short.
// Balancing then moves the cut, not individual stops, so each crew keeps a coherent area.
//
// 🔴 IT DOES NOT ROUTE. The existing optimiser routes each cluster — that is the "route-second"
// half and it already exists (crew-link, `teamRouteGate.ts` / `DeliveryRoute.tsx`). Re-implementing
// it here would be the near-duplicate §6 r8 forbids. This file decides WHO GETS WHICH STOPS.
//
// 🔴 DRIVE TIME IS INJECTED, NOT INVENTED. The caller passes the estimator, so the proposal can be
// built on the real optimiser's numbers. The straight-line default is explicitly labelled an
// ESTIMATE wherever it is shown, because a truck never drives the crow's flight.
//
// ── EVERY FIGURE SHOWS ITS WORKING (David, 2026-09-24) ──────────────────────────────────────
// A crew's hours arrive as {driveMinutes, plantingMinutes, stops, trees} — never a single total —
// because Lauren has to be able to check it. A number she cannot take apart is a number she will
// not trust, and she is right not to.
// ─────────────────────────────────────────────────────────────────────────────
import { distanceMiles, type Point } from './deliveryRings';

export interface DayStop extends Partial<Point> {
  id: string;
  name?: string | null;
  /** How many trees go to this stop. */
  trees: number;
  /** Total container gallons across those trees — the planting-time driver. */
  gallons: number;
}

export interface CrewPlan {
  crew: number;
  stopIds: string[];
  stops: number;
  trees: number;
  driveMinutes: number;
  plantingMinutes: number;
  totalMinutes: number;
  /** Over the day limit even after balancing? Shown, never hidden. */
  overLimit: boolean;
}

export interface DayPlan {
  crews: CrewPlan[];
  /** Stops with no stored location — SHOWN, never guessed and never silently planned. */
  unplaceable: { id: string; name?: string | null }[];
  /** The sentence for the screen. */
  message: string;
  /** Whether the drive figures came from the real optimiser or the straight-line estimate. */
  driveBasis: 'optimiser' | 'straight-line estimate';
}

/**
 * Planting time for one stop: trees × gallons × minutes-per-gallon.
 *
 * ⚠️ `minutesPerGallon` IS A PER-BUSINESS SETTING. LAWNS is 1; writing 1 into this file would be
 * the hardcoded tenant literal §6 r12 caps a capability at amber for, and the next nursery plants
 * at a different rate.
 */
export function plantingMinutes(stop: DayStop, minutesPerGallon: number): number {
  const g = Number.isFinite(stop.gallons) ? stop.gallons : 0;
  return Math.max(0, g) * Math.max(0, minutesPerGallon);
}

/** Bearing from the depot, 0–2π. The sweep's ordering key. */
function bearing(depot: Point, s: DayStop): number {
  const dx = (s.longitude as number) - depot.longitude;
  const dy = (s.latitude as number) - depot.latitude;
  const a = Math.atan2(dy, dx);
  return a < 0 ? a + 2 * Math.PI : a;
}

function located(s: DayStop): boolean {
  return typeof s.latitude === 'number' && typeof s.longitude === 'number'
    && !Number.isNaN(s.latitude) && !Number.isNaN(s.longitude);
}

export interface PlanInput {
  stops: readonly DayStop[];
  depot: Point | null;
  minutesPerGallon: number;
  /** The day limit, in hours. LAWNS is 7 — a per-business setting, never a constant here. */
  dayLimitHours: number;
  /** The most crews available. LAWNS runs two. */
  maxCrews?: number;
  /**
   * Drive minutes for an ordered set of stops. Pass the real optimiser's figure; the default is a
   * straight-line estimate and is LABELLED as one wherever it is shown.
   */
  driveMinutes?: (depot: Point, stops: readonly DayStop[]) => number;
  /** Average road speed for the fallback estimate, mph. A caller's number, not a constant. */
  estimateMph?: number;
}

/** A crow's-flight out-and-back estimate. Deliberately crude, and never presented as measured. */
function estimateDrive(depot: Point, stops: readonly DayStop[], mph: number): number {
  if (stops.length === 0) return 0;
  // Sum of depot→stop legs around the wedge, plus the return. A real route is shorter than this
  // sum and longer than the crow's flight; it is an ESTIMATE and the plan says so.
  let miles = 0;
  let prev: Point = depot;
  for (const s of stops) {
    miles += distanceMiles(prev, s as Point) ?? 0;
    prev = s as Point;
  }
  miles += distanceMiles(prev, depot) ?? 0;
  return (miles / Math.max(1, mph)) * 60;
}

function summarise(crew: number, stops: DayStop[], depot: Point, x: PlanInput): CrewPlan {
  const drive = x.driveMinutes ? x.driveMinutes(depot, stops) : estimateDrive(depot, stops, x.estimateMph ?? 35);
  const planting = stops.reduce((m, s) => m + plantingMinutes(s, x.minutesPerGallon), 0);
  const total = drive + planting;
  return {
    crew,
    stopIds: stops.map(s => s.id),
    stops: stops.length,
    trees: stops.reduce((t, s) => t + (Number.isFinite(s.trees) ? s.trees : 0), 0),
    driveMinutes: Math.round(drive),
    plantingMinutes: Math.round(planting),
    totalMinutes: Math.round(total),
    overLimit: total > x.dayLimitHours * 60,
  };
}

/**
 * Propose the split.
 *
 * 🔴 ONE CREW UNTIL THE DAY EXCEEDS THE LIMIT, THEN TWO (David, 2026-09-24). Not "two crews
 * because there are two" — sending a second crew out on a day one can finish costs a wage for
 * nothing, and Lauren is the one who has to justify it.
 *
 * 🔴 A STOP WITH NO LOCATION IS RETURNED SEPARATELY AND NEVER PLANNED. David's 2026-09-18 rule:
 * shown, not guessed. Quietly planning the placeable subset would give a confident total for a
 * day that has more work in it than the screen admits.
 */
export function planTheDay(x: PlanInput): DayPlan {
  const basis: DayPlan['driveBasis'] = x.driveMinutes ? 'optimiser' : 'straight-line estimate';
  const unplaceable = x.stops.filter(s => !located(s)).map(s => ({ id: s.id, name: s.name ?? null }));
  const placeable = x.stops.filter(located);

  if (!x.depot) {
    return { crews: [], unplaceable: x.stops.map(s => ({ id: s.id, name: s.name ?? null })), driveBasis: basis,
      message: 'Your own address has no location yet, so nothing can be measured from it.' };
  }
  if (placeable.length === 0) {
    return { crews: [], unplaceable, driveBasis: basis,
      message: unplaceable.length
        ? `${unplaceable.length} stop${unplaceable.length === 1 ? '' : 's'} can't be placed yet — nothing to plan until they are.`
        : 'No stops on this day.' };
  }

  const one = summarise(1, [...placeable], x.depot, x);
  const maxCrews = Math.max(1, x.maxCrews ?? 2);

  if (!one.overLimit || maxCrews === 1) {
    return { crews: [one], unplaceable, driveBasis: basis, message: messageFor([one], unplaceable, basis) };
  }

  // ── CLUSTER-FIRST: the sweep. Order by bearing, then cut the circle at the point that balances
  // the two crews best. Cutting a SWEEP keeps each crew in one wedge; cutting an arbitrary list
  // would balance the hours and scatter the driving.
  const swept = [...placeable].sort((a, b) => bearing(x.depot as Point, a) - bearing(x.depot as Point, b));
  let best: { a: CrewPlan; b: CrewPlan; gap: number } | null = null;
  for (let offset = 0; offset < swept.length; offset++) {
    const rotated = swept.slice(offset).concat(swept.slice(0, offset));
    for (let cut = 1; cut < rotated.length; cut++) {
      const a = summarise(1, rotated.slice(0, cut), x.depot as Point, x);
      const b = summarise(2, rotated.slice(cut), x.depot as Point, x);
      // 🔴 MINIMISE THE LONGER DAY (makespan), NOT THE NUMBER OF CREWS OVER THE LIMIT.
      // The first version scored `over ? 1e6 : 0` per crew and it was PERVERSE — a probe caught
      // it. On a day needing 1,872 minutes it preferred FIVE STOPS AND ONE (one crew 26 hours,
      // one crew 5) over three and three (both ~15.6h), because that is one penalty instead of
      // two. It was optimising the count of unhappy crews rather than anybody's day.
      // Minimising the larger total is the standard objective for splitting work across two
      // machines, and it does the right thing in BOTH cases: where a split exists that keeps both
      // crews under the limit it finds it, and where none does it balances the overrun instead of
      // dumping it on one person. The tie-break keeps the days even when the longer one is equal.
      const longer = Math.max(a.totalMinutes, b.totalMinutes);
      const gap = longer * 1000 + Math.abs(a.totalMinutes - b.totalMinutes);
      if (!best || gap < best.gap) best = { a, b, gap };
    }
  }
  const crews = best ? [best.a, best.b] : [one];
  return { crews, unplaceable, driveBasis: basis, message: messageFor(crews, unplaceable, basis) };
}

function hm(min: number): string {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function messageFor(crews: CrewPlan[], unplaceable: { id: string }[], basis: DayPlan['driveBasis']): string {
  const parts = crews.map(c => `Crew ${c.crew}: ${hm(c.totalMinutes)} (${hm(c.driveMinutes)} driving${basis === 'straight-line estimate' ? ', estimated' : ''} + ${hm(c.plantingMinutes)} planting, ${c.stops} stop${c.stops === 1 ? '' : 's'})`);
  if (crews.length === 1) parts.unshift('One crew can do this day.');
  if (unplaceable.length) parts.push(`${unplaceable.length} stop${unplaceable.length === 1 ? '' : 's'} can't be placed yet`);
  const over = crews.filter(c => c.overLimit);
  if (over.length) parts.push(`${over.length === crews.length ? 'Both crews are' : `Crew ${over[0].crew} is`} over the day limit — move stops or add a day.`);
  return parts.join(' · ');
}
