/**
 * ── itemList — reading someone else's books without lying about what came back ──
 *
 * The pure half of the QuickBooks item-list read. There is no network here; what is under test
 * is the part that decides WHAT THE OPERATOR IS TOLD, which is the part that can be wrong in a
 * way nobody notices.
 *
 * 🔴 THE DEFECT CLASS THIS SUITE EXISTS FOR — and it is this platform's most-repeated one:
 * a confident label over data nobody looked at. "Unknown plant" over a row holding the name.
 * A `fulfilled` badge over a delivery scheduled for a future Saturday. A $0 that was really a
 * failed read. Here the same shape is available in one specific place: **rendering "0 items"
 * for a response we could not parse.** A QuickBooks company genuinely CAN have no items, so
 * the empty answer is real — which is exactly what makes the failed parse able to hide inside
 * it. §A is that pair, both directions, and it is the reason this file exists.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/itemList.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { parseItemList, summariseItems } from './itemList';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

/** A realistic two-item body, shaped as Intuit actually returns it. */
const REAL_BODY = JSON.stringify({
  QueryResponse: {
    Item: [
      { Id: '1', Name: 'Services', Type: 'Service', Active: true,
        IncomeAccountRef: { value: '79', name: 'Services' } },
      { Id: '14', Name: 'Nursery Stock', Type: 'NonInventory', Active: true,
        IncomeAccountRef: { value: '82', name: 'Sales of Product Income' } },
    ],
    startPosition: 1, maxResults: 2,
  },
  time: '2026-08-29T12:00:00.000-07:00',
});

// ══ §A EMPTY IS NOT UNREADABLE — the defect class, both directions ═══════════
{
  // A company with no items: Intuit omits the Item key entirely. This is a TRUE answer.
  const empty = parseItemList(JSON.stringify({ QueryResponse: {}, time: 'x' }));
  ok(empty.ok === true, 'a QueryResponse with no Item key is a SUCCESSFUL read of an empty item list — a company can genuinely have none');
  ok(empty.items.length === 0, 'and it reports zero rows');
  ok(empty.parseError === null, 'with no error, because nothing went wrong');

  // A body we could not read must NOT arrive at the same place.
  const notJson = parseItemList('<html>502 Bad Gateway</html>');
  ok(notJson.ok === false, '🔴 THE DEFECT: a non-JSON body is NOT a successful read of zero items');
  ok(notJson.items.length === 0, 'it yields no rows');
  ok(notJson.parseError !== null, 'and it SAYS it could not be read, rather than rendering as an empty list (D-9 / A9 — absent is not empty)');

  const noQr = parseItemList(JSON.stringify({ Fault: { Error: [{ code: '3200' }] } }));
  ok(noQr.ok === false, 'a Fault body — valid JSON, no QueryResponse — is also not an empty item list');
  ok(noQr.parseError !== null, 'and names why');

  const badShape = parseItemList(JSON.stringify({ QueryResponse: { Item: 'nope' } }));
  ok(badShape.ok === false, 'an Item that is not a list is a shape we do not understand, not zero items');

  const nullQr = parseItemList(JSON.stringify({ QueryResponse: null }));
  ok(nullQr.ok === false, 'QueryResponse:null is unreadable, not empty — typeof null is "object", so this is the branch that gets written wrong');

  ok(empty.ok !== notJson.ok,
    '🔴 the two must be DISTINGUISHABLE at the top level — if these ever agree, an unreadable response renders as "no items in QuickBooks" and someone maps a tree to nothing');
}

// ══ §B THE REAL BODY — the fields that answer the question ═══════════════════
{
  const r = parseItemList(REAL_BODY);
  ok(r.ok === true && r.items.length === 2, 'the real two-item body parses to two rows');
  ok(r.items[0].id === '1' && r.items[0].name === 'Services',
    "id '1' is read from the response, not assumed — the twelve hardcoded literals claim it is 'Services' and this read is what CHECKS that claim");
  ok(r.items[1].incomeAccount === 'Sales of Product Income',
    '🔴 IncomeAccountRef.name is carried — it is the revenue bucket, i.e. the whole Nursery-Stock-vs-Services split the twelve literals currently collapse');
  ok(r.items[1].type === 'NonInventory', "Intuit's own Type vocabulary is passed through unchanged, not remapped into ours");
  ok(r.items[0].active === true, 'Active is carried — an inactive item is a bad ItemRef target and the operator must be able to see which is which');
}

// ══ §C MISSING FIELDS ARE MISSING, NOT INVENTED ═════════════════════════════
{
  const sparse = parseItemList(JSON.stringify({
    QueryResponse: { Item: [{ Id: '7', Name: 'Bare' }] },
  }));
  ok(sparse.items[0].type === null, 'an absent Type is null — never a plausible-looking guess');
  ok(sparse.items[0].incomeAccount === null,
    '🔴 an absent IncomeAccountRef is null. Defaulting it to a bucket name would fabricate the exact fact this read exists to establish');
  ok(sparse.items[0].active === null, 'an absent Active is null — NOT true. "We were not told" and "it is active" are different');

  const blank = parseItemList(JSON.stringify({ QueryResponse: { Item: [{ Id: '8', Name: '   ' }] } }));
  ok(blank.items[0].name === '(unnamed)', 'a blank name renders as an explicit "(unnamed)" rather than an empty cell that reads as a rendering bug');

  const noId = parseItemList(JSON.stringify({ QueryResponse: { Item: [{ Name: 'Ghost' }, { Id: '9', Name: 'Real' }] } }));
  ok(noId.items.length === 1 && noId.items[0].id === '9',
    'an item with no Id is dropped — it cannot be an ItemRef target, and listing it would offer the operator a choice that cannot work');

  const numericId = parseItemList(JSON.stringify({ QueryResponse: { Item: [{ Id: 42, Name: 'Numeric' }] } }));
  ok(numericId.items[0].id === '42', 'a numeric Id survives as a string — ItemRef.value is a string in every payload we send');
}

// ══ §D THE BREAKDOWN — the answer the mapping pass needs ═══════════════════
//
// 🔴 THE QUERY, THE CAPTURE FILENAME AND THE 401/403 CLASSIFICATION MOVED to ./qboRead and are
// asserted in qboRead.test.ts §A/§F/§G — across BOTH entities and every page position, which is
// a stronger assertion than the single-string one that used to live here. R-23's guard cell was
// updated in the same commit rather than left pointing at a symbol that no longer exists.
{
  const items = parseItemList(JSON.stringify({ QueryResponse: { Item: [
    { Id: '1',  Name: 'Services',      Type: 'Service',      Active: true,  IncomeAccountRef: { name: 'Services' } },
    { Id: '14', Name: 'Nursery Stock', Type: 'NonInventory', Active: true,  IncomeAccountRef: { name: 'Sales of Nursery Stock' } },
    { Id: '15', Name: 'Trees',         Type: 'Category',     Active: true },
    { Id: '16', Name: 'Shrubs',        Type: 'category',     Active: true },
    { Id: '17', Name: 'Old netting',   Type: 'Service',      Active: false, IncomeAccountRef: { name: 'Services' } },
  ] } })).items;
  const b = summariseItems(items);

  ok(b.total === 5, 'the breakdown counts every row');
  ok(b.categories === 2,
    "🔴 CASE-INSENSITIVE: 'Category' and 'category' are the same thing. A Category is a FOLDER in QuickBooks and cannot be an invoice line's ItemRef, so miscounting them overstates what is actually mappable");
  ok(b.sellable === 3, 'and sellable is everything an ItemRef could legally point at');
  ok(b.sellable + b.categories === b.total, 'the two partition the list — no row is in both and none is in neither');
  ok(b.inactive === 1, 'inactive items are counted — an inactive item is a bad ItemRef target and the operator must see which is which');

  ok(b.itemId1 !== null && b.itemId1.name === 'Services',
    "🔴 THE HEADLINE ANSWER: the twelve hardcoded literals assert ItemRef.value === '1', and this reports whether that id EXISTS in the company — from the complete list, not from a page somebody scrolled");
  ok(b.byIncomeAccount[0].account === 'Services' && b.byIncomeAccount[0].count === 2,
    'the income-account split is tallied biggest-first — this is the Nursery-Stock-vs-Services split the twelve literals currently collapse');
  ok(b.byIncomeAccount.some(a => a.account === null && a.count === 2),
    '🔴 items with NO income account are their own bucket, reported as null. Folding them into a named account would fabricate the exact fact this read exists to establish');

  const absent = summariseItems(parseItemList(JSON.stringify({ QueryResponse: { Item: [{ Id: '2', Name: 'Other' }] } })).items);
  ok(absent.itemId1 === null,
    "🔴 AND THE OTHER DIRECTION: no item with Id '1' reports NULL, not a guess. Against a list proven complete that means all twelve literals point at an item that does not exist — QuickBooks would REJECT the push rather than mis-file it, which is a different and louder defect");

  const collide = summariseItems(parseItemList(JSON.stringify({ QueryResponse: { Item: [
    { Id: '3', Name: 'A', IncomeAccountRef: { name: 'not set' } },
    { Id: '4', Name: 'B' },
  ] } })).items);
  ok(collide.byIncomeAccount.length === 2,
    'an account literally NAMED "not set" does not merge with the rows that genuinely have none — the tally key is namespaced, because those are different facts and the display spells them the same');

  const none = summariseItems([]);
  ok(none.total === 0 && none.itemId1 === null && none.byIncomeAccount.length === 0,
    'an empty list breaks down to zeros without dividing by anything or claiming id 1 is present');
}

console.log(`\nitemList: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
