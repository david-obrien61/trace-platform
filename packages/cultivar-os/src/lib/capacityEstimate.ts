// ============================================================
// capacityEstimate — HOW LONG THIS DAY LOOKS, AND WHETHER IT WANTS A SECOND TEAM
//
// PURPOSE:      David's rule, 2026-09-21 (ledger #375, teams piece 2.5): *"Suggest ONE team until
//               the estimated day exceeds X hours; TWO above that."* X is a per-business setting —
//               7 at LAWNS — and planting time per tree is another, defaulted to 30 minutes until
//               Start/Done taps can measure it.
//
//               🔴 IT SUGGESTS. IT DOES NOT DECIDE. *"Lauren decides — if she says one team, that
//               stands."* Every estimate is overridable and the override is what is recorded. A
//               number that overruled the person who can see the yard would be worse than no
//               number at all.
//
//               🔴 EVERY ESTIMATE SHOWS ITS WORKING — trees, gallons, planting minutes, drive
//               minutes and miles — because a figure nobody can check is a figure nobody should
//               act on. `because` on each line says where the number came from, including when it
//               came from a DEFAULT rather than from this nursery's own setting (D-9).
//
// DEPENDENCIES: none — PURE. No db, no clock, no DOM. The caller supplies the day's trees and the
//               optimiser's own miles/minutes (piece 2 stores them on `delivery_route_plans`).
// OUTPUTS:      CapacityInputs · CapacityLine · CapacityEstimate · estimateDay · CAPACITY_COPY
//
// AC-1: no vertical noun. A stop is a stop; a tree is this vertical's word and it arrives as a
//       COUNT from the caller, never as a table name.
// ============================================================

/** What the day is made of, as values. The caller reads these; this file only arithmetic. */
export interface CapacityInputs {
  /** How many stops the day has. Reported, never multiplied — driving between them is `driveMinutes`. */
  stops: number;
  /** How many trees across those stops. */
  trees: number;
  /**
   * Container gallons summed over the trees whose size COULD be read. `null` = none could.
   *
   * 🔴 THIS IS NOW MULTIPLIED INTO TIME, REVERSING #375's RECORDED DECISION ON DAVID'S RULING
   *    (2026-09-25): *"trees × container gallons × MINUTES PER GALLON (LAWNS: 1 min/gal)."* #375
   *    wrote it down as reported-never-multiplied because nothing had measured that a 45 gal takes
   *    proportionally longer than a 15 gal. **David has now measured it on his own crews**, so the
   *    coefficient is the owner's figure rather than our invention — and it is a per-business
   *    SETTING, so a nursery that plants at a different rate holds a different number.
   * ⚠️ A PARTIAL SUM, DELIBERATELY — and this too reverses #375, which made the whole total `null`
   *    if ANY tree's size was unreadable. David: *"a tree with no readable size shows 'size unknown
   *    — not counted', never 0."* Discarding the eleven trees you CAN measure because the twelfth is
   *    unreadable is not caution, it is throwing away the answer.
   */
  gallons: number | null;
  /**
   * How many of `trees` had NO readable container size.
   * 🔴 NEVER FOLDED INTO THE TOTAL AS ZERO. It is reported on its own line as *"size unknown — not
   *    counted"*, so the estimate is honestly a FLOOR rather than quietly short (D-9 / A9).
   */
  treesSizeUnknown: number;
  /** The OPTIMISER's own drive time for the day, in minutes. `null` = it did not report one. */
  driveMinutes: number | null;
  /** The OPTIMISER's own miles. `null` = it did not report them. Shown, never multiplied. */
  miles: number | null;
}

/** The per-business figures. Both live in `business_operations_config.config` — no new table. */
export interface CapacitySettings {
  /** X. Above this many estimated hours, suggest a second team. LAWNS = 7. */
  dayHoursBeforeSecondTeam: number;
  /** Minutes to plant ONE GALLON of container. LAWNS = 1 (David, 2026-09-25). */
  plantingMinutesPerGallon: number;
  /** Minutes to plant one tree — kept ONLY as the figure a size-unknown tree would have used. */
  plantingMinutesPerTree: number;
  /** True when these came from this nursery's saved settings; false when they are the defaults. */
  fromSettings: boolean;
}

/** One line of the working, with where its number came from. */
export interface CapacityLine {
  label: string;
  value: string;
  because: string;
}

export interface CapacityEstimate {
  /** Planting minutes = readable container gallons × plantingMinutesPerGallon. */
  plantingMinutes: number;
  /** How many trees could not be sized, and so are NOT in `plantingMinutes`. */
  treesNotCounted: number;
  /** The optimiser's drive minutes, or 0 when it reported none — see `driveKnown`. */
  driveMinutes: number;
  /** 🔴 FALSE means the total is a FLOOR, not an estimate. Never quietly treated as zero drive. */
  driveKnown: boolean;
  /** Planting + drive, in hours. */
  totalHours: number;
  /** 1 or 2. What the rule suggests — never what happens. */
  suggestedTeams: number;
  /** The X this was measured against, carried so a snapshot can be read without the settings. */
  thresholdHours: number;
  /** Every figure, with its provenance. */
  working: CapacityLine[];
  /** One sentence for the screen. */
  headline: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Estimate one day.
 *
 * 🔴 THE RULE IS A THRESHOLD, NOT A DIVISION. Above X, suggest TWO — not `ceil(hours / X)`. David
 *    said one team or two; a rule that can propose four teams to a nursery that has three is a
 *    rule nobody asked for, and the day it first says "4" is the day the estimate stops being
 *    believed. If a third team is ever wanted, that is a ruling, not an inference.
 *
 * 🔴 UNKNOWN DRIVE TIME IS NOT ZERO DRIVE TIME (D-9 / A9). When the optimiser reported no minutes
 *    the total is a FLOOR — the day is AT LEAST this long — and `driveKnown` is false so every
 *    surface can say so. Treating the absence as 0 would make an unrouted day look shorter than a
 *    routed one, which is exactly backwards and would suppress the second-team suggestion on the
 *    days that most need it.
 */
export function estimateDay(input: CapacityInputs, settings: CapacitySettings): CapacityEstimate {
  const perGallon = Math.max(0, settings.plantingMinutesPerGallon);
  const countedGallons = input.gallons == null ? 0 : Math.max(0, input.gallons);
  const treesNotCounted = Math.max(0, input.treesSizeUnknown);
  // 🔴 GALLONS × MINUTES-PER-GALLON, and a tree with no readable size contributes NOTHING rather
  //    than a zero or a guess. `treesNotCounted` carries it to the surface instead.
  const plantingMinutes = Math.round(countedGallons * perGallon);
  const driveKnown = input.driveMinutes != null;
  const driveMinutes = driveKnown ? Math.max(0, input.driveMinutes as number) : 0;
  const totalHours = round1((plantingMinutes + driveMinutes) / 60);
  const suggestedTeams = totalHours > settings.dayHoursBeforeSecondTeam ? 2 : 1;

  const src = settings.fromSettings ? 'this nursery’s setting' : 'the standard figure — not set for this nursery';
  const working: CapacityLine[] = [
    { label: 'Stops', value: String(input.stops), because: 'the stops on this day' },
    { label: 'Trees', value: String(input.trees), because: 'counted from the orders on those stops' },
    { label: 'Container gallons',
      value: input.gallons == null ? 'none could be read' : String(Math.round(countedGallons)),
      because: treesNotCounted > 0
        ? `summed over the ${Math.max(0, input.trees) - treesNotCounted} tree${Math.max(0, input.trees) - treesNotCounted === 1 ? '' : 's'} whose size could be read`
        : 'summed over every tree on the day' },
    // 🔴 EVERY FIGURE SHOWS ITS WORKING, in David's own form: "3 × 15 gal × 1 min = 45 min".
    { label: 'Planting time', value: `${round1(plantingMinutes / 60)} h (${plantingMinutes} min)`,
      because: input.gallons == null
        ? `no container size could be read, so no planting time is counted — ${src}`
        : `${Math.round(countedGallons)} gal × ${perGallon} min = ${plantingMinutes} min — ${src}` },
    ...(treesNotCounted > 0 ? [{
      label: 'Trees not counted',
      value: `${treesNotCounted} — size unknown`,
      // 🔴 David's exact words: "a tree with no readable size shows 'size unknown — not counted',
      //    never 0." A zero would read as "no work", which is the one thing it is not.
      because: `no readable container size, so ${treesNotCounted === 1 ? 'it is' : 'they are'} NOT in the planting time above — this day is longer than it looks`,
    }] : []),
    { label: 'Drive time',
      value: driveKnown ? `${round1(driveMinutes / 60)} h (${driveMinutes} min)` : 'not known',
      because: driveKnown ? 'the optimiser’s own answer for the saved route' : 'this day has not been routed, so the total below is a FLOOR' },
    { label: 'Miles', value: input.miles == null ? 'not known' : String(round1(input.miles)),
      because: input.miles == null ? 'the optimiser did not report them' : 'the optimiser’s own answer; shown, never multiplied' },
    { label: 'Estimated day', value: `${totalHours} h${driveKnown && treesNotCounted === 0 ? '' : ' at least'}`,
      because: !driveKnown && treesNotCounted > 0 ? `planting for the sized trees only — drive time is not known AND ${treesNotCounted} tree${treesNotCounted === 1 ? '' : 's'} could not be sized`
        : !driveKnown ? 'planting only — drive time is not known yet'
        : treesNotCounted > 0 ? `planting + drive, but ${treesNotCounted} tree${treesNotCounted === 1 ? '' : 's'} could not be sized, so the real day is longer`
        : 'planting + drive' },
    { label: 'Second team above', value: `${settings.dayHoursBeforeSecondTeam} h`, because: src },
  ];

  const atLeast = driveKnown && treesNotCounted === 0 ? '' : ' at least';
  const headline = suggestedTeams === 2
    ? `This day looks like ${totalHours} h${atLeast} — longer than ${settings.dayHoursBeforeSecondTeam} h, so two teams are suggested.`
    : `This day looks like ${totalHours} h${atLeast} — within ${settings.dayHoursBeforeSecondTeam} h, so one team is suggested.`;

  return { plantingMinutes, treesNotCounted, driveMinutes, driveKnown, totalHours, suggestedTeams,
           thresholdHours: settings.dayHoursBeforeSecondTeam, working, headline };
}

export const CAPACITY_COPY = {
  suggestionOnly: 'This is a suggestion. You decide how many teams go out — if you say one team, that stands.',
  floorNote: 'This day has not been routed yet, so drive time is not counted. The real day is longer than this.',
  overrideKept: 'Your choice is what gets recorded, beside the estimate it was made against.',
  learnLater: 'Planting time is container gallons times the minutes-a-gallon rate in Settings → Operations. Change the rate there and every day re-reads it.',
  sizeUnknown: 'A tree whose container size cannot be read is listed as "size unknown — not counted". It is never counted as zero, so a day carrying one is longer than the estimate says.',
};
