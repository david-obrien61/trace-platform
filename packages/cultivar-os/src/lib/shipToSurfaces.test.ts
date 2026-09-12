/**
 * ── THE SHIP-TO SURFACES — the picker, the offer, and the gate that must REFUSE ──────────────
 *
 * WHAT THIS GUARDS (ledger #303, D-41's L2 hook):
 *   · 🔴 The order-time picker exists AND the address it produces actually travels to the server.
 *     A picker that fills a form nobody sends is the exact shape of a lie on a screen.
 *   · 🔴 THE SAVE-SITE OFFER IS GATED ON `customers:create`, WHICH STAFF DO NOT HOLD. The prompt's
 *     acceptance says it plainly: *a gate that has only ever admitted is not a proven gate.* §C
 *     drives the permission predicate BOTH WAYS against the real default bundles.
 *   · Population is a BY-PRODUCT: the offer is reachable only from a save that landed.
 *   · D-41 L1 survives — no `shipping_*` column is added anywhere, by anything.
 *   · `line2` is offered by NO surface (tech-debt #279) — a field that cannot reach the truck must
 *     not be typeable.
 *
 * ⚠️ THESE ARE CORPUS PROBES, AND EVERY ONE FIRST ASSERTS IT REACHED ITS TARGET. #182: a scanner
 * that reports a count it never states an expectation for is indistinguishable from one that
 * matched nothing. Each §  opens by proving the file was read and is the file it thinks it is.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/shipToSurfaces.test.ts --bundle --platform=node --format=cjs | node
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MANAGER_DEFAULT_BUNDLE, STAFF_DEFAULT_BUNDLE } from '@trace/shared/auth/permissionManifest';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg);
}

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const CAPTURE   = 'packages/cultivar-os/src/pages/CustomerCapture.tsx';
const CARD      = 'packages/cultivar-os/src/components/delivery/StopCard.tsx';
const ACTIONS   = 'packages/cultivar-os/src/components/delivery/useStopActions.tsx';
const PICKER    = 'packages/shared/src/components/customers/ShipToPicker.tsx';
const REVIEW    = 'packages/cultivar-os/src/pages/CartReview.tsx';
const SUBMITTER = 'packages/cultivar-os/src/hooks/useSubmitOrder.ts';

function main(): void {
  // ══ A. THE PICKER IS MOUNTED, AND WHAT IT PRODUCES IS SENT ══════════════════════════════════
  {
    const src = read(CAPTURE);
    ok(/export function CustomerCapture/.test(src), 'A0 CustomerCapture was READ and is the file it claims to be');
    ok(/<ShipToPicker/.test(src), 'A1 the checkout form mounts the saved-sites picker');
    // 🔴 THE CALL IS NOT THE ASSERTION — ITS CONDITION IS. Mutant R2 prefixed `false &&` and a
    // probe for `setShipTo(` stayed perfectly green while the picker became decoration.
    const shipCall = src.slice(src.indexOf('setShipTo('), src.indexOf('setShipTo(') + 320);
    ok(shipCall.length > 50, 'A2a the setShipTo call site was READ');
    ok(/setShipTo\(deliveryRequired && address\.trim\(\)/.test(src),
      'A2 🔴 the ship-to is sent on a REACHABLE condition — a picker whose result is never sent is a lie');
    ok(!/setShipTo\((false|true|0|null)\b/.test(src),
      'A2b 🔴 and the condition is not short-circuited dead (R2\'s survivor)');
    ok(/deliveryRequired && address\.trim\(\)/.test(src),
      'A3 a ship-to is sent only for a DELIVERY with a street — a self-collect order describes no journey');
    ok(/source: 'typed'/.test(src), 'A4 what travels is the FIELDS AS THEY STAND, not the chip that was clicked');
    // The picker must be inside the delivery branch: offering saved delivery sites on a
    // self-collect order is a header whose claim does not hold (§6 r18).
    ok(/\{deliveryRequired && \(\s*<ShipToPicker/.test(src), 'A5 the picker renders only when a delivery is being taken');
    // 🔴 NO CROSS-CUSTOMER LEAK. Selecting an existing customer sets the id the book is read with;
    // starting a NEW customer must drop it, or the picker offers the PREVIOUS customer's delivery
    // sites while a different person is being typed in — one customer's address on another's order.
    const addNew = src.slice(src.indexOf('onAddNew={'), src.indexOf('onAddNew={') + 900);
    ok(addNew.length > 100, 'A10a the add-new handler was READ');
    ok(/setPickerCustomerId\(null\)/.test(addNew),
      'A10 🔴 starting a NEW customer clears the saved-sites customer — no cross-customer address leak');
    ok(/setPickerCustomerId\(h\.id\)/.test(src),
      'A11 …and selecting an EXISTING one sets it, so the probe above is not green by the id never being set at all');
  }
  {
    const src = read(REVIEW);
    ok(/useSubmitOrder\(\)/.test(src), 'A6 CartReview was READ');
    ok(/^\s*shipTo,$/m.test(src), 'A7 CartReview forwards the ship-to to submit');
  }
  {
    const src = read(SUBMITTER);
    ok(/fetch\('\/api\/orders\/submit'/.test(src), 'A8 the submitter was READ');
    const body = src.slice(src.indexOf('body:'), src.indexOf('body:') + 600);
    ok(/shipTo/.test(body), 'A9 🔴 `shipTo` is in the POST BODY — not merely destructured and dropped');
  }

  // ══ B. THE PICKER READS AND NEVER WRITES ════════════════════════════════════════════════════
  {
    const src = read(PICKER);
    ok(/export function ShipToPicker/.test(src), 'B0 the picker was READ');
    const tables = [...src.matchAll(/\.from\(\s*'([^']+)'\s*\)/g)].map(m => m[1]);
    ok(tables.length === 0, `B1 the picker itself touches NO table directly (got ${tables.join(',') || 'none'})`);
    ok(/readCustomerAddresses/.test(src), 'B2 it reads through the one module that knows the book');
    ok(!/saveCustomerAddress|retireCustomerAddress/.test(src), 'B3 🔴 the picker cannot WRITE — choosing a site saves nothing');
    // 🔴 BOTH HALVES OF THE GUARD. Mutant R3 kept a `sites.length === 0` line and dropped the
    // `!loaded` half, so the picker claimed "nothing saved" before it had looked — a fact it did
    // not have (D-9) — and a probe matching the second line stayed green.
    ok(/if \(!loaded \|\| sites\.length === 0\) return null;/.test(src),
      'B4 🔴 the picker renders nothing until it has LOOKED, and nothing when there is nothing');
    ok(!/if \(!loaded \|\| sites\.length === 0\) return null;/.test('if (sites.length === 0) return null;'),
      'B4b …and that probe REFUSES the half-guard (R3\'s survivor)');
    ok(/out\.ok \? out\.sites : \[\]/.test(src),
      'B5 a refused read is an EMPTY BOOK, not a broken screen — a missing convenience must not delete the act');
    ok(!/line2/.test(src), 'B6 the picker never shows line2 (tech-debt #279)');
  }

  // ══ C. 🔴 THE GATE MUST REFUSE. PROVEN BOTH WAYS, AGAINST THE REAL BUNDLES ═══════════════════
  {
    ok(MANAGER_DEFAULT_BUNDLE.length > 5 && STAFF_DEFAULT_BUNDLE.length > 5,
      'C0 the real permission bundles were LOADED (not an empty stand-in that would pass either way)');
    // The gate as the card computes it. Written as a predicate so the test can run it, rather than
    // asserted about a string in a file — a grep cannot tell an admitting gate from a refusing one.
    const canSaveSite = (held: string[], customerId: string | null) => held.includes('customers:create') && !!customerId;

    ok(canSaveSite(MANAGER_DEFAULT_BUNDLE, 'cust-1') === true,
      'C1 a MANAGER holding customers:create is offered the save');
    ok(canSaveSite(STAFF_DEFAULT_BUNDLE, 'cust-1') === false,
      'C2 🔴 A STAFF MEMBER IS REFUSED — the gate has been seen to say NO, not only YES');
    ok(STAFF_DEFAULT_BUNDLE.includes('customers:read'),
      'C3 …and it is a real asymmetry: staff CAN read the book, so the picker still works for them');
    ok(STAFF_DEFAULT_BUNDLE.includes('deliveries:update'),
      'C4 …and they CAN still move the stop — the stricter string is the save, not the edit');
    ok(canSaveSite(MANAGER_DEFAULT_BUNDLE, null) === false,
      'C5 a stop with no customer is refused — there is nobody to save the site for');
    // The negative control on the control: if the predicate were constant-true, C2 would be the
    // probe that caught it. Assert the two inputs genuinely disagree.
    ok(canSaveSite(MANAGER_DEFAULT_BUNDLE, 'c') !== canSaveSite(STAFF_DEFAULT_BUNDLE, 'c'),
      'C6 the predicate DISCRIMINATES — it is not a constant wearing a gate\'s clothes (R-33)');
  }
  {
    // ✏️ C8–C10 RE-AIMED 2026-09-12, NOT LOOSENED. The claims they make are all still true; the
    // code they make them about moved from <StopCard> to `useStopActions` when CARD 4's live failure
    // was fixed. The offer had to leave the card: held there, it died in the unmount that the card's
    // own save triggers on two of the three screens. Each assertion now reads the file that owns the
    // behaviour. 🔴 AND NONE OF THEM COULD HAVE CAUGHT THAT DEFECT — they are regex over source
    // text, and every one was TRUE of the broken file. The probe that catches it MOUNTS:
    // `packages/cultivar-os/src/components/delivery/stopOfferMount.test.ts`, A2.
    const src  = read(CARD);
    const acts = read(ACTIONS);
    ok(/export function StopCard|function StopCard/.test(src), 'C7 StopCard was READ');
    ok(/can\('customers:create'\) && d\.customer_id/.test(acts),
      'C8 the HOOK gates raising the offer on customers:create AND a customer to save it for');
    // ✏️ C9 RE-AIMED AGAIN 2026-09-12 — AND IN THE OPPOSITE DIRECTION, WHICH IS THE POINT.
    // It asserted the CARD renders the offer. §8 V3 (R-148) says it must not: feedback in a repeated
    // row has a position set by the rows above it, and this offer sat below the fold twice on
    // /delivery-schedule. The offer is a dialog in the hook's overlays now, so the claim inverts.
    ok(!/siteOffer/.test(src),
      'C9 🔴 the CARD does not render the offer at all — it is a dialog outside the list (§8 V3)');
    ok(/<SaveSiteDialog/.test(acts) && /offer=\{siteOffer\}/.test(acts),
      'C9b and the hook renders it in `overlays`, beside the review ask (C9 is not vacuous)');
    ok(/if \(out\.kind === 'saved'\) \{[\s\S]{0,1400}?setSiteOffer\(\{[\s\S]{0,300}?stopId: d\.id/.test(acts),
      'C10 🔴 the offer is reachable ONLY from a save that landed — population is a by-product, never a chore');
    ok(!/setSiteOffer\(\{ stopId: d\.id, label: '[^']/.test(acts),
      'C11 the name starts BLANK — nothing auto-saves, and no label is guessed on the owner\'s behalf');
    // `setSiteOfferLabel(` is the hook's setter called THROUGH the prop and is allowed; the trailing
    // paren is what tells the two apart, so this does not forbid the card from driving the offer.
    ok(!/setSiteOffer\(|setSiteNote\(/.test(src),
      'C11b 🔴 THE CARD HOLDS NO OFFER STATE OF ITS OWN — the regression guard for CARD 4, in source terms');
    ok(/setSiteOffer\(/.test(acts), 'C11c and the state it no longer holds is genuinely held by the hook (C11b is not vacuous)');
    // §8 V2 — the one note the card still renders is SELF-ANCHORED: inside the editor, above the
    // Save control that produced it. That is the compliant form, not an exception to V1.
    ok(/\{addressNote && \(/.test(src) && /addressNote\?\.landed \? 'Close' : 'Cancel'/.test(src),
      'C11d the ship-to note is rendered on the control that produced it, and the editor stays open to hold it (§8 V2)');
  }
  {
    const src = read(ACTIONS);
    ok(/async function saveSite/.test(src), 'C12 the action exists');
    ok(/if \(!can\('customers:create'\)\) return \{ kind: 'refused'/.test(src),
      'C13 🔴 and it refuses SERVER-SIDE-BOUND too — the UI gate is not the only gate (§1.6 item 4)');
    ok(/if \(!d\.customer_id\) return \{ kind: 'refused'/.test(src), 'C14 a stop with no customer is refused in words');
    ok(/readCustomerAddresses\(supabase, businessId!, d\.customer_id\)/.test(src),
      'C15 the book is re-read immediately before planning — the twin check is only as good as its list');
  }

  // ══ D. D-41 L1 SURVIVES — NOTHING GAINS A shipping_* COLUMN ═════════════════════════════════
  {
    const dir = join(process.cwd(), 'supabase/migrations');
    const files = readdirSync(dir).filter(f => f.endsWith('.sql'));
    ok(files.length > 50, `D0 the migration corpus was READ (${files.length} files)`);
    const offenders: string[] = [];
    for (const f of files) {
      const body = readFileSync(join(dir, f), 'utf8').split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
      if (/\bshipping_(line1|line2|city|state|zip|address)/i.test(body)) offenders.push(f);
    }
    ok(offenders.length === 0, `D1 🔴 NO migration creates a shipping_* column (found: ${offenders.join(', ') || 'none'})`);
    ok(/\bshipping_(line1|city)/i.test('ALTER TABLE customers ADD COLUMN shipping_line1 text;'),
      'D2 the shipping_* probe can DETECT one — it is not a pattern that matches nothing');
  }
  {
    // The surfaces this build touched, read as one corpus.
    for (const p of [CAPTURE, CARD, ACTIONS, PICKER, REVIEW, SUBMITTER]) {
      const src = read(p);
      ok(src.length > 200, `D3 ${p.split('/').pop()} was read`);
      ok(!/shipping_line1|shipping_city|shipping_zip/.test(src), `D4 ${p.split('/').pop()} composes no shipping_* field`);
    }
  }

  // ══ E. THE STOP EDIT STILL NEVER WRITES THE CUSTOMER (the #301 invariant, unmoved) ══════════
  {
    const src = read('packages/cultivar-os/src/lib/stopWrites.ts');
    ok(/export async function saveShipTo/.test(src), 'E0 stopWrites was READ');
    const tables = [...new Set([...src.matchAll(/\.from\(\s*'([^']+)'\s*\)/g)].map(m => m[1]))].sort();
    ok(tables.join(',') === 'audit_log,deliveries',
      `E1 🔴 the ship-to edit still names only deliveries + audit_log — never customers (got ${tables.join(',')})`);
    ok(!tables.includes('customer_addresses'),
      'E2 and it does NOT write the book either — saving a site is a separate, named act');
  }

  console.log(`\nshipToSurfaces: ${passed} passed, ${failed} failed`);
  if (failed) { for (const f of failures) console.log(`   ✗ ${f}`); process.exit(1); }
}

main();
