import { createClient } from '@supabase/supabase-js';
import { callerCan } from '../../../../shared/src/auth/callerPermission';
import { refreshQBToken } from '../../../../shared/src/quickbooks/refresh';
import { readQBSecrets } from '../../../../shared/src/quickbooks/secrets';
import { isPushHeld, pushHoldReason, QBO_PUSH_HOLD_ENV } from '../../../../shared/src/quickbooks/pushHold';
import { taxExemptionLabel } from '../../../../shared/src/business-logic/taxExemption';
import { personNamesMatch } from '../../../../shared/src/utils/personName';
import {
  resolveQboCustomerMatch,
  type QboCustomerCandidate,
} from '../../../../shared/src/quickbooks/customerIdentity';
import { orderItemName, orderItemAnchor } from '../../../src/lib/orderItemName';
import { HISTORY_ORDER_KIND } from '../../../../shared/src/business-logic/historyOrder';
import { TEST_ORDER_KIND } from '../../../../shared/src/business-logic/orderKind';
import { movesOnHand } from '../../../src/lib/inventoryStates';
import {
  QBO_DETAIL_TYPE,
  isDocumentationAmount,
  descriptionOnlyLine,
  discountLine,
  salesItemLine,
  txnTaxDetail,
  signedLineAmount,
  qboItemMappingOf,
  resolveQboItemRef,
  type QboLine,
  type QboUnmappedLine,
} from '../../../../shared/src/quickbooks/invoiceLineShapes';

const QBO_ENVIRONMENT = process.env.QBO_ENVIRONMENT || 'sandbox';
const QBO_API_BASE =
  QBO_ENVIRONMENT === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com/v3/company'
    : 'https://quickbooks.api.intuit.com/v3/company';
const QB_INVOICE_VIEW_BASE =
  QBO_ENVIRONMENT === 'sandbox'
    ? 'https://app.sandbox.qbo.intuit.com/app/invoice?txnId='
    : 'https://app.qbo.intuit.com/app/invoice?txnId=';

function supabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

async function qbGet(realm: string, token: string, path: string) {
  return fetch(`${QBO_API_BASE}/${realm}/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
}

async function qbPost(realm: string, token: string, path: string, body: unknown) {
  return fetch(`${QBO_API_BASE}/${realm}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}


/**
 * A real identity ambiguity the OWNER must resolve. The push REFUSES rather than guessing —
 * billing the wrong person is catastrophic; a refused push is recoverable (D-47).
 */
class QboIdentityConflict extends Error {
  constructor(message: string) { super(message); this.name = 'QboIdentityConflict'; }
}

/** QBO SQL string escaping — the surname O'Brien MUST survive the predicate. */
function qbEscape(s: string): string { return s.replace(/'/g, "\\'"); }

function toCandidate(c: any): QboCustomerCandidate {
  return {
    id: String(c.Id),
    displayName: c.DisplayName ?? null,
    email: c.PrimaryEmailAddr?.Address ?? null,
  };
}

/** Run one Customer query. Returns ok:false on a request failure (caller decides). */
async function qbQueryCustomers(
  realm: string, token: string, where: string,
): Promise<{ ok: boolean; candidates: QboCustomerCandidate[]; status?: number }> {
  const query = `select * from Customer where ${where} MAXRESULTS 20`;
  const resp = await qbGet(realm, token, `query?query=${encodeURIComponent(query)}&minorversion=65`);
  if (!resp.ok) return { ok: false, candidates: [], status: resp.status };
  const data = await resp.json();
  return { ok: true, candidates: ((data?.QueryResponse?.Customer ?? []) as any[]).map(toCandidate) };
}

/** Read one QBO customer by id — used to VERIFY a stored link before billing it. */
async function qbFetchCustomer(realm: string, token: string, qbId: string): Promise<QboCustomerCandidate | null> {
  const resp = await qbGet(realm, token, `customer/${encodeURIComponent(qbId)}?minorversion=65`);
  if (!resp.ok) return null;
  const data = await resp.json();
  return data?.Customer ? toCandidate(data.Customer) : null;
}

/** QBO rejects a duplicate DisplayName with error 6240 (the name namespace spans customer/vendor/employee). */
function isDuplicateNameError(body: string): boolean {
  return /"code"\s*:\s*"6240"/.test(body) || /Duplicate Name Exists/i.test(body);
}

/** The DisplayName TRACE would use for this party. Empty name → fall back to email. */
function displayNameFor(customer: any): string {
  return `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() || String(customer.email ?? '').trim();
}

/**
 * BillAddr from the D-41 billing_* fields, falling back to the legacy unprefixed address_*
 * (which the shared editor still mirrors — ledger #119). All-empty → OMIT the block entirely
 * rather than push a hollow address (D-9 omit-not-fake).
 */
function billAddrFrom(customer: any): Record<string, string> | undefined {
  const line1 = customer.billing_line1 ?? customer.address_line1 ?? null;
  const line2 = customer.billing_line2 ?? null;
  const city  = customer.billing_city  ?? customer.city  ?? null;
  const state = customer.billing_state ?? customer.state ?? null;
  const zip   = customer.billing_zip   ?? customer.zip   ?? null;
  if (!line1 && !city && !state && !zip) return undefined;
  const addr: Record<string, string> = {};
  if (line1) addr.Line1 = String(line1);
  if (line2) addr.Line2 = String(line2);
  if (city)  addr.City = String(city);
  if (state) addr.CountrySubDivisionCode = String(state);
  if (zip)   addr.PostalCode = String(zip);
  return addr;
}

/**
 * COLLISION GUARD — two TRACE customers must NEVER carry the same qb_customer_id (that is one
 * QBO customer being billed for two different people). business_id-scoped (AC-3).
 * NOTE: this is a read-then-write check, so it is not race-proof under concurrency. The
 * race-proof form is a partial unique index on (business_id, qb_customer_id) — FLAGGED for
 * David as the durable fix; at a single-owner nursery's push volume this guard is proportionate.
 */
async function assertNoLinkCollision(
  db: any, businessId: string, qbId: string, traceCustomerId: string,
): Promise<void> {
  const { data } = await db
    .from('customers').select('id, first_name, last_name')
    .eq('business_id', businessId).eq('qb_customer_id', qbId)
    .neq('id', traceCustomerId).limit(1);
  if (data && data.length > 0) {
    const other = data[0];
    console.log('[TRACE:QBO] ⚠ LINK COLLISION REFUSED — another TRACE customer already owns this qb_customer_id', {
      qb_customer_id: qbId, traceCustomerId, conflictingTraceCustomerId: other.id,
    });
    throw new QboIdentityConflict(
      `QuickBooks customer ${qbId} is already linked to a different TRACE customer `
      + `("${other.first_name ?? ''} ${other.last_name ?? ''}".trim()). TRACE will not bill one QuickBooks customer `
      + `for two different people. Resolve the duplicate in TRACE or QuickBooks, then push again.`,
    );
  }
}

/**
 * Resolve a TRACE customer → a QBO customer id via the D-47 THREE-WAY rule.
 * Ambiguity NEVER auto-links: it resolves to CREATE or SURFACE. See
 * packages/shared/src/quickbooks/customerIdentity.ts for the rule table and the scar.
 */
async function findOrCreateQBCustomer(
  realm: string,
  token: string,
  customer: any,
  businessId: string,
  db: any,
): Promise<string> {
  // [TRACE:QBO] full accountability trail (STD-003, ON until owner-proven).
  const traceCustomerId: string = customer.id;
  const traceName = displayNameFor(customer);
  const email: string | null = customer.email ?? null;

  // (1) the TRACE customer being resolved
  console.log('[TRACE:QBO] cust find-or-create — resolving TRACE customer', {
    traceCustomerId, traceName, email, rule: 'D-47 three-way (email AND name)',
  });

  // (2) query QBO by EMAIL **and** by DisplayName — never email alone. QBO guarantees
  //     DisplayName unique and does NOT guarantee email unique, so the name query is the
  //     one keyed on the field QBO actually enforces.
  const candidateById = new Map<string, QboCustomerCandidate>();
  let searchDegraded = false;

  if (email) {
    const byEmail = await qbQueryCustomers(realm, token, `PrimaryEmailAddr = '${qbEscape(email)}'`);
    if (byEmail.ok) byEmail.candidates.forEach(c => candidateById.set(c.id, c));
    else { searchDegraded = true; console.log('[TRACE:QBO] cust email search FAILED', { status: byEmail.status }); }
  }
  if (traceName) {
    const byName = await qbQueryCustomers(realm, token, `DisplayName = '${qbEscape(traceName)}'`);
    if (byName.ok) byName.candidates.forEach(c => candidateById.set(c.id, c));
    else { searchDegraded = true; console.log('[TRACE:QBO] cust name search FAILED', { status: byName.status }); }
  }
  const candidates = [...candidateById.values()];

  // (3) the FULL candidate set QBO returned — the union of both queries
  console.log('[TRACE:QBO] cust candidate set (union of email + DisplayName queries)', {
    matchOn: 'email AND DisplayName (both queried; both compared)',
    candidateCount: candidates.length, searchDegraded,
    candidates: candidates.map(c => ({ id: c.id, displayName: c.displayName, email: c.email })),
  });

  // (4) THE DECISION — the one shared rule (STD-011)
  const verdict = resolveQboCustomerMatch({ name: traceName, email }, candidates);
  console.log('[TRACE:QBO] cust DECISION', {
    traceCustomerId, traceName, email,
    action: verdict.action, rule: verdict.rule, reason: verdict.reason,
    emailHits: verdict.emailHits.map(c => `${c.id}:${c.displayName}`),
    nameHits:  verdict.nameHits.map(c => `${c.id}:${c.displayName}`),
  });

  if (verdict.action === 'surface') {
    throw new QboIdentityConflict(verdict.reason);
  }

  if (verdict.action === 'link') {
    const qbId = verdict.qbCustomerId!;
    await assertNoLinkCollision(db, businessId, qbId, traceCustomerId);
    await db.from('customers').update({ qb_customer_id: qbId }).eq('id', traceCustomerId);
    // (5) LINKED + (6) the qb_customer_id written back
    console.log('[TRACE:QBO] cust LINKED (email AND name concur) — qb_customer_id written back', {
      action: 'linked-existing', traceCustomerId, qb_customer_id: qbId,
    });
    return qbId;
  }

  // ── CREATE ────────────────────────────────────────────────────────────────────────────
  const displayName = traceName;
  if (!displayName) {
    throw new QboIdentityConflict(
      'This customer has no name and no email, so TRACE cannot identify them in QuickBooks. '
      + 'Add a name to the customer in TRACE, then push again.',
    );
  }
  const billAddr = billAddrFrom(customer);
  console.log('[TRACE:QBO] cust CREATING new QBO customer', {
    traceCustomerId, displayName, email, rule: verdict.rule, hasBillAddr: !!billAddr,
  });
  const createResp = await qbPost(realm, token, 'customer?minorversion=65', {
    GivenName: customer.first_name ?? undefined,
    FamilyName: customer.last_name ?? undefined,
    DisplayName: displayName,
    ...(email ? { PrimaryEmailAddr: { Address: email } } : {}),
    ...(billAddr ? { BillAddr: billAddr } : {}),
  });

  if (!createResp.ok) {
    const errText = await createResp.text();
    // An EXACT DisplayName collision is a REAL ambiguity → SURFACE it. NEVER auto-link onto
    // the colliding record (that is the scar), and never silently create an email-named junk
    // record to route around it (the retired fallback — it hid the collision from the owner).
    if (isDuplicateNameError(errText)) {
      console.log('[TRACE:QBO] ⚠ CREATE REFUSED — QBO reports a duplicate DisplayName (6240)', {
        traceCustomerId, displayName, email,
      });
      throw new QboIdentityConflict(
        `QuickBooks already has a customer named "${displayName}" that TRACE could not match to this customer `
        + `(the emails disagree). TRACE will not guess whether they are the same person. Open QuickBooks and either `
        + `correct that customer's email to "${email ?? '(this customer\'s email)'}", or give one of them a distinct name — then push again.`,
      );
    }
    throw new Error(`QB customer creation failed: ${errText}`);
  }

  const createData = await createResp.json();
  const qbId = createData?.Customer?.Id;
  if (!qbId) throw new Error('QB customer creation returned no Id');
  await db.from('customers').update({ qb_customer_id: qbId }).eq('id', traceCustomerId);
  // (5) CREATED + (6) the qb_customer_id written back
  console.log('[TRACE:QBO] cust CREATED — qb_customer_id written back', {
    action: 'created-new', traceCustomerId, qb_customer_id: qbId, displayName, rule: verdict.rule,
  });
  return qbId;
}

/**
 * VERIFY a stored qb_customer_id before billing it. A stored link is a CACHE, not a fact —
 * it must be re-checked. The old code trusted it forever with no re-verification, which is
 * exactly how the TERRENCE→Andrew link silently billed nine invoices: the mis-link was made
 * once and never questioned again. Name drift → REFUSE the push (D-47).
 */
async function verifyStoredQbLink(
  realm: string, token: string, customer: any, qbId: string,
): Promise<void> {
  const traceName = displayNameFor(customer);
  const stored = await qbFetchCustomer(realm, token, qbId);

  if (!stored) {
    console.log('[TRACE:QBO] ⚠ STORED LINK UNREADABLE — refusing the push', {
      traceCustomerId: customer.id, qb_customer_id: qbId,
    });
    throw new QboIdentityConflict(
      `This customer is linked to QuickBooks customer ${qbId}, but that customer could not be read from QuickBooks `
      + `(it may have been deleted or merged). TRACE will not bill an unverifiable link. Re-link this customer, then push again.`,
    );
  }

  if (!personNamesMatch(stored.displayName, traceName)) {
    console.log('[TRACE:QBO] ⚠ STORED LINK NAME DRIFT — refusing the push (this is the check that would have caught TERRENCE→Andrew on invoice #1)', {
      traceCustomerId: customer.id, traceName,
      qb_customer_id: qbId, qbDisplayName: stored.displayName, qbEmail: stored.email,
    });
    throw new QboIdentityConflict(
      `This customer ("${traceName}") is linked to QuickBooks customer ${qbId}, which is named "${stored.displayName ?? '(no name)'}". `
      + `TRACE will not bill an invoice to a different person than the order names. Correct the link in TRACE `
      + `(clear this customer's QuickBooks link so it re-resolves on the next push), then push again.`,
    );
  }

  console.log('[TRACE:QBO] cust — STORED link VERIFIED (name still agrees), billing it', {
    traceCustomerId: customer.id, traceName, qb_customer_id: qbId, qbDisplayName: stored.displayName,
  });
}


/**
 * THE QBO INVOICE PUSH, AS A CALLABLE — extracted from the handler 2026-07-27.
 *
 * WHY: the endpoint was the LAST unauthenticated cross-tenant write (capK). Every other one took
 * a caller gate, but this one is reached by ANONYMOUS QR CHECKOUT — /checkout/* are public routes
 * — so a caller gate would 403 every anon order and silently kill US-008 invoicing.
 * The fix is not a credential. `submit.ts` ALREADY has the order, the business and the service
 * key, so it pushes DIRECTLY and the untrusted hop stops existing. A hop you delete needs no
 * token, no signature, no single-use storage and no replay window.
 *
 * Returns `{ status, body }` instead of writing to `res` — the 8 former `return res.*` sites map
 * one-for-one, so the HTTP contract of the endpoint is unchanged for its remaining caller.
 */
/**
 * buildQboInvoiceLines — assemble the QuickBooks invoice payload for one Cultivar order.
 *
 * PURPOSE:      the payload half of pushQboInvoice, as a PURE function of already-fetched rows,
 *               so the LINES CAN BE ASSERTED WITHOUT QUICKBOOKS. Extracted 2026-08-24 with the
 *               #104 fix: a test that asserts a 200 from QBO inherits whatever the payload says,
 *               and this is the file that put an unvalidated internal string on a customer's
 *               invoice (txnId=436). The payload is the thing that has to be proven.
 * DEPENDENCIES: orderItemName / orderItemAnchor (shared line-name resolver), taxExemptionLabel
 *               (shared D-40 presenter), and `shared/quickbooks/invoiceLineShapes` — which owns
 *               the QuickBooks construct vocabulary and the ItemRef resolution. NO db, NO fetch,
 *               NO clock.
 * OUTPUTS:      a discriminated union — either the assembled `lines` plus the invoice-level
 *               `txnTaxDetail`, or a REFUSAL naming every revenue line that has no Intuit Item
 *               Id behind it.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 THE TWELVE LITERALS ARE GONE, AND THEY WERE NEVER TWELVE ITEM-ID PROBLEMS.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * Until 2026-08-30 this function wrote `ItemRef: { value: '1', name: 'Services' }` twelve times.
 * The read of the customer's own books settled what that meant: item `1` EXISTS, is named
 * **"Sales"** rather than "Services", and books to their GENERIC INCOME ACCOUNT. So the push
 * would not have failed loudly — it would have SUCCEEDED and silently misfiled every line into a
 * bucket already holding $41,667 on their P&L beside $1.52m of nursery stock. And item 1 is in
 * live use (33 lines, $49,419), so it would have fed an existing bad habit rather than standing
 * out as ours.
 *
 * ONE RULE REPLACES ALL TWELVE (see `invoiceLineShapes.ts`):
 *   **a $0 line is a DOCUMENTATION line and carries no ItemRef; a line carrying money is REVENUE
 *   and must resolve a real Intuit Item Id, or the push refuses.**
 *
 * and two of the twelve were the wrong SHAPE rather than the wrong id — the discount is now
 * QuickBooks' native `DiscountLineDetail`, and SALES TAX has left the line list entirely for
 * `TxnTaxDetail`, because booking tax as a revenue line INFLATES THE BUSINESS'S REVENUE BY THE
 * TAX AMOUNT. ✅ Both match LAWNS's own practice rather than imposing ours: their history carries
 * 194 `DescriptionOnly` lines and 66 native discount lines worth $31,985 — three times more than
 * their discount ITEMS (21).
 *
 * ⚠️ TODAY EVERY REVENUE LINE REFUSES, AND THAT IS THE HONEST STATE, NOT A BUG. No table carries
 *    `qbo_item_id` yet — the mapping pass owns that column. This function CONSUMES a mapping it
 *    does not create, and until one exists it says so instead of guessing. A default is exactly
 *    how `'1'` happened.
 */
export type QboInvoicePayload =
  | { ok: true;  lines: QboLine[]; txnTaxDetail: { TotalTax: number } | null }
  | { ok: false; unmapped: QboUnmappedLine[] };

export function buildQboInvoiceLines(args: {
  order:             any;
  business:          any;
  orderItems:        any[] | null;
  serviceSelections: any[] | null;
  orderAddons:       any[] | null;
  useNewModel:       boolean;
  order_id:          string;
}): QboInvoicePayload {
  const { order, business, orderItems, serviceSelections, orderAddons, useNewModel, order_id } = args;
  const lines: QboLine[] = [];

  // Every revenue line that could not name an Intuit item. Collected rather than thrown, so the
  // owner is told about ALL of them at once — being sent back four times to fix one row each is
  // its own defect.
  const unmapped: QboUnmappedLine[] = [];

  /**
   * Push ONE line that carries money. Resolves the ItemRef off the backing row or records a
   * refusal — there is no third outcome and no default.
   *
   * A $0 amount is routed to a documentation line instead, which is what makes the rule uniform:
   * a declined add-on and an included transport are both facts worth PRINTING and neither is a sale,
   * so the amount decides the construct and nothing else does. The day such a line acquires a price
   * it becomes revenue here and must resolve an Id, rather than quietly keeping whatever id it last
   * held. (The legacy installation line used to be this docstring's example; it was removed in #238
   * once measurement showed it had never fired — see the note at the legacy transport line below.)
   */
  function pushRevenueLine(spec: {
    description: string;
    amount: number;
    unitPrice: number;
    qty: number;
    backingRow: unknown;
    source: QboUnmappedLine['source'];
  }): void {
    if (isDocumentationAmount(spec.amount)) {
      lines.push(descriptionOnlyLine(spec.description));
      return;
    }
    const resolved = resolveQboItemRef({
      label:   spec.description,
      source:  spec.source,
      amount:  spec.amount,
      mapping: qboItemMappingOf(spec.backingRow),
    });
    if (!resolved.ok) {
      console.log('[TRACE:QBO] ⚠ REVENUE LINE HAS NO INTUIT ITEM — refusing rather than defaulting', {
        order_id, label: resolved.unmapped.label, source: resolved.unmapped.source,
        amount: resolved.unmapped.amount,
      });
      unmapped.push(resolved.unmapped);
      return;
    }
    lines.push(salesItemLine({
      description: spec.description,
      amount:      spec.amount,
      unitPrice:   spec.unitPrice,
      qty:         spec.qty,
      itemRef:     resolved.itemRef,
    }));
  }

  // D-43: read the STORED per-line breakdown (retail_unit/discount_pct/discount_amt — via select('*'))
  // so the pushed invoice SHOWS the discount as its OWN line (goods at retail → an explicit discount
  // line), never a silently-net rate. GATED on a discount actually applying: a non-discounted (retail)
  // order pushes goods at net EXACTLY as before → zero regression; only a discounted order carries the
  // retail-goods + discount representation. Historical rows (null retail_unit) → net lines, no
  // discount line (omit-not-fake, D-9). The invoice total is unchanged (retail − discount === net).
  const goodsRows = (orderItems || []) as any[];
  const qbHasBreakdown = goodsRows.length > 0 && goodsRows.every((it: any) => it.retail_unit != null);
  const qbDiscountTotal = qbHasBreakdown
    ? Math.round(goodsRows.reduce((s: number, it: any) => s + Number(it.discount_amt ?? 0), 0) * 100) / 100 : 0;
  const qbShowDiscount = qbHasBreakdown && qbDiscountTotal > 0;
  const qbDiscPct = goodsRows.find((it: any) => Number(it.discount_amt ?? 0) > 0)?.discount_pct ?? 0;

  for (const item of goodsRows) {
    // Name via the shared resolver (the stock line's name — the lot IS the variety).
    const name      = orderItemName(item as any);
    const container = item.business_inventory?.size ?? null;
    const anchor    = orderItemAnchor(item as any);
    console.log('[TRACE:QBO] invoice line — dual anchor', { anchor, name, container });
    // Goods at RETAIL when a discount applies (the discount line below shows the tier came off), else net.
    const lineAmount = qbShowDiscount
      ? Math.round(Number(item.retail_unit) * Number(item.quantity) * 100) / 100
      : Number(item.subtotal);
    const lineUnit = qbShowDiscount ? Number(item.retail_unit) : Number(item.unit_price);
    // 🔴 THE TREE. This is the line the whole mapping pass exists for — the one that decides
    // whether the customer's books can tell Sales of Nursery Stock from Services at all.
    pushRevenueLine({
      description: container ? `${name} — ${container}` : name,
      amount:      lineAmount,
      unitPrice:   lineUnit,
      qty:         item.quantity,
      backingRow:  item.business_inventory,
      source:      'business_inventory',
    });
  }

  // ONE explicit discount line — now QuickBooks' NATIVE construct — so the 10% shows on the
  // invoice rather than baked into a net rate. Reads the STORED discount total; never recomputes.
  if (qbShowDiscount) {
    lines.push(discountLine(`Discount${qbDiscPct > 0 ? ` (${qbDiscPct}% off)` : ''}`, qbDiscountTotal));
    console.log('[TRACE:QBO] invoice discount line from stored breakdown', { discountTotal: qbDiscountTotal, pct: qbDiscPct });
  }

  if (useNewModel) {
    // ── New model: service_offerings lines ────────────────────────────────
    for (const sel of serviceSelections || []) {
      const offering = sel.service_offerings;
      if (!offering) continue;

      const isNetting  = offering.trigger_transport_mode === 'self' && offering.category === 'addon';
      const isTransport = offering.category === 'transport';

      // ── D-48: an owner price-override pushes as RETAIL + an explicit adjustment line ─────────
      // THE SCAR: this branch used to push Amount = subtotal (the overridden $1000) alongside
      // UnitPrice 225 × Qty 7, and QuickBooks REJECTED the whole invoice — 6070 "Amount is not
      // equal to UnitPrice * Qty. Supplied value:1,000". QBO was the first thing in the chain that
      // multiplied rate × qty; TRACE never checked that a line was internally consistent.
      // Now the override IS the line's discount, so the service line multiplies correctly
      // (225 × 7 = 1575) and the $575 rides the discount mechanism above. GATED on an override
      // actually applying: a normal order pushes as before.
      const svcQty    = Number(sel.quantity) || 0;
      const svcUnit   = Number(sel.unit_price_at_time) || 0;
      const svcNet    = Number(sel.subtotal) || 0;
      const svcRetail = Math.round(svcUnit * svcQty * 100) / 100;
      const svcAdj    = Math.round((svcRetail - svcNet) * 100) / 100;   // >0 giveaway · <0 surcharge
      const svcOverridden = sel.is_manual_override === true && Math.abs(svcAdj) >= 0.005;
      // Historical override rows predate the required-reason rule → omit rather than invent (D-9).
      const svcReason = (sel.override_reason ?? '').trim();

      if (isNetting && order.netting_declined) {
        // A DECLINED add-on is a NOTE, not a $0 sale. Under the old shape this booked against a
        // revenue item, so the customer's books recorded a service they explicitly refused.
        lines.push(descriptionOnlyLine(
          'Protective travel netting — DECLINED by customer (TX TCC Ch.725 waiver signed)',
        ));
      } else if (svcOverridden) {
        // The service at its RETAIL baseline — internally consistent, so QBO accepts it.
        pushRevenueLine({
          description: `${offering.name} × ${svcQty}`,
          amount:      svcRetail,
          unitPrice:   svcUnit,
          qty:         svcQty,
          backingRow:  offering,
          source:      'service_offerings',
        });
        // …and the concession as its own line, naming WHAT — but NOT WHY. Neutral "price adjusted"
        // wording reads correctly in BOTH directions.
        //
        // 🔴 #104 (2026-08-24): THE REASON DOES NOT GO TO QUICKBOOKS. It used to be interpolated
        // here — `(reason: ${svcReason})` — and QB invoice txnId=436 (order 2661dbe4, 07/16/2026,
        // status "Opened" = SENT AND VIEWED) carried "price adjusted (reason: must be filled if
        // discount applied cannot be EMPTY)" to a customer. `override_reason` is an INTERNAL
        // attribution field (R-7), its CONTENT is validated nowhere (tech-debt #105), and nothing
        // ever decided it was customer copy. The concession stays fully visible as a NAMED, SIGNED
        // amount; only the free text is withheld, and it is NOT lost — it stays on the row, on the
        // internal order screen, and in the [TRACE:QBO] line below.
        //
        // 🔴 A SURCHARGE IS NOT A DISCOUNT, AND THIS IS WHERE THE NATIVE CONSTRUCT FORCES THE
        // DISTINCTION THE OLD SHAPE LET US BLUR. A negative-Amount SalesItemLine could express
        // "the owner charged MORE than baseline" by flipping a sign; QuickBooks has no negative
        // discount. An upcharge IS revenue, so it goes through the revenue path and refuses
        // without a mapped item exactly like every other sale — which is the correct accounting
        // shape, not a compromise forced by the construct.
        if (svcAdj > 0) {
          lines.push(discountLine(`${offering.name} — price adjusted`, svcAdj));
        } else {
          pushRevenueLine({
            description: `${offering.name} — price adjusted`,
            amount:      Math.abs(svcAdj),
            unitPrice:   Math.abs(svcAdj),
            qty:         1,
            backingRow:  offering,
            source:      'service_offerings',
          });
        }
        console.log('[TRACE:QBO] service price-override line (D-48) — retail + adjustment, not a bare net', {
          offering: offering.name, unitPrice: svcUnit, qty: svcQty, retail: svcRetail,
          adjustment: svcAdj, charged: svcNet, reason: svcReason || null,
          direction: svcAdj > 0 ? 'discount' : 'surcharge',
          reconciles: Math.abs((svcRetail - svcAdj) - svcNet) <= 0.005,
        });
      } else if (isTransport && Number(sel.subtotal) === 0) {
        if (offering.transport_mode !== 'self') {
          // $0 transport is a note that it was included, not a $0 sale of transport.
          lines.push(descriptionOnlyLine(`${business.name} — ${offering.name}`));
        }
        // self-transport with $0 price → no line item needed
      } else if (Number(sel.subtotal) > 0) {
        pushRevenueLine({
          description: `${offering.name} × ${sel.quantity}`,
          amount:      Number(sel.subtotal),
          unitPrice:   Number(sel.unit_price_at_time),
          qty:         sel.quantity,
          backingRow:  offering,
          source:      'service_offerings',
        });
      }
    }
  } else {
    // ── Legacy model: order_addons fallback ───────────────────────────────
    for (const oa of orderAddons || []) {
      const addon     = oa.addons;
      const isNetting = addon.trigger_rule === 'transport=self';
      const declined  = isNetting && order.netting_declined;

      if (declined) {
        lines.push(descriptionOnlyLine(
          'Protective travel netting — DECLINED by customer (TX TCC Ch.725 waiver signed)',
        ));
      } else {
        pushRevenueLine({
          description: `${addon.name} × ${oa.quantity}`,
          amount:      Number(oa.subtotal),
          unitPrice:   Number(oa.unit_price),
          qty:         oa.quantity,
          backingRow:  addon,
          source:      'addons',
        });
      }
    }

    // Legacy transport line — ONE note, no longer a fork.
    //
    // 🔴 THE `transport_method === 'install'` BRANCH WAS REMOVED 2026-08-30 (#239). What stood here:
    //    a REVENUE line, `Installation service · N plant(s)`, built from `const installUnitPrice = 0`
    //    and backed by NO ROW — the only revenue line in this function with no source that could ever
    //    carry an Intuit Id. It was born with a real source (`plants.install_price`, $225, ffa2938
    //    2026-05-23) and LOST it at d6febf8 (2026-06-13), which dropped the column as a stock fact
    //    and left the literal 0 behind with "until service_offerings pricing is wired". It was never
    //    wired. It sat backed by nothing for 78 days.
    //
    //    IT WAS REMOVED ON EVIDENCE, NOT ON TIDINESS — three independent proofs, all measured:
    //    (1) UNREACHABLE FROM CHECKOUT BY CONSTRUCTION. `submit.ts:799` passes a
    //        `{ transport_mode: 'self' }` fallback when no transport is selected, so BOTH 'install'
    //        branches of `deriveTransportMethod` require a non-null `selectedTransport`, which
    //        unconditionally writes an `order_service_selections` row (`submit.ts:937`) → useNewModel
    //        is TRUE → this legacy `else` is never entered. Mutual exclusion, in place since 1056b31.
    //    (2) REFUSED ON HISTORY ORDERS at :773 (422), before this builder is ever called.
    //    (3) IT HAS NEVER FIRED. Across LAWNS's 1,469 captured invoices / 5,371 lines, the shape it
    //        emits appears ZERO times — no `Installation service`, and not one line carrying its
    //        signature middot. LAWNS bill installation two ways and NEITHER is a $0 line: baked into
    //        the plant's own line (`Live Oak - 200 gallon (Install & Warranty)`, 624 invoices), or a
    //        REAL priced item, `137 · Installation`, $200–$4,500, never $0.
    //        We were not preserving a path they use. We were preserving one they have never used.
    //
    //    The only caller that could still reach it was the manual re-push endpoint (no UI button) on
    //    four pre-existing Test Dave's orders. Those rows are LEFT ALONE deliberately — deleting data
    //    to make code unreachable is the wrong order of operations, and with the branch gone they
    //    cannot emit it anyway.
    //
    //    ⚠️ BEHAVIOUR CHANGE, STATED: a legacy order with `transport_method = 'install'` now takes
    //    the note below. `staff transport` is the WEAKER of the two true claims (staff did carry it),
    //    which is the same choice `transportMethodForService` already makes in the other direction.
    //    The order's own `transport_method` still records that it was an install; a $0 invoice line
    //    was never where that fact lived. When install pricing is genuinely re-wired it comes back as
    //    a service_offerings row like every other service — with a row that can carry an Id.
    const hasNettingAddon = (orderAddons || []).some((oa: any) => oa.addons?.trigger_rule === 'transport=self');
    if (!hasNettingAddon && order.transport_method !== 'self') {
      lines.push(descriptionOnlyLine(`${business.name} staff transport`));
    }
  }

  // Tax (D-40) — render the order's PERSISTED tax state; NO hardcoded 8.25%:
  //   • exempt order      → a $0 DescriptionOnly note documenting the exemption;
  //   • taxed order       → QuickBooks' OWN `TxnTaxDetail`, NOT a revenue line;
  //   • not-identified    → no tax at all (the redline lives pre-invoice, in the app).
  //
  // 🔴 THE TAXED CASE IS THE BIGGEST SINGLE CORRECTION IN THIS FUNCTION. Tax used to push as a
  // SalesItemLine against the same generic item as everything else, which BOOKS TAX AS REVENUE —
  // money held for the state, recorded as the business's own income. The goods line misfiled
  // revenue; this one invented it.
  const taxAmount = Number(order.tax_amount);
  const tax = txnTaxDetail(taxAmount);
  if (order.tax_exempt_applied === true) {
    const cert = String(order.tax_exempt_cert_ref ?? '').trim();
    lines.push(descriptionOnlyLine(
      `Tax exempt — ${taxExemptionLabel(order.tax_exempt_reason)}${cert ? ` · cert ${cert}` : ''}`,
    ));
    console.log('[TRACE:TAX] QBO invoice — tax-exempt note (DescriptionOnly, no ItemRef)', {
      order_id, reason: order.tax_exempt_reason, cert,
    });
  } else if (tax) {
    const sub = Number(order.subtotal) || 0;
    const taxPct = sub > 0 ? Math.round((taxAmount / sub) * 10000) / 100 : 0;
    console.log('[TRACE:TAX] QBO invoice — tax as TxnTaxDetail, NOT a revenue line', {
      order_id, totalTax: tax.TotalTax, derivedPct: taxPct,
    });
  }

  if (unmapped.length > 0) {
    console.log('[TRACE:QBO] ⚠ PUSH REFUSED — revenue lines with no Intuit item behind them', {
      order_id, count: unmapped.length, lines: unmapped,
    });
    return { ok: false, unmapped };
  }

  // ⚠️ FLAGGED, NOT GUARDED: QuickBooks documents `DiscountLine` as a TRANSACTION-level construct
  //    and its own UI offers exactly one. This function can emit more than one (a tier discount
  //    plus a per-service concession), and whether Intuit ACCEPTS that is UNMEASURED — it cannot
  //    be measured from this repo, and re-reading the customer's books is a separate pass under
  //    R-23. It is not guarded here because refusing a legitimate order over an unmeasured API
  //    constraint is worse than letting the first (HELD) push surface it. This emit is what makes
  //    it surface rather than being diagnosed from a 400 body.
  const discountLineCount = lines.filter(l => l.DetailType === QBO_DETAIL_TYPE.discount).length;
  if (discountLineCount > 1) {
    console.log('[TRACE:QBO] ⚠ MORE THAN ONE NATIVE DISCOUNT LINE — unmeasured against Intuit', {
      order_id, discountLineCount,
    });
  }

  return { ok: true, lines, txnTaxDetail: tax };
}

export async function pushQboInvoice(
  order_id: string,
  business_id: string,
): Promise<{ status: number; body: Record<string, unknown> }> {

  // ══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 THE HOLD — CHECKED BEFORE ANYTHING ELSE, AND HERE RATHER THAN AT THE CALL SITE.
  // ══════════════════════════════════════════════════════════════════════════════════════
  // `pushQboInvoice` has TWO callers: the inline push at the end of checkout
  // (`api/orders/submit.ts:1190`) and the manual re-push endpoint at the bottom of this file.
  // A guard at the checkout call site alone would leave the second door open — an owner
  // looking at an order could push the very invoice the hold exists to prevent. ONE guard on
  // the shared seam closes both (§6 r8), which is why this is not where the instruction said
  // to put it.
  //
  // WHY IT EXISTED (2026-08-29, and the sentence is kept because it was TRUE when written):
  // "the push carries twelve hardcoded `ItemRef: {value:'1', name:'Services'}` literals, so the
  // first completed checkout on a live company books every line — trees included — as generic
  // 'Services'." ⚠️ THAT CAUSE IS GONE as of 2026-08-30 — the literals are removed and an
  // unmapped revenue line now REFUSES (422 `QBO_ITEM_UNMAPPED`) rather than defaulting.
  //
  // 🔴 THE HOLD STAYS ON ANYWAY, AND NOT OUT OF INERTIA. Three of this endpoint's constructs are
  // NEW and NONE of them has been seen by Intuit: the native `DiscountLineDetail`, the
  // `DescriptionOnly` notes, and `TxnTaxDetail`. A malformed line 400s the WHOLE invoice, and the
  // push is inline and unconditional, so there is no step a person can decline. This is that
  // step — and it comes off when David has watched ONE invoice land correctly in real books,
  // not when a build says it should work.
  //
  // 🔴 IT RETURNS 409, NOT 503. 503 is `not_connected`, and QuickBooks IS connected — telling
  // an owner to reconnect it would send them to fix a thing that is not broken, which is
  // precisely the defect D-48 ended (see Confirmation.tsx:110). A held push is its own state.
  if (isPushHeld(process.env[QBO_PUSH_HOLD_ENV], business_id)) {
    console.log('[TRACE:QBO] push HELD — deliberate, no invoice created', { order_id, business_id });
    return { status: 409, body: { error: pushHoldReason(), code: 'PUSH_HELD', held: true } };
  }

  const db = supabase();

  try {
    // Fetch business accounting tokens
    const { data: business, error: bizErr } = await db
      .from('businesses')
      .select('accounting_token_expires_at, accounting_company_id, name')
      .eq('id', business_id)
      .single();

    if (bizErr || !business?.accounting_company_id) {
      return { status: 503, body: { error: 'QuickBooks not connected — connect from dashboard first' } };
    }

    // Bearer secrets come from the owner-only secrets table (not the businesses row).
    const secrets = await readQBSecrets(db, business_id);
    const token = await refreshQBToken(business_id, {
      accounting_token:            secrets.accounting_token,
      accounting_refresh_token:    secrets.accounting_refresh_token,
      accounting_token_expires_at: business.accounting_token_expires_at,
    });
    if (!token) {
      return { status: 503, body: { error: 'qb_token_expired' } };
    }
    const realm: string = business.accounting_company_id;

    // Fetch order with customer
    const { data: order } = await db
      .from('orders')
      .select('*, customers(*)')
      .eq('id', order_id)
      .single();

    if (!order) return { status: 404, body: { error: 'Order not found' } };

    // ══════════════════════════════════════════════════════════════════════════════════════
    // 🔴 A HISTORY ORDER NEVER REACHES QUICKBOOKS. REFUSED HERE, LOUDLY.
    // ══════════════════════════════════════════════════════════════════════════════════════
    // A history order is a sale transcribed off a document the seller ALREADY invoiced through
    // their own QuickBooks and the customer has ALREADY paid. Pushing it would create a SECOND
    // invoice for a settled sale — in the customer's real accounting, under the seller's real
    // name. That is the most expensive mistake this endpoint could make, and it is not
    // hypothetical: this handler takes an arbitrary `order_id` and has no UI caller policing it.
    //
    // WHY THE CHECK IS HERE AND NOT ONLY A CONVENTION. "History orders don't push" was true by
    // accident — the push happens at the end of checkout, and checkout never creates one. But
    // an uncalled endpoint that WOULD push if called is not a guarantee, it is an unfired gun.
    // The discriminator exists precisely so the refusal can be structural.
    //
    // FAILED INTENT, LOGGED. This is a refusal to complete an action someone asked for, so it is
    // recorded as such rather than dropped: what was asked, for which order, and why it was
    // refused. 422 (not 403): the caller is authorised, the REQUEST IS INCOHERENT — this order is
    // not the kind of thing that can be invoiced. A 403 would send someone hunting a permission
    // that would never have helped.
    // ══════════════════════════════════════════════════════════════════════════════════════
    // 🔴 A TEST ORDER NEVER REACHES QUICKBOOKS. NOT THE INVOICE, AND NOT THE CUSTOMER.
    // ══════════════════════════════════════════════════════════════════════════════════════
    // Test mode exists so an owner still deciding whether to buy can ring up fake orders all
    // week and see what comes out. That is what a careful buyer does. It is only safe if the
    // fake orders stay fake, and "stay fake" means NOT ONE WRITE into their real accounting.
    //
    // 🔴 IT SITS ABOVE `findOrCreateQBCustomer`, AND THAT IS THE HALF PEOPLE FORGET. An
    // order that creates a QuickBooks CUSTOMER and no invoice has still written to their
    // books — a new name in a real chart of customers, which somebody has to notice and
    // delete. The history guard below is placed for the same reason and says so; this one
    // inherits the placement rather than re-deriving it. `historyOrder.test.ts` §I asserts
    // that ordering for history against the real source, and `testOrderGuard.test.ts` does
    // the same for this one — the ordering is a GUARANTEE, so it is measured, not assumed.
    //
    // 🔴 IT IS A SEPARATE `if` FROM THE HISTORY GUARD ON PURPOSE. They refuse for genuinely
    // different reasons and owe genuinely different sentences: a captured invoice is refused
    // because it is ALREADY in these books, a test order because it describes NOTHING THAT
    // HAPPENED. Collapsing them into one branch would force one message to cover both, and
    // the owner reading it would learn the wrong thing about their own data.
    //
    // 422, matching the history refusal: the caller IS authorised, the REQUEST is incoherent.
    if (order.order_kind === TEST_ORDER_KIND) {
      console.log('[TRACE:QBO] REFUSED — test order must never push to QuickBooks (failed intent)', {
        order_id, business_id, order_kind: order.order_kind,
        reason: 'a test order describes nothing that happened; a push would invent a sale in real books',
      });
      return { status: 422, body: {
        error: 'This is a test order. Test orders are never sent to QuickBooks — nothing was written to your books, and nothing is wrong with the order.',
        code: 'TEST_ORDER_NOT_PUSHABLE',
      } };
    }

    if (order.order_kind === HISTORY_ORDER_KIND) {
      console.log('[TRACE:QBO] REFUSED — history order must never push to QuickBooks (failed intent)', {
        order_id, business_id, order_kind: order.order_kind,
        source_document_number: order.source_document_number ?? null,
        sale_date: order.sale_date ?? null,
        reason: 'already invoiced by the seller and already paid; a push would duplicate a settled invoice',
      });
      return { status: 422, body: {
        error: order.source_document_number
          ? `This sale was captured from an existing invoice (#${order.source_document_number}) that is already in QuickBooks. Pushing it would create a duplicate.`
          : 'This sale was captured from an existing invoice that is already in QuickBooks. Pushing it would create a duplicate.',
        code: 'HISTORY_ORDER_NOT_PUSHABLE',
      } };
    }

    const customer = order.customers;
    const invoiceNumber: string = order.notes || `CLV-${order_id.slice(0, 8)}`;

    // Fetch line items — D-34: every line anchors to its business_inventory stock line
    // (business_inventory_id), the sole anchor after the AC-1 vertical noun order_items.plant_id
    // was dropped (20260709). The lot's name IS the variety name → name via the shared resolver
    // (orderItemName), same as the roster/detail/preview.
    const { data: orderItems } = await db
      .from('order_items')
      .select('*, business_inventory ( name, size, sku )')
      .eq('order_id', order_id);

    // Try new service_selections model first; fall back to legacy order_addons
    const { data: serviceSelections } = await db
      .from('order_service_selections')
      .select('*, service_offerings(*)')
      .eq('order_id', order_id);

    const { data: orderAddons } = await db
      .from('order_addons')
      .select('*, addons(*)')
      .eq('order_id', order_id);

    const useNewModel = (serviceSelections ?? []).length > 0;

    // Resolve the QB customer (D-47). A stored link is a CACHE, not a fact: VERIFY it before
    // billing it. An unstored one resolves through the three-way rule, which never guesses.
    let qbCustomerId: string = customer.qb_customer_id;
    if (qbCustomerId) {
      await verifyStoredQbLink(realm, token, customer, qbCustomerId);
    } else {
      qbCustomerId = await findOrCreateQBCustomer(realm, token, customer, business_id, db);
    }

    // Build the QB payload
    // #104 / testability: the payload is assembled by the pure buildQboInvoiceLines seam above, so
    // it is assertable without QuickBooks (qboInvoiceLines.test.ts).
    const built = buildQboInvoiceLines({
      order, business, orderItems, serviceSelections, orderAddons, useNewModel, order_id,
    });

    // ══════════════════════════════════════════════════════════════════════════════════════
    // 🔴 NO ROW, NO ID — THE PUSH REFUSES, AND IT SAYS WHICH LINES AND WHY.
    // ══════════════════════════════════════════════════════════════════════════════════════
    // A revenue line with no Intuit Item Id behind it used to book against a hardcoded `'1'`.
    // The read of the customer's own books settled what that cost: item 1 is named "Sales" and
    // books to their generic income account, so the push would have SUCCEEDED and silently
    // misfiled every tree into a bucket already holding $41,667 — beside $1.52m of nursery
    // stock it should have joined. A silent success is worse than a refusal, which is the whole
    // reason this branch exists rather than a fallback.
    //
    // 422, matching the history-order refusal below the same reasoning: the caller is
    // AUTHORISED and the request is INCOHERENT — this order cannot be represented in the
    // customer's books yet. A 403 would send someone hunting a permission that never helps.
    //
    // FAILED INTENT, LOGGED (R-18): what was asked, for which order, and why it was refused.
    if (!built.ok) {
      const owed = built.unmapped;
      const money = Math.round(owed.reduce((s, u) => s + u.amount, 0) * 100) / 100;
      console.log('[TRACE:QBO] REFUSED — revenue lines with no QuickBooks item (failed intent)', {
        order_id, business_id, count: owed.length, amountAtStake: money, lines: owed,
        reason: 'no qbo_item_id on the backing row; defaulting is how every tree booked as "Services"',
      });
      return { status: 422, body: {
        error:
          `This order cannot be invoiced yet: ${owed.length} line${owed.length > 1 ? 's' : ''} `
          + `(${owed.map(u => `"${u.label}"`).join(', ')}) `
          + `${owed.length > 1 ? 'have' : 'has'} no QuickBooks item behind ${owed.length > 1 ? 'them' : 'it'}, `
          + `so TRACE cannot say which account the $${money.toFixed(2)} belongs in. `
          + `Link ${owed.length > 1 ? 'these' : 'this'} to a QuickBooks item, then push again. `
          + `TRACE will not pick one — that is how every tree came to book as generic income.`,
        code: 'QBO_ITEM_UNMAPPED',
        unmapped: owed,
      } };
    }

    const lines = built.lines;

    // ── RECONCILE the assembled invoice against what TRACE actually charged (D-48) ───────────────
    // Every line is internally consistent (Amount === UnitPrice × Qty), which is what QBO
    // validates. This checks the OTHER half: that the lines net to what the order charged — so a
    // discount can never double-count against an already-netted line (the failure mode of
    // representing one concession twice). SURFACED, never silent: a mismatch means the invoice and
    // the order disagree about money, and the owner must see that rather than have QBO carry a
    // number TRACE never charged. This is a check TRACE never had — QBO's 6070 was doing this job.
    //
    // 🔴 TWO THINGS CHANGED HERE WITH THE CONSTRUCTS, AND BOTH WOULD HAVE FAILED SILENTLY IN THE
    // DIRECTION THAT SAYS "RECONCILES".
    //   (1) A native discount line carries a POSITIVE Amount that QuickBooks SUBTRACTS, where the
    //       old negative SalesItemLine carried it signed. A naive sum is now wrong by TWICE the
    //       discount — so the sum is signed by construct (`signedLineAmount`), not by field.
    //   (2) Tax has LEFT the line list for `TxnTaxDetail`, so the lines no longer reach the order
    //       TOTAL — they reach the total LESS tax. Comparing against the total would now fail
    //       every taxed order.
    const qbLineSum    = Math.round(lines.reduce((s: number, l) => s + signedLineAmount(l), 0) * 100) / 100;
    const qbTax        = built.txnTaxDetail?.TotalTax ?? 0;
    const qbOrderTotal = Math.round(Number(order.total_amount) * 100) / 100;
    const qbExpected   = Math.round((qbOrderTotal - qbTax) * 100) / 100;
    const qbReconciles = Math.abs(qbLineSum - qbExpected) <= 0.005;
    console.log('[TRACE:QBO] invoice reconcile — lines net vs the order total less tax', {
      order_id, lineSum: qbLineSum, tax: qbTax, orderTotal: qbOrderTotal, expected: qbExpected,
      reconciles: qbReconciles,
      lines: lines.map((l) => ({ desc: l.Description, amount: l.Amount, type: l.DetailType })),
    });
    if (!qbReconciles) {
      throw new Error(
        `Invoice does not reconcile: the QuickBooks lines net to $${qbLineSum.toFixed(2)} but this order charged `
        + `$${qbExpected.toFixed(2)} before tax. TRACE will not push an invoice for an amount it did not charge. `
        + `(Order ${invoiceNumber}.)`,
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const invoicePayload = {
      Line: lines,
      // Sales tax as QuickBooks' own object rather than a revenue line. Omitted entirely when the
      // order carries no tax — D-9, omit rather than send an explicit zero.
      ...(built.txnTaxDetail ? { TxnTaxDetail: built.txnTaxDetail } : {}),
      CustomerRef: { value: qbCustomerId },
      TxnDate: today,
      DueDate: today,
      BillEmail: { Address: customer.email },
      CustomerMemo: { value: order.transport_note || '' },
      PrivateNote: `Cultivar OS Order ${invoiceNumber}. Netting declined: ${order.netting_declined ?? false}. Source: QR scan.`,
    };

    // Push invoice
    const invoiceResp = await qbPost(realm, token, 'invoice?minorversion=65', invoicePayload);

    if (!invoiceResp.ok) {
      const errText = await invoiceResp.text();
      throw new Error(`QB invoice push failed (${invoiceResp.status}): ${errText}`);
    }

    const invoiceData = await invoiceResp.json();
    const qbInvoice = invoiceData?.Invoice;
    const qbInvoiceId: string = qbInvoice?.Id;
    const qbDocNumber: string = qbInvoice?.DocNumber;
    const qbInvoiceUrl = `${QB_INVOICE_VIEW_BASE}${qbInvoiceId}`;

    // Write the QuickBooks result back to the order.
    // `qb_doc_number` is new here, and it fixes a small honest gap rather than adding a feature:
    // DocNumber — the invoice number QuickBooks assigns and the number the CUSTOMER sees on their
    // invoice — has always been captured two lines above, returned in the response, rendered once
    // on the confirmation screen, and then lost. `qb_invoice_id` is NOT a substitute: it is QB's
    // internal transaction id (the ?txnId= in the URL) and it is not a number anyone can quote
    // over the phone. Now that a second numbering scheme lives in this table, the one number that
    // reconciles our record to theirs is worth keeping.
    // ── 🔴 THE STATUS WRITE, AND WHY IT IS NOW CONDITIONAL (2026-08-28, R-STATUS) ────────────
    // `invoiced` used to be a SYNC SIDE-EFFECT: a value outside ORDER_STATUSES that recorded
    // "QuickBooks has this." Ratification made it a LIFECYCLE state that HOLDS A COMMITMENT —
    // pushing the invoice IS the commitment. That promotion turned an unconditional write here
    // into a stock defect, and the four rows it already produced are in the 2026-08-28 audit:
    //
    //   A WALK-IN IS BORN `fulfilled` AND ITS ON-HAND IS DECREMENTED AT CHECKOUT
    //   (submit.ts:824 + :1059 — the customer drove away with the trees). The inline push then
    //   ran and overwrote that status with `invoiced`. Before ratification this was invisible:
    //   `invoiced` was not in the enum, so the committed-stock allow-list could not see the row.
    //   After ratification the same row is OPEN — so its units are subtracted once physically
    //   (qty already dropped) and once logically (committed). The same double-count D-52 exists
    //   to prevent, arriving through the integration path instead of the checkout path.
    //
    // So the push NEVER MOVES AN ORDER BACKWARDS OUT OF A TERMINAL STATE. `movesOnHand(status)`
    // is the same predicate the rest of the order path keys off — one answer to "did this
    // order's stock physically move?" (§6 r8) — rather than a second hand-rolled list here.
    // `cancelled` is excluded for the same reason from the other side: a cancelled order that
    // somehow reaches a push must not be resurrected as live by a QuickBooks round-trip.
    //
    // The QuickBooks columns are written EITHER WAY. They record a fact that is true regardless
    // of lifecycle — the invoice exists over there — and suppressing them would lose the only
    // number that reconciles our record to theirs (see qb_doc_number below).
    const { data: preStatusRow } = await db
      .from('orders').select('status').eq('id', order_id).maybeSingle();
    const priorStatus = (preStatusRow as { status?: string } | null)?.status ?? null;
    const statusIsTerminal = movesOnHand(priorStatus) || priorStatus === 'cancelled';

    // `qb_doc_number` fixes a small honest gap rather than adding a feature: DocNumber — the
    // invoice number QuickBooks assigns and the number the CUSTOMER sees — has always been
    // captured two lines above, returned in the response, rendered once on the confirmation
    // screen, and then lost. `qb_invoice_id` is NOT a substitute: it is QB's internal transaction
    // id (the ?txnId= in the URL) and it is not a number anyone can quote over the phone.
    const qbWriteBack: Record<string, unknown> = {
      qb_invoice_id: qbInvoiceId,
      qb_invoice_url: qbInvoiceUrl,
      qb_doc_number: qbDocNumber ?? null,
    };
    if (!statusIsTerminal) qbWriteBack.status = 'invoiced';

    // A8 — the write REPORTS whether it landed. A write-back that silently matched zero rows
    // means the invoice exists in QuickBooks and this order has no link to it: the customer has
    // an invoice we cannot reconcile, and the manual re-push path would duplicate it. It is
    // SURFACED, never thrown — §6 r6 (integration failure never blocks an order) applies in the
    // other direction here too. The push already SUCCEEDED; throwing now would turn a completed
    // invoice into a 500 and lose the id in the response.
    const { data: wroteBack, error: wbErr } = await db
      .from('orders').update(qbWriteBack).eq('id', order_id).select('id');

    const matchedNoRows = !wroteBack?.length;
    const landed = !wbErr && !matchedNoRows;
    console.log('[TRACE:QBO] invoice write-back — status', {
      order_id, priorStatus,
      wroteStatus: statusIsTerminal ? null : 'invoiced',
      heldTerminal: statusIsTerminal,
      rowsWritten: wroteBack?.length ?? 0,
      why: statusIsTerminal
        ? 'terminal status preserved — the stock already moved (or was released); marking it open would double-count it'
        : 'open order — the push IS the commitment (R-STATUS 2026-08-28)',
    });
    if (!landed) {
      console.error('[TRACE:QBO] 🔴 WRITE-BACK MATCHED ZERO ROWS — the QuickBooks invoice exists '
        + 'and this order carries no link to it. Reconcile by hand; do NOT re-push (it would duplicate).', {
        order_id, qbInvoiceId, qbDocNumber, code: wbErr?.code, error: wbErr?.message,
      });
    }

    return { status: 200, body: {
      success: true,
      qb_invoice_id: qbInvoiceId,
      qb_invoice_number: qbDocNumber,
      qb_invoice_url: qbInvoiceUrl,
    } };

  } catch (err: any) {
    // A real identity ambiguity is NOT a server fault — it is a decision only the owner can
    // make. Surface it as an actionable 409 so the UI can show the owner what to resolve,
    // rather than burying it in a generic 500 (D-47: refuse the push, never guess the party).
    if (err instanceof QboIdentityConflict) {
      console.log('[TRACE:QBO] ⚠ PUSH REFUSED — customer identity must be resolved by the owner', {
        order_id, business_id, reason: err.message,
      });
      return { status: 409, body: { error: err.message, code: 'qb_customer_identity_conflict' } };
    }
    console.error('[QB invoice/cultivar]', err);
    return { status: 500, body: { error: err?.message || 'QB invoice creation failed' } };
  }
}

/**
 * THE ENDPOINT — kept as the MANUAL RE-PUSH / RECOVERY path (David, 2026-07-27).
 *
 * `submit.ts` now pushes inline at order creation, so this is no longer on the checkout path and
 * no longer has an anonymous caller. It is what fixes an order whose inline push FAILED — and
 * without it a failed push has no retry but re-submitting the order, which would mint a second
 * order to fix an invoice.
 *
 * A re-push ALWAYS has a session (someone is looking at a failed order and pressing a button), so
 * it takes the standard caller gate like every other endpoint: `orders:update` — re-pushing an
 * invoice is an act on the order.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { order_id, business_id } = req.body as { order_id: string; business_id: string };
  if (!order_id || !business_id) {
    return res.status(400).json({ error: 'order_id and business_id required' });
  }

  // 🔴 CALLER AUTHORITY — MB_D-015. This endpoint had NONE until 2026-07-27, and was the LAST of
  // the eight: anyone could push an invoice into ANY tenant's QuickBooks by naming its id.
  if (!(await callerCan(req.headers?.authorization, business_id, 'orders:update'))) {
    console.log('[TRACE:AUTHORITY] qbo/invoice REFUSED — caller lacks orders:update/owner', { business_id, order_id });
    return res.status(403).json({ error: 'Not authorized to push invoices for this business', code: 'FORBIDDEN' });
  }

  const { status, body } = await pushQboInvoice(order_id, business_id);
  return res.status(status).json(body);
}
