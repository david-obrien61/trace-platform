// ============================================================
// productionMath — THE WHOLE MODEL, PURE. NO I/O, NO CLOCK, NO DATABASE.
//
// PURPOSE:      A production manager decides how much of each variety moves up a container size.
//               This module splits the count four ways, takes his number, holds the rest sellable,
//               and computes the mix, the materials, the pots, the labour and the dates. It writes
//               NOTHING — the whole of stage ① is this file plus a screen.
//
// 🔴 THE SPLIT, IN THIS ORDER. It is the model, and the order is not decorative:
//     ① MUST KEEP SELLABLE = sales a month × cover months. Computed, never guessed.
//     ② CUSHION            = a share on top. 10% default, adjustable per variety.
//     ③ DELTA              = on hand − ① − ②. Everything that COULD go up a size.
//     ④ UPPOT NOW          = the manager's number. Defaults to the whole delta; typed down, the
//                            remainder stays sellable.
//
// 🔴 LABOUR IS SETUP PLUS HANDLING (R-86), AND BATCH SIZE IS THE LEVER, NOT CREW SIZE.
//   `runMinutes(n) = setup + n × handling`. The consequence is the finding:
//     10 pots → 9.0 min/pot · 20 → 6.0 · 60 → 4.0 · 120 → 3.5
//   The same 1,245-pot plan is 187 crew-hours at batches of 10 and 73 at batches of 120. A flat
//   per-pot rate is wrong at every batch size except the one it was measured at, and it hides the
//   only lever the manager actually controls.
//   🔴 AND EVERY SPLIT IS ONE EXTRA SETUP. 40 pots in one run is 3.0 crew-hours; 20 + 20 across two
//   days is 4.0, because setup is paid twice. `splitPenalty` prices it. Offer the split, show what
//   it costs, never hide it.
//
// 🔴 GROUP ON THE UNIT PROJECTION, NEVER ON `size` (R-27 applied). Measured at LAWNS 2026-09-04:
//   447 rows carry **46 distinct spellings** of `size` — "30 gallon", "30 Gallon", "30g",
//   "30 Gallons", "30 gallons", "30Gallon" — which fold to **13 `unit_value` numbers**, and the six
//   spellings of thirty sum to exactly 90, which is the `unit_value = 30` count. Group on the raw
//   string and the split under-counts by up to six ways per rung. `rungKey` is the only grouping
//   key in this module and it reads the projection.
//   ⚠️ A RANGE ("10/15 gallon") HAS NO SINGLE SIZE and is REFUSED, never silently assigned an end —
//   four such rows are live at LAWNS. `classifyLot` returns the refusal with its reason.
//
// 🔴 STILL-SELLABLE SUBTRACTS COMMITTED (workbook defect 2). The workbook's `on hand − uppot now`
//   agrees with the truth only because every `Committed to orders` cell in it is zero. At a live
//   tenant committed is derived from open orders and is not zero, so the workbook's column would
//   tell the manager that stock which is already sold is still available.
//
// DEPENDENCIES: ./basis · ./productionConfig. No date library — `addMonths`/`addWorkingDays` are
//               local and pure, because a plan computed in the browser and a plan computed in a
//               test must agree to the day.
// OUTPUTS:      LotInput · LotPlan · PlanTotals · rungKey · classifyLot · splitLot · planLots ·
//               mixCubicYardsPerPot · runMinutes · minutesPerPot · crewHours · splitPenalty ·
//               potCascade · scheduleBatches · arithmeticCheck · addMonths · addWorkingDays.
// NOT THIS MODULE: reading inventory (../inventory) · the derived hold (./productionHold) · the
//               overdue flags (./productionFlags) · anything that writes.
// AC-1:         generic. No vertical noun. A "lot" is a stock line; a "rung" is a unit size.
// STORY:        user_stories.md → *The growing ladder — potted, waiting, ready, and up a size*.
// ============================================================
import { type BasisKind, type Estimate, fact, suggestion, guess, weakest } from './basis';
import { type OperationsConfig, type ResolvedConfig, coverMonthsFor, OPERATIONS_BASIS } from './productionConfig';

// ════════════════════════════════════════════════════════════════════════════════
// GROUPING — the projection, never the string
// ════════════════════════════════════════════════════════════════════════════════

export interface LotInput {
  id: string;
  name: string;
  /** The raw label the grower typed. Displayed, never compared (D-23 — we do not rewrite it). */
  size: string | null;
  /** DERIVED by `unitOfMeasure`. The low end when the label names a range. */
  unitValue: number | null;
  unitValueMax: number | null;
  unitKind: string | null;
  unitName: string | null;
  /** On hand. `null` means NEVER COUNTED and is not the same as 0 (A9 — absent is not empty). */
  qty: number | null;
  /** Units on open orders, derived elsewhere. Pass 0 only when it is genuinely zero. */
  committed: number;
  /** Where in the yard. Used to sequence tractor trips; `null` means unknown, and it says so. */
  location: string | null;
  salesPerMonth: number | null;
  coverMonths: number | null;
  cushionPct: number | null;
  growMonths: number | null;
}

/**
 * The grouping key for "this variety at this container size".
 *
 * Returns `null` for anything that cannot be placed on a ladder — no projection, a non-container
 * unit, or a RANGE. A null key is what makes the lot appear in the refused list instead of being
 * quietly bucketed under one end of its range.
 */
export function rungKey(lot: LotInput): string | null {
  if (lot.unitKind !== 'container') return null;
  if (lot.unitValue == null || !Number.isFinite(lot.unitValue)) return null;
  if (lot.unitValueMax != null && lot.unitValueMax !== lot.unitValue) return null;
  return `${lot.name.trim().toLowerCase()}|${lot.unitValue}`;
}

export type LotRefusal =
  | { ok: true }
  | { ok: false; reason: 'no_projection' | 'not_container' | 'range' | 'never_counted'; detail: string };

/**
 * Can this lot be planned, and if not, what does the person in front of it need to hear?
 *
 * Order is the order of usefulness. A range is named before a missing count because the range is a
 * data-shape problem the owner can fix, while an uncounted lot is simply work not yet done.
 */
export function classifyLot(lot: LotInput): LotRefusal {
  if (lot.unitKind == null) {
    return { ok: false, reason: 'no_projection', detail: `"${lot.size ?? ''}" has not been read as a unit yet.` };
  }
  if (lot.unitKind !== 'container') {
    return { ok: false, reason: 'not_container', detail: `"${lot.size ?? ''}" is ${lot.unitKind}, not a container size.` };
  }
  if (lot.unitValueMax != null && lot.unitValueMax !== lot.unitValue) {
    return {
      ok: false, reason: 'range',
      detail: `"${lot.size ?? ''}" names a range (${lot.unitValue}–${lot.unitValueMax}). It has no single size, so it cannot be planned until somebody says which it is.`,
    };
  }
  if (lot.qty == null) {
    return { ok: false, reason: 'never_counted', detail: 'Never counted — this is not a count of zero.' };
  }
  return { ok: true };
}

// ════════════════════════════════════════════════════════════════════════════════
// THE FOUR-WAY SPLIT
// ════════════════════════════════════════════════════════════════════════════════

export interface LotSplit {
  onHand: number;
  committed: number;
  mustKeepSellable: number;
  cushion: number;
  delta: number;
  uppotNow: number;
  stillSellable: number;
  /** True when the manager's number was clamped to the delta. The surface says so rather than
   *  silently accepting a number it did not use. */
  clamped: boolean;
  coverMonthsUsed: number;
  cushionPctUsed: number;
}

/**
 * Split one lot four ways. `managerNumber` of `null` means "take the whole delta", which is the
 * default the workbook uses and the behaviour a manager who types nothing should get.
 */
export function splitLot(lot: LotInput, ops: OperationsConfig, managerNumber: number | null): LotSplit {
  const onHand = Number(lot.qty ?? 0);
  const committed = Number(lot.committed ?? 0);
  const cover = coverMonthsFor(ops, lot.coverMonths, lot.growMonths);
  const cushionPct = lot.cushionPct ?? ops.cushionPctDefault;
  const spm = Number(lot.salesPerMonth ?? 0);

  const mustKeepSellable = Math.round(spm * cover);
  const cushion = Math.round(onHand * cushionPct);
  const delta = Math.max(0, onHand - mustKeepSellable - cushion);

  const asked = managerNumber == null ? delta : Math.max(0, Math.floor(managerNumber));
  const uppotNow = Math.min(asked, delta);

  return {
    onHand, committed, mustKeepSellable, cushion, delta, uppotNow,
    // 🔴 COMMITTED IS SUBTRACTED HERE. The workbook's own column omits it and agrees with the truth
    // only because every committed cell in it is zero. Floored at 0: a negative "still sellable" is
    // a data problem to surface, never a number to show a customer.
    stillSellable: Math.max(0, onHand - committed - uppotNow),
    clamped: asked > delta,
    coverMonthsUsed: cover,
    cushionPctUsed: cushionPct,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// MIX
// ════════════════════════════════════════════════════════════════════════════════

/** Cubic yards of mix to take one pot from `fromGal` to `toGal`. Negative steps yield 0, never a
 *  negative volume — moving DOWN a size does not give mix back. */
export function mixCubicYardsPerPot(fromGal: number, toGal: number, ops: OperationsConfig): number {
  const step = Math.max(0, Number(toGal) - Number(fromGal));
  return (step * ops.tradeGallonFactor) / ops.trueGallonsPerCubicYard * (1 + ops.mixShrinkPct);
}

// ════════════════════════════════════════════════════════════════════════════════
// LABOUR — setup plus handling
// ════════════════════════════════════════════════════════════════════════════════

/** Crew-minutes for ONE run of `n` pots. Zero pots is zero minutes — nobody sets up for nothing. */
export function runMinutes(n: number, ops: OperationsConfig): number {
  const pots = Math.max(0, Math.floor(n));
  if (pots === 0) return 0;
  return ops.setupMinutesPerRun + pots * ops.handlingMinutesPerPot;
}

/** The per-pot rate AT THIS BATCH SIZE. This is the number that makes the lever visible. */
export function minutesPerPot(n: number, ops: OperationsConfig): number | null {
  const pots = Math.max(0, Math.floor(n));
  if (pots === 0) return null;
  return runMinutes(pots, ops) / pots;
}

/** Crew-hours for `total` pots done in runs of at most `batchSize`. */
export function crewHours(total: number, batchSize: number, ops: OperationsConfig): number {
  const pots = Math.max(0, Math.floor(total));
  const batch = Math.max(1, Math.floor(batchSize));
  if (pots === 0) return 0;
  const runs = Math.ceil(pots / batch);
  return (runs * ops.setupMinutesPerRun + pots * ops.handlingMinutesPerPot) / 60;
}

/**
 * What splitting a run into `intoRuns` pieces costs: one extra setup per extra piece.
 *
 * Independent of batch size, which is the counter-intuitive part worth surfacing — 40 in one run is
 * 3.0 crew-hours and 20 + 20 is 4.0, and the hour is the setup, not the pots.
 */
export function splitPenalty(intoRuns: number, ops: OperationsConfig): { extraRuns: number; extraMinutes: number } {
  const runs = Math.max(1, Math.floor(intoRuns));
  const extraRuns = runs - 1;
  return { extraRuns, extraMinutes: extraRuns * ops.setupMinutesPerRun };
}

// ════════════════════════════════════════════════════════════════════════════════
// THE POT CASCADE (R-87)
// ════════════════════════════════════════════════════════════════════════════════

export interface CascadeRung {
  unitValue: number;
  /** Pots of this size the plan CONSUMES (trees arriving at this size). */
  needed: number;
  /** Pots of this size the plan FREES (trees leaving this size). */
  freed: number;
  /** Freed × recovery rate, floored. The rest is binned. */
  reusable: number;
  /** What must actually be bought. */
  buy: number;
}

export interface CascadeResult {
  rungs: CascadeRung[];
  totalBuyDownTheLadder: number;
  /** What the same plan costs in pots if the rungs are worked smallest-first — nothing has been
   *  emptied yet when each rung needs its pots, so every pot is bought. The gap is the finding. */
  totalBuyWorstOrder: number;
  potsSavedBySequence: number;
}

/**
 * Work DOWN the ladder — biggest step first — and the freed pots cascade into the rung below.
 *
 * 🔴 THE WITNESS IS NAMED: Lauren has run out of pots and material mid-uppotting. Every tree
 * leaving a size frees a pot in that size and the rung below needs exactly those, so the ORDER of
 * the work changes what must be bought. You always buy at the top: nothing above the highest rung
 * is being emptied, and that is where pots cost most.
 */
export function potCascade(
  moves: ReadonlyArray<{ fromUnitValue: number; toUnitValue: number; qty: number }>,
  ops: OperationsConfig,
): CascadeResult {
  const needed = new Map<number, number>();
  const freed = new Map<number, number>();
  for (const m of moves) {
    const q = Math.max(0, Math.floor(m.qty));
    if (q === 0) continue;
    needed.set(m.toUnitValue, (needed.get(m.toUnitValue) ?? 0) + q);
    freed.set(m.fromUnitValue, (freed.get(m.fromUnitValue) ?? 0) + q);
  }
  const sizes = [...new Set([...needed.keys(), ...freed.keys()])].sort((a, b) => b - a);

  const rungs: CascadeRung[] = [];
  let totalBuy = 0;
  let worst = 0;
  for (const unitValue of sizes) {
    const n = needed.get(unitValue) ?? 0;
    const f = freed.get(unitValue) ?? 0;
    const reusable = Math.floor(f * ops.potRecoveryRate);
    const buy = Math.max(0, n - reusable);
    rungs.push({ unitValue, needed: n, freed: f, reusable, buy });
    totalBuy += buy;
    worst += n; // smallest-first: nothing has been freed yet when the rung needs its pots
  }
  return {
    rungs,
    totalBuyDownTheLadder: totalBuy,
    totalBuyWorstOrder: worst,
    potsSavedBySequence: worst - totalBuy,
  };
}

/**
 * The sequence to actually work: down the ladder, and WITHIN a rung, by block.
 *
 * 🔴 THE TWO RULES COLLIDE AND THE COLLISION IS REPORTED RATHER THAN RESOLVED SILENTLY. Down the
 * ladder is right for pots; by block is right for tractor trips. Where one block appears at more
 * than one rung, strict rung-order revisits it — one extra setup each time — and this function
 * NAMES those revisits with what they cost so a human can choose to merge them. Picking either
 * rule on its own would hide the trade David asked to see.
 */
export function sequenceRuns(
  moves: ReadonlyArray<{ fromUnitValue: number; toUnitValue: number; qty: number; location: string | null }>,
): {
  order: Array<{ toUnitValue: number; location: string | null; qty: number }>;
  revisits: Array<{ location: string; rungs: number[]; extraRuns: number }>;
  blocksUnknown: number;
} {
  const order = [...moves]
    .filter((m) => m.qty > 0)
    .sort((a, b) => (b.toUnitValue - a.toUnitValue) || String(a.location ?? '~').localeCompare(String(b.location ?? '~')))
    .map((m) => ({ toUnitValue: m.toUnitValue, location: m.location, qty: m.qty }));

  const byLocation = new Map<string, Set<number>>();
  let blocksUnknown = 0;
  for (const m of order) {
    if (m.location == null || m.location.trim() === '') { blocksUnknown += 1; continue; }
    const key = m.location.trim();
    if (!byLocation.has(key)) byLocation.set(key, new Set());
    byLocation.get(key)!.add(m.toUnitValue);
  }
  const revisits = [...byLocation.entries()]
    .filter(([, rungs]) => rungs.size > 1)
    .map(([location, rungs]) => ({
      location,
      rungs: [...rungs].sort((a, b) => b - a),
      extraRuns: rungs.size - 1,
    }));
  return { order, revisits, blocksUnknown };
}

// ════════════════════════════════════════════════════════════════════════════════
// DATES — pure, no clock
// ════════════════════════════════════════════════════════════════════════════════

/** Add whole months to an ISO date, clamping to the last day of the target month. */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Add `n` working days (Mon-Fri) to an ISO date. `n = 0` returns the same day. */
export function addWorkingDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));
  let left = Math.max(0, Math.floor(n));
  while (left > 0) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) left -= 1;
  }
  return cur.toISOString().slice(0, 10);
}

/** Working days from `a` to `b` inclusive of neither end's weekend. Negative when b precedes a. */
export function workingDaysBetween(a: string, b: string): number {
  if (a === b) return 0;
  const sign = a < b ? 1 : -1;
  const [lo, hi] = sign === 1 ? [a, b] : [b, a];
  let count = 0;
  let cur = lo;
  while (cur < hi) {
    cur = addWorkingDays(cur, 1);
    count += 1;
  }
  return count * sign;
}

// ════════════════════════════════════════════════════════════════════════════════
// THE PLAN
// ════════════════════════════════════════════════════════════════════════════════

export interface PlannedBatch {
  lotId: string;
  name: string;
  fromUnitValue: number;
  toUnitValue: number;
  location: string | null;
  split: LotSplit;
  mixPerPot: number;
  mixTotal: number;
  mixCost: number | null;
  /** ONE BATCH, ONE COMPLETION, ONE DATE (R-88). Daily progress is a measurement; the batch is
   *  the event, and it is dated on the day the LAST pot is done — later rather than earlier. */
  startsOn: string | null;
  completesOn: string | null;
  workingDays: number;
  crewHoursAtBatch: number;
  firstSellable: string | null;
  arriveSellable: number;
}

export interface PlanTotals {
  pots: number;
  mixCubicYards: number;
  mixCost: Estimate<number> | null;
  crewHours: Estimate<number>;
  workingDays: Estimate<number>;
  cascade: CascadeResult;
  /** True when the last batch completes after the window closes. Said BEFORE anything is committed. */
  overrunsWindow: boolean;
  lastCompletion: string | null;
  crewUsed: number;
  crewReason: string;
}

/**
 * Build the plan. `managerNumbers` maps lot id → the number he typed; a lot absent from the map
 * takes its whole delta, which is the default.
 *
 * `batchSize` is the lever from R-86 and it is an INPUT, not a constant — the whole point is that
 * the manager can see what moving it does.
 */
export function planLots(
  lots: readonly LotInput[],
  cfg: ResolvedConfig,
  opts: {
    managerNumbers: Record<string, number | null>;
    /** lot id → the unit size it is going to. A lot with no target is not in the plan. */
    targets: Record<string, number>;
    batchSize: number;
    /** Set by the caller from the config window; batches are laid out from here in list order. */
    startDate: string | null;
  },
): { batches: PlannedBatch[]; refused: Array<{ lot: LotInput; refusal: LotRefusal }>; totals: PlanTotals } {
  const { ops, money } = cfg;
  const batches: PlannedBatch[] = [];
  const refused: Array<{ lot: LotInput; refusal: LotRefusal }> = [];

  // ── crew: ASSUME THE SMALLER CREW UNLESS THE WHOLE RUN BEATS THE DEPARTURE (R-88) ────
  // 🔴 David's sentence is the rule, and it is deliberately asymmetric: *"Every capacity figure
  // assumes TWO unless the run is before Thanksgiving."* At LAWNS the window is 14 Nov – 14 Feb and
  // the seasonal staff leave on the 26th, so it is **9 weekdays at four people and 56 at two** —
  // and a capacity computed at four would be wrong for 86% of the window.
  // ⚠️ An earlier draft asked whether the staff leave BEFORE the window opens, which is the
  // opposite test: it returned the full crew for exactly the real case. Caught by §K, which knew
  // the answer had to be two. Erring toward the smaller crew is also the R-90 direction — plan
  // long, and finishing early is the outcome nobody minds.
  const runsPastDeparture = ops.seasonalStaffLastDay != null && ops.windowEnd != null
    && ops.windowEnd > ops.seasonalStaffLastDay;
  const crewUsed = runsPastDeparture ? ops.crewSizeWinter : ops.crewSizeInSeason;
  const crewReason = runsPastDeparture
    ? `${ops.crewSizeWinter} people — the seasonal staff leave on ${ops.seasonalStaffLastDay} and the window runs past it`
    : `${ops.crewSizeInSeason} people — the full crew, because the whole window falls before the seasonal staff leave`;

  let cursor = opts.startDate;
  for (const lot of lots) {
    const refusal = classifyLot(lot);
    if (!refusal.ok) { refused.push({ lot, refusal }); continue; }
    const target = opts.targets[lot.id];
    if (target == null || !Number.isFinite(target) || target <= (lot.unitValue ?? 0)) continue;

    const split = splitLot(lot, ops, opts.managerNumbers[lot.id] ?? null);
    if (split.uppotNow <= 0) continue;

    const mixPerPot = mixCubicYardsPerPot(lot.unitValue!, target, ops);
    const mixTotal = mixPerPot * split.uppotNow;
    const mixCost = money.blendedMixCostPerCubicYard == null
      ? null
      : mixTotal * money.blendedMixCostPerCubicYard;

    const hours = crewHours(split.uppotNow, opts.batchSize, ops);
    const days = Math.max(1, Math.ceil(hours / (crewUsed * ops.productiveHoursPerDay)));

    const startsOn = cursor;
    const completesOn = cursor == null ? null : addWorkingDays(cursor, days - 1);
    if (completesOn != null) cursor = addWorkingDays(completesOn, 1);

    batches.push({
      lotId: lot.id, name: lot.name,
      fromUnitValue: lot.unitValue!, toUnitValue: target, location: lot.location,
      split, mixPerPot, mixTotal, mixCost,
      startsOn, completesOn, workingDays: days,
      crewHoursAtBatch: hours,
      // First sellable keys off the FINISHING date, never the start. David: *"in the growing
      // schedule 1 day is nothing"* — seven months is 213 days and a two-day spread is 0.9% — and
      // erring later is the same asymmetry as erring long on the minutes.
      firstSellable: completesOn == null ? null : addMonths(completesOn, lot.growMonths ?? ops.growMonthsDefault),
      arriveSellable: Math.round(split.uppotNow * ops.survivalRate),
    });
  }

  const pots = batches.reduce((s, b) => s + b.split.uppotNow, 0);
  const mixCubicYards = batches.reduce((s, b) => s + b.mixTotal, 0);
  const totalHours = batches.reduce((s, b) => s + b.crewHoursAtBatch, 0);
  const totalDays = batches.reduce((s, b) => s + b.workingDays, 0);
  const lastCompletion = batches.length === 0 ? null : batches[batches.length - 1].completesOn;

  const cascade = potCascade(
    batches.map((b) => ({ fromUnitValue: b.fromUnitValue, toUnitValue: b.toUnitValue, qty: b.split.uppotNow })),
    ops,
  );

  // ── basis: a total is only as good as its worst input (basis.weakest) ───────────────
  // Crew-hours rest on three things: the pot count (a FACT — we counted it), the setup/handling
  // rates (SUGGESTIONS — decomposed from the owner's own two figures) and productive-hours-a-day
  // (a GUESS — nobody has measured it). So the hours are a guess, and reporting them as a
  // suggestion because two of the three inputs are solid is exactly the laundering `weakest` exists
  // to prevent. Derived from the config's own basis table rather than written out, so improving the
  // productive-hours figure upgrades this line without anyone remembering to.
  const hoursBasis: BasisKind = weakest([
    'fact',
    OPERATIONS_BASIS.setupMinutesPerRun.basis,
    OPERATIONS_BASIS.handlingMinutesPerPot.basis,
    OPERATIONS_BASIS.productiveHoursPerDay.basis,
  ]);
  const hoursEstimate: Estimate<number> =
    hoursBasis === 'fact'
      ? fact(totalHours, `${pots} pots at batches of ${opts.batchSize}`)
      : hoursBasis === 'suggestion'
        ? suggestion(totalHours, `${pots} pots at batches of ${opts.batchSize}`,
            `${ops.setupMinutesPerRun} min setup a run and ${ops.handlingMinutesPerPot} min a pot`)
        : guess(totalHours, `${pots} pots at batches of ${opts.batchSize}, at ${ops.productiveHoursPerDay} productive hours a day`);

  const mixCostEstimate = money.blendedMixCostPerCubicYard == null
    ? null
    : suggestion(
        batches.reduce((s, b) => s + (b.mixCost ?? 0), 0),
        `${mixCubicYards.toFixed(2)} yd³ of mix`,
        `$${money.blendedMixCostPerCubicYard.toFixed(2)} a yard, which is derived rather than quoted`,
      );

  return {
    batches, refused,
    totals: {
      pots, mixCubicYards, mixCost: mixCostEstimate,
      crewHours: hoursEstimate,
      workingDays: guess(totalDays, `${totalHours.toFixed(1)} crew-hours across ${crewUsed} people`),
      cascade,
      overrunsWindow: !!(lastCompletion && ops.windowEnd && lastCompletion > ops.windowEnd),
      lastCompletion,
      crewUsed, crewReason,
    },
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// THE ARITHMETIC SELF-CHECK — David's must-build
// ════════════════════════════════════════════════════════════════════════════════

export interface ArithmeticCheck {
  label: string;
  /** The figure the owner already had in his head before any software existed. */
  expected: number;
  actual: number;
  passes: boolean;
  /** Signed difference, actual − expected. Rendered whenever it is non-zero, even on a PASS. */
  difference: number;
}

/**
 * 🔴 ONE CENT OF TOLERANCE, AND IT IS DECLARED RATHER THAN QUIETLY WIDE.
 *
 * The owner's two remembered figures are $7.85 at 15 gallons and $15.71 at 30. Measured against
 * the ruled config, $151.00 a yard reproduces **$7.85 exactly and $15.70, not $15.71** — the
 * 30-gallon fill computes to 15.70004. The cent is in the owner's original arithmetic, not in
 * ours, and $151.00 is itself DERIVED (it is the only value that reproduces $7.85 at all).
 *
 * A zero-tolerance check would therefore have shipped RED on day one against the exact
 * configuration David ruled — a false alarm on the one indicator built to tell him the model still
 * works, which would have taught him to ignore it. A silent widening would be worse. So the
 * tolerance is one cent, it is named here, and `difference` renders beside any check that is not
 * exact so the gap stays visible rather than being absorbed.
 */
export const ARITHMETIC_TOLERANCE = 0.01;

/**
 * The screen shows its own arithmetic check. David: *"a 15-gallon pot reads $7.85 and a 30-gallon
 * reads $15.71. If a config change breaks those, the screen says so. That is how David will know
 * it still works."*
 *
 * ⚠️ These are FULL-POT fills, not uppot deltas — the same formula with a different subtraction —
 * and the labels say so, because a reader comparing $7.85 against a 30→45 delta that also computes
 * to $7.85 would draw the wrong conclusion about which quantity is being checked.
 * Returns an EMPTY list when the mix cost is withheld: a check nobody can evaluate must not render
 * as a failing one.
 */
export function arithmeticCheck(cfg: ResolvedConfig): ArithmeticCheck[] {
  const { ops, money } = cfg;
  if (money.blendedMixCostPerCubicYard == null) return [];
  const rate = money.blendedMixCostPerCubicYard;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const check = (label: string, gal: number, expected: number): ArithmeticCheck => {
    const actual = round2(mixCubicYardsPerPot(0, gal, ops) * rate);
    const difference = round2(actual - expected);
    return { label, expected, actual, passes: Math.abs(difference) <= ARITHMETIC_TOLERANCE + 1e-9, difference };
  };
  return [
    check('Mix to fill a 15-gallon pot', 15, 7.85),
    check('Mix to fill a 30-gallon pot', 30, 15.71),
  ];
}
