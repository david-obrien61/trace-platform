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
  receiptId: 'amzn-114-2466808',   // SAME receipt → sameCost() = SAME
  vendor: 'Amazon',
  date: '2026-05-05',
};
