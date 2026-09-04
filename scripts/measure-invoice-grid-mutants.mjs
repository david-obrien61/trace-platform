/**
 * ── measure-invoice-grid-mutants — can the grid go back to lying quietly? ─────────────
 *
 * PURPOSE:      Every mutant here restores a version of the invoice grid that LOOKS COMPLETELY
 *               NORMAL and answers a question wrongly. There is no error state to notice, no
 *               empty table, no red — a search simply finds nothing, or a row simply is not red.
 *               Reading the screen cannot find any of them, which is the whole reason this file
 *               exists rather than a manual check.
 * DEPENDENCIES: node_modules/.bin/esbuild. Mutates a temp copy of one file; restores in `finally`.
 * OUTPUTS:      CAUGHT/SURVIVED per mutant + summary. Exit 1 if any survived or never applied.
 *
 * 🔴 THE PROBES IN `invoiceGrid.test.ts` WERE WRITTEN ALONGSIDE THE MODULE, NOT BEFORE IT, SO
 * THEIR FIRST GREEN RUN PROVED NOTHING. This is where they are proven able to refuse. G1 is the
 * one that matters: it restores `INVOICE_ROWS_SHOWN = 100`, the cap that shipped, under which a
 * search of LAWNS's 1,480 invoices reports nothing found for an invoice that exists.
 *
 * ⚠️ AND THIS SURFACE HAS NO OTHER GUARD. `verify-ui-standard-divergence.mjs` scans
 * `packages/cultivar-os/src`; the grid model and its consumer both live in `packages/shared`, so
 * `npm run verify` is blind to this conversion in both directions. These mutants and the
 * owner-test cards are it.
 *
 * 🔴 GREEN CONTROL FIRST, EXIT CODE ONLY, AND A MUTANT THAT NEVER APPLIED IS AN ERROR.
 *
 * Run: node scripts/measure-invoice-grid-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT   = new URL('..', import.meta.url).pathname;
const TARGET = ROOT + 'packages/shared/src/quickbooks/invoiceGrid.ts';
const SUITE  = 'packages/shared/src/quickbooks/invoiceGrid.test.ts';
const ESB    = ROOT + 'node_modules/.bin/esbuild';

function suiteIsGreen() {
  try {
    execSync(`${ESB} ${SUITE} --bundle --platform=node --format=cjs 2>/dev/null | node`,
      { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch { return false; }
}

const MUTANTS = [
  // ── the cap, and the sentence that has to accompany it ──────────────────────────────
  { id: 'G1', why: '🔴 THE SHIPPED CAP RESTORED — 100 rows of 1,480, so a search for a real 2020 invoice reports NOTHING FOUND and the page looks completely normal',
    from: 'export const INVOICE_RENDER_CEILING = 5000;',
    to:   'export const INVOICE_RENDER_CEILING = 100;' },
  { id: 'G2', why: '🔴 a capped search claims to be searching ALL of them — the confident absence R-75 exists to forbid',
    from: "    ? `Searching the ${n(ordered.length)} most recent of ${n(total)} invoices — older ones are not on this page and will not be found here.`",
    to:   "    ? `Searching all ${n(total)} invoices.`" },
  { id: 'G3', why: 'the capped scope gives the arithmetic but drops the consequence — a reader must infer that older invoices will not be found',
    from: '— older ones are not on this page and will not be found here.`',
    to:   '.`' },
  { id: 'G4', why: '🔴 the caption reports the SLICE as the total — the pill says "100 of 100" and now nothing on the page disagrees with it',
    from: "    ? `Showing the ${n(ordered.length)} most recent of ${n(total)} invoices, newest first.`",
    to:   "    ? `Showing all ${n(ordered.length)} invoices, newest first.`" },
  { id: 'G5', why: 'the total collapses to the rendered page — every denominator on the screen shrinks to what fits',
    from: '  const total = invoices.length;',
    to:   '  const total = Math.min(invoices.length, ceiling);' },

  // ── flags: computed over the page instead of over the books ─────────────────────────
  { id: 'G6', why: '🔴 duplicates are detected over the VISIBLE PAGE — so whether a row is red depends on where the ceiling happened to fall',
    from: '  const byNumber = new Map<string, number>();\n  for (const inv of invoices) {',
    to:   '  const byNumber = new Map<string, number>();\n  for (const inv of invoiceRowsForDisplay(invoices, Math.max(0, ceiling))) {' },
  { id: 'G7', why: 'only one half of a duplicate pair is flagged — the other reads as correct',
    from: '    if ((byNumber.get(inv.docNumber) ?? 0) > 1) return \'duplicate-number\';',
    to:   '    if ((byNumber.get(inv.docNumber) ?? 0) > 2) return \'duplicate-number\';' },
  { id: 'G8', why: '🔴 the banner counts only what is on screen — it would tell her about 2 duplicates while 40 sit above the cap',
    from: '  const flaggedCount = invoices.reduce((n, inv) => n + (flagFor(inv) === null ? 0 : 1), 0);',
    to:   '  const flaggedCount = invoiceRowsForDisplay(invoices, Math.max(0, ceiling)).reduce((n, inv) => n + (flagFor(inv) === null ? 0 : 1), 0);' },
  { id: 'G9', why: '🔴 an UNREADABLE row is reported as a duplicate — asserting a fact about bytes we could not read',
    from: "    if (inv.docNumber === null || inv.totalAmt === null) return 'unreadable';",
    to:   "    if (false) return 'unreadable';" },

  // ── red spent where she cannot act ──────────────────────────────────────────────────
  { id: 'G10', why: '🔴 a REPEAT CUSTOMER goes red — a red row beside their best relationships, and red she stops reading',
    from: '    if (inv.customerId && d) {\n      const k = `${inv.customerId} ${d}`;',
    to:   '    if (inv.customerId) {\n      const k = `${inv.customerId}`;' },
  { id: 'G11', why: 'a missing date goes red instead of rendering as "No date recorded" — a D-9 disclosure turned into an accusation',
    from: "    if (inv.docNumber === null || inv.totalAmt === null) return 'unreadable';",
    to:   "    if (inv.docNumber === null || inv.totalAmt === null || inv.txnDate === null) return 'unreadable';" },

  // ── the ordering rule, forked out of its one home ───────────────────────────────────
  { id: 'G12', why: 'the grid sorts OLDEST first — a records list read against the paper it is a list of (G9)',
    from: '  const ordered = invoiceRowsForDisplay(invoices, Math.max(0, ceiling));',
    to:   '  const ordered = [...invoices].sort((a, b) => (a.txnDate ?? \'\').localeCompare(b.txnDate ?? \'\')).slice(0, Math.max(0, ceiling));' },

  // ── R-77: what a search may reach ───────────────────────────────────────────────────
  { id: 'G13', why: '🔴 the customer reference becomes searchable — a route to a person through a field that exists only to link rows',
    from: "    ...r.lines.map(l => l.itemName ?? ''),",
    to:   "    ...r.lines.map(l => l.itemName ?? ''), r.customerId ?? ''," },
  { id: 'G14', why: 'the item names leave the search text — recognition runs on her item names, and searching becomes numbers only',
    from: "    ...r.lines.map(l => l.itemName ?? ''),",
    to:   '' },
];

const original = readFileSync(TARGET, 'utf8');
let caught = 0, survived = 0, errored = 0;
try {
  process.stdout.write('  CONTROL (unmutated) … ');
  if (!suiteIsGreen()) { console.log('RED — aborting; every CAUGHT below would be meaningless.'); process.exit(2); }
  console.log('GREEN ✓\n');

  for (const m of MUTANTS) {
    if (!original.includes(m.from)) {
      console.log(`  ${m.id.padEnd(4)} ERROR    the from-text is not in the source — mutant never applied`);
      errored++; continue;
    }
    writeFileSync(TARGET, original.replace(m.from, m.to));
    const green = suiteIsGreen();
    if (green) { console.log(`  ${m.id.padEnd(4)} SURVIVED 🔴  ${m.why}`); survived++; }
    else       { console.log(`  ${m.id.padEnd(4)} CAUGHT   ✓   ${m.why}`); caught++; }
  }
} finally {
  writeFileSync(TARGET, original);
}

console.log(`\n  ── ${caught}/${caught + survived} caught · ${survived} survived · ${errored} never applied ──\n`);
process.exit(survived > 0 || errored > 0 ? 1 : 0);
