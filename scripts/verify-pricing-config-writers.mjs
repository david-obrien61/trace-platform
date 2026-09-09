#!/usr/bin/env node
/**
 * ── verify-pricing-config-writers — A SAVE MAY NOT SHRINK THE PRICING CONFIG ─────────────────
 *
 * PURPOSE:      `business_pricing_config.config` is ONE jsonb column with several owners. The
 *               Cost-to-Produce panel owns the cost recipe; `/discounts` owns `discountTypes` and
 *               `aiBiEnabled`; `set_business_tax_rate` owns `taxRate`; production planning owns
 *               `production`. Every one of them writes the WHOLE column. So a writer that names
 *               the keys it will PRESERVE deletes every key nobody thought to name — which is
 *               exactly how `taxRate` came to be one edit away from deletion, on a tenant whose
 *               invoices carry it.
 *
 *               This cap asserts the INVERSION: a writer names the keys it OWNS and carries the
 *               rest through untouched. Owning a key is a claim about this screen; preserving a
 *               key is a claim about every OTHER screen, and no author can make that one
 *               correctly — least of all a future one.
 *
 * 🔴 IT IS A CLASS CAP, NOT A FILE CAP. It DERIVES the writer list from the corpus (#73's lesson:
 *               a hardcoded gap list asserts nothing and rots into noise). A fourth writer added
 *               next year is caught because it is a writer, not because someone remembered to
 *               add it here.
 *
 * DEPENDENCIES: the repo source tree only. No network, no database, no build.
 * OUTPUTS:      exit 0 = every writer inverts. exit 1 = a writer enumerates what it will keep.
 *
 * Run:  node scripts/verify-pricing-config-writers.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const SCAN = ['packages/shared/src', 'packages/cultivar-os/src', 'packages/cultivar-os/api', 'api'];

/** The one function that replaces the whole column, and the safe wrappers built on top of it. */
const WHOLE_COLUMN_WRITER = 'writePricingConfig';
const SAFE_WRAPPERS = ['mergePricingConfig', 'mergeOwnedOverConfig'];
/** Where the writer itself lives — it is the definition, not a caller. */
const WRITER_HOME = 'packages/shared/src/business-logic/financialDataAccess.ts';
/** The declarative owned-key set the cost panel must derive its payload from. */
const OWNED_KEYS_MODULE = 'packages/shared/src/business-logic/pricingConfigMerge.ts';

let failed = 0;
const fail = (msg, detail = '') => { failed++; console.log(`  ❌ ${msg}${detail ? '\n       ' + detail : ''}`); };
const pass = (msg, detail = '') => console.log(`  ✅ ${msg}${detail ? ' — ' + detail : ''}`);

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== 'node_modules') walk(p, out); }
    else if (/\.(ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const files = SCAN.flatMap((d) => walk(join(ROOT, d))).map((f) => relative(ROOT, f));

// ── 1. DERIVE the writer set from the corpus ────────────────────────────────────────────────
const callers = files.filter((f) => {
  if (f === WRITER_HOME) return false;
  const src = readFileSync(join(ROOT, f), 'utf8');
  // a CALL, not an import line or a prose mention
  return new RegExp(`${WHOLE_COLUMN_WRITER}\\s*\\(`).test(src);
});

console.log(`\nbusiness_pricing_config whole-column writers (derived from the corpus): ${callers.length}`);
if (callers.length === 0) {
  fail('no caller of writePricingConfig found — the cap is scanning the wrong tree and asserts nothing',
       'A cap that cannot reach its target reports the same as one that passed (tech-debt #182).');
}

// ── 2. THE INVERSION — no writer may enumerate the keys it will PRESERVE ────────────────────
// The shipped defect's exact shape: a literal array of other screens' keys, copied off the
// current row into the payload. Matched on the SHAPE (a loop or a pick over a key literal that
// is then spread into the write) rather than on any one variable name.
const PRESERVE_LIST = /for\s*\(\s*const\s+\w+\s+of\s*\[[^\]]*['"](discountTypes|pricingTiers|aiBiEnabled|taxRate|production)['"]/;
const PRESERVE_PICK = /\b(preserved|preserve|keep|carried)\b\s*(:\s*Record<[^>]*>)?\s*=\s*\{/;

// The three checks, as named predicates — so `--self-test` can prove each one CAN refuse.
// A check nobody has watched fail is a claim, not a check (§6 r19).
export const enumeratesPreserveList = (src) => PRESERVE_LIST.test(src);
export const buildsPreserveObject   = (src) => PRESERVE_PICK.test(src) && !SAFE_WRAPPERS.some((w) => src.includes(w));
export const usesCarryingWrapper    = (src) => SAFE_WRAPPERS.some((w) => new RegExp(`${w}\\s*\\(`).test(src));
export const derivesOwnedKeys       = (src) => /Object\.keys\(\s*EMPTY_COST_CONFIG\s*\)/.test(src);

// ── SELF-TEST — every check is shown refusing a crafted violation, and accepting a clean one.
if (process.argv.includes('--self-test')) {
  const BAD_WRITER = `const preserved: Record<string, unknown> = {};\n`
    + `for (const k of ['discountTypes', 'pricingTiers', 'aiBiEnabled'] as const) { preserved[k] = lc[k]; }\n`
    + `const configToWrite = { ...baseConfig, ...preserved };\n`
    + `await writePricingConfig(supabase, businessId, configToWrite);`;
  const GOOD_WRITER = `const configToWrite = mergeOwnedOverConfig(latestCfg?.config, baseConfig);\n`
    + `await writePricingConfig(supabase, businessId, configToWrite);`;
  const BAD_OWNED  = `export const COST_PANEL_OWNED_KEYS = Object.freeze(['version', 'unitLabel']);`;
  const GOOD_OWNED = `export const COST_PANEL_OWNED_KEYS = Object.freeze(Object.keys(EMPTY_COST_CONFIG));`;
  const cases = [
    [enumeratesPreserveList(BAD_WRITER),  true,  'enumeratesPreserveList REFUSES a preserve list'],
    [enumeratesPreserveList(GOOD_WRITER), false, 'enumeratesPreserveList ACCEPTS an inverted writer'],
    [buildsPreserveObject(BAD_WRITER),    true,  'buildsPreserveObject REFUSES a hand-built preserve object'],
    [buildsPreserveObject(GOOD_WRITER),   false, 'buildsPreserveObject ACCEPTS a wrapper-built payload'],
    [usesCarryingWrapper(BAD_WRITER),     false, 'usesCarryingWrapper REFUSES a hand-built payload'],
    [usesCarryingWrapper(GOOD_WRITER),    true,  'usesCarryingWrapper ACCEPTS a wrapper-built payload'],
    [derivesOwnedKeys(BAD_OWNED),         false, 'derivesOwnedKeys REFUSES a typed-out key list'],
    [derivesOwnedKeys(GOOD_OWNED),        true,  'derivesOwnedKeys ACCEPTS a derived key list'],
  ];
  let bad = 0;
  for (const [actual, expected, label] of cases) {
    if (actual === expected) console.log(`  ✅ ${label}`);
    else { bad++; console.log(`  ❌ ${label} — the check cannot tell the two apart, so it asserts nothing`); }
  }
  console.log(bad === 0 ? '\n=== guard self-test: every check can refuse ===\n'
                        : `\n=== guard self-test: ${bad} check(s) assert nothing ===\n`);
  process.exit(bad === 0 ? 0 : 1);
}

for (const f of callers) {
  const src = readFileSync(join(ROOT, f), 'utf8');
  if (enumeratesPreserveList(src)) {
    fail(`${f} enumerates the keys it will PRESERVE`,
         'Invert it: name the keys this screen OWNS and carry every other top-level key through. '
       + 'A preserve list silently deletes every key nobody added to it.');
  } else if (buildsPreserveObject(src)) {
    fail(`${f} builds a preserve object without going through a safe wrapper`,
         `Expected one of: ${SAFE_WRAPPERS.join(', ')}.`);
  } else {
    pass(`${f} does not enumerate what it preserves`);
  }

  // ── 3. …and the payload must come from a wrapper that carries the unowned keys ───────────
  if (!usesCarryingWrapper(src)) {
    fail(`${f} calls ${WHOLE_COLUMN_WRITER} with a hand-built payload`,
         `A whole-column write must be produced by one of: ${SAFE_WRAPPERS.join(', ')}, `
       + 'so the keys this screen does not own are carried rather than dropped.');
  } else {
    pass(`${f} builds its payload through a carrying wrapper`);
  }
}

// ── 4. THE OWNED SET IS DERIVED, NEVER TYPED ───────────────────────────────────────────────
// #179's lesson: a declarative list that does not match what it describes is invisible to every
// tool we own. The owned set must be READ OFF the config shape, so it cannot drift from it.
let ownedSrc = null;
try { ownedSrc = readFileSync(join(ROOT, OWNED_KEYS_MODULE), 'utf8'); } catch { /* reported below */ }
if (ownedSrc === null) {
  fail(`${OWNED_KEYS_MODULE} is missing`, 'The owned-key set has no declarative home.');
} else if (!derivesOwnedKeys(ownedSrc)) {
  fail(`${OWNED_KEYS_MODULE} does not DERIVE the owned keys from EMPTY_COST_CONFIG`,
       'A typed-out key list drifts from the shape it claims to describe the moment the shape gains a field (#179).');
} else {
  pass('the owned-key set is derived from EMPTY_COST_CONFIG, not typed out');
}

console.log(failed === 0
  ? '\n=== pricing-config writers: every writer inverts the enumeration ===\n'
  : `\n=== pricing-config writers: ${failed} FAILED ===\n`);
process.exit(failed === 0 ? 0 : 1);
