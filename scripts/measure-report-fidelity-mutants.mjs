/**
 * ── measure-report-fidelity-mutants — does the suite actually REFUSE each defect? ───────────
 *
 * PURPOSE:      Re-introduce each of the five shipped defects, one at a time, and confirm
 *               `reportFidelity.test.ts` goes RED. A check nobody has watched fail is a claim
 *               (§6 r19b). Every mutant here is the REAL defect as it shipped, not a nearby edit.
 * DEPENDENCIES: node, esbuild; restores every file it touches in a finally block.
 * OUTPUTS:      a caught/survived/never-applied table; exit 1 if any mutant survives.
 *
 * 🔴 "NEVER APPLIED" IS REPORTED SEPARATELY FROM "CAUGHT" AND IT IS THE FAILURE THAT HIDES:
 *    a mutant whose search string no longer matches is silently a pass otherwise — a harness that
 *    cannot reach its target reports the same as one that passed (tech-debt #182).
 *
 * Run: node scripts/measure-report-fidelity-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const SUITE = 'packages/shared/src/business-logic/reportFidelity.test.ts';
const MUTANTS = [
  // ① the tier resolved from the weak key again (the shipped defect)
  ['A1 review drops the attached tier', 'packages/cultivar-os/src/pages/CartReview.tsx',
   'const effectiveTierName = invokedTier ?? attachedTier ?? customer?.price_tier ?? null;',
   'const effectiveTierName = invokedTier ?? customer?.price_tier ?? null;'],
  // ① the read goes back to matching on EMAIL — the defect, relocated behind a tidy call site
  ['A1b tier read matches on email', 'packages/shared/src/business-logic/financialDataAccess.ts',
   "    .eq('id', customerId).eq('business_id', businessId).maybeSingle();",
   "    .eq('email', customerId).eq('business_id', businessId).maybeSingle();"],
  // ① the page stops asking for the attached tier at all
  ['A1c page drops the named read', 'packages/cultivar-os/src/pages/CartReview.tsx',
   'const tier = await fetchAttachedCustomerTier(supabase, businessId, attachedCustomerId);',
   'const tier = customer?.price_tier ?? null;'],
  // ① the covering copy comes back
  ['A2 the covering copy returns', 'packages/cultivar-os/src/pages/CartReview.tsx',
   '{orderTierLabel ?? `${resolvedTier.name} — ${resolvedTier.discountPercent}% off`}',
   '{orderTierLabel}applies at checkout — the invoice total reflects it.'],
  // ② the unconditional send claim
  ['B1 "Invoice sent to {email}" returns', 'packages/cultivar-os/src/pages/Confirmation.tsx',
   "{qbState === 'success'\n            ? <>Invoice created in QuickBooks for {email}</>\n            : <>Order saved for {email}</>}",
   'Invoice sent to {email}'],
  // ② the action-slot claim
  ['B2 "Invoice emailed to {email}" returns', 'packages/cultivar-os/src/pages/Confirmation.tsx',
   "{qbState === 'success'\n              ? <>Invoice created in QuickBooks — {businessName ?? 'the nursery'} will send it to {email}</>\n              : <>{businessName ?? 'The nursery'} will send your invoice to {email}</>}",
   'Invoice emailed to {email}'],
  // ③ the confident zero
  ['C1 `?? 0` fabricates a customer count', 'packages/shared/src/components/QboCatalogueImport.tsx',
   "{undone.customers\n                  ? `${undone.customers.deleted} imported customers`\n                  : 'an unreported number of imported customers'} removed,",
   '{undone.customers?.deleted ?? 0} imported customers removed,'],
  // ④ the pill takes its total from the rows in hand
  ['D1 pill derives total from rows.length', 'packages/shared/src/components/datasheet/countPill.ts',
   'const trueTotal = total ?? loaded;', 'const trueTotal = loaded;'],
  // ④ the "showing" distinction erased
  ['D2 partial is never announced', 'packages/shared/src/components/datasheet/countPill.ts',
   'const partial = total != null && loaded < total;', 'const partial = false;'],
  // ④ the read goes back to unbounded
  ['D3 the customers read loses its count', 'packages/cultivar-os/src/pages/Customers.tsx',
   ".select(cols, { count: 'exact' })", '.select(cols)'],
  // ⑤ the template literal returns
  ['E1 formatPersonName joins blindly', 'packages/shared/src/utils/personName.ts',
   "  return [first, last]\n    .map(p => (typeof p === 'string' ? p.trim() : ''))\n    .filter(Boolean)\n    .join(' ');",
   '  return `${first} ${last}`;'],
  // ⑤ a call site rebuilds the name by hand
  ['E2 a call site hand-assembles again', 'packages/cultivar-os/src/pages/Orders.tsx',
   "{customerDisplayName(order.customers, 'Unknown customer')}",
   "{order.customers ? `${order.customers.first_name} ${order.customers.last_name}` : 'Unknown customer'}"],
  // ⑤ organizations wrongly routed through the person path
  ['E3 organizations lose their name', 'packages/shared/src/utils/personName.ts',
   "  if (c.customer_type === 'organization') {", '  if (false) {'],
];

let caught = 0, survived = 0, never = 0;
const rows = [];
for (const [name, file, find, replace] of MUTANTS) {
  const original = readFileSync(file, 'utf8');
  if (!original.includes(find)) {
    never++; rows.push(`⚠️  NEVER APPLIED  ${name} — search string absent from ${file}`);
    continue;
  }
  try {
    writeFileSync(file, original.replace(find, replace));
    let red = false;
    try {
      execSync(`node_modules/.bin/esbuild ${SUITE} --bundle --platform=node --format=cjs | node`,
        { stdio: 'pipe', shell: '/bin/bash' });
    } catch { red = true; }
    if (red) { caught++; rows.push(`✅ caught        ${name}`); }
    else     { survived++; rows.push(`🔴 SURVIVED      ${name} — the suite passed with the defect restored`); }
  } finally {
    writeFileSync(file, original);
  }
}
console.log('\n' + rows.join('\n'));
console.log(`\n  ${MUTANTS.length} mutants · ${caught} caught · ${survived} survived · ${never} never applied`);
if (survived || never) process.exit(1);
