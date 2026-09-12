/**
 * ── StopCard — ONE STOP, THE SAME ON EVERY SCREEN THAT SHOWS ONE ─────────────────────────────
 *
 * PURPOSE      Customer · ship-to · what is on the order · status · actions — identical on
 *              /delivery-schedule, /deliveries?date= and /orders/:id (STD-017). Each screen adds ONLY
 *              its own axis AROUND this card: the order screen the money, the schedule the day
 *              grouping, the route the sequence (through `leading`). Before ledger #301 each screen
 *              composed its own stop and the route showed a name and an address (David, 2026-09-11).
 * DEPENDENCIES ./useStopActions (every write) · ../../lib/stopRead (stopLoadOf, orderStatusOf) ·
 *              ../../lib/stopLoad (what the order block says) · ../../lib/stopWrites (the ship-to
 *              form) · ../../lib/deliveryFulfilment (crewStopModel, openOrderNotice) ·
 *              @trace/shared/components/OrderLineList (the ONE line renderer) · SurfaceState.
 * OUTPUTS      <StopCard stop read actions leading? selected? />
 *
 * 🔴 THE SHIP-TO EDIT WRITES THE STOP, NEVER THE CUSTOMER. D-41 L1: billing lives on the customer; the
 * ship-to is snapshotted per order onto the stop. Changing where THIS load goes must not move the
 * customer's billing record — `stopWrites.saveShipTo` cannot reach `customers`, and a test holds it.
 */
import { useState, type ReactNode } from 'react';
import { MapPin, Phone, Calendar, Pencil } from 'lucide-react';
import { useBusinessContext } from '@trace/shared/context';
import { customerDisplayName } from '@trace/shared/utils/personName';
import { NotPermitted, WithheldData } from '@trace/shared/components/SurfaceState';
import { OrderLineList } from '@trace/shared/components/OrderLineList';
import { crewStopModel, openOrderNotice } from '../../lib/deliveryFulfilment';
import { LOAD_COPY, type StopLoad } from '../../lib/stopLoad';
import { stopLoadOf, orderStatusOf, type StopRead, type StopRow } from '../../lib/stopRead';
import { shipToLine, shipToFormOf, SHIP_TO_FIELDS, type ShipToForm } from '../../lib/stopWrites';
import type { StopActions } from './useStopActions';

const GREEN = '#27500A';
const GRAY  = '#6b7280';
const DARK  = '#111827';
const AMBER = '#92400e';
const RED   = '#A32D2D';

const SERVICE_TYPE_LABEL: Record<string, string> = {
  planting:      'Planting / install',
  delivery_only: 'Delivery only',
};
const FIELD_LABEL: Record<typeof SHIP_TO_FIELDS[number], string> = {
  address_line1: 'Street', city: 'City', state: 'State', zip: 'ZIP',
};

// A text control with a ≥44px hit area that does not push the layout (§1.6 item 5).
const linkBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
  padding: '12px 4px', margin: '-12px 0', color: GREEN, fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer',
} as const;
const inputStyle = {
  width: '100%', boxSizing: 'border-box', minHeight: 44, border: '1px solid #d1d5db', borderRadius: 8,
  padding: '8px 10px', fontSize: '0.875rem', color: DARK, outline: 'none',
} as const;

/** What is on the order — every state says something in words; none is a blank. */
function OrderBlock({ load }: { load: StopLoad }) {
  if (load.state === 'withheld') {
    return <WithheldData permission="order_items:read" what="What’s on this order" inline style={{ marginTop: 8 }} />;
  }
  if (load.state !== 'lines') {
    return (
      <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', fontWeight: 600, color: load.state === 'unread' ? RED : AMBER }}>
        {LOAD_COPY[load.state]}
      </p>
    );
  }
  return (
    <div style={{ marginTop: 10, padding: '8px 10px', background: '#fafafa', borderRadius: 8 }}>
      {/* §6 r18 — the heading claims only what is true of every line under it: they are on the order. */}
      <p style={{ margin: '0 0 4px', fontSize: '0.6875rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {LOAD_COPY.heading(load.lines.length)}
      </p>
      <OrderLineList lines={load.lines} />
      {load.unanchoredCount > 0 && (
        <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: AMBER, lineHeight: 1.45 }}>{LOAD_COPY.unanchoredNote}</p>
      )}
    </div>
  );
}

export function StopCard({ stop: d, read, actions, leading, selected = true }: {
  stop: StopRow;
  read: StopRead;
  actions: StopActions;
  /** The route's sequence control. The schedule and the order screen pass nothing. */
  leading?: ReactNode;
  /** The route dims the edge of a stop that is not in the route; everywhere else it is always in. */
  selected?: boolean;
}) {
  const { can } = useBusinessContext();
  const [editingAddress, setEditingAddress] = useState(false);
  const [form, setForm] = useState<ShipToForm>(() => shipToFormOf(d));
  // §8 V2 — SELF-ANCHORED. This note is rendered INSIDE the editor, directly above the Save control
  // that produced it, so it satisfies V1 without being a dialog. `landed` matters: the only message
  // this platform has for "the address saved but the history row did not" used to be red text below
  // a COLLAPSED editor, at the bottom of a list item — the least visible place on the screen for the
  // one sentence a reader must not miss.
  const [addressNote, setAddressNote] = useState<{ text: string; landed: boolean } | null>(null);
  // D-41 L2 (ledger #303) — the save-this-site offer. It appears ONLY after an address was actually
  // saved, so the book fills as a by-product of work already being done.
  //
  // 🔴 IT IS READ FROM `actions`, NOT HELD HERE, AND THAT IS THE FIX FOR CARD 4 (failed live
  // 2026-09-12, build fe24e68). Held as local state it could never appear on the schedule or the
  // route: `saveShipTo` awaits `onChanged()`, those pages set `loading = true`, their card lists
  // render behind `{!loading && ...}`, and THIS COMPONENT WAS UNMOUNTED before the promise resolved —
  // so the setter ran on a dead instance and React 18 discarded it silently. The hook belongs to the
  // PAGE, which stays mounted; the offer now survives the refresh by construction on all three
  // screens. Keyed by stop id, so it renders on the card it belongs to and on no other.
  // ✏️ §8 V1/V3 (R-148) — THE CARD NO LONGER RENDERS THE OFFER AT ALL. It moved to a centered
  // dialog in `useStopActions`' overlays (`<SaveSiteDialog>`), because feedback rendered anywhere in
  // a list item has a screen position set by the rows above it. #304 moved the STATE off this
  // component so it would survive the refresh; that fixed existence, not visibility. The outcome
  // sentence went with it — answering in the place the question could not be seen is the same bug.

  const name = customerDisplayName(d.customers, 'Customer');
  const address = shipToLine(d);
  const busy = actions.savingId === d.id;
  const canEditStop = can('deliveries:update');
  // 🔴 A STRICTER STRING THAN THE EDIT ABOVE IT, DELIBERATELY. Saving to the customer's address
  // book is `customers:create`, which STAFF do not hold; the edit is `deliveries:update`, which
  // they do. So Joel moves a stop and is never shown a Save-as-site button that would refuse him —
  // an offer nobody can accept is a dead affordance (§1.6 item 5), not an explanation owed.
  // THE RULE ITSELF NOW LIVES IN THE HOOK, which decides whether to raise the offer at all: one
  // copy of the gate, beside the write it guards, rather than a second one here to drift (STD-011).
  const crew = crewStopModel(d);
  const notice = openOrderNotice({ deliveryStatus: d.status, orderId: d.order_id, orderStatus: orderStatusOf(read, d) });

  async function submitAddress() {
    setAddressNote(null);
    const out = await actions.saveShipTo(d, form);
    if (out.kind === 'no_change') { setEditingAddress(false); return; }
    if (out.kind === 'refused') { setAddressNote({ text: out.reason, landed: false }); return; }
    if (out.kind === 'failed') { setAddressNote({ text: out.error, landed: false }); return; }
    // Saved but not recorded is its OWN outcome and it is said, not folded into success.
    // 🔴 V2 — THE EDITOR STAYS OPEN so the sentence sits on the control that caused it. Closing
    // first is what put it below the fold: the form collapsed, the card shrank, and the message
    // landed wherever the rows above happened to leave it.
    if (!out.audited) {
      setAddressNote({ text: `The new address is saved, but the change was not recorded in the history (${out.auditError}).`, landed: true });
      return;
    }
    setEditingAddress(false);
    // The offer rides the edit that just landed — raised by `saveShipTo` itself, because this
    // component may not be alive to raise it. It is a QUESTION with a blank name, never a
    // pre-ticked box: David's rule is that nothing auto-saves, because a book full of one-off
    // drops is worse than no book at all.
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '14px 16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderLeft: `4px solid ${selected ? GREEN : '#e5e7eb'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {leading}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* ── Customer ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: DARK }}>{name}</span>
            {d.service_type && (
              <span style={{
                fontSize: '0.6875rem', fontWeight: 700,
                color: d.service_type === 'planting' ? '#1d4ed8' : '#4b7a2e',
                background: d.service_type === 'planting' ? '#eff6ff' : '#f0f7e6',
                borderRadius: 6, padding: '1px 7px',
              }}>
                {SERVICE_TYPE_LABEL[d.service_type] ?? d.service_type}
              </span>
            )}
          </div>

          {/* ── Ship-to ── */}
          {!editingAddress && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <MapPin size={13} color={address ? GREEN : '#d1d5db'} />
              <span style={{ fontSize: '0.8125rem', color: address ? DARK : GRAY }}>{address || 'No address on file'}</span>
              {canEditStop && (
                <button
                  onClick={() => { setForm(shipToFormOf(d)); setAddressNote(null); setEditingAddress(true); }}
                  style={linkBtn}
                >
                  <Pencil size={12} /> {address ? 'Change address' : 'Add address'}
                </button>
              )}
            </div>
          )}
          {!editingAddress && !canEditStop && (
            <NotPermitted permission="deliveries:update" what="Changing where this stop goes" inline />
          )}
          {editingAddress && (
            <div style={{ marginTop: 4, padding: 10, border: '1px solid #e5e7eb', borderRadius: 10 }}>
              <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: GRAY, lineHeight: 1.45 }}>
                Where this stop goes. The customer’s billing address is not changed.
              </p>
              {SHIP_TO_FIELDS.map(f => (
                <label key={f} style={{ display: 'block', marginBottom: 8 }}>
                  <span style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: GRAY, marginBottom: 2 }}>{FIELD_LABEL[f]}</span>
                  <input
                    value={form[f]}
                    onChange={e => { const v = e.target.value; setForm(s => ({ ...s, [f]: v })); }}
                    disabled={busy}
                    autoComplete="off"
                    style={inputStyle}
                  />
                </label>
              ))}
              {/* §8 V2 — the outcome sits on the control that produced it, never below the card. */}
              {addressNote && (
                <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: addressNote.landed ? DARK : RED, lineHeight: 1.45 }}>
                  {addressNote.text}
                </p>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                {!addressNote?.landed && (
                <button
                  onClick={() => { void submitAddress(); }}
                  disabled={busy}
                  style={{ flex: 1, minHeight: 48, background: GREEN, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}
                >
                  {busy ? 'Saving…' : 'Save address'}
                </button>
                )}
                <button
                  onClick={() => { setEditingAddress(false); setAddressNote(null); }}
                  disabled={busy}
                  style={{ flex: 1, minHeight: 48, background: '#fff', color: DARK, border: '1px solid #d1d5db', borderRadius: 10, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
                >
                  {addressNote?.landed ? 'Close' : 'Cancel'}
                </button>
              </div>
            </div>
          )}


          {d.customers?.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Phone size={12} color={GRAY} />
              <span style={{ fontSize: '0.75rem', color: GRAY }}>{d.customers.phone}</span>
            </div>
          )}

          {/* ── What is on the order ── */}
          <OrderBlock load={stopLoadOf(read, d)} />

          {/* ── Status + THE TAP. `crewStopModel` takes ONLY the row — no module state, no entitlement —
              so this block is byte-identical whether or not the business pays for the review tile. ── */}
          {!read.fulfilmentColumns ? (
            <div style={{ marginTop: 10, fontSize: '0.75rem', color: GRAY }}>
              Marking stops done isn’t available yet — the database update (20260831d) hasn’t been applied.
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              {crew.action && canEditStop && (
                <button
                  onClick={() => { void actions.markStop(d, crew.action === 'start' ? 'start' : 'finish'); }}
                  disabled={busy}
                  style={{
                    width: '100%', minHeight: 48, padding: '13px 16px',
                    background: crew.action === 'finish' ? GREEN : '#fff',
                    color: crew.action === 'finish' ? '#fff' : GREEN,
                    border: crew.action === 'finish' ? 'none' : `1.5px solid ${GREEN}`,
                    borderRadius: 10, fontWeight: 700, fontSize: '0.9375rem',
                    cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                  }}
                >
                  {busy ? 'Saving…' : crew.actionLabel}
                </button>
              )}
              {crew.action && !canEditStop && (
                <NotPermitted permission="deliveries:update" what="Marking a stop done" inline />
              )}
              {!crew.action && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: crew.statusColor, background: crew.statusBg, borderRadius: 6, padding: '3px 9px' }}>
                    {crew.statusLabel}
                  </span>
                  {/* Equal stamps mean UNMEASURED, so `minutes` is null and nothing is printed. */}
                  {crew.minutes !== null && <span style={{ fontSize: '0.75rem', color: GRAY }}>{crew.minutes} min on site</span>}
                  {d.review_ask_outcome && (
                    <span style={{ fontSize: '0.75rem', color: GRAY }}>· review {d.review_ask_outcome === 'shown' ? 'asked' : 'not asked'}</span>
                  )}
                </div>
              )}
              {/* 🔴 THE STOP IS DONE AND THE STOCK HAS NOT MOVED — SAY SO (R-35; deliveryFulfilment §2b). */}
              {notice && (
                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: '#FEF3C7', border: '1px solid #FDE68A', fontSize: '0.75rem', color: '#92600A', lineHeight: 1.45 }}>
                  {notice}
                </div>
              )}
            </div>
          )}

          {/* ── Move this stop to another day (data kept). ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <Calendar size={13} color={GREEN} />
            <input
              type="date"
              value={d.delivery_date ?? ''}
              disabled={busy || !canEditStop}
              onChange={e => { void actions.editDate(d, e.target.value); }}
              aria-label="Delivery date"
              style={{
                border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 9px', minHeight: 36,
                fontSize: '0.8125rem', color: DARK, outline: 'none', background: busy ? '#f3f4f6' : '#fff',
              }}
            />
            {busy && <span style={{ fontSize: '0.75rem', color: GRAY }}>Saving…</span>}
          </div>

          {/* ── The customer record. Withheld says so; it never reads as "this stop has no customer". ── */}
          {!can('customers:read') && d.customer_id && (
            <WithheldData permission="customers:read" what="Customer details" inline style={{ marginTop: 8 }} />
          )}
          {can('customers:update') && d.customer_id && d.customers && (
            <button onClick={() => { void actions.openEditor(d); }} style={{ ...linkBtn, marginTop: -4 }}>
              Edit customer →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
