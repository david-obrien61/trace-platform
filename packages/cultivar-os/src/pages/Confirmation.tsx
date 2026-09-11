import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import type { OrderBreakdown, QbSyncStatus } from '../hooks/useSubmitOrder';
import type { TaxStatus } from '@trace/shared/business-logic';
// The mode's own sentence, from the module the SERVER reads. Not re-worded here: this suite
// already caught the settings screen keeping a second, shorter copy of the banner, which went
// stale the moment David's ruling landed (testMode.test.ts §G, STD-011).
import { TEST_ORDER_CONFIRMATION } from '@trace/shared/business-logic/testMode';
import { OrderTotals } from '../components/checkout/OrderTotals';

interface ConfirmState {
  orderId:          string;
  invoiceNumber:    string;
  total:            number;
  subtotal:         number;
  taxAmount:        number;
  // D-40: the authoritative tax state → the receipt renders redline / taxed(%) / exempt(reason).
  taxStatus?:       TaxStatus;
  taxRate?:         number | null;
  taxExemptReason?: string | null;
  taxExemptCertRef?: string | null;
  email:            string;
  payOnline:        boolean;
  transportMode?:   'self' | 'staff';
  transportName?:   string | null;                     // real service_offerings.name (H3/H6)
  serviceLines?:    { name: string; amount: number }[]; // real service itemization (H3/H6)
  breakdown?:       OrderBreakdown | null;              // D-39 (E2): SERVER-AUTHORITATIVE per-line breakdown
  tierLabel?:       string | null;                     // the order's tier badge (display)
  businessName?:    string | null;                     // from context at review (AC-1)
  nettingActive?:   boolean;
  qbInvoiceId?:     string;
  qbInvoiceNumber?: string;
  qbInvoiceUrl?:    string;
  // D-48: the three honest QBO states + the real failure reason (owner-facing only).
  qbStatus?:        QbSyncStatus;
  qbError?:         string | null;
  /** D-48: is an OWNER/MANAGER looking at this screen (vs. a customer on the public QR path)?
   *  Scopes the QBO detail: the owner needs the actual error and the action; the customer does
   *  not need TRACE's accounting internals — and must never be handed an owner instruction. */
  ownerView?:       boolean;
}

function StatusBadge({
  icon,
  color,
  title,
  detail,
}: {
  icon: string;
  color: 'green' | 'amber' | 'blue';
  title: string;
  detail: string;
}) {
  const colors = {
    green: { border: '#86efac', bg: '#f0fdf4', dot: '#27500A' },
    amber: { border: '#fcd34d', bg: '#fffbeb', dot: '#d97706' },
    blue:  { border: '#93c5fd', bg: '#eff6ff', dot: '#1d4ed8' },
  }[color];
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${colors.border}`, background: colors.bg }}>
      <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: colors.dot, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 700 }}>
        {icon}
      </span>
      <div>
        <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1f2937', marginBottom: 2 }}>{title}</p>
        <p style={{ fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.5 }}>{detail}</p>
      </div>
    </div>
  );
}

export function Confirmation() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { items, clear } = useCart();

  const state = location.state as ConfirmState | null;

  if (!state) {
    navigate('/', { replace: true });
    return null;
  }

  const { invoiceNumber, total, subtotal, taxAmount, email, payOnline,
          transportMode, transportName, serviceLines, breakdown, tierLabel,
          businessName, nettingActive, taxStatus, taxRate, taxExemptReason, taxExemptCertRef,
          qbInvoiceId, qbInvoiceNumber, qbInvoiceUrl, qbStatus, qbError, ownerView } = state;
  // D-39 (E2): render the SERVER-AUTHORITATIVE breakdown (goods retail lines → discount line → net),
  // not the client preview → the receipt equals QBO and the discount is a visible line.
  const goodsLines    = (breakdown?.lines ?? []).filter(l => l.kind === 'goods');
  const hasBreakdown  = goodsLines.length > 0;
  const orderDiscount = breakdown?.discountTotal ?? 0;
  const goodsRetail   = breakdown?.goodsRetailSubtotal ?? 0;
  const discountLabel = breakdown?.discountLabel ?? (tierLabel ? tierLabel.split(' · ')[0] : 'Discount');
  // FIX 3/4 (STD-017): render EVERY selected service incl. $0 ones — Confirm was dropping the
  // zero-amount Deer bundle that Review/QBO/order-detail all show. OrderTotals renders $0.00
  // explicitly (never an em-dash). Prefer the authoritative breakdown, fall back to serviceLines.
  // D-48: an owner price override rides the line's discount, so the receipt shows the retail
  // baseline + the adjustment + its reason — from the SERVER's breakdown, not a client recompute.
  const svcAll = hasBreakdown
    ? (breakdown?.lines ?? []).filter(l => l.kind === 'service').map(s => ({
        name: s.name,
        amount: s.netTotal,
        retailAmount: s.discountAmt !== 0 ? s.retailTotal : null,
        adjustmentReason: s.adjustmentReason ?? null,
      }))
    : (serviceLines ?? []).map(s => ({ name: s.name, amount: s.amount }));

  const isSelf      = (transportMode ?? 'self') === 'self';
  const nettingOn   = !!nettingActive;
  // A QB invoice object is NOT required to confirm — the order already exists. When QB is absent we
  // render an honest state, never a crash and never a blank. (Bug 2 hard req.)
  //
  // D-48 (D-9 Surface Honesty): THREE states, reported for what they ARE. A hard 400 used to render
  // "⏱ Invoice will sync to QuickBooks shortly — Connect QuickBooks from the owner dashboard" —
  // wrong twice: QBO was connected (it had created a customer seconds before), and nothing would
  // ever sync. Never render a hard failure as a pending sync or a connection prompt.
  const qbState: QbSyncStatus = qbStatus === 'success' && qbInvoiceId ? 'success' : (qbStatus ?? 'failed');
  const qbConnected = qbState === 'success';
  if (!qbConnected) {
    console.log('[TRACE:CHECKOUT] confirmation rendering WITHOUT a QB invoice — honest degraded state, no crash',
      { orderId: state.orderId, qbState, qbError: qbError ?? null, ownerView: !!ownerView, payOnline });
  }
  const displayQbNumber = qbInvoiceNumber || qbInvoiceId || '—';

  function handleDone() {
    clear();
    navigate('/', { replace: true });
  }

  return (
    <div className="page">
      {/* Success header */}
      <div style={{ background: '#27500A', padding: '36px 24px 28px', textAlign: 'center', color: '#fff' }}>
        <div style={{ fontSize: '3.5rem', lineHeight: 1, marginBottom: 10 }}>✓</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Order confirmed</h1>
        {/* ══════════════════════════════════════════════════════════════════════════════════
            🔴 THIS LINE SAID "Invoice sent to {email}" UNCONDITIONALLY, AND NOTHING EVER SENT IT.
            ══════════════════════════════════════════════════════════════════════════════════
            Observed 2026-09-07 in TEST MODE on an "I'll pay at the office" order: the header
            promised an email while the badge DIRECTLY BENEATH IT read "Order saved — invoice NOT
            sent to QuickBooks (sending is paused)". The page contradicted itself in two adjacent
            blocks, and the header is the half a customer reads.

            🔴 IT WAS NEVER TRUE IN ANY STATE, NOT JUST THIS ONE. The platform does not email an
            invoice: `api/qbo/invoice/cultivar.ts` sets `BillEmail` on the QuickBooks invoice and
            **never calls the QuickBooks send endpoint** — creating an invoice does not deliver it.
            The only `sendNotification` on the checkout path is an SMS leakage alert to the
            BUSINESS. (A Resend integration does exist in `notifications/send.ts`; nothing in
            checkout invokes it for the customer, and with no key configured it logs and returns
            success — which is this same class of defect one layer down.)

            THE WORST OF THE FIVE BECAUSE IT IS A PROMISE MADE TO A CUSTOMER: Lauren reads it and
            tells them the invoice is on its way. So the header now states WHAT HAPPENED — the
            order is confirmed — and the invoice's fate is reported by the badge below, which was
            already honest and is now the only thing making that claim (STD-011). */}
        <p style={{ fontSize: '0.9375rem', color: '#c8ddb4', marginTop: 8 }}>
          {qbState === 'success'
            ? <>Invoice created in QuickBooks for {email}</>
            : <>Order saved for {email}</>}
        </p>
        <p style={{ fontSize: '0.8125rem', color: '#a8c890', marginTop: 4 }}>{invoiceNumber}</p>
      </div>

      {/* QB invoice status — D-48: the three honest states, scoped to who is looking. */}
      <div className="section">
        {qbState === 'success' && (
          <StatusBadge
            icon="✓"
            color="blue"
            title={`Invoice created in QuickBooks — #${displayQbNumber}`}
            detail="Open QuickBooks and go to Invoices — it's already there."
          />
        )}

        {/* NOT CONNECTED (503) — the connect prompt is the RIGHT answer here, and only here.
            ⚠️ THE TITLE NAMED ONE CAUSE AND THE STATE HAS TWO — corrected 2026-09-10. A 503 is
            returned for a missing `accounting_company_id` (never connected) AND for
            `qb_token_expired` (connected, authorised once, tokens since dead). "QuickBooks isn't
            connected" is simply false in the second case, and it is the more likely of the two at
            a business that has been running a while. The REMEDY is identical — re-authorise from
            the owner dashboard — so this stays one branch rather than two; what changed is that
            the copy no longer asserts a cause it did not check (§6 r18: make a sometimes-true
            claim conditional, never approximate).
            ⚠️ `qbError` is still not rendered here, and that is a KNOWN gap rather than an
            oversight: the two bodies are a prose sentence and the bare code `qb_token_expired`,
            and printing a raw code at a customer-facing screen is not an improvement. Naming both
            causes in the detail is what this build could do honestly. */}
        {qbState === 'not_connected' && (ownerView ? (
          <StatusBadge
            icon="⚠"
            color="amber"
            title="Invoice NOT created — QuickBooks isn't connected right now"
            detail="The order is saved. Either QuickBooks was never connected, or its connection has expired and needs authorising again. Connect QuickBooks from the owner dashboard, then push this invoice again from the order page."
          />
        ) : (
          <StatusBadge
            icon="✓"
            color="green"
            title="Order confirmed — invoice to follow"
            detail={`Your order is saved. ${businessName ?? 'The nursery'} will send your invoice.`}
          />
        ))}

        {/* HELD — a DELIBERATE pause, and the only one of the four non-success states where
            nothing is wrong and there is no owner action. It gets its own copy because the
            other two both point at a problem: `not_connected` says reconnect (false — it IS
            connected), `failed` says fix it (false — nothing failed). The order completed. */}
        {qbState === 'held' && (ownerView ? (
          <StatusBadge
            icon="⏸"
            color="amber"
            title="Order saved — invoice NOT sent to QuickBooks (sending is paused)"
            detail={qbError || 'Sending invoices to QuickBooks is paused for this business. The order is saved and correct. David can lift the pause.'}
          />
        ) : (
          <StatusBadge
            icon="✓"
            color="green"
            title="Order confirmed — invoice to follow"
            detail={`Your order is saved. ${businessName ?? 'The nursery'} will send your invoice.`}
          />
        ))}

        {/* ══════════════════════════════════════════════════════════════════════════════════
            🔴 TEST MODE — THE STATE THAT HAD NO BRANCH, SO THE BLOCK RENDERED EMPTY.
            ══════════════════════════════════════════════════════════════════════════════════
            `submit.ts` has emitted `qbStatus: 'test'` since the 422 guard shipped; `QbSyncStatus`
            listed four members and none of them was it. So the value arrived here intact, matched
            no badge, and this whole section — the one place the invoice's fate is reported — drew
            NOTHING. Not a wrong message: no message. That is the failure mode CARD 5 of the
            test-mode board names in its own FAIL line ("…or no mention of it at all"), written
            before the defect and never run.

            🔴 DAVID'S RULING IS WHAT THIS COPY SERVES (2026-09-04): "TEST only will not write to
            any output QBO… but definitely not to the accounting system — so they SEE A PRODUCT."
            A buyer ringing up a week of practice orders must reach the end of one and be shown a
            RESULT. An empty block is the opposite: it leaves them unable to tell a push that was
            deliberately withheld from a push that was forgotten.

            🔴 IT IS NOT `held`, THOUGH THEY LOOK ALIKE ON SCREEN. A hold is DAVID's, over a tenant
            whose line mapping he has not watched land, and it lifts from an env var he controls. A
            test order is the OWNER's own decision about their own books, and it lifts from their
            Settings screen. Same shape, different person, different remedy — and telling an owner
            "David can lift this" about their own switch would leave them waiting on somebody.

            ⚠️ BLUE, NOT AMBER. Amber is the platform's "something needs your attention" and there
            is nothing to attend to: the order is complete, the refusal was requested, and no
            action is owed. Amber here would manufacture the alarm the ruling exists to prevent. */}
        {qbState === 'test' && (ownerView ? (
          <StatusBadge
            icon="✓"
            color="blue"
            title="Order saved — nothing sent to QuickBooks (test mode)"
            detail={TEST_ORDER_CONFIRMATION}
          />
        ) : (
          /* The customer sees what the other three non-success states show them, deliberately and
             for the reason those three share: a customer is not told about the business's internal
             configuration. "This business is in test mode" is a fact about the nursery's account,
             not about this person's order, and their order IS saved. */
          <StatusBadge
            icon="✓"
            color="green"
            title="Order confirmed — invoice to follow"
            detail={`Your order is saved. ${businessName ?? 'The nursery'} will send your invoice.`}
          />
        ))}

        {/* FAILED — a real error. Say so. Give the owner the reason and the next action; give the
            customer a true, neutral state with no accounting internals and no owner instruction. */}
        {qbState === 'failed' && (ownerView ? (
          <StatusBadge
            icon="⚠"
            color="amber"
            title="QuickBooks invoice FAILED — it was not created"
            detail={`${qbError || 'QuickBooks rejected the invoice.'} The order itself is saved and correct — fix the issue above, then push the invoice again from the order page.`}
          />
        ) : (
          <StatusBadge
            icon="✓"
            color="green"
            title="Order confirmed — invoice to follow"
            detail={`Your order is saved. ${businessName ?? 'The nursery'} will send your invoice.`}
          />
        ))}
      </div>

      {/* Transport status */}
      <div className="section" style={{ paddingTop: 0 }}>
        {!isSelf && (
          <StatusBadge icon="✓" color="green"
            title={transportName
              ? `${businessName ? `${businessName} — ` : ''}${transportName}`
              : `${businessName ?? 'We'} handling your order`}
            detail="We will deliver your order to your property." />
        )}
        {isSelf && nettingOn && (
          <StatusBadge icon="✓" color="green" title="Trees protected — netting applied"
            detail="Staff will wrap your plants before loading. You're good to go." />
        )}
        {isSelf && !nettingOn && (
          <StatusBadge icon="⚠" color="amber" title="No netting — drive carefully"
            detail="Secure your load per Texas Transportation Code Ch. 725 before leaving the lot." />
        )}
      </div>

      {/* Order detail — grouped-only (D-39): goods at FULL retail → ONE discount line → goods after,
          then services (not discounted), then discounted subtotal → tax → total. Rendered from the
          SERVER-AUTHORITATIVE breakdown so the receipt equals QuickBooks by construction. */}
      <div className="section" style={{ paddingTop: 0 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          Plants
        </p>

        {hasBreakdown ? (
          goodsLines.map((gp, i) => (
            <div key={`goods-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem', color: '#374151', marginBottom: 8 }}>
              <span>{gp.name} × {gp.qty}</span>
              <span>${gp.retailTotal.toFixed(2)}</span>
            </div>
          ))
        ) : (
          items.map((l) => (
            <div key={l.plant.stock_line_id ?? l.plant.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem', color: '#374151', marginBottom: 8 }}>
              <span>{l.plant.common_name ?? l.plant.species}{l.plant.current_container ? ` · ${l.plant.current_container}` : ''} × {l.quantity}</span>
              <span>${((l.plant.business_inventory?.sell_price ?? 0) * l.quantity).toFixed(2)}</span>
            </div>
          ))
        )}

        {/* Canonical totals — ONE shared renderer (STD-011/STD-012): goods subtotal → discount →
            goods after → services (all, incl. $0) → subtotal → three-state tax → total. Rendered
            from the SERVER-AUTHORITATIVE breakdown so the receipt equals QBO/order-detail. */}
        <div style={{ marginTop: 8 }}>
          <OrderTotals
            goodsRetailSubtotal={goodsRetail}
            discountTotal={orderDiscount}
            discountLabel={discountLabel}
            services={svcAll}
            subtotal={subtotal}
            total={total}
            taxStatus={taxStatus ?? 'taxed'}
            tax={taxAmount}
            taxableSubtotal={subtotal}
            taxRate={taxRate}
            taxReason={taxExemptReason}
            taxCertRef={taxExemptCertRef}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="section" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {payOnline && qbInvoiceUrl ? (
          <a
            href={qbInvoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'block', width: '100%', minHeight: 56, padding: '16px 20px', background: '#27500A', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: '1rem', textAlign: 'center', boxSizing: 'border-box', lineHeight: '24px', textDecoration: 'none' }}
          >
            View invoice in QuickBooks
          </a>
        ) : payOnline ? (
          /* 🔴 "Invoice emailed to {email}" — the same false claim, in the action slot. This
             branch is reached when the customer chose to pay online and we have NO QuickBooks
             invoice URL to send them to, which is the state where LEAST has happened, not most.
             It now says what is true and what comes next, and it never claims a delivery. */
          <div style={{ padding: '14px 16px', background: '#eff6ff', borderRadius: 8, textAlign: 'center', fontSize: '0.9375rem', color: '#1d4ed8', fontWeight: 600 }}>
            {qbState === 'success'
              ? <>Invoice created in QuickBooks — {businessName ?? 'the nursery'} will send it to {email}</>
              : <>{businessName ?? 'The nursery'} will send your invoice to {email}</>}
          </div>
        ) : (
          <div style={{ padding: '14px 16px', background: '#f0f7ea', borderRadius: 8, textAlign: 'center', fontSize: '0.9375rem', color: '#27500A', fontWeight: 600 }}>
            See you at the office!
          </div>
        )}

        {/* Demo QB fallback link */}
        <a
          href={`/demo/quickbooks-invoice?orderId=${state.orderId}&total=${total}&invoiceNumber=${invoiceNumber}`}
          style={{ display: 'block', textAlign: 'center', fontSize: '0.8125rem', color: '#6b7280', paddingTop: 4, textDecoration: 'none' }}
        >
          View QuickBooks sandbox preview →
        </a>

        <button className="btn btn-secondary" onClick={handleDone}>
          Start another order
        </button>
      </div>
    </div>
  );
}
