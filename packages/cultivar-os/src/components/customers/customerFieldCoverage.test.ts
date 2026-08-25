/**
 * ── customerFieldCoverage — R-19'S CHECK: A FIELD LIST CANNOT QUIETLY OMIT A FIELD · 2026-08-25
 *
 * 🔴 WHY THIS EXISTS — FOUR DEFECTS IN ONE WEEK, ONE SHAPE:
 *     1. `email` absent from `customerUpsert`'s `offer()` list            → fixed 0840b30
 *     2. `organization_name` absent from the roster search                → fixed 8b26348
 *     3. the legacy address columns absent from the picker search         → fixed f1c26ef
 *     4. the ADDRESS absent from `CustomerCapture`'s select-copy          → fixed HERE
 *   Every one of them was A HAND-MAINTAINED LIST THAT OMITTED A FIELD IT SHOULD HOLD, and every one
 *   of them was found by a human noticing a blank box. `customerFieldRegistry.ts` was built to end
 *   exactly this and the four paths above did not read it. **Fixing #4 alone guarantees a fifth.**
 *
 * 🔴 WHAT THIS ASSERTS, IN ONE SENTENCE: every field on the customer registry has an EXPLICIT
 *   DISPOSITION in every list that claims to cover the record — present, or excluded WITH A REASON —
 *   and there is no third option. A new registry field with no disposition FAILS THE BUILD.
 *
 * ⚠️ THE DECLARATION ASSERTS ITSELF IN BOTH DIRECTIONS (#11's lesson, and #73's):
 *   an exclusion naming a field the registry no longer has is STALE and also FAILS. A declaration
 *   list that can only grow stops being read — `OWNER_ONLY_PENDING` is the local proof.
 *
 * 🔴 WHAT IT CANNOT CATCH — STATED HERE RATHER THAN DISCOVERED LATER, because a cap silent about
 *   its own blind spot is the thing #164 is about:
 *   (a) **A COLUMN THAT EXISTS IN POSTGRES AND NOT IN THE REGISTRY.** There is no `CREATE TABLE
 *       customers` in the migration corpus (tech-debt #39 — the customers/orders schema is live-only)
 *       and this machine has no catalog access, so "the schema" is not a thing this file can read.
 *       Per the 2026-08-22 ruling — *a claim about the database is sourced from the catalog or it is
 *       not made* — the assertion is against the REGISTRY, and §G declares the four columns found in
 *       the migration corpus that the registry does not list. **The registry is a FLOOR.**
 *   (b) **WHETHER A COPIED VALUE IS RIGHT** — only that it is copied. `state: 'XX'` copies fine.
 *   (c) **A RUNTIME RENDER.** There is no React harness here (E2E is a recorded non-build,
 *       RULINGS 2026-07-30), so §D reads the SOURCE of each site. That catches a site being
 *       re-inlined or unhooked; it cannot prove what the browser painted. GATE 0 does that.
 *   (d) **A LIST IN A FILE §D DOES NOT NAME.** The sites are enumerated by hand below. A brand-new
 *       fifth customer search in a brand-new file is invisible to this until someone adds it —
 *       which is why §D also asserts the NEGATIVE (no stray customer `.ilike.` in the order path).
 *
 * Run:  node scripts/run-tests.mjs customerFieldCoverage
 */

import { readFileSync } from 'node:fs';
import {
  CUSTOMER_ORDER_FIELDS,
  CUSTOMER_ORDER_EXCLUSIONS,
  CUSTOMER_ORDER_COLS,
  CUSTOMER_ORDER_COLS_CORE,
  CUSTOMER_SELECT_FULL,
  CUSTOMER_SEARCH_FIELDS,
  customerOrderFill,
  customerOrderInput,
} from './customerFieldRegistry';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
/** RAW source — use ONLY for claims about PROSE (a header's wording, a declared note). */
function read(rel: string): string {
  try { return readFileSync(rel, 'utf8'); } catch (e) { return `((UNREADABLE: ${(e as Error).message}))`; }
}

/** 🔴 SOURCE WITH COMMENTS REMOVED — use for every claim about BEHAVIOUR.
 *
 *  THIS FUNCTION EXISTS BECAUSE THE RED-FIRST RUN CAUGHT ITS ABSENCE, on the single most important
 *  defect in the build. Commenting out `setAddress(f.address_line1);` in `CustomerCapture` — B2's
 *  exact defect, the blank City and ZIP David measured — left EVERY assertion in this file GREEN,
 *  because the probes read raw text and `// setAddress(f.address_line1);` still matches
 *  `/setAddress\(f\./`. **A probe that a comment can satisfy is not a probe.** `verify-field-lists`
 *  learned this already and strips comments for the same reason; this file did not, until a planted
 *  defect proved it.
 *
 *  Block comments are replaced by their own newline count so reported positions do not shift — the
 *  same care `scripts/verify-field-lists.mjs:stripComments` takes, and for the same reason. */
function code(rel: string): string {
  // 🔴 TWO PASSES, IN THIS ORDER, AND BOTH HALVES WERE LEARNED FROM A PROBE THAT WENT WRONG:
  //  ① LINE comments (`//`) first — because a line comment can legally CONTAIN `/*`.
  //    `CustomerSearch.tsx:3` reads "the customer step of /checkout/* opens on a SEARCH", and a
  //    block-comment regex run first reads that as an OPENER and swallows the imports with it.
  //  ② BLOCK comments second, which removes each `/** … */` whole, body and all.
  // ⚠️ AND NOT a "drop lines starting with *" rule, which looks equivalent and is not: it deletes
  //    a JSDoc's CLOSING ` */` line, leaving the opener dangling and eating the code below it.
  //    Measured on this very file — 13 openers, 8 closers. Blocks are removed as blocks.
  // Each block is replaced by its own newline count so reported positions do not shift.
  return read(rel)
    .split('\n')
    .map(l => (l.trimStart().startsWith('//') ? '' : l))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, m => '\n'.repeat((m.match(/\n/g) ?? []).length));
}

/** Every field the registry declares. `CUSTOMER_SELECT_FULL` is the whole registry joined, so this
 *  is DERIVED from the registry rather than restated — restating it here would make this file the
 *  next hand-maintained list, which would be a joke at its own expense. */
const REGISTRY: readonly string[] = CUSTOMER_SELECT_FULL.split(',');

const SRC = {
  search:   'packages/cultivar-os/src/components/customers/CustomerSearch.tsx',
  capture:  'packages/cultivar-os/src/pages/CustomerCapture.tsx',
  scan:     'packages/cultivar-os/src/pages/ScanOrder.tsx',
  roster:   'packages/cultivar-os/src/pages/Customers.tsx',
  upsert:   'packages/shared/src/business-logic/customerUpsert.ts',
  submit:   'packages/cultivar-os/api/orders/submit.ts',
  registry: 'packages/cultivar-os/src/components/customers/customerFieldRegistry.ts',
};

// ══ A · THE REGISTRY IS A USABLE BASE ════════════════════════════════════════════════════════
{
  ok(REGISTRY.length >= 25, `A1 the registry declares a real record — ${REGISTRY.length} fields`);
  ok(new Set(REGISTRY).size === REGISTRY.length, 'A2 no field is declared twice');
  ok(REGISTRY.every(f => /^[a-z][a-z0-9_]*$/.test(f)),
     'A3 every key is a bare snake_case column name — the property every derived select depends on');
  ok(REGISTRY.includes('marketing_opt_in'),
     'A4 🔴 `marketing_opt_in` IS in the registry — a real column (customerUpsert.ts:152/:211) that the '
     + '"one list" did not list, which is how the checkout opt-in box escaped every derived list');
}

// ══ B · COVERAGE — EVERY REGISTRY FIELD HAS A DISPOSITION, AND THERE IS NO THIRD OPTION ══════
// 🔴 THIS IS THE PROBE THE WHOLE FILE IS FOR. Adding a field to the registry and to no list is
// exactly defects 1–4, and it is what this makes impossible to do quietly.
{
  const carried  = new Set(CUSTOMER_ORDER_FIELDS);
  const excluded = new Set(Object.keys(CUSTOMER_ORDER_EXCLUSIONS));

  const undisposed = REGISTRY.filter(f => !carried.has(f) && !excluded.has(f));
  ok(undisposed.length === 0,
     `B1 🔴 EVERY registry field is either CARRIED by the order path or EXCLUDED with a reason. `
     + `Undisposed: ${undisposed.join(', ') || '(none)'} — add it to CUSTOMER_ORDER_FIELDS, or to `
     + `CUSTOMER_ORDER_EXCLUSIONS with the reason it does not belong on an order.`);

  const both = REGISTRY.filter(f => carried.has(f) && excluded.has(f));
  ok(both.length === 0,
     `B2 no field is both carried and excluded — a contradictory disposition is not a disposition. both: ${both.join(', ')}`);

  // ⚠️ THE OTHER DIRECTION — this is what stops the declaration rotting into unread noise.
  const staleExclusions = [...excluded].filter(f => !REGISTRY.includes(f));
  ok(staleExclusions.length === 0,
     `B3 🔴 STALE DECLARATION: an exclusion names a field the registry no longer has — ${staleExclusions.join(', ')}. `
     + `Delete the entry; a reason for a field that does not exist is noise that teaches people to skim the list.`);

  const strayCarried = CUSTOMER_ORDER_FIELDS.filter(f => !REGISTRY.includes(f));
  ok(strayCarried.length === 0,
     `B4 🔴 the order projection names only REAL registry fields — a typo here makes the whole .select() a 42703, `
     + `i.e. NO customer search at all. stray: ${strayCarried.join(', ')}`);

  ok(Object.values(CUSTOMER_ORDER_EXCLUSIONS).every(r => typeof r === 'string' && r.trim().length >= 20),
     'B5 every exclusion carries an actual REASON, not an empty string — "declared" without a why is just a longer silence');

  // The DERIVED probe: a synthetic new field with no disposition must be caught by B1's rule.
  const synthetic = [...REGISTRY, 'loyalty_number'];
  const wouldCatch = synthetic.filter(f => !carried.has(f) && !excluded.has(f));
  ok(wouldCatch.length === 1 && wouldCatch[0] === 'loyalty_number',
     'B6 🔴 THE SELF-TEST: a NEW registry field with no disposition is detected by the same rule B1 applies — '
     + 'this is the assertion that proves B1 would fire rather than merely being green today');
}

// ══ C · THE PROJECTION, THE SELECT STRING AND THE ROW TYPE ALL AGREE ═════════════════════════
{
  ok(CUSTOMER_ORDER_COLS.split(',').join(',') === CUSTOMER_ORDER_FIELDS.join(','),
     'C1 the select string is the projection, joined — not a second list');

  const core = CUSTOMER_ORDER_COLS_CORE.split(',');
  ok(core.every(f => CUSTOMER_ORDER_FIELDS.includes(f)),
     'C2 the ungated retry subset is a SUBSET of the projection — a retry cannot ask for more than the first try');
  ok(core.length < CUSTOMER_ORDER_FIELDS.length,
     `C3 the retry subset is genuinely narrower (${core.length} of ${CUSTOMER_ORDER_FIELDS.length}) — if it were equal, the retry would repeat the failing query`);
  ok(core.includes('first_name') && core.includes('address_line1') && core.includes('city'),
     'C4 the ungated subset still carries a name and the LEGACY address — a pre-migration tenant gets a narrower search, not a broken one');
  ok(!core.includes('billing_line1') && !core.includes('organization_name'),
     'C5 …and it drops exactly the 2026-07-13 gated columns, which is the whole point of the retry');

  // The ROW TYPE must be able to hold what the projection fetches, or the copy silently reads
  // `undefined` off a field that did arrive. Read from SOURCE — the type is erased at runtime.
  const src = read(SRC.search);
  const iface = src.slice(src.indexOf('export interface CustomerSearchHit'));
  const body  = iface.slice(0, iface.indexOf('\n}'));
  const missingFromType = CUSTOMER_ORDER_FIELDS.filter(f => !new RegExp(`\\b${f}\\??:`).test(body));
  ok(missingFromType.length === 0,
     `C6 🔴 every field the projection FETCHES is declared on CustomerSearchHit — otherwise the copy reads undefined off a column that actually arrived. missing: ${missingFromType.join(', ')}`);
}

// ══ D · THE SITES — READ AS SOURCE, BECAUSE A DERIVATION NOTHING CALLS IS NOT A FIX ══════════
// Without this section a future edit could re-inline any of these lists and leave every assertion
// above green over a restored defect. That is not hypothetical: it is what §E of the sibling suite
// was added for on 2026-08-25 (2), after exactly that hole was found.
{
  // ① the picker composes from the registry, selects the derived projection, and retries ungated
  const s = code(SRC.search);
  ok(/const parts = CUSTOMER_SEARCH_FIELDS\.map\(f => `\$\{f\}\.ilike\.\$\{like\}`\)/.test(s),
     'D1 CustomerSearch composes its .or() from CUSTOMER_SEARCH_FIELDS — not from a literal');
  ok(/runSearch\(CUSTOMER_ORDER_COLS\)/.test(s) && /runSearch\(CUSTOMER_ORDER_COLS_CORE\)/.test(s),
     'D2 …selects the DERIVED projection, with the ungated subset as the deploy-window retry');
  // 🔴 THIS PROBE WAS WEAK AND RED-FIRST CAUGHT IT. Written as `/count: 'exact'/` it stayed GREEN
  // when the count was deleted from the SEARCH query — because the RLS permission probe forty lines
  // below ALSO says `count: 'exact'`, and a bare substring cannot tell two queries apart. Anchor on
  // the SEARCH's own composition instead.
  ok(/\.select\(cols, \{ count: 'exact' \}\)/.test(s),
     "D3 🔴 B4: the SEARCH query (not the permission probe) asks for the EXACT match count — without it the notice can never fire and a capped list reads as a complete one");
  ok(/\.limit\(PAGE\)/.test(s),
     'D3b …and caps at the named PAGE constant, the other fact the notice needs');
  ok(/state\.total !== null && state\.total > state\.hits\.length/.test(s),
     'D4 🔴 B4: the truncation notice renders only when there genuinely ARE more, and never when the count is unknown (A9)');
  ok(/replace\(\/\[,%\(\)\]\/g/.test(s),
     'D5 🔴 the sanitiser strips , % ( ) — parentheses included, so a pasted "(512) 555-0101" cannot break the .or() parse (tech-debt #117 resolved toward the SAFER regex)');
  ok(/phone\.ilike\.%\$\{digits\.slice\(0, 3\)\}%/.test(s),
     'D6 🔴 a phone-shaped query adds a separator-wildcard term, so any stored format of the number is found');

  // ② the scan door has NO search of its own any more — this is the #116 retirement, asserted
  const sc = code(SRC.scan);
  ok(/<CustomerSearch\b/.test(sc),
     'D7 🔴 ScanOrder MOUNTS the shared component — one search, both order doors');
  ok(!/first_name\.ilike\./.test(sc) && !/last_name\.ilike\./.test(sc),
     'D8 🔴 …and has NO customer .ilike of its own. Re-inlining one here is what recreated the divergence twice; this makes it a RED BUILD (tech-debt #116)');
  ok(!/'id,first_name,last_name,phone,email,address_line1/.test(sc),
     'D9 …and no hand-written customer column literal (the 14-column BASE string is gone — A4/E6)');
  ok(/customerOrderInput\(/.test(sc),
     'D10 🔴 the scan door copies via the ONE shared copy — not a hand-written mapping (this is where the billing-first/legacy-only split lived)');

  // ③ the checkout door copies EVERY form field
  const cc = code(SRC.capture);
  ok(/customerOrderFill\(h\)/.test(cc),
     'D11 🔴 CustomerCapture fills from the ONE shared copy');
  for (const setter of ['setFirstName', 'setLastName', 'setEmail', 'setPhone',
                        'setAddress', 'setCity', 'setState', 'setZip', 'setOptIn']) {
    ok(new RegExp(`${setter}\\(f\\.`).test(cc),
       `D12 ${setter} is written from the shared fill — B3: a field that is not SET is a field where the previous customer's value survives`);
  }
  ok(!/setFirstName\(h\.first_name \?\? ''\)/.test(cc),
     'D13 🔴 the OLD four-field hand copy is gone — the exact line that omitted the address');

  // ④ the roster still derives its haystack (defect 2 must not come back)
  const ro = code(SRC.roster);
  ok(/searchText=\{customerSearchHaystack\}/.test(ro),
     'D14 the /customers roster still searches via the derived haystack — defect 2 stays fixed');

  // ⑤ NEGATIVE CONTROL for blind spot (d): no OTHER file on the order path composes a customer ilike
  const strays = ([SRC.capture, SRC.scan] as const)
    .filter(f => /\b(first_name|organization_name|email|phone)\.ilike\./.test(code(f)));
  ok(strays.length === 0,
     `D15 🔴 no fifth customer search has appeared on an order door — ${strays.join(', ') || 'none'}`);
}

// ══ E · THE WRITE SIDE — `customerUpsert`'s offer() LIST (DEFECT #1's CLASS) ═════════════════
// The order path can SUPPLY these fields; if the upsert does not OFFER one, it is silently dropped
// on the way to the database. That is defect 1 exactly — `email` was typed, sent, and never written.
{
  const up = code(SRC.upsert);
  // ⚠️ THE CHARACTER CLASS INCLUDES DIGITS ON PURPOSE. Written as `[a-z_]+` it silently missed
  // `address_line1` — the ONE offered field whose name ends in a digit — and E1 then reported a
  // defect that does not exist. E2 is what caught it: a count probe beside a set probe, so a regex
  // that under-matches cannot make E1 look like a finding. That is why E2 is here.
  const offered = new Set([...up.matchAll(/offer\(\s*'([a-z0-9_]+)'/g)].map(m => m[1]));
  // `email` and `marketing_opt_in` are written through their own named branches rather than offer()
  // — SUPPLIED_WINS and the explicit `!== undefined` line. Read them too, so this asserts REACHES
  // THE PAYLOAD rather than the narrower "appears in one particular list".
  const namedBranches = new Set<string>();
  if (/SUPPLIED_WINS = \['email'\]/.test(up)) namedBranches.add('email');
  if (/customer\.marketing_opt_in !== undefined/.test(up)) namedBranches.add('marketing_opt_in');

  const writable = ['first_name', 'last_name', 'email', 'phone',
                    'address_line1', 'city', 'state', 'zip', 'marketing_opt_in'];
  const dropped = writable.filter(f => !offered.has(f) && !namedBranches.has(f));
  ok(dropped.length === 0,
     `E1 🔴 every field the ORDER PATH can supply reaches customerUpsert's payload. Dropped: ${dropped.join(', ') || '(none)'} — `
     + `a field the form collects and the upsert never offers is typed, sent, and silently discarded (defect 1, 0840b30).`);

  ok(offered.has('first_name') && offered.size >= 8,
     `E2 the offer() list was actually parsed — ${offered.size} fields found (a regex that matched nothing would make E1 vacuously true)`);
  ok(namedBranches.has('email'),
     'E3 🔴 `email` is SUPPLIED-WINS by name — the fix from 0840b30 is still there, asserted rather than assumed');

  // The mirror rule the copy depends on: billing_* and the legacy four are written TOGETHER.
  ok(/address_line1: 'billing_line1', city: 'billing_city', state: 'billing_state', zip: 'billing_zip'/.test(up),
     'E4 the D-41 canonical+mirror pairing is intact — the premise under billing-first-with-fallback');
}

// ══ F · THE COPY ITSELF — BILLING-FIRST, NO STALE VALUE, A9 ══════════════════════════════════
{
  const A = {
    id: 'a', first_name: 'Ada', last_name: 'Alpha', email: 'ada@x.com', phone: '(512) 555-0101',
    billing_line1: '400 Honeycomb Mesa', billing_city: 'Leander', billing_state: 'TX', billing_zip: '78641',
    address_line1: 'OLD LINE', city: 'OLDCITY', state: 'ZZ', zip: '00000',
    price_tier: 'wholesale', tax_exempt: true, tax_exempt_reason: 'resale', tax_exempt_cert_ref: 'C-1',
    marketing_opt_in: false,
  };
  // B — a customer with NOTHING but a name. Every other field must come back EMPTY.
  const B = { id: 'b', first_name: 'Bo', last_name: null, email: null, phone: null };

  const fa = customerOrderFill(A);
  ok(fa.address_line1 === '400 Honeycomb Mesa' && fa.city === 'Leander'
     && fa.state === 'TX' && fa.zip === '78641',
     'F1 🔴 BILLING-FIRST ON ALL FOUR — the same rule submit.ts:264-274 writes the delivery row with. '
     + 'The old ScanOrder copy was billing-first on line1 and LEGACY-ONLY on city/state/zip, so one row produced two addresses');
  ok(fa.marketing_opt_in === false,
     'F2 🔴 a stored opt-OUT survives the copy — `?? true` here would re-grant consent on every selection');

  const fb = customerOrderFill(B);
  ok(fb.address_line1 === '' && fb.city === '' && fb.state === '' && fb.zip === '',
     'F3 🔴 B3: a customer with no address yields EMPTY strings — not undefined, which a setter would SKIP, leaving the previous customer\'s values on screen');
  ok(fb.phone === '' && fb.email === '',
     'F4 …and the same for the contact fields');
  ok(!Object.values(fb).some(v => v === 'undefined' || v === 'null'),
     'F5 A9: an absent field never becomes the literal string "undefined"/"null"');

  // 🔴 THE SELECT-A-THEN-B PROBE DAVID ASKED FOR, over the shape a form actually spreads.
  const keysA = Object.entries(fa).filter(([, v]) => v !== '' && v !== null).map(([k]) => k);
  const survivors = keysA.filter(k => {
    const av = (fa as unknown as Record<string, unknown>)[k];
    const bv = (fb as unknown as Record<string, unknown>)[k];
    return av === bv && k !== 'marketing_opt_in'; // both booleans; compared separately below
  });
  ok(survivors.length === 0,
     `F6 🔴 SELECT A THEN B: none of A's values appears in B's fill — survivors: ${survivors.join(', ') || '(none)'}`);
  ok(Object.keys(fa).length === Object.keys(fb).length,
     'F7 🔴 both fills carry the SAME KEY SET — that is what makes the clear a WRITE rather than a skipped write, and it is the whole mechanism behind F6');
  ok(fb.marketing_opt_in === true,
     'F8 a customer row with NO opt-in column recorded falls back to the same default a blank form uses — and only then');

  // Fallback direction: canonical blank/whitespace → legacy wins. Mirrors submit.ts's `pick`.
  const legacyOnly = customerOrderFill({
    first_name: 'C', billing_line1: '   ', address_line1: '9 Oak Ln', billing_city: '', city: 'Kyle',
  });
  ok(legacyOnly.address_line1 === '9 Oak Ln' && legacyOnly.city === 'Kyle',
     'F9 🔴 a BLANK or whitespace canonical column falls through to the legacy one — the pre-migration customer still gets their address');

  // The CustomerInput shape converts '' back to undefined at that one boundary (absent ≠ empty).
  const ib = customerOrderInput(B);
  ok(ib.city === undefined && ib.zip === undefined && ib.phone === undefined,
     'F10 🔴 at the CustomerInput boundary an empty value becomes UNDEFINED — customerUpsert rule (a): a field not supplied is OMITTED, never written as null over a stored value');
  const ia = customerOrderInput(A);
  ok(ia.city === 'Leander' && ia.address_line1 === '400 Honeycomb Mesa',
     'F11 …while a real value passes through billing-first, unchanged');
  ok(ia.first_name === 'Ada' && typeof ia.email === 'string',
     'F12 the required CustomerInput fields are always strings — never undefined, which the cart type forbids');
}

// ══ G · WHAT THE REGISTRY DOES NOT COVER — DECLARED, AND SELF-CLEARING ═══════════════════════
// 🔴 Blind spot (a), made VISIBLE instead of merely admitted. These four columns are ADDED BY
// MIGRATIONS IN THIS REPO and are NOT in the registry, so `CUSTOMER_SELECT_FULL` does not read them
// and no derived list covers them. That is a real gap in the "one declarative field list" claim and
// it is recorded here rather than in a comment nothing executes.
//
// ⚠️ THEY ARE **NOT** ADDED IN THIS BUILD, deliberately: every one of them widens the roster's and
// DeliverySchedule's FULL select, which is a read-behaviour change on surfaces this build was not
// scoped to touch. `marketing_opt_in` WAS added because the order form holds it and this build is
// the order path.
//
// SELF-CLEARING: each probe asserts the field is still ABSENT. The day someone adds one to the
// registry, its probe goes RED and forces this declaration to be corrected — the property #73's
// lesson demands, and the reason this is a test and not a comment.
{
  const KNOWN_ABSENT: Record<string, string> = {
    business_id:             'tenant scope, not a record field — every read is already .eq(business_id) and selecting it would put the scope key in every projection (AC-3).',
    person_id:               'the person-spine OVERLAY (20260625). Ruled: person_id is an overlay, NEVER the auth principal — it is not a customer-record field and must not become one by being listed here.',
    updated_at:              'system-managed timestamp; §6 r13 would lock it, and no surface shows it today. Adding it is a display decision, not a coverage one.',
    tax_exempt_cert_doc_url: 'the certificate DOCUMENT. Ruled 2026-07-29: TRACE is not a record system — a tax certificate has nothing to extract, so we keep the reference and the expiry, never the file. Listing it would invite a surface for it.',
  };
  for (const [col, reason] of Object.entries(KNOWN_ABSENT)) {
    ok(!REGISTRY.includes(col),
       `G1 declared-absent "${col}" is still absent from the registry. If it was just added, DELETE this declaration — the reason on record was: ${reason}`);
  }
  ok(Object.keys(KNOWN_ABSENT).length === 4,
     'G2 the declared-absent set is exactly the four found in the migration corpus on 2026-08-25 — a fifth appearing means the corpus was re-read and this list was not');

  // Honesty probe: the four are asserted to be REAL, not invented, by finding them in the corpus.
  const migrations = read('supabase/migrations/20260625_person_spine.sql')
                   + read('supabase/migrations/20260713_customers_party_record.sql');
  ok(/person_id/.test(migrations),
     'G3 the declared-absent list names real columns from real migrations — a declaration about a column nobody added would be noise');
}

// ══ H · THE RULE F1 MIRRORS IS ASSERTED, NOT QUOTED IN A COMMENT ════════════════════════════
// F1 claims the fill is billing-first "the same rule submit.ts writes the delivery row with". A
// comment saying that is worth nothing the day submit changes — so read submit and check.
{
  const sub = code(SRC.submit);
  ok(/address_line1: pick\(c\.billing_line1, c\.address_line1\)/.test(sub)
     && /city:\s+pick\(c\.billing_city,\s+c\.city\)/.test(sub)
     && /state:\s+pick\(c\.billing_state, c\.state\)/.test(sub)
     && /zip:\s+pick\(c\.billing_zip,\s+c\.zip\)/.test(sub),
     'H1 🔴 submit.ts STILL resolves the delivery address billing-first on all four columns — the rule '
     + 'customerOrderFill mirrors. If submit changes and this fails, the FORM and the TRUCK have started '
     + 'disagreeing again, which is the divergence this build closed.');

  // Every field a customer can be FOUND by is also a field the picker FETCHES — so a row that
  // matched can always be shown to the person who matched it. Not required by Postgres; required by
  // the surface, because a hit you cannot explain is a hit a cashier distrusts.
  const unshowable = CUSTOMER_SEARCH_FIELDS.filter(f => !CUSTOMER_ORDER_FIELDS.includes(f));
  ok(unshowable.length === 0,
     `H2 every searchable field is also carried in the projection — a row can never match on something the picker did not fetch. unshowable: ${unshowable.join(', ')}`);

  // B7 — the registry's own prose claim about how many searches read it must match §D's finding.
  const reg = read(SRC.registry);
  ok(/3 OF 3/.test(reg) && !/consolidation is 2 of 3/.test(reg),
     'H3 the registry note says 3 OF 3 and the "2 of 3" holdout wording is gone — D7/D8 are what make that claim true, so the two must not drift apart');
}

console.log(`\ncustomerFieldCoverage: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
