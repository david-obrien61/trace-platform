// ============================================================
// productionConfig — THE CONSTANTS, AND WHICH SIDE OF THE MONEY WALL EACH ONE LIVES ON
//
// PURPOSE:      Every number in the planning model is CONFIGURED. David, 2026-09-05: *"Nothing in
//               this model is a constant in code."* This module is the one declaration of what
//               those numbers are, what they default to, and — the part that took a ruling —
//               WHICH STORE each one lives in.
//
// 🔴 THE SPLIT, AND WHY IT IS NOT A TIDINESS DECISION (R-85).
//   The recon found that the nine constants straddle an existing permission wall. Measured live at
//   LAWNS on 2026-09-04 (3 member rows): MANAGER holds `settings:read` + `settings:update` and does
//   NOT hold `pricing_recipe:read`, `costs:*` or `wages:*`.
//   · Put everything in `business_pricing_config` (gated `pricing_recipe:read`, described in the
//     manifest as *"the moat (D-009), stays confidential"*) and the production manager — the person
//     who RUNS this plan — sees a blank right-hand column.
//   · Put everything in an operations table and the LABOUR RATE moves back outside the wall that
//     `20260621_financial_wall_phase2.sql` deliberately moved it inside.
//   So it splits, and David ruled the seam:
//     OPERATIONS (`business_operations_config`, `settings:read`) — volumes, times, crew, rates of
//       work, months, percentages, recovery, the window. None of it is money.
//     OPERATIONS **including the mix recipe cost** — David's explicit exception, 2026-09-05:
//       *"the MIX COST PER YARD is visible to MANAGER. The plan's entire right side is meaningless
//       without it and Joel is the person who would notice bark going up."*
//     MONEY-WALLED (`business_pricing_config`, `pricing_recipe:read`) — the labour rates and the
//       pot prices. *"Wages and the labour rate stay withheld."*
//
// 🔴 WITHHELD IS ANNOUNCED, NEVER BLANK, NEVER ZERO. A reader without `pricing_recipe:read` gets
//   `null` and a sentence saying why — the pattern `api/dashboard.ts` already uses, where
//   `today_revenue` returns null rather than 0 with the reason written at the line: *"a redaction
//   must not read as a real figure (D-9)."* A withheld labour rate rendered as $0.00 would make
//   every cost figure on the screen wrong and confident.
//
// 🔴 COVER MONTHS IS TIED TO GROW MONTHS, AND THAT IS A DEFECT FIX (R-84 / workbook defect 1).
//   The workbook defaults cover to 6 while grow is 7, so the plan holds back one month LESS than
//   the replacement takes to arrive — on every variety, silently. `coverMonthsFor()` is the only
//   reader, and its default IS grow months. A per-variety override stays available; the DEFAULT
//   can no longer disagree with the thing it is covering for.
//
// AC-1:         generic throughout. No vertical noun in any key, type or identifier. "Uppot" is a
//               cultivar-vertical LABEL and appears only in the cultivar surface — the precedent is
//               `responsibilityCatalogue.ts`, where *"Uppot or graduate a lot"* is a `text` VALUE on
//               a row whose `vertical` FIELD carries the identity (AC-1: identity is a value).
// DEPENDENCIES: ./basis (every default carries how it was arrived at).
// OUTPUTS:      OperationsConfig · MoneyConfig · ResolvedConfig · OPERATIONS_DEFAULTS ·
//               MONEY_DEFAULTS · resolveConfig · coverMonthsFor · WITHHELD_REASON · isWithheld.
// STORY:        user_stories.md → *The growing ladder — potted, waiting, ready, and up a size*.
// ============================================================
import { type BasisKind } from './basis';

// ════════════════════════════════════════════════════════════════════════════════
// THE OPERATIONS SIDE — `business_operations_config.config`, gated settings:read
// ════════════════════════════════════════════════════════════════════════════════

export interface OperationsConfig {
  /** Trade gallons → true gallons. A 45-gallon pot holds 31.5 true gallons. David, 1 Sept. */
  tradeGallonFactor: number;
  /** True gallons in a cubic yard. Standard conversion, not a preference. */
  trueGallonsPerCubicYard: number;
  /** Mix lost to shrink and spill, as a share. Zero until somebody measures it. */
  mixShrinkPct: number;

  // ── LABOUR IS SETUP PLUS HANDLING, NOT A FLAT PER-POT RATE (R-86) ────────────
  // David: *"the pots are never where they should be, the material still needs to be moved to
  // where we're working, so setup is baked into the minutes per pot… tractor gets material,
  // tractor gets pots, we move to a certain area, inventory is ferried back and forth."*
  // His two figures — 3 minutes a pot, and 2 hours for 20 pots — were BOTH right and looked
  // contradictory: 3 was handling, 6 was the job at a 20-pot batch. Decomposed, they reconcile.
  // 🔴 A flat per-pot rate is wrong at every batch size except the one it was measured at.
  /** One-off cost of standing a run up: fetch material, fetch pots, move the crew to the block. */
  setupMinutesPerRun: number;
  /** Marginal cost of one more pot once the run is standing. */
  handlingMinutesPerPot: number;

  /** Clock hours a day less breaks, moving stock and setup. Nobody has measured it. */
  productiveHoursPerDay: number;
  /** Crew while the seasonal staff are present. */
  crewSizeInSeason: number;
  /** Crew after the seasonal staff leave. The window is mostly this one — see the note below. */
  crewSizeWinter: number;
  /** Cubic yards an hour the mixer turns out. Placeholder — ask Terry. */
  mixerCubicYardsPerHour: number;
  /** People making mix (not uppotting). */
  peopleMakingMix: number;

  /** Months from potting to sellable. Overridable per variety. */
  growMonthsDefault: number;
  /**
   * Months of sales to keep sellable. `null` means TIE IT TO GROW MONTHS, which is the default and
   * the fix: cover exists to bridge the gap until the uppotted stock is ready, so a cover shorter
   * than the grow time is holding back too little by construction.
   */
  coverMonthsOverride: number | null;
  /** Extra cushion on top of the computed must-keep, as a share. David's 10%, per-variety adjustable. */
  cushionPctDefault: number;
  /** Share of trees surviving the move. 1.0 because nobody has measured it — and it SHOWS as a guess. */
  survivalRate: number;
  /** Share of freed pots that can be reused rather than binned. Unmeasured. */
  potRecoveryRate: number;

  /** The window in which uppotting may happen. ISO 'YYYY-MM-DD'. */
  windowStart: string | null;
  windowEnd: string | null;
  /**
   * Last working day the seasonal staff are present (R-88). Two of the four yard staff leave after
   * Thanksgiving and return end of May — AFTER the window closes — so most of the window runs on
   * the smaller crew, and capacity computed at four people is wrong for 56 of its 65 days.
   */
  seasonalStaffLastDay: string | null;
}

export const OPERATIONS_DEFAULTS: OperationsConfig = {
  tradeGallonFactor: 0.7,
  trueGallonsPerCubicYard: 201.974,
  mixShrinkPct: 0,
  setupMinutesPerRun: 60,
  handlingMinutesPerPot: 3,
  productiveHoursPerDay: 6,
  crewSizeInSeason: 4,
  crewSizeWinter: 2,
  mixerCubicYardsPerHour: 4,
  peopleMakingMix: 1,
  growMonthsDefault: 7,
  coverMonthsOverride: null,
  cushionPctDefault: 0.1,
  survivalRate: 1,
  potRecoveryRate: 0.9,
  windowStart: null,
  windowEnd: null,
  seasonalStaffLastDay: null,
};

/**
 * How each operations default was arrived at, for `basis.ts`. Keyed on the same field names so a
 * new config key with no basis entry is a TYPE ERROR rather than a number that renders unlabelled.
 */
export const OPERATIONS_BASIS: Record<keyof OperationsConfig, { basis: BasisKind; because: string }> = {
  tradeGallonFactor:       { basis: 'fact',       because: "the owner's own figure, 1 September" },
  trueGallonsPerCubicYard: { basis: 'fact',       because: 'standard conversion' },
  mixShrinkPct:            { basis: 'guess',      because: 'shrink and spill' },
  setupMinutesPerRun:      { basis: 'suggestion', because: "decomposed from the owner's 2 hours for 20 pots" },
  handlingMinutesPerPot:   { basis: 'suggestion', because: "the owner's 3 minutes a pot" },
  productiveHoursPerDay:   { basis: 'guess',      because: 'productive hours in a working day' },
  crewSizeInSeason:        { basis: 'fact',       because: 'four yard staff' },
  crewSizeWinter:          { basis: 'fact',       because: 'two of the four are seasonal' },
  mixerCubicYardsPerHour:  { basis: 'guess',      because: 'mixer output' },
  peopleMakingMix:         { basis: 'guess',      because: 'people on the mixer' },
  growMonthsDefault:       { basis: 'suggestion', because: "the owner's seven-month figure" },
  coverMonthsOverride:     { basis: 'suggestion', because: 'months of sales held back' },
  cushionPctDefault:       { basis: 'suggestion', because: "the owner's 10% hold-back" },
  survivalRate:            { basis: 'guess',      because: 'survival through the move' },
  potRecoveryRate:         { basis: 'guess',      because: 'pots recovered rather than binned' },
  windowStart:             { basis: 'fact',       because: 'the window the owner set' },
  windowEnd:               { basis: 'fact',       because: 'the window the owner set' },
  seasonalStaffLastDay:    { basis: 'fact',       because: 'when the seasonal staff leave' },
};

// ════════════════════════════════════════════════════════════════════════════════
// THE MONEY SIDE — `business_pricing_config.config.production`, gated pricing_recipe:read
// ════════════════════════════════════════════════════════════════════════════════

export interface MoneyConfig {
  /**
   * 🔴 MANAGER-VISIBLE BY EXPLICIT RULING, unlike everything else in this interface. It is stored
   * on the money side because it IS a cost, and released to the operations reader because David
   * ruled it: *"Joel is the person who would notice bark going up."* The component shares and
   * their unit costs travel with it for the same reason — they are the recipe, not the payroll.
   */
  blendedMixCostPerCubicYard: number | null;
  /** Recipe components. Shares must total 1; the surface says so when they do not. */
  mixComponents: Array<{ name: string; share: number; costPerCubicYard: number | null }>;

  /** WITHHELD from a reader without `pricing_recipe:read`. Wages are the moat. */
  labourRateInSeason: number | null;
  /** WITHHELD. Higher than the in-season rate: losing the cheapest staff raises the blend. */
  labourRateWinter: number | null;
  /** WITHHELD. Empty-pot purchase price by trade size. */
  potCostByUnitValue: Record<string, number>;
}

export const MONEY_DEFAULTS: MoneyConfig = {
  blendedMixCostPerCubicYard: null,
  mixComponents: [],
  labourRateInSeason: null,
  labourRateWinter: null,
  potCostByUnitValue: {},
};

/** The keys a reader without `pricing_recipe:read` never receives. The mix recipe is NOT here. */
export const MONEY_WALLED_KEYS = ['labourRateInSeason', 'labourRateWinter', 'potCostByUnitValue'] as const;

export const WITHHELD_REASON =
  'Withheld — labour rates and pot prices need cost access. This is a redaction, not a zero.';

/** A withheld value is `null` and SAYS SO. Never 0, never '', never a silent omission (D-9). */
export function isWithheld(v: unknown): boolean {
  return v === null || v === undefined;
}

// ════════════════════════════════════════════════════════════════════════════════
// RESOLUTION
// ════════════════════════════════════════════════════════════════════════════════

export interface ResolvedConfig {
  ops: OperationsConfig;
  money: MoneyConfig;
  /** False when the reader lacks `pricing_recipe:read`. Drives the withheld sentence on screen. */
  moneyVisible: boolean;
}

/**
 * Merge stored config over defaults, and REDACT the walled keys when the reader lacks cost access.
 *
 * Redaction happens HERE rather than at the surface deliberately: a component that receives a real
 * labour rate and is trusted to not render it is one careless JSX expression away from leaking it,
 * and the leak is invisible in review. The value never reaches the client that may not see it.
 */
export function resolveConfig(
  storedOps: Partial<OperationsConfig> | null | undefined,
  storedMoney: Partial<MoneyConfig> | null | undefined,
  canReadMoney: boolean,
): ResolvedConfig {
  const ops: OperationsConfig = { ...OPERATIONS_DEFAULTS, ...(storedOps ?? {}) };
  const money: MoneyConfig = { ...MONEY_DEFAULTS, ...(storedMoney ?? {}) };
  if (!canReadMoney) {
    money.labourRateInSeason = null;
    money.labourRateWinter = null;
    money.potCostByUnitValue = {};
  }
  return { ops, money, moneyVisible: canReadMoney };
}

/**
 * Months of sales to hold back for one variety.
 *
 * Order: a per-variety number wins; then the business-wide override; then — the fix — GROW MONTHS.
 * The default can no longer be shorter than the thing it is covering for.
 */
export function coverMonthsFor(
  ops: OperationsConfig,
  perVarietyCover: number | null | undefined,
  perVarietyGrow: number | null | undefined,
): number {
  if (perVarietyCover != null && Number.isFinite(perVarietyCover)) return Number(perVarietyCover);
  if (ops.coverMonthsOverride != null && Number.isFinite(ops.coverMonthsOverride)) {
    return Number(ops.coverMonthsOverride);
  }
  if (perVarietyGrow != null && Number.isFinite(perVarietyGrow)) return Number(perVarietyGrow);
  return ops.growMonthsDefault;
}
