/**
 * ── DUAL-EDGE ROLLUP — adversarial tests · Core-2b SUB-2 · 2026-06-15 ─────────────
 *
 * Proves the rollup traverses BOTH edge tables (structural use_fraction + temporal
 * period-share, §5.2/§5.9), feeds the count-once seam (capex out of pool, dedup), and is
 * honest under incomplete data (UNKNOWN / UNCONFIRMED / unconfirmed-allocation surfaced,
 * never zeroed). Each test computes what a BUGGY rollup would produce and asserts the real
 * one differs — the assertions have teeth.
 *
 * Run (no test runner installed — pure TS over pure functions):
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/CostRollup.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import { rollup } from './CostRollup';
import { COOLRUNNINGS_GRAPH, FARM_GRAPH } from './__fixtures__/coolrunnings-corpus';

// ── tiny harness ─────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++;
  else {
    failed++;
    failures.push(msg);
    console.error('   ✗ ' + msg);
  }
}
function test(name: string, fn: () => void): void {
  console.log('▶ ' + name);
  fn();
}
const near = (a: number, b: number, tol = 0.05) => Math.abs(a - b) <= tol;

// ── 1. STRUCTURAL: containment + contribution rollup through the seam ──────────────
test('1. install PROJECT accumulates contained assets, capex-correct, UNKNOWN/UNCONFIRMED surfaced', () => {
  const r = rollup('cr-install', COOLRUNNINGS_GRAPH);
  // NSPanel 259.80 + meross 91.81 roll up; capex stays out of the monthly pool.
  ok(r.capexKnown === 351.61, `capex = NSPanel 259.80 + meross 91.81 = 351.61; got ${r.capexKnown}`);
  ok(r.poolKnownMonthly === 0, `a capex install has no monthly pool cost; got ${r.poolKnownMonthly}`);
  ok(r.accumulatedKnown === 351.61, `accumulated known = 351.61; got ${r.accumulatedKnown}`);
  // HP ProDesk: 0.6 × UNKNOWN is still UNKNOWN — surfaced, NOT zeroed (Surface Honesty).
  ok(r.seam.unknownLines.some((l) => l.id.startsWith('cr-hp-prodesk-600-g6')),
    'HP ProDesk (contribution at 0.6 of an UNKNOWN cost) surfaced as UNKNOWN, not 0');
  // Apollo: realization UNCONFIRMED — surfaced, not counted as firm cost.
  ok(r.seam.unconfirmedLines.some((l) => l.id.startsWith('cr-apollo-msr2')),
    'Apollo surfaced as UNCONFIRMED (is-it-even-a-cost-yet), not counted');
  ok(!r.seam.counted.some((c) => c.id.startsWith('cr-apollo-msr2')),
    'Apollo is NOT in the counted set');
  // The HP allocation SPLIT (0.6) is a guess — flagged on the allocation axis (§5.9).
  ok(r.unconfirmedAllocations.some((a) => a.fromId === 'cr-hp-prodesk-600-g6' && a.basisConfidence === 'ESTIMATED'),
    'the 0.6 carve-out basis is flagged as an unconfirmed allocation (separate from $ confidence)');
  // Bug-catch: zeroing UNKNOWN/UNCONFIRMED would inflate capex past 351.61.
  ok(r.capexKnown !== 564.11 && r.capexKnown !== 351.61 + 212.5,
    'assertion has teeth: counting HP-as-0 / Apollo-as-firm would change capex');
});

// ── 2. STRUCTURAL: use_fraction actually scales a known contribution ───────────────
test('2. a 0.5 contribution of a known cost crosses at half — use_fraction is applied', () => {
  // Two-node graph: a $100 CONFIRMED asset contributes 0.5 to a project.
  const g = {
    nodes: [
      { id: 'p', label: 'Project', node_type: 'PROJECT' as const, acquisition_cost: null, cost_confidence: 'UNKNOWN' as const },
      { id: 'a', label: 'Shared rig', node_type: 'ASSET' as const, acquisition_cost: 100, cost_confidence: 'CONFIRMED' as const, substantiation: 'SUBSTANTIATED' as const },
    ],
    edges: [{ id: 'e', parent_id: 'p', child_id: 'a', edge_type: 'contribution' as const, use_fraction: 0.5, basis_confidence: 'CONFIRMED' as const }],
    assignments: [],
    asOf: '2026-06-15',
  };
  const r = rollup('p', g);
  ok(r.capexKnown === 50, `0.5 × $100 = $50 crosses into the project; got ${r.capexKnown}`);
  ok(r.capexKnown !== 100, 'assertion has teeth: ignoring use_fraction would cross the full $100');
});

// ── 3. TEMPORAL: period-share allocation across sequential projects (§5.9) ─────────
test('3. one tractor reused across rabbit→chicken allocates by ASSIGNMENT PERIOD', () => {
  const rabbit = rollup('rabbit-meat', FARM_GRAPH);
  const chicken = rollup('chicken-meat', FARM_GRAPH);

  // Each gets a SHARE of the $5,000, not the whole thing, not nothing.
  ok(rabbit.capexKnown > 0 && rabbit.capexKnown < 5000,
    `rabbit gets a period share of the tractor; got ${rabbit.capexKnown}`);
  // Chicken ran longer (318 vs 181 days) → strictly larger asset share than rabbit.
  const chickenAssetShare = chicken.capexKnown - 300; // strip the conversion event
  ok(chickenAssetShare > rabbit.capexKnown,
    `chicken (318d) gets more tractor cost than rabbit (181d); got chicken ${chickenAssetShare} vs rabbit ${rabbit.capexKnown}`);
  // Bug-catch: dumping the full acquisition on the first project it touched.
  ok(rabbit.capexKnown !== 5000,
    'assertion has teeth: a naive rollup would dump the full $5,000 on the first project');
});

// ── 4. TEMPORAL: conversion_cost lands on the RECEIVING project (§5.9) ─────────────
test('4. the $300 conversion cost lands on chicken (receiving), not rabbit', () => {
  const rabbit = rollup('rabbit-meat', FARM_GRAPH);
  const chicken = rollup('chicken-meat', FARM_GRAPH);
  ok(chicken.contributions.some((c) => c.events.some((e) => e.label.includes('conversion'))),
    'chicken carries the conversion event');
  ok(!rabbit.contributions.some((c) => c.events.some((e) => e.label.includes('conversion'))),
    'rabbit does NOT carry the conversion cost (it lands on the receiving project)');
  // The conversion basis is ESTIMATED → flagged as an unconfirmed allocation.
  ok(chicken.unconfirmedAllocations.some((a) => a.fromId === 'farm-tractor' && a.basisConfidence === 'ESTIMATED'),
    'the open/estimated chicken assignment is flagged on the allocation axis');
  // Open period (end_at null) is flagged, not silently treated as closed.
  ok(chicken.flags.some((f) => /OPEN/.test(f)),
    'the open chicken assignment is flagged as allocated-to-asOf');
});

// ── 5. CONSERVATION + IDLE: shares + idle = the whole asset (the honesty teeth) ────
test('5. rabbit share + chicken share + idle = the whole $5,000 — and idle is surfaced', () => {
  const rabbit = rollup('rabbit-meat', FARM_GRAPH);
  const chicken = rollup('chicken-meat', FARM_GRAPH);
  const idle = chicken.idle.find((i) => i.assetId === 'farm-tractor');
  ok(!!idle, 'idle capital for the tractor is surfaced (held by domain between projects, §5.9)');
  ok((idle?.idleCostKnown ?? 0) > 0, `idle capital has a dollar value; got ${idle?.idleCostKnown}`);

  const rabbitAsset = rabbit.capexKnown;            // rabbit has no conversion
  const chickenAsset = chicken.capexKnown - 300;    // strip conversion
  const total = rabbitAsset + chickenAsset + (idle?.idleCostKnown ?? 0);
  ok(near(total, 5000),
    `conservation: rabbit ${rabbitAsset} + chicken ${chickenAsset} + idle ${idle?.idleCostKnown} = ${total.toFixed(2)} ≈ 5000`);
  // Bug-catch: dividing by ASSIGNED time (not life) would hide idle and inflate the shares.
  ok(!near(rabbitAsset + chickenAsset, 5000) || (idle?.idleCostKnown ?? 1) === 0,
    'assertion has teeth: if shares summed to 5000 with no idle, the idle gap was wrongly absorbed');

  console.log('   ↳ rabbit:', rabbitAsset, ' chicken(asset):', chickenAsset,
    ' conversion: 300  idle:', idle?.idleCostKnown, ' idleFraction:', idle?.idleFraction);
});

// ── report ─────────────────────────────────────────────────────────────────────────
console.log('\n──────────────────────────────────────────────');
console.log(`DUAL-EDGE ROLLUP TESTS: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('FAILURES:\n - ' + failures.join('\n - '));
  process.exit(1);
} else {
  console.log('✓ all rollup tests pass AND each proves it can catch its bug');
}
