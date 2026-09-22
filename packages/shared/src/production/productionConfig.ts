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
// AC-1:         ✅ THE "UPPOT" HALF IS TRUE AND WAS VERIFIED. `uppotNow` is an internal field name
//               only; the LABEL lives in the cultivar surface — the precedent is
//               `responsibilityCatalogue.ts`, where *"Uppot or graduate a lot"* is a `text` VALUE on
//               a row whose `vertical` FIELD carries the identity (AC-1: identity is a value).
//
//               ✏️ CORRECTED 2026-09-14 (ledger #328, recon #327). THIS LINE USED TO OPEN
//               *"generic throughout. NO VERTICAL NOUN IN ANY KEY, TYPE OR IDENTIFIER"* — and that
//               second clause is FALSE on this page: `tradeGallonFactor` (:56) and
//               `trueGallonsPerCubicYard` (:58) are grower units, and they are KEYS ON AN EXPORTED
//               SHARED INTERFACE. A food bank's operations config has neither.
//               🔴 Being 80% right is why nobody checked the other 20% — tech-debt **#297**.
//
//               ✅ THE TABLE UNDERNEATH IS AC-1-CLEAN, AND THAT MATTERS MORE THAN THE TYPE:
//               `20260905_production_planning.sql:57-62` stores this as a `jsonb config` blob —
//               variation in DATA, not schema. Only the TypeScript narrows it.
//               ✏️ CORRECTED 2026-09-16 (ledger #343): this said the migration was not applied
//               (tech-debt #253). It IS applied — #253 was closed on David's live save 2026-09-15 —
//               so a key rename now has live rows to migrate. See #297 before renaming one.
// DEPENDENCIES: ./basis (every default carries how it was arrived at).
// OUTPUTS:      OperationsConfig · MoneyConfig · ResolvedConfig · OPERATIONS_DEFAULTS ·
//               MONEY_DEFAULTS · resolveConfig · coverMonthsFor · WITHHELD_REASON · isWithheld ·
//               GALLONS_PER_CUBIC_YARD · PLANTING_MATERIAL_KEYS · PLANTING_MATERIAL_LABELS ·
//               plantingMaterialProblems.
//
// 🔴 PLANTING MATERIALS (ledger #343) — THE INSTALL BILL OF MATERIALS IS CONFIGURED HERE TOO.
//   The load list's ratios lived in a code constant (`BOM_RULES`) that no screen could change. David,
//   2026-09-16: *"ONE LOCATION, MANY READS, EXTREMELY FLEXIBLE."* The per-SIZE figure (T-posts) is on
//   the RUNG (`container_ladder.install_t_posts_per_tree`); the four per-TREE figures are here.
//   ⚠️ THEY ARE A DIFFERENT RECIPE FROM THE UPPOT KEYS AND MUST STAY SEPARATE. `tradeGallonFactor`
//   and `mixShrinkPct` describe POTTING UP; `installMixContainerVolumesPerTree` describes PLANTING
//   OUT. Both numbers were once 0.7 by coincidence and that coincidence has already cost one
//   reconciliation (R-155). Nothing reads one in place of the other.
// STORY:        user_stories.md → *The growing ladder — potted, waiting, ready, and up a size*.
// ============================================================
import { type BasisKind } from './basis';
import { CALIPER_STANDARD } from '../inventory/containerLadder';

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

  // ── PLANTING MATERIALS — the install bill of materials, per tree (ledger #343) ──────────────────
  /**
   * Gallons of special mix per gallon of the tree's container, at INSTALL. 2.0 — David, 2026-09-15:
   * *"install mix is TWICE the container volume (30 gal → 60 gal)."* The earlier 1.0 (R-155 as first
   * written) was Lightning's figure, not LAWNS's. The container volume is the RUNG's, never a number
   * read out of the size text.
   */
  installMixContainerVolumesPerTree: number;
  /** Feet of staking rope per T-post. */
  ropeFeetPerTPost: number;
  /** Bubblers per tree the ORDER SPECIFIES — the billed Tree Bubbler line is the count, and this
   *  multiplies it. ✏️ NOT a per-tree default any more: David, 2026-09-18, *"not on every tree, only
   *  those specified"* (superseding his 2026-09-12 "one bubbler per tree"). */
  bubblersPerTree: number;
  /** T-posts a deer-fenced tree carries IN TOTAL — a tree already staked with 2 needs 2 more. */
  deerFenceTPostsPerTree: number;

  /**
   * Inches above the soil line this nursery measures trunk CALIPER at (ledger #356). David,
   * 2026-09-18: it *"varies by nursery, so the height is a per-business setting, not a constant."*
   * LAWNS measures at 12. Every caliper on the ladder (`container_ladder.caliper_*_inches`) is read
   * at this height — a 3.25 in tree at 6 in is a smaller tree at 12.
   */
  /** X — above this many estimated hours, a day suggests a second team (ledger #375). */
  dayHoursBeforeSecondTeam: number;
  /** Minutes to plant one tree; 30 until Start/Done taps measure it here (ledger #375). */
  plantingMinutesPerTree: number;
  caliperMeasuredAtInches: number;
  /**
   * Where that height came from, in the nursery's own words (David, 2026-09-18: the platform
   * *"records where the value came from"*). Empty means nobody has said — the screen then shows the
   * standard's sentence as the reason it is pre-filled.
   */
  caliperMeasuredAtBecause: string;
}

/** US gallons in one cubic yard: 46,656 in³ ÷ 231 in³. THE one definition (ledger #343) — the load
 *  list, the uppot plan and the Settings default all read it through `trueGallonsPerCubicYard`. */
export const GALLONS_PER_CUBIC_YARD = 46656 / 231; // 201.974025974…

/** The Settings → Operations "Planting materials" group, in display order. */
export const PLANTING_MATERIAL_KEYS = [
  'installMixContainerVolumesPerTree', 'ropeFeetPerTPost', 'bubblersPerTree', 'deerFenceTPostsPerTree',
] as const;

export const OPERATIONS_DEFAULTS: OperationsConfig = {
  tradeGallonFactor: 0.7,
  trueGallonsPerCubicYard: GALLONS_PER_CUBIC_YARD,
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
  installMixContainerVolumesPerTree: 2,
  ropeFeetPerTPost: 4,
  bubblersPerTree: 1,
  deerFenceTPostsPerTree: 4,
  // ── THE DAY'S CAPACITY (ledger #375, teams piece 2.5 — David, 2026-09-21) ──────────────
  // 🔴 X. Above this many estimated hours the day SUGGESTS a second team. LAWNS is 7; this 8 is
  //    the platform's standard, not LAWNS's number, and the estimate says which it used.
  // 🔴 X NEVER LEARNS. David's rule: the threshold is the owner's judgement about her own day and
  //    her own crews, and a figure that drifted under her would make the suggestion untrustworthy
  //    exactly when it disagreed with her. Only planting time learns, and only by asking.
  dayHoursBeforeSecondTeam: 8,
  // Minutes to plant ONE tree. 30 until Start/Done taps have measured it here — and the surface
  // says so rather than presenting a default as a measurement (D-9).
  plantingMinutesPerTree: 30,
  caliperMeasuredAtInches: 6,
  caliperMeasuredAtBecause: '',
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
  installMixContainerVolumesPerTree: { basis: 'fact', because: "LAWNS, David 2026-09-15; corrects an earlier 1.0 that was Lightning's" },
  ropeFeetPerTPost:        { basis: 'fact',       because: 'LAWNS, David 2026-09-12' },
  bubblersPerTree:         { basis: 'fact',       because: 'LAWNS, David 2026-09-18 — per tree the order specifies, not every tree' },
  deerFenceTPostsPerTree:  { basis: 'fact',       because: 'LAWNS, David 2026-09-12' },
  dayHoursBeforeSecondTeam: { basis: 'suggestion', because: "the owner's judgement about her own day and her own crews — LAWNS is 7; this never learns" },
  plantingMinutesPerTree:  { basis: 'suggestion', because: 'a standard 30 minutes until Start and Done taps have measured it here' },
  caliperMeasuredAtInches: { basis: 'suggestion', because: CALIPER_STANDARD.sentence },
  caliperMeasuredAtBecause: { basis: 'fact', because: "the nursery's own words for why it measures where it does" },
};

/** Plain-language names for the planting-material keys. The screen shows these, never a key. */
export const PLANTING_MATERIAL_LABELS: Record<typeof PLANTING_MATERIAL_KEYS[number], string> = {
  installMixContainerVolumesPerTree: 'Special mix per gallon of container, when planting (gallons)',
  ropeFeetPerTPost: 'Rope per T-post (feet)',
  bubblersPerTree: 'Bubblers per tree the order specifies',
  deerFenceTPostsPerTree: 'T-posts on a deer-fenced tree, in total',
};

/**
 * What is wrong with the planting figures, in words — empty when nothing is (§1.6 item 3).
 * 🔴 A ZERO MIX RATIO IS REFUSED: it would print "0 yards of mix" on every load list, which reads
 * as a measurement. The counts may be 0 (a nursery that uses no bubblers) but never negative, and
 * nothing may be a non-number — an emptied input box reads as 0, and 0 is refused only where it lies.
 */
export function plantingMaterialProblems(ops: Pick<OperationsConfig, typeof PLANTING_MATERIAL_KEYS[number]>): string[] {
  const out: string[] = [];
  for (const k of PLANTING_MATERIAL_KEYS) {
    const v = ops[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) out.push(`${PLANTING_MATERIAL_LABELS[k]} must be a number.`);
    else if (v < 0) out.push(`${PLANTING_MATERIAL_LABELS[k]} cannot be negative.`);
  }
  if (Number.isFinite(ops.installMixContainerVolumesPerTree) && ops.installMixContainerVolumesPerTree <= 0) {
    out.push(`${PLANTING_MATERIAL_LABELS.installMixContainerVolumesPerTree} must be more than 0 — a tree is never planted with no mix.`);
  }
  return out;
}

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
  // 🔴 A MISSING OR UNUSABLE STORED KEY READS ITS DEFAULT (ledger #343). A plain spread let a stored
  // `null` or `"abc"` replace a numeric default, and every figure downstream would then compute NaN
  // with nothing on screen saying why. Only keys whose DEFAULT is a number are guarded: the nullable
  // keys (`coverMonthsOverride`, the window dates) mean something by being null.
  const ops: OperationsConfig = { ...OPERATIONS_DEFAULTS };
  for (const [k, v] of Object.entries(storedOps ?? {})) {
    // An unknown key is CARRIED, not dropped: Settings saves the whole object back, and dropping a
    // key some other build wrote would erase it on the next save.
    const d = (OPERATIONS_DEFAULTS as unknown as Record<string, unknown>)[k];
    if (typeof d === 'number' && (v == null || v === '' || !Number.isFinite(Number(v)))) continue;
    (ops as unknown as Record<string, unknown>)[k] = typeof d === 'number' ? Number(v) : v;
  }
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
