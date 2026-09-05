// ============================================================
// production — the planning model's one import surface.
//
// A consumer imports the whole model from here rather than reaching into five files, so that
// adding a piece (the graduation movement, sales-from-history) does not change every call site.
// ============================================================
export {
  fact, suggestion, guess, basisSentence, weakest, compareToActual,
} from './basis';
export type { BasisKind, Estimate, EstimateGap } from './basis';

export {
  OPERATIONS_DEFAULTS, OPERATIONS_BASIS, MONEY_DEFAULTS, MONEY_WALLED_KEYS, WITHHELD_REASON,
  resolveConfig, coverMonthsFor, isWithheld,
} from './productionConfig';
export type { OperationsConfig, MoneyConfig, ResolvedConfig } from './productionConfig';

export {
  rungKey, classifyLot, splitLot, planLots, mixCubicYardsPerPot, runMinutes, minutesPerPot,
  crewHours, splitPenalty, potCascade, sequenceRuns, arithmeticCheck,
  addMonths, addWorkingDays, workingDaysBetween, ARITHMETIC_TOLERANCE,
} from './productionMath';
export type {
  LotInput, LotRefusal, LotSplit, PlannedBatch, PlanTotals, CascadeRung, CascadeResult,
  ArithmeticCheck,
} from './productionMath';

export {
  PLAN_STATUSES, holdsStock, fetchHeldByLot, availableFrom3, availabilityLabel3,
} from './productionHold';
export type { HeldByLot, PlanStatus } from './productionHold';

export {
  FLAG_THRESHOLD_DAYS, POSSIBLE_CAUSES, flagsFor, validateCompletion,
} from './productionFlags';
export type {
  ProductionFlag, ProductionFlagKind, CompletionInput, CompletionVerdict,
} from './productionFlags';
