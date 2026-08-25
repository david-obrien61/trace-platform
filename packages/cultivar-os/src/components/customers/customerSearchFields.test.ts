/**
 * ── customerSearchFields — THE ROSTER MUST SEARCH WHAT IT DISPLAYS · 2026-08-25 ──────────────
 *
 * THE DEFECT (measured, recon `f666dbb` Part A1 — quoted, not re-derived):
 *
 *   `Customers.tsx:263` built its search haystack from a hand-written EIGHT-field array —
 *   first_name · last_name · phone · email · address_line1 · city · state · zip — and omitted
 *   `organization_name` and `display_name`. `Customers.tsx:204-207` RENDERS `organization_name`
 *   in the Name cell for `customer_type === 'organization'`.
 *
 *   So the roster searched a NARROWER set than it displayed. Live consequence: `customers` held
 *   two `Diane Foster` rows and searching "foster" returned ONE — the other reachable only by
 *   direct URL. Checkout's own search already did this correctly (`CustomerSearch.tsx:96-97`).
 *
 * 🔴 THE TWO-MATCH CASE (B4 below) IS THE ONE THAT MATTERS MOST AND IT IS NOT ABOUT THIS DEFECT.
 * It asserts that a term matching TWO customers returns BOTH, count exactly 2 — the probe that
 * fails the day anyone "helpfully" adds a dedup, a DISTINCT, or a collapse-by-name to this path.
 * What a duplicate customer IS remains David's ruling; this test only guarantees the list stops
 * hiding one.
 *
 * ── WHY THE FILTER IS RE-EXPRESSED HERE, stated rather than left to be discovered ─────────────
 * The filtering itself lives in the shared grid (`DataSheet.tsx:146-149`) and this build did NOT
 * touch it. There is no React render harness in this repo (E2E is a recorded non-build — RULINGS,
 * 2026-07-30), so the only way to assert a RETURNED SET is to apply DataSheet's predicate over a
 * fixture. `rosterSearch` below is that harness and it quotes the real expression verbatim; it is
 * test scaffolding, NOT a second production implementation. The unit actually under test — and the
 * only thing this build changed — is the FIELD SET feeding it.
 *
 * Run:  node scripts/run-tests.mjs customerSearchFields
 */

import { readFileSync } from 'node:fs';
import {
  CUSTOMER_SEARCH_FIELDS,
  CUSTOMER_SELECT_FULL,
  customerSearchHaystack,
} from './customerFieldRegistry';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// ══ THE HARNESS — DataSheet.tsx:146-149, verbatim ════════════════════════════════════════════
//     const q = search.trim().toLowerCase();
//     let out = rows;
//     if (statusFilter && status !== 'all') out = out.filter(r => statusFilter.get(r) === status);
//     if (q) out = out.filter(r => searchText(r).toLowerCase().includes(q));
//
// The status quick-filter is omitted because it initialises to 'all' (`DataSheet.tsx:104`) and the
// roster's is keyed on `source`, not on anything this build touches.
function rosterSearch<T extends object>(rows: readonly T[], search: string): T[] {
  const q = search.trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter(r => customerSearchHaystack(r).toLowerCase().includes(q));
}

// ══ THE FIXTURE — the measured tenant, reduced to the facts that decide the outcome ═══════════
// Two Diane Fosters with DIFFERENT id and DIFFERENT identity columns (this is the whole defect):
// one a person, one an organization whose name lives in `organization_name`. Three Marcus Webbs
// because the live table holds three. Ids are the real ones where the recon named them.
interface Row {
  id: string;
  first_name: string;
  last_name: string | null;
  organization_name?: string | null;
  display_name?: string | null;
  customer_type?: string | null;
  phone?: string | null;
  email?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

const DIANE_PERSON: Row = {
  id: '0ee368fe-5b2f-4458-a75d-d4498024a605',
  first_name: 'Diane', last_name: 'Foster', customer_type: 'person',
  phone: '(512) 555-0101', email: 'diane@example.com',
  address_line1: '904 Hialeah Circle', city: 'Georgetown', state: 'TX', zip: '78628',
};

// 🔴 THE ROW THE OLD SEARCH COULD NOT SEE. Its name is in `organization_name`; `first_name` holds
// a contact and `last_name` is null. `displayName()` renders "Diane Foster Landscaping" for it.
const DIANE_ORG: Row = {
  id: '194a582c-0000-4000-8000-000000000002',
  first_name: 'Diane', last_name: null, customer_type: 'organization',
  organization_name: 'Diane Foster Landscaping',
  phone: '(512) 555-0102', email: 'ap@dfl.example.com',
  city: 'Leander', state: 'TX', zip: '78641',
};

// A row whose ONLY distinguishing identity is `display_name` — the invoice name.
const INVOICE_NAME_ONLY: Row = {
  id: '3b9a22ba-0000-4000-8000-000000000003',
  first_name: 'Robert', last_name: 'Nunez', customer_type: 'person',
  display_name: 'Nunez Grounds Maintenance LLC',
  phone: '(512) 555-0103', email: 'robert@example.com',
};

const MARCUS_1: Row = { id: '1724c7a6-0000-4000-8000-000000000004', first_name: 'Marcus', last_name: 'Webb', customer_type: 'person', city: 'Cedar Park', state: 'TX' };
const MARCUS_2: Row = { id: '3b9a22ba-0000-4000-8000-000000000005', first_name: 'Marcus', last_name: 'Webb', customer_type: 'person', city: 'Cedar Park', state: 'TX' };
const MARCUS_3: Row = { id: '71bc710d-0000-4000-8000-000000000006', first_name: 'Marcus', last_name: 'Webb', customer_type: 'person', city: 'Leander', state: 'TX' };

// A row with EVERY searchable field absent except the NOT NULL first name — the A9 probe's subject.
const SPARSE: Row = {
  id: '99999999-0000-4000-8000-000000000007',
  first_name: 'Sparse', last_name: null,
  organization_name: null, display_name: null,
  phone: null, email: null, address_line1: null, city: null, state: null, zip: null,
};

const ROWS: Row[] = [DIANE_PERSON, DIANE_ORG, INVOICE_NAME_ONLY, MARCUS_1, MARCUS_2, MARCUS_3, SPARSE];

const ids = (rs: Row[]) => rs.map(r => r.id).sort().join('|');

// ══ A · THE FIELD LIST IS REAL AND IS THE ONE PLACE THE LIST LIVES ═══════════════════════════
// 🔴 THIS IS THE PROBE THAT REPLACES THE `.filter(k => CUSTOMER_FIELDS.some(…))` GUARD.
// `CUSTOMER_SEARCH_COLS` silently DROPS a name that is not a registry field; doing that here would
// reproduce the defect being fixed — a search that quietly narrows with nothing saying so. A typo
// is a RED BUILD instead.
{
  // Derived from the registry's own SELECT string rather than a second hand-written list, so this
  // probe cannot drift from the record the way the thing it guards did.
  const known = new Set(CUSTOMER_SELECT_FULL.split(','));
  const unknown = CUSTOMER_SEARCH_FIELDS.filter(k => !known.has(k));
  ok(unknown.length === 0,
     `A1 every searchable field is a real column on the record — unknown: ${unknown.join(',') || '(none)'}`);
}

ok(CUSTOMER_SEARCH_FIELDS.includes('organization_name'),
   'A2 🔴 organization_name IS searchable — the field the Name cell renders and the old list omitted');
ok(CUSTOMER_SEARCH_FIELDS.includes('display_name'),
   'A3 display_name IS searchable — matches CustomerSearch.tsx:97, which already did');
ok(['first_name', 'last_name', 'phone', 'email', 'address_line1', 'city', 'state', 'zip']
     .every(k => CUSTOMER_SEARCH_FIELDS.includes(k)),
   'A4 NO REGRESSION: all eight fields the old literal covered are still covered');
ok(new Set(CUSTOMER_SEARCH_FIELDS).size === CUSTOMER_SEARCH_FIELDS.length,
   'A5 the list has no duplicate entry');

// ══ B · THE SIX REQUIRED CASES — asserting the RETURNED SET, by id and by count ═══════════════

// B1 — a term matching ONLY organization_name. The defect, head-on.
{
  const hits = rosterSearch(ROWS, 'landscaping');
  ok(hits.length === 1 && hits[0].id === DIANE_ORG.id,
     `B1 🔴 a term matching ONLY organization_name returns that customer — got ${hits.length}: ${ids(hits)}`);
}

// B2 — a term matching ONLY display_name.
{
  const hits = rosterSearch(ROWS, 'grounds maintenance');
  ok(hits.length === 1 && hits[0].id === INVOICE_NAME_ONLY.id,
     `B2 a term matching ONLY display_name returns that customer — got ${hits.length}: ${ids(hits)}`);
}

// B3 — first/last name still work. The regression guard.
{
  const hits = rosterSearch(ROWS, 'webb');
  ok(hits.length === 3 && ids(hits) === ids([MARCUS_1, MARCUS_2, MARCUS_3]),
     `B3 NO REGRESSION: a last-name term still returns every match — got ${hits.length}: ${ids(hits)}`);
  const first = rosterSearch(ROWS, 'robert');
  ok(first.length === 1 && first[0].id === INVOICE_NAME_ONLY.id,
     'B3b NO REGRESSION: a first-name term still matches');
}

// B4 — 🔴 THE DEDUP GUARD. "foster" spans a person row and an organization row: BOTH, count 2.
{
  const hits = rosterSearch(ROWS, 'foster');
  ok(hits.length === 2,
     `B4 🔴 a term matching TWO customers returns BOTH — count must be 2, got ${hits.length}`);
  ok(ids(hits) === ids([DIANE_PERSON, DIANE_ORG]),
     'B4b 🔴 and they are the two DISTINCT rows, by id — no dedup, no DISTINCT, no collapse-by-name');

  // 🔴 B4c — THE PROBE B4 NEEDED AND DID NOT HAVE, added because a planted dedup proved it.
  // The two Diane rows differ in almost every field, so a collapse keyed on the NAME or on the
  // HAYSTACK leaves both standing and B4 passes over a live dedup. `MARCUS_1` and `MARCUS_2` are
  // IDENTICAL in every searchable field and differ only by id — the hardest case for any
  // duplicate-collapse to survive, and the shape the live table actually holds (three Marcus Webb
  // rows, three different customer_ids). If this returns 1, something is collapsing rows.
  const twins = rosterSearch(ROWS, 'cedar park');
  ok(twins.length === 2,
     `B4c 🔴 two rows IDENTICAL in every searchable field, differing only by id, BOTH return — got ${twins.length}`);
  ok(ids(twins) === ids([MARCUS_1, MARCUS_2]),
     'B4d 🔴 …and they are the two distinct ids, not one row counted twice');
}

// B5 — empty search returns EVERY row. The count equals the row set the query loaded, which the
// recon proved is the whole table for this business (`Customers.tsx:117-138` — no DISTINCT, no
// GROUP BY, no limit, no dedup, `business_id` the only predicate).
{
  ok(rosterSearch(ROWS, '').length === ROWS.length,
     `B5 empty search returns every row — ${ROWS.length} of ${ROWS.length}`);
  ok(rosterSearch(ROWS, '   ').length === ROWS.length,
     'B5b a whitespace-only search is an empty search, not a term that matches nothing');
}

// B6 — a term matching nothing: empty, no crash.
{
  const hits = rosterSearch(ROWS, 'zzz-no-such-customer');
  ok(hits.length === 0, `B6 a term matching nothing returns empty — got ${hits.length}`);
  ok(Array.isArray(hits), 'B6b …and returns an array rather than throwing');
}

// ══ C · A9 — AN ABSENCE MUST NOT BECOME A SEARCHABLE FACT ════════════════════════════════════
// 🔴 A haystack built with `.join(' ')` over raw values would put the literal "undefined"/"null"
// into the searched string, so searching "null" would match every row MISSING a value — an absence
// rendered as a fact, and a spectacular way to make this fix worse than the defect.
{
  const hay = customerSearchHaystack(SPARSE);
  ok(hay === 'Sparse', `C1 a row with every optional field absent yields ONLY its real value — got "${hay}"`);
  ok(rosterSearch(ROWS, 'undefined').length === 0, 'C2 🔴 searching "undefined" matches NOTHING');
  ok(rosterSearch(ROWS, 'null').length === 0, 'C3 🔴 searching "null" matches NOTHING');
  ok(customerSearchHaystack({}) === '', 'C4 an empty object yields an empty haystack, not "undefined"');
}
// A blank-but-present string must not contribute either — otherwise a one-space query matches it.
ok(customerSearchHaystack({ first_name: 'A', last_name: '   ' }) === 'A',
   'C5 a whitespace-only stored value contributes nothing');
// Non-string values are skipped rather than coerced — every searchable field is `kind: 'text'`.
ok(customerSearchHaystack({ first_name: 'A', phone: 5125550101 as unknown as string }) === 'A',
   'C6 a non-string value is skipped, never coerced into the haystack');

// ══ D · NEGATIVE CONTROLS — the harness itself can fail ══════════════════════════════════════
// A test whose helper always returns everything would pass B1/B2/B3 and prove nothing.
ok(rosterSearch(ROWS, 'georgetown').length === 1,
   'D1 negative control: the harness DOES narrow — an address term matches exactly one row');
ok(rosterSearch(ROWS, 'diane').length === 2,
   'D2 negative control: a first-name term shared by two rows returns exactly those two');
{
  // The old eight-field list, reconstructed, MUST fail on B1 — otherwise this suite is not
  // testing the change. This is the red-first case pinned in the file rather than run by hand.
  const OLD = ['first_name', 'last_name', 'phone', 'email', 'address_line1', 'city', 'state', 'zip'];
  const oldHay = (row: object) => {
    const r = row as Record<string, unknown>;
    return OLD.map(k => r[k]).filter(v => typeof v === 'string' && v.trim() !== '').join(' ');
  };
  const oldHits = ROWS.filter(r => oldHay(r).toLowerCase().includes('landscaping'));
  ok(oldHits.length === 0,
     'D3 🔴 RED-FIRST, PINNED: the OLD eight-field list finds the organization row ZERO times — this is the defect, and B1 is its inverse');
  const oldFoster = ROWS.filter(r => oldHay(r).toLowerCase().includes('foster'));
  ok(oldFoster.length === 1,
     'D4 🔴 RED-FIRST, PINNED: under the OLD list "foster" returned ONE of the two — David\'s measured symptom, reproduced');
}

// ══ E · THE ROSTER IS ACTUALLY WIRED TO THIS LIST ════════════════════════════════════════════
// 🔴 WITHOUT THIS, THE WHOLE SUITE IS A CLAIM ABOUT AN UNUSED EXPORT. Sections A–D prove the field
// set and the haystack are correct; NONE of them can see whether `Customers.tsx` calls them, so
// reverting that one prop to the old inline literal would leave 25 assertions green over a
// restored defect. Read against the REAL SOURCE (STD-024), not against a copy.
//
// The runner executes with `cwd: ROOT` (`scripts/run-tests.mjs:60`), so this path resolves.
// An unreadable file is a HARD FAILURE, never a skip — a probe that finds nothing and reports
// green is the false-green class this repo has paid for before.
{
  const ROSTER = 'packages/cultivar-os/src/pages/Customers.tsx';
  let src = '';
  let readErr = '';
  try { src = readFileSync(ROSTER, 'utf8'); }
  catch (e) { readErr = (e as Error).message; }

  ok(src.length > 0, `E1 the roster source is readable — ${readErr || 'ok'}`);
  ok(src.includes('customerSearchHaystack'),
     'E2 🔴 the roster PASSES the shared haystack to <DataSheet> — not a re-inlined literal');
  ok(/searchText=\{customerSearchHaystack\}/.test(src),
     'E3 🔴 …and passes it as `searchText` specifically, which is the prop DataSheet filters on');
  // The exact literal the defect lived in. Its return is the regression this build exists to stop.
  ok(!/searchText=\{r =>/.test(src),
     'E4 🔴 RED-FIRST TARGET: no inline `searchText={r => …}` array has come back');
}

console.log(`\ncustomerSearchFields: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
