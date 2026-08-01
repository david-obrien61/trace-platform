/**
 * ── moduleSeedRow / catalogSeedRows — THE DAY-ONE ROW STATE OF EVERY MODULE · 2026-08-01 ──
 *
 * WHAT THIS GUARDS, and why it is worth a test file at all for two lines of `.map()`:
 *
 *   These two booleans decide **what a tenant is charged for and when.** `enabled` says a module
 *   is included in the base subscription; `start_trial` starts a thirty-day clock whose expiry is
 *   a conversion-or-go-dark decision. Get either wrong in the catalog and the mistake is silent —
 *   `useModules.ts` renders a MISSING row and a disabled row identically, so nothing on any screen
 *   distinguishes "we never seeded this" from "it is off." The seed is the last point at which a
 *   mechanical check is possible.
 *
 *   The rule is DERIVED from fields that already exist (`billing`, `trial_days`) rather than from a
 *   new flag, so the risk is not a typo — it is the derivation quietly disagreeing with the catalog
 *   after someone edits a row. That is what these assert.
 *
 * ⚠️ THESE ARE NOT ASSERTIONS ABOUT WHICH MODULES SHOULD BE CORE. That is David's ruling and it
 * lives in MODULE_CATALOG. A test pinning the current core set would fail the day he promotes one —
 * turning his own decision into a red build, which is the "frozen model" defect capA hit (#173).
 * What is pinned is the MAPPING and the INVARIANTS BETWEEN FIELDS, both of which must hold for
 * every possible catalog.
 *
 * Run (pure TS — the registry imports only lucide-react TYPES, so nothing React executes):
 *   node_modules/.bin/esbuild packages/cultivar-os/src/registry/moduleSeed.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import { MODULE_CATALOG, moduleSeedRow, catalogSeedRows } from './tileRegistry';
import type { ModuleEntry } from './tileRegistry';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg);
}

const entry = (over: Partial<ModuleEntry>): ModuleEntry => ({
  module_key: 'probe', billing: 'add_on', price_monthly: 19, trial_days: 30, note: 'probe', ...over,
});

// ── 1. THE MAPPING, both directions, on synthetic rows ───────────────────────────────────────────

ok(moduleSeedRow(entry({ billing: 'core', trial_days: 0 })).enabled === true,
   'A1 core seeds ENABLED — it is included in the base subscription');
ok(moduleSeedRow(entry({ billing: 'add_on' })).enabled === false,
   'A2 an add-on seeds DISABLED — the owner has not bought it');
ok(moduleSeedRow(entry({ billing: 'unpriced', price_monthly: null, trial_days: 0 })).enabled === false,
   'A3 unpriced seeds DISABLED');

ok(moduleSeedRow(entry({ billing: 'add_on', trial_days: 30 })).start_trial === true,
   'A4 a priced add-on starts its clock at seed');
ok(moduleSeedRow(entry({ billing: 'core', trial_days: 0 })).start_trial === false,
   'A5 🔴 CORE NEVER STARTS A CLOCK — it is included, so there is nothing to convert to');
ok(moduleSeedRow(entry({ billing: 'unpriced', price_monthly: null, trial_days: 0 })).start_trial === false,
   'A6 🔴 UNPRICED NEVER STARTS A CLOCK — a trial is a countdown to a price decision, and there is no price (D-9)');

// 🔴 THE NEGATIVE THAT MATTERS: the rule is `trial_days > 0`, NOT `billing === add_on`. If someone
// later rewrites it in terms of `billing`, this is the probe that catches it — an add-on David has
// set to zero trial days (sold outright, no evaluation period) must NOT get a clock.
ok(moduleSeedRow(entry({ billing: 'add_on', trial_days: 0 })).start_trial === false,
   'A7 🔴 an add_on with trial_days 0 gets NO clock — the rule reads trial_days, not billing');
// …and its mirror: a core module someone gives a trial length to WOULD get one. That combination is
// nonsense, which is why invariant B3 below forbids it in the catalog rather than in the mapping.
ok(moduleSeedRow(entry({ billing: 'core', trial_days: 30 })).start_trial === true,
   'A8 the mapping is honest about the nonsense combination rather than silently correcting it');

ok(moduleSeedRow(entry({ module_key: 'seasonal_module' })).module_key === 'seasonal_module',
   'A9 the key is carried through unchanged — it is the join to business_modules');

// ── 2. CATALOG INVARIANTS — these must hold for EVERY row, now and after any edit ────────────────

ok(catalogSeedRows().length === MODULE_CATALOG.length,
   'B1 🔴 EVERY module gets a row — no filtering, which is the ruling. A filtered seed is a module with no clock and no bill');

ok(new Set(catalogSeedRows().map(r => r.module_key)).size === MODULE_CATALOG.length,
   'B2 every seeded key is distinct — a duplicate would collide on the (business_id, module_key) PK and silently seed one row fewer');

for (const m of MODULE_CATALOG) {
  const row = moduleSeedRow(m);
  // 🔴 B3 — the combination the mapping deliberately does not correct: an ENABLED row with a
  // running trial clock. It would read as "included in your subscription, expiring in 30 days."
  ok(!(row.enabled && row.start_trial),
     `B3 ${m.module_key}: seeded ENABLED and with a trial clock — a module cannot be both included and expiring`);
  // B4 — the money invariant, from the other side: anything with a clock must have a price to
  // convert TO. `verify-tile-fields` asserts billing ↔ price_monthly; this asserts trial ↔ price.
  ok(!(row.start_trial && m.price_monthly === null),
     `B4 ${m.module_key}: a trial clock over a NULL price — the countdown ends at a number nobody has decided (D-9)`);
  ok(!(row.start_trial && m.price_monthly === 0),
     `B5 ${m.module_key}: a trial clock over a $0 price — nothing to convert to`);
  ok(!(row.enabled && m.billing !== 'core'),
     `B6 ${m.module_key}: seeded enabled without being core — the tenant gets a paid module free and nothing bills it`);
}

// ── 3. THE PAYLOAD SHAPE THE RPC VALIDATES ──────────────────────────────────────────────────────
// `seed_business_modules` refuses the WHOLE batch on a malformed element (a partial seed looks
// complete to every count-based check). These assert the client never sends one.

for (const row of catalogSeedRows()) {
  ok(typeof row.module_key === 'string' && row.module_key.trim().length > 0,
     `C1 ${row.module_key}: non-blank module_key — the RPC refuses the batch otherwise`);
  ok(typeof row.enabled === 'boolean' && typeof row.start_trial === 'boolean',
     `C2 ${row.module_key}: both flags are real booleans — the RPC's jsonb_typeof check refuses anything else`);
  ok(Object.keys(row).length === 3,
     `C3 ${row.module_key}: exactly the three keys the RPC destructures — an extra key is silently dropped by jsonb_to_recordset, which is worse than rejected`);
}

// ── report ───────────────────────────────────────────────────────────────────────────────────────
console.log(`moduleSeed: ${passed} passed, ${failed} failed`);
if (failed) { for (const f of failures) console.error('  ✗ ' + f); process.exit(1); }
