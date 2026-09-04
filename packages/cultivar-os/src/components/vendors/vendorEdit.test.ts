/**
 * ── vendorEdit + the vendor record surface — probes ─────────────────────────────────────────────
 *
 * POPULATION (measured live 2026-09-04, read-only, negative control PGRST205 confirmed so a
 * "0 rows" answer is a real read rather than a failed one):
 *   · `vendors`        — 1 row across ALL tenants: `bwi` at Test Dave's (f7ec5d67).
 *                        0 of its 11 non-key columns are filled. 16 columns exist.
 *   · `vendor_aliases` — 0 rows.
 *   · `receipts`       — 39 rows / 3 tenants. vendor_id populated 1 of 39.
 *                        receipt_number populated 1 of 39 (19893519, bwi, f7ec5d67).
 *
 * 🔴 SO THE LIVE DATA CANNOT EXERCISE ONE SINGLE BRANCH OF THIS MODULE. One vendor, no aliases,
 * every editable column empty — there is no edit to diff, no duplicate name to reject, no
 * preference to clear. A suite built from live rows would assert nothing and report green.
 * Every case below is CONSTRUCTED for that reason (R-33: a check that cannot disagree is not a
 * check), and §A is the one probe that would have caught the defect this build found.
 *
 * PROBES BOTH DIRECTIONS (STD-022): each rule has a case that must pass and one that must fail.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/components/vendors/vendorEdit.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildVendorPatch, validateVendorDraft, vendorWriteFailure, emptyVendorDraft, draftFromVendor,
  patchIsEmpty,
} from './vendorEdit';
import {
  VENDORS_SELECT, VENDOR_EDITABLE_FIELDS, VENDOR_OWNER_ONLY_FIELDS, VENDOR_KEY_FIELDS,
  vendorContactFromCapture, describeDocumentNumber, type VendorRow,
} from '@trace/shared/business-logic';

const R = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const MIGRATION = R('supabase/migrations/20260902_vendor_identity_and_preference.sql');
const PAGE      = R('packages/cultivar-os/src/pages/Vendors.tsx');
const EDITOR    = R('packages/cultivar-os/src/components/vendors/VendorEditor.tsx');
const KEEPER    = R('packages/cultivar-os/src/pages/ReceiptKeeper.tsx');
const OCR       = R('packages/cultivar-os/api/receipts/ocr.ts');
const STANDARD  = R('docs/standards/ui-control-standards.md');

/** Source probes read CODE, not prose — a rule asserted by a comment is not asserted. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const PAGE_CODE   = stripComments(PAGE);
const EDITOR_CODE = stripComments(EDITOR);
const KEEPER_CODE = stripComments(KEEPER);

let passed = 0, failed = 0; const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); }
}

const VENDOR: VendorRow = {
  id: 'v1', business_id: 'b1', name: 'Bailey Bark Materials, Inc.',
  email: null, phone: '512-555-0100', account_number: null,
  address_line1: null, address_city: null, address_state: null, address_zip: null,
  website: null, notes: null, preferred: false, preference_note: null,
};

// ══ §A — THE FIELD LIST IS THE SOURCE, AND THE SELECT CANNOT FALL SHORT OF THE TABLE ═══════════
// 🔴 THIS IS THE PROBE THAT WOULD HAVE CAUGHT tech-debt #179. `VENDORS_SELECT` named ten columns
//    while the migration created fourteen; the four address columns had no reader, and nothing —
//    not tsc, not eslint, not knip, not a probe — could see it, because a column with no reader
//    and no writer is invisible to every tool we own. It is derived from the MIGRATION so it
//    cannot be satisfied by copying the same mistake into two places.
{
  const body = MIGRATION.slice(
    MIGRATION.indexOf('CREATE TABLE IF NOT EXISTS vendors ('),
    MIGRATION.indexOf('CREATE UNIQUE INDEX IF NOT EXISTS vendors_business_name_uidx'));
  const sqlOnly = body.replace(/--.*$/gm, '');
  // ⚠️ THE CHARACTER CLASS CARRIES A DIGIT, AND THE FIRST DRAFT DID NOT — a blind spot I
  //    introduced and the probe caught on its first run. `[a-z_]+` cannot match `address_line1`,
  //    so the column parse silently skipped THE VERY COLUMN the defect was about and A1 reported
  //    13 of 14. A probe whose scanner cannot see the failing case reports green about a
  //    population it never examined. Same shape as ledger #269's `[a-z]+` skipping `receipt_id`.
  const declared = [...sqlOnly.matchAll(/^\s{2}([a-z_0-9]+)\s+(uuid|text|boolean|timestamptz)/gm)].map(m => m[1]);
  const timestamps = ['created_at', 'updated_at'];
  const expected = declared.filter(c => !timestamps.includes(c));
  const selected = VENDORS_SELECT.split(',').map(s => s.trim());

  ok(expected.length === 14,
    `A1: the migration declares 14 non-timestamp columns on \`vendors\` — parsed ${expected.length} (${expected.join(',')})`);

  const missing = expected.filter(c => !selected.includes(c));
  ok(missing.length === 0,
    `🔴 A2: EVERY column the migration creates is in VENDORS_SELECT — missing: ${missing.join(', ') || '(none)'}. This is tech-debt #179's exact shape: a column with no reader reads back null forever and nothing notices.`);

  const extra = selected.filter(c => !expected.includes(c));
  ok(extra.length === 0,
    `A3: VENDORS_SELECT names nothing the table does not have — extra: ${extra.join(', ') || '(none)'}. A select naming a phantom column fails the whole read at runtime, not just that field.`);

  // NEGATIVE CONTROL — the probe must be capable of failing. Drop a column and it must notice.
  const sabotaged = selected.filter(c => c !== 'address_zip');
  ok(expected.filter(c => !sabotaged.includes(c)).length === 1,
    'A4 (negative control): removing one column from the select makes A2 fail — the probe can disagree');

  ok(selected.length === VENDOR_KEY_FIELDS.length + VENDOR_EDITABLE_FIELDS.length + VENDOR_OWNER_ONLY_FIELDS.length,
    'A5: the select is exactly the three declared lists concatenated — it is DERIVED, not hand-written beside them');
  ok(!/VENDORS_SELECT\s*=\s*['"`]/.test(R('packages/shared/src/business-logic/vendorIdentity.ts')),
    '🔴 A6: VENDORS_SELECT is not assigned from a string literal — a hand-written select is the defect itself, however correct it happens to be today');
}

// ══ §B — VALIDATION IS ONE PASS, AND ONLY WHAT THE DATABASE REQUIRES IS REQUIRED ════════════════
{
  ok(validateVendorDraft({ ...emptyVendorDraft(), name: '' }) !== null, 'B1: a blank name is refused');
  ok(validateVendorDraft({ ...emptyVendorDraft(), name: '   ' }) !== null, 'B2: whitespace is not a name');
  ok(validateVendorDraft({ ...emptyVendorDraft(), name: 'bwi' }) === null,
    '🔴 B3: a vendor known ONLY by name is VALID — that is the state all 1 live vendor rows are in, and inventing extra required fields would make the real data unsaveable');
  ok(validateVendorDraft({ ...emptyVendorDraft(), name: 'x', email: 'nope' }) !== null, 'B4: a malformed email is refused');
  ok(validateVendorDraft({ ...emptyVendorDraft(), name: 'x', email: 'a@b.co' }) === null, 'B5: a real email passes');
  ok(validateVendorDraft({ ...emptyVendorDraft(), name: 'x', email: '' }) === null,
    'B6 (negative control): an EMPTY email is not a malformed one — absent is not invalid');
}

// ══ §C — THE PATCH DIFFS AGAINST THE PERSISTED ROW (E4) ═════════════════════════════════════════
{
  const draft = draftFromVendor(VENDOR);
  const pref = { preferred: false, note: '' };

  const unchanged = buildVendorPatch({ saved: VENDOR, draft, preference: pref, creating: false, canSetPreference: true });
  ok(patchIsEmpty(unchanged.values),
    '🔴 C1: a draft identical to the row produces an EMPTY patch — the unchanged-check reads the PERSISTED value, not the working copy (E4)');

  const changed = buildVendorPatch({
    saved: VENDOR, draft: { ...draft, phone: '512-555-0999' }, preference: pref, creating: false, canSetPreference: true });
  ok(Object.keys(changed.values).length === 1 && changed.values.phone === '512-555-0999',
    `C2: exactly the changed field is sent — got ${JSON.stringify(changed.values)}`);

  const cleared = buildVendorPatch({
    saved: VENDOR, draft: { ...draft, phone: '' }, preference: pref, creating: false, canSetPreference: true });
  ok(cleared.values.phone === null,
    '🔴 C3: a cleared optional field writes NULL, not the empty string — an absence must read as an absence (D-9/A9)');

  const namedBlank = buildVendorPatch({
    saved: VENDOR, draft: { ...draft, name: '' }, preference: pref, creating: false, canSetPreference: true });
  ok(namedBlank.error !== null && patchIsEmpty(namedBlank.values),
    'C4: a blank name blocks the whole patch — validation is one pass over the record, not per field');

  const partial = buildVendorPatch({
    saved: VENDOR, draft: { name: 'Bailey Bark Materials, Inc.' }, preference: pref, creating: false, canSetPreference: true });
  ok(patchIsEmpty(partial.values),
    '🔴 C5: a field the caller never LOADED is never written — a partial draft must not null-clobber columns it cannot see');
}

// ══ §D — THE OWNER-ONLY CARVE-OUT IS ABSENT, NOT SENT-AND-REFUSED ══════════════════════════════
{
  const draft = draftFromVendor(VENDOR);

  const asManager = buildVendorPatch({
    saved: VENDOR, draft, preference: { preferred: true, note: 'better stock' },
    creating: false, canSetPreference: false });
  ok(!('preferred' in asManager.values) && !('preference_note' in asManager.values),
    '🔴 D1: without owner authority the preference pair is OMITTED ENTIRELY — the trigger lets an UNCHANGED value through, so sending it would "work" and teach the next reader a manager may write these columns');

  const asOwner = buildVendorPatch({
    saved: VENDOR, draft, preference: { preferred: true, note: 'better stock' },
    creating: false, canSetPreference: true });
  ok(asOwner.values.preferred === true && asOwner.values.preference_note === 'better stock',
    'D2: an owner sends both halves together');

  const marked: VendorRow = { ...VENDOR, preferred: true, preference_note: 'better stock' };
  const unmark = buildVendorPatch({
    saved: marked, draft: draftFromVendor(marked), preference: { preferred: false, note: 'better stock' },
    creating: false, canSetPreference: true });
  ok(unmark.values.preferred === false && unmark.values.preference_note === null,
    '🔴 D3: clearing the mark clears its reason — a note explaining a preference that no longer exists would resurface if the mark returned');

  const bornPreferred = buildVendorPatch({
    saved: null, draft: { ...emptyVendorDraft(), name: 'New Co' },
    preference: { preferred: true, note: '' }, creating: true, canSetPreference: true });
  ok(bornPreferred.error !== null,
    '🔴 D4: a vendor cannot be CREATED already preferred — the client agrees with vendors_preference_owner_only_insert instead of discovering it as a 42501');
  ok(/vendors_preference_owner_only_insert/.test(MIGRATION),
    'D5: and that trigger really exists in the migration — D4 is not asserting a rule we invented');
}

// ══ §E — THE ROW'S MARK IS READ-ONLY (E7 + G8), AND THE CONTROL IS GONE FROM THE ROW ═══════════
{
  ok(/\| E7 \|/.test(STANDARD),
    'E0: E7 is filed in the standard — the clause exists before the surface claims to meet it (R-74 order)');

  ok(!/Save as preferred/.test(PAGE_CODE),
    '🔴 E1: the page no longer carries a "Save as preferred" control — the per-record control left the row (E7)');
  ok(!/Why is this vendor preferred/.test(PAGE_CODE),
    '🔴 E2: the note EDITOR left the row — the textarea and its Save button are what E7 removed');
  // 🔴 E2b — REVERSED SAME DAY BY DAVID, AND THE CLAUSE ALLOWS IT IN ITS OWN WORDS: "The row
  //    carries a READ-ONLY MARK of the result." The reason IS part of the mark. What must stay
  //    gone from the row is the CONTROL, which E2 above asserts.
  ok(/style=\{NOTE\}>\{v\.preference_note\}/.test(PAGE_CODE),
    '🔴 E2b: the REASON is rendered on the row, read-only — "who is preferred" and "why" are ONE FACT, and a flag without its reason only tells her which row to click (David, 2026-09-04)');
  ok(/Marked preferred, but no reason was recorded/.test(PAGE_CODE),
    'E2c: and an absent reason ANNOUNCES itself on the row rather than rendering as a blank (D-9/A9)');
  const noteStyle = PAGE.match(/const NOTE: React\.CSSProperties = \{[\s\S]*?\};/);
  ok(noteStyle !== null && !/cursor/.test(noteStyle[0]),
    '🔴 E2d: the note style sets NO cursor — it is content, not a control, so E7 still holds');
  ok(!/<div style=\{NOTE\}[^>]*onClick/.test(PAGE_CODE),
    'E2e: and it carries no click handler — a read-only line, which is exactly what E7 provides for');
  ok(/Why is this vendor preferred/.test(EDITOR_CODE),
    'E3: …and landed in the modal, rather than being deleted');

  ok(!/from\('vendors'\)[\s\S]{0,200}\.update\(/.test(PAGE_CODE),
    '🔴 E4: the page performs NO vendor write at all — every write goes through the one editor (E1)');
  ok(/from\('vendors'\)[\s\S]{0,120}\.update\(/.test(EDITOR_CODE) && /from\('vendors'\)[\s\S]{0,120}\.insert\(/.test(EDITOR_CODE),
    'E5: the editor owns both the insert and the update');

  // 🔴 THE MARK MUST NOT READ AS CLICKABLE. Isolate the chip's own JSX and prove it carries no
  //    interactive attribute — a chip that looks pressable and does nothing is the dead affordance
  //    G8 forbids, which is the defect E7 would otherwise trade for the one it fixes.
  const chip = PAGE_CODE.match(/\{v\.preferred === true && <span style=\{MARK\}>[^<]*<\/span>\}/);
  ok(chip !== null, 'E6: the PREFERRED chip is present on the row');
  if (chip) {
    ok(!/onClick|onKeyDown|role=|tabIndex|cursor/.test(chip[0]),
      `🔴 E7: the chip carries NO onClick, role, tabIndex or cursor — it states a fact and offers nothing (G8). Found: ${chip[0]}`);
  }
  const markStyle = PAGE.match(/const MARK: React\.CSSProperties = \{[\s\S]*?\};/);
  ok(markStyle !== null && !/cursor/.test(markStyle![0]),
    '🔴 E8: and its STYLE sets no cursor either — the visual affordance must agree with the behaviour, or the mark still reads as a control');

  // NEGATIVE CONTROL: the button that DOES open the record must be found by the same test, or E7
  // is passing because the regex matches nothing rather than because the chip is inert.
  ok(/Edit vendor<\/button>/.test(PAGE_CODE) && /onClick=\{\(\) => \{/.test(PAGE_CODE),
    'E9 (negative control): an explicit interactive control IS present on the row and IS detected — E7/E8 are not passing vacuously');

  // G10's exclusion, honoured rather than ignored: a list with no expansion gets no row click.
  ok(!/<div key=\{v\.id\} style=\{ROW\} onClick/.test(PAGE_CODE),
    'E10: the ROW itself is not a click target — G10 makes rows clickable only on a grid that HAS an expansion; this card list has none');
}

// ══ §F — WRITE FAILURES ARE DISTINGUISHABLE, INCLUDING THE ONE THAT IS NOT AN ERROR ════════════
{
  ok(vendorWriteFailure({ errorCode: null, errorMessage: null, matchedRows: 1, attemptedPreference: false }) === null,
    'F1: a write that matched a row is a success');
  const zero = vendorWriteFailure({ errorCode: null, errorMessage: null, matchedRows: 0, attemptedPreference: false });
  ok(zero !== null,
    '🔴 F2: ZERO ROWS AND NO ERROR IS A FAILURE — a PostgREST update filtered out by its policy returns success with an empty array, and an error-only check reports "saved" while nothing changed (E5)');
  ok(!/undefined|null/.test(String(zero)),
    'F3: and it says so in a sentence, not by leaking a null into the copy');

  const dup = vendorWriteFailure({ errorCode: '23505', errorMessage: 'duplicate key value violates unique constraint "vendors_business_name_uidx"', matchedRows: null, attemptedPreference: false });
  ok(dup !== null && /unique/i.test(dup) && !/23505/.test(dup),
    'F4: a duplicate name is explained in the owner\'s terms, not as a Postgres error code');

  const refused = vendorWriteFailure({ errorCode: '42501', errorMessage: 'vendor preference is owner-only', matchedRows: null, attemptedPreference: true });
  ok(refused !== null && /owner/i.test(refused),
    'F5: the trigger refusal is surfaced honestly rather than swallowed');
  const refusedOther = vendorWriteFailure({ errorCode: '42501', errorMessage: 'permission denied', matchedRows: null, attemptedPreference: false });
  ok(refusedOther !== null && !/preferred vendor/.test(refusedOther),
    '🔴 F6 (negative control): a 42501 on a NON-preference write does not claim the preference was refused — the message follows what was actually attempted');
}

// ══ §G — THE CAPTURE KEEPS WHAT THE DOCUMENT SAID ══════════════════════════════════════════════
{
  const got = vendorContactFromCapture({
    vendor_phone: ' 512-555-0100 ', vendor_email: null, vendor_website: 'bwi.com',
    vendor_address: { line1: '1200 Industrial', city: 'Leander', state: 'TX', zip: null },
    our_account_number: 'SLAW040',
  });
  ok(got.phone === '512-555-0100' && got.website === 'bwi.com' && got.account_number === 'SLAW040',
    'G1: vendor-side contact from the document maps onto the vendor columns');
  ok(got.address_line1 === '1200 Industrial' && got.address_city === 'Leander' && got.address_state === 'TX',
    'G2: the address is unpacked into its four columns');
  ok(!('email' in got) && !('address_zip' in got),
    '🔴 G3: an ABSENT field is OMITTED, never written as null or "" — otherwise "we never read one" and "the page says it is blank" become indistinguishable forever (D-9/A9)');
  ok(Object.keys(vendorContactFromCapture(null)).length === 0,
    'G4 (negative control): nothing parsed yields nothing written — it cannot invent columns');
  ok(Object.keys(vendorContactFromCapture({ vendor_phone: '   ' })).length === 0,
    'G5: whitespace is an absence, not a value');

  ok(/vendorContactFromCapture\(/.test(KEEPER_CODE),
    '🔴 G6: the capture path actually CALLS it — a mapper nobody calls is the extract-and-discard defect with extra steps (#257 shape)');
  ok(/name: plan\.createVendorNamed, \.\.\.contact/.test(KEEPER_CODE),
    'G7: and spreads it into the insert, so the read values reach the row');

  // The prompt must ASK, or the mapper has nothing to map. Both shapes.
  ok((OCR.match(/"our_account_number"/g) ?? []).length === 2,
    'G8: BOTH prompt shapes ask for our account number — receipt and invoice');
  ok((OCR.match(/"vendor_phone"/g) ?? []).length === 2 && (OCR.match(/"vendor_address"/g) ?? []).length === 2,
    'G9: …and for the vendor phone and address');
  ok(/OUR customer\/account number WITH this vendor/.test(OCR) && /NOT their company number/.test(OCR),
    '🔴 G10: the prompt says WHOSE number it is, in both directions — "account_number" alone reads backwards the first time somebody types the vendor\'s own EIN into it');
  ok(/Never copy a bill-to \/ sold-to \/ ship-to value into a vendor_\* field/.test(OCR),
    'G11: and the vendor/customer sides are explicitly kept apart — the invoice prompt was written for SALES invoices, where every contact field is the customer\'s');
}

// ══ §H — A TYPED NUMBER AND A READ NUMBER ARE DIFFERENT EVIDENCE ════════════════════════════════
{
  ok(describeDocumentNumber('19893519', '19893519').provenance === 'read',
    'H1: read and unaltered');
  ok(describeDocumentNumber('', '19893519').provenance === 'typed',
    '🔴 H2: the reader read NOTHING (banked as the `\'\'` sentinel) + a value present = TYPED. This is the case that cannot be reconstructed later, and the reason the original is banked rather than derived');
  // 🔴 H2b IS THE CORRECTION LIVE DATA FORCED, HOURS AFTER SHIPPING. NULL must NOT read as typed.
  ok(describeDocumentNumber(null, '595431').provenance === 'unknown',
    '🔴 H2b: a NULL original is UNKNOWN, never TYPED. Measured on LAWNS 2026-09-04T16:03Z: `Bailey Bark Materials, Inc.` $2180.79 carried receipt_number 595431 with a NULL original, and 595431 IS IN THAT ROW\'S ocr_raw — the reader read it. The first rule would have told her she typed it (R-79: a false claim about our own read).');
  ok(!describeDocumentNumber(null, '595431').isHumanSupplied,
    'H2c: and it is not attributed to a human — an unknown provenance accuses nobody');
  ok(/cannot say/.test(describeDocumentNumber(null, '595431').notice),
    'H2d: the gap is ANNOUNCED rather than filled (D-9) — "we cannot say", not silence and not a guess');
  ok(describeDocumentNumber(null, null).provenance === 'unknown'
    && describeDocumentNumber(null, null).notice === '',
    'H2e: an unnumbered pre-column row says nothing at all — there is no gap to announce when there is no number');
  ok(describeDocumentNumber('19893518', '19893519').provenance === 'corrected',
    'H3: read then corrected is its own state — not "read", and not "typed"');
  ok(describeDocumentNumber('', '').provenance === 'absent',
    'H4: the reader read nothing and nobody typed anything — an honest blank');
  ok(describeDocumentNumber('19893519', '').provenance === 'absent'
    && /cleared/.test(describeDocumentNumber('19893519', '').notice),
    '🔴 H5: a number that was READ and then CLEARED says so — "you cleared one" is a different fact from "there was none", and a bare blank would conflate them');

  ok(describeDocumentNumber('19893519', ' 19893519 ').provenance === 'read',
    'H6: trailing whitespace is not a correction');
  ok(describeDocumentNumber('INV-4021', 'inv4021').provenance === 'corrected',
    '🔴 H7 (negative control): case and punctuation are NOT folded — those are two different assertions about what is printed, and folding them would silently reclassify a correction as a read');

  ok(describeDocumentNumber('', 'X').isHumanSupplied && !describeDocumentNumber('X', 'X').isHumanSupplied,
    'H8: isHumanSupplied separates the owner\'s assertion from the document\'s');
  ok(describeDocumentNumber('X', 'X').notice === '',
    'H9: the normal case is silent — a notice on every capture is noise, and noise is what stops the abnormal one being read');

  // The field, and the column behind it.
  ok(/Invoice \/ receipt number/.test(KEEPER_CODE),
    '🔴 H10: the confirm form HAS the field — 19893519 was captured correctly and never shown, while vendor/date/total/lines were all reviewable');
  ok(/describeDocumentNumber\(receiptNumberOriginal, receiptNumber\)/.test(KEEPER_CODE),
    'H11: and it renders the verdict from the shared rule rather than re-deriving one');
  ok(/setReceiptNumberOriginal\(readNumber \?\? ''\)/.test(KEEPER_CODE),
    "🔴 H12: the original is banked at PARSE time AS THE `''` SENTINEL when the reader found nothing — banking null there would make every unread number read as TYPED");
  const typingResets = /onChange[\s\S]{0,200}setReceiptNumberOriginal/.test(KEEPER_CODE);
  ok(!typingResets,
    '🔴 H13: typing NEVER touches the banked original — if it did, every typed number would read as "read from the page", which is the exact lie this column exists to prevent');
  ok(/receipt_number_original/.test(R('supabase/migrations/20260904_receipts_receipt_number_original.sql')),
    'H14: and the column it writes to is created by a migration in the repo');
  ok(!/UPDATE receipts SET receipt_number_original/i.test(R('supabase/migrations/20260904_receipts_receipt_number_original.sql')),
    '🔴 H15: the migration does NOT backfill — asserting the reader read the one populated row would be right by luck and unverifiable in general (R-50)');
}

// ══ §I — THE FORM RENDERS THE SHARED FIELD SET, NOT A PARALLEL COPY OF IT (E6) ═════════════════
// 🔴 I WROTE THIS DEFECT INTO THE EDITOR AND KNIP FOUND IT: the component imported
//    VENDOR_EDITABLE_FIELDS, re-exported it, and rendered from a hand-written `GROUPS` array
//    instead — a second parallel field list, in the same build that filed #179 for the first one.
//    The fix is structural rather than remembered: any editable field no group claims is appended
//    under "Other", so a new column reaches the form even if nobody groups it.
{
  const groups = [...EDITOR.matchAll(/\{ title: '[^']+',\s*fields: \[([^\]]*)\]/g)]
    .flatMap(m => [...m[1].matchAll(/'([a-z_0-9]+)'/g)].map(x => x[1]));

  const missing = VENDOR_EDITABLE_FIELDS.filter(f => !groups.includes(f));
  ok(missing.length === 0,
    `🔴 I1: every field in VENDOR_EDITABLE_FIELDS is grouped on the form — ungrouped: ${missing.join(', ') || '(none)'}. An ungrouped field still renders under "Other", so this is a tidiness check; I2 is the one that matters.`);

  const extra = groups.filter(f => !(VENDOR_EDITABLE_FIELDS as readonly string[]).includes(f));
  ok(extra.length === 0,
    `🔴 I2: the form groups NOTHING that is not in the shared editable set — extra: ${extra.join(', ') || '(none)'}. A field the form renders but the patch builder does not know about is an input that silently discards what is typed into it.`);

  ok(/GROUPED_FIELDS/.test(EDITOR_CODE) && /VENDOR_EDITABLE_FIELDS\.filter/.test(EDITOR_CODE),
    '🔴 I3: the rendered set is COMPUTED against the shared list rather than being the literal array — the catch-all is what makes a forgotten column visible instead of absent');
  ok(/\{GROUPED_FIELDS\.map/.test(EDITOR_CODE),
    'I4: …and it is GROUPED_FIELDS that is rendered, not GROUPS — a computed set nobody renders is decoration');

  ok(!/preferred|preference_note/.test(groups.join(',')),
    '🔴 I5 (negative control): the OWNER-ONLY pair is NOT in the ordinary field groups — it has its own gated block, and grouping it with the text fields would hand it to a manager');
}

console.log(`\nvendorEdit: ${passed} passed, ${failed} failed`);
console.log('  populations — SNAPSHOT 2026-09-04T16:03Z, and every receipts figure is a snapshot with a tenant or it is wrong by the time it is read: `vendors` 1 row ALL TENANTS / 0 of 11 non-key columns filled; `vendor_aliases` 0 rows; `receipts` 31 rows ALL TENANTS (LAWNS ed2e5933 = 10, Test Dave\'s f7ec5d67 = 19, 06065fe7 = 2), receipt_number 2/31, receipt_number_original 0/31.');
console.log('  🔴 THE COUNT MOVES WHILE THIS RUNS. It was 39 all-tenant at 14:30Z, 30 after nine LAWNS rows were deleted at ~15:01Z, and 31 at 16:03Z when Lauren landed one. Anything quoting a receipts figure without a timestamp AND a tenant is wrong twice over.');
console.log('  Every case above is CONSTRUCTED: one empty vendor cannot exercise a diff, a duplicate, or a preference (R-33).');
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
