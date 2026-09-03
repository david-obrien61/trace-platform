/**
 * ── vendorIdentity — probes ─────────────────────────────────────────────────────────────────────
 *
 * Fixtures are the LIVE 2026-09-02 census (scripts/measure-vendor-strings.mjs), not invented data:
 *   · 36 receipt rows across 3 tenants; 8 distinct vendor strings.
 *   · LAWNS (ed2e5933) holds 17 rows / 4 distinct vendors: "LAWNS Tree Farm, LLC.",
 *     "Sudderth Brothers Contracting, Inc.", "bwi", "Bailey Bark Materials, Inc."
 *   · norm() collapses across the whole corpus: 0.  Prefix-contained pairs: 0.
 *   · The OCR emits 17 fields and NONE is a vendor email / phone / address / account number.
 *     Account-number mentions 0 of 35; emails 1 of 35 and that one is a customer_email.
 *
 * 🔴 SO THE LIVE DATA CANNOT EXERCISE THIS MODULE'S REASON FOR EXISTING. There is not one
 * duplicate spelling in `receipts` today — `Sudderth Brothers` (the shorthand), `Mcgill Farms` /
 * `McGill` and the trailing-space `Top Notch ` are on PAPER invoices David holds. A suite built
 * only from live rows would assert the branch that cannot fail and call the module proven.
 * The near-match, alias, second-signal and collision cases below are constructed for exactly that
 * reason — R-33: a check that cannot disagree is not a check.
 *
 * PROBES BOTH DIRECTIONS (STD-022): every rule is asserted by a case that must pass AND a case
 * that must fail. The negative controls are the ones that stop this file rubber-stamping.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/vendorIdentity.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  normalizeVendorName, looseVendorKey, emailDomain, resolveVendor, planVendorWrite,
  orderVendorsForDisplay, vendorListHeading,
  type VendorRow, type VendorAliasRow,
} from './vendorIdentity';

const SELF = readFileSync(join(process.cwd(), 'packages/shared/src/business-logic/vendorIdentity.ts'), 'utf8');
const MIGRATION = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260902_vendor_identity_and_preference.sql'), 'utf8');

/**
 * 🔴 SOURCE-TEXT PROBES READ CODE, NOT PROSE — and this stripper is here because the first run of
 * this file went RED on exactly that confusion. I3 and J6 assert that the module never consults a
 * price and that the surface never gates on `costs:read`; both files EXPLAIN AT LENGTH why they do
 * neither, so a raw-text scan found the words in the reasoning and reported a violation that was
 * not there. Weakening the assertion would have turned two of the sharpest probes into decoration.
 * Stripping comments keeps them able to fail on the thing they are actually about.
 */
const CODE_ONLY = SELF.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
const SQL_ONLY = MIGRATION.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   x ' + msg); }
}

const LAWNS = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const v = (id: string, name: string, extra: Partial<VendorRow> = {}): VendorRow =>
  ({ id, business_id: LAWNS, name, ...extra });

// The four vendor strings actually present on LAWNS receipts, 2026-09-02.
const SUDDERTH = v('ven-sud', 'Sudderth Brothers Contracting, Inc.');
const BWI      = v('ven-bwi', 'bwi');
const BAILEY   = v('ven-bai', 'Bailey Bark Materials, Inc.');
const LAWNSCO  = v('ven-law', 'LAWNS Tree Farm, LLC.');
const LIVE: VendorRow[] = [SUDDERTH, BWI, BAILEY, LAWNSCO];

// ══ §A NORMALIZATION MUST EQUAL THE DATABASE'S UNIQUE INDEX ══════════════════════════════════
// If these two disagree, the resolver reports "no match" and the INSERT is then rejected by a
// constraint the caller was never told about.
{
  ok(normalizeVendorName('  BWI  ') === 'bwi', 'A1: strict normalization trims and lowercases');
  ok(normalizeVendorName(null) === '', 'A2: null is the empty string, not a crash');
  ok(normalizeVendorName('Top Notch ') === 'top notch', 'A3: the live trailing-space case collapses');

  // 🔴 The index is lower(btrim(name)); btrim strips ENDS only. Strict normalization must not do
  //    more, or it claims a duplicate the database does not — and vice versa.
  ok(normalizeVendorName('Top  Notch') === 'top  notch',
    '🔴 A4 (negative): strict normalization does NOT collapse internal whitespace — it would then disagree with lower(btrim(name))');
  ok(/lower\(btrim\(name\)\)/.test(MIGRATION),
    '🔴 A5: the migration really does index lower(btrim(name)) — A4 is asserted against the actual index, not a remembered one');
  ok(/lower\(btrim\(alias\)\)/.test(MIGRATION),
    'A6: aliases are indexed the same way, so an alias cannot be duplicated by case alone');
}

// ══ §B THE LOOSE KEY IS FOR ASKING, NEVER FOR LINKING ════════════════════════════════════════
{
  ok(looseVendorKey('Bailey Bark Materials, Inc.') === 'bailey bark materials',
    'B1: a real corporate suffix and its punctuation are set aside for the SURFACING key');
  ok(looseVendorKey('Sudderth Brothers Contracting, Inc.') === 'sudderth brothers contracting',
    '🔴 B2: "Contracting" SURVIVES the fold — it is part of the name, not a corporate suffix. This corrects R-65, which records this pair as folding to ONE key; measured, it is two');
  ok(looseVendorKey('Sudderth Brothers') === 'sudderth brothers',
    'B2b: …and the shorthand is a strict PREFIX of it, which is how the resolver still surfaces the pair (§D) without a suffix hack');
  ok(looseVendorKey('Co-op Gardens') === 'co op gardens',
    '🔴 B2c: "Co-op Gardens" keeps both words. Stripping `co` anywhere rather than off the END ate half a real word in the first version of this function');
  ok(looseVendorKey('H-E-B') === 'h e b',
    '🔴 B2d: punctuation becomes a SPACE, not nothing — otherwise a hyphenated name folds differently to the spaced one and the two stores disagree');
  ok(looseVendorKey('Foo Co, Inc.') === 'foo',
    'B2e: suffixes come off repeatedly, not once');
  ok(looseVendorKey('Mcgill Farms') !== looseVendorKey('McGill'),
    'B3 (negative): "Mcgill Farms" and "McGill" do NOT reduce to one key — Farms is not a legal suffix, so this stays a question, not a merge');
  ok(emailDomain('office@athenstreefarm.com') === 'athenstreefarm.com', 'B4: email domain is extracted');
  ok(emailDomain('not-an-email') === '', 'B5 (negative): a non-email yields no domain rather than a bogus one');
  ok(emailDomain(null) === '', 'B6 (negative): null yields no domain');
}

// ══ §C THE LIVE CORPUS — every string resolves to itself and to nothing else ═════════════════
{
  let selfLinks = 0;
  for (const row of LIVE) {
    const r = resolveVendor({ capturedName: row.name, vendors: LIVE, aliases: [] });
    if (r.outcome === 'LINK' && r.vendorId === row.id) selfLinks++;
  }
  ok(selfLinks === 4, `C1: all 4 live LAWNS vendor strings link to their own row (population: 4, linked: ${selfLinks})`);

  const r = resolveVendor({ capturedName: 'bwi', vendors: LIVE, aliases: [] });
  ok(r.outcome === 'LINK' && r.matchedOn === 'name', 'C2: an exact name is a LINK on the name alone — the column is unique per tenant, so D-47 clause 1 is satisfied');

  ok(resolveVendor({ capturedName: 'BWI', vendors: LIVE, aliases: [] }).vendorId === 'ven-bwi',
    'C3: case does not defeat it');
  ok(resolveVendor({ capturedName: ' bwi ', vendors: LIVE, aliases: [] }).vendorId === 'ven-bwi',
    'C4: surrounding whitespace does not defeat it');

  // 🔴 The negative control that stops §C rubber-stamping: an unrelated name must NOT link.
  const miss = resolveVendor({ capturedName: 'Greenleaf Nursery', vendors: LIVE, aliases: [] });
  ok(miss.outcome === 'CREATE' && miss.vendorId === null,
    '🔴 C5 (negative): a vendor we have never seen is CREATE with no id — not quietly attached to the nearest row');
}

// ══ §D THE POINT OF THE BUILD — Sudderth. SURFACED, NEVER SILENTLY MERGED ═══════════════════
{
  const r = resolveVendor({ capturedName: 'Sudderth Brothers', vendors: LIVE, aliases: [] });
  ok(r.outcome === 'NEED_CONFIRMATION',
    '🔴 D1: "Sudderth Brothers" against "Sudderth Brothers Contracting, Inc." asks — it does not decide');
  ok(r.vendorId === null,
    '🔴 D2: …and binds NOTHING while asking. A NEED_CONFIRMATION carrying an id would be a silent merge wearing a question mark');
  ok(r.disposition?.candidates.some(c => c.vendorId === 'ven-sud') === true,
    'D3: the real vendor is offered as the candidate');
  ok(r.disposition?.proposed === 'CREATE',
    'D4: the cheap-to-accept default is CREATE — declining the question must never merge two firms');
  ok(/Sudderth Brothers Contracting, Inc\./.test(r.disposition?.question ?? ''),
    'D5: the question names the candidate, so it can be answered without opening another screen');

  // Both directions: capturing the LONG name when only the SHORT one is on file.
  const short = [v('ven-short', 'Sudderth Brothers')];
  const r2 = resolveVendor({ capturedName: 'Sudderth Brothers Contracting, Inc.', vendors: short, aliases: [] });
  ok(r2.outcome === 'NEED_CONFIRMATION' && r2.vendorId === null,
    '🔴 D6: the same question is asked in the other direction — containment is symmetric');

  // 🔴 The negative control: two genuinely different vendors that share a first word must NOT be
  //    offered as one. Without this, §D would pass on an implementation that asks about everything.
  const twoFarms = [v('ven-a', 'Hand Tree Farm'), v('ven-b', 'Hand Tools Depot')];
  const r3 = resolveVendor({ capturedName: 'Hand Tree Farm', vendors: twoFarms, aliases: [] });
  ok(r3.outcome === 'LINK' && r3.vendorId === 'ven-a',
    '🔴 D7 (negative): an exact match still LINKs even when a same-first-word neighbour exists — the near-match logic does not swallow a certain answer');
  const r4 = resolveVendor({ capturedName: 'Enchanted Trees', vendors: twoFarms, aliases: [] });
  ok(r4.outcome === 'CREATE',
    '🔴 D8 (negative): an unrelated name is not offered a candidate merely because some vendor exists');
}

// ══ §E ASK ONCE, KEEP FOREVER — the alias path ══════════════════════════════════════════════
{
  const aliases: VendorAliasRow[] = [
    { id: 'al-1', business_id: LAWNS, vendor_id: 'ven-sud', alias: 'Sudderth Brothers' },
  ];
  const r = resolveVendor({ capturedName: 'Sudderth Brothers', vendors: LIVE, aliases });
  ok(r.outcome === 'LINK' && r.vendorId === 'ven-sud',
    '🔴 E1: once the owner has confirmed it ONCE, the same string links silently ever after — this is the whole "ask once, keep forever" claim');
  ok(r.matchedOn === 'alias', 'E2: …and the resolution says it came from a prior human decision');

  ok(resolveVendor({ capturedName: 'sudderth brothers', vendors: LIVE, aliases }).vendorId === 'ven-sud',
    'E3: the alias is matched case-insensitively, exactly as its unique index is built');

  // Athens / KBB / KBE — one operation, three names (discovery §11).
  const athens = v('ven-ath', 'Athens Tree Farm');
  const kbbAliases: VendorAliasRow[] = [
    { id: 'al-2', business_id: LAWNS, vendor_id: 'ven-ath', alias: 'KBB Tree Farm LLC' },
    { id: 'al-3', business_id: LAWNS, vendor_id: 'ven-ath', alias: 'KBE Trucking LLC' },
  ];
  const kbb = resolveVendor({ capturedName: 'KBB Tree Farm LLC', vendors: [athens], aliases: kbbAliases });
  const kbe = resolveVendor({ capturedName: 'KBE Trucking LLC', vendors: [athens], aliases: kbbAliases });
  ok(kbb.vendorId === 'ven-ath' && kbe.vendorId === 'ven-ath',
    '🔴 E4: Athens, KBB and KBE resolve to ONE operation with three names (acceptance 6)');

  // 🔴 D-47 clause 3: a stored link is a CACHE, not a fact.
  const dangling: VendorAliasRow[] = [
    { id: 'al-9', business_id: LAWNS, vendor_id: 'ven-deleted', alias: 'Old Name' },
  ];
  const d = resolveVendor({ capturedName: 'Old Name', vendors: LIVE, aliases: dangling });
  ok(d.outcome === 'NEED_CONFIRMATION' && d.vendorId === null,
    '🔴 E5 (negative): an alias pointing at a vendor that is not there is NOT followed — a stored link is a cache, not a fact (D-47 clause 3)');

  // Negative control: an alias for a DIFFERENT string must not fire.
  ok(resolveVendor({ capturedName: 'Bailey Bark Materials, Inc.', vendors: LIVE, aliases }).vendorId === 'ven-bai',
    '🔴 E6 (negative): an alias table with one unrelated row does not redirect a name that matches its own vendor');
}

// ══ §F THE SECOND SIGNAL — D-47's four cells, on the vendor side ════════════════════════════
{
  const athens = v('ven-ath', 'Athens Tree Farm', { email: 'office@athenstreefarm.com' });
  const pool = [athens, BWI];

  // email YES + name YES → LINK, and the reasoning says two fields concurred.
  const both = resolveVendor({
    capturedName: 'Athens Tree Farm', capturedEmail: 'sales@athenstreefarm.com',
    vendors: pool, aliases: [],
  });
  ok(both.outcome === 'LINK' && both.matchedOn === 'name+email',
    'F1: name and email domain concurring is the strongest link D-47 describes');

  // 🔴 email YES + name NO → the Terrence case. CREATE, NEVER link.
  const terrence = resolveVendor({
    capturedName: 'KBB Tree Farm LLC', capturedEmail: 'office@athenstreefarm.com',
    vendors: pool, aliases: [],
  });
  ok(terrence.outcome !== 'LINK',
    '🔴 F2: a shared email domain with a DIFFERENT name never links — this is D-47s Terrence case, the one that cost nine invoices');
  ok(terrence.vendorId === null, 'F3: …and binds no id');
  ok(terrence.disposition?.candidates.some(c => c.vendorId === 'ven-ath') === true,
    '🔴 F4: …but Athens IS offered, because on the vendor side this is also the one-operation-three-names shape worth asking about');
  ok(terrence.disposition?.proposed === 'CREATE',
    'F5: and the default remains CREATE — two legal entities sharing a mailbox are still two vendors until the owner says otherwise');

  // Account number, same rule.
  const gl = v('ven-gl', 'Greenleaf', { account_number: '62171' });
  const acctBoth = resolveVendor({
    capturedName: 'Greenleaf', capturedAccountNumber: '62171', vendors: [gl], aliases: [],
  });
  ok(acctBoth.matchedOn === 'name+account', 'F6: the per-vendor account number works as the second field too');
  const acctOnly = resolveVendor({
    capturedName: 'Someone Else', capturedAccountNumber: '62171', vendors: [gl], aliases: [],
  });
  ok(acctOnly.outcome === 'NEED_CONFIRMATION' && acctOnly.vendorId === null,
    '🔴 F7 (negative): an account number alone does not bind — it identifies a RELATIONSHIP, not a company');

  // 🔴 Negative control on the second signal itself: a NON-matching email must not upgrade a link.
  const wrongDomain = resolveVendor({
    capturedName: 'Athens Tree Farm', capturedEmail: 'bob@gmail.com', vendors: pool, aliases: [],
  });
  ok(wrongDomain.outcome === 'LINK' && wrongDomain.matchedOn === 'name',
    '🔴 F8 (negative): a second signal that does NOT agree is not counted as agreement — the link stands on the name alone and says so');
}

// ══ §G THE FAULT CASES — refuse rather than guess ═══════════════════════════════════════════
{
  const dupes = [v('ven-1', 'bwi'), v('ven-2', 'BWI')];
  const r = resolveVendor({ capturedName: 'bwi', vendors: dupes, aliases: [] });
  ok(r.outcome === 'NEED_CONFIRMATION' && r.vendorId === null,
    '🔴 G1: two rows sharing one guaranteed-unique name is a DATA FAULT — not picking one arbitrarily is the entire lesson of D-47');
  // 🔴 G1b EXISTS BECAUSE A MUTANT SURVIVED G1. Deleting the collision branch entirely still left
  //    G1 green: execution fell through to the NEAR-MATCH branch, which also returns
  //    NEED_CONFIRMATION with a null id. The outcome was identical and the DIAGNOSIS was not —
  //    "these two rows should not both exist" is a different thing to tell an owner than "is this
  //    the same vendor?". Asserting the outcome alone could not tell them apart.
  ok(r.matchedOn === 'name-collision',
    '🔴 G1b: …and it is reported AS a collision, not as a near-match — the owner is told the data is faulty, not asked a question they cannot answer');
  ok(r.disposition?.candidates.length === 2, 'G2: both are shown so the owner can see the fault');

  const empty = resolveVendor({ capturedName: '   ', vendors: LIVE, aliases: [] });
  ok(empty.outcome === 'CREATE' && empty.vendorId === null,
    'G3: a blank vendor string resolves to nothing rather than to some vendor');
  // 🔴 G3b EXISTS BECAUSE A MUTANT SURVIVED G3. Removing the empty-name guard changed no outcome —
  //    the fall-through happens to reach CREATE anyway — so G3 was asserting something the code
  //    could not get wrong. What the guard actually buys is an HONEST REASON, and a caller that
  //    creates a vendor row from this must be able to tell "nothing was captured" from "a real
  //    name we have not seen". That distinction is the assertion worth having.
  ok(/[Nn]o vendor name was captured/.test(empty.reasoning),
    '🔴 G3b: …and it says NO NAME WAS CAPTURED rather than reporting a failed search for "" — an absence must not be dressed as a miss (D-9)');
  ok(!/matches ""/.test(empty.reasoning),
    'G3c (negative): the reasoning does not quote an empty string back as though it were a name');
  const nul = resolveVendor({ capturedName: null, vendors: LIVE, aliases: [] });
  ok(nul.outcome === 'CREATE' && /[Nn]o vendor name was captured/.test(nul.reasoning),
    'G4: null takes the same honest path as whitespace');

  ok(resolveVendor({ capturedName: 'bwi', vendors: [], aliases: [] }).outcome === 'CREATE',
    'G5: the first vendor ever captured is a CREATE, not an error');
}

// ══ §L THE WRITE PLAN — and the rule that an identity question never costs you a document ═══
{
  const linked = resolveVendor({ capturedName: 'bwi', vendors: LIVE, aliases: [] });
  const p1 = planVendorWrite(linked, null, 'bwi');
  ok(p1.linkToVendorId === 'ven-bwi' && p1.createVendorNamed === null,
    'L1: a LINK links, and creates nothing');
  ok(p1.recordAlias === null,
    'L2 (negative): …and records no alias — the name already IS the vendor, and an alias equal to the canonical name is noise the unique index would later trip over');

  const fresh = resolveVendor({ capturedName: 'Greenleaf', vendors: LIVE, aliases: [] });
  const p2 = planVendorWrite(fresh, null, 'Greenleaf');
  ok(p2.createVendorNamed === 'Greenleaf' && p2.linkToVendorId === null,
    'L3: a CREATE creates, with the captured spelling as the canonical name');

  // 🔴 THE RULE THAT MATTERS MOST HERE.
  const asks = resolveVendor({ capturedName: 'Sudderth Brothers', vendors: LIVE, aliases: [] });
  const p3 = planVendorWrite(asks, null, 'Sudderth Brothers');
  ok(p3.linkToVendorId === null && p3.createVendorNamed === null && p3.recordAlias === null,
    '🔴 L4: an UNANSWERED identity question writes NOTHING — no link, no vendor, no alias');
  ok(/unanswered/.test(p3.reasoning),
    'L5: …and says so, so a null vendor_id is legible as "not yet answered" rather than as a bug');

  const p4 = planVendorWrite(asks, { kind: 'same-as', vendorId: 'ven-sud' }, 'Sudderth Brothers');
  ok(p4.linkToVendorId === 'ven-sud', 'L6: answering "same as" links to the confirmed vendor');
  ok(p4.recordAlias === 'Sudderth Brothers',
    '🔴 L7: …AND records the alias. Without this the identical question returns on the next document, and "ask once, keep forever" is just "ask"');

  const p5 = planVendorWrite(asks, { kind: 'new' }, 'Sudderth Brothers');
  ok(p5.createVendorNamed === 'Sudderth Brothers' && p5.linkToVendorId === null,
    'L8: answering "different vendor" creates a separate one');

  // 🔴 Negative control: a choice naming a vendor we never offered is refused, not honoured.
  const p6 = planVendorWrite(asks, { kind: 'same-as', vendorId: 'ven-bwi' }, 'Sudderth Brothers');
  ok(p6.linkToVendorId === null,
    '🔴 L9 (negative): a "same-as" naming a vendor that was NOT among the surfaced candidates is refused — an answer to a question we did not ask is not consent');

  const p7 = planVendorWrite(resolveVendor({ capturedName: '  ', vendors: LIVE, aliases: [] }), null, '  ');
  ok(p7.createVendorNamed === null,
    'L10 (negative): a blank name never creates a vendor, even on the CREATE path');
}

// ══ §H THE SCREEN — both vendors appear, and the preferred one is not sorted to the top ═════
{
  const a = v('ven-a', 'Alpha Trees');
  const z = v('ven-z', 'Zeta Trees', { preferred: true, preference_note: 'Better stock quality.' });
  const ordered = orderVendorsForDisplay([z, a]);
  ok(ordered.length === 2, 'H1: nothing is filtered out — a preference marks, it does not hide');
  ok(ordered[0].id === 'ven-a',
    '🔴 H2: the PREFERRED vendor is NOT hoisted to the top. A sort is the quiet form of a filter, and when the preferred vendor is out of stock the other row is the answer');
  ok(orderVendorsForDisplay([a, z])[0].id === 'ven-a', 'H3: …and the order is stable regardless of input order');

  // §6 r18 — the header is a claim that must hold for every row state the section can contain.
  ok(vendorListHeading([], { canSetPreference: true }).heading === 'Vendors',
    'H4: the heading is true of an empty list');
  ok(!/preferred/i.test(vendorListHeading([], { canSetPreference: true }).subhead),
    '🔴 H5 (negative): an EMPTY list does not talk about preference — a header claiming something about rows that do not exist is the Contractors-card defect');
  ok(/None is marked preferred/.test(vendorListHeading([a], { canSetPreference: true }).subhead),
    'H6: with no preference set, the subhead says so plainly rather than implying one exists');
  ok(/Zeta Trees is marked preferred/.test(vendorListHeading([a, z], { canSetPreference: true }).subhead),
    'H7: with one set, it is named');
  ok(/2 are marked preferred/.test(
      vendorListHeading([{ ...a, preferred: true }, z], { canSetPreference: true }).subhead),
    'H8: with several, the claim stays true instead of naming one of them');

  // 🔴 permission-aware: never say "turn one on" to someone who may not.
  const asManager = vendorListHeading([a], { canSetPreference: false }).subhead;
  ok(!/yet/.test(asManager),
    '🔴 H9 (negative): read as a MANAGER, the subhead drops the "yet" that invites an action she is not permitted to take');
}

// ══ §I THE PROHIBITIONS, ASSERTED AGAINST THE SOURCE ════════════════════════════════════════
// These are the guarantees a future edit is most likely to break quietly.
{
  ok(!/\bpreferred\b[^\n]*\bsort\b|sortBy.*preferred|preferred.*localeCompare/i.test(CODE_ONLY),
    'I1: nothing in the module sorts by preference');
  ok(/localeCompare/.test(CODE_ONLY), 'I2: …the display order is a name comparison, and it exists');

  // The module must not invent a preference from data. R-54 / the Ignition lesson.
  //
  // 🔴 THIS ASSERTION WAS WRONG TWICE BEFORE IT WAS RIGHT, AND THE SECOND WAY IS THE INSTRUCTIVE
  // ONE. First it scanned the raw file and flagged the PROSE explaining why price is never used.
  // Stripping comments fixed that and it went red again — on `'Both are cheap; a wrong …'`, a
  // RUNTIME STRING in the disposition. The lesson is that "the word never appears" was never the
  // guarantee: the guarantee is that no code path READS A COST-SHAPED FIELD. A vendor's fee-facing
  // English is not a price comparison, and distorting that sentence to satisfy a crude regex would
  // have been changing the product to protect the probe.
  const COST_FIELD = /\.(price|cost|unit_cost|amount|lead_?time)\b|\b(price|cost|unit_cost|lead_?time)\s*[:?]/i;
  ok(!COST_FIELD.test(CODE_ONLY),
    '🔴 I3: no code path READS a price / cost / amount / lead-time field — a preference DERIVED from a number would invert Terrys decision, who prefers the DEARER vendor because the stock is better');
  ok(COST_FIELD.test("const x = row.price;"),
    '🔴 I3b (control): the I3 pattern DOES match a real cost-field read — without this, I3 could be passing because the regex matches nothing at all');
  ok(/PURPOSE/.test(SELF) && !/PURPOSE/.test(CODE_ONLY),
    '🔴 I3c (control): the comment stripper genuinely strips — a header word present in the file is absent from CODE_ONLY, so the §I probes are not passing on an emptied string');

  // R-50: no document type is derived, and the captured string is never rewritten.
  ok(!/doc_type|document_type|classif/i.test(CODE_ONLY),
    'I4: no document type is derived here');

  // The strict/loose split is the safety argument; assert the loose key cannot reach a LINK.
  const linkSites = CODE_ONLY.split('\n').filter(l => /outcome: 'LINK'/.test(l)).length;
  ok(linkSites === 2,
    `🔴 I5: there are exactly TWO places that can emit a LINK (alias hit, exact name) — found ${linkSites}. A third would be a new way to bind an identity, and it must be read before it is trusted`);
  ok(!/looseVendorKey[\s\S]{0,400}outcome: 'LINK'/.test(CODE_ONLY),
    '🔴 I6 (negative): the LOOSE key never produces a LINK — it is an inference, so its only permitted output is a question');
}

// ══ §J THE MIGRATION'S OWN GUARANTEES ═══════════════════════════════════════════════════════
{
  ok(/ADD COLUMN IF NOT EXISTS vendor_id/.test(SQL_ONLY), 'J1: receipts.vendor_id is added');
  ok(!/DROP COLUMN[^\n]*vendor\b/.test(SQL_ONLY),
    '🔴 J2 (negative): receipts.vendor (text) is NEVER dropped — R-50, and the captured string is evidence');
  ok(/ON DELETE SET NULL/.test(SQL_ONLY),
    'J3: deleting a vendor must not destroy the receipt that named it');
  // 🔴 J4 WAS REWRITTEN BECAUSE A MUTANT SURVIVED IT. The first form asserted that the guard
  //    function name appeared AND that the words "BEFORE INSERT ON vendors" appeared — two facts
  //    that are both still true when the trigger is RENAMED to something that never fires, because
  //    they sit on different lines. Presence of two strings is not the same as one being BOUND to
  //    the other. These assert the trigger name and its timing as a single pattern.
  ok(/CREATE TRIGGER vendors_preference_owner_only\s+BEFORE UPDATE ON vendors/.test(SQL_ONLY),
    '🔴 J4a: the UPDATE guard is a trigger BOUND to BEFORE UPDATE on vendors, not merely a function that exists');
  ok(/CREATE TRIGGER vendors_preference_owner_only_insert\s+BEFORE INSERT ON vendors/.test(SQL_ONLY),
    '🔴 J4b: …and the INSERT guard is bound too — a manager must not create a vendor ALREADY preferred, which an UPDATE-only guard would happily allow');
  ok(/ERRCODE = '42501'/.test(SQL_ONLY),
    'J4c: the refusal raises insufficient_privilege — the same code a policy refusal raises, so the client handles one shape');
  ok(/vendors_member_select/.test(SQL_ONLY),
    '🔴 J5: a MANAGER can read the vendor list, or Terrys requirement fails on its own terms');
  ok(!/costs:read/.test(SQL_ONLY),
    '🔴 J6 (negative): no EXECUTABLE clause gates on costs:read — a vendors NAME is not its cost basis, and binding them would hide the mark from Lauren');
  ok(/costs:read/.test(MIGRATION),
    '🔴 J6b (control): the string DOES appear in the migration prose, explaining why it is not used — so J6 is testing the SQL/comment split it claims to, not passing on an emptied string');
  ok(!/CREATE POLICY vendors_member_delete/.test(SQL_ONLY),
    'J7 (negative): there is no member DELETE policy — deletion is owner-only, fail-closed on the one verb that destroys history');
  ok(/ENABLE ROW LEVEL SECURITY/.test(SQL_ONLY) && (SQL_ONLY.match(/ENABLE ROW LEVEL SECURITY/g) ?? []).length === 2,
    'J8: RLS is enabled on BOTH new tables — a table with policies and RLS off is wide open');
}

// ══ §K WHO COUNTS AS AN OWNER — the assertion that caught a shipped-shaped defect ════════════
// Measured live 2026-09-02 (3 businesses, 8 member rows): at LAWNS, `businesses.owner_id` is David
// and Lauren Bishop holds role=OWNER with a DIFFERENT user_id. A first draft of the migration
// tested owner_id alone and would have refused her — reproducing the defect
// 20260828_owner_role_carries_authority.sql exists to fix, on a fourth surface.
{
  ok(/CREATE OR REPLACE FUNCTION public\.is_business_owner/.test(SQL_ONLY),
    'K1: owner authority is ONE named predicate, not an inline test copied into each trigger');

  const fn = SQL_ONLY.slice(SQL_ONLY.indexOf('FUNCTION public.is_business_owner'),
                            SQL_ONLY.indexOf('REVOKE ALL ON FUNCTION public.is_business_owner'));
  ok(/owner_id = auth\.uid\(\)/.test(fn),
    'K2: the account holder is an owner');
  ok(/upper\(role\) = 'OWNER'/.test(fn) && /active = true/.test(fn),
    "🔴 K3: …and so is an ACTIVE OWNER-ROLE member who is not the account holder. Without this disjunct Lauren Bishop — role OWNER, not businesses.owner_id, measured live — cannot set the preference on her own tenant");
  ok(/business_members/.test(fn),
    'K4: the role half really reads the membership table rather than asserting the role from somewhere else');

  // 🔴 Both triggers must go through the predicate. An inline owner_id test surviving in either one
  //    is the defect re-entering by the back door, and it would look correct in review.
  const inlineOwnerTests = (SQL_ONLY.match(/owner_id = auth\.uid\(\)/g) ?? []).length;
  ok(inlineOwnerTests === 1,
    `🔴 K5: owner_id = auth.uid() appears EXACTLY ONCE in executable SQL — inside the predicate — found ${inlineOwnerTests}. A second occurrence means a trigger is testing the account holder directly again`);
  ok((SQL_ONLY.match(/public\.is_business_owner\(NEW\.business_id\)/g) ?? []).length === 2,
    'K6: both the INSERT and the UPDATE guard call the predicate');

  // The divergence from 20260828 is RECORDED, not silent (§6 r10). Asserted against the raw file,
  // because a recorded divergence lives in prose by definition.
  ok(/20260828/.test(MIGRATION) && /CONVERGENCE TRIGGER/.test(MIGRATION),
    '🔴 K7: the divergence from 20260828s "not keyed on role" guidance is stated in the file WITH a convergence trigger — no silent divergence (§6 r10)');
}

console.log(`\nvendorIdentity: ${passed} passed, ${failed} failed`);
console.log('  populations — fixtures from the live 2026-09-02 census: 36 receipt rows / 3 tenants / 8 distinct vendor strings; LAWNS 17 rows / 4 vendors. 0 duplicate spellings exist in the data today, which is why §D/§E/§F are constructed rather than sampled.');
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
