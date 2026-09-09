/**
 * ── measure-pricing-config-clobber-mutants — can the tax rate be deleted again? ───────────────
 *
 * PURPOSE:      The defect was invisible from every screen. The panel saved, said "Saved", and the
 *               config column came back one key shorter. Nothing threw, nothing rendered wrong, and
 *               the loss only surfaces later, at a checkout, as a redline where a rate used to be.
 *               Every mutant below produces a panel that saves perfectly and quietly shrinks the
 *               column — or a guard that no longer notices.
 *
 * 🔴 M1 IS THE ONE THAT MATTERS: it restores the shipped preserve list exactly. If M1 survives,
 *               this build has been undone and no screen in the building would show it.
 *
 * 🔴 THE PROBES WERE WRITTEN ALONGSIDE THE CODE, SO THEIR FIRST GREEN RUN PROVED NOTHING (§6 r19).
 *               §L mutates the pure merge; §P mutates the PANEL WIRING, where the real bug lived
 *               and where a perfect pure function is no defence; §G mutates the GUARD, because a
 *               cap that cannot fail is not a cap (tech-debt #182 — a harness that cannot reach
 *               its target reports the same as one that passed).
 *
 * DEPENDENCIES: node_modules/.bin/esbuild. Mutates a temp copy of one file; restores in `finally`.
 * OUTPUTS:      CAUGHT/SURVIVED per mutant + summary. Exit 1 if any survived or never applied.
 *
 * Run: node scripts/measure-pricing-config-clobber-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const ESB  = ROOT + 'node_modules/.bin/esbuild';

const LIB   = 'packages/shared/src/business-logic/pricingConfigMerge.ts';
const PANEL = 'packages/shared/src/components/CostToProduceSettings.tsx';
const GUARD = 'scripts/verify-pricing-config-writers.mjs';
const SUITE = 'packages/shared/src/business-logic/pricingConfigMerge.test.ts';

/** The unit suite is green. */
function suiteIsGreen() {
  try {
    execSync(`set -o pipefail; "${ESB}" "${SUITE}" --bundle --platform=node --format=cjs --log-level=error --external:node:fs | node`,
      { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch { return false; }
}
/** The static guard passes. */
function guardIsGreen() {
  try {
    execSync(`node ${GUARD}`, { cwd: ROOT, stdio: 'pipe' });
    // …and the guard must still be able to REFUSE. A cap whose checks have been hollowed out
    // passes its own corpus perfectly, which is the whole failure mode (§6 r19).
    execSync(`node ${GUARD} --self-test`, { cwd: ROOT, stdio: 'pipe' });
    return true;
  } catch { return false; }
}
/** A mutant is CAUGHT when EITHER assertion mechanism refuses it. */
const allGreen = () => suiteIsGreen() && guardIsGreen();

const MUTANTS = [
  // ══ §P — THE WIRING. Where the defect actually lived. ══════════════════════════════════════
  { id: 'M1', target: PANEL,
    why: '🔴 THE SHIPPED DEFECT, RESTORED — the panel goes back to naming three keys it will preserve, and taxRate is not one of them',
    from: "      const configToWrite = mergeOwnedOverConfig(latestCfg?.config, baseConfig as unknown as Record<string, unknown>);",
    to:   "      const lc = (latestCfg?.config && typeof latestCfg.config === 'object' ? latestCfg.config : {}) as Record<string, unknown>;\n"
        + "      const preserved: Record<string, unknown> = {};\n"
        + "      for (const k of ['discountTypes', 'pricingTiers', 'aiBiEnabled'] as const) { if (lc[k] !== undefined) preserved[k] = lc[k]; }\n"
        + "      const configToWrite = { ...baseConfig, ...preserved };" },
  { id: 'M2', target: PANEL,
    why: 'the merge is dropped entirely — the panel writes its own object as the whole column, deleting every neighbour key at once',
    from: "      const configToWrite = mergeOwnedOverConfig(latestCfg?.config, baseConfig as unknown as Record<string, unknown>);",
    to:   "      const configToWrite = baseConfig as unknown as Record<string, unknown>;" },
  { id: 'M3', target: PANEL,
    why: '🔴 the merge reads the config the panel LOADED instead of the fresh re-read — a screen left open overwrites whatever /discounts saved meanwhile',
    from: "mergeOwnedOverConfig(latestCfg?.config, baseConfig as unknown as Record<string, unknown>)",
    to:   "mergeOwnedOverConfig(config as unknown as Record<string, unknown>, baseConfig as unknown as Record<string, unknown>)" },
  { id: 'M4', target: PANEL,
    why: 'the write no longer reports what it carried or dropped — the loss becomes invisible again (STD-003)',
    from: "      const carry = describeCarry(latestCfg?.config, configToWrite);",
    to:   "      const carry = { carried: [], dropped: [], ownedMissing: [] };" },

  // ══ §L — THE PURE MERGE ═══════════════════════════════════════════════════════════════════
  { id: 'M5', target: LIB,
    why: '🔴 the carry is severed — only the owned keys are written, so every neighbour key dies on every Save',
    from: "  const base: Record<string, unknown> =\n    current && typeof current === 'object' && !Array.isArray(current)\n      ? { ...(current as Record<string, unknown>) }\n      : {};",
    to:   "  const base: Record<string, unknown> = {};" },
  { id: 'M6', target: LIB,
    why: '🔴 owned keys are DEEP-merged into the stored ones — a deleted location comes back from the dead and the owner cannot remove anything',
    from: "    if (edited[k] !== undefined) base[k] = edited[k];",
    to:   "    if (edited[k] !== undefined) base[k] = (base[k] && typeof base[k] === 'object' && edited[k] && typeof edited[k] === 'object' && !Array.isArray(edited[k]))\n      ? { ...(base[k] as object), ...(edited[k] as object) }\n      : (Array.isArray(base[k]) && Array.isArray(edited[k]) ? [...(base[k] as unknown[]), ...(edited[k] as unknown[])] : edited[k]);" },
  { id: 'M7', target: LIB,
    why: '🔴 the owned set is TYPED OUT and drifts from the shape — `locations` is missing, so the panel silently stops persisting its own locations',
    from: "export const COST_PANEL_OWNED_KEYS: readonly string[] =\n  Object.freeze(Object.keys(EMPTY_COST_CONFIG));",
    to:   "export const COST_PANEL_OWNED_KEYS: readonly string[] =\n  Object.freeze(['version', 'unitLabel', 'denominators', 'margin', 'priceReference']);" },
  { id: 'M8', target: LIB,
    why: '🔴 taxRate is claimed as an OWNED key — the panel then writes its own stale copy over the tax field\'s, which is the original defect wearing a different hat',
    from: "  Object.freeze(Object.keys(EMPTY_COST_CONFIG));",
    to:   "  Object.freeze([...Object.keys(EMPTY_COST_CONFIG), 'taxRate']);" },
  { id: 'M9', target: LIB,
    why: 'unowned keys are taken from the SCREEN rather than the fresh read — a stale panel overwrites a neighbour\'s newer value',
    from: "  for (const k of ownedKeys) {",
    to:   "  for (const k of Object.keys(edited)) {" },
  { id: 'M10', target: LIB,
    why: 'a garbage `current` (a string, an array) is trusted, so the write is built on nonsense instead of starting clean',
    from: "    current && typeof current === 'object' && !Array.isArray(current)\n      ? { ...(current as Record<string, unknown>) }\n      : {};",
    to:   "    current ? ({ ...(current as Record<string, unknown>) }) : {};" },
  { id: 'M11', target: LIB,
    why: 'an owned key the screen is not carrying is written as `undefined`, which jsonb serialisation turns into a deletion',
    from: "    if (edited[k] !== undefined) base[k] = edited[k];",
    to:   "    base[k] = edited[k];" },
  { id: 'M12', target: LIB,
    why: '🔴 describeCarry becomes a rubber stamp — it reports nothing dropped no matter what was dropped, so the instrumentation blesses the loss',
    from: "    dropped: before.filter((k) => !after.has(k)),",
    to:   "    dropped: [],", },

  // ══ §G — THE GUARD ITSELF. A cap that cannot fail is not a cap. ═══════════════════════════
  { id: 'M13', target: GUARD,
    why: '🔴 the guard derives ZERO writers (wrong scan roots) and reports success — the #182 shape: it cannot reach its target and looks identical to a pass',
    from: "const SCAN = ['packages/shared/src', 'packages/cultivar-os/src', 'packages/cultivar-os/api', 'api'];",
    to:   "const SCAN = ['packages/nonexistent'];" },
  { id: 'M14', target: GUARD,
    why: 'the guard stops asserting that the owned set is derived, so a typed-out list could be reintroduced unseen',
    from: "export const derivesOwnedKeys       = (src) => /Object\\.keys\\(\\s*EMPTY_COST_CONFIG\\s*\\)/.test(src);",
    to:   "export const derivesOwnedKeys       = (src) => true;" },
];

console.log('\n── GREEN CONTROL ────────────────────────────────────────────────');
if (!suiteIsGreen()) { console.error('❌ unit suite is RED before any mutation — fix that first.'); process.exit(1); }
if (!guardIsGreen()) { console.error('❌ guard is RED before any mutation — fix that first.'); process.exit(1); }
console.log('✅ suite green, guard green\n');

let caught = 0, survived = 0, neverApplied = 0;
for (const m of MUTANTS) {
  const path = ROOT + m.target;
  const original = readFileSync(path, 'utf8');
  if (!original.includes(m.from)) {
    neverApplied++;
    console.log(`⚠️  ${m.id} NEVER APPLIED — anchor not found in ${m.target}`);
    console.log(`    ${m.why}`);
    continue;
  }
  try {
    writeFileSync(path, original.replace(m.from, m.to));
    if (allGreen()) { survived++; console.log(`❌ ${m.id} SURVIVED — ${m.why}`); }
    else { caught++; console.log(`✅ ${m.id} caught — ${m.why}`); }
  } finally {
    writeFileSync(path, original);
  }
}

console.log(`\n=== ${MUTANTS.length} mutants · ${caught} caught · ${survived} survived · ${neverApplied} never applied ===\n`);
process.exit(survived === 0 && neverApplied === 0 ? 0 : 1);
