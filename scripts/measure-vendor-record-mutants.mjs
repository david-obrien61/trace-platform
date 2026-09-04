/**
 * ── measure-vendor-record-mutants — can the vendor-record probes actually disagree? ─────────────
 *
 * PURPOSE: R-33 says a check nobody has seen refuse is a claim. This mutates the shipped source
 *          one defect at a time and requires the suite to go RED. A SURVIVING mutant means the
 *          probe asserting that rule is decoration.
 * OUTPUTS: one line per mutant + a caught/survived tally. WRITES NOTHING PERMANENT (each file is
 *          restored in a finally block).
 * Run:     node scripts/measure-vendor-record-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const SUITE = 'packages/cultivar-os/src/components/vendors/vendorEdit.test.ts';
const MUTANTS = [
  { id: 'M1', file: 'packages/shared/src/business-logic/vendorIdentity.ts',
    why: 'VENDORS_SELECT reverted to the hand-written 10-column literal (tech-debt #179 restored)',
    from: `export const VENDORS_SELECT = [
  ...VENDOR_KEY_FIELDS,
  ...VENDOR_EDITABLE_FIELDS,
  ...VENDOR_OWNER_ONLY_FIELDS,
].join(', ');`,
    to: `export const VENDORS_SELECT = 'id, business_id, name, email, phone, account_number, website, preferred, preference_note, notes';` },

  { id: 'M2', file: 'packages/cultivar-os/src/pages/Vendors.tsx',
    why: 'the read-only PREFERRED chip gains an onClick (E7/G8 dead affordance)',
    from: `{v.preferred === true && <span style={MARK}>PREFERRED</span>}`,
    to: `{v.preferred === true && <span style={MARK} onClick={() => setEditing(v)}>PREFERRED</span>}` },

  { id: 'M3', file: 'packages/cultivar-os/src/pages/ReceiptKeeper.tsx',
    why: 'typing the invoice number also rewrites the banked original (a typed number would read as read)',
    from: `onChange={e => setReceiptNumber(e.target.value.trim() === '' ? null : e.target.value)}`,
    to: `onChange={e => { setReceiptNumber(e.target.value.trim() === '' ? null : e.target.value); setReceiptNumberOriginal(e.target.value); }}` },

  { id: 'M4', file: 'packages/cultivar-os/src/components/vendors/vendorEdit.ts',
    why: 'the preference pair is sent regardless of authority (client stops agreeing with the trigger)',
    from: `  if (canSetPreference) {`,
    to: `  if (canSetPreference || true) {` },

  { id: 'M5', file: 'packages/cultivar-os/src/components/vendors/vendorEdit.ts',
    why: 'zero matched rows with no error is treated as success (E5 defeated)',
    from: `    if (matchedRows === 0) {
      return 'That vendor could not be updated from your account. Nothing was saved.';
    }`,
    to: `    if (matchedRows === -999) {
      return 'unreachable';
    }` },

  { id: 'M6', file: 'packages/shared/src/business-logic/vendorIdentity.ts',
    why: 'an absent captured field is written as an empty string rather than omitted (absent becomes empty)',
    from: `    if (v !== '') out[col] = v;`,
    to: `    out[col] = v;` },

  { id: 'M7', file: 'packages/shared/src/business-logic/documentNumber.ts',
    why: 'the number comparison folds case and punctuation (a correction reclassified as a read)',
    from: `  if (o === c) {`,
    to: `  if (o.toLowerCase().replace(/[^a-z0-9]/g, '') === c.toLowerCase().replace(/[^a-z0-9]/g, '')) {` },

  { id: 'M8', file: 'packages/cultivar-os/src/components/vendors/VendorEditor.tsx',
    why: 'the form renders the hand-written GROUPS array instead of the set computed from the shared field list (E6 parallel list restored)',
    from: `        {GROUPED_FIELDS.map(g => (`,
    to: `        {GROUPS.map(g => (` },

  { id: 'M9', file: 'packages/cultivar-os/src/components/vendors/VendorEditor.tsx',
    why: 'a field group names a column that is not in the shared editable set (an input that discards what is typed into it)',
    from: `  { title: 'Notes',    fields: ['notes'] },`,
    to: `  { title: 'Notes',    fields: ['notes', 'internal_rating'] },` },

  { id: 'M10', file: 'packages/shared/src/business-logic/documentNumber.ts',
    why: 'a NULL original is treated as "the reader read nothing", so an unattributed number reads as TYPED BY HER (the live LAWNS defect)',
    from: `  const banked = original !== null && original !== undefined;`,
    to: `  const banked = true;` },

  { id: 'M11', file: 'packages/cultivar-os/src/pages/ReceiptKeeper.tsx',
    why: 'the capture banks null instead of the empty-string sentinel when the reader found no number',
    from: `      setReceiptNumberOriginal(readNumber ?? '');`,
    to: `      setReceiptNumberOriginal(readNumber);` },

  { id: 'M12', file: 'packages/cultivar-os/src/pages/Vendors.tsx',
    why: 'the read-only reason is dropped from the row again, leaving a flag that only says which row to click',
    from: `                  ? <div style={NOTE}>{v.preference_note}</div>`,
    to: `                  ? null` },

  { id: 'M13', file: 'packages/cultivar-os/src/pages/Vendors.tsx',
    why: 'the read-only reason becomes a control (a click target on the row)',
    from: `const NOTE: React.CSSProperties = {\n  fontSize: '0.875rem', color: '#1f2937', marginTop: 8, lineHeight: 1.5,`,
    to: `const NOTE: React.CSSProperties = {\n  cursor: 'pointer',\n  fontSize: '0.875rem', color: '#1f2937', marginTop: 8, lineHeight: 1.5,` },
];

function runSuite() {
  try {
    execSync(`node_modules/.bin/esbuild ${SUITE} --bundle --platform=node --format=cjs --log-level=error | node`,
      { stdio: 'pipe', shell: '/bin/bash' });
    return true;   // green
  } catch { return false; }  // red
}

if (!runSuite()) { console.error('🔴 the suite is RED before any mutation — fix that first'); process.exit(1); }
console.log(`baseline: suite GREEN over ${MUTANTS.length} mutants to apply\n`);

let caught = 0, survived = 0;
for (const m of MUTANTS) {
  const original = readFileSync(m.file, 'utf8');
  if (!original.includes(m.from)) {
    console.log(`  ⚠️  ${m.id} NOT APPLIED — anchor not found in ${m.file}. A mutant that cannot be applied proves nothing.`);
    survived++; continue;
  }
  try {
    writeFileSync(m.file, original.replace(m.from, m.to));
    const green = runSuite();
    if (green) { survived++; console.log(`  🔴 ${m.id} SURVIVED — ${m.why}`); }
    else       { caught++;  console.log(`  ✅ ${m.id} caught   — ${m.why}`); }
  } finally {
    writeFileSync(m.file, original);
  }
}
console.log(`\n${caught}/${MUTANTS.length} caught, ${survived} survived`);
if (!runSuite()) { console.error('🔴 suite is RED after restore — a mutant leaked'); process.exit(1); }
console.log('suite GREEN after restore — every file returned to its shipped state');
if (survived) process.exit(1);
