/**
 * ── measure-qbo-item-import-mutants — can a product vanish, or a size be confidently wrong? ──
 *
 * PURPOSE:      Every mutant here either loses a product, invents a size, silently picks one of
 *               two colliding items, or breaks the undo. The ones that matter most are A6 and
 *               W4: A6 is THE REAL DEFECT THIS BUILD FOUND — the planner's create loop dropped 12
 *               colliding items with no finding and no count, keeping the $350 row over the
 *               $1,250 one. W4 is the trap the create-before-retire ordering sets: retire "every
 *               live row" after the insert and the run retires the catalogue it just made.
 * DEPENDENCIES: node_modules/.bin/esbuild. Mutates a temp copy of one file; restores in `finally`.
 * OUTPUTS:      CAUGHT/SURVIVED per mutant + summary. Exit 1 if any survived or never applied.
 *
 * 🔴 GREEN CONTROL FIRST, AND A MUTANT THAT NEVER APPLIED IS AN ERROR, NOT A PASS. #275 found a
 *    NUL byte in a source file that way; a mutant that cannot reach its target has proven nothing
 *    and reporting it as CAUGHT is the same false green as a probe that cannot fail (tech-debt
 *    #182 / R-33).
 *
 * ⚠️ THE ANCHOR IS VERIFIED IN-WINDOW. #274's first batch restored each file before checking that
 *    the mutation had landed, so two mutants read as SURVIVED when the text had been written into
 *    a header comment instead of the body. Here the applied file is re-read and compared before
 *    the suite runs.
 *
 * Run: node scripts/measure-qbo-item-import-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const ESB  = ROOT + 'node_modules/.bin/esbuild';

const ADAPTER = ROOT + 'packages/shared/src/quickbooks/qboItemAdapter.ts';
const WRITER  = ROOT + 'packages/shared/src/quickbooks/itemImportWriter.ts';
const GRID    = ROOT + 'packages/cultivar-os/src/pages/BusinessInventory.tsx';
const PICKER  = ROOT + 'packages/shared/src/inventory/stockLineResolver.ts';
const FILTER  = ROOT + 'packages/shared/src/inventory/retiredFilter.ts';
const SUITES  = [
  'packages/shared/src/quickbooks/qboItemAdapter.test.ts',
  'packages/shared/src/quickbooks/itemImportWriter.test.ts',
  'packages/shared/src/inventory/retiredFilter.test.ts',
];

function suitesAreGreen() {
  for (const s of SUITES) {
    try {
      execSync(`${ESB} ${s} --bundle --platform=node --format=cjs 2>/dev/null | node`,
        { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
    } catch { return false; }
  }
  return true;
}

const MUTANTS = [
  // ── the adapter ─────────────────────────────────────────────────────────────
  { id: 'A1', file: ADAPTER, why: '🔴 Category FOLDERS become catalogue rows — 38 fake products named Oak, Maple, Chemicals',
    from: "    if ((row.type ?? '').toLowerCase() === 'category') { categories++; continue; }",
    to:   "    if (false) { categories++; continue; }" },
  { id: 'A2', file: ADAPTER, why: '🔴 the category test becomes case-SENSITIVE — a future Intuit casing silently admits folders',
    from: "(row.type ?? '').toLowerCase() === 'category'",
    to:   "(row.type ?? '') === 'Category'" },
  { id: 'A3', file: ADAPTER, why: '🔴 "no description" collapses into "states no size" — we would tell her a product has no size when we never read one',
    from: "  if (flat === '') return { name: null, size: null, state: 'could_not_read', unreadSizeText: null };",
    to:   "  if (flat === '') return { name: null, size: null, state: 'not_stated', unreadSizeText: null };" },
  { id: 'A4', file: ADAPTER, why: '🔴 a size the parser DECLINED reports as "not stated" — a failed read dressed as a fact about the product',
    from: "    return { name: body, size: null, state: 'could_not_read', unreadSizeText: candidate };",
    to:   "    return { name: body, size: null, state: 'not_stated', unreadSizeText: null };" },
  { id: 'A5', file: ADAPTER, why: '🔴 a BARE trailing number becomes a size — "…p 1000 Heritage G" turns into a 1000-gallon container',
    from: '    if (BARE_NUMBER.test(candidate)) continue;',
    to:   '' },
  { id: 'A6', file: ADAPTER, why: '🔴 THE REAL DEFECT: colliding items are silently deduped — 12 products dropped, the $350 row kept over the $1,250 one',
    from: '    if (members.length < 2) continue;',
    to:   '    if (members.length < 99) continue;' },
  { id: 'A7', file: ADAPTER, why: '🔴 a price DISAGREEMENT stops being flagged — the collision reads as untidy rather than as $875 at stake',
    from: '    const pricesDiffer = prices.size > 1;',
    to:   '    const pricesDiffer = false;' },
  { id: 'A8', file: ADAPTER, why: 'the collision sentence drops the prices, so an owner is told there is a collision and not what it costs',
    from: "`QuickBooks lists ${members.length} separate products under this name and size, and they do not agree on price (${members.map(m => (m.unitPrice === null ? 'no price' : `$${m.unitPrice}`)).join(' vs ')}). Both are here so you can see them; neither was chosen for you.`",
    to:   "'QuickBooks lists more than one product under this name and size.'" },
  { id: 'A9', file: ADAPTER, why: '🔴 the size anchor is dropped, so the scan eats the sentence — 24 rows got a size of "myrtle - 15 gallon" this way',
    from: '    if (candidate === \'\' || !CANDIDATE_STARTS_A_SIZE.test(candidate)) continue;',
    to:   "    if (candidate === '') continue;" },
  { id: 'A10', file: ADAPTER, why: '🔴 the scan runs LONGEST-first, which is the same defect from the other direction',
    from: '  for (let k = 1; k <= Math.min(MAX_SIZE_WORDS, words.length); k++) {',
    to:   '  for (let k = Math.min(MAX_SIZE_WORDS, words.length); k >= 1; k--) {' },
  { id: 'A11', file: ADAPTER, why: '🔴 the shape key stops parsing the unit, so "30 gal" and "30 Gallon" become two different products (#56 at import time)',
    from: "  const u = parseUnitOfMeasure(size);\n  const sizeKey = u\n    ? `u:${u.kind}:${u.value ?? ''}:${u.valueMax ?? ''}:${u.unit}`\n    : `raw:${(size ?? '').trim().toLowerCase()}`;",
    to:   "  const sizeKey = `raw:${(size ?? '').trim().toLowerCase()}`;" },
  { id: 'A12', file: ADAPTER, why: 'the name keeps the size on it — every product reads "Live Oak - 15 gallon" with a size column beside it saying the same thing',
    from: "      const name = words.slice(0, words.length - k).join(' ').replace(/[-–—,:(\\s]+$/, '').trim();",
    to:   "      const name = body;" },
  { id: 'A13', file: ADAPTER, why: 'the unread fragment is dropped, so "could not read" is honest but unactionable',
    from: '    return { name: body, size: null, state: \'could_not_read\', unreadSizeText: candidate };\n  }',
    to:   '    return { name: body, size: null, state: \'could_not_read\', unreadSizeText: null };\n  }' },
  { id: 'A14', file: ADAPTER, why: '🔴 the scan CONTINUES past a declined candidate, finding a size in the middle of a fertiliser name',
    from: "    return { name: body, size: null, state: 'could_not_read', unreadSizeText: candidate };\n  }\n\n  // Read in full",
    to:   "    continue;\n  }\n\n  // Read in full" },

  // ── the writer ──────────────────────────────────────────────────────────────
  { id: 'W1', file: WRITER, why: '🔴 a create that landed ZERO rows reports SUCCESS — exactly what an RLS refusal looks like (R-12 / A8)',
    from: '    if (created !== rows.length) {',
    to:   '    if (false) {' },
  { id: 'W2', file: WRITER, why: '🔴 the row is born with stock — inventory fabricated from an accounting document',
    from: '    qty: 0,',
    to:   '    qty: 1,' },
  { id: 'W3', file: WRITER, why: '🔴 a missing price becomes $0 — every sale then reads "at or above list" and the finding empties',
    from: '    sell_price: item.unitPrice,',
    to:   '    sell_price: item.unitPrice ?? 0,' },
  { id: 'W4', file: WRITER, why: '🔴 THE TRAP: the retire stops excluding THIS run, so the import retires the catalogue it just created',
    from: '      .or(`import_run_id.is.null,import_run_id.neq.${runId}`)',
    to:   '' },
  { id: 'W5', file: WRITER, why: '🔴 the exclusion becomes a bare `.neq`, which matches NO rows at LAWNS — all 447 have a NULL import_run_id',
    from: '      .or(`import_run_id.is.null,import_run_id.neq.${runId}`)',
    to:   '      .neq(\'import_run_id\', runId)' },
  { id: 'W6', file: WRITER, why: '🔴 RETIRE RUNS FIRST — a failed create then leaves her looking at an empty catalogue',
    from: '  const rows = plan.adapted.items.map(i => rowForItem(businessId, runId, i));',
    to:   "  const rows = plan.adapted.items.map(i => rowForItem(businessId, runId, i));\n  await db.from('business_inventory').update({ retired_at: new Date().toISOString() }).eq('business_id', businessId).is('retired_at', null).select('id');" },
  { id: 'W7', file: WRITER, why: '🔴 THE UNDO STOPS REFUSING while QuickBooks writes are on — rows behind a sent invoice get deleted',
    from: '  const gate = await undoIsOpen(db, businessId, pushHoldRaw);\n  if (!gate.open) {',
    to:   '  const gate = await undoIsOpen(db, businessId, pushHoldRaw);\n  if (false) {' },
  // 🔴 W22–W25 ARE THE DEFECT DAVID FOUND BY ASKING. The first draft gated on the env var alone,
  // so at LAWNS (writes off, env unset) the undo REFUSED in the state it exists to serve.
  { id: 'W22', file: WRITER, why: '🔴 THE ACTUAL DEFECT: the gate reads ONLY the operator env var again, so the owner\'s switch is ignored and LAWNS cannot wipe',
    from: '  return { open: !pushPermitted({ writesEnabled, platformHeld }), writesEnabled, readFailed: false };',
    to:   '  return { open: platformHeld, writesEnabled, readFailed: false };' },
  { id: 'W23', file: WRITER, why: '🔴 the gate reads ONLY the owner switch, so an OPERATOR hold over a live tenant no longer opens the undo',
    from: '  return { open: !pushPermitted({ writesEnabled, platformHeld }), writesEnabled, readFailed: false };',
    to:   '  return { open: writesEnabled !== true, writesEnabled, readFailed: false };' },
  { id: 'W24', file: WRITER, why: '🔴 a FAILED read of the switch is treated as test mode — the undo deletes rows it could not prove are safe',
    from: '    return { open: false, writesEnabled: null, readFailed: true };',
    to:   '    return { open: true, writesEnabled: null, readFailed: true };' },
  { id: 'W25', file: WRITER, why: 'the "we could not check" refusal is reworded as "you are live" — two different facts, one sentence',
    from: "      ? 'We could not read whether QuickBooks writes are on for this business, so the undo refused rather than guessing. Nothing was changed. This is a failed read, NOT a statement that you are live.'",
    to:   "      ? 'QuickBooks writes are switched on for this business, so an imported product may already be on an invoice you have sent. Undo is closed. Nothing was changed.'" },
  { id: 'W26', file: WRITER, why: '🔴 the COMMIT reports undoable from the env var alone, so it promises reversibility it may not have',
    from: '  const undoable = (await undoIsOpen(db, businessId, pushHoldRaw)).open;',
    to:   '  const undoable = isPushHeld(pushHoldRaw, businessId);' },
  { id: 'W8', file: WRITER, why: '🔴 the un-retire keys on retired_at instead of the run, so undoing run 2 restores run 1\'s hidden catalogue',
    from: "      .eq('business_id', businessId).eq('retired_by_run_id', runId).select('id');",
    to:   "      .eq('business_id', businessId).not('retired_at', 'is', null).select('id');" },
  { id: 'W9', file: WRITER, why: '🔴 the inventory delete drops its run scope — the undo deletes every imported row from every run',
    from: "    const inv = await db.from('business_inventory').delete().eq('business_id', businessId).eq('import_run_id', runId).select('id');",
    to:   "    const inv = await db.from('business_inventory').delete().eq('business_id', businessId).not('import_run_id', 'is', null).select('id');" },
  { id: 'W10', file: WRITER, why: '🔴 the customer delete is removed entirely — the undo would be incomplete the day the merge lands, silently',
    from: "    const cust = await db.from('customers').delete().eq('business_id', businessId).eq('import_run_id', runId).select('id');",
    to:   "    const cust = { data: [], error: null };" },
  { id: 'W11', file: WRITER, why: '🔴 receipts/deliveries are no longer asserted after the undo — "cannot happen by construction" stops being checked',
    from: '    const untouched = receiptsBefore === receiptsAfter && deliveriesBefore === deliveriesAfter;',
    to:   '    const untouched = true;' },
  { id: 'W12', file: WRITER, why: 'the run stamp is dropped from created rows, so nothing this run made can be found again',
    from: '    import_run_id: runId,',
    to:   '    import_run_id: null,' },
  { id: 'W13', file: WRITER, why: '🔴 the retire stops stamping WHICH run hid the row — the undo can no longer be exact',
    from: '      .update({ retired_at: new Date().toISOString(), retired_reason: RETIRE_REASON, retired_by_run_id: runId })',
    to:   '      .update({ retired_at: new Date().toISOString(), retired_reason: RETIRE_REASON })' },
  { id: 'W14', file: WRITER, why: '🔴 the unit projection is not derived on the row (R-27) — every imported row lands unit-blind',
    from: '    ...unitColumnsFor(item.size),',
    to:   '' },
  { id: 'W15', file: WRITER, why: '🔴 the qb identity is the SKU (present on 2 of 685) rather than Item.Id — 645 rows land with a null identity',
    from: '    qb_item_id: item.qboId,',
    to:   '    qb_item_id: item.sku,' },
  { id: 'W16', file: WRITER, why: 'the preview stops listing the counted rows about to be retired — a destroyed count becomes a number to go looking for',
    from: "      .eq('business_id', businessId).is('retired_at', null).gt('qty', 0);",
    to:   "      .eq('business_id', businessId).is('retired_at', null).gt('qty', 999999);" },
  { id: 'W17', file: WRITER, why: '🔴 the preview WRITES — a plan that mutates is not a plan',
    from: '  const adapted = adaptQboItems(qboItems);\n  try {',
    to:   "  const adapted = adaptQboItems(qboItems);\n  await db.from('business_inventory').update({ notes: 'x' }).eq('business_id', businessId).select('id');\n  try {" },
  { id: 'W18', file: WRITER, why: '🔴 the undo stops RE-READING what is left — a refused delete then reports a clean wipe (A8: no error, no rows, no clue)',
    from: '    const leftovers: string[] = [];\n    if ((invLeft ?? 0) > 0)     leftovers.push(`${invLeft} product row(s) this run created are still here`);',
    to:   '    const leftovers: string[] = [];\n    if (false)     leftovers.push(`${invLeft} product row(s) this run created are still here`);' },
  { id: 'W19', file: WRITER, why: '🔴 leftovers stop making the undo not-ok — the finding is computed and then ignored, which is worse than not computing it',
    from: '      ok: untouched && leftovers.length === 0,',
    to:   '      ok: untouched,' },
  { id: 'W20', file: WRITER, why: '🔴 a retire that planned rows and landed NONE is accepted — an RLS refusal reported as a successful import',
    from: '    if (plan.wouldRetire > 0 && retiredRows.length === 0) {',
    to:   '    if (false) {' },
  { id: 'W21', file: WRITER, why: 'the un-retire leftover is not counted, so a refused un-retire leaves the catalogue hidden and the undo says it worked',
    from: '    if ((retiredLeft ?? 0) > 0) leftovers.push(`${retiredLeft} product row(s) this run hid are still hidden`);',
    to:   '' },

  // ── the reader-side filter (⑤) ──────────────────────────────────────────────
  // 🔴 THESE ARE THE POINT OF THE CORPUS CAP. The filter itself cannot be wrong; a reader that
  // does not call it can, silently, and that is exactly what happened for the three days between
  // `retired_at` shipping and this build.
  { id: 'R1', file: GRID, why: '🔴 the CATALOGUE GRID stops hiding retired rows — LAWNS shows 1,094 products instead of 647',
    from: '    const full = await onlyLiveInventory(supabase',
    to:   '    const full = await (supabase' },
  { id: 'R2', file: GRID, why: '🔴 only the FALLBACK read loses the filter — a degraded path that quietly shows more than the main one',
    from: '      const core = await onlyLiveInventory(supabase',
    to:   '      const core = await (supabase' },
  { id: 'R3', file: PICKER, why: '🔴 THE ORDER PICKER resolves a RETIRED lot — a product hidden from the grid is still sellable',
    from: '  const { data: lot, error: lotErr } = await onlyLiveInventory(supabase',
    to:   '  const { data: lot, error: lotErr } = await (supabase' },
  { id: 'R4', file: FILTER, why: '🔴 the filter targets the wrong column — every call site looks right and none of them filters',
    from: "export const RETIRED_COLUMN = 'retired_at' as const;",
    to:   "export const RETIRED_COLUMN = 'status' as const;" },
  { id: 'R5', file: FILTER, why: 'the owner-facing sentence stops saying the rows are recoverable',
    from: "  'Products replaced by a QuickBooks import are hidden here, not deleted.';",
    to:   "  'Some products are not shown.';" },
];

const originals = new Map([
  [ADAPTER, readFileSync(ADAPTER, 'utf8')],
  [WRITER,  readFileSync(WRITER,  'utf8')],
  [GRID,    readFileSync(GRID,    'utf8')],
  [PICKER,  readFileSync(PICKER,  'utf8')],
  [FILTER,  readFileSync(FILTER,  'utf8')],
]);
let caught = 0, survived = 0, errored = 0;

try {
  process.stdout.write('  CONTROL (unmutated) … ');
  if (!suitesAreGreen()) { console.log('RED — aborting; every CAUGHT below would be meaningless.'); process.exit(2); }
  console.log('GREEN ✓\n');

  for (const m of MUTANTS) {
    const original = originals.get(m.file);
    const occurrences = original.split(m.from).length - 1;
    if (occurrences === 0) {
      console.log(`  ${m.id.padEnd(4)} ERROR    the from-text is not in the source — mutant never applied`);
      errored++; continue;
    }
    if (occurrences > 1) {
      console.log(`  ${m.id.padEnd(4)} ERROR    the from-text appears ${occurrences}× — the mutant cannot say which site it changed`);
      errored++; continue;
    }
    const mutated = original.replace(m.from, m.to);
    writeFileSync(m.file, mutated);
    // 🔴 VERIFIED IN-WINDOW (see the header): read the file back and confirm the mutation landed
    // BEFORE the suites run, rather than trusting that `replace` did what it was asked.
    if (readFileSync(m.file, 'utf8') !== mutated) {
      console.log(`  ${m.id.padEnd(4)} ERROR    the mutated file did not read back as written`);
      errored++; writeFileSync(m.file, original); continue;
    }
    if (suitesAreGreen()) { survived++; console.log(`  ${m.id.padEnd(4)} SURVIVED 🔴  ${m.why}`); }
    else                  { caught++;  console.log(`  ${m.id.padEnd(4)} CAUGHT   ✓   ${m.why}`); }
    writeFileSync(m.file, original);
  }
} finally {
  for (const [f, o] of originals) writeFileSync(f, o);
}

console.log(`\n  ── ${caught}/${MUTANTS.length} caught · ${survived} survived · ${errored} never applied ──`);
if (survived > 0 || errored > 0) process.exit(1);
