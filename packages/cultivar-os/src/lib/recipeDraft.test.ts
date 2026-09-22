/**
 * ── recipeDraft + the recipe SURFACES — what a person types, and what the screens do with it ──
 *                                                                              (ledger #370)
 *
 * TWO HALVES, and the split is the point:
 *   §A–§D run the draft layer as VALUES — no DOM, no database, no clock.
 *   §E–§G read the two `.tsx` files as TEXT. A render condition inside a component cannot be
 *   executed here (tech-debt #134), and the decisions that matter most on these screens ARE render
 *   conditions: whether a price is suggested, whether the made-item control is offered on create,
 *   whether the label is the business's word or a literal. Reading the source is the only way to
 *   assert them, and it is honest about being a source read — it renders nothing.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/recipeDraft.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import {
  COMPONENT_PURCHASE_LINK_FIELDS, COMPONENT_PURCHASE_LINK_SELECT, ITEM_RECIPE_FIELDS,
  ITEM_RECIPE_SELECT, MATCH_RECEIPT_REGISTRY, MATCH_RECEIPT_SELECT, RECIPE_COMPONENT_FIELDS,
  RECIPE_COMPONENT_SELECT, SELECT_OMISSIONS, sel,
} from './recipeFields';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  componentDraftProblems, draftCost, draftToComponentRows, draftToRecipeRow, emptyComponentDraft,
  emptyRecipeDraft, maySuggestPrice, NOT_TIMED, recipeDraftProblems, type RecipeDraft,
} from './recipeDraft';

// Repo-root-relative, NOT __dirname: esbuild bundles this file elsewhere (receiptsList.test.ts:42).
const R = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
/**
 * The same file with its COMMENTS removed. Several assertions below are about what the code DOES,
 * and these files explain themselves at length — a header that says *a `.range()` read would be
 * unsafe here* must not fail a probe asserting there is no `.range()` call. Stripping the prose is
 * what makes the probe about the code; matching the raw text would make it about the wording.
 */
const CODE = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const MODAL = R('packages/cultivar-os/src/components/recipe/RecipeModal.tsx');
const EDITOR = R('packages/cultivar-os/src/components/inventory/InventoryEditor.tsx');
const GRID = R('packages/cultivar-os/src/pages/BusinessInventory.tsx');
const WRITE = R('packages/cultivar-os/src/lib/recipeWrite.ts');

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const CATALOGUE = { qbItemId: 'qb-9001', inventoryId: 'row-1' };

/** LAWNS's Special Planting Mix, as a person would type it in. */
function spm(): RecipeDraft {
  const d = emptyRecipeDraft(CATALOGUE);
  d.yieldQuantity = '2.5'; d.yieldUnit = 'yd'; d.buildMinutes = '38'; d.buildMinutesBecause = 'timed by Lauren';
  d.components = [
    { name: 'Shook Out Brown', quantity: '2', unit: 'yd', componentQbItemId: null,
      purchase: { landedPackCostEqualPerItem: 30.88, landedPackCostProRataByValue: 30.88, packSize: 1, packUnit: 'yd' }, confirmed: null },
    { name: 'MicroMax', quantity: '2', unit: 'lb', componentQbItemId: null, purchase: null, confirmed: null },
  ];
  return d;
}

// ══ §A THE IDENTITY — EXACTLY ONE, AND IT IS THE QUICKBOOKS ONE ═══════════════════════════════
{
  const cat = emptyRecipeDraft(CATALOGUE);
  ok(cat.qbItemId === 'qb-9001' && cat.inventoryId === null,
    '🔴 A1: a catalogue item is keyed by its QUICKBOOKS id and NOT by its row — the reload of 2026-09-21 replaced all 632 row ids');
  const own = emptyRecipeDraft({ qbItemId: null, inventoryId: 'row-2' });
  ok(own.qbItemId === null && own.inventoryId === 'row-2',
    'A2: an item QuickBooks never had falls back to the row id — that is the only case it is allowed');

  const both = { ...cat, inventoryId: 'row-1' };
  ok(recipeDraftProblems(both).some(p => /exactly one item/.test(p)),
    '🔴 A3: two identities is refused IN WORDS before the write — the database CHECK says the same thing in a constraint name');
  const neither = { ...cat, qbItemId: null };
  ok(recipeDraftProblems(neither).some(p => /exactly one item/.test(p)),
    'A4: …and so is none');

  // The recipe row itself. `draftToRecipeRow` was imported and never asserted until eslint said so
  // — which is worth recording, because "unused import" was the only signal that the function
  // building the row nothing else checks had no probe at all.
  const row = draftToRecipeRow(spm(), 'biz-1');
  ok(row.qb_item_id === 'qb-9001' && row.inventory_id === null,
    '🔴 A4b: the ROW carries the QuickBooks id and a null row id — the identity the wipe guard requires');
  ok(row.yield_quantity === 2.5 && typeof row.yield_quantity === 'number',
    'A4c: the typed yield becomes a number at the boundary');
  ok(row.build_minutes === 38 && row.build_minutes_because === 'timed by Lauren',
    'A4d: build minutes and WHERE THEY CAME FROM travel together — a number with no provenance is the thing that gets believed');
  ok(draftToRecipeRow({ ...spm(), buildMinutes: '' }, 'biz-1').build_minutes === null,
    '🔴 A4e: an untimed build stores NULL, never 0 — 0 minutes is a claim that it takes no time');
  ok(draftToRecipeRow({ ...spm(), notes: '   ' }, 'biz-1').notes === null,
    'A4f: whitespace-only notes store as null rather than as a value that looks like content');

  const rows = draftToComponentRows(spm(), 'rec-1');
  ok(rows.length === 2 && rows.every(r => r.component_inventory_id === null),
    '🔴 A5: a component NEVER carries a row id — the wipe guard refuses one, so the modal can never create a recipe that blocks a catalogue reload');
  ok(rows[0].position === 1 && rows[1].position === 2,
    'A6: components keep the order they were typed — position is what the save re-attaches confirmed purchases by');
  ok(rows[0].name === 'Shook Out Brown' && rows[0].quantity === 2 && rows[0].unit === 'yd',
    'A7: the typed strings become numbers and trimmed text at the boundary, not before');
}

// ══ §B THE REFUSALS — IN WORDS, BEFORE THE WRITE ══════════════════════════════════════════════
{
  const empty = emptyRecipeDraft(CATALOGUE);
  const p = recipeDraftProblems(empty);
  ok(p.some(x => /How much does one batch make/.test(x)), 'B1: a batch with no yield is refused');
  ok(p.some(x => /What does a batch make/.test(x)), 'B2: …and one with no unit');
  ok(p.some(x => /no components is not a recipe/.test(x)), 'B3: …and one with nothing in it');
  ok(empty.buildMinutesBecause === NOT_TIMED,
    '🔴 B4: build time starts as "not timed — nobody has timed a build yet", NOT as a blank or a 0 — an untimed build must not read as a free one');

  const c = emptyComponentDraft();
  const cp = componentDraftProblems(c);
  ok(cp.length === 3, `B5: a blank component is wrong three ways — name, quantity, unit (got ${cp.length})`);
  ok(componentDraftProblems({ ...c, name: 'Osmocote', quantity: '0', unit: 'lb' }).some(x => /above 0/.test(x)),
    '🔴 B6: a quantity of 0 is refused — a component that goes in zero times is not a component');
  ok(componentDraftProblems({ ...c, name: 'Osmocote', quantity: '25', unit: '' }).some(x => /measured in/.test(x)),
    'B7: a quantity with no unit is refused — the cost model converts within families and cannot guess one');
  ok(componentDraftProblems({ ...c, name: 'Osmocote', quantity: '25', unit: 'lb' }).length === 0,
    '🔴 B8: a component on NO PURCHASE is otherwise LEGAL — MicroMax and 12-24-12 are on no captured receipt at LAWNS, and refusing them would force somebody to invent a price');

  const bad = { ...spm(), buildMinutes: '-5' };
  ok(recipeDraftProblems(bad).some(x => /0 or more/.test(x)), 'B9: negative build minutes are refused');
  ok(recipeDraftProblems({ ...spm(), buildMinutes: '' }).length === 0,
    'B10: …but BLANK build minutes are fine — "nobody has timed it" is an answer');
}

// ══ §C THE LIVE COST UNDER THE FORM ═══════════════════════════════════════════════════════════
{
  const cost = draftCost(spm());
  ok(cost.materials === 61.76, `🔴 C1: 2 yd of bark at the LANDED $30.88 is $61.76 under the form as it is typed (got ${cost.materials})`);
  ok(cost.incomplete && cost.missing.includes('MicroMax'),
    '🔴 C2: the component on no purchase is NAMED as missing, not dropped from the total in silence');
  ok(cost.missing.includes('labour'), 'C3: labour is a named gap too — the labour table ships empty');
  ok(cost.costPerYieldUnit === 24.7, `C4: $61.76 over 2.5 yd is $24.70 SO FAR (got ${cost.costPerYieldUnit})`);

  const half = draftCost({ ...spm(), yieldQuantity: '', yieldUnit: '' });
  ok(half.costPerYieldUnit === null,
    'C5: a half-typed form gives NO per-unit figure rather than dividing by 0 — the panel is live from the first keystroke and must survive one');
}

// ══ §D NO PRICE IS SUGGESTED WHILE THE COST IS INCOMPLETE (David, 2026-09-22) ═════════════════
{
  ok(maySuggestPrice(draftCost(spm())) === false,
    '🔴 D1: the batch is incomplete, so NO price may be suggested — a markup on a partial cost reads as a real one');

  const complete = spm();
  complete.components[1].purchase = { landedPackCostEqualPerItem: 44, landedPackCostProRataByValue: 44, packSize: 50, packUnit: 'lb' };
  complete.buildMinutes = '';
  const c = draftCost(complete);
  ok(!c.incomplete && maySuggestPrice(c),
    '🔴 D2: every component costed and no build time claimed — NOW a price may be suggested (the check can go both ways)');

  const timed = draftCost({ ...complete, buildMinutes: '38' });
  ok(timed.incomplete && !maySuggestPrice(timed),
    '🔴 D3: …and adding a BUILD TIME with no labour rate makes it incomplete again — the minutes are real and the money for them is not');
}

// ══ §E THE MODAL — WHAT ITS SOURCE MUST SAY ═══════════════════════════════════════════════════
{
  ok(/maySuggestPrice\(cost\)/.test(MODAL),
    '🔴 E1: the modal decides the suggestion through maySuggestPrice — not through its own copy of the rule (§6 r8)');
  ok(/No price is suggested while the cost is incomplete/.test(MODAL),
    '🔴 E2: …and when it is withheld the panel SAYS SO — an absent line with no sentence reads as a screen that forgot');
  ok(!/disabled=\{[^}]*incomplete/.test(MODAL),
    'E3: the suggestion is ABSENT, never a greyed control — a disabled price still shows a number');
  ok(/incompleteNote/.test(MODAL) && /materialsOtherSpread/.test(MODAL),
    '🔴 E4: the panel prints the gaps AND the other freight split — "show the working, suggest, Lauren decides"');
  const equalFirst = MODAL.indexOf("'equal_per_item'");
  ok(equalFirst > -1 && equalFirst < MODAL.indexOf("'pro_rata_by_value'"),
    '🔴 E5: equal-per-item is FIRST and is the default (David, 2026-09-21)');
  ok(/useState<Spread>\('equal_per_item'\)/.test(MODAL), 'E5b: …asserted on the initial state, not only on the order of the buttons');
  ok(/proposalSentence\(p\)/.test(MODAL) && /Yes, that is it/.test(MODAL),
    '🔴 E6: a match is PROPOSED as a question a person answers — nothing is applied by the matcher');
  ok(/repeat capture/.test(MODAL),
    '🔴 E7: the collapsed duplicate captures are REPORTED on screen (tech-debt #143 named where it bites), not silently dropped');
  ok(/On no purchase we hold/.test(MODAL),
    'E8: a component with no purchase says so on its own line — the person sees it before the total does');
  ok(/madeItemLabel/.test(MODAL) && !/homemade/.test(CODE(MODAL)),
    '🔴 E9: the modal carries NO literal "homemade" — the word is the business\'s, read from its config (AC-1)');
}

// ══ §F THE FLAG ON THE INVENTORY ITEM ═════════════════════════════════════════════════════════
{
  ok(/\{!creating && \(\s*<>\s*<div style=\{groupTitle\}>How it is made/.test(EDITOR),
    '🔴 F1: the made-item control is EDIT-ONLY — a recipe hangs off a row, so there is nothing to hang one off until the item exists');
  ok(/readMadeItemLabel/.test(EDITOR) && !/homemade/.test(CODE(EDITOR)),
    '🔴 F2: the editor reads the business\'s word for a made item and carries no literal of its own (AC-1)');
  ok(/set\(\{ item_type: was \}\)/.test(EDITOR),
    '🔴 F3: a REFUSED flag write puts the control back to what the database still holds — a control left showing a value that did not save is the worst of both');
  ok(/draft\.item_type === 'manufactured'/.test(EDITOR) && /RecipeModal/.test(EDITOR),
    'F4: the recipe is reachable only once the item is marked made here — no dead affordance (§1.6 item 5)');
  // ⚠️ THE COLUMN LIST, PARSED — not the file searched. A first draft matched `item_type` anywhere
  // in the source and SURVIVED the mutant that deleted the column from BASE_COLS, because the word
  // still appeared in a comment and in `toEditorItem`. That is tech-debt #182's class exactly: a
  // probe measuring the wrong population, reading green. It is recorded here rather than quietly
  // corrected, because the corrected probe looks identical to one that was always right.
  const baseCols = (GRID.match(/const BASE_COLS = '([^']+)'/) ?? [])[1] ?? '';
  const cols = baseCols.split(',').map(c => c.trim());
  ok(cols.includes('item_type') && cols.includes('qb_item_id'),
    `🔴 F5: the grid's SELECT names both columns — a flag the list never selects cannot be shown or edited from it (got ${baseCols || 'no BASE_COLS found'})`);
  ok(/item_type: r\.item_type \?\? 'purchased'/.test(GRID),
    'F6: a row with no flag reads as bought-in, which is what 1,079 of 1,079 LAWNS rows are today');
}

// ══ §G THE WRITER — EVERY WRITE COUNTS ITS ROWS ═══════════════════════════════════════════════
{
  // ⚠️ EACH WRITE IS CHECKED WHERE IT STANDS, NOT COUNTED. A first version compared the NUMBER of
  // writes against the NUMBER of select-backs, and it stopped biting the moment an unrelated
  // statement gained a `.select` — the mutant that removed an insert's select-back went GREEN,
  // because the totals still balanced. A count with no stated expectation is tech-debt #182's
  // class, and this file has now produced it twice (see F5). Each statement is its own assertion.
  const code = CODE(WRITE);
  const stmts = [...code.matchAll(/\.(insert|update)\(/g)];
  ok(stmts.length >= 4, `G1a: the writer still has its writes to check (found ${stmts.length})`);
  const unchecked = stmts.filter(m => {
    // The statement runs to its terminating semicolon; a select-back must appear inside it.
    const tail = code.slice(m.index!, code.indexOf(';', m.index!) + 1);
    return !/\.select\(/.test(tail);
  });
  ok(unchecked.length === 0,
    `🔴 G1: EVERY insert/update selects its row back — a refused write returns no error AND no row (E5 / R-12). Unchecked: ${unchecked.length}`);
  ok(/permission was refused/.test(WRITE),
    'G2: …and the message says what a zero-row result usually means, rather than "saved"');
  ok(!/component_inventory_id:\s*[^n]/.test(WRITE),
    'G3: the writer never sends a component row id — see A5');
  ok(/document_key: proposal\.documentKey/.test(WRITE),
    '🔴 G4: a confirmed match records WHICH DOCUMENT it came from — the same invoice is captured twice on LAWNS and "what did we last pay" must tell them apart');
  ok(/DEFAULT_MADE_ITEM_LABEL/.test(WRITE) && /tech-debt #188/.test(WRITE),
    'G5: the label read falls back to the seeded word and says why a staff read returns no row');
  // 🔴 G5b THE DELETE, WHICH IS THE ONE THAT WOULD DOUBLE THE DATA. `saveRecipe` REPLACES the
  // component rows; a delete refused by policy returns no error and removes nothing, and the insert
  // that follows would then add a second copy of every component. The first version of this writer
  // checked `error` alone and could not tell "deleted seven" from "deleted none" —
  // `npm run verify:zero-row-writes` flagged it UNCHECKABLE, and this is the assertion that keeps
  // it fixed.
  ok(/\.delete\(\)[\s\S]{0,80}\.select\('id'\)/.test(CODE(WRITE)),
    '🔴 G5a: the component DELETE selects back what it removed — a refused delete returns no error');
  ok(/removed \?\? \[\]\)\.length !== expected/.test(CODE(WRITE)),
    '🔴 G5b: …and it is COUNTED against what was there, so a partial clear stops BEFORE the insert that would double the list');

  // 🔴 G5c THE RECEIPT COLUMN LIST, NAMED AND ASSERTED (tech-debt #179's class: a declarative
  // select list that silently omits a column no reader misses). Every one of these feeds a
  // decision — the document key is built from vendor + date + amount, the collapse prefers a
  // capture carrying `receipt_number`, and `line_items` IS the thing being matched.
  // ✏️ IMPORTED NOW, NOT PARSED. An earlier version read this list out of `recipeWrite.ts` as text,
  // because importing anything from that file drags in the Supabase client and kills the probe
  // ("supabaseUrl is required"). The lists have since moved to `recipeFields.ts`, which is PURE —
  // so the probe imports the real value instead of a regex's idea of it.
  const wanted = ['id', 'vendor', 'date', 'amount', 'receipt_number', 'line_items'];
  const got = MATCH_RECEIPT_SELECT.split(',').map(c => c.trim());
  ok(wanted.every(c => got.includes(c)),
    `🔴 G5c: the matcher's receipt read names every column it decides on (missing: ${wanted.filter(c => !got.includes(c)).join(', ') || 'none'})`);
  ok(!got.includes('ocr_raw') && !got.includes('image_url'),
    'G5d: …and does NOT drag the OCR blob or the image along — a matcher reads lines, not photographs');
  ok(!/\.select\('[a-z_]+\s*,[^']*,[^']*'/.test(CODE(WRITE)),
    '🔴 G5g: the writer hand-writes NO multi-column select — every one is DERIVED from recipeFields (A4)');

  // 🔴 G5e ONE WRITER PER TABLE (§6 r8). `setItemType` first issued its OWN update on
  // `business_inventory` — a table that already has a writer — and `verify:write-paths` refused it
  // as a new undeclared path. It now goes through `persistInventoryPatch`, which already carries
  // the unit projection, the gated-column retry and the zero-row refusal check.
  ok(/persistInventoryPatch\(\{ id: inventoryId/.test(CODE(WRITE)),
    '🔴 G5e: the made-item flag is written through the ONE business_inventory writer, not a second one');
  ok(!/from\('business_inventory'\)/.test(CODE(WRITE)),
    '🔴 G5f: …and this file addresses that table NOWHERE directly — a forked writer is how two paths come to disagree');

  ok(!/\.range\(/.test(CODE(WRITE)),
    '🔴 G6: no paged read — a matcher reading only the first page would propose off a subset while looking complete (verify-stable-paging\'s class)');
}

// ══ §H THE FIELD REGISTRY AGAINST THE MIGRATION — BOTH DIRECTIONS ═════════════════════════════
// 🔴 TECH-DEBT #179's FIX, APPLIED ON ARRIVAL. `VENDORS_SELECT` named 10 columns while its
// migration created 14, and the four it missed were the ADDRESS — invisible to tsc, eslint, knip
// and every probe, because a column with no reader and no writer has no other tell. So the list is
// checked against the DDL, and it fails BOTH ways: a column the migration creates and the registry
// omits, and a column the registry claims that the migration never creates.
{
  const DDL = R('supabase/migrations/20260921_recipes_made_items.sql');
  const columnsOf = (table: string): string[] => {
    const start = DDL.indexOf(`CREATE TABLE IF NOT EXISTS public.${table} (`);
    if (start < 0) return [];
    const body = DDL.slice(start + DDL.slice(start).indexOf('(') + 1);
    const end = body.indexOf('\n);');
    return body.slice(0, end < 0 ? undefined : end).split('\n')
      .map(l => l.replace(/--.*$/, '').trim())
      .filter(l => /^[a-z_][a-z0-9_]*\s+(uuid|text|numeric|integer|date|timestamptz|boolean|jsonb)/.test(l))
      .map(l => l.split(/\s+/)[0]);
  };
  const pairs: Array<[string, readonly string[]]> = [
    ['item_recipes', ITEM_RECIPE_FIELDS],
    ['recipe_components', RECIPE_COMPONENT_FIELDS],
    ['component_purchase_links', COMPONENT_PURCHASE_LINK_FIELDS],
  ];
  for (const [table, declared] of pairs) {
    const created = columnsOf(table);
    ok(created.length >= 8, `H0 (${table}): the migration's columns were actually FOUND — a probe that parses nothing passes everything (got ${created.length})`);
    const missing = created.filter(c => !declared.includes(c));
    const invented = declared.filter(c => !created.includes(c));
    ok(missing.length === 0,
      `🔴 H1 (${table}): every column the migration creates is in the registry — missing: ${missing.join(', ') || 'none'}`);
    ok(invented.length === 0,
      `🔴 H2 (${table}): and the registry claims NO column the migration never creates — invented: ${invented.join(', ') || 'none'}`);
  }
}

// ══ §I EACH SELECT LITERAL EQUALS WHAT THE REGISTRY DERIVES ═══════════════════════════════════
// 🔴 WHY THE LITERAL EXISTS AT ALL, since the registry could produce it: supabase-js parses the
// select string AT THE TYPE LEVEL. A computed string collapses the returned row to
// `GenericStringError` — deriving these took tsc from 4 errors to 31, every one a row whose fields
// had become unreadable. So the literal ships and this section is what stops it drifting: the
// derivation is the SPECIFICATION, the literal is the artefact, and they are compared every run.
{
  const pairs: Array<[string, string, readonly string[], readonly string[]]> = [
    ['item_recipes', ITEM_RECIPE_SELECT, ITEM_RECIPE_FIELDS, SELECT_OMISSIONS.itemRecipe],
    ['recipe_components', RECIPE_COMPONENT_SELECT, RECIPE_COMPONENT_FIELDS, SELECT_OMISSIONS.recipeComponent],
    ['component_purchase_links', COMPONENT_PURCHASE_LINK_SELECT, COMPONENT_PURCHASE_LINK_FIELDS, SELECT_OMISSIONS.componentPurchaseLink],
    ['receipts (narrowed)', MATCH_RECEIPT_SELECT, MATCH_RECEIPT_REGISTRY, SELECT_OMISSIONS.matchReceipt],
  ];
  for (const [name, literal, fields, omit] of pairs) {
    const derived = sel(fields, omit);
    ok(literal === derived,
      `🔴 I1 (${name}): the select LITERAL equals what the registry derives.\n        literal: ${literal}\n        derived: ${derived}`);
  }
  // A negative control on the comparison itself: if `sel` ignored its omissions, every pair above
  // would still have to disagree. This asserts the comparison has teeth before trusting its greens.
  ok(sel(ITEM_RECIPE_FIELDS, ['business_id']) !== sel(ITEM_RECIPE_FIELDS),
    'I2 NEGATIVE CONTROL: `sel` actually drops what it is told to — otherwise I1 compares two identical derivations and cannot fail');
}

console.log(`\nrecipeDraft + surfaces: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
