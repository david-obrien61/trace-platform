/**
 * -- mutants-vendor-identity -- does the probe suite actually catch anything? ------------------
 *
 * PURPOSE:      R-33 / CLAUDE.md section 6 rule 19: a check that cannot disagree is not a check.
 *               This breaks one guarantee at a time and requires the suite to go RED. A mutant
 *               that SURVIVES is a guarantee nobody is actually holding.
 * DEPENDENCIES: node_modules/.bin/esbuild; the vendorIdentity module, its probes, and the
 *               migration they assert against.
 * OUTPUTS:      CAUGHT/SURVIVED per mutant + a summary. Exit 1 if any mutant survives, or if the
 *               CONTROL is not green.
 *
 * The harness keys off the suite's EXIT CODE, never a grep for the word FAIL -- a suite that
 * crashed would otherwise read as a catch. And it asserts a GREEN CONTROL first: without that,
 * every "CAUGHT" could be a suite that was already red before any mutation was applied.
 *
 * Every mutation is applied to a COPY held in memory and written back byte-for-byte on exit,
 * including on a crash (try/finally).
 *
 * Run: node scripts/mutants-vendor-identity.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const MODULE = 'packages/shared/src/business-logic/vendorIdentity.ts';
const SUITE = 'packages/shared/src/business-logic/vendorIdentity.test.ts';
const MIGRATION = 'supabase/migrations/20260902_vendor_identity_and_preference.sql';

const ORIGINAL = { [MODULE]: readFileSync(MODULE, 'utf8'), [MIGRATION]: readFileSync(MIGRATION, 'utf8') };

/** Runs the suite. Returns true if GREEN (exit 0). Keys off the exit code, never on output text. */
function suiteIsGreen() {
  try {
    execSync(`node_modules/.bin/esbuild ${SUITE} --bundle --platform=node --format=cjs | node`, {
      stdio: 'pipe', shell: '/bin/bash',
    });
    return true;
  } catch {
    return false;
  }
}

// file, find, replace, and what the mutation MEANS if it survives.
const MUTANTS = [
  [MODULE, "const aliasHit = aliases.find((a) => normalizeVendorName(a.alias) === strict);",
           "const aliasHit = undefined as undefined | (typeof aliases)[number];",
   'the alias table is never consulted -- "ask once, keep forever" asks every time'],

  [MODULE, "    outcome: 'NEED_CONFIRMATION',\n    vendorId: null,\n    matchedOn: 'near-match',",
           "    outcome: 'LINK',\n    vendorId: candidates[0].vendorId,\n    matchedOn: 'near-match',",
   'a NEAR match silently MERGES two vendors -- the exact failure this build exists to prevent'],

  [MODULE, "  return (s ?? '').trim().toLowerCase();",
           "  return (s ?? '').trim().toLowerCase().replace(/\\s+/g, ' ');",
   'strict normalization disagrees with the database unique index'],

  [MODULE, "  if (exact.length > 1) {", "  if (false) {",
   'a name collision picks a row arbitrarily instead of refusing -- D-47s original scar'],

  [MODULE, "    if (target) {", "    if (target ?? true) {",
   'a dangling alias is followed unverified -- a stored link treated as a fact'],

  [MODULE, "    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.id.localeCompare(b.id));",
           "    (Number(b.preferred ?? false) - Number(a.preferred ?? false)) || a.name.localeCompare(b.name));",
   'the preferred vendor is sorted to the top -- a sort is the quiet form of a filter'],

  [MODULE, "  const domain = emailDomain(input.capturedEmail);\n  if (domain) {\n    for (const v of vendors) if (emailDomain(v.email) === domain) add(v, `shares the email domain ${domain}`);\n  }",
           "  const domain = emailDomain(input.capturedEmail);\n  if (domain) {\n    for (const v of vendors) if (emailDomain(v.email) === domain) return { outcome: 'LINK', vendorId: v.id, matchedOn: 'email', reasoning: 'x' };\n  }",
   'a shared email domain LINKS on its own -- D-47s Terrence case, the one that cost nine invoices'],

  [MODULE, "  if (strict === '') {", "  if (false) {",
   'a blank vendor string becomes a vendor named "" instead of an absence'],

  [MODULE, "      subhead: 'No vendors yet. One is recorded the first time you capture a document from them.',",
           "      subhead: 'No vendors yet. Mark one preferred to get started.',",
   'the header makes a preference claim about rows that do not exist'],

  [MODULE, "    .replace(/\\b(inc|llc|l\\.l\\.c|ltd|co|corp|company|incorporated|contracting)\\b/g, ' ')",
           "    .replace(/\\b(zzzz)\\b/g, ' ')",
   'legal suffixes are not set aside, so the Sudderth pair is never even offered as a question'],

  [MODULE, "  if (d && emailDomain(v.email) === d) return { agreed: true, field: 'email' };",
           "  if (d) return { agreed: true, field: 'email' };",
   'a NON-matching second signal is counted as agreement -- a hint promoted to a concurrence'],

  [MIGRATION, "ALTER TABLE receipts\n  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL;",
              "ALTER TABLE receipts\n  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE;\nALTER TABLE receipts DROP COLUMN vendor;",
   'the captured vendor string is destroyed and receipts cascade-delete with their vendor'],

  [MIGRATION, "CREATE TRIGGER vendors_preference_owner_only_insert", "CREATE TRIGGER zz_disabled_insert_guard",
   'a manager can CREATE a vendor already marked preferred -- the UPDATE guard alone does not stop it'],

  [MIGRATION, "CREATE POLICY vendors_member_select ON vendors", "CREATE POLICY zz_no_member_read ON vendors",
   'a manager cannot read the vendor list -- Terrys requirement fails on its own terms'],

  [MIGRATION, "ALTER TABLE vendor_aliases ENABLE ROW LEVEL SECURITY;", "-- rls off",
   'vendor_aliases carries policies with RLS disabled -- wide open'],

  // The one that was actually shipped-shaped in the first draft of this build.
  [MIGRATION, "  ) OR EXISTS (\n    -- an OWNER-ROLE member who is not the account holder (Lauren's case, 20260828's ruling)\n    SELECT 1 FROM public.business_members\n     WHERE business_id = p_business_id\n       AND user_id = auth.uid()\n       AND active = true\n       AND upper(role) = 'OWNER'\n  );",
              "  );",
   'owner authority is the ACCOUNT HOLDER only -- Lauren (role OWNER, not owner_id, measured live) cannot set the preference on her own tenant'],

  [MIGRATION, "  IF NOT public.is_business_owner(NEW.business_id) THEN\n    RAISE EXCEPTION\n      'vendor preference is owner-only: a new vendor may not be created already preferred '",
              "  IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE id = NEW.business_id AND owner_id = auth.uid()) THEN\n    RAISE EXCEPTION\n      'vendor preference is owner-only: a new vendor may not be created already preferred '",
   'one trigger goes back to testing owner_id inline, bypassing the shared predicate'],
];

let caught = 0;
const survivors = [];

try {
  process.stdout.write('\n-- CONTROL (unmutated) ... ');
  const control = suiteIsGreen();
  console.log(control ? 'GREEN' : 'RED');
  if (!control) {
    console.error('\nCONTROL IS RED. Every "CAUGHT" below would be meaningless -- the suite fails before any mutation.');
    process.exit(1);
  }

  console.log(`\n-- ${MUTANTS.length} MUTANTS --\n`);
  for (const [file, find, replace, meaning] of MUTANTS) {
    const src = ORIGINAL[file];
    if (!src.includes(find)) {
      survivors.push(`NOT APPLIED (anchor text not found in ${file}): ${meaning}`);
      console.log(`  ??  NOT APPLIED  ${meaning}`);
      continue;
    }
    writeFileSync(file, src.replace(find, replace));
    const green = suiteIsGreen();
    writeFileSync(file, src);            // restore immediately, before anything else can fail
    if (green) { survivors.push(meaning); console.log(`  !!  SURVIVED    ${meaning}`); }
    else { caught++; console.log(`  ok  CAUGHT      ${meaning}`); }
  }
} finally {
  for (const [f, s] of Object.entries(ORIGINAL)) writeFileSync(f, s);
}

console.log(`\n-- ${caught} of ${MUTANTS.length} caught (population: ${MUTANTS.length} mutations, each applied and reverted) --`);
if (survivors.length) {
  console.error('\nSURVIVORS -- each is a guarantee nobody is holding:\n' + survivors.map(s => '  · ' + s).join('\n'));
  process.exit(1);
}
console.log('   Every mutation was caught. Files restored byte-for-byte.\n');
