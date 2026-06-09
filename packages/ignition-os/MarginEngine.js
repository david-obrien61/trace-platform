// HONEST DEBT 🔴: deprecated — migrate callers to shared MarginEngine (TD#16).
//   Replacement: packages/shared/src/business-logic/MarginEngine.ts
//   Migration checklist: docs/audits/margin-engine-migration-checklist-2026-06-10.md
//   Callers: OnboardingWizard.jsx, PriceField.jsx, IgnitionPort.jsx, IgnitionProcure.jsx,
//            shared/src/components/SavingsReport.jsx (broken path — fixes in same migration)
//   Do not extend. Retire after all callers are migrated to shared engine.
//
/**
 * FILE: MarginEngine.js
 * PLATFORM: Universal (Web & Mobile)
 * PURPOSE: Unified pricing engine. Reads slab configuration from DataBridge so all
 *          modules use a single source of truth. Slabs are fully editable from PROT.
 *          Tier discounts (FLEET, LEGACY, FF) are applied on top of the slab result.
 */

import DataBridge from './DataBridge';

// [TRACE:MARGIN] ON — teardown instrumentation. Comment out after margin migration proven.
// David controls off per-subsystem (comment out this const; logs become dead code).
const TRACE_MARGIN = true;

// ── Default config — used when no custom config has been saved yet ─────────────
export const DEFAULT_MARGIN_CONFIG = {
  slabs: [
    { label: 'Consumables', maxCost: 50,   multiplier: 4.0  }, // $0–$50:    300% markup
    { label: 'Mid-Range',   maxCost: 200,  multiplier: 2.0  }, // $51–$200:  100% markup
    { label: 'Heavy',       maxCost: 1000, multiplier: 1.5  }, // $201–$1k:   50% markup
    { label: 'Major',       maxCost: null, multiplier: 1.25 }, // $1001+:     25% markup
  ],
  tierDiscounts: {
    FLEET:  10, // 10% off standard retail for fleet accounts
    LEGACY: 20, // 20% off for legacy/repeat customers
    FF:      5, // 5%  off for friends & family
  },
};

export const MarginEngine = {
  DEFAULT_CONFIG: DEFAULT_MARGIN_CONFIG,

  // ── Config accessors ────────────────────────────────────────────────────────

  getConfig: () => {
    const stored = DataBridge.load('margin_config');
    if (TRACE_MARGIN) console.log('[TRACE:MARGIN] MarginEngine.getConfig → source=%s slabs=%o', stored ? 'DataBridge' : 'DEFAULT', (stored || DEFAULT_MARGIN_CONFIG).slabs.map(s => s.label));
    return stored || DEFAULT_MARGIN_CONFIG;
  },

  // ── Core calculations ───────────────────────────────────────────────────────

  /**
   * Returns the slab that applies to a given cost.
   */
  getSlabForCost: (cost) => {
    const { slabs } = MarginEngine.getConfig();
    const slab = slabs.find(s => s.maxCost !== null && cost <= s.maxCost) || slabs[slabs.length - 1];
    if (TRACE_MARGIN) console.log('[TRACE:MARGIN] MarginEngine.getSlabForCost cost=%o → slab=%s multiplier=%o', cost, slab.label, slab.multiplier);
    return slab;
  },

  /**
   * Calculates the retail price for a part cost, applying the correct slab
   * multiplier and optional tier discount. Rounds to nearest .99.
   *
   * @param {number|string} cost  - Vendor/wholesale cost
   * @param {string}        tier  - 'STANDARD' | 'FLEET' | 'LEGACY' | 'FF'
   * @returns {number}            - Retail price
   */
  calculateRetail: (cost, tier = 'STANDARD') => {
    const numCost = parseFloat(cost);
    if (TRACE_MARGIN) console.log('[TRACE:MARGIN] MarginEngine.calculateRetail (LOCAL-IGNITION) called: cost=%o tier=%o — TEARDOWN TARGET: migrate callers to shared engine', cost, tier);
    if (isNaN(numCost) || numCost <= 0) return 0;

    const config    = MarginEngine.getConfig();
    const slab      = MarginEngine.getSlabForCost(numCost);
    const baseRetail = numCost * slab.multiplier;

    const discount  = (tier !== 'STANDARD') ? (config.tierDiscounts?.[tier] ?? 0) : 0;
    const retail    = baseRetail * (1 - discount / 100);
    const result    = Math.ceil(retail) - 0.01;

    if (TRACE_MARGIN) console.log('[TRACE:MARGIN] MarginEngine.calculateRetail result=%o (slab=%s, mult=%o, discount=%o%%)', result, slab.label, slab.multiplier, discount);
    return result;
  },

  /**
   * Gross profit margin percentage.
   */
  getProfitMargin: (cost, retail) => {
    const r = parseFloat(retail);
    const c = parseFloat(cost);
    if (!r || r <= 0) return '0.00';
    return (((r - c) / r) * 100).toFixed(2);
  },

  /**
   * Markup percentage (cost → retail) for a given cost, based on active slab.
   */
  getMarkupPercent: (cost) => {
    const slab = MarginEngine.getSlabForCost(parseFloat(cost) || 0);
    return Math.round((slab.multiplier - 1) * 100);
  },

  /**
   * Returns what a part SHOULD sell for vs what it was actually sold for.
   * Used by the leakage / savings report.
   */
  analyzeTransaction: (tx) => {
    if (TRACE_MARGIN) console.log('[TRACE:MARGIN] MarginEngine.analyzeTransaction called: cost=%o actualPrice=%o tier=%o', tx.cost, tx.actualPrice, tx.tier);
    const suggested = MarginEngine.calculateRetail(tx.cost, tx.tier || 'STANDARD');
    const leakage   = Math.max(0, suggested - (tx.actualPrice || 0));
    const margin    = MarginEngine.getProfitMargin(tx.cost, tx.actualPrice);
    if (TRACE_MARGIN) console.log('[TRACE:MARGIN] MarginEngine.analyzeTransaction result: suggested=%o leakage=%o margin=%o%%', suggested, leakage, margin);
    return { suggested, leakage, margin };
  },
};

export default MarginEngine;
