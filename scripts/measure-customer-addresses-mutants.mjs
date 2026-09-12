/**
 * ── measure-customer-addresses-mutants — can a saved site move a past delivery? ───────────────
 *
 * PURPOSE:      The address book's whole reason to exist is that a picked address cannot drift. Its
 *               whole DANGER is the opposite: a book row that a past order POINTS AT rather than
 *               copies. Then editing "Job site A" in March silently rewrites where January's load
 *               went, and the invoice, the route history and the customer's memory disagree with
 *               nothing to say which is right. D-41 ruled against exactly this, and the mechanism
 *               is a snapshot. Every mutant below produces a book that works perfectly on screen
 *               and quietly breaks that snapshot, or admits somebody the gate should refuse.
 *
 * 🔴 THE THREE THAT MATTER:
 *               · C1 — the stop is addressed from the CUSTOMER RECORD again, so the picker fills a
 *                 form whose result never reaches the truck. That is the LIVE defect this build
 *                 closes, restored exactly; if it survives, the picker is decoration.
 *               · G1 — the save-site gate admits everybody. A gate seen only to admit is not a gate.
 *               · B1 — the book is seeded from history. AGAVE's four spellings of one yard become
 *                 four CURATED sites, and the drift is made permanent instead of fixed.
 *
 * 🔴 THE PROBES WERE WRITTEN ALONGSIDE THE CODE, SO THEIR FIRST GREEN RUN PROVED NOTHING (§6 r19 /
 *               R-33). This is where they are made to refuse.
 *
 * ⚠️ REACH, NOT SUBJECT (tech-debt #182). R1 and R2 mutate files the pure suites never open — the
 *               checkout writer and the card — precisely to prove the harness gets that far. Both
 *               are expected to be caught by a DIFFERENT suite than the unit one, and if they are
 *               not, the surface probes are aimed at nothing.
 *
 * DEPENDENCIES: node_modules/.bin/esbuild. Mutates a temp copy of one file; restores in `finally`.
 * OUTPUTS:      CAUGHT/SURVIVED per mutant + summary. Exit 1 if any survived OR never applied.
 *
 * Run: node scripts/measure-customer-addresses-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const ESB  = ROOT + 'node_modules/.bin/esbuild';

const LIB       = 'packages/shared/src/business-logic/customerAddresses.ts';
// ✏️ RETARGETED mid-build: the column list MOVED to its own module when `verify-field-lists` went
// red (a list declared beside its call sites is a hand-written enumeration; an imported one is a
// derivation). D1 kept pointing at the old home and reported ERROR — never applied — which is why
// this harness treats that as a failure rather than a pass. A mutant that cannot land proves nothing.
const FIELDS    = 'packages/shared/src/business-logic/customerAddressFields.ts';
const MIGRATION = 'supabase/migrations/20260911b_customer_addresses.sql';
const SUBMIT    = 'packages/cultivar-os/api/orders/submit.ts';
const CARD      = 'packages/cultivar-os/src/components/delivery/StopCard.tsx';
const ACTIONS   = 'packages/cultivar-os/src/components/delivery/useStopActions.tsx';
const PICKER    = 'packages/shared/src/components/customers/ShipToPicker.tsx';
const CAPTURE   = 'packages/cultivar-os/src/pages/CustomerCapture.tsx';

const UNIT      = 'packages/shared/src/business-logic/customerAddresses.test.ts';
const SURFACES  = 'packages/cultivar-os/src/lib/shipToSurfaces.test.ts';
const CHECKOUT  = 'packages/cultivar-os/api/orders/checkoutDelivery.test.ts';

/** A mutant is CAUGHT when ANY of the three suites goes red — they are one net, not three. */
const SUITES = [UNIT, SURFACES, CHECKOUT];

function suiteIsGreen(suite) {
  try {
    execSync(`set -o pipefail; "${ESB}" "${suite}" --bundle --platform=node --format=cjs --log-level=error --external:@supabase/supabase-js | node`,
      { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch { return false; }
}
const allGreen = () => SUITES.every(suiteIsGreen);

const MUTANTS = [
  // ══ THE SNAPSHOT — the invariant D-41 ruled ═════════════════════════════════════════════════
  { id: 'C1', target: SUBMIT,
    why: '🔴 THE LIVE DEFECT RESTORED — the stop is addressed from the CUSTOMER RECORD again, so a chosen or typed ship-to never reaches the truck and the picker is decoration',
    from: '    address_line1: shipTo ? shipTo.address_line1 : pick(c.billing_line1, c.address_line1),',
    to:   '    address_line1: pick(c.billing_line1, c.address_line1),' },
  { id: 'C2', target: SUBMIT,
    why: '🔴 a street-less ship-to is merged FIELD BY FIELD over the customer\'s — a street from one place in a city from another, which is how an address stops being one fact',
    from: '  const shipTo = st && shipField(st.line1)\n    ? { address_line1: shipField(st.line1), city: shipField(st.city), state: shipField(st.state), zip: shipField(st.zip) }\n    : null;',
    to:   '  const shipTo = st\n    ? { address_line1: shipField(st.line1) ?? pick(c.billing_line1, c.address_line1), city: shipField(st.city) ?? pick(c.billing_city, c.city), state: shipField(st.state) ?? pick(c.billing_state, c.state), zip: shipField(st.zip) ?? pick(c.billing_zip, c.zip) }\n    : null;' },
  { id: 'C3', target: SUBMIT,
    why: 'a ship-to smuggles a stop into a SELF-COLLECT order — a journey nobody makes, on the schedule',
    from: "  const serviceType = deliveryServiceType(args.transportMethod);\n  if (!serviceType) {",
    to:   "  const serviceType = deliveryServiceType(args.transportMethod) ?? (args.shipTo ? 'delivery_only' : null);\n  if (!serviceType) {" },

  // ══ NO BACKFILL — §4 of the migration ══════════════════════════════════════════════════════
  { id: 'B1', target: MIGRATION,
    why: '🔴 THE BOOK IS SEEDED FROM HISTORY — AGAVE\'s four spellings of one yard become four CURATED sites and the drift is permanent instead of fixed',
    from: 'COMMIT;\n\n-- ═════',
    to:   "INSERT INTO public.customer_addresses (business_id, customer_id, label, line1)\n  SELECT business_id, id, 'Imported', billing_line1 FROM public.customers WHERE billing_line1 IS NOT NULL;\n\nCOMMIT;\n\n-- ═════" },
  { id: 'B2', target: LIB,
    why: 'the module starts reading `customers` — the first step towards deriving a book from history rather than from what somebody chose',
    from: "    .from('customer_addresses')\n    .select(CUSTOMER_ADDRESS_COLUMNS)",
    to:   "    .from('customers')\n    .select(CUSTOMER_ADDRESS_COLUMNS)" },

  // ══ THE ANTI-DRIFT GUARD — the reason the table exists ══════════════════════════════════════
  { id: 'A1', target: LIB,
    why: '🔴 the same yard in different case is saved as a SECOND site — the book reproduces the exact drift it was built to stop',
    from: '  return v.toLowerCase().replace(/[.,]/g, \' \').replace(/\\s+/g, \' \').trim();',
    to:   '  return v.trim();' },
  { id: 'A2', target: LIB,
    why: 'the twin check ignores retired rows AND active ones alike — every save becomes a duplicate',
    from: '  return sites.find(s => s.active && sameAddress(s, candidate)) ?? null;',
    to:   '  return null;' },
  { id: 'A3', target: LIB,
    why: '⚠️ the comparison turns EAGER — `Rd` and `Road` collapse, so a genuinely different site is silently refused, which is the worse failure',
    from: '  return v.toLowerCase().replace(/[.,]/g, \' \').replace(/\\s+/g, \' \').trim();',
    to:   '  return v.toLowerCase().replace(/[.,]/g, \' \').replace(/\\brd\\b/g, \'road\').replace(/\\s+/g, \' \').trim();' },
  { id: 'A4', target: LIB,
    why: 'an EMPTY address matches everything — every blank form reads as "already saved" and nothing can ever be added',
    from: '  const x = addressOf(a), y = addressOf(b);\n  return SITE_ADDRESS_FIELDS.every(f => normalizeAddressPart(x[f]) === normalizeAddressPart(y[f]));',
    to:   '  const x = addressOf(a), y = addressOf(b);\n  return SITE_ADDRESS_FIELDS.some(f => normalizeAddressPart(x[f]) === normalizeAddressPart(y[f]));' },

  // ══ THE SAVE IS AN ACT, NOT A SIDE EFFECT ══════════════════════════════════════════════════
  { id: 'S1', target: LIB,
    why: '🔴 a site saves with NO NAME — the label was the only thing making this a decision, and the book fills with one-off drops',
    from: "  if (!label) return { kind: 'refused', reason: 'Give this place a name so it can be picked later — \"Job site A\", \"The yard\".' };",
    to:   "  const _unused = label;" },
  { id: 'S2', target: LIB,
    why: 'a site saves with no street — an entry the map can never place, offered forever as a choice',
    from: "  if (!address.line1) return { kind: 'refused', reason: 'A saved site needs a street.' };",
    to:   '  // refusal removed' },
  { id: 'S3', target: LIB,
    why: 'a street with neither city nor ZIP is saved — the shape that made two of LAWNS\'s live routes unbuildable on 2026-09-09',
    from: "  if (!address.city && !address.zip) return { kind: 'refused', reason: 'Add a city or a ZIP code — without one the map cannot find this address.' };",
    to:   '  // refusal removed' },
  { id: 'S4', target: LIB,
    why: 'a duplicate LABEL reaches the database, so the person meets a Postgres unique-violation string instead of a sentence',
    from: "  const labelTaken = x.existing.some(s => s.active && s.label.trim().toLowerCase() === label.toLowerCase());",
    to:   '  const labelTaken = false;' },
  { id: 'S5', target: CARD,
    why: '🔴 the offer appears on every card whether or not an address was saved — population stops being a by-product and becomes a nag',
    from: '    if (canSaveSite) { setSiteNote(null); setSiteOffer({ label: \'\' }); }',
    to:   '    if (canSaveSite) { setSiteNote(null); }' },

  // ══ THE WRITE IS PROVEN BY THE COUNT (R-12 / A8) ═══════════════════════════════════════════
  { id: 'W1', target: LIB,
    why: '🔴 an RLS-REFUSED insert reports SAVED — zero rows and no error is what PostgREST returns for a refusal, and the screen would say it worked',
    from: '  const rows = (data ?? []) as unknown as CustomerAddress[];\n  if (rows.length !== 1) {',
    to:   '  const rows = (data ?? []) as unknown as CustomerAddress[];\n  if (false) {' },
  { id: 'W2', target: LIB,
    why: 'a refused RETIRE reports success — the site stays in the picker while the screen says it is gone',
    from: "  if ((data ?? []).length !== 1) {\n    if (TRACE_SITES) console.log('[TRACE:SITES] retire landed on', (data ?? []).length, 'rows, not 1', { siteId });",
    to:   "  if (false) {\n    if (TRACE_SITES) console.log('[TRACE:SITES] retire landed on', (data ?? []).length, 'rows, not 1', { siteId });" },
  { id: 'W3', target: LIB,
    why: 'retiring becomes a DELETE — R-133 says you cannot delete, and an address on a past delivery stops being resolvable',
    from: "    .update({ active: false, is_default: false })\n    .eq('id', siteId).eq('business_id', businessId).select('id');",
    to:   "    .update({ active: false })\n    .eq('id', siteId).eq('business_id', businessId).select('id');" },
  { id: 'W4', target: LIB,
    why: 'the tenant scope leaves the retire — AC-3, and a site id from another business would resolve',
    from: "    .eq('id', siteId).eq('business_id', businessId).select('id');",
    to:   "    .eq('id', siteId).select('id');" },

  // ══ THE GATE MUST REFUSE ═══════════════════════════════════════════════════════════════════
  { id: 'G1', target: ACTIONS,
    why: '🔴 THE SAVE-SITE GATE ADMITS EVERYBODY — a staff member who holds neither string writes to the customer\'s book',
    from: "    if (!can('customers:create')) return { kind: 'refused', reason: requirementText('customers:create') };",
    to:   '    // gate removed' },
  { id: 'G2', target: ACTIONS,
    why: 'the gate widens to a string STAFF already hold, which reads like a gate and refuses nobody',
    from: "    if (!can('customers:create')) return { kind: 'refused', reason: requirementText('customers:create') };",
    to:   "    if (!can('customers:read')) return { kind: 'refused', reason: requirementText('customers:read') };" },
  { id: 'G3', target: CARD,
    why: 'the card offers the button to somebody the action will refuse — a dead affordance, which is not a fix',
    from: "  const canSaveSite = can('customers:create') && !!d.customer_id;",
    to:   '  const canSaveSite = true;' },
  { id: 'G4', target: MIGRATION,
    why: '🔴 the SELECT policy drops its permission check — every active member of the tenant reads the book regardless of what they hold',
    from: "  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'customers:read'));",
    to:   '  USING (public.is_active_member(business_id));' },
  { id: 'G5', target: MIGRATION,
    why: '🔴 a raw owner_id policy is added — the 50th, three days after 20260910b took 49 down to 12 (R-119)',
    from: 'DROP POLICY IF EXISTS customer_addresses_member_select ON public.customer_addresses;',
    to:   "CREATE POLICY customer_addresses_owner ON public.customer_addresses FOR ALL\n  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = customer_addresses.business_id AND b.owner_id = auth.uid()));\nDROP POLICY IF EXISTS customer_addresses_member_select ON public.customer_addresses;" },
  { id: 'G6', target: MIGRATION,
    why: 'a NEW permission string is minted — `sites:create`, which no live member holds, so the table would be unwritable on day one (R-22)',
    from: "  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'customers:create'));",
    to:   "  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'sites:create'));" },
  { id: 'G7', target: MIGRATION,
    why: 'a DELETE policy appears — R-133 soft-delete stops being structural and becomes a convention',
    from: 'ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;',
    to:   'ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;\nCREATE POLICY customer_addresses_member_delete ON public.customer_addresses FOR DELETE TO authenticated\n  USING (public.is_active_member(business_id));' },
  { id: 'G8', target: MIGRATION,
    why: 'RLS is never enabled — the table is readable by anyone with the anon key, across every tenant (AC-2/AC-3)',
    from: 'ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;',
    to:   '-- RLS not enabled' },

  // ══ THE DECLARATION MATCHES THE MIGRATION (#179) ═══════════════════════════════════════════
  { id: 'D1', target: FIELDS,
    why: '🔴 #179 EXACTLY — the select names fewer columns than the migration creates, and a column with no reader is invisible to tsc, eslint and knip',
    from: "  'id, business_id, customer_id, label, line1, line2, city, state, zip, notes, is_default, active, created_at, updated_at';",
    to:   "  'id, business_id, customer_id, label, line1, city, state, zip, is_default, active';" },
  { id: 'D2', target: MIGRATION,
    why: 'the migration gains a column the select does not name — the same drift from the other direction',
    from: '  notes        text,',
    to:   '  notes        text,\n  gate_code    text,' },
  { id: 'D3', target: MIGRATION,
    why: '`line2` is dropped from the table — David asked for it from day one so tech-debt #254 has somewhere to land',
    from: '  line2        text,   -- see the header: present, offered by NO surface in this build.',
    to:   '  -- line2 removed' },
  { id: 'D4', target: MIGRATION,
    why: 'the one-default index goes, so a customer can hold three defaults and the picker\'s order becomes arbitrary',
    from: 'CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_one_default',
    to:   'CREATE INDEX IF NOT EXISTS customer_addresses_one_default_NOT_UNIQUE' },

  // ══ REACH, NOT SUBJECT (tech-debt #182) ════════════════════════════════════════════════════
  { id: 'R1', target: PICKER,
    why: '⚠️ REACH — the picker gains the power to WRITE. The unit suite is perfectly green through this; only a probe that opens the .tsx can see it',
    from: 'import {\n  readCustomerAddresses, siteLine, sameAddress,',
    to:   'import {\n  readCustomerAddresses, saveCustomerAddress, siteLine, sameAddress,' },
  { id: 'R2', target: CAPTURE,
    why: '⚠️ REACH — the checkout form stops sending the ship-to. Every unit probe stays green while the picker silently becomes decoration',
    from: '    setShipTo(deliveryRequired && address.trim()',
    to:   '    setShipTo(false && deliveryRequired && address.trim()' },
  { id: 'R4', target: CAPTURE,
    why: '🔴 CROSS-CUSTOMER LEAK — starting a NEW customer keeps the previous one\'s id, so the picker offers somebody else\'s delivery sites on this order (AC-3\'s shape at the surface)',
    from: '                setPickerCustomerId(null);',
    to:   '                // id kept' },
  { id: 'R3', target: PICKER,
    why: '⚠️ REACH + a real defect — the picker claims "no saved sites" before it has looked, stating a fact it does not have (D-9)',
    from: '  if (!loaded || sites.length === 0) return null;',
    to:   '  if (sites.length === 0 && loaded === loaded && false) return null;\n  if (sites.length === 0) return null;' },
];

const files = [...new Set(MUTANTS.map(m => m.target))];
const originals = new Map(files.map(f => [f, readFileSync(ROOT + f, 'utf8')]));
let caught = 0, survived = 0, errored = 0;

try {
  // 🔴 GREEN CONTROL FIRST. A CAUGHT reported against an already-red suite means nothing.
  for (const s of SUITES) {
    process.stdout.write(`  CONTROL ${s.split('/').pop().padEnd(28)} … `);
    if (!suiteIsGreen(s)) { console.log('RED — aborting; every CAUGHT below would be meaningless.'); process.exit(2); }
    console.log('GREEN ✓');
  }
  console.log('');

  for (const m of MUTANTS) {
    const original = originals.get(m.target);
    if (!original.includes(m.from)) {
      // 🔴 A MUTANT THAT NEVER APPLIED IS AN ERROR, NOT A PASS. It is indistinguishable from a
      // caught one in every way except that it proved nothing (#182).
      console.log(`  ${m.id.padEnd(4)} ERROR    the from-text is not in ${m.target.split('/').pop()} — mutant never applied`);
      errored++; continue;
    }
    writeFileSync(ROOT + m.target, original.replace(m.from, m.to));
    const green = allGreen();
    writeFileSync(ROOT + m.target, original);
    if (green) { console.log(`  ${m.id.padEnd(4)} SURVIVED 🔴  ${m.why}`); survived++; }
    else       { console.log(`  ${m.id.padEnd(4)} CAUGHT   ✓   ${m.why}`); caught++; }
  }
} finally {
  for (const [f, src] of originals) writeFileSync(ROOT + f, src);
}

console.log(`\n  ── ${caught}/${caught + survived} caught · ${survived} survived · ${errored} never applied ──\n`);
process.exit(survived > 0 || errored > 0 ? 1 : 0);
