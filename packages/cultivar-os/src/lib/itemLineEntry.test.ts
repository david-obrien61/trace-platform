/**
 * ── ONE ITEM SEARCH, AND WHAT A TILL NEEDS ON TOP OF IT ───────────────────────────────────────
 *
 * WHAT THIS GUARDS. David's ruling, 2026-09-23: *"inventory already has the filter type function,
 * why not reuse that like we should."* Checkout's own `searchStockLines` matched `name` and `sku`
 * — and **`sku` is populated on 1 of 632 live LAWNS rows**, while the code the grid shows lives in
 * `qb_item_name` on **632 of 632**. Typing `CLCC45` at the counter returned nothing. That is
 * ledger #384's fix never reaching a second surface.
 *
 * THE FIXTURE IS LAWNS'S LIVE DATA, measured 2026-09-23 — the five `Cherry Laurel Centre Court`
 * rows (sizes 7/15/30/45/65 gal, `sku` NULL on every one, code in `qb_item_name`), a Shoal Creek
 * Vitex, and the shapes that make the counter hard: 402 of 632 live rows share a name with another
 * row, 107 carry no size at all, and 133 cannot be sold right now.
 *
 * Run: node scripts/run-tests.mjs itemLineEntry
 */
import { rankItemChoices, sellabilityOf, type ItemRow } from './itemLineEntry';
import { CHECKOUT_ITEM_SEARCH, CHECKOUT_SEARCH_PLACEHOLDER } from './checkoutSearchSpec';
import { matchesHaystack, searchHaystack, foldForSearch } from '@trace/shared/components/datasheet/searchSpec';
import { canonicalNameKey } from '@trace/shared/utils/canonicalName';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg); console.error('   ✗ ' + msg);
}

const row = (p: Partial<ItemRow> & { id: string }): ItemRow => ({
  name: null, sku: null, qb_item_name: null, size: null, qty: 10, sell_price: 100, ...p,
});

// LAWNS, live 2026-09-23. NOTE `sku: null` everywhere — that is the real data, not a simplification.
const LAUREL = ['7 Gallon', '15 Gallon', '30 Gallon', '45 Gallon', '65 Gallon'].map((size, i) =>
  row({ id: `cl${i}`, name: 'Cherry Laurel Centre Court', qb_item_name: `CLCC${size.split(' ')[0]}`, size }));
const VITEX     = row({ id: 'v1', name: 'Shoal Creek Vitex', qb_item_name: 'SCV30', size: '30 Gallon' });
const NO_STOCK  = row({ id: 'n1', name: 'Live Oak', qb_item_name: 'LO45', size: '45 Gallon', qty: 0 });
const NO_PRICE  = row({ id: 'n2', name: 'Live Oak', qb_item_name: 'LO65', size: '65 Gallon', sell_price: 0 });
const NEITHER   = row({ id: 'n3', name: 'Live Oak', qb_item_name: 'LO95', size: '95 Gallon', qty: 0, sell_price: null });
const SIZELESS_A = row({ id: 's1', name: 'Cedar Elm', qb_item_name: 'CE-A', size: null });
const SIZELESS_B = row({ id: 's2', name: 'Cedar Elm', qb_item_name: 'CE-B', size: null });
const ALL: ItemRow[] = [...LAUREL, VITEX, NO_STOCK, NO_PRICE, NEITHER, SIZELESS_A, SIZELESS_B];

// ── §A — 🔴 THE DEFECT: the code is in qb_item_name, and sku is null ─────────────────────────
{
  const hay = searchHaystack(CHECKOUT_ITEM_SEARCH, LAUREL[3]);
  ok(/CLCC45/.test(hay), '§A 🔴 the haystack contains the CODE — read via itemIdentifier (sku ?? qb_item_name), not r.sku');
  ok(rankItemChoices(ALL, 'CLCC45').length === 1, '§A typing the code finds exactly that row — it found NOTHING before');
  ok(rankItemChoices(ALL, 'CLCC4')[0]?.row.id === 'cl3', '§A a PARTIAL code finds it too — how a person actually types');
  ok(/SKU or code/.test(CHECKOUT_SEARCH_PLACEHOLDER) && /name/.test(CHECKOUT_SEARCH_PLACEHOLDER) && /size/.test(CHECKOUT_SEARCH_PLACEHOLDER),
    `§A the placeholder is DERIVED from the three fields (R-170) — got "${CHECKOUT_SEARCH_PLACEHOLDER}"`);
  ok(!/location|notes|serial|group/.test(CHECKOUT_SEARCH_PLACEHOLDER),
    '§A 🔴 and it does NOT promise the roster\'s other four — a till must not match on somebody\'s note');
}

// ── §B — 🔴 "CENTER" FINDS "CENTRE". David: she will not adapt and should not have to ────────
{
  ok(rankItemChoices(ALL, 'Center Court').length === 5, '§B 🔴 "Center Court" finds all five Centre Court rows');
  ok(rankItemChoices(ALL, 'Centre Court').length === 5, '§B …and so does the spelling the catalogue uses');
  ok(rankItemChoices(ALL, 'center').length === 5, '§B one folded word is enough');
  ok(foldForSearch('Centre') === 'center', '§B the fold is applied at BOTH index and query time');

  // 🔴 THE GUARD THAT MATTERS MORE THAN THE FEATURE: the resolution key is UNCHANGED.
  ok(canonicalNameKey('Cherry Laurel Centre Court') === 'centre cherry court laurel',
    '§B 🔴 canonicalNameKey still says "centre" — the D-45/D-46 SCAN-RESOLUTION key is untouched');
  ok(canonicalNameKey('Cherry Laurel Centre Court') !== canonicalNameKey('Cherry Laurel Center Court'),
    '§B 🔴 …and the two spellings are STILL NOT EQUAL there. Folding them into that key would change which row a scan resolves to — a money path. The fold is search-only.');
}

// ── §C — 🔴 TOKEN SUBSET, WHICH THE ROSTER DID NOT HAVE AND MUST NOT LOSE ────────────────────
{
  ok(rankItemChoices(ALL, 'shoal creek')[0]?.row.id === 'v1', '§C "shoal creek" finds Shoal Creek Vitex');
  ok(rankItemChoices(ALL, 'creek shoal')[0]?.row.id === 'v1', '§C 🔴 …and so does "creek shoal" — ANY ORDER. The roster\'s plain .includes() could not do this');
  ok(rankItemChoices(ALL, 'vitex shoal')[0]?.row.id === 'v1', '§C …nor could it do "vitex shoal"');
  ok(matchesHaystack('Shoal Creek Vitex', 'creek shoal'), '§C the shared matcher is what provides it — one rule, both surfaces');
  ok(rankItemChoices(ALL, 'shoal oak').length === 0, '§C 🔴 NEGATIVE CONTROL — token SUBSET, not token ANY. "shoal oak" matches neither');
}

// ── §D — 🔴 UNSELLABLE IS SHOWN AND MARKED, NEVER HIDDEN (D-9) ───────────────────────────────
{
  ok(sellabilityOf(NO_STOCK) === 'none in stock', '§D no stock says so');
  ok(sellabilityOf(NO_PRICE) === 'no price set', '§D no price says so');
  ok(sellabilityOf(NEITHER) === 'none in stock · no price set',
    '§D 🔴 BOTH are named when both apply — two problems with two different fixes, and "not available" suggests neither');
  ok(sellabilityOf(VITEX) === null, '§D a sellable row carries no marking');

  const oaks = rankItemChoices(ALL, 'Live Oak');
  ok(oaks.length === 3, '§D 🔴 all three unsellable Live Oaks are SHOWN — hiding them answers "why isn\'t it in the list?" with silence');
  ok(oaks.every(c => c.unsellable !== null), '§D …and every one of them is marked');
}

// ── §E — ORDER. The first row is what Enter takes. ───────────────────────────────────────────
{
  // 🔴 THE UNSELLABLE ROW SORTS FIRST ON EVERY OTHER KEY, AND THAT IS THE POINT OF THE FIXTURE.
  // Same name, and its size (15) sorts BEFORE the sellable one's (45) — so the ONLY thing that can
  // put the sellable row on top is the sellability rule itself.
  // ⚠️ A first draft used sizes 45 (unsellable) and 30 (sellable): the sellable row came first by
  // SIZE, so mutant M5 — deleting the sellable-first rule entirely — SURVIVED. The assertion was
  // true and was measuring the size comparator (tech-debt #182's class, found by the mutant).
  const mixed: ItemRow[] = [
    row({ id: 'n1', name: 'Live Oak', qb_item_name: 'LO15', size: '15 Gallon', qty: 0 }),
    row({ id: 'ok', name: 'Live Oak', qb_item_name: 'LO45', size: '45 Gallon' }),
  ];
  const ranked = rankItemChoices(mixed, 'Live Oak');
  ok(ranked[0]?.row.id === 'ok',
    '§E 🔴 SELLABLE FIRST — the top row is what pressing Enter takes, so it must never be one that cannot be sold');
  ok(ranked[1]?.row.id === 'n1', '§E …and the unsellable one is still there, below it — shown, not hidden');
  ok(ranked.length === 2, '§E both rows are present: sellability ORDERS the list, it never filters it');
  const sizes = rankItemChoices(ALL, 'Centre Court').map(c => c.row.size);
  ok(sizes[0] === '7 Gallon' && sizes[sizes.length - 1] === '65 Gallon',
    `§E sizes sort numerically, so 7 comes before 15 — got ${JSON.stringify(sizes)}`);
}

// ── §F — 🔴 THE 107 SIZELESS ROWS SAY SO RATHER THAN OFFERING A CONFUSING LIST ───────────────
{
  const elms = rankItemChoices(ALL, 'Cedar Elm');
  ok(elms.length === 2, '§F both Cedar Elms are shown');
  ok(elms.every(c => c.indistinguishable),
    '§F 🔴 …and BOTH are flagged indistinguishable: same name, no size, so typing MORE cannot separate them. The screen says so instead of offering a silent duplicate');
  ok(rankItemChoices(ALL, 'Centre Court').every(c => !c.indistinguishable),
    '§F 🔴 NEGATIVE CONTROL — the five laurels share a name too, but each HAS a size, so they are distinguishable and are not flagged');
  ok(!rankItemChoices([SIZELESS_A], 'Cedar Elm')[0].indistinguishable,
    '§F 🔴 …and a lone sizeless row is NOT flagged — there is nothing to confuse it with. The flag is about the SET, not the row');
}

// ── §G — AN EMPTY TERM SHOWS NOTHING, WHICH IS A TILL DECISION, NOT A MATCHER ONE ────────────
{
  ok(rankItemChoices(ALL, '').length === 0,
    '§G 🔴 an empty term returns NOTHING — 632 rows under the cursor is noise, not a starting point');
  ok(rankItemChoices(ALL, '   ').length === 0, '§G whitespace is the same as empty');
  ok(matchesHaystack('anything', '') === true,
    '§G 🔴 …while the shared MATCHER says an empty term matches everything. "No filter" and "no matches" are different questions, and a GRID needs the opposite answer — which is exactly why this decision lives at the till and not in the shared rule');
  ok(rankItemChoices(ALL, 'Centre', 2).length === 2, '§G the limit is honoured');
}

console.log(`\n  itemLineEntry: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
