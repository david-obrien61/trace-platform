/**
 * ── qboRead — the machinery that makes "the whole list" a provable claim ──────────────
 *
 * The entity-agnostic half of every QuickBooks read: query building, counting, page
 * unwrapping, the stop condition, the completeness verdict, capture naming, failure
 * classification. No network here.
 *
 * 🔴 THE DEFECT THIS SUITE EXISTS FOR, AND IT ALREADY HAPPENED. #229 shipped
 * `select * from Item` with no MAXRESULTS. Intuit's silent default returned exactly 100 rows,
 * carrying ids past 1127 — a TRUNCATED list rendered as a complete one. The only reason
 * anybody knew is that a human read the ids and thought "1127 is more than 100". That is this
 * platform's most-repeated defect (a confident label over data nobody looked at) wearing a
 * pagination costume, and the fix is not "remember to paginate": it is that a read now carries
 * the number it was supposed to reach and REFUSES when it does not reach it.
 *
 * §D is the load-bearing section. Every other section supports it.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/qboRead.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import {
  QBO_ENTITIES, QBO_ROUTE, QBO_PAGE_SIZE, QBO_MAX_PAGES, QBO_WALK_CEILING, maxPagesFor, ceilingCheck,
  qboCountQuery, qboPageQuery, parseCount, parseRows,
  pageIsLast, completeness, rawCaptureFileName, classifyFailure,
} from './qboRead';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

/**
 * 🔴 DERIVED FROM THE MODULE, NEVER HAND-LISTED. This array used to be typed out here, so the
 * read-only sweep below covered exactly the entities somebody had remembered to add to it. A
 * fourth entity is now swept the moment it is declared — a coverage list maintained by hand is
 * a coverage list that eventually under-covers, silently (R-19).
 */
const ENTITIES = QBO_ENTITIES;

// ══ §A THE QUERIES — READ-ONLY, BOTH ENTITIES, EVERY PAGE POSITION ═══════════
{
  ok(qboCountQuery('Item') === 'select count(*) from Item', 'the item count query is exact');
  ok(qboCountQuery('Customer') === 'select count(*) from Customer', 'the customer count query is exact');
  ok(qboPageQuery('Item', 1) === 'select * from Item startposition 1 maxresults 1000',
    'a page query carries BOTH startposition and maxresults — #229 carried neither, and Intuit silently gave 100');
  ok(qboPageQuery('Customer', 1001) === 'select * from Customer startposition 1001 maxresults 1000',
    'the second page starts at 1001, not 1000 — STARTPOSITION is 1-BASED, and the off-by-one here silently drops one row per page');

  // 🔴 R-23 clause (a), asserted rather than trusted, across the whole generated surface.
  const WRITE = /\b(insert|update|delete|drop|truncate|into|set)\b/i;
  let clean = true;
  for (const e of ENTITIES) {
    if (WRITE.test(qboCountQuery(e))) clean = false;
    for (const start of [1, 2, 1001, 999999]) {
      if (WRITE.test(qboPageQuery(e, start))) clean = false;
    }
  }
  ok(clean, '🔴 READ-ONLY (R-23 clause a): no query this module can generate — either entity, any page position — contains a write verb');

  ok(ENTITIES.includes('Invoice'), 'the invoice entity is declared — the read the item and customer reads were a detour around');
  ok(qboCountQuery('Invoice') === 'select count(*) from Invoice', 'the invoice count query is exact');
  ok(qboPageQuery('Invoice', 1001) === 'select * from Invoice startposition 1001 maxresults 1000',
    'and the invoice walk is the SAME walk with one word changed — one implementation, three entities (§6 r8)');

  ok(qboPageQuery('Item', 0).includes('startposition 1'), 'a startposition below 1 is clamped to 1 rather than sent as 0, which Intuit rejects');
  ok(qboPageQuery('Item', -5).includes('startposition 1'), 'and a negative one is too');
  ok(qboPageQuery('Item', 1.9).includes('startposition 1'), 'a fractional startposition is floored, never interpolated as "1.9" into the query');
  ok(qboPageQuery('Item', 1, 5000).includes(`maxresults ${QBO_PAGE_SIZE}`),
    '🔴 a page size above the cap is CLAMPED to 1000 — QuickBooks silently truncates an over-cap request, which is the exact failure this file exists to end');
  ok(QBO_PAGE_SIZE === 1000, 'the page size is the documented QuickBooks maximum');
  ok(QBO_MAX_PAGES > 0, 'there is an absolute page ceiling so a server that keeps answering cannot spin the loop forever');
}

// ══ §B THE COUNT — UNREADABLE IS null, NEVER 0 ══════════════════════════════
{
  const c = parseCount(JSON.stringify({ QueryResponse: { totalCount: 1127 }, time: 'x' }));
  ok(c.ok === true && c.total === 1127, 'a real count body reads its totalCount');

  const zero = parseCount(JSON.stringify({ QueryResponse: { totalCount: 0 } }));
  ok(zero.ok === true && zero.total === 0, 'a genuine zero is a readable answer — a company can hold no items');

  const notJson = parseCount('<html>502</html>');
  ok(notJson.ok === false && notJson.total === null,
    '🔴 THE DEFECT: an unreadable count is null, NEVER 0. A 0 would make every later completeness check pass trivially — the guard would agree with any number of rows, including none');
  ok(zero.total !== notJson.total, 'so a true zero and an unreadable count are DISTINGUISHABLE — if these ever agree, the completeness guard is decorative');

  ok(parseCount(JSON.stringify({ QueryResponse: {} })).total === null, 'a QueryResponse with no totalCount is unreadable, not zero');
  ok(parseCount(JSON.stringify({ QueryResponse: null })).ok === false, 'QueryResponse:null is unreadable — typeof null is "object", so this is the branch that gets written wrong');
  ok(parseCount(JSON.stringify({ QueryResponse: { totalCount: 'lots' } })).total === null, 'a non-numeric totalCount is unreadable rather than coerced');
  ok(parseCount(JSON.stringify({ QueryResponse: { totalCount: -3 } })).total === null, 'a negative count is unreadable — it is not a real answer and must not become one');
  ok(parseCount(JSON.stringify({ Fault: { Error: [{ code: '3200' }] } })).ok === false, 'a Fault body is not a count');
}

// ══ §C PAGE UNWRAPPING — EMPTY IS NOT UNREADABLE ════════════════════════════
{
  const two = parseRows(JSON.stringify({ QueryResponse: { Item: [{ Id: '1' }, { Id: '2' }] } }), 'Item');
  ok(two.ok === true && two.rows.length === 2, 'a two-row item page unwraps to two rows');

  const cust = parseRows(JSON.stringify({ QueryResponse: { Customer: [{ Id: '9' }] } }), 'Customer');
  ok(cust.ok === true && cust.rows.length === 1, 'and the SAME function unwraps a customer page — one implementation, two entities (§6 r8)');

  const wrongKey = parseRows(JSON.stringify({ QueryResponse: { Item: [{ Id: '1' }] } }), 'Customer');
  ok(wrongKey.ok === true && wrongKey.rows.length === 0,
    'asking for Customer against an Item body finds no Customer key and reports a TRUE empty — the entity is the key, and it is not guessed');

  const empty = parseRows(JSON.stringify({ QueryResponse: {} }), 'Item');
  ok(empty.ok === true && empty.rows.length === 0 && empty.parseError === null,
    'a QueryResponse with no entity key is a SUCCESSFUL read of an empty list — Intuit omits the key rather than sending []');

  const notJson = parseRows('<html>502 Bad Gateway</html>', 'Item');
  ok(notJson.ok === false && notJson.parseError !== null,
    '🔴 THE DEFECT: a non-JSON body is NOT a successful read of zero rows, and it SAYS it could not be read (D-9 / A9 — absent is not empty)');
  ok(empty.ok !== notJson.ok,
    '🔴 the two must be DISTINGUISHABLE at the top level — if they ever agree, an unreadable page ends the pagination loop as if the list were finished');

  ok(parseRows(JSON.stringify({ QueryResponse: { Item: 'nope' } }), 'Item').ok === false, 'an entity key that is not a list is a shape we do not understand, not zero rows');
  ok(parseRows(JSON.stringify({ QueryResponse: null }), 'Item').ok === false, 'QueryResponse:null is unreadable, not empty');
  ok(parseRows(JSON.stringify({ Fault: {} }), 'Item').ok === false, 'a Fault body is not an empty list');
}

// ══ §D COMPLETENESS — THE WHOLE POINT. A SHORTFALL IS A FAILURE ═════════════
{
  const good = completeness(1127, 1127);
  ok(good.complete === true, '1127 expected, 1127 retrieved is complete');
  ok(good.headline.includes('1127'), 'and the headline quotes the number, so the claim is checkable on screen rather than asserted');

  // 🔴 THE EXACT SHAPE OF #229's DEFECT, REPLAYED.
  const truncated = completeness(1127, 100);
  ok(truncated.complete === false,
    '🔴 THE DEFECT REPLAYED: 1127 expected, 100 retrieved is NOT complete. This is #229 exactly — Intuit\'s silent 100-row default, caught before only because a human read the ids');
  ok(/1127/.test(truncated.headline) && /100/.test(truncated.headline),
    'and the refusal names BOTH numbers — a bare "incomplete" leaves the reader unable to judge how bad it is');
  ok(/1027/.test(truncated.headline), 'and the size of the gap, computed rather than left to the reader');
  ok(/INCOMPLETE/i.test(truncated.headline), 'and it is labelled a failure, not a note');

  const overshoot = completeness(100, 101);
  ok(overshoot.complete === false,
    'retrieving MORE than expected is also not complete — it means rows moved under the walk, and a silent pass would hide a double-counted page');
  ok(/OVER/.test(overshoot.headline), 'and it says which direction it went wrong, because the two have different causes');

  // 🔴 THE THIRD STATE, AND THE ONE MOST LIKELY TO BE WRITTEN AS A PASS.
  const unknown = completeness(null, 500);
  ok(unknown.complete === false,
    '🔴 AN UNREADABLE EXPECTED COUNT IS NOT COMPLETE. We cannot prove the walk finished, and "probably fine" is precisely the posture that let 100 rows pass for 1127');
  ok(/CANNOT be proven complete/i.test(unknown.headline), 'and it says WHY it cannot be proven rather than implying the data is wrong');

  ok(completeness(0, 0).complete === true, 'a genuinely empty company is complete — zero expected, zero retrieved is a real, provable answer');
  ok(completeness(0, 0).complete !== completeness(null, 0).complete,
    '🔴 and "zero, proven" is NOT the same as "we could not read the count and got nothing" — collapsing them turns a failed read into an empty company');
}

// ══ §E THE STOP CONDITION ═══════════════════════════════════════════════════
{
  ok(pageIsLast(999, 1000) === true, 'a short page is the last page');
  ok(pageIsLast(0, 1000) === true, 'an empty page is the last page');
  ok(pageIsLast(1000, 1000) === false,
    '🔴 A FULL PAGE IS NEVER ASSUMED TO BE THE LAST. Stopping on a full page is how a list of exactly 1000 becomes a list of 1000 out of 4000');
  ok(pageIsLast(127, 1000) === true, "the tail page of a 1127-row list ends the loop");
}

// ══ §E2 THE WALK CEILING — HOW BIG A LIST WE WILL PULL IN ONE GO ════════════
{
  ok(QBO_WALK_CEILING.Invoice === 10_000,
    'the invoice walk stops above 10,000 records — an invoice carries a nested Line[], so a year of a busy nursery is a materially bigger object than a year of its customers');
  ok(ceilingCheck('Invoice', 1_800).allowed === true, 'a normal history walks');
  ok(ceilingCheck('Invoice', 10_000).allowed === true, 'exactly at the ceiling still walks — the ceiling is a limit, not an exclusive bound');

  const tooMany = ceilingCheck('Invoice', 42_000);
  ok(tooMany.allowed === false,
    '🔴 A LIST ABOVE THE CEILING IS REFUSED BEFORE THE WALK, NOT WARNED ABOUT AFTER IT. The count is already in hand at that point, so nothing is downloaded to find out');
  ok(/42,000/.test(tooMany.headline ?? ''),
    'and the refusal QUOTES THE REAL NUMBER — "too many" without the number leaves the operator unable to decide, which is the decision the stop exists to hand back');
  ok(/10,000/.test(tooMany.headline ?? ''), 'and the ceiling it exceeded');

  ok(ceilingCheck('Invoice', null).allowed === true,
    'an UNREADABLE count is allowed past this check — refusing here would report "too many" for a company that might hold three');
  ok(maxPagesFor('Invoice') === 10,
    '🔴 AND THAT IS NOT A HOLE, BECAUSE THE LOOP IS BOUNDED TOO: 10 pages of 1000 holds the invoice ceiling even when no count arrived to compare against');
  ok(maxPagesFor('Item') === QBO_MAX_PAGES && maxPagesFor('Customer') === QBO_MAX_PAGES,
    'the two reads that already shipped keep the page bound they had — this constant does not quietly narrow a live behaviour');
  for (const e of ENTITIES) {
    ok(maxPagesFor(e) >= 1 && maxPagesFor(e) <= QBO_MAX_PAGES, `${e} walks at least one page and never more than the absolute stop`);
  }
}

// ══ §F THE CAPTURE FILENAME — attributable, entity-labelled, safe ═══════════
{
  const at = new Date('2026-08-29T19:04:05.678Z');
  const items = rawCaptureFileName('Item', '9341455222430707', at);
  const custs = rawCaptureFileName('Customer', '9341455222430707', at);
  const invs  = rawCaptureFileName('Invoice', '9341455222430707', at);

  ok(items.startsWith('qbo-items-9341455222430707-'), 'the realm is in the item file name — a capture found later says which company it came from');
  ok(custs.startsWith('qbo-customers-9341455222430707-'), 'and the customer file is named for its entity');
  ok(invs.startsWith('qbo-invoices-9341455222430707-'),
    '🔴 and the invoice file says INVOICES. The name used to be a ternary defaulting to "items", under which this file would have filed a customer\'s billing history as a product catalogue — in a downloads folder, where nobody would look at it twice');
  ok(new Set(ENTITIES.map(e => rawCaptureFileName(e, 'r', at))).size === ENTITIES.length,
    '🔴 EVERY entity produces a DISTINCT file name — swept over the declared list, so a fourth entity cannot silently reuse a third\'s name');
  // 🔴 ONE MAP, TWO CONSUMERS. The client builds `/api/qbo/<route>` from this same constant,
  // because it used to hold its own ternary copy and an invoice read would have hit the ITEM
  // endpoint. If the file word and the route word ever disagree, one of them is a wrong answer.
  ok(ENTITIES.every(e => rawCaptureFileName(e, 'r', at).startsWith(`qbo-${QBO_ROUTE[e]}-`)),
    '🔴 the capture file name IS the route word for every entity — one fact, one map, so adding an entity forces both at once in the compiler (STD-011)');
  ok(new Set(ENTITIES.map(e => QBO_ROUTE[e])).size === ENTITIES.length,
    'and every entity has a DISTINCT route, so no two reads can address the same endpoint');

  ok(items !== custs,
    '🔴 THE FILES CANNOT COLLIDE OR BE CONFUSED. One is a product catalogue; one is ~1,900 real people; one is what those people bought. A person who finds one must be able to tell which they are holding');
  ok(items.endsWith('.json') && custs.endsWith('.json'), 'both are .json — on failure the file holds Intuit\'s verbatim error body, which is JSON too');
  ok(!items.includes(':') && !/[/\\]/.test(items),
    'no colons and no separators — a colon breaks the filename on some filesystems and a slash would let a realm value steer the write somewhere else');
  ok(rawCaptureFileName('Item', 'a/../../etc', at).indexOf('..') === -1,
    '🔴 path segments are stripped from the realm: this value reaches a file name, so it is sanitised rather than trusted');
  ok(rawCaptureFileName('Customer', '', at).includes('unknown-realm'),
    'an empty realm still produces a named file — the capture must happen even when the attribution is unknown, and it says it is unknown');
  ok(items !== rawCaptureFileName('Item', '9341455222430707', new Date('2026-08-29T19:04:06.678Z')),
    'two reads a second apart do not collide — the second capture must never overwrite the first');
}

// ══ §G 401 AND 403 ARE DIFFERENT PROBLEMS ═══════════════════════════════════
{
  ok(classifyFailure(401).points_at === 'G3-token-refresh', 'a 401 points at the token-refresh path (G3)');
  ok(classifyFailure(403).points_at === 'G2-scope', 'a 403 points at the granted scope (G2)');
  ok(classifyFailure(401).points_at !== classifyFailure(403).points_at,
    '🔴 and they are NOT collapsed into one message — Stage 0 named both in advance precisely so the failure would name its own next step');
  ok(classifyFailure(500).points_at === 'unclassified',
    'an unrecognised status says so rather than being forced into one of the two known buckets');
  ok(classifyFailure(500).headline.includes('500'), 'and it quotes the status it actually got');
  ok(/capture file/i.test(classifyFailure(500).headline),
    'the unclassified case points at the file holding the verbatim body — the body is not in the headline');
  for (const s of [401, 403, 500, 429]) {
    ok(classifyFailure(s).headline.length > 0, `status ${s} produces a non-empty headline`);
  }
}

console.log(`\nqboRead: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
