/**
 * ── STEP 0 (OPTION A) — THE THREE ROWS LAWNS IS MISSING, DRIVEN THROUGH THE WHOLE CHAIN ───────
 *
 * PURPOSE: David ruled (2026-09-23) that Option A runs FIRST — *"insert the three missing
 *   transport rows at flat prices and prove the branch wiring and the stop signal before
 *   spending build hours."* The live PAT is read-only and LAWNS is David's to write, so the
 *   rows cannot be inserted from here. What CAN be done, and is what this file does, is drive
 *   the EXACT rows the step-0 SQL creates through the REAL shipped functions — so the screen
 *   David will see after pasting it is asserted before he pastes anything.
 *
 * 🔴 IT IS THE WHOLE CHAIN, NOT THE RESOLVER ALONE. The step-0 deliverable is two claims —
 *   "the branch wiring works" and "the stop signal works" — and the second one lives in
 *   `submit.ts`, three functions downstream of the first:
 *
 *     service_offerings rows
 *       → resolveTransportRoles   (transport.ts)   roles by SHAPE
 *       → availableChoices        (transport.ts)   which branches the radio offers
 *       → choiceToSelection       (transport.ts)   branch → (transport, planting)
 *       → deriveTransportMethod   (submit.ts)      → orders.transport_method
 *       → deliveryServiceType     (submit.ts)      → deliveries.service_type
 *
 *   A test that stopped at the first arrow would prove the radio and say nothing about the
 *   truck, which is half of what step 0 was asked to establish.
 *
 * WHICH THREE ROWS, AND WHY THESE THREE (Thunder's reading, flagged for David). LAWNS is missing
 *   FOUR transport rows, not three — install, tailgate, backyard and self-collect. The three
 *   chosen are the three that prove something step 0 was asked to prove:
 *     · INSTALL      staff/per_unit — the ONLY shape that can produce `transport_method='install'`,
 *                    so it is the only row that can prove the stop signal at all.
 *     · TAILGATE     staff/flat     — a SECOND staff/flat row beside Trip Charge, which is what
 *                    makes tech-debt #251 visible on David's own screen rather than in a report.
 *     · SELF-COLLECT self/flat $0   — restores the branch LAWNS has never had.
 *   BACKYARD is deliberately held back: its entire point is an amount typed at the counter, and
 *   that is blocked until the MANAGER holds `order_discount:apply` (David's ruling (a)), so
 *   inserting it in step 0 would put a dead control in front of Lauren.
 *
 * DEPENDENCIES: ./transport, ../../api/orders/submit (both real, neither stubbed).
 * Run: node scripts/run-tests.mjs transportStep0
 */
import { resolveTransportRoles, availableChoices, choiceToSelection } from './transport';
import { deriveTransportMethod, deliveryServiceType } from '../../api/orders/submit';
import type { ServiceOffering } from '../types/plant';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg); console.error('   ✗ ' + msg);
}

function row(p: Partial<ServiceOffering> & { name: string }): ServiceOffering {
  return {
    id: p.name, business_id: 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74', description: null,
    category: 'transport', timing: 'at_checkout', price_type: 'flat', price_unit: 'order', price: 0,
    transport_mode: null, trigger_transport_mode: null, recurrence_days: null,
    requires_address: false, pre_selected: false, is_active: true, sort_order: 0,
    compliance_title: null, compliance_body: null, service_note: null, ...p,
  };
}

// ── LAWNS AS IT STANDS, MEASURED LIVE 2026-09-23 ─────────────────────────────────────────────
// One transport row. Its sort_order of 100 is load-bearing below: it is why Trip Charge keeps
// the "delivery" role after step 0 and Tailgate is the row that disappears.
const TRIP_CHARGE = row({
  name: 'Trip Charge', transport_mode: 'staff', price_type: 'flat', price_unit: 'order',
  price: 50, requires_address: true, sort_order: 100,
});

// ── THE THREE ROWS THE STEP-0 SQL INSERTS ────────────────────────────────────────────────────
// Every field here matches `docs/decisions/2026-09-23-step0-lawns-transport-rows.sql` exactly.
const TAILGATE = row({
  name: 'Tailgate Delivery', transport_mode: 'staff', price_type: 'flat', price_unit: 'order',
  price: 150, requires_address: true, sort_order: 101,
});
const INSTALL = row({
  name: 'Installation', transport_mode: 'staff', price_type: 'per_unit', price_unit: 'plant',
  price: 450, requires_address: true, sort_order: 102,
});
const SELF_COLLECT = row({
  name: 'I will collect it myself', transport_mode: 'self', price_type: 'flat', price_unit: 'order',
  price: 0, requires_address: false, pre_selected: true, sort_order: 103,
});

// 🔴 ORDERED THE WAY `useServices` ORDERS THEM, AND THAT IS NOT DECORATION.
// `useServices` issues `.order('sort_order', { ascending: true })`, and `resolveTransportRoles`
// then picks roles with `find`/`filter` — i.e. BY ARRAY POSITION. A fixture that hardcodes the
// array order is therefore asserting its own literal, not the rule.
// ⚠️ THIS WAS A REAL DEFECT IN THIS FILE, CAUGHT BY MUTANT M3 AND NOT BY READING IT. The first
// draft wrote `[TRIP_CHARGE, TAILGATE, INSTALL, SELF_COLLECT]` by hand; M3 moved Trip Charge's
// sort_order from 100 to 102 — which in the live query would hand Tailgate the delivery role —
// and §D went on passing, because the literal never moved. Tech-debt #182's class ("a harness
// that cannot reach its target reports the same as one that passed") inside a file written to
// prove #251. Sorting here is what makes sort_order load-bearing in the test as it is in the app.
const bySortOrder = (rows: ServiceOffering[]): ServiceOffering[] =>
  [...rows].sort((a, b) => a.sort_order - b.sort_order);

const BEFORE = bySortOrder([TRIP_CHARGE]);
const AFTER  = bySortOrder([TRIP_CHARGE, TAILGATE, INSTALL, SELF_COLLECT]);

// ── §A — WHAT LAWNS'S CHECKOUT DOES TODAY. The baseline step 0 is measured against. ───────────
{
  const roles   = resolveTransportRoles(BEFORE);
  const choices = availableChoices(roles);
  ok(choices.length === 1 && choices[0] === 'delivery_only',
    '§A today LAWNS is offered exactly ONE branch — "Delivery only", $50');
  ok(roles.self === null && roles.planting === null,
    '§A there is no self row and no planting row, so neither branch can be assembled');
  ok(roles.flags.some(f => /no self-transport row/.test(f)),
    '§A and the screen already says so — the missing self row is flagged, not silent');
  // 🔴 The stop signal today: staff + flat ⇒ 'delivery' ⇒ a drop-off. LAWNS cannot ring up an
  // install at the counter at all, which is why all 21 of their install orders came from a door
  // that is not checkout (17 imported, 4 not; measured live 2026-09-23).
  ok(deriveTransportMethod(TRIP_CHARGE, false) === 'delivery',
    '§A 🔴 Trip Charge alone can only ever write transport_method=delivery — checkout cannot produce an install');
  ok(deliveryServiceType('delivery') === 'delivery_only',
    '§A so the stop it writes is a drop-off, never a planting job');
}

// ── §B — AFTER STEP 0: THE BRANCH WIRING. Three branches, which is the first claim. ───────────
{
  const roles   = resolveTransportRoles(AFTER);
  const choices = availableChoices(roles);
  ok(choices.length === 3, '§B step 0 turns one branch into three');
  ok(choices.includes('delivery_planting'), '§B "Delivery + planting" is now offered');
  ok(choices.includes('delivery_only'),     '§B "Delivery only" is still offered');
  ok(choices.includes('self'),              '§B "No thank you — I\'ll haul it myself" is offered for the first time');
  ok(roles.delivery === TRIP_CHARGE, '§B the per-order delivery fee resolves to Trip Charge ($50)');
  ok(roles.planting === INSTALL,     '§B the per-plant role resolves to Installation ($450/plant)');
  ok(roles.self === SELF_COLLECT,    '§B the self role resolves to the $0 pickup row');
  ok(roles.fused === null,           '§B nothing is running on the fused legacy shape');
  ok(roles.unbound.length === 0,     '§B every row says who transports — the live CHECK would refuse one that did not');
}

// ── §C — AFTER STEP 0: THE STOP SIGNAL. The second claim, and the whole reason INSTALL is in. ──
{
  const roles = resolveTransportRoles(AFTER);

  const planting = choiceToSelection('delivery_planting', roles);
  ok(planting.transport === TRIP_CHARGE && planting.planting === INSTALL,
    '§C "Delivery + planting" attaches BOTH rows — the $50 trip charge ×1 and the install ×N plants');
  const mPlanting = deriveTransportMethod(planting.transport!, planting.planting !== null);
  ok(mPlanting === 'install', '§C 🔴 THE SIGNAL: it writes orders.transport_method = install');
  ok(deliveryServiceType(mPlanting) === 'planting',
    '§C 🔴 AND THE STOP: deliveries.service_type = planting — an install job on the truck');

  const dropOff = choiceToSelection('delivery_only', roles);
  const mDrop   = deriveTransportMethod(dropOff.transport!, dropOff.planting !== null);
  ok(mDrop === 'delivery' && deliveryServiceType(mDrop) === 'delivery_only',
    '§C "Delivery only" still writes a drop-off stop — step 0 does not reclassify their existing work');

  const self  = choiceToSelection('self', roles);
  const mSelf = deriveTransportMethod(self.transport!, self.planting !== null);
  ok(mSelf === 'self', '§C self-collect writes transport_method = self');
  ok(deliveryServiceType(mSelf) === null,
    '§C 🔴 and NO stop is written — our truck does not go out, so there is nothing to schedule');
}

// ── §D — WHAT STEP 0 DOES NOT FIX, ASSERTED SO IT CANNOT BE MISREAD AS WORKING ────────────────
// 🔴 tech-debt #251, on David's own data. Two staff/flat rows; `staff.find(price_type==='flat')`
// takes the first by sort_order. Trip Charge (100) wins, Tailgate (101) is offered NOWHERE and
// named in NO flag. This is the defect David ruled (e) must be fixed — pinned here so that when
// it IS fixed, this section goes red deliberately rather than quietly passing.
{
  const roles = resolveTransportRoles(AFTER);
  ok(roles.delivery === TRIP_CHARGE,
    '§D (#251) Trip Charge wins the delivery role on sort_order — it is first at 100');
  ok(roles.delivery !== TAILGATE,
    '§D (#251) 🔴 Tailgate Delivery is NOT offered after step 0 — the second staff/flat row loses');
  ok(!roles.flags.some(f => /Tailgate/.test(f)),
    '§D (#251) 🔴 and NOTHING names it: no flag, no heads-up line. David will not see it on screen');
  ok(availableChoices(roles).length === 3,
    '§D (#251) the radio shows three branches while FOUR rows are set up — the count is the tell');
}

// ── §E — the install price step 0 uses is PROVISIONAL, and the code must not come to rely on it ─
// David ruled (b): seed from what they actually bill, per size, with Lauren's sheet beside it.
// $450 is the ONE rung where her sheet and their billed median agree exactly (45 gal), which is
// why it is the least arbitrary single number to stand in until the ladder carries the table.
// ⚠️ At this price a 15 gal tree is installed for $450 against a billed median of $204.
{
  const roles = resolveTransportRoles(AFTER);
  ok(Number(roles.planting!.price) === 450,
    '§E step 0 charges one flat $450/plant at EVERY size — correct only at 45 gal');
  ok(roles.planting!.price_type === 'per_unit' && roles.planting!.price_unit === 'plant',
    '§E it scales per plant, so a 5-tree order is 5 × $450 — the shape Option B keeps, with the price coming from the rung');
}

console.log(`\n  transportStep0: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
