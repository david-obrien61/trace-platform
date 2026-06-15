/**
 * ── COST-TO-PRODUCE ENGINE (shared, general) · THUNDER BUILD · 2026-06-14 ──────
 *
 * PURPOSE
 *   The PERIOD-POOL half of Cost-to-Produce (COST-TO-PRODUCE-DESIGN.md §3 "THE FORK").
 *   Accumulates a business's loaded MONTHLY cost honestly by confidence grade, divides
 *   by a denominator N (target units/customers), and emits the per-unit cost + a
 *   MarginEngine-fed suggested price — as a CONFIDENCE-AWARE RANGE, never a false-precise
 *   single number. This is the engine behind the Cost-to-Produce config panel + tile.
 *
 *   It does the period-pool math the design calls for (loaded_cost ÷ denominator) and
 *   delegates the cost→price step to the canonical shared MarginEngine (a single-slab
 *   target-margin config). It NEVER takes a tax or legal position (design §2 boundary):
 *   it surfaces confidence and hands the picture over.
 *
 * DEPENDENCIES
 *   - ./MarginEngine  (calculateRetail, getProfitMargin) — canonical price authority.
 *   No DB, no Supabase, no React, no vertical imports. Pure functions only.
 *
 * INSTRUMENTATION (STD-003, added 2026-06-15): analyze() emits one `[TRACE:COST] compute`
 *   line per call (loaded cost · N set · per-N results) — ON BY DEFAULT. Stays on until
 *   David owner-proves the tile through the UI; only then is it commented out, not deleted.
 *
 * OUTPUTS
 *   - CostToProduceConfig / CostLine / etc. — the JSON shape stored in
 *     business_modules.config (business_id-scoped; reversible, multi-location-capable).
 *   - accumulate(config)  → loaded monthly cost bucketed by confidence + unknown inventory.
 *   - analyze(config)     → sensitivity rows (one per denominator): cost range + price range.
 *   - confidenceMix(...)  → the honest "confirmed floor + estimated + N unknown" summary.
 *
 * SURFACE HONESTY (design §6.4): UNKNOWN cost lines carry NO amount and are NEVER
 *   silently zeroed — they are counted and listed so the displayed cost reads as a
 *   floor ("at least $X, plus N unquantified categories"), not a fact.
 *
 * MULTI-LOCATION (build-gating constraint — MULTI-LOCATION-OPERATING-MODEL.md):
 *   `locations` is an ARRAY from day one. The accumulator sums across ALL locations, so
 *   N locations of varying duration (base + permanent + transient) work without a schema
 *   change. A single default location is fine for now; the structure does not preclude N.
 */

import { calculateRetail, getProfitMargin } from './MarginEngine';
import type { MarginEngineConfig } from './MarginEngine';
import { enforceCountOnce } from './CountOnceSeam';
import type { CostEvent } from './CountOnceSeam';

// ── Confidence + period vocab (mirrors business_inventory.cost_confidence CHECK) ──

export type CostConfidence = 'CONFIRMED' | 'DERIVED' | 'ESTIMATED' | 'UNKNOWN';
export type CostPeriod = 'monthly' | 'annual';

/** "Solid floor" = costs we're sure of. CONFIRMED + DERIVED. */
const FLOOR_GRADES: CostConfidence[] = ['CONFIRMED', 'DERIVED'];

// ── Config shape (stored in business_modules.config) ─────────────────────────────

export interface CostLine {
  label: string;
  /** null = UNKNOWN amount. NEVER coerce null → 0 (Surface Honesty). */
  amount: number | null;
  period: CostPeriod;
  confidence: CostConfidence;
  /** Optional disclosure, e.g. "may be Pro Max ~$100 — verify". */
  note?: string;
}

export interface LaborConfig {
  /** $/hour. Owner-set FMV proxy (design §4.3). null = not set. */
  rate: number | null;
  hours: number | null;
  period: CostPeriod;
  confidence: CostConfidence;
}

/** Per-tier margin policy. STORED for the future leakage layer; default tier is what the tile prices at. */
export interface MarginTier {
  name: string;            // 'walk-in' | 'friends-family' | 'contractor' — data, not code (AC-1)
  marginOverride: number;  // gross margin as a fraction, e.g. 0.20
  isDefault?: boolean;
}

export interface MarginPolicy {
  /** Baseline gross margin as a fraction (0.40 = 40%). */
  baseline: number;
  tiers: MarginTier[];
}

export interface CostLocation {
  id: string;
  name: string;
  kind: 'base' | 'permanent' | 'transient';
  recurring: CostLine[];
  labor: LaborConfig;
  /** Per-unit overhead absorption hook for the per-PRODUCT path (nursery per-plant). 0 for period-pool. */
  overheadPerUnit: number;
}

export interface CostToProduceConfig {
  version: number;
  /** The unit the business sells — denominator unit. 'customer-month' (TRACE), 'plant' (cultivar)… */
  unitLabel: string;
  /** Sensitivity set — the tunable knob. e.g. [1, 5, 20, 100]. */
  denominators: number[];
  margin: MarginPolicy;
  /** Reference price for comparison (e.g. $149 founding rate). Optional. */
  priceReference?: number | null;
  locations: CostLocation[];
}

/** Generic, tenant-free default (AC-1: no tenant data in shared). Empty floor → tile shows LABELED state. */
export const EMPTY_COST_CONFIG: CostToProduceConfig = {
  version: 1,
  unitLabel: 'unit',
  denominators: [1, 5, 20, 100],
  margin: {
    baseline: 0.40,
    tiers: [{ name: 'standard', marginOverride: 0.40, isDefault: true }],
  },
  priceReference: null,
  locations: [
    {
      id: 'default',
      name: 'Primary',
      kind: 'base',
      recurring: [],
      labor: { rate: null, hours: null, period: 'monthly', confidence: 'ESTIMATED' },
      overheadPerUnit: 0,
    },
  ],
};

// ── Accumulator ──────────────────────────────────────────────────────────────────

export interface AccumulatedLine {
  label: string;
  monthly: number | null;   // normalized to monthly; null for UNKNOWN
  confidence: CostConfidence;
  note?: string;
  location: string;
}

export interface Accumulation {
  /** CONFIRMED + DERIVED monthly total — the solid floor. */
  floorMonthly: number;
  /** ESTIMATED monthly total — the soft add on top of the floor. */
  estimatedMonthly: number;
  /** floorMonthly + estimatedMonthly — the full KNOWN monthly cost. */
  knownMonthly: number;
  /** UNKNOWN lines — no amount; surfaced as count + labels, never zeroed. */
  unknownLines: AccumulatedLine[];
  /** Every quantified line (floor + estimated) for display breakdown. */
  knownLines: AccumulatedLine[];
  /** True if there is a non-zero floor to compute from. */
  computable: boolean;
  // ── seam-reconciled extras — present ONLY when fed real captured cost_objects (SUB-3). ──
  /** Captured CAPEX (one-time capital), kept OUT of the ÷N monthly pool, surfaced separately. */
  capexExcluded?: number;
  /** Cross-source possible duplicates the seam FLAGGED (not silently merged or doubled). */
  possibleDuplicateCount?: number;
  /** True when this accumulation was reconciled against real captured cost_objects. */
  fedFromRollup?: boolean;
}

/** annual → monthly; monthly passes through. */
function toMonthly(amount: number, period: CostPeriod): number {
  return period === 'annual' ? amount / 12 : amount;
}

/** Optional feed for accumulate() — the count-once bridge from the accumulator to the pool. */
export interface AccumulateOptions {
  /**
   * Cost EVENTS from REAL captured cost_objects (built via CountOnceSeam.fromCostObject).
   * When present, the typed config (recurring + labor) AND these are reconciled through the
   * ONE count-once seam (CountOnceSeam.enforceCountOnce), so a cost present in BOTH the typed
   * config and a captured object is counted ONCE, and CAPEX is excluded from the ÷N monthly
   * pool. Absent/empty → the config-only path below is byte-for-byte the live tile's proven
   * behavior (zero regression). The seam is the single reconciliation gate (design §14).
   */
  rollupEvents?: CostEvent[];
}

/**
 * Build CostEvents from the typed config (recurring lines + labor) so they can be reconciled
 * against captured cost_objects in the ONE seam. Typed config has no receipt/vendor/date, so
 * the seam will FLAG (not silently merge) cross-source look-alikes — honest, not lossy.
 */
function costConfigToEvents(config: CostToProduceConfig): CostEvent[] {
  const events: CostEvent[] = [];
  (config.locations ?? []).forEach((loc, li) => {
    const locKey = loc.id ?? String(li);
    (loc.recurring ?? []).forEach((line, idx) => {
      events.push({
        id: `cfg:${locKey}:rec:${idx}`,
        label: line.label,
        amount: line.amount == null ? null : toMonthly(line.amount, line.period),
        bucket: 'MONTHLY_POOL',
        amountConfidence: line.confidence,
        substantiation: 'OWNER_ASSERTED', // typed config = no proof document
        realization: 'REALIZED',
        source: `config.recurring@${loc.name}`,
      });
    });
    const lab = loc.labor;
    if (lab && lab.rate != null && lab.hours != null) {
      events.push({
        id: `cfg:${locKey}:labor`,
        label: `Labor (${lab.rate}/hr × ${lab.hours} ${lab.period === 'annual' ? 'hr/yr' : 'hr/mo'})`,
        amount: toMonthly(lab.rate * lab.hours, lab.period),
        bucket: 'MONTHLY_POOL',
        amountConfidence: lab.confidence,
        substantiation: 'OWNER_ASSERTED',
        realization: 'REALIZED',
        source: `config.labor@${loc.name}`,
      });
    } else if (lab && lab.confidence === 'UNKNOWN') {
      events.push({
        id: `cfg:${locKey}:labor`,
        label: 'Labor (hours not set)',
        amount: null,
        bucket: 'MONTHLY_POOL',
        amountConfidence: 'UNKNOWN',
        substantiation: 'OWNER_ASSERTED',
        realization: 'REALIZED',
        source: `config.labor@${loc.name}`,
      });
    }
  });
  return events;
}

export function accumulate(config: CostToProduceConfig, opts: AccumulateOptions = {}): Accumulation {
  // ── Config-only path (the live tile's proven computation — UNCHANGED). ──
  let floorMonthly = 0;
  let estimatedMonthly = 0;
  const unknownLines: AccumulatedLine[] = [];
  const knownLines: AccumulatedLine[] = [];

  for (const loc of config.locations ?? []) {
    // Recurring + one-off lines
    for (const line of loc.recurring ?? []) {
      if (line.confidence === 'UNKNOWN' || line.amount == null) {
        unknownLines.push({ label: line.label, monthly: null, confidence: 'UNKNOWN', note: line.note, location: loc.name });
        continue;
      }
      const monthly = toMonthly(line.amount, line.period);
      knownLines.push({ label: line.label, monthly, confidence: line.confidence, note: line.note, location: loc.name });
      if (FLOOR_GRADES.includes(line.confidence)) floorMonthly += monthly;
      else estimatedMonthly += monthly; // ESTIMATED
    }

    // Labor line
    const lab = loc.labor;
    if (lab && lab.rate != null && lab.hours != null) {
      const laborMonthly = toMonthly(lab.rate * lab.hours, lab.period);
      knownLines.push({
        label: `Labor (${lab.rate}/hr × ${lab.hours} ${lab.period === 'annual' ? 'hr/yr' : 'hr/mo'})`,
        monthly: laborMonthly, confidence: lab.confidence, location: loc.name,
      });
      if (FLOOR_GRADES.includes(lab.confidence)) floorMonthly += laborMonthly;
      else estimatedMonthly += laborMonthly;
    } else if (lab && lab.confidence === 'UNKNOWN') {
      unknownLines.push({ label: 'Labor (hours not set)', monthly: null, confidence: 'UNKNOWN', location: loc.name });
    }
  }

  const rollupEvents = opts.rollupEvents ?? [];
  if (rollupEvents.length === 0) {
    // No real captured data (e.g. cost_objects migration not yet applied) → config-only,
    // identical to the proven live tile. The seam is not invoked.
    const knownMonthly = floorMonthly + estimatedMonthly;
    return {
      floorMonthly, estimatedMonthly, knownMonthly, unknownLines, knownLines,
      computable: floorMonthly > 0 || estimatedMonthly > 0,
    };
  }

  // ── Seam-fed path (SUB-3): typed config + captured cost_objects through the ONE seam. ──
  // Capex is excluded from the monthly pool by the seam; cross-source dups count once.
  const seam = enforceCountOnce([...costConfigToEvents(config), ...rollupEvents]);

  const fedKnownLines: AccumulatedLine[] = seam.counted
    .filter((c) => c.bucket === 'MONTHLY_POOL')
    .map((c) => ({ label: c.label, monthly: c.amount, confidence: c.amountConfidence, location: c.source }));
  const fedUnknownLines: AccumulatedLine[] = [
    ...seam.unknownLines.map((l) => ({ label: l.label, monthly: null, confidence: 'UNKNOWN' as const, note: l.note, location: l.source })),
    ...seam.unconfirmedLines.map((l) => ({ label: l.label, monthly: null, confidence: l.amountConfidence, note: l.note ?? 'not yet confirmed a cost', location: l.source })),
  ];

  return {
    floorMonthly: seam.poolFloorMonthly,
    estimatedMonthly: seam.poolEstimatedMonthly,
    knownMonthly: seam.poolKnownMonthly,
    unknownLines: fedUnknownLines,
    knownLines: fedKnownLines,
    computable: seam.poolFloorMonthly > 0 || seam.poolEstimatedMonthly > 0,
    capexExcluded: seam.capexKnown,
    possibleDuplicateCount: seam.possibleDuplicates.length,
    fedFromRollup: true,
  };
}

// ── MarginEngine bridge ──────────────────────────────────────────────────────────

/**
 * Build a MarginEngineConfig that prices at a TARGET gross margin (single slab).
 * multiplier = 1 / (1 - margin)  →  retail = cost / (1 - margin)  →  gross margin == `margin`.
 * The canonical engine does the charm-rounded arithmetic; we never re-implement pricing.
 */
export function marginConfigForTarget(margin: number, overheadPerUnit = 0): MarginEngineConfig {
  const m = Math.min(Math.max(margin, 0), 0.999); // clamp; 1.0 would divide by zero
  return {
    slabs: [{ label: `target ${Math.round(m * 100)}% margin`, maxCost: 9999999, multiplier: 1 / (1 - m) }],
    pricingTiers: [{ name: 'default', discountPercent: 0, isDefault: true }],
    overheadPerUnit,
  };
}

// ── Sensitivity analysis (the curve) ─────────────────────────────────────────────

export interface SensitivityRow {
  n: number;
  /** Cost per unit using the floor only (confirmed+derived). */
  costFloor: number;
  /** Cost per unit including estimates (floor + estimated). */
  costKnown: number;
  /** Suggested price at baseline margin for the floor cost (MarginEngine). */
  priceFloor: number;
  /** Suggested price at baseline margin for the known cost (MarginEngine). */
  priceKnown: number;
  /** Realized gross margin of priceKnown vs costKnown (sanity echo, MarginEngine). */
  marginPct: string;
}

export interface ConfidenceMix {
  floorMonthly: number;
  estimatedMonthly: number;
  knownMonthly: number;
  unknownCount: number;
  unknownLabels: string[];
  hasUnknown: boolean;
  /** True when there is a real floor to compute a price from. */
  computable: boolean;
  // ── seam-reconciled extras (present only when fed real captured cost_objects, SUB-3). ──
  capexExcluded?: number;
  possibleDuplicateCount?: number;
  fedFromRollup?: boolean;
}

export interface CostToProduceResult {
  unitLabel: string;
  baselineMargin: number;
  priceReference: number | null;
  accumulation: Accumulation;
  confidence: ConfidenceMix;
  /** One row per denominator. Empty when not computable. */
  sensitivity: SensitivityRow[];
}

export function confidenceMix(acc: Accumulation): ConfidenceMix {
  return {
    floorMonthly: acc.floorMonthly,
    estimatedMonthly: acc.estimatedMonthly,
    knownMonthly: acc.knownMonthly,
    unknownCount: acc.unknownLines.length,
    unknownLabels: acc.unknownLines.map((l) => l.label),
    hasUnknown: acc.unknownLines.length > 0,
    computable: acc.computable,
    capexExcluded: acc.capexExcluded,
    possibleDuplicateCount: acc.possibleDuplicateCount,
    fedFromRollup: acc.fedFromRollup,
  };
}

/**
 * Full Cost-to-Produce analysis: accumulate → per-N cost range → MarginEngine price range.
 * `extraUnknownInventory` lets the caller fold in inventory rows whose cost_confidence is
 * UNKNOWN (business_inventory) so the unknown count reflects material costs too.
 */
export function analyze(
  config: CostToProduceConfig,
  extraUnknownInventory: string[] = [],
  opts: AccumulateOptions = {},
): CostToProduceResult {
  const acc = accumulate(config, opts);
  if (extraUnknownInventory.length) {
    for (const label of extraUnknownInventory) {
      acc.unknownLines.push({ label, monthly: null, confidence: 'UNKNOWN', location: 'inventory' });
    }
  }

  const baseline = config.margin?.baseline ?? 0.4;
  const mc = marginConfigForTarget(baseline);

  const sensitivity: SensitivityRow[] = acc.computable
    ? (config.denominators ?? [])
        .filter((n) => n > 0)
        .map((n) => {
          const costFloor = acc.floorMonthly / n;
          const costKnown = acc.knownMonthly / n;
          const priceFloor = calculateRetail(costFloor, mc);
          const priceKnown = calculateRetail(costKnown, mc);
          return {
            n,
            costFloor: round2(costFloor),
            costKnown: round2(costKnown),
            priceFloor,
            priceKnown,
            marginPct: getProfitMargin(costKnown, priceKnown),
          };
        })
    : [];

  // [TRACE:COST] (STD-003, on by default — commented out only after David owner-proves
  // the tile through the UI). The COMPUTE emit: loaded cost, the N set, and per-N results.
  console.log('[TRACE:COST] compute', {
    unitLabel: config.unitLabel ?? 'unit',
    floorMonthly: acc.floorMonthly,
    estimatedMonthly: acc.estimatedMonthly,
    knownMonthly: acc.knownMonthly,
    unknownCount: acc.unknownLines.length,
    denominators: config.denominators ?? [],
    computable: acc.computable,
    // SUB-3 seam-feed telemetry (present when real cost_objects fed the pool):
    fedFromRollup: acc.fedFromRollup ?? false,
    rollupEventsIn: opts.rollupEvents?.length ?? 0,
    capexExcluded: acc.capexExcluded ?? 0,
    possibleDuplicateCount: acc.possibleDuplicateCount ?? 0,
    perN: sensitivity.map((s) => ({
      n: s.n, costFloor: s.costFloor, costKnown: s.costKnown,
      priceFloor: s.priceFloor, priceKnown: s.priceKnown,
    })),
  });

  return {
    unitLabel: config.unitLabel ?? 'unit',
    baselineMargin: baseline,
    priceReference: config.priceReference ?? null,
    accumulation: acc,
    confidence: confidenceMix(acc),
    sensitivity,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
