/**
 * ── measure-qbo-customer-import-mutants — can we charge tax to a church, or delete a real customer? ──
 *
 * PURPOSE:      Every mutant here either gets the tax exemption wrong, merges people who are not
 *               duplicates, or lets the undo reach a row it must never touch. The two that matter
 *               most are A1 and W1. A1 reads the DEFAULT TAX CODE instead of `Taxable` — the two
 *               fields both spell "3" and mean opposite things, and that misreading is what put
 *               "17 more carry a bare 3" into the recon. W1 stamps the run id onto a PRE-EXISTING
 *               customer, after which the undo deletes real customers with real orders.
 * DEPENDENCIES: node_modules/.bin/esbuild. Mutates a temp copy of one file; restores in `finally`.
 * OUTPUTS:      CAUGHT/SURVIVED per mutant + summary. Exit 1 if any survived OR never applied.
 *
 * 🔴 GREEN CONTROL FIRST, AND A MUTANT THAT NEVER APPLIED IS AN ERROR, NOT A PASS. A mutation
 *    that cannot reach its target has proven nothing, and reporting it as CAUGHT is the same
 *    false green as a probe that cannot fail (tech-debt #182 / R-33).
 *
 * ⚠️ THE ANCHOR IS VERIFIED IN-WINDOW — the applied file is re-read and compared BEFORE the suite
 *    runs, not after it is restored (#274's first batch reported two false survivors that way).
 *
 * Run: node scripts/measure-qbo-customer-import-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const ESB  = ROOT + 'node_modules/.bin/esbuild';
const ADAPTER = ROOT + 'packages/shared/src/quickbooks/qboCustomerAdapter.ts';
const WRITER  = ROOT + 'packages/shared/src/quickbooks/customerImportWriter.ts';
const SUITE   = 'packages/shared/src/quickbooks/customerImport.test.ts';

function suiteIsGreen() {
  try {
    execSync(`${ESB} ${SUITE} --bundle --platform=node --format=cjs 2>/dev/null | node`,
      { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch { return false; }
}

const MUTANTS = [
  // ── the adapter: the exemption ──────────────────────────────────────────────
  { id: 'A1', file: ADAPTER, why: '🔴 taxability read off the DEFAULT TAX CODE instead of `Taxable` — "3" on all 1,946 records, so every customer reads exempt and nobody is ever charged tax',
    from: '  const taxable = raw.Taxable;\n  const exempt = taxable === false;',
    to:   '  const taxable = raw.Taxable;\n  const exempt = ((raw.DefaultTaxCodeRef as any)?.value) === \'3\';' },
  { id: 'A2', file: ADAPTER, why: '🔴 a MISSING Taxable becomes EXEMPT — the unsafe direction: tax that is owed goes uncollected',
    from: '  const exempt = taxable === false;',
    to:   '  const exempt = taxable !== true;' },
  { id: 'A3', file: ADAPTER, why: '🔴 a TAXABLE row keeps a reason and a certificate — asserting an exemption nobody claimed',
    from: '    return { tax_exempt: false, tax_exempt_reason: null, tax_exempt_cert_ref: null };',
    to:   '    return { tax_exempt: false, tax_exempt_reason: str(raw.TaxExemptionReasonId), tax_exempt_cert_ref: cert };' },

  // ── the adapter: the reason label ───────────────────────────────────────────
  { id: 'A4', file: ADAPTER, why: '🔴 a PERMIT NUMBER rendered as a reason name — "32093937053" shown to Lauren as the reason a customer is exempt',
    from: '  const label = readsAsAWord(cert) ? cert : REASON_NOT_IDENTIFIED;',
    to:   '  const label = cert ?? REASON_NOT_IDENTIFIED;' },
  { id: 'A5', file: ADAPTER, why: '🔴 the raw QuickBooks reason id DROPPED — the one value Lauren\'s cleanup works from',
    from: '  const reason = reasonId ? `${label} (QuickBooks reason ${reasonId})` : label;',
    to:   '  const reason = label;' },
  { id: 'A6', file: ADAPTER, why: '🔴 the word/number test becomes a HARDCODED list of this realm\'s four answers — correct at LAWNS, silently wrong at every other tenant',
    from: "  return v !== null && /[A-Za-z]/.test(v);",
    to:   "  return v !== null && ['GOVT', 'School', 'Ag', 'City Of Liberty'].includes(v);" },

  // ── the adapter: classification, address, refusals ──────────────────────────
  { id: 'A7', file: ADAPTER, why: '🔴 any GivenName makes it a PERSON — QuickBooks splits company names, so "ABC Home and Pest Services" becomes a person',
    from: "  if (displayName.trim().toLowerCase() === companyName.trim().toLowerCase()) return 'organization';",
    to:   "  if (false) return 'organization';" },
  { id: 'A8', file: ADAPTER, why: '🔴 any CompanyName makes it an ORGANIZATION — Aaron Harlan becomes his employer',
    from: "  if (!givenName) return 'organization';\n  return 'person';",
    to:   "  return 'organization';" },
  { id: 'A9', file: ADAPTER, why: '🔴 the address falls back to ShipAddr — 1,946 records carry one but only 754 have a Line1, so job-site husks become billing addresses',
    from: "  const a = (raw.BillAddr ?? null) as Record<string, unknown> | null;",
    to:   "  const a = ((raw.BillAddr ?? raw.ShipAddr) ?? null) as Record<string, unknown> | null;" },
  { id: 'A10', file: ADAPTER, why: '🔴 a repeated qb_customer_id is carried into the payload — Postgres rejects the WHOLE batch, failing 1,945 good records for one bad one',
    from: '      if (seen.has(adapted.qb_customer_id)) { dupId++; continue; }',
    to:   '      if (false) { dupId++; continue; }' },
  { id: 'A11', file: ADAPTER, why: '🔴 a record with no name of any kind is written as a placeholder into a real company\'s customer list',
    from: '  if (!displayName) return null;',
    to:   '  if (false) return null;' },
  { id: 'A12', file: ADAPTER, why: '🔴 the duplicate record count becomes the SUM of the flags, not the UNION — overstating the review by half (the 54-vs-72 correction, inverted)',
    from: '    duplicateRecordCount: touched.size,',
    to:   '    duplicateRecordCount: duplicates.reduce((n, d) => n + d.members.length, 0),' },
  { id: 'A13', file: ADAPTER, why: '🔴 duplicates are MERGED rather than flagged — a company and its owner collapse into one row',
    from: '      if (seen.has(adapted.qb_customer_id)) { dupId++; continue; }\n      seen.add(adapted.qb_customer_id);',
    to:   '      if (seen.has(adapted.qb_customer_id)) { dupId++; continue; }\n      if (adapted.email && customers.some(x => x.email === adapted.email)) { continue; }\n      seen.add(adapted.qb_customer_id);' },

  // ── the writer: the run-id trap ─────────────────────────────────────────────
  { id: 'W1', file: WRITER, why: '🔴 THE DATA-LOSS BUG. The reconcile stamps the run id onto a PRE-EXISTING customer, and the undo then deletes real customers with real orders',
    from: '        tax_exempt_cert_ref: c.tax_exempt_cert_ref,\n      })',
    to:   '        tax_exempt_cert_ref: c.tax_exempt_cert_ref,\n        import_run_id: runId,\n      })' },
  { id: 'W2', file: WRITER, why: '🔴 the naive single UPSERT over everything — the same stamping bug arrived at from the other direction',
    from: "    const { error } = await db.from('customers').insert(batch);",
    to:   "    const { error } = await db.from('customers').upsert(batch, { onConflict: 'business_id,qb_customer_id' });" },
  { id: 'W3', file: WRITER, why: '🔴 the reconcile overwrites the WHOLE row — a curated email, a corrected phone and a fixed address all clobbered by QuickBooks',
    from: '      .update({\n        tax_exempt: c.tax_exempt,\n        tax_exempt_reason: c.tax_exempt_reason,\n        tax_exempt_cert_ref: c.tax_exempt_cert_ref,\n      })',
    to:   '      .update(rowForCustomer(businessId, runId, c))' },
  { id: 'W4', file: WRITER, why: '🔴 canonical + mirror broken — billing_* written without the legacy four, so the invoice and the delivery route disagree',
    from: '    billing_line1: c.address_line1,',
    to:   '    billing_line1: null,' },

  // ── the writer: the undo ────────────────────────────────────────────────────
  { id: 'W5', file: WRITER, why: '🔴 the undo no longer refuses while QuickBooks writes are ON — deleting a customer an invoice was raised against (R-95)',
    from: '  if (!isPushHeld(pushHoldRaw, businessId)) {',
    to:   '  if (false) {' },
  { id: 'W6', file: WRITER, why: '🔴 the undo is not scoped to its own run — every imported customer from EVERY run is deleted',
    from: "    .delete().eq('business_id', businessId).eq('import_run_id', runId).select('id');",
    to:   "    .delete().eq('business_id', businessId).select('id');" },
  { id: 'W7', file: WRITER, why: '🔴 the REFUSAL branch removed — an RLS-declined delete (no error, zero rows, rows still there) reports a clean undo (#274)',
    from: '  if (rows.length === 0 && before > 0) {',
    to:   '  if (false) {' },
  { id: 'W11', file: WRITER, why: '🔴 the post-delete RE-READ replaced by a constant — a delete that REPORTS rows and leaves them behind reports a successful undo over a tenant that still holds them',
    from: '  const remaining = await countStamped(db, businessId, runId);\n  console.log(\'[TRACE:CUSTIMPORT] undo\'',
    to:   '  const remaining = 0;\n  console.log(\'[TRACE:CUSTIMPORT] undo\'' },
  { id: 'W12', file: WRITER, why: '🔴 the BEFORE count dropped, so "deleted nothing" can no longer be told from "there was nothing to delete"',
    from: '  const before = await countStamped(db, businessId, runId);',
    to:   '  const before = 0;' },
  { id: 'W8', file: WRITER, why: '🔴 the preview WRITES — a plan that is indistinguishable from a commit',
    from: '  const held = await existingQbIds(db, businessId);\n  const { create, reconcile } = partition(adaptation.customers, held);\n  const existingCustomers = await countCustomers(db, businessId);',
    to:   '  const held = await existingQbIds(db, businessId);\n  const { create, reconcile } = partition(adaptation.customers, held);\n  await db.from(\'customers\').insert([]);\n  const existingCustomers = await countCustomers(db, businessId);' },
  { id: 'W9', file: WRITER, why: '🔴 an insert failure is swallowed — the report claims rows that never landed',
    from: '    if (error) throw new Error(`customer insert failed at row ${i}: ${error.message}`);',
    to:   '    if (false) throw new Error(`customer insert failed at row ${i}`);' },
  { id: 'W10', file: WRITER, why: '🔴 the run reports its created count from the PLAN rather than from what landed',
    from: '  const stampedWithThisRun = await countStamped(db, businessId, runId);',
    to:   '  const stampedWithThisRun = create.length;' },
];

if (!suiteIsGreen()) {
  console.error('🔴 GREEN CONTROL FAILED — the suite is red BEFORE any mutation. Fix that first; every result below would be meaningless.');
  process.exit(1);
}
console.log('green control: suite passes unmutated\n');

let caught = 0, survived = 0, neverApplied = 0;
for (const m of MUTANTS) {
  const original = readFileSync(m.file, 'utf8');
  let verdict;
  try {
    if (!original.includes(m.from)) {
      verdict = 'NEVER APPLIED (anchor not found)';
      neverApplied++;
    } else {
      const mutated = original.replace(m.from, m.to);
      writeFileSync(m.file, mutated);
      // ⚠️ VERIFIED IN-WINDOW: re-read from disk and confirm the change is actually there.
      const onDisk = readFileSync(m.file, 'utf8');
      if (onDisk === original || !onDisk.includes(m.to)) {
        verdict = 'NEVER APPLIED (mutation did not land)';
        neverApplied++;
      } else if (suiteIsGreen()) {
        verdict = 'SURVIVED';
        survived++;
      } else {
        verdict = 'caught';
        caught++;
      }
    }
  } finally {
    writeFileSync(m.file, original);
  }
  const mark = verdict === 'caught' ? '  ✓' : '  ✗';
  console.log(`${mark} ${m.id.padEnd(4)} ${verdict.padEnd(32)} ${m.why}`);
}

console.log(`\n  ${MUTANTS.length} mutants · ${caught} caught · ${survived} survived · ${neverApplied} never applied`);
if (!suiteIsGreen()) {
  console.error('🔴 THE SUITE IS RED AFTER RESTORE — a mutant was not cleaned up. Check git status.');
  process.exit(1);
}
if (survived || neverApplied) process.exit(1);
