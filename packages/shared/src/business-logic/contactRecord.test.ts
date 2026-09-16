/**
 * ── contactRecord — the vCard shape, and the losses it is supposed to make impossible ────────
 *
 * WHAT THIS GUARDS (ledger #335, David's build prompt 2026-09-15):
 *   · 🔴 NOTHING IS CHOSEN BETWEEN. #331's `phone-would-be-lost` collision — 5 records where
 *     recovering a street meant discarding a phone held nowhere else — must be UNREACHABLE by
 *     construction. §B drives that exact record shape and asserts BOTH values survive.
 *   · #331's per-record street rule is PRESERVED, not re-derived: a blanket "Line2 is the street"
 *     is wrong in both directions, and §C holds both ends of that.
 *   · 🔴 A VALUE WE CANNOT READ IS SURFACED, NEVER GUESSED (David, ②). §D: the comma-packed email
 *     is imported WHOLE and reported; an unreadable address line is left alone and reported.
 *   · §G widens `customerAddresses.test.ts` §F — the writers of all three contact tables are an
 *     ENUMERATED set, so a fifth writer fails the build. §F could never have seen one: it reads
 *     the migration corpus, and the importer writes through the client.
 *
 * 🔴 EVERY PROBE HOLDS BOTH DIRECTIONS (§6 r19 / R-33 — *a check that cannot disagree is not a
 * check*). Each rule is driven with a record that must trigger it AND one that must not, because
 * a probe that only ever sees the passing case cannot fail.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/contactRecord.test.ts --bundle --platform=node --format=cjs | node
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildContactRecord, resolveStreet, emailHoldsSeveral,
  normalizePhoneValue, normalizeEmailValue,
  emptyContactTally, tallyContactRecord,
  CONTACT_FINDING_REASON, type ContactFindingKind,
  contactSeedStatements, historySourceViolation, CONTACT_LIST_TABLES,
} from './contactRecord';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg);
}

const phone = (n: string) => ({ FreeFormNumber: n });
const rec = (o: Record<string, unknown>) => ({ Id: '1', DisplayName: 'Test', ...o });

// ══ A. NORMALISATION — the same rule the database trigger applies ═══════════════════════════
{
  ok(normalizePhoneValue('(512) 456-3632') === '5124563632', 'A1 a phone normalises to digits');
  ok(normalizePhoneValue('512-456-3632') === '5124563632', 'A2 a different spelling normalises the SAME');
  ok(normalizePhoneValue('(512) 456-3632') === normalizePhoneValue('512.456.3632'),
    'A3 🔴 two spellings of one number are ONE number — what makes re-import idempotent');
  ok(normalizeEmailValue('  David@Trace-Enterprises.COM ') === 'david@trace-enterprises.com',
    'A4 an email normalises to trimmed lower-case');
  // The negative control: normalisation must NOT collapse two DIFFERENT numbers.
  ok(normalizePhoneValue('5124563632') !== normalizePhoneValue('5124563633'),
    'A5 two different numbers stay different (the probe can fail)');
}

// ══ B. 🔴 THE COLLISION #331 COULD NOT RESOLVE — AND IT IS GONE ══════════════════════════════
// The exact `phone-would-be-lost` shape, measured on 5 real LAWNS records: BillAddr.Line1 holds a
// phone, Line2 holds the street, and the record ALREADY holds a DIFFERENT number in PrimaryPhone.
// Under one phone column these two rules genuinely collided and David was owed a ruling.
{
  const r = buildContactRecord(rec({
    PrimaryPhone: phone('(512) 111-2222'),
    BillAddr: { Line1: '(737) 348-9534', Line2: '501 County Road 107', City: 'Georgetown', PostalCode: '78628' },
  }));
  const values = r.phones.map(p => normalizePhoneValue(p.value)).sort();
  ok(values.length === 2, `B1 🔴 BOTH numbers survive — nothing is chosen between (got ${values.length})`);
  ok(values.includes('5121112222'), 'B2 the declared PrimaryPhone survives');
  ok(values.includes('7373489534'), 'B3 🔴 the number typed into the street line survives TOO');
  ok(r.addresses[0]?.line1 === '501 County Road 107',
    `B4 🔴 AND the street is recovered in the same pass (got ${r.addresses[0]?.line1})`);
  ok(r.phones.find(p => p.source === 'quickbooks:PrimaryPhone')?.is_primary === true,
    'B5 the declared field is primary; the recovered one is not');
  ok(r.phones.find(p => p.source === 'quickbooks:BillAddr.Line1')?.label === 'other',
    'B6 🔴 a number from a street line is labelled `other` — we do not know its KIND, only its source');
  // The negative control: the SAME number in both places must NOT produce two rows.
  const dup = buildContactRecord(rec({
    PrimaryPhone: phone('(737) 348-9534'),
    BillAddr: { Line1: '737-348-9534', Line2: '501 County Road 107' },
  }));
  ok(dup.phones.length === 1,
    `B7 🔴 the same number in two places is ONE row — 474 of the 484 are this case (got ${dup.phones.length})`);
  ok(dup.findings.filter(f => f.kind === 'phone-recovered-from-address').length === 0,
    'B8 and nothing is REPORTED as recovered when the number was already held');
}

// ══ C. #331's PER-RECORD STREET RULE, BOTH DIRECTIONS ═══════════════════════════════════════
// A blanket "Line2 is the street" writes a phone over a correct street on 6 records and NULLs the
// street on 953. Both ends are held here so neither can regress.
{
  const line1Street = buildContactRecord(rec({ BillAddr: { Line1: '400 Honeycomb Mesa', Line2: '(512) 456-3632', City: 'Leander' } }));
  ok(line1Street.addresses[0]?.line1 === '400 Honeycomb Mesa',
    'C1 🔴 Line1 IS the street on 962 records — a blanket Line2 rule would have broken them');
  ok(line1Street.phones.some(p => normalizePhoneValue(p.value) === '5124563632'),
    'C2 and the phone in Line2 is still taken into the phone list');
  ok(line1Street.addresses[0]?.line2 === null,
    'C3 🔴 a phone is NOT kept as line2 — it is in the phone list, and one value in two places is STD-011');

  const line2Street = buildContactRecord(rec({ BillAddr: { Line1: '(737) 348-9534', Line2: '501 County Road 107' } }));
  ok(line2Street.addresses[0]?.line1 === '501 County Road 107',
    'C4 Line2 IS the street on 448 records');

  const noStreet = buildContactRecord(rec({ BillAddr: { Line1: '(737) 348-9534', City: 'Georgetown' } }));
  ok(noStreet.addresses.length === 0,
    'C5 🔴 a block with no readable street imports NO address — an honest absence beats a guess (D-9)');
  ok(noStreet.findings.some(f => f.kind === 'no-street-found'),
    'C6 and it is REPORTED rather than silently dropped');

  // `resolveStreet` directly, with its own negative control.
  ok(resolveStreet({ Line1: '123 Main St' })?.from === 'Line1', 'C7 resolveStreet finds Line1');
  ok(resolveStreet({ Line1: '(512) 456-3632', Line2: '123 Main St' })?.from === 'Line2', 'C8 …and falls through to Line2');
  ok(resolveStreet({ Line1: '(512) 456-3632' }) === null, 'C9 …and returns NULL rather than a phone');
  ok(resolveStreet(null) === null, 'C10 a missing block is null, not a throw');
}

// ══ D. ✏️ SPLIT, AND REPORT (David, 2026-09-16 — superseding ② "report, do not parse") ════════
// *"The email field holding three addresses becomes three email rows."* The finding still fires so
// the owner can fix it at source; the split is safe only when EVERY piece is an address.
{
  const packed = buildContactRecord(rec({
    PrimaryEmailAddr: { Address: 'invoices@davey.com, michelle.atnip@davey.com, michael.presta@davey.com' },
  }));
  ok(packed.emails.length === 3 && packed.emails.filter(e => e.is_primary).length === 1 && packed.emails[0].is_primary,
    `D1 🔴 a comma-packed email becomes one row per address, the first primary (got ${packed.emails.length})`);
  ok(packed.emails.map(e => e.value).join('|') === 'invoices@davey.com|michelle.atnip@davey.com|michael.presta@davey.com',
    'D2 every address is kept, in order — nothing is discarded');
  const labelled = buildContactRecord(rec({ PrimaryEmailAddr: { Address: 'Jane: jane@example.com' } }));
  ok(labelled.emails.length === 1 && labelled.emails[0].value === 'Jane: jane@example.com',
    'D2b a field that is NOT all addresses is kept WHOLE — splitting it would drop "Jane:"');
  ok(packed.findings.some(f => f.kind === 'email-holds-several'),
    'D3 🔴 and it is REPORTED so the owner can fix it in QuickBooks');
  // The negative control: an ordinary address must NOT be reported.
  const single = buildContactRecord(rec({ PrimaryEmailAddr: { Address: 'terry@lawnstrees.com' } }));
  ok(single.findings.length === 0,
    `D4 an ordinary email raises NO finding — the check can stay silent (got ${single.findings.length})`);
  ok(emailHoldsSeveral('a@b.com') === false && emailHoldsSeveral('a@b.com, c@d.com') === true,
    'D5 the detector holds both directions');

  const unreadable = buildContactRecord(rec({ BillAddr: { Line1: '123 Main St', Line2: 'ZZZQQ' } }));
  ok(unreadable.findings.some(f => f.kind === 'address-line-unreadable'),
    'D6 an address line we cannot place is REPORTED');
  ok(unreadable.addresses[0]?.line1 === '123 Main St',
    'D7 …and the street it sits beside is still imported — a finding never blocks (R-57)');

  // Every finding kind carries a sentence written for Lauren, and it must not be a cross-reference.
  for (const [kind, reason] of Object.entries(CONTACT_FINDING_REASON)) {
    ok(reason.length > 40 && !/^(see|as )/i.test(reason),
      `D8 the reason for \`${kind}\` is a usable sentence, not a pointer`);
  }
}

// ══ E. ADDRESSES — the fold, and the `kind` that carries D-41's surviving redline ════════════
{
  const same = buildContactRecord(rec({
    BillAddr: { Line1: '501 County Road 107', City: 'Georgetown', PostalCode: '78628' },
    ShipAddr: { Line1: '501 County Road 107', City: 'Georgetown', PostalCode: '78628' },
  }));
  ok(same.addresses.length === 1,
    `E1 🔴 one yard is ONE row — 725 of 736 records are this case (got ${same.addresses.length})`);
  ok(same.addresses[0].kind === 'both', 'E2 …and `kind` says it serves both purposes');

  const differ = buildContactRecord(rec({
    BillAddr: { Line1: '400 Honeycomb Mesa', City: 'Leander' },
    ShipAddr: { Line1: '1 Job Site Rd', City: 'Dripping Springs' },
  }));
  ok(differ.addresses.length === 2,
    `E3 🔴 a genuine second address is TWO rows — 11 records (got ${differ.addresses.length})`);
  ok(differ.addresses.filter(a => a.is_default).length === 1, 'E4 exactly one row is the default');
  ok(differ.addresses.find(a => a.is_default)?.kind === 'billing',
    'E5 🔴 the BILLING address is the default — it is what customers.billing_* derives from');

  const shipOnly = buildContactRecord(rec({ ShipAddr: { Line1: '1 Job Site Rd', City: 'Dripping Springs' } }));
  ok(shipOnly.addresses.length === 1 && shipOnly.addresses[0].is_default,
    'E6 a ship-only record still marks a default, or the derived column has nothing to read');
  ok(shipOnly.addresses[0].kind === 'shipping',
    'E7 🔴 …but it stays `shipping` — a job site must NEVER become the billing address (D-41)');

  const suite = buildContactRecord(rec({ BillAddr: { Line1: '400 Honeycomb Mesa', Line2: 'Suite 200' } }));
  ok(suite.addresses[0].line2 === 'Suite 200', 'E8 a real second line is KEPT as line2');
}

// ══ F. THE TALLY IS TOTAL — a new finding kind cannot go uncounted ══════════════════════════
{
  const t0 = emptyContactTally();
  const kinds = Object.keys(CONTACT_FINDING_REASON) as ContactFindingKind[];
  ok(kinds.every(k => k in t0.findings),
    'F1 🔴 every finding kind has a counter — #331\'s BRANCH_TALLY_KEY discipline');
  ok(Object.keys(t0.findings).length === kinds.length,
    'F2 …and no counter exists for a kind that does not');
  const t1 = tallyContactRecord(t0, buildContactRecord(rec({
    PrimaryPhone: phone('(512) 111-2222'), Mobile: phone('(512) 333-4444'),
    BillAddr: { Line1: '400 Honeycomb Mesa' },
  })));
  ok(t1.phoneRows === 2 && t1.recordsWithSeveralPhones === 1, 'F3 the tally counts rows and multi-value records');
  ok(t0.phoneRows === 0, 'F4 …and tallying does not mutate the tally handed in');
}

// ══ G. 🔴 THE WRITER SET IS ENUMERATED — widening customerAddresses.test.ts §F ═══════════════
// §F governs which MIGRATIONS may seed `customer_addresses` — since 2026-09-16, only a declared
// one, and never from history. But §F reads `.sql` files, and the importer writes through the
// client — so a corpus probe alone would say nothing about the writer that populates the table on
// every import run. The client writers are named here instead.
// ✏️ CORRECTED 2026-09-16: this comment said §F's *"no migration seeds"* rule *"stays true"*. It
// stopped being true when `20260915` §5b began seeding all three lists, and the rule itself was
// wrong — §4 forbade HISTORY as the source, not a seed (ledger #335).
{
  const SRC = 'packages/shared/src';
  const APP = 'packages/cultivar-os';
  const CONTACT_TABLES = ['customer_phones', 'customer_emails', 'customer_addresses'];
  /** Every file permitted to write a contact table, and WHY. Asserts in both directions. */
  // ✏️ 2026-09-16: `customerAddresses.ts` left this list — its two statements moved into
  // `contactWriter` (David: *"every writer … goes through contactWriter"*). One file, three tables.
  const DECLARED_WRITERS: Record<string, string> = {
    'packages/shared/src/business-logic/contactWriter.ts':
      'the contact-record writer: the ONE path that turns buildContactRecord output into rows',
  };

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
      const p = join(dir, name);
      try {
        if (readdirSync(p).length >= 0) walk(p, out);
      } catch { if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p); }
    }
    return out;
  };
  const files = [...walk(join(process.cwd(), SRC)), ...walk(join(process.cwd(), APP))];
  ok(files.length > 50, `G1 the source tree was READ (${files.length} files) — the probe reached its target`);

  const writers: string[] = [];
  for (const abs of files) {
    const body = readFileSync(abs, 'utf8');
    const rel = abs.slice(abs.indexOf('packages/'));
    for (const t of CONTACT_TABLES) {
      // A WRITE is `.from('<table>')` followed by insert/update/upsert/delete on the same chain.
      const re = new RegExp(`from\\(\\s*['"]${t}['"]\\s*\\)[\\s\\S]{0,200}?\\.(insert|update|upsert|delete)\\(`);
      if (re.test(body) && !writers.includes(rel)) writers.push(rel);
    }
  }
  const undeclared = writers.filter(w => !(w in DECLARED_WRITERS));
  ok(undeclared.length === 0,
    `G2 🔴 every writer of a contact table is DECLARED (undeclared: ${undeclared.join(', ') || 'none'})`);
  const stale = Object.keys(DECLARED_WRITERS).filter(d => !writers.includes(d));
  ok(stale.length === 0,
    `G3 🔴 …and the declaration PRUNES ITSELF — a declared writer that no longer writes FAILS (stale: ${stale.join(', ') || 'none'})`);
  // The negative control: the predicate must still be able to SEE a real write.
  const planted = `db.from('customer_phones').insert({ value: 'x' })`;
  ok(new RegExp(`from\\(\\s*['"]customer_phones['"]\\s*\\)[\\s\\S]{0,200}?\\.(insert|update|upsert|delete)\\(`).test(planted),
    'G4 the writer probe can detect a real write');
  const readOnly = `db.from('customer_phones').select('*')`;
  ok(!new RegExp(`from\\(\\s*['"]customer_phones['"]\\s*\\)[\\s\\S]{0,200}?\\.(insert|update|upsert|delete)\\(`).test(readOnly),
    'G5 …and does NOT fire on a read');

  // 🔴 G6 — THE EVASION THIS PROBE HIT ON ITS FIRST RUN, NOW ASSERTED.
  // `contactWriter.ts` was first written as a loop over `[{table:'customer_phones'},…]` calling
  // `db.from(table)`. Every check above passed and the file wrote three tables — tech-debt #182's
  // class: a probe that cannot reach its target reports the same as one that passed. A file that
  // mentions a contact table may not reach a table through a VARIABLE, because a dynamic name is
  // exactly what makes the enumeration above unable to bound it.
  // ⚠️ COMMENTS ARE STRIPPED FIRST, AND THAT IS NOT TIDINESS — THE PROBE CAUGHT ITSELF ON ITS
  // SECOND RUN. `contactWriter.ts`'s own header EXPLAINS the dynamic-name defect and quotes
  // `db.from(table)` while containing no such call, so the check reported the file that documents
  // the hazard as the file that commits it. That is tech-debt #146's shape — a probe matching its
  // own file's PROSE — and `customerAddresses.test.ts` §F strips comments for the same reason.
  const stripComments = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  const dynamicFrom: string[] = [];
  for (const abs of files) {
    const body = stripComments(readFileSync(abs, 'utf8'));
    const rel = abs.slice(abs.indexOf('packages/'));
    if (!CONTACT_TABLES.some(t => body.includes(t))) continue;
    // `.from(` followed by anything that is not a quote — an identifier, a template literal, a call.
    if (/\.from\(\s*[^'"\s)]/.test(body)) dynamicFrom.push(rel);
  }
  ok(dynamicFrom.length === 0,
    `G6 🔴 no file touching a contact table reaches one through a VARIABLE (found: ${dynamicFrom.join(', ') || 'none'})`);
  ok(/\.from\(\s*[^'"\s)]/.test("db.from(table).upsert(rows)"),
    'G7 the dynamic-name probe can detect a real one');
  ok(!/\.from\(\s*[^'"\s)]/.test("db.from('customer_phones').upsert(rows)"),
    'G8 …and does NOT fire on a literal');
  ok(!/\.from\(\s*[^'"\s)]/.test(stripComments("// db.from(table) is the hazard\nok();")),
    'G9 🔴 …and a comment DESCRIBING the hazard is not the hazard (the #146 case, held)');
}

// ══ L. 🔴 NO CODE WRITES A CONTACT FIELD ONTO `customers` (David, 2026-09-16) ═════════════════
// The database guard (20260915 §5e) refuses such a write at run time; this catches the LITERAL
// form at build time, before anyone meets the refusal at a counter. A payload built in a variable
// is not visible here — the guard, and the PGlite writer harness, are the backstop for that.
{
  const SRC = 'packages/shared/src';
  const APP = 'packages/cultivar-os';
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
      const p = join(dir, name);
      try { if (readdirSync(p).length >= 0) walk(p, out); }
      catch { if (/\.(tsx?|mjs|js)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p); }
    }
    return out;
  };
  const FLAT = /\b(phone|email|billing_line1|billing_line2|billing_city|billing_state|billing_zip)\s*:/;
  const writeRe = /from\(\s*['"]customers['"]\s*\)\s*\.(insert|update|upsert)\(\s*\{([\s\S]{0,600}?)\}\s*\)/g;
  const found: string[] = [];
  const files = [...walk(join(process.cwd(), SRC)), ...walk(join(process.cwd(), APP)), ...walk(join(process.cwd(), 'scripts'))];
  ok(files.length > 50, `L1 the source tree was READ (${files.length} files)`);
  for (const abs of files) {
    const body = readFileSync(abs, 'utf8');
    for (const m of body.matchAll(writeRe)) if (FLAT.test(m[2].replace(/\/\/.*$/gm, ''))) found.push(abs.slice(abs.indexOf('packages/') >= 0 ? abs.indexOf('packages/') : abs.indexOf('scripts/')));
  }
  ok(found.length === 0, `L2 🔴 no literal customers insert/update carries phone/email/billing_* (found: ${found.join(', ') || 'none'})`);
  const planted = "db.from('customers').update({ phone: x, notes: y })";
  ok([...planted.matchAll(writeRe)].some(m => FLAT.test(m[2])), 'L3 the probe can SEE a real direct write (negative control)');
  const allowed = "db.from('customers').update({ notes: y, tax_exempt: true })";
  ok(![...allowed.matchAll(writeRe)].some(m => FLAT.test(m[2])), 'L4 …and does not fire on a write of other fields');
}

// ══ H. THE MIGRATION SAYS WHAT THIS MODULE ASSUMES ══════════════════════════════════════════
{
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260915_contact_record.sql'), 'utf8');
  const body = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  ok(/CREATE TABLE IF NOT EXISTS public\.customer_phones/.test(body), 'H1 the phones table is created');
  ok(/CREATE TABLE IF NOT EXISTS public\.customer_emails/.test(body), 'H2 the emails table is created');
  ok(/ADD COLUMN IF NOT EXISTS kind/.test(body), 'H3 customer_addresses gains `kind`');
  ok(/customer_addresses_kind_check/.test(body),
    'H4 🔴 the kind vocabulary is a NAMED constraint — an inline CHECK is auto-named and ungreppable (tech-debt #91)');
  ok(!/shipping_/.test(body), 'H5 🔴 no `shipping_*` column anywhere — D-41\'s surviving redline');
  // 🔴 H6 WAS "this migration SEEDS NOTHING". Inverted 2026-09-16 (ledger #335): the derivation this
  // migration installs recomputes all six flat fields from the three lists, and all three start
  // EMPTY — so without a seed the first list write blanks every customer's address, phone and email.
  const seeds = contactSeedStatements(sql);
  const seeded = [...new Set(seeds.map(st => (st.match(/customer_(phones|emails|addresses)/i) ?? [''])[0].toLowerCase()))].sort();
  ok(seeded.join(',') === [...CONTACT_LIST_TABLES].sort().join(','),
    `H6 🔴 the MOVE seeds ALL THREE lists — seeding only one leaves the sync blanking the other two (seeded: ${seeded.join(', ') || 'none'})`);
  const bad = seeds.map(st => historySourceViolation(st)).filter(v => v !== null);
  ok(seeds.length > 0 && bad.length === 0,
    `H6b 🔴 20260911b §4 FORBIDS HISTORY AS THE SOURCE, NOT A SEED — every seed here reads FROM public.customers and names no delivery, order or invoice table (${bad.join(' | ') || 'none'})`);
  const iNorm = body.indexOf('CREATE TRIGGER trg_customer_emails_normalize');
  const iSeed = body.search(/insert\s+into\s+public\.customer_/i);
  const iSync = body.indexOf('CREATE TRIGGER trg_customer_phones_sync');
  ok(iNorm > -1 && iSeed > iNorm && iSync > iSeed,
    `H6c 🔴 the seed sits AFTER normalize (or value_norm is NULL and the idempotence index covers nothing) and BEFORE sync (or one seed blanks what the next has not reached) — at ${iNorm} < ${iSeed} < ${iSync}`);
  ok(/REFUSED: % customer\(s\) hold a billing address/.test(body),
    'H6d the migration REFUSES rather than install the sync over a flat value with no list row behind it');
  ok(/is_primary DESC, created_at ASC/.test(body),
    'H7 🔴 the derivation falls back past the primary — retiring it must not blank a live column');
  ok(/DROP COLUMN/.test(body) === false,
    'H8 this migration drops NOTHING — the legacy four fall in the repoint, not here');
  // The negative control for H6, so a stripped-comment predicate is proven able to see a real seed.
  ok(contactSeedStatements("INSERT INTO public.customer_phones (value) VALUES ('x');").length === 1,
    'H9 the seed probe can detect a real seed');
  ok(historySourceViolation("INSERT INTO public.customer_emails (customer_id, value) SELECT customer_id, email FROM public.orders") !== null,
    'H10 🔴 and H6b can disagree — an email list seeded FROM orders is refused');
}

console.log(`\ncontactRecord: ${passed} passed, ${failed} failed`);
if (failed > 0) { failures.forEach(f => console.error('  \u2717 ' + f)); process.exit(1); }
