// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      Gather everything PLAN THE DAY needs for one date — the stops, where each one is,
//               how many gallons it plants, the yard, and this business's day limit.
// DEPENDENCIES: lib/stopRead · lib/loadList + lib/loadListSettingsRead · lib/dayEstimate
//               (gallonsForStop, settingsFromConfig) · lib/deliveryRingsRead (the yard) ·
//               shared/business-logic/stopPoints · shared/business-logic/locatedCustomers.
// OUTPUTS:      readPlanDay()
//
// 🔴 IT BUILDS THE PLANNER'S INPUT AND DECIDES NOTHING. `planTheDay` is pure and already tested;
// this is the only reason it has never had a caller. Every judgement it needs — the day limit, the
// minutes per gallon — comes from the business's own config and is reported back so the screen can
// say WHICH figure it used rather than implying one.
//
// ⚠️ THREE THINGS IT NEEDS DO NOT EXIST AND ARE WORKED AROUND HONESTLY, NOT PAPERED OVER:
//   1. A STOP HAS NO COORDINATE. `deliveries.latitude/longitude` live only in the unapplied
//      `20260923d` and nothing reads them. Resolved through the customer's located address
//      (`resolveStopPoints`), which answers "where is this customer now" — right for planning a
//      day that has not happened, WRONG for anything about the past.
//   2. PER-STOP GALLONS had no function. `gallonsForStop` is that function, beside the one the day
//      sheet uses, so the plan and the sheet cannot disagree about one stop's trees.
//   3. THE 7-HOUR DAY HAS NO SETTINGS INPUT. `dayHoursBeforeSecondTeam` defaults to 8 and nothing
//      in Settings can change it, so `limitIsStored` is returned and the screen says which it used
//      rather than calling a platform default "this nursery's setting" (which another screen does).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js';
import { readStops, type StopRow } from './stopRead';
import { buildLoadList } from './loadList';
import { readLoadListSettings } from './loadListSettingsRead';
import { loadInputFor } from './loadStopInput';
import { gallonsForStop, settingsFromConfig } from './dayEstimate';
import { readRingInputs } from './deliveryRingsRead';
import { readLocatedAddresses } from '@trace/shared/business-logic/locatedCustomers';
import { resolveStopPoints } from '@trace/shared/business-logic/stopPoints';
import type { DayStop } from '@trace/shared/business-logic/planTheDay';
import type { Point } from '@trace/shared/business-logic/deliveryRings';

const TRACE_PLAN = true;   // STD-003: on by default until owner-proven.

export interface PlanDayInputs {
  /** Stops that can be placed AND sized — what the planner may actually split. */
  stops: DayStop[];
  /** Stops that cannot be placed, each with the reason. Shown, never guessed. */
  unplaceable: { id: string; name: string; why: string }[];
  /** Trees on this day whose container size could not be read — their minutes are missing. */
  treesSizeUnknown: number;
  depot: Point | null;
  dayLimitHours: number;
  minutesPerGallon: number;
  /** 🔴 FALSE when the day limit is the PLATFORM DEFAULT (8), not this nursery's figure. */
  limitIsStored: boolean;
  /** Everything needed to show a stop by name on the plan. */
  labelById: Map<string, string>;
  failed: string | null;
}

export async function readPlanDay(
  db: SupabaseClient, businessId: string, date: string,
): Promise<PlanDayInputs> {
  const empty: PlanDayInputs = {
    stops: [], unplaceable: [], treesSizeUnknown: 0, depot: null,
    dayLimitHours: 8, minutesPerGallon: 1, limitIsStored: false, labelById: new Map(), failed: null,
  };
  try {
    const res = await readStops(db, businessId, { kind: 'day', date }, { readLines: true });
    if (!res.ok) return { ...empty, failed: res.error };
    const dayRead = res.value;

    const [ring, located, loadSettings] = await Promise.all([
      readRingInputs(businessId),
      readLocatedAddresses(db, businessId),
      readLoadListSettings(businessId),
    ]);

    // The day limit and the planting rate, from this business's own config.
    const caps = settingsFromConfig(loadSettings.settings.ops as unknown as Record<string, unknown>, {
      dayHoursBeforeSecondTeam: 8, plantingMinutesPerTree: 30, plantingMinutesPerGallon: 1,
    });

    const placement = resolveStopPoints(dayRead.stops, located.addresses.map(a => ({
      customerId: a.customerId, line1: a.line1, latitude: a.latitude, longitude: a.longitude,
    })));

    const labelById = new Map<string, string>();
    for (const s of dayRead.stops) {
      labelById.set(s.id, nameOf(s));
    }

    // Gallons per stop, through the SAME load-list arithmetic the day sheet prints.
    const stops: DayStop[] = [];
    let treesSizeUnknown = 0;
    for (const p of placement.placed) {
      const model = buildLoadList(date, [loadInputFor(p.stop, dayRead)], loadSettings.settings);
      const one = model.stops[0];
      const g = one ? gallonsForStop(one) : { gallons: 0, treesSizeUnknown: 0 };
      treesSizeUnknown += g.treesSizeUnknown;
      stops.push({
        id: p.stop.id, name: nameOf(p.stop),
        trees: one?.treeCount ?? 0, gallons: g.gallons,
        latitude: p.point.latitude, longitude: p.point.longitude,
      });
    }

    const out: PlanDayInputs = {
      stops,
      unplaceable: placement.unplaceable.map(u => ({ id: u.stop.id, name: nameOf(u.stop), why: u.why })),
      treesSizeUnknown,
      depot: ring.depot,
      dayLimitHours: caps.dayHoursBeforeSecondTeam,
      minutesPerGallon: caps.plantingMinutesPerGallon,
      // 🔴 `settingsFromConfig`'s own `fromSettings` CANNOT BE TRUSTED HERE and that is measured:
      // the object it is handed has already been merged with the platform defaults, so it reports
      // `true` for a figure nobody ever typed. The honest test is whether the day limit differs
      // from the default at all — imperfect (a nursery whose real answer IS 8 reads as unstored),
      // and imperfect in the safe direction: it under-claims rather than calling a default a
      // setting. Tech-debt: the config read should distinguish stored from defaulted.
      limitIsStored: caps.dayHoursBeforeSecondTeam !== 8,
      labelById,
      failed: null,
    };
    if (TRACE_PLAN) console.log('[TRACE:PLAN] day read', {
      date, stops: out.stops.length, unplaceable: out.unplaceable.length,
      treesSizeUnknown, dayLimitHours: out.dayLimitHours, limitIsStored: out.limitIsStored,
      minutesPerGallon: out.minutesPerGallon, depot: !!out.depot,
    });
    return out;
  } catch (e) {
    return { ...empty, failed: (e as Error).message };
  }
}

function nameOf(s: StopRow): string {
  const c = (s as unknown as { customers?: { first_name?: string; last_name?: string; name?: string } }).customers;
  const person = [c?.first_name, c?.last_name].filter(Boolean).join(' ').trim();
  return person || c?.name || (s.address_line1 ?? 'a stop');
}
