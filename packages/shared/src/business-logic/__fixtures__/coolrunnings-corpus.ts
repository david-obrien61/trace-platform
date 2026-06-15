/**
 * ── PROVING CORPUS — CoolRunnings hardware (real, messy) · Core-2a SPIKE ──────────
 *
 * Source: docs/coolrunnings-hardware-spend-2026-06-02.md (read-only audit, business
 *   45830ba7 / Liberty Hill demo). These are the REAL numbers with REAL ambiguity —
 *   the point of the spike is to run the count-once seam against incomplete data, not
 *   tidy constructed cases.
 *
 * Represented here as cost_objects ASSET-node rows (node_type='ASSET', domain
 *   'CoolRunnings') — the shape the migration 20260615_cost_objects_rename_and_node_schema
 *   defines. NOT inserted into the live DB: the seam is pure/isolated (no DB), the
 *   migration's apply is David's gated action, and a production write needs explicit
 *   approval. If David wants live seeding, that is a separate gated step.
 *
 * Deliberately-messy cases the spike must handle (per the build prompt):
 *   - Confirmed capex          : NSPanel Pro 120 ×2  $259.80  CONFIRMED / SUBSTANTIATED
 *   - Derived capex            : meross MTS300HK      $91.81   DERIVED   / SUBSTANTIATED
 *   - UNKNOWN-cost capex       : HP ProDesk 600 G6    null     UNKNOWN   / OWNER_ASSERTED
 *   - Net-zero reversal        : Ecobee purchase + return → $0
 *   - Status-conflict not-yet  : Apollo MSR-2 ×5      UNCONFIRMED realization
 */

import type { CostObjectNodeRow, RecurringLineRow } from '../CountOnceSeam';
import type { CostGraph } from '../CostRollup';

/** ASSET nodes (the accumulator / cost_objects side). */
export const COOLRUNNINGS_NODES: CostObjectNodeRow[] = [
  // Confirmed-cost capex — Amazon order #114-2466808, search-PDF confirmed unit price.
  {
    id: 'cr-nspanel-pro-120',
    label: 'SONOFF NSPanel Pro 120 ×2',
    node_type: 'ASSET',
    domain: 'CoolRunnings',
    acquisition_cost: 259.80,
    cost_confidence: 'CONFIRMED',
    substantiation: 'SUBSTANTIATED', // on the Amazon order
    status: 'ACTIVE',
    receipt_id: 'amzn-114-2466808',
    vendor: 'Amazon',
    acquired_on: '2026-05-05',
  },

  // Derived-cost capex — price derived from order total ($417.31 − 259.80 − 65.70).
  // Amount is DERIVED; it is still SUBSTANTIATED (the order document exists). Two axes.
  {
    id: 'cr-meross-mts300hk',
    label: 'meross MTS300HK Smart Thermostat',
    node_type: 'ASSET',
    domain: 'CoolRunnings',
    acquisition_cost: 91.81,
    cost_confidence: 'DERIVED',
    substantiation: 'SUBSTANTIATED', // derived FROM the order — proof exists
    status: 'ACTIVE',
    receipt_id: 'amzn-114-2466808',
    vendor: 'Amazon',
    acquired_on: '2026-05-05',
  },

  // UNKNOWN-cost capex — the owner-does-nothing case. No order, no receipt. Most
  // expensive item in the build. Cost is UNKNOWN — must surface, NEVER be zeroed.
  {
    id: 'cr-hp-prodesk-600-g6',
    label: 'HP ProDesk 600 G6 (Home Assistant server)',
    node_type: 'ASSET',
    domain: 'CoolRunnings',
    acquisition_cost: null,          // UNKNOWN — market $200–450, not asserted as a figure
    cost_confidence: 'UNKNOWN',
    substantiation: 'OWNER_ASSERTED', // installed, but no document → at-risk
    status: 'ACTIVE',
    receipt_id: null,
    vendor: null,
    acquired_on: null,
  },

  // Status-conflict / not-yet-a-cost — MASTER_BRIEF says installed ×5; BACKLOG says
  // "under consideration". Cannot both be true. Must carry honest "unknown whether
  // this is even a cost yet" — NOT a silent $0 that reads as free hardware.
  {
    id: 'cr-apollo-msr2',
    label: 'Apollo MSR-2 mmWave Presence Sensor ×5',
    node_type: 'ASSET',
    domain: 'CoolRunnings',
    acquisition_cost: 212.50,        // estimate carried (5 × ~$42.50) but NOT counted
    cost_confidence: 'ESTIMATED',
    substantiation: 'OWNER_ASSERTED',
    status: 'UNASSIGNED',
    realization: 'UNCONFIRMED',      // installed-or-planned unknown
    receipt_id: null,
    vendor: null,
    acquired_on: null,
  },
];

/**
 * The Ecobee net-zero pair (purchase then RETURNED). Modeled as a CAPEX purchase event
 * plus a reversal event linked via reversalOf. Nets to $0 — no double-count, no negative
 * leak into the monthly pool. Built as raw CostEvents (the reversal has no node row).
 */
export const ECOBEE_PURCHASE = {
  id: 'cr-ecobee-purchase',
  label: 'Ecobee Smart Thermostat',
  amount: 160.0,
  bucket: 'CAPEX' as const,
  amountConfidence: 'ESTIMATED' as const, // ~$160 typical price
  substantiation: 'SUBSTANTIATED' as const, // on Amazon order #112-4539097
  receiptId: 'amzn-112-4539097',
  vendor: 'Amazon',
  date: '2026-04-19',
  source: 'cost_objects:cr-ecobee',
};

export const ECOBEE_RETURN = {
  id: 'cr-ecobee-return',
  label: 'Ecobee Smart Thermostat (return credit)',
  amount: -160.0,
  bucket: 'CAPEX' as const,
  amountConfidence: 'ESTIMATED' as const,
  substantiation: 'SUBSTANTIATED' as const,
  reversalOf: 'cr-ecobee-purchase',
  receiptId: 'amzn-112-4539097',
  vendor: 'Amazon',
  date: '2026-04-25',
  source: 'cost_objects:cr-ecobee',
};

/**
 * A legitimately-recurring MONTHLY pool cost with NO accumulator/node entry — the
 * over-correction guard. Nabu Casa (Home Assistant Cloud) ~$6.50/mo. The seam must
 * NOT drop this while preventing overlaps.
 */
export const NABU_CASA_RECURRING: RecurringLineRow = {
  id: 'cr-nabu-casa',
  label: 'Nabu Casa (Home Assistant Cloud)',
  monthlyAmount: 6.5,
  confidence: 'CONFIRMED',
  substantiation: 'OWNER_ASSERTED', // typed; no receipt captured yet — counted + at-risk
  receiptId: null,
  vendor: 'Nabu Casa',
  date: null,
};

/**
 * A DUPLICATE of the NSPanel cost mistakenly ALSO entered as a recurring pool line —
 * same receipt_id as the node. Shape 1 double-count fixture. Must be counted ONCE.
 * (period-pool side of the seam; same event as cr-nspanel-pro-120.)
 */
export const NSPANEL_DUP_AS_RECURRING: RecurringLineRow = {
  id: 'cr-nspanel-dup',
  label: 'SONOFF NSPanel Pro 120 ×2',
  monthlyAmount: 259.80,           // mistakenly typed as if monthly
  confidence: 'CONFIRMED',
  substantiation: 'OWNER_ASSERTED',
  receiptId: 'amzn-114-2466808',   // SAME receipt → sameCost() = MERGE
  vendor: 'Amazon',
  date: '2026-05-05',
};

// ── Core-2b canonical: car-wash subscription (the under-count trap) ─────────────────
//
// Two $9.99 charges, same merchant, ~one month apart, on one card. GROUND TRUTH: two
// vehicles = TWO real RECURRING_FIXED subscriptions, billed regardless of use. The
// matcher must NOT merge them (under-count), NOT treat them as per-occasion washes, must
// recognize the recurring shape, and return NEED_CLARIFICATION with a good disposition.
// No explicit `cadence` is pre-labeled — the recurring shape is reached without it: the
// ~31-day spacing alone infers a MONTHLY cadence (and the pool provenance agrees), the
// way it would from raw card data.
import type { CostEvent } from '../CountOnceSeam';

export const CARWASH_A: CostEvent = {
  id: 'cw-2026-05',
  label: 'Sparkle Express Wash Club',
  amount: 9.99,
  bucket: 'MONTHLY_POOL',
  amountConfidence: 'CONFIRMED',
  substantiation: 'SUBSTANTIATED', // on the card statement
  receiptId: null,                 // card line — no merchant receipt id
  vendor: 'Sparkle Express',
  date: '2026-05-10',
  source: 'card:statement',
};

export const CARWASH_B: CostEvent = {
  id: 'cw-2026-06',
  label: 'Sparkle Express Wash Club',
  amount: 9.99,
  bucket: 'MONTHLY_POOL',
  amountConfidence: 'CONFIRMED',
  substantiation: 'SUBSTANTIATED',
  receiptId: null,
  vendor: 'Sparkle Express',
  date: '2026-06-10',              // ~31 days later → inferred MONTHLY cadence
  source: 'card:statement',
};

// ── Core-2b: card line + email receipt for ONE purchase → MERGE ─────────────────────
// Same merchant, same amount, SAME day, two records (the card line and the emailed
// receipt). One purchase corroborated twice — must MERGE (count once).
export const PART_CARD_LINE: CostEvent = {
  id: 'part-card',
  label: 'NAPA — serpentine belt',
  amount: 48.27,
  bucket: 'CAPEX',
  amountConfidence: 'CONFIRMED',
  substantiation: 'OWNER_ASSERTED', // card line only, no document attached
  receiptId: null,
  vendor: 'NAPA Auto Parts',
  date: '2026-06-02',
  source: 'card:statement',
};

export const PART_EMAIL_RECEIPT: CostEvent = {
  id: 'part-receipt',
  label: 'NAPA — serpentine belt',
  amount: 48.27,
  bucket: 'CAPEX',
  amountConfidence: 'CONFIRMED',
  substantiation: 'SUBSTANTIATED', // the emailed receipt is the document
  receiptId: 'napa-eml-77120',
  vendor: 'NAPA Auto Parts',
  date: '2026-06-02',
  source: 'email:receipt',
};

// ── Core-2b: one-off cash wash vs subscription wash → different SHAPE ────────────────
// Same merchant, same amount, but one is an explicit ONE_OFF (a single drive-through
// wash) and the other a MONTHLY plan. classifyShape must separate PER_OCCASION from
// RECURRING_FIXED even when the dollar figures match.
export const CASH_WASH_ONE_OFF: CostEvent = {
  id: 'wash-oneoff',
  label: 'Sparkle Express — single wash',
  amount: 9.99,
  bucket: 'MONTHLY_POOL',
  amountConfidence: 'CONFIRMED',
  substantiation: 'OWNER_ASSERTED',
  cadence: 'ONE_OFF',
  vendor: 'Sparkle Express',
  date: '2026-06-14',
  source: 'card:statement',
};

export const SUBSCRIPTION_WASH: CostEvent = {
  id: 'wash-sub',
  label: 'Sparkle Express Wash Club',
  amount: 9.99,
  bucket: 'MONTHLY_POOL',
  amountConfidence: 'CONFIRMED',
  substantiation: 'OWNER_ASSERTED',
  cadence: 'MONTHLY',
  vendor: 'Sparkle Express',
  date: '2026-06-10',
  source: 'card:statement',
};

// ════════════════════════════════════════════════════════════════════════════════════
// GRAPH FIXTURES — Core-2b SUB-2 (dual-edge rollup). Nodes + edges + assignments, the
// shape migration 20260615_cost_objects_rename_and_node_schema defines. Still NOT in the
// live DB (migration gated/unapplied) — pure-isolation test data, like the corpus above.
// ════════════════════════════════════════════════════════════════════════════════════

// ── STRUCTURAL: the CoolRunnings home-automation install as a PROJECT node, the existing
//    hardware assets contained in it (§5.2 containment). Proves: traversal, count-once
//    through the seam, capex-out-of-pool, UNKNOWN (HP) + UNCONFIRMED (Apollo) surfaced. ──
export const CR_INSTALL_PROJECT: CostObjectNodeRow = {
  id: 'cr-install',
  label: 'CoolRunnings Home-Automation Install',
  node_type: 'PROJECT',
  domain: 'CoolRunnings',
  acquisition_cost: null,        // a project has no acquisition cost of its own
  cost_confidence: 'UNKNOWN',
  status: 'ACTIVE',
};

export const COOLRUNNINGS_GRAPH: CostGraph = {
  nodes: [CR_INSTALL_PROJECT, ...COOLRUNNINGS_NODES],
  edges: [
    // NSPanel + meross are fully contained in the install (use_fraction 1.0).
    { id: 'e-nspanel', parent_id: 'cr-install', child_id: 'cr-nspanel-pro-120', edge_type: 'containment', use_fraction: 1.0, basis_confidence: 'CONFIRMED' },
    { id: 'e-meross',  parent_id: 'cr-install', child_id: 'cr-meross-mts300hk', edge_type: 'containment', use_fraction: 1.0, basis_confidence: 'CONFIRMED' },
    // HP ProDesk is the Home Assistant server — shared 60% CoolRunnings / 40% personal:
    //   a CONTRIBUTION at use_fraction 0.6 (the carve-out, §5.7). Its cost is UNKNOWN, so
    //   0.6 × UNKNOWN is still UNKNOWN — must surface, never become 0.
    { id: 'e-hp', parent_id: 'cr-install', child_id: 'cr-hp-prodesk-600-g6', edge_type: 'contribution', use_fraction: 0.6, basis_confidence: 'ESTIMATED' },
    // Apollo sensors — contained, but realization UNCONFIRMED (installed-or-planned unknown).
    { id: 'e-apollo', parent_id: 'cr-install', child_id: 'cr-apollo-msr2', edge_type: 'containment', use_fraction: 1.0, basis_confidence: 'CONFIRMED' },
  ],
  assignments: [],
  asOf: '2026-06-15',
};

// ── TEMPORAL: the rabbit/tractor sequence (§5.9, David's real farm history). One tractor
//    ASSET reused across SEQUENTIAL projects — rabbit-meat then (converted) chicken-meat —
//    with an IDLE gap between. Proves: period-share allocation, conversion-cost on the
//    receiving project, open-period → asOf, idle-capital surfacing, and conservation
//    (rabbit share + chicken share + idle = the whole $5,000 acquisition). ──
export const FARM_TRACTOR: CostObjectNodeRow = {
  id: 'farm-tractor',
  label: 'Farm tractor (rabbit cages → chicken tractor)',
  node_type: 'ASSET',
  domain: 'Farm',
  acquisition_cost: 5000.0,
  cost_confidence: 'CONFIRMED',
  substantiation: 'SUBSTANTIATED',
  status: 'IDLE',                 // §5.9 idle-capital state
  acquired_on: '2025-01-01',
};

export const RABBIT_PROJECT: CostObjectNodeRow = {
  id: 'rabbit-meat',
  label: 'Rabbit-meat product run',
  node_type: 'PROJECT',
  domain: 'Farm',
  acquisition_cost: null,
  cost_confidence: 'UNKNOWN',
  project_status: 'converted',
};

export const CHICKEN_PROJECT: CostObjectNodeRow = {
  id: 'chicken-meat',
  label: 'Chicken-meat product run',
  node_type: 'PROJECT',
  domain: 'Farm',
  acquisition_cost: null,
  cost_confidence: 'UNKNOWN',
  project_status: 'open',
};

// Life window = earliest start (2025-01-01) … asOf (2026-06-15) = 530 days.
//   rabbit  : 2025-01-01 → 2025-07-01  = 181 days
//   IDLE GAP: 2025-07-01 → 2025-08-01  =  31 days  (no assignment — held by domain)
//   chicken : 2025-08-01 → (open, asOf) = 318 days  + $300 conversion
//   181 + 31 + 318 = 530 ✓  → shares: rabbit 181/530, chicken 318/530, idle 31/530.
export const FARM_GRAPH: CostGraph = {
  nodes: [FARM_TRACTOR, RABBIT_PROJECT, CHICKEN_PROJECT],
  edges: [],
  assignments: [
    { id: 'asg-rabbit',  asset_id: 'farm-tractor', project_id: 'rabbit-meat',  start_at: '2025-01-01', end_at: '2025-07-01', basis_confidence: 'CONFIRMED' },
    { id: 'asg-chicken', asset_id: 'farm-tractor', project_id: 'chicken-meat', start_at: '2025-08-01', end_at: null, conversion_cost: 300.0, basis_confidence: 'ESTIMATED' },
  ],
  asOf: '2026-06-15',
};
