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
  { id: 'W5', file: WRITER, why: '🔴 the OPERATOR\'s deploy-wide hold is ignored entirely — a business whose owner has gone live can no longer be undone even while the platform is holding every push, so nothing has actually reached QuickBooks',
    from: '  const platformHeld = isPushHeld(pushHoldRaw, businessId);',
    to:   '  const platformHeld = false;' },
  { id: 'W6', file: WRITER, why: '🔴 the undo is not scoped to its own run — it reads EVERY customer in the tenant as its own and deletes them',
    from: "      .eq('business_id', businessId).eq('import_run_id', runId)\n      .range(from, from + 999);",
    to:   "      .eq('business_id', businessId)\n      .range(from, from + 999);" },
  { id: 'W7', file: WRITER, why: '🔴 a non-FK failure stops explaining itself — ok:false with no sentence, and the operator cannot tell "nothing to do" from "not allowed"',
    from: "    refusedBecause: blocked.length === 0",
    to:   "    refusedBecause: true ? null : blocked.length === 0" },
  { id: 'W11', file: WRITER, why: '🔴 the post-delete RE-READ replaced by a constant — a delete that REPORTS rows and leaves them behind reports a successful undo over a tenant that still holds them',
    from: '  const remaining = await countStamped(db, businessId, runId);\n  console.log(\'[TRACE:CUSTIMPORT] undo\'',
    to:   '  const remaining = 0;\n  console.log(\'[TRACE:CUSTIMPORT] undo\'' },
  { id: 'W12', file: WRITER, why: '🔴 an undo with nothing to take back reports FAILURE — the operator is told something went wrong when nothing did',
    from: "    return { ...empty, ok: true, refusedBecause: null, remainingWithThisRun: 0 };",
    to:   "    return { ...empty, ok: false, refusedBecause: null, remainingWithThisRun: 0 };" },
  { id: 'W8', file: WRITER, why: '🔴 the preview WRITES — a plan that is indistinguishable from a commit',
    from: '  const held = await existingQbIds(db, businessId);\n  const { create, reconcile } = partition(adaptation.customers, held);\n  const existingCustomers = await countCustomers(db, businessId);',
    to:   '  const held = await existingQbIds(db, businessId);\n  const { create, reconcile } = partition(adaptation.customers, held);\n  await db.from(\'customers\').insert([]);\n  const existingCustomers = await countCustomers(db, businessId);' },
  { id: 'W9', file: WRITER, why: '🔴 an insert failure is swallowed — the report claims rows that never landed',
    from: '    if (error) throw new Error(`customer insert failed at row ${i}: ${error.message}`);',
    to:   '    if (false) throw new Error(`customer insert failed at row ${i}`);' },
  { id: 'W10', file: WRITER, why: '🔴 the run reports its created count from the PLAN rather than from what landed',
    from: '  const stampedWithThisRun = await countStamped(db, businessId, runId);',
    to:   '  const stampedWithThisRun = create.length;' },

  // ── the undo under ON DELETE RESTRICT (David's FK answer, 2026-09-06) ───────
  { id: 'U1', file: WRITER, why: '🔴 the PER-ROW FALLBACK removed — a bulk DELETE is ONE statement, so one customer with an order deletes NOTHING and the whole undo dies on it',
    from: '    if (!isForeignKeyRefusal(error)) throw new Error(`undo failed: ${error.message}`);\n    // The chunk held at least one customer with an order. Find out which, one at a time.',
    to:   '    throw new Error(`undo failed: ${error.message}`);\n    // The chunk held at least one customer with an order. Find out which, one at a time.' },
  { id: 'U2', file: WRITER, why: '🔴 a legitimate partial undo reports FAILURE — an operator told "failed" retries something that will refuse again for the same good reason',
    from: '  const ok = remaining === blocked.length;',
    to:   '  const ok = remaining === 0;' },
  { id: 'U3', file: WRITER, why: '🔴 the SET-NULL side effect goes unreported — a delivery survives with its customer blanked and nothing anywhere says so',
    from: '    deliveriesUnlinked += ((d.data ?? []) as unknown[]).length;',
    to:   '    deliveriesUnlinked += 0;' },
  { id: 'U4', file: WRITER, why: '🔴 ANY error is treated as a foreign-key refusal — a permissions failure is silently reported as "this customer carries orders", which is a lie with a plausible reason attached',
    from: "  return error.code === '23503' || /violates foreign key constraint/i.test(error.message ?? '');",
    to:   '  return true;' },
  { id: 'U5', file: WRITER, why: '🔴 the blocked customer loses its order count — "2 customers could not be removed" is not actionable',
    from: '    orders: orderCount.get(id) ?? 0,',
    to:   '    orders: 0,' },
  { id: 'U6', file: WRITER, why: '🔴 the blocked customer loses its NAME — an id is not something an owner can act on',
    from: "    displayName: nameOf.get(id) ?? '(unnamed)',",
    to:   "    displayName: '(unnamed)'," },
  { id: 'U7', file: WRITER, why: '🔴 rows refused by the per-row fallback never reach the blocked list — they vanish from the report while remaining in the table',
    from: '  for (const id of refused) knownBlocked.add(id);',
    to:   '  for (const id of refused) { void id; }' },

  // ── the undo GATE: two switches, not one (corrected from #277's e04a697) ────
  { id: 'G1', file: WRITER, why: '🔴 THE REAL DEFECT #277 SHIPPED AND DAVID FOUND BY ASKING. The gate reads only the OPERATOR env hold, so at LAWNS (owner\'s switch false, env unset) it computes "writes are on" and REFUSES the undo in exactly the state it exists to serve — inverted, not incomplete',
    from: '  if (pushPermitted({ writesEnabled, platformHeld })) {',
    to:   '  if (!platformHeld) {' },
  { id: 'G2', file: WRITER, why: '🔴 a FAILED read of the switch FAILS OPEN — customers deleted on the strength of a query that did not answer (tech-debt #75: a check whose error path is "allow" is not a check)',
    from: '  if (biz.error || !biz.data) {',
    to:   '  if (false) {' },
  { id: 'G3', file: WRITER, why: '🔴 the owner switch is ignored and only the operator hold decides — the two-switch AND collapses to one',
    from: '  if (pushPermitted({ writesEnabled, platformHeld })) {',
    to:   '  if (pushPermitted({ writesEnabled: false, platformHeld })) {' },
  { id: 'G4', file: WRITER, why: '🔴 "we could not check" is worded as "you are live" — the operator fixes the wrong thing',
    from: "      refusedBecause: 'We could not check whether this business is sending invoices to QuickBooks, '",
    to:   "      refusedBecause: 'QuickBooks writes are ON for this business. '" },
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
