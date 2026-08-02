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

import { MODULE_CATALOG, TILE_REGISTRY, moduleSeedRow, catalogSeedRows, enabledByDefault } from './tileRegistry';
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

/**
 * 🔴 `surfaceIsLive` DEFAULTS TO TRUE **HERE IN THE TEST ONLY, AND NEVER IN THE MAPPING.**
 * `moduleSeedRow` requires it explicitly, because a default there is a silent decision about the
 * most dangerous input. This helper exists so the ~20 probes written before the surface rule existed
 * keep asserting what they were written to assert — they are all about a module whose tile IS live,
 * which is the ordinary case. **The probes that exercise the other branch pass `false` and say so.**
 */
const seedRow = (e: ModuleEntry, surfaceIsLive = true) => moduleSeedRow(e, surfaceIsLive);

// ── 1. THE MAPPING, both directions, on synthetic rows ───────────────────────────────────────────

ok(seedRow(entry({ billing: 'core', trial_days: 0 })).enabled === true,
   'A1 core seeds ENABLED — it is included in the base subscription');
// 🔴 A2 REVERSED 2026-08-02 (David's ruling, correcting Lightning's 2026-08-01 seed spec). It read
// `.enabled === false` — "an add-on seeds DISABLED, the owner has not bought it" — which put a
// running clock on a module the member could not use. **The trial IS the grace period during which
// the module is fully live**; the clock ENDS access, it does not withhold it. See the header.
ok(seedRow(entry({ billing: 'add_on', trial_days: 30 })).enabled === true,
   'A2 🔴 a TRIALLING add-on seeds ENABLED — the trial is the period during which it fully works');
ok(seedRow(entry({ billing: 'unpriced', price_monthly: null, trial_days: 0 })).enabled === false,
   'A3 unpriced seeds DISABLED — RULING OWED, and it is the one row this mapping does not yet answer');

ok(seedRow(entry({ billing: 'add_on', trial_days: 30 })).start_trial === true,
   'A4 a priced add-on starts its clock at seed');
ok(seedRow(entry({ billing: 'core', trial_days: 0 })).start_trial === false,
   'A5 🔴 CORE NEVER STARTS A CLOCK — it is included, so there is nothing to convert to');
ok(seedRow(entry({ billing: 'unpriced', price_monthly: null, trial_days: 0 })).start_trial === false,
   'A6 🔴 UNPRICED NEVER STARTS A CLOCK — a trial is a countdown to a price decision, and there is no price (D-9)');

// 🔴 THE NEGATIVE THAT MATTERS: the rule is `trial_days > 0`, NOT `billing === add_on`. If someone
// later rewrites it in terms of `billing`, this is the probe that catches it — an add-on David has
// set to zero trial days (sold outright, no evaluation period) must NOT get a clock.
ok(seedRow(entry({ billing: 'add_on', trial_days: 0 })).start_trial === false,
   'A7 🔴 an add_on with trial_days 0 gets NO clock — the rule reads trial_days, not billing');
// 🔴 A7b — the same row from the ENABLEMENT side, and it is the probe that keeps the reversal
// honest. An add-on sold outright with no evaluation period is NOT live at seed: nobody granted it
// and no clock is running. Liveness follows the TRIAL, not the billing class — so "add-ons are now
// enabled" is precisely the wrong summary of this ruling, and this fails if someone writes it.
ok(seedRow(entry({ billing: 'add_on', trial_days: 0 })).enabled === false,
   'A7b 🔴 an add_on with NO trial seeds DISABLED — liveness follows the clock, not the billing class');
// …and its mirror: a core module someone gives a trial length to WOULD get one. That combination is
// nonsense, which is why invariant B3 below forbids it in the catalog rather than in the mapping.
ok(seedRow(entry({ billing: 'core', trial_days: 30 })).start_trial === true,
   'A8 the mapping is honest about the nonsense combination rather than silently correcting it');

ok(seedRow(entry({ module_key: 'seasonal_module' })).module_key === 'seasonal_module',
   'A9 the key is carried through unchanged — it is the join to business_modules');

// ── 1a-bis. THE FOURTH VALUE — `core_optional` (David's ruling 2026-08-02 (2)) ───────────────────
// $0, no trial, SEEDS DARK. "It ships with the platform, and a nursery that gives contractor
// discounts turns it on. Nothing expires because there is nothing to expire."
const coreOpt = (over: Partial<ModuleEntry> = {}) =>
  entry({ billing: 'core_optional', price_monthly: 0, trial_days: 0, ...over });

ok(seedRow(coreOpt()).enabled === false,
   'A16 🔴 core_optional seeds DARK — that is the ENTIRE difference from core, and the reason the value exists');
ok(seedRow(coreOpt()).configured === false,
   'A17 core_optional seeds UNCONFIGURED — it is not live, so there is nothing set up');
ok(seedRow(coreOpt()).start_trial === false,
   'A18 🔴 core_optional NEVER starts a clock — nothing expires because there is nothing to expire');
ok(seedRow(coreOpt()).trial_days === 0,
   'A19 …and it carries no term either — a term with no trial is a trial that never started (B8)');

// 🔴 A20/A21 — THE DERIVATION IS ONE FUNCTION AND THESE ARE THE PROBES THAT KEEP IT ONE. `billing`
// decides the baseline ALONE; if someone re-spells `billing === 'core'` inline anywhere, the fourth
// value silently becomes core again at that site and nothing else in this file would notice.
ok(enabledByDefault('core') === true && enabledByDefault('core_optional') === false
   && enabledByDefault('add_on') === false && enabledByDefault('unpriced') === false,
   'A20 🔴 enabledByDefault is TOTAL over ModuleBilling and only `core` is on — one field decides');
ok(seedRow(coreOpt()).enabled === enabledByDefault('core_optional'),
   'A21 🔴 the mapping READS the derivation rather than restating it — a second spelling of the baseline is how the fourth value gets lost');

// 🔴 A22 — THE OVERRIDE STILL WORKS ON TOP OF THE NEW BASELINE. The 2026-08-02 (1) ruling is
// untouched by the 2026-08-02 (2) ruling: a clock makes a module live regardless of its baseline.
// This is the combination nothing in the catalog uses today, which is exactly why it needs a probe —
// the day someone trials a core_optional module, THIS says what happens.
ok(seedRow(coreOpt({ trial_days: 30 })).enabled === true,
   'A22 🔴 a trial OVERRIDES a dark baseline — the clock still ends access rather than withholding it');

// ── 1a-ter. THE SURFACE RULE — a trial starts when the thing being trialled can be USED ──────────
// David's ruling 2026-08-02 (3). A module whose tile is `planned` counts down against nothing: the
// owner cannot use it, cannot evaluate it, and at day thirty is asked to pay for something he has
// never seen. Same room as the two clocks already ruled out — over a module the server refuses, and
// over a price nobody has set.
const dark = (over: Partial<ModuleEntry> = {}) => seedRow(entry(over), false);

ok(dark({ billing: 'add_on', trial_days: 30 }).start_trial === false,
   'A23 🔴 NO CLOCK for a module whose tile is not live — a trial is a countdown to a price decision, and there is nothing to decide');
ok(dark({ billing: 'add_on', trial_days: 30 }).enabled === false,
   'A24 🔴 …and it therefore seeds DARK. Liveness follows the clock, so suppressing the clock suppresses the liveness — one rule, not two');
// 🔴 A25 IS THE ONE THAT WOULD HAVE CAUGHT A HALF-FIX. Suppressing `start_trial` while the TERM
// still travelled would leave a row carrying 30 days of a trial that never started — a third state
// (B8's defect) invented by the fix meant to remove one.
ok(dark({ billing: 'add_on', trial_days: 30 }).trial_days === 0,
   'A25 🔴 the TERM does not travel either — a term with no trial is a trial that never started (B8)');
// The catalog keeps its OFFER untouched: this is about what is GRANTED, not about what is priced.
ok(MODULE_CATALOG.find((m) => m.module_key === 'seasonal_module')?.trial_days === 30,
   'A26 🔴 the CATALOG still offers 30 days — the offer survives, only the grant is withheld. Hand-editing the catalog to 0 would have destroyed the offer and needed undoing per tile on ship day');
// A core module is unaffected: it is included, not trialled, so a dark surface changes nothing about
// its enablement. This is the probe that stops the surface rule leaking into the baseline.
ok(dark({ billing: 'core', trial_days: 0 }).enabled === true,
   'A27 🔴 a CORE module is live even with a dark surface — the surface gates the CLOCK, never the baseline');

// ── 1b. THE TWO RULINGS OF 2026-08-01 (2) ───────────────────────────────────────────────────────

// 🔴 CORE READS `active` ON DAY ONE. `useModules` renders `active` only on `enabled && configured`,
// so seeding `configured:false` put an [ENABLE] button on an already-included working feature.
ok(seedRow(entry({ billing: 'core', trial_days: 0 })).configured === true,
   'A10 🔴 core seeds CONFIGURED — there is nothing to configure about being included');
// 🔴 A11 REVERSED with A2, and for the SAME reason one layer down: `useModules.ts:109` renders
// `active` only on `enabled && configured`, so a trialling module seeded `configured:false` would
// STILL show `[ENABLE]` — the ruling would have changed the data and nothing on the screen. The
// precedent is already ruled and already shipped: `qb_invoicing` seeds `configured:true` with no
// QuickBooks link, because a green tile says *included*, not *connected*. A trialling module says
// *live*, not *personalised* — and tapping it goes to its setup page, which is the same tap the
// `[ENABLE]` button performed (they are literally the same handler; see Dashboard.tsx:706-707).
ok(seedRow(entry({ billing: 'add_on', trial_days: 30 })).configured === true,
   'A11 🔴 a TRIALLING module seeds CONFIGURED — else it renders [ENABLE] and the ruling changes nothing on screen');
ok(seedRow(entry({ billing: 'add_on', trial_days: 0 })).configured === false,
   'A11b an add_on with no trial seeds UNCONFIGURED — it is not live, so there is nothing set up');
ok(seedRow(entry({ billing: 'unpriced', price_monthly: null, trial_days: 0 })).configured === false,
   'A12 unpriced seeds UNCONFIGURED');

// 🔴 THE TERM TRAVELS WITH THE ROW. If the catalog number were read at render instead, changing 30
// to 14 would retroactively expire every tenant seeded more than fourteen days ago.
ok(seedRow(entry({ trial_days: 30 })).trial_days === 30,
   'A13 🔴 the TERM is carried into the payload — expiry computes from the stored pair, not from the catalog');
ok(seedRow(entry({ trial_days: 14 })).trial_days === 14,
   'A14 …and it is the catalog value verbatim, not a constant — a changed catalog governs NEW trials');
ok(seedRow(entry({ billing: 'core', trial_days: 0 })).trial_days === 0,
   'A15 core carries 0 — no term, because no trial');

// ── 2. CATALOG INVARIANTS — these must hold for EVERY row, now and after any edit ────────────────

ok(catalogSeedRows().length === MODULE_CATALOG.length,
   'B1 🔴 EVERY module gets a row — no filtering, which is the ruling. A filtered seed is a module with no clock and no bill');

ok(new Set(catalogSeedRows().map(r => r.module_key)).size === MODULE_CATALOG.length,
   'B2 every seeded key is distinct — a duplicate would collide on the (business_id, module_key) PK and silently seed one row fewer');

// 🔴 THE B-LOOP NOW ASSERTS OVER `catalogSeedRows()` — THE ACTUAL PRODUCTION OUTPUT — rather than
// re-deriving each row with a locally-chosen surface flag. Since the surface rule landed, a row
// built here with a hand-picked `surfaceIsLive` would be asserting invariants about a row the
// seeder never sends. `catalogSeedRows()` maps MODULE_CATALOG in order, so the index aligns.
const PRODUCTION_ROWS = catalogSeedRows();
MODULE_CATALOG.forEach((m, i) => {
  const row = PRODUCTION_ROWS[i];
  ok(row.module_key === m.module_key,
     `B0 ${m.module_key}: the production row at this index is THIS module — index alignment is what makes every invariant below about the row it names`);
  // 🔴 B3 INVERTED 2026-08-02 — IT ASSERTED THE DEFECT. It forbade `enabled && start_trial`, on the
  // reasoning that a module "cannot be both included and expiring." That is exactly what a trial IS:
  // included, and expiring. The old invariant is why every add-on seeded dark with a clock running
  // over it, and why a test suite of 138 assertions went green over the defect — **the model was
  // wrong in the test and in the mapping identically, so nothing could disagree with anything.**
  ok(!(row.start_trial && !row.enabled),
     `B3 ${m.module_key}: a trial clock over a DISABLED module — the clock ends access, it does not withhold it, so nothing is being trialled`);
  // B4 — the money invariant, from the other side: anything with a clock must have a price to
  // convert TO. `verify-tile-fields` asserts billing ↔ price_monthly; this asserts trial ↔ price.
  ok(!(row.start_trial && m.price_monthly === null),
     `B4 ${m.module_key}: a trial clock over a NULL price — the countdown ends at a number nobody has decided (D-9)`);
  ok(!(row.start_trial && m.price_monthly === 0),
     `B5 ${m.module_key}: a trial clock over a $0 price — nothing to convert to`);
  // 🔴 B6 REWRITTEN A SECOND TIME (2026-08-02 (2)) — AND ADDING `core_optional` IS WHAT EXPOSED THE
  // BUG IN THE FIRST REWRITE. It read `!(row.enabled && m.billing !== 'core' && !row.start_trial)`:
  // "live, not core, no clock = free forever with nothing to bill." That was CORRECT while `core`
  // was the only free value. **`core_optional` is also free — by ruling — so `!== 'core'` now
  // catches a module that is legitimately free forever, which is its entire design.** The invariant
  // would have fired on the first core_optional module anyone ever switched on and called it a
  // billing defect.
  //
  // The money question was never "is it core", it was **"is it BILLABLE"** — and the field that says
  // so is `billing === 'add_on'`, the only class that carries a price to convert to. Stated against
  // the right condition, the invariant is unchanged in meaning and now survives a fourth value.
  ok(!(row.enabled && m.billing === 'add_on' && !row.start_trial),
     `B6 ${m.module_key}: a BILLABLE module live with NO clock — free forever with no conversion date and nothing to bill`);
  // B6b — liveness has exactly two sources and no third: the BASELINE (derived from billing, one
  // field) or a RUNNING CLOCK (an override on top of it). If someone later adds a third way for a
  // module to seed live, this is what refuses it. It reads `enabledByDefault` rather than restating
  // `=== 'core'`, so a fifth billing value is enforced here the moment it is added, with no edit.
  ok(row.enabled === (enabledByDefault(m.billing) || row.start_trial),
     `B6b ${m.module_key}: live iff its baseline is on OR a clock is running — there is no third way to be on`);
  // 🔴 B7 — the cross-field rule the RPC enforces server-side, asserted here so a bad payload is
  // never SENT: a module asking for a trial must carry a positive term. The server refuses the
  // WHOLE batch on this, so one bad catalog row would block every tenant's seed.
  ok(!(row.start_trial && !(row.trial_days > 0)),
     `B7 ${m.module_key}: start_trial with no positive term — the server refuses the whole batch, and the term has no default because nobody has ratified one`);
  // B8 — a module with NO trial must not carry a term either. A stray non-zero here would be read
  // by nothing today and by the marketplace tomorrow, as a trial that never started.
  ok(!(!row.start_trial && row.trial_days > 0),
     `B8 ${m.module_key}: a term with no trial — the marketplace would read a trial that never started`);
  ok(row.configured === row.enabled,
     `B9 ${m.module_key}: at SEED, configured and enabled agree (core is both; nothing else is either). They are separate fields because they DIVERGE the moment an owner enables a paid module — this asserts the seed projection, not the model`);
  // 🔴 B10 — THE SURFACE INVARIANT, STATED INDEPENDENTLY OF THE IMPLEMENTATION (ruling 2026-08-02
  // (3)). It reads `TILE_REGISTRY.status` directly rather than calling the mapping's own helper: a
  // test that reuses the code's predicate can only prove the code agrees with itself. This is the
  // requirement in its own words — NO MODULE MAY CARRY A CLOCK UNLESS ITS TILE IS LIVE — and it is
  // the assertion that would have fired on the four planned add-ons the day their clocks were set.
  const tile = TILE_REGISTRY.find((t) => t.module_key === m.module_key);
  ok(!(row.start_trial && tile?.status !== 'live'),
     `B10 ${m.module_key}: a trial clock over a tile that is NOT live (status '${tile?.status}') — the owner cannot use it, cannot evaluate it, and at day thirty is asked to pay for something he has never seen`);
});

// ── 3. THE PAYLOAD SHAPE THE RPC VALIDATES ──────────────────────────────────────────────────────
// `seed_business_modules` refuses the WHOLE batch on a malformed element (a partial seed looks
// complete to every count-based check). These assert the client never sends one.

for (const row of catalogSeedRows()) {
  ok(typeof row.module_key === 'string' && row.module_key.trim().length > 0,
     `C1 ${row.module_key}: non-blank module_key — the RPC refuses the batch otherwise`);
  ok(typeof row.enabled === 'boolean' && typeof row.configured === 'boolean'
     && typeof row.start_trial === 'boolean',
     `C2 ${row.module_key}: all three flags are real booleans — the RPC's jsonb_typeof check refuses anything else`);
  ok(typeof row.trial_days === 'number' && Number.isInteger(row.trial_days) && row.trial_days >= 0,
     `C4 ${row.module_key}: trial_days is a non-negative integer — the RPC destructures it as \`integer\` and a fractional day is not a term`);
  ok(Object.keys(row).length === 5,
     `C3 ${row.module_key}: exactly the five keys the RPC destructures — an extra key is silently dropped by jsonb_to_recordset, which is worse than rejected`);
}

// ── report ───────────────────────────────────────────────────────────────────────────────────────
console.log(`moduleSeed: ${passed} passed, ${failed} failed`);
if (failed) { for (const f of failures) console.error('  ✗ ' + f); process.exit(1); }
