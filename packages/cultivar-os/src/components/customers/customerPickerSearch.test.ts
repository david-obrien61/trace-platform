/**
 * ── customerPickerSearch — THE ORDER-START PICKER SEARCHES THE SAME FIELDS AS THE ROSTER · 2026-08-25
 *
 * THE DEFECT (measured live by David on `8b26348`, quoted rather than re-derived):
 *
 *   roster search      "cedar" → TWO rows: Cedar Park HOA and Diane Foster   ✅
 *   order-start picker "cedar" → ONE row:  Cedar Park HOA only               🔴
 *
 * 🔴 THE PROMPT'S PREMISE WAS HALF WRONG AND THE CORRECTION IS THE USEFUL PART. It read
 * *"Diane matches only via `organization_name`"* — but `CustomerSearch.tsx` ALREADY matched
 * `organization_name` (and `display_name`) before this build. Its literal was SIX fields:
 *
 *   first_name · last_name · organization_name · display_name · email · phone
 *
 * and `CUSTOMER_SEARCH_FIELDS` is TEN. **The four it lacked are the legacy address columns —
 * `address_line1` · `city` · `state` · `zip` — so Diane was missed on an ADDRESS field, not on a
 * name field.** That matters twice: it is why the fixture below gives Diane `city: 'Cedar Park'`
 * and no "cedar" anywhere in her name, and it is why removing `organization_name` from the list
 * does NOT reproduce the measured symptom (probe RED-2 records exactly that).
 *
 * ── WHAT IS SHARED, AND WHAT IS DELIBERATELY NOT ─────────────────────────────────────────────
 * ONLY the field set. The picker composes a PostgREST `.or()` filter string the SERVER runs; the
 * roster filters a client-side haystack over rows already fetched. Different execution layer,
 * different output type, different failure modes. Section D below PINS the consequences of that —
 * the cases where the two searches genuinely CANNOT return the same set — rather than leaving them
 * to be discovered as bugs.
 *
 * ── WHY THE PICKER'S FILTER IS RE-EXPRESSED HERE, stated rather than left to be found ────────
 * There is no React render harness in this repo and no Postgres on this machine (E2E is a recorded
 * non-build — RULINGS, 2026-07-30), so the only way to assert a RETURNED SET is to compose the
 * `.or()` exactly as the component does, PARSE IT BACK, and evaluate `ilike` semantics over a
 * fixture. `pickerOrString` / `pickerSearch` below are that harness: they quote the real expressions
 * verbatim and are test scaffolding, NOT a second production implementation. **The parse-back is the
 * point** — a composition probe that merely re-joins the same strings proves only that `.join()`
 * works. Section E reads `CustomerSearch.tsx` as SOURCE so that reverting the one changed line is a
 * RED BUILD rather than 60 green assertions over a restored defect.
 *
 * Run:  node scripts/run-tests.mjs customerPickerSearch
 */

import { readFileSync } from 'node:fs';

/** 🔴 SOURCE WITH COMMENTS REMOVED. Sections E/F/G assert what the CODE does, and a probe a comment
 *  can satisfy is not a probe — proven on 2026-08-25 when commenting out one line in a sibling file
 *  left an entire suite green over the build's headline defect. Prose claims use `readFileSync`
 *  directly; behaviour claims use this. */
function codeOf(rel: string): string {
  // 🔴 TWO PASSES, IN THIS ORDER, AND BOTH HALVES WERE LEARNED FROM A PROBE THAT WENT WRONG:
  //  ① LINE comments (`//`) first — because a line comment can legally CONTAIN `/*`.
  //    `CustomerSearch.tsx:3` reads "the customer step of /checkout/* opens on a SEARCH", and a
  //    block-comment regex run first reads that as an OPENER and swallows the imports with it.
  //  ② BLOCK comments second, which removes each `/** … */` whole, body and all.
  // ⚠️ AND NOT a "drop lines starting with *" rule, which looks equivalent and is not: it deletes
  //    a JSDoc's CLOSING ` */` line, leaving the opener dangling and eating the code below it.
  //    Measured on this very file — 13 openers, 8 closers. Blocks are removed as blocks.
  // Each block is replaced by its own newline count so reported positions do not shift.
  return readFileSync(rel, 'utf8')
    .split('\n')
    .map(l => (l.trimStart().startsWith('//') ? '' : l))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, m => '\n'.repeat((m.match(/\n/g) ?? []).length));
}
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

// ══ THE HARNESS ══════════════════════════════════════════════════════════════════════════════
// CustomerSearch.tsx — verbatim. The ONLY sanitisation the query gets.
//     const safe = q.replace(/[,%()]/g, ' ');
// 🔴 UPDATED 2026-08-25 (R-19): this quoted `[%,]` — TWO characters — until the two order-door
// searches were unified onto this component and the SAFER of the two regexes won. §E asserts the
// source still matches, because a harness quoting a rule the code no longer has is the worst kind
// of green: every escaping probe below would keep passing while describing something that is gone.
function likeOf(q: string): string { return `%${q.replace(/[,%()]/g, ' ')}%`; }

// CustomerSearch.tsx:107 + :121 — verbatim. This is the line this build changed.
//     const parts = CUSTOMER_SEARCH_FIELDS.map(f => `${f}.ilike.${like}`);
//     .or(parts.join(','))
function pickerOrString(q: string, fields: readonly string[] = CUSTOMER_SEARCH_FIELDS): string {
  const like = likeOf(q);
  return fields.map(f => `${f}.ilike.${like}`).join(',');
}

/** A PostgREST `or=(…)` parser. Splitting on ',' is EXACTLY what the server does, which is why a
 *  comma surviving into a value would be a syntax break rather than a wider match. */
function parseOr(filter: string): { field: string; op: string; pattern: string }[] {
  return filter.split(',').map(term => {
    const m = /^([^.]+)\.([^.]+)\.([\s\S]*)$/.exec(term);
    if (!m) throw new Error(`unparseable or() term: ${term}`);
    return { field: m[1], op: m[2], pattern: m[3] };
  });
}

/** SQL `ILIKE`: `%` = any run, `_` = one character, case-insensitive, everything else literal.
 *  🔴 A NON-STRING MATCHES NOTHING — a NULL column is not the string "null" (A9 on the read side). */
function ilikeMatch(value: unknown, pattern: string): boolean {
  if (typeof value !== 'string') return false;
  const rx = [...pattern].map(ch => {
    if (ch === '%') return '.*';
    if (ch === '_') return '.';
    return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  return new RegExp(`^${rx}$`, 'i').test(value);
}

/** The picker's returned SET: compose → parse back → evaluate → `.limit(25)` (CustomerSearch.tsx:122).
 *  Order is fixture order because the query carries no `.order()` — stated, not assumed. */
function pickerSearch<T extends object>(rows: readonly T[], q: string,
                                        fields: readonly string[] = CUSTOMER_SEARCH_FIELDS): T[] {
  if (!q.trim()) return [];                              // CustomerSearch.tsx:99 — empty query is idle
  const terms = parseOr(pickerOrString(q, fields));
  const hit = (r: T) => terms.some(t => ilikeMatch((r as Record<string, unknown>)[t.field], t.pattern));
  return rows.filter(hit).slice(0, 25);
}

// DataSheet.tsx:146-149 — verbatim, same harness as `customerSearchFields.test.ts`.
function rosterSearch<T extends object>(rows: readonly T[], search: string): T[] {
  const q = search.trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter(r => customerSearchHaystack(r).toLowerCase().includes(q));
}

// The SIX-field literal this build removed — kept so RED-1 can be run without editing source.
const OLD_PICKER_FIELDS = ['first_name', 'last_name', 'organization_name', 'display_name', 'email', 'phone'];

// ══ THE FIXTURE — David's measurement, reduced to the facts that decide the outcome ═══════════
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

// The row BOTH searches always found. "cedar" is in `organization_name`, which the OLD picker read.
const CEDAR_HOA: Row = {
  id: 'c0000000-0000-4000-8000-00000000ce01',
  first_name: 'Marcy', last_name: 'Klein', customer_type: 'organization',
  organization_name: 'Cedar Park HOA',
  // ⚠️ the email deliberately carries NO "hoa": C8b below proves `organization_name` SPECIFICALLY,
  // and it can only do that if the term appears in exactly one field of this row.
  phone: '(512) 555-0140', email: 'ap@cpassoc.example.com',
  address_line1: '1 Discovery Blvd', city: 'Cedar Park', state: 'TX', zip: '78613',
};

// 🔴 THE ROW THE PICKER COULD NOT SEE. "cedar" appears in `city` and NOWHERE in any name field —
// which is the whole correction to the prompt's premise.
const DIANE: Row = {
  id: '0ee368fe-5b2f-4458-a75d-d4498024a605',
  first_name: 'Diane', last_name: 'Foster', customer_type: 'person',
  phone: '(512) 555-0101', email: 'diane@example.com',
  address_line1: '904 Hialeah Circle', city: 'Cedar Park', state: 'TX', zip: '78613',
};

// Identity lives ONLY in `display_name` (the invoice name) — the picker has always matched it.
const NUNEZ: Row = {
  id: '3b9a22ba-0000-4000-8000-000000000003',
  first_name: 'Robert', last_name: 'Nunez', customer_type: 'person',
  display_name: 'Nunez Grounds Maintenance LLC',
  phone: '(512) 555-0103', email: 'robert@example.com',
  address_line1: '77 Ranch Rd', city: 'Leander', state: 'TX', zip: '78641',
};

// Every searchable field absent except the NOT NULL first name — the A9 subject.
const SPARSE: Row = {
  id: '99999999-0000-4000-8000-000000000007',
  first_name: 'Sparse', last_name: null,
  organization_name: null, display_name: null,
  phone: null, email: null, address_line1: null, city: null, state: null, zip: null,
};

// Two rows identical in every searchable field, differing only by id — the shape a dedup survives.
const TWIN_A: Row = { id: 'aaaa0000-0000-4000-8000-00000000000a', first_name: 'Marcus', last_name: 'Webb', customer_type: 'person', city: 'Leander', state: 'TX' };
const TWIN_B: Row = { id: 'bbbb0000-0000-4000-8000-00000000000b', first_name: 'Marcus', last_name: 'Webb', customer_type: 'person', city: 'Leander', state: 'TX' };

const ROWS: Row[] = [CEDAR_HOA, DIANE, NUNEZ, SPARSE, TWIN_A, TWIN_B];
const ids = (rs: Row[]) => rs.map(r => r.id).sort().join('|');

// ══ A · THE COMPOSITION IS DERIVED FROM THE REGISTRY AND IS SYNTACTICALLY SOUND (B2) ══════════
{
  const filter = pickerOrString('cedar');
  const terms = parseOr(filter);

  ok(terms.length === CUSTOMER_SEARCH_FIELDS.length,
     `A1 the .or() parses back to exactly one term per registry field — ${terms.length} vs ${CUSTOMER_SEARCH_FIELDS.length}`);
  ok(terms.every(t => t.op === 'ilike'),
     'A2 every term is ILIKE — not eq, not fts; a non-ilike term would silently narrow the field to exact matches');
  ok(terms.every(t => t.pattern === '%cedar%'),
     'A3 every term carries the SAME wrapped pattern — a field left unwrapped would match only whole-cell equality');

  const composed = terms.map(t => t.field);
  ok(composed.join(',') === CUSTOMER_SEARCH_FIELDS.join(','),
     'A4 🔴 the field names, in order, ARE the registry list — not a copy that can drift from it');
  ok(new Set(composed).size === composed.length,
     'A5 no field is emitted twice — a duplicate term is dead weight the server still evaluates');

  // The integrity check the list has no `.filter(…)` guard for (see the registry note).
  const known = new Set(CUSTOMER_SELECT_FULL.split(','));
  const unknown = CUSTOMER_SEARCH_FIELDS.filter(k => !known.has(k));
  ok(unknown.length === 0,
     `A6 every searchable field is a real column — a name the DB does not have makes the whole .or() a 42703, i.e. NO search at all. unknown: ${unknown.join(',') || '(none)'}`);

  // 🔴 WHY THE COMPOSITION CANNOT BREAK AS THE LIST GROWS: the only per-field input is the NAME, and
  // every name is a bare identifier. A name containing '.' or ',' would break the parse above.
  ok(CUSTOMER_SEARCH_FIELDS.every(f => /^[a-z][a-z0-9_]*$/.test(f)),
     'A7 🔴 every field name is a bare snake_case identifier — the property that makes term-splitting safe');

  // Growth probe: a synthetic eleventh field must add exactly one well-formed term and nothing else.
  const grown = parseOr(pickerOrString('cedar', [...CUSTOMER_SEARCH_FIELDS, 'notes']));
  ok(grown.length === CUSTOMER_SEARCH_FIELDS.length + 1 && grown[grown.length - 1].field === 'notes'
     && grown[grown.length - 1].op === 'ilike',
     'A8 🔴 adding a field to the list adds exactly ONE ilike term — no syntax break if the list grows');

  ok(parseOr(pickerOrString('cedar', ['first_name'])).length === 1,
     'A9 a one-field list composes a single term with no trailing separator');
}

// ══ B · ESCAPING — THE QUERY CANNOT INVENT A TERM OR A WILDCARD (B2) ══════════════════════════
{
  // A comma would be read by the server as a TERM SEPARATOR. It is replaced with a space, so a
  // hostile query cannot append a condition of its own.
  const hostile = 'x,phone.ilike.%25y';
  const terms = parseOr(pickerOrString(hostile));
  ok(terms.length === CUSTOMER_SEARCH_FIELDS.length,
     `B1 🔴 a comma in the query cannot ADD a term — ${terms.length} terms, expected ${CUSTOMER_SEARCH_FIELDS.length}`);
  ok(terms.every(t => (CUSTOMER_SEARCH_FIELDS as readonly string[]).includes(t.field)),
     'B2 …and every field searched is still one of ours — no injected column name');
  ok(terms.every(t => !t.pattern.slice(1, -1).includes('%')),
     'B3 🔴 a % in the query cannot become a WILDCARD — it is stripped, so "%" searches for nothing broader');
  ok(likeOf('a,b') === '%a b%' && likeOf('a%b') === '%a b%',
     'B4 the sanitiser replaces both reserved characters with a SPACE (it does not delete them, which would join two words)');

  // ✅ RESOLVED 2026-08-25 (tech-debt #117). This probe used to PIN the opposite — that parentheses
  // survived into the filter value here while `ScanOrder` stripped them — and it named the reason it
  // was pinned rather than fixed: it changes what the search DOES, which was outside that build's
  // scope bar. R-19 unified the two searches, so one regex had to win, and it had to be the SAFER
  // one: `(` and `)` are PostgREST's own grouping syntax inside `.or(...)`, so a pasted
  // `(512) 555-0101` closed the group early and the WHOLE filter failed to parse.
  ok(likeOf('(512) 555-0101') === '% 512  555-0101%',
     'B5 ✅ RESOLVED (#117): parentheses are stripped to spaces — a pasted phone cannot break the .or() parse');
  ok(!likeOf('(a)').includes('(') && !likeOf('(a)').includes(')'),
     'B5b 🔴 …and NEITHER paren can reach the filter value, in either position — the property the parse depends on');
  ok(pickerOrString('a b').includes('first_name.ilike.%a b%'),
     'B6 a space inside the query is preserved — it is not a separator');
}

// ══ C · THE FIVE CASES THE BUILD MUST PROVE ══════════════════════════════════════════════════
{
  // ① "cedar" → BOTH, count 2, two distinct ids.
  const cedar = pickerSearch(ROWS, 'cedar');
  ok(cedar.length === 2, `C1 🔴 THE MEASURED CASE: "cedar" returns TWO rows — got ${cedar.length}`);
  ok(ids(cedar) === ids([CEDAR_HOA, DIANE]),
     'C2 🔴 …and they are Cedar Park HOA AND Diane Foster — the row that was unfindable is now found');
  ok(new Set(cedar.map(r => r.id)).size === 2,
     'C3 …with two DISTINCT ids: no collapse, no dedup, no DISTINCT on this path');
  ok(cedar.some(r => r.id === DIANE.id),
     'C4 🔴 the specific row the OLD six-field list missed is in the set (it matches on `city` alone)');

  // ② a term matching only first/last → no regression.
  ok(ids(pickerSearch(ROWS, 'klein')) === ids([CEDAR_HOA]),
     'C5 a LAST-name-only term still returns its row — the widening did not disturb the old fields');
  ok(ids(pickerSearch(ROWS, 'sparse')) === ids([SPARSE]),
     'C6 a FIRST-name-only term still returns its row');
  ok(ids(pickerSearch(ROWS, 'diane')) === ids([DIANE]),
     'C7 a first name that is NOT also an address token returns exactly one row');

  // ③ a term matching only display_name → returned. And its mirror for organization_name.
  //
  // 🔴 `fieldsMatching` is DERIVED from the fixture rather than asserted by hand, because the
  // claim "this probe proves THAT field" is only true while the term is unique to it — and a fixture
  // edit can quietly make it false. This was found by a red-first run that FAILED TO FAIL: removing
  // `organization_name` from the registry left the whole suite green, because "cedar" also matches
  // `city` and the then-current fixture had "hoa" in the email as well. The probe was strengthened
  // before the run was accepted.
  // `object`, not `Row` — the same reason `customerSearchHaystack` takes one: the cast to a keyed
  // record is only legal from a type with no declared shape, and the helper cares about keys alone.
  const fieldsMatching = (row: object, term: string) =>
    CUSTOMER_SEARCH_FIELDS.filter(f => {
      const v = (row as Record<string, unknown>)[f];
      return typeof v === 'string' && v.toLowerCase().includes(term.toLowerCase());
    });

  ok(ids(pickerSearch(ROWS, 'grounds')) === ids([NUNEZ]),
     'C8 a `display_name`-only term is returned — the invoice name is searchable');
  ok(fieldsMatching(NUNEZ, 'grounds').join(',') === 'display_name',
     `C9 …and "grounds" is in EXACTLY ONE field of that row, so C8 proves \`display_name\` specifically — got "${fieldsMatching(NUNEZ, 'grounds').join(',')}"`);
  ok(ids(pickerSearch(ROWS, 'hoa')) === ids([CEDAR_HOA]),
     'C8b 🔴 an `organization_name`-only term is returned — the field the prompt named, proven on its own');
  ok(fieldsMatching(CEDAR_HOA, 'hoa').join(',') === 'organization_name',
     `C9b …and "hoa" is in EXACTLY ONE field of that row — got "${fieldsMatching(CEDAR_HOA, 'hoa').join(',')}"`);
  ok(fieldsMatching(DIANE, 'cedar').join(',') === 'city',
     `C9c 🔴 THE MEASUREMENT'S OWN MECHANISM, derived not claimed: "cedar" reaches Diane through \`city\` and NOTHING else — got "${fieldsMatching(DIANE, 'cedar').join(',')}"`);

  // ④ a term matching nothing → empty, no throw.
  let threw = '';
  let none: Row[] = [];
  try { none = pickerSearch(ROWS, 'zzzz-no-such-customer'); } catch (e) { threw = (e as Error).message; }
  ok(threw === '', `C10 a no-match term does not throw — ${threw || 'ok'}`);
  ok(none.length === 0, 'C11 …and returns an EMPTY set, not the whole table');

  // A9 on the read side: a null column is not the string "null"/"undefined".
  ok(pickerSearch(ROWS, 'null').length === 0,
     'C12 🔴 A9: searching "null" matches NOTHING — an absent value never renders as a present one');
  ok(pickerSearch(ROWS, 'undefined').length === 0,
     'C13 🔴 A9: nor does "undefined" — the failure mode a naive string-concat haystack produces');

  // A dedup planted anywhere on this path must fire here.
  const webb = pickerSearch(ROWS, 'webb');
  ok(webb.length === 2 && new Set(webb.map(r => r.id)).size === 2,
     'C14 🔴 two rows IDENTICAL in every searchable field and differing only by id BOTH return — the probe a name-keyed dedup cannot pass');
}

// ══ D · THE RULE DAVID STATED — THE SAME TERM, THE SAME ID SET ═══════════════════════════════
// 🔴 THIS IS THE SECTION THAT MATTERS. It also states, rather than hides, the three cases where the
// two searches CANNOT agree — because they are different mechanisms, and a suite that quietly
// avoided those terms would be asserting a guarantee the platform does not make.
{
  const SINGLE_TOKEN_TERMS = [
    'cedar', 'foster', 'diane', 'klein', 'grounds', 'webb', 'leander', 'tx', '78613',
    'hialeah', 'example.com', 'sparse', 'zzzz', '555', 'HOA', 'CEDAR',
  ];
  let agreed = 0;
  for (const t of SINGLE_TOKEN_TERMS) {
    const a = ids(pickerSearch(ROWS, t));
    const b = ids(rosterSearch(ROWS, t));
    ok(a === b, `D1 "${t}" → picker and roster return the SAME id set (picker=${a || '∅'} roster=${b || '∅'})`);
    if (a === b) agreed++;
  }
  ok(agreed === SINGLE_TOKEN_TERMS.length,
     `D2 🔴 ALL ${SINGLE_TOKEN_TERMS.length} single-token terms agree — the rule, asserted over a battery rather than one example`);

  // The picker's field set is a SUBSET of the roster's by construction (they are the same list), so
  // the picker can never return a row the roster does not.
  for (const t of SINGLE_TOKEN_TERMS) {
    const b = new Set(rosterSearch(ROWS, t).map(r => r.id));
    ok(pickerSearch(ROWS, t).every(r => b.has(r.id)),
       `D3 "${t}" — every picker hit is also a roster hit (the containment direction, checked separately from equality)`);
  }

  // ── KNOWN, NAMED DIVERGENCES — pinned so they are decisions, not surprises ──────────────────
  // ① MULTI-WORD ACROSS TWO COLUMNS. The roster joins the fields into ONE string and runs
  //    `.includes()`, so "diane foster" is contiguous there. No single `ilike` can span two columns.
  ok(rosterSearch(ROWS, 'diane foster').length === 1,
     'D4 ⚠️ the ROSTER matches a term spanning two columns ("diane foster") — its haystack is joined');
  ok(pickerSearch(ROWS, 'diane foster').length === 0,
     'D5 🔴 ⚠️ the PICKER cannot, and this is STRUCTURAL, not a missing field — one ilike reads one column');

  // ② THE SANITISER. A `%` or `,` is turned into a SPACE for the picker and stays literal for the
  //    roster, so the picker can find MORE than the roster for such a query. Measured, not assumed:
  //    "Cedar%Park" becomes the pattern `%Cedar Park%` and matches two rows on `city`, while the
  //    roster looks for the literal substring "cedar%park" and finds none.
  ok(rosterSearch(ROWS, 'Cedar%Park').length === 0 && pickerSearch(ROWS, 'Cedar%Park').length === 2,
     `D6 ⚠️ the sanitiser makes the two disagree on a query containing % or , (roster ${rosterSearch(ROWS, 'Cedar%Park').length}, picker ${pickerSearch(ROWS, 'Cedar%Park').length})`);

  // ③ `_` IS A SQL WILDCARD. Faithful to Postgres; the roster treats it literally.
  ok(pickerSearch(ROWS, 'dian_').length === 1 && rosterSearch(ROWS, 'dian_').length === 0,
     'D7 ⚠️ `_` is a single-character wildcard to ILIKE and a literal to the roster');

  // ④ `.limit(25)` — UNCHANGED BY THIS BUILD and the reason the id-set rule has a ceiling.
  const MANY: Row[] = Array.from({ length: 30 }, (_, i) => ({
    id: `dddd0000-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`,
    first_name: 'Bulk', last_name: `Row${i}`, customer_type: 'person', city: 'Leander', state: 'TX',
  }));
  ok(pickerSearch(MANY, 'bulk').length === 25,
     'D8 🔴 ⚠️ the picker TRUNCATES at 25 (CustomerSearch.tsx:122, untouched by this build)');
  ok(rosterSearch(MANY, 'bulk').length === 30,
     'D9 ⚠️ …while the roster filters everything it fetched — so the id-set rule holds BELOW 25 matches and not above');
}

// ══ RED-1/RED-2 · WHAT THE OLD LIST DID, ASSERTED RATHER THAN REMEMBERED ═════════════════════
// These run the harness over the SIX-field literal this build removed. They are the regression the
// build exists to stop, and they double as a permanent record of what was actually wrong.
{
  const old = pickerSearch(ROWS, 'cedar', OLD_PICKER_FIELDS);
  ok(old.length === 1 && old[0].id === CEDAR_HOA.id,
     `RED-1 🔴 the OLD six-field list returns ONE row for "cedar" — David's measurement, reproduced exactly (got ${old.length})`);
  ok(!old.some(r => r.id === DIANE.id),
     'RED-2 🔴 …and the row it misses is Diane, on `city` — NOT on `organization_name`, which the old list already had');
  ok(OLD_PICKER_FIELDS.includes('organization_name') && OLD_PICKER_FIELDS.includes('display_name'),
     'RED-3 🔴 the correction to the prompt\'s premise, asserted: the old list ALREADY held organization_name and display_name');
  const missing = CUSTOMER_SEARCH_FIELDS.filter(f => !OLD_PICKER_FIELDS.includes(f));
  ok(missing.join(',') === 'address_line1,city,state,zip',
     `RED-4 🔴 the exact delta this build closed is the four legacy address columns — got "${missing.join(',')}"`);
}

// ══ E · THE PICKER IS ACTUALLY WIRED TO THE LIST ═════════════════════════════════════════════
// 🔴 WITHOUT THIS, EVERY ASSERTION ABOVE IS A CLAIM ABOUT AN EXPORT NOBODY CALLS. Sections A–D can
// see the list and the semantics; NONE of them can see whether `CustomerSearch.tsx` uses it, so
// re-inlining the six-field literal would leave the suite green over a restored defect. Read against
// the REAL SOURCE (STD-024). An unreadable file is a HARD FAILURE, never a skip.
{
  const PICKER = 'packages/cultivar-os/src/components/customers/CustomerSearch.tsx';
  let src = '', readErr = '';
  try { src = codeOf(PICKER); } catch (e) { readErr = (e as Error).message; }

  ok(src.length > 0, `E1 the picker source is readable — ${readErr || 'ok'}`);
  ok(/import\s*\{[^}]*CUSTOMER_SEARCH_FIELDS[^}]*\}\s*from\s*'\.\/customerFieldRegistry'/.test(src),
     'E2 🔴 it IMPORTS the registry list — not a local copy of it');
  ok(/const parts = CUSTOMER_SEARCH_FIELDS\.map\(f => `\$\{f\}\.ilike\.\$\{like\}`\)/.test(src),
     'E3 🔴 …and composes the .or() terms BY MAPPING it — the exact expression this harness quotes');
  // The literal the defect lived in. Its return is the regression this section exists to stop.
  ok(!/`first_name\.ilike\./.test(src),
     'E4 🔴 RED-FIRST TARGET: no hand-written `first_name.ilike.` term has come back');
  ok(!/`organization_name\.ilike\./.test(src) && !/`city\.ilike\./.test(src),
     'E5 🔴 …nor any other hand-written per-field term — the list lives in ONE file');
  ok(/\.or\(parts\.join\(','\)\)/.test(src),
     'E6 the composed parts are what is actually sent as the .or() filter');
  // The VALUE is unchanged at 25; it is now named ONCE (`const PAGE = 25`) because B4's notice and
  // the query must not be able to disagree about it. Assert BOTH, so "the limit is 25" stays a fact
  // about the code rather than about a literal that happened to sit on one line.
  ok(/const PAGE = 25;/.test(src) && /\.limit\(PAGE\)/.test(src),
     'E7 the page size is UNCHANGED at 25 and is named once — the query and B4\'s notice read the same constant (D8 depends on the value)');
  ok(/replace\(\/\[,%\(\)\]\/g, ' '\)/.test(src),
     'E9 🔴 the source sanitiser is EXACTLY what `likeOf` above quotes — without this, every §B escaping probe is green over a rule the code no longer has');
  // Anchored on the SEARCH's composition, not on the substring — the RLS permission probe in the
  // same file also carries `count: 'exact'`, and red-first proved a bare substring cannot tell them
  // apart (it stayed green over a deleted count).
  ok(/\.select\(cols, \{ count: 'exact' \}\)/.test(src),
     'E10 🔴 B4: the SEARCH query asks the server for the exact match count, so "25 of 34" is measured rather than inferred');
  ok(/searchable: CUSTOMER_SEARCH_FIELDS\.join\(','\)/.test(src),
     'E8 STD-003: the [TRACE:customers] emit reports the field set it actually searched, so GATE 0 is readable from the console');
}

// ══ F · THE THIRD SEARCH IS GONE — THE PROBE THAT PREDICTED ITS OWN OBSOLESCENCE ═════════════
// 🔴 THIS SECTION IS THE SELF-CLEARING PROPERTY ACTUALLY PAYING OUT, so it is rewritten rather than
// deleted. On 2026-08-25 (4) F2/F3 asserted that `ScanOrder.tsx` STILL had a two-field search of its
// own (tech-debt #116) and said in their own message: *"when that stops being true, F2 fails and the
// registry note must be corrected."* R-19's build repointed that door, both probes went RED exactly
// as written, and the note was corrected in the same pass. **A note nothing reads is a note that
// rots (#73); this one failed the build instead — which is the whole argument for writing the
// KNOWN-AND-UNFIXED state as an assertion rather than as a comment.**
// The probes now assert the NEW state, in the same both-directions shape: the old search must be
// ABSENT, and the shared component must be PRESENT.
{
  const SCAN = 'packages/cultivar-os/src/pages/ScanOrder.tsx';
  let src = '', readErr = '';
  try { src = codeOf(SCAN); } catch (e) { readErr = (e as Error).message; }

  ok(src.length > 0, `F1 the scan door's source is readable — ${readErr || 'ok'}`);
  ok(!/first_name\.ilike\./.test(src) && !/last_name\.ilike\./.test(src),
     'F2 ✅ RESOLVED (tech-debt #116): ScanOrder has NO customer .ilike of its own. Re-inlining one is a RED BUILD');
  ok(/<CustomerSearch\b/.test(src),
     'F3 ✅ …because it MOUNTS the shared component instead — one search, both order doors');
  ok(!/'id,first_name,last_name,phone,email,address_line1/.test(src),
     'F4 ✅ and its hand-written 14-column select literal is gone with it (A4/E6)');
  // #117 — the sanitiser split — is resolved by that same mount, toward the SAFER regex.
  ok(!/replace\(\/\[,%\(\)\]\/g/.test(src),
     'F5 ✅ RESOLVED (tech-debt #117): the scan door no longer has a sanitiser of its own; the surviving one strips , % ( ) — see B5');
}

// ══ G · THE PASTED PHONE — THE CASE THE OLD CODE NAMED AS A LIMITATION AND NOW FINDS ═════════
// 🔴 THE SCENE: a cashier copies `(512) 555-0101` off an email and pastes it into the box. Before
// R-19 that failed TWICE OVER — the parens broke the `.or()` parse outright, and even with them
// stripped the sanitised ` 512  555-0101` does not `ilike`-match the stored `(512) 555-0101`,
// because the separators differ. The old code KNEW: its comment said the digit re-match "cannot
// FIND a differently-formatted number the ilike missed", and filed it. Naming a limitation is not
// discharging it.
//
// THE FIX, quoted from CustomerSearch.tsx and re-expressed here the same way `pickerOrString` is:
//     parts.push(`phone.ilike.%${d.slice(0,3)}%${d.slice(3,6)}%${d.slice(6)}%`)
// The separators become WILDCARDS. This is the one place a `%` is legitimately a wildcard, because
// it is built from digits we extracted, never from anything the user typed — §B still holds.
{
  /** `phoneMatchKey` VERBATIM (`packages/shared/src/utils/normalizePhone.ts:30-34`): under 7 digits
   *  is an ABSENT key, never a loose one; otherwise the LAST TEN, so a leading 1/+1 country code
   *  drops off. Re-expressed rather than imported for the same reason the rest of this harness is —
   *  and G10 asserts the SOURCE still calls the real function, so the two cannot drift. */
  const digitsOf = (q: string): string | null => {
    const d = q.replace(/\D/g, '');
    return d.length < 7 ? null : d.slice(-10);
  };
  const phoneTerm = (q: string): string | null => {
    const d = digitsOf(q);
    return d && d.length === 10 ? `phone.ilike.%${d.slice(0, 3)}%${d.slice(3, 6)}%${d.slice(6)}%` : null;
  };
  /** Evaluate ONE ilike term against one stored value (the same semantics parseOr/ilike use). */
  const termMatches = (term: string, stored: string | null): boolean => {
    const pattern = term.slice(term.indexOf('.ilike.') + 7);
    const rx = new RegExp('^' + pattern.split('%').map(seg =>
      seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i');
    return typeof stored === 'string' && rx.test(stored);
  };

  const t = phoneTerm('(512) 555-0101');
  ok(t === 'phone.ilike.%512%555%0101%',
     `G1 🔴 a pasted phone composes ONE separator-wildcard term — got ${t}`);
  ok(t !== null && !t.includes('(') && !t.includes(')') && t.split(',').length === 1,
     'G2 🔴 …and that term contains no paren and no comma, so it cannot break the .or() parse or invent a second term');

  // THE ACCEPTANCE CASE: the same human number, stored five different ways, all found.
  for (const stored of ['(512) 555-0101', '512-555-0101', '512.555.0101', '5125550101', '512 555 0101']) {
    ok(t !== null && termMatches(t, stored),
       `G3 🔴 the pasted "(512) 555-0101" FINDS a customer whose phone is stored as "${stored}" — the cross-format gap is closed, not merely logged`);
  }
  // …and the reverse direction, which is how a cashier reads a number off a caller ID.
  const t2 = phoneTerm('5125550101');
  ok(t2 !== null && termMatches(t2, '(512) 555-0101'),
     'G4 typing the bare digits finds the formatted stored value — the case the old phoneMatchKey block was written for and could not serve');

  // NEGATIVE CONTROLS — a wildcard term that matches everything would be worse than no term.
  ok(t !== null && !termMatches(t, '(512) 555-0199'),
     'G5 🔴 NEGATIVE CONTROL: a DIFFERENT number is NOT matched — the wildcards sit between the digit groups, they do not replace them');
  ok(t !== null && !termMatches(t, ''),
     'G6 …and an empty stored phone is not matched');
  ok(phoneTerm('cedar') === null && phoneTerm('512') === null,
     'G7 🔴 a NON-phone query adds NO extra term — the widening is scoped to phone-shaped input, so it cannot broaden a name search');
  // 🔴 G8 IS A LIMIT, NOT A WIN, AND IT IS WRITTEN AS ONE. `phoneMatchKey` takes the LAST TEN
  // digits, so an EXTENSION shifts the window and the term stops describing the main number:
  // "(512) 555-0101 x22" -> digits 512555010122 -> last ten 2555010122 -> %255%501%0122%, which
  // does NOT find "(512) 555-0101". That is the shared normalizer's rule, inherited deliberately
  // rather than forked here (§6 r8), and it is PINNED so the behaviour is a measurement instead of
  // a surprise at the counter. The name/email/address terms still search the row, so a typed
  // extension makes the search NARROWER, never broken.
  ok(digitsOf('(512) 555-0101 x22') === '2555010122',
     `G8a the last-10 rule shifts when an extension is typed — got ${digitsOf('(512) 555-0101 x22')}`);
  const ext = phoneTerm('(512) 555-0101 x22');
  ok(ext !== null && !termMatches(ext, '(512) 555-0101'),
     'G8b ⚠️ PINNED LIMIT: a phone typed WITH an extension does not match the stored number via the phone term — inherited from phoneMatchKey, not introduced here')

  // The production source must still carry the expression this section re-expresses.
  const srcP = codeOf('packages/cultivar-os/src/components/customers/CustomerSearch.tsx');
  ok(/parts\.push\(`phone\.ilike\.%\$\{digits\.slice\(0, 3\)\}%\$\{digits\.slice\(3, 6\)\}%\$\{digits\.slice\(6\)\}%`\)/.test(srcP),
     'G9 🔴 the source composes EXACTLY the term this section proves — otherwise G1–G8 describe a function nobody calls');
  ok(/const digits = phoneMatchKey\(q\);/.test(srcP),
     'G10 …and the digits come from the shared phoneMatchKey, so the search and the storage normalizer agree on what a phone is');
}

console.log(`\ncustomerPickerSearch: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
