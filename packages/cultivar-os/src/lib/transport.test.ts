/**
 * ── transport — the checkout's transport roles, and the row that used to vanish without a word ──
 *
 * 🔴 R-120 RECON Q1, ANSWERED IN CODE: WHAT CONSUMES `category='transport'` AT ORDER TIME?
 * `useServices` loads active `at_checkout` rows and splits them on `category`; `resolveTransportRoles`
 * then sorts the transport ones by `transport_mode` ALONE — `find(mode === 'self')`,
 * `filter(mode === 'staff')`. The function is TOTAL over {self, staff}, so a NULL-mode row fell out of
 * every role with no flag naming it. §B pins that behaviour to the 2026-09-09 shape exactly.
 *
 * Fixtures are the MEASURED shapes, not invented ones: Test Dave's three transport rows (2026-09-10)
 * and LAWNS's Trip Charge as the books review wrote it on 2026-09-09.
 *
 * Run: node scripts/run-tests.mjs transport
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveTransportRoles, availableChoices, choiceToSelection, choiceMeta } from './transport';
import type { ServiceOffering } from '../types/plant';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

function row(p: Partial<ServiceOffering> & { name: string }): ServiceOffering {
  return {
    id: p.name, business_id: 'b', description: null, category: 'transport', timing: 'at_checkout',
    price_type: 'flat', price_unit: 'order', price: 0, transport_mode: null, trigger_transport_mode: null,
    recurrence_days: null, requires_address: false, pre_selected: false, is_active: true, sort_order: 0,
    compliance_title: null, compliance_body: null, service_note: null, ...p,
  };
}

// Test Dave's, measured 2026-09-10.
const PLACEMENT = row({ name: 'Placement Service', transport_mode: 'staff', requires_address: true, price_type: 'per_unit', price_unit: 'plant', price: 225, sort_order: 10 });
const DELIVERY  = row({ name: 'Delivery',          transport_mode: 'staff', requires_address: true, price_type: 'flat', price_unit: 'order', price: 125, sort_order: 11 });
const PICKUP    = row({ name: 'Self Pickup',       transport_mode: 'self',  requires_address: false, price_type: 'flat', price_unit: 'order', price: 0, sort_order: 12 });
// LAWNS, as the books review wrote it on 2026-09-09.
const TRIP_CHARGE = row({ name: 'Trip Charge', transport_mode: null, price_type: 'flat', price_unit: 'order', price: 50, sort_order: 100 });

// ── §A — a correctly bound set resolves every branch, and names nothing as unbound ───────────────
{
  const roles = resolveTransportRoles([PLACEMENT, DELIVERY, PICKUP]);
  ok(roles.self === PICKUP && roles.deliveries[0] === DELIVERY && roles.planting === PLACEMENT, '§A Test Dave\'s three rows fill self, delivery and planting');
  ok(roles.unbound.length === 0, '§A a set where every row has a mode has no unbound rows');
  ok(JSON.stringify(availableChoices(roles).map(c => c.kind)) === JSON.stringify(['delivery_planting', 'delivery_only', 'self']), '§A all three branches are offered');
  ok(choiceToSelection({ kind: 'delivery_planting', transportId: DELIVERY.id }, roles).planting === PLACEMENT, '§A delivery + planting attaches the per-plant row');
  ok(choiceMeta({ kind: 'delivery_only', transportId: DELIVERY.id }, roles).label === 'Delivery only',
    '§A with ONE per-order row the generic label is still true, so it is still used (§6 r18)');
}

// ── §B — 🔴 THE 2026-09-09 SHAPE: A NULL MODE MATCHES NO ROLE, AND IS NOW NAMED ─────────────────
{
  const roles = resolveTransportRoles([TRIP_CHARGE]);
  ok(roles.self === null && roles.deliveries.length === 0 && roles.planting === null && roles.fused === null,
    '🔴 §B CONFIRMED: a transport row with NO mode fills NO role — the resolver is total over {self, staff}');
  ok(availableChoices(roles).length === 0, '§B …so no branch can be offered — the checkout had nothing to show');
  ok(roles.unbound.length === 1 && roles.unbound[0] === TRIP_CHARGE, '§B the row is COLLECTED as unbound rather than silently dropped');
  ok(roles.flags.length > 0 && /"Trip Charge"/.test(roles.flags[0]) && /who transports/.test(roles.flags[0]),
    '🔴 §B the FIRST flag names the row and says what it lacks — before this build no flag mentioned it at all');
}

// ── §C — beside a working set, the unbound row still does not take a branch, and still leads ────
{
  const roles = resolveTransportRoles([PLACEMENT, DELIVERY, PICKUP, TRIP_CHARGE]);
  ok(availableChoices(roles).length === 3 && roles.deliveries[0] === DELIVERY, '§C a mode-less row changes nothing the bound rows offer — no price is guessed onto an order');
  ok(roles.unbound.length === 1 && /"Trip Charge"/.test(roles.flags[0]), '§C and it is the FIRST flag, so the heads-up line under the radio names it');
}

// ── §D — tech-debt #251 FIXED (ledger #386, David's ruling (e), 2026-09-23) ──────────────────────
// ✏️ THIS SECTION WAS INVERTED ON PURPOSE. It used to assert the DEFECT — *"the SECOND staff/flat
// row is offered nowhere and named in no flag"* — precisely so the day it changed would be a
// deliberate act and not a silent one. This is that day; the old expectations are preserved in the
// text above so the flip is readable, and the assertions below are their opposites.
// It matters for LAWNS: Trip Charge and Tailgate Delivery are both staff, both once per order.
{
  const TAILGATE = row({ name: 'Tailgate Delivery', transport_mode: 'staff', requires_address: true, price_type: 'flat', price_unit: 'order', price: 150, sort_order: 20 });
  // PLACEMENT is in the fixture deliberately: with a planting row present this is exactly LAWNS's
  // shape after step 0 — two per-order staff rows, one per-plant staff row, one self row — which is
  // the case the five-branch count below is about. ✏️ A first draft omitted it and asserted five
  // branches anyway; the run said three, and the ASSERTION was what was wrong, not the resolver.
  const roles = resolveTransportRoles([DELIVERY, TAILGATE, PLACEMENT, PICKUP]);
  ok(roles.deliveries.length === 2 && roles.deliveries[0] === DELIVERY && roles.deliveries[1] === TAILGATE,
    '§D (#251 fixed) BOTH staff/flat rows are roles now, in the order the caller supplied');

  const choices = availableChoices(roles);
  const byId = (o: typeof DELIVERY, kind: string) => choices.some(c => c.transportId === o.id && c.kind === kind);
  ok(byId(TAILGATE, 'delivery_only'), '§D (#251 fixed) 🔴 Tailgate Delivery IS offered — the defect this pins is gone');
  ok(byId(DELIVERY, 'delivery_only'), '§D (#251 fixed) and Delivery is still offered beside it');
  ok(choices.filter(c => c.kind === 'delivery_planting').length === 2,
    '§D (#251 fixed) each per-order row also offers itself WITH planting — 2 rows × 2 shapes + self = 5');
  ok(choices.length === 5, '§D (#251 fixed) five branches, where the old code offered three');

  // 🔴 §6 r18 — A LABEL IS A CLAIM. "Delivery only" twice would name neither row. With more than
  // one per-order row the branch takes the ROW'S OWN NAME, which is the only thing that tells a
  // person which of the two they are choosing.
  ok(choiceMeta({ kind: 'delivery_only', transportId: TAILGATE.id }, roles).label === 'Tailgate Delivery',
    '§D (#251 fixed) with two rows the branch is labelled by the ROW, not by the generic shape');
  ok(choiceMeta({ kind: 'delivery_only', transportId: DELIVERY.id }, roles).label === 'Delivery',
    '§D (#251 fixed) …and so is the other one — neither is left saying "Delivery only"');

  // The selections still resolve to the RIGHT row, which is the half that charges money.
  ok(choiceToSelection({ kind: 'delivery_only', transportId: TAILGATE.id }, roles).transport === TAILGATE,
    '§D (#251 fixed) choosing Tailgate charges the Tailgate row, not the first one');
  ok(choiceToSelection({ kind: 'delivery_only', transportId: 'no-such-row' }, roles).transport === null,
    '§D 🔴 an unknown id yields NULL, never a substitute row — a retired row must not silently become a different charge');
}

// ── §E — the checkout screen reads the unbound rows, instead of saying nothing is set up ────────
{
  const addOns = readFileSync(join(process.cwd(), 'packages/cultivar-os/src/pages/AddOns.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const empty = addOns.slice(addOns.indexOf('choices.length === 0 ?'), addOns.indexOf('<TransportToggle'));
  ok(empty.length > 50 && /roles\.unbound\.length > 0/.test(empty),
    '🔴 §E the empty state checks for unbound rows FIRST — "no transport options are set up" was false on 2026-09-09');
  ok(/No transport options are set up/.test(empty), '§E the old sentence survives only as the branch where it is TRUE');
}

console.log(`\n  transport: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
