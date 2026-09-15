/**
 * ── mutants-opening-stock — can the starting-number probes actually disagree? ────────────────
 *
 * PURPOSE:      [[R-33]] / CLAUDE.md §6 r19: a check that cannot disagree is not a check. This
 *               breaks ONE guarantee at a time and requires the owning suite to go RED. A mutant
 *               that SURVIVES is a guarantee nobody is actually holding.
 * DEPENDENCIES: node_modules/.bin/esbuild; the four modules and the three suites below.
 * OUTPUTS:      CAUGHT / SURVIVED / NO-BUILD per mutant + a summary. Exit 1 on any survivor, on a
 *               red CONTROL, or on a mutant that could not be applied.
 *
 * 🔴 THREE VERDICTS, NOT TWO, AND THE THIRD IS TECH-DEBT #293's OWN PRESCRIPTION. With
 * `pipefail` on, a mutant that does not COMPILE scores CAUGHT — which reports something the
 * harness never measured: no test executed it. A compile failure is honestly *not survived*, but
 * it is not a test catching anything either, so it gets its own name. #293 records that this is
 * unreachable today (483 builds, 0 failures) and arrives as a satisfying green the first time a
 * mutant touches a type or a brace. Several below DO touch types, so it is reachable here.
 *
 * Every mutation is applied to a COPY held in memory and written back byte-for-byte on exit,
 * including on a crash (try/finally).
 *
 * Run: node scripts/mutants-opening-stock.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const STOCK   = 'packages/shared/src/quickbooks/openingStock.ts';
const STORE   = 'packages/shared/src/quickbooks/booksRunStore.ts';
const RECON   = 'packages/cultivar-os/src/lib/reconcileMath.ts';
const STATES  = 'packages/cultivar-os/src/lib/inventoryStates.ts';

const SUITE_STOCK  = 'packages/shared/src/quickbooks/openingStock.test.ts';
const SUITE_STORE  = 'packages/shared/src/quickbooks/booksRunStore.test.ts';
const SUITE_RECON  = 'packages/cultivar-os/src/lib/reconcileMath.test.ts';
const SUITE_STATES = 'packages/cultivar-os/src/lib/sellable.test.ts';

const FILES = [STOCK, STORE, RECON, STATES];
const ORIGINAL = Object.fromEntries(FILES.map(f => [f, readFileSync(f, 'utf8')]));

/**
 * Build, then run. Returns 'green' | 'red' | 'no-build'.
 *
 * 🔴 THE TWO STEPS ARE SEPARATE ON PURPOSE. Run as one pipeline they are indistinguishable even
 * with `pipefail`: a non-zero exit says the chain failed, not which link. Building to a file first
 * makes "it would not compile" its own answer (#293).
 */
function runSuite(suite) {
  const out = `/tmp/claude-501/mutant-bundle.cjs`;
  try {
    execSync(`node_modules/.bin/esbuild ${suite} --bundle --platform=node --format=cjs --outfile=${out} --log-level=error`,
      { stdio: 'pipe', shell: '/bin/bash' });
  } catch {
    return 'no-build';
  }
  try {
    execSync(`set -o pipefail; node ${out}`, { stdio: 'pipe', shell: '/bin/bash' });
    return 'green';
  } catch {
    return 'red';
  }
}

// [file, suite, find, replace, what it MEANS if it survives]
const MUTANTS = [
  // ── the measurement ───────────────────────────────────────────────────────
  [STOCK, SUITE_STOCK,
   "    const months = monthsBetween(itemFirst, lastMonth).length;",
   "    const months = monthsBetween(firstMonth, lastMonth).length;",
   'the rate is divided by the BUSINESS window instead of the item’s own — every new product drags the median down and the seed is set too low for the wrong reason'],

  [STOCK, SUITE_STOCK,
   "  if (byItem.size === 0) return null;",
   "  if (false) return null;",
   'a catalogue with no measurable sales returns a MEASUREMENT instead of null — a suggestion invented from nothing, wearing a measurement’s clothes'],

  // ✏️ THE FIRST FORM OF THIS MUTANT WAS **EQUIVALENT**, AND THE PROOF IS WORTH KEEPING.
  // Defeating `if (firstMonth === null || lastMonth === null) return null` changes nothing
  // observable: an undated invoice `continue`s BEFORE its lines are read, so "no dated invoice"
  // implies "no item in `byItem`", and the very next guard returns null anyway. It survived
  // because it is semantically identical, not because a guarantee was missing — the date guard is
  // defensive and load-bearing for TYPE NARROWING, not for behaviour. It is kept, and the mutant
  // was re-aimed at the clause that IS observable: whether undated invoices are skipped at all.
  [STOCK, SUITE_STOCK,
   "    if (month === null) continue;",
   "    if (month === null) { /* read it anyway */ }",
   'an UNDATED invoice contributes to a monthly RATE — a document with no timing silently moves a number that is entirely about timing'],

  [STOCK, SUITE_STOCK,
   "      if (line.itemId === null) { unattributableLines++; continue; }",
   "      if (line.itemId === null) { continue; }",
   'lines naming no product are dropped in SILENCE — a rate computed over an unstated exclusion is a rate nobody can check'],

  // ✏️ THE FIRST FORM MUTATED ONLY THE `get` AND SURVIVED — the `set` still keyed on the id, so
  // the map kept two entries and §A6 saw the right count. A mutant that changes half a keying is
  // not a keying change; it is a lookup miss. Anchored on the whole block so both move together.
  [STOCK, SUITE_STOCK,
   "      const cur = byItem.get(line.itemId);\n      if (cur === undefined) byItem.set(line.itemId, { units, firstMonth: month });",
   "      const cur = byItem.get(String(line.itemName));\n      if (cur === undefined) byItem.set(String(line.itemName), { units, firstMonth: month });",
   'products are keyed on their NAME — [[R-40]]: two products sharing a description are merged and nothing about the result looks wrong'],

  [STOCK, SUITE_STOCK,
   "        if (month < cur.firstMonth) cur.firstMonth = month;",
   "        if (month > cur.firstMonth) cur.firstMonth = month;",
   'an item’s window starts at its LAST sale — the denominator collapses toward 1 and every rate is overstated'],

  // ── the cap: the mechanism, not a safety rail ────────────────────────────
  [STOCK, SUITE_STOCK,
   "  if (qty > SEED_CAP) {",
   "  if (false) {",
   'the ceiling is gone — somebody types 500 to stop the blocking, nothing ever runs out, nobody ever counts, and the placeholder becomes the permanent answer'],

  [STOCK, SUITE_STOCK,
   "export const SEED_CAP = 50;",
   "export const SEED_CAP = 5000;",
   'the ceiling is raised past any real catalogue, which is the same defect wearing a number'],

  [STOCK, SUITE_STOCK,
   "  if (qty < SEED_MIN) {",
   "  if (false) {",
   'zero is accepted as a starting number — the state they are already in, written down as though it were a decision'],

  [STOCK, SUITE_STOCK,
   "  if (!Number.isFinite(qty) || !Number.isInteger(qty)) {",
   "  if (!Number.isFinite(qty)) {",
   'a fractional starting number reaches the RPC, which takes an int — half a tree'],

  // ── the planner: never overwrite a real number ───────────────────────────
  [STOCK, SUITE_STOCK,
   "    if (Number(c.qty ?? 0) > 0) { withStock++; continue; }",
   "    if (false) { withStock++; continue; }",
   'a lot that already HOLDS stock is overwritten with a placeholder — the one thing this must never do'],

  [STOCK, SUITE_STOCK,
   "    if (c.hasHistory) { withHistory++; continue; }",
   "    if (false) { withHistory++; continue; }",
   'a lot that SOLD OUT is re-seeded — its zero was measured, and a placeholder erases the only true quantity on the row'],

  [STOCK, SUITE_STOCK,
   "  const refusal = seedRefusal(qty);\n  if (refusal !== null) return { ok: false, error: refusal };",
   "  const refusal: string | null = null;\n  if (refusal !== null) return { ok: false, error: refusal };",
   'the PLAN does not re-check the cap — a cap enforced only in an input box is a cap enforced nowhere'],

  // ── the reconcile: a placeholder is not a count ──────────────────────────
  [RECON, SUITE_RECON,
   "const POSITION_KINDS = new Set<string>(['opening_balance', SEED_KIND]);",
   "const POSITION_KINDS = new Set<string>(['opening_balance']);",
   'the seed is replayed as a MOVEMENT — the placeholder is added on top of itself, which is tech-debt #70’s live doubling defect reproduced exactly'],

  // ✏️ ALSO EQUIVALENT IN ITS FIRST FORM, AND ALSO WORTH RECORDING. Defeating `prior ? null :`
  // changes nothing, because EVERY later reader checks `prior` first — the clause is belt-and-
  // braces that documents intent rather than the thing enforcing it. The enforcement is the ORDER
  // of the ternary below, so that is what this mutant now breaks.
  // 🔴 A COMPOUND MUTANT, AND THE REASON IT HAD TO BECOME ONE IS ITSELF THE FINDING.
  // "A real count beats a placeholder" is held by TWO clauses that protect each other: `seed` is
  // nulled when a prior exists, AND the mode ternary tests `prior` first. Break either alone and
  // nothing observable changes — each survived as an EQUIVALENT mutant — because the other still
  // holds. So the guarantee is the PAIR, and the honest mutant breaks the pair. ⚠️ This is worth
  // noticing rather than working around: redundant defences make a real guarantee untestable one
  // clause at a time, and a reader measuring per-clause coverage would score this as uncovered.
  [RECON, SUITE_RECON,
   "  const seed = prior ? null : (input.seed ?? null);\n  const mode: ReconcileMode = prior ? 'delta' : (seed ? 'seeded' : 'baseline');",
   "  const seed = input.seed ?? null;\n  const mode: ReconcileMode = seed ? 'seeded' : (prior ? 'delta' : 'baseline');",
   'a placeholder outranks a real count — once somebody has physically looked, replaying from a guess is strictly worse'],

  [RECON, SUITE_RECON,
   "  const mode: ReconcileMode = prior ? 'delta' : (seed ? 'seeded' : 'baseline');",
   "  const mode: ReconcileMode = prior ? 'delta' : 'baseline';",
   'a seeded lot falls back to BASELINE — it loses the evidence strip, and the screen stops saying the number was a placeholder'],

  [RECON, SUITE_RECON,
   "    expectedIsFromAPlaceholder: mode === 'seeded',",
   "    expectedIsFromAPlaceholder: false,",
   'the screen is never told the base was a placeholder — a residual against a guess renders identically to one against a measured book'],

  [RECON, SUITE_RECON,
   "    attributionRequired: mode === 'delta' && residual !== null && residual !== 0,",
   "    attributionRequired: mode !== 'baseline' && residual !== null && residual !== 0,",
   'a seeded lot DEMANDS attribution — a permanent, immutable loss row written for stock that was never established to exist'],

  [RECON, SUITE_RECON,
   "  const evidence = mode === 'baseline' ? [] : summarizeMovements(moves);",
   "  const evidence = mode === 'delta' ? summarizeMovements(moves) : [];",
   'the seeded row shows no evidence — the netting off of sales and deliveries, which is the whole legibility of the remainder, disappears'],

  [RECON, SUITE_RECON,
   "export const SEED_KIND = 'opening_stock_seed';",
   "export const SEED_KIND = 'opening_stock';",
   'the reconcile and the writer name DIFFERENT ledger kinds — the seed is written and never recognised again'],

  // ── the rendering: it wears its provenance ───────────────────────────────
  [STATES, SUITE_STATES,
   "  return seeded ? `${base} — ${SEEDED_NOTE}` : base;",
   "  return base;",
   'a seeded quantity renders exactly like a counted one — the lie this whole build exists to prevent'],

  [STATES, SUITE_STATES,
   "    if (r.kind === 'opening_stock_seed') seeded.add(id);\n    else seeded.delete(id);",
   "    if (r.kind === 'opening_stock_seed') seeded.add(id);",
   'a lot goes on calling itself a placeholder after it has been counted — a presence test where an ORDER test is required'],

  [STATES, SUITE_STATES,
   "  if (error) {\n    console.warn('[TRACE:SEED] ledger unreadable — no lot is marked as a starting number (honest: we do not know)', error.message);\n    return seeded;\n  }",
   "  if (error) {\n    return seeded;\n  }\n  if ((data ?? []).length === 0 && !error) { /* noop */ }",
   'the unreadable-ledger path stops announcing itself — a degraded read that looks identical to a clean one'],

  // ── reading back: null is not zero ───────────────────────────────────────
  [STORE, SUITE_STORE,
   "        value: row.value === null || row.value === undefined ? null : Number(row.value),",
   "        value: Number(row.value),",
   'a rule that could NOT measure comes back saying a typical item moves zero a month — Number(null) is 0, and the screen would suggest a starting number of 1 on a fabricated fact'],

  [STORE, SUITE_STORE,
   "      return {\n        found: false, reason: 'never-run',",
   "      return {\n        found: false, reason: 'unreadable',",
   '"you have not read your books yet" is reported as OUR failure — the owner is told nothing they can act on'],

  [STORE, SUITE_STORE,
   "    if (q.error) return { found: false, reason: 'unreadable', detail: q.error.message };",
   "    if (q.error) return { found: false, reason: 'never-run', detail: q.error.message };",
   'OUR failure is dressed as THEIRS — somebody is told to go and read their QuickBooks data when they already did'],
];

let caught = 0, noBuild = 0;
const survivors = [];

try {
  process.stdout.write('\n── CONTROL (unmutated) … ');
  const controls = [SUITE_STOCK, SUITE_STORE, SUITE_RECON, SUITE_STATES].map(s => [s, runSuite(s)]);
  const bad = controls.filter(([, v]) => v !== 'green');
  console.log(bad.length === 0 ? 'ALL GREEN' : 'NOT GREEN');
  if (bad.length) {
    console.error('\nCONTROL IS NOT GREEN. Every "CAUGHT" below would be meaningless:\n'
      + bad.map(([s, v]) => `  · ${s} → ${v}`).join('\n'));
    process.exit(1);
  }

  console.log(`\n── ${MUTANTS.length} MUTANTS ──\n`);
  for (const [file, suite, find, replace, meaning] of MUTANTS) {
    const src = ORIGINAL[file];
    if (!src.includes(find)) {
      survivors.push(`NOT APPLIED (anchor not found in ${file}): ${meaning}`);
      console.log(`  ??  NOT APPLIED  ${meaning}`);
      continue;
    }
    writeFileSync(file, src.replace(find, replace));
    const verdict = runSuite(suite);
    writeFileSync(file, src);          // restore immediately, before anything else can fail
    if (verdict === 'green') { survivors.push(meaning); console.log(`  !!  SURVIVED    ${meaning}`); }
    else if (verdict === 'no-build') { noBuild++; console.log(`  ~~  NO-BUILD    ${meaning}`); }
    else { caught++; console.log(`  ok  CAUGHT      ${meaning}`); }
  }
} finally {
  for (const [f, s] of Object.entries(ORIGINAL)) writeFileSync(f, s);
}

console.log(`\n── ${caught} caught · ${noBuild} no-build · ${survivors.length} survived, of ${MUTANTS.length} ──`);
if (noBuild > 0) {
  console.log('   NO-BUILD is not a catch: the mutant did not compile, so no test executed it.');
}
if (survivors.length) {
  console.error('\nSURVIVORS — each is a guarantee nobody is holding:\n' + survivors.map(s => '  · ' + s).join('\n'));
  process.exit(1);
}
console.log('   No survivors. Files restored byte-for-byte.\n');
