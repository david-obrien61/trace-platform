import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Plant, ServiceOffering } from '../types/plant';
import type { CartItem, ServiceSelection } from '../types/order';
import type { CustomerInput } from '../types/customer';
import type { TransportChoice, TransportSelection } from '../lib/transport';
import { anchorKey } from '../lib/stockLinePlant';
import type { DiscountTier, ShipToInput } from '@trace/shared/business-logic';

const TRACE_CART = true; // [TRACE:CART] STD-003 — on until OWNER-PROVEN

// ═════════════════════════════════════════════════════════════════════════════
// 🔴 THE PARKED SALE (ledger #389, R-174 ①②). WHY THE CART IS PERSISTED AT ALL.
// ═════════════════════════════════════════════════════════════════════════════
// David found it by using the thing: he started an order, backed out, and there was no way back.
// #387 stopped the back arrow DESTROYING the order; it did not make it SURVIVE anything. A cart
// lived in this module's memory, so a refresh, a new tab, or a phone locking long enough for
// Safari to evict the tab lost a customer's order mid-sale, silently.
//
// THE STANDARD THIS BUILDS TO: the POS "parked sale" — a till holds an in-progress sale across
// interruptions and the cashier resumes or voids it deliberately. That is what a counter expects,
// and it is the root #387 named: **checkout was built SCAN-FIRST FOR THE YARD, and Lauren works
// COUNTER-FIRST AT A DESK.** In a lot, an abandoned scan should evaporate. At a counter, the
// order IS the work.
//
// 🔴 LOCAL, AND THAT IS A STAGE — NOT THE DESTINATION. David ruled 2026-09-23: *"A PARKED ORDER
// BELONGS TO THE BUSINESS, NOT THE DEVICE — Lauren starts it, gets called away, Terry finishes
// it."* The server-side form is where this goes. This is built first so the bleeding stops, and
// **is deliberately shaped not to make that move expensive**: the persisted payload is exactly the
// cart's own data (no ids minted here, no lifecycle, no status), so the server version becomes a
// second STORAGE for the same shape rather than a rewrite of the cart.
//
// 🔴 NO `draft` IS ADDED TO `ORDER_STATUSES`, ON DAVID'S EXPLICIT INSTRUCTION. A parked sale is not
// an order yet — it has no row, no number and no commitment. Minting a status for it would put a
// half-typed cart into every roster, filter and count that reads `orders`.
//
// ⚠️ CLEARED BY EXACTLY TWO THINGS, AND NEITHER IS A TIMER: `clear()` on a successful submit
// (Confirmation) and `clear()` behind the discard confirm (ScanOrder). David: *"nothing deletes a
// customer's order on a timer."* Age is SURFACED, never enforced — see `parkedAt`.
// ═════════════════════════════════════════════════════════════════════════════

/** localStorage key. Versioned in the name so a shape change cannot half-read an old cart. */
const PARKED_KEY = 'trace.parked-order.v1';

interface CartStore {
  // Multi-item: a cart is an ARRAY of resolved order lines (each an Item-2 anchor —
  // stock_line_id OR specimen plant.id — carrying sell_price + qty). The single-item
  // profile path is the trivial N=1 case (setItem replaces the cart with one line).
  items:             CartItem[];
  // Transport is the three-branch radio (SPEC-transport-netting-decline-workflow). The chosen
  // branch attaches a PRIMARY transport (selectedTransport — drives transport_method + the
  // netting trigger) and, for "Delivery + planting", a SEPARATE per-plant planting service.
  transportChoice:   TransportChoice | null;
  selectedTransport: ServiceOffering | null;
  plantingOffering:  ServiceOffering | null;   // the per-plant planting service (branch 1 only)
  plantingSelected:  boolean;                   // whether planting is attached this order
  services:          ServiceSelection[];
  nettingDeclined:   boolean;
  customer:          CustomerInput | null;
  // ── Customer-first attach (Path A, ways 1 & 4) ──────────────────────────────
  // When a manager attaches an EXISTING customer (way 1) or creates one inline (way 4) at the
  // START of the order, we carry the resolved customer id so submit uses THAT row directly —
  // it does NOT re-run typed-field dedup (which could mint a tier-less duplicate). Null on the
  // anonymous QR path (path B) → submit dedups as before.
  attachedCustomerId:   string | null;
  attachedCustomerName: string | null; // display in the ScanOrder attach strip
  // Order-scoped tier INVOKE (way 4): a discount tier chosen for THIS order only, NOT saved to
  // the customer. Honored server-side ONLY on a token-verified owner/manager path (tamper
  // defense); null ⇒ submit uses the customer's stored price_tier. A tier NAME.
  invokedTier:          string | null;
  // Human label of the EFFECTIVE tier for the order (stored tier or invoked) — the "visible
  // moment" badge shown in ScanOrder + CartReview. Display-only; the authoritative price is
  // always recomputed server-side (money-safety).
  orderTierLabel:       string | null;
  // The RESOLVED tier for the order (basis + discountPercent), resolved ONCE at attach time
  // (ScanOrder, where the discount config is loaded). CartReview + Confirmation feed this to the
  // shared computeOrderPricing so the DISPLAYED discount equals what submit charges (D-39). null
  // ⇒ retail floor (no discount). Display-only: submit RE-RESOLVES server-side (tamper defense).
  orderTier:            DiscountTier | null;
  // Owner/manager-entered delivery date (ISO 'YYYY-MM-DD') for a delivery order — the manual
  // precursor to the customer-facing scheduling calendar. Written to orders.delivery_date.
  deliveryDate:      string | null;
  // 🔴 THE SHIP-TO FOR THIS ORDER — D-41's L2 picker (ledger #303). Where the load actually goes,
  // which is NOT the same fact as the customer's billing address and must never be written back to
  // it. Null ⇒ the server falls back to the customer's address exactly as it always has, so the
  // anon QR path and every caller that sends none are unchanged.
  // ⚠️ It is carried as the ADDRESS, never as a `customer_addresses.id`: the delivery row keeps its
  // own snapshot, so what travels is the text, not a pointer that could later be edited underneath
  // a past order.
  shipTo:            ShipToInput | null;
  /**
   * When this cart was first given a line — ISO, or null for an empty cart.
   *
   * 🔴 SURFACED, NEVER ENFORCED. David, 2026-09-23: *"never expire, surface by age. A parked order
   * older than a week shows its age; nothing deletes a customer's order on a timer."* Nothing in
   * this file reads it to decide anything; it exists so a screen can say "started 3 days ago".
   */
  parkedAt:          string | null;
  /** Who started it — the logged-in member, set by the first screen that knows. `orders.employee_id` finally gets its writer (R-174 ⑥). */
  startedBy:         string | null;
  startedByName:     string | null;

  setStartedBy:      (id: string | null, name: string | null) => void;
  /**
   * Drop a parked cart that belongs to a DIFFERENT business.
   *
   * 🔴 THE STORE CANNOT KNOW THE ACTIVE BUSINESS — it has no context — so the app tells it. Without
   * this, signing into a second tenant on the same browser would resume the first tenant's order:
   * AC-3 (tenant isolation is absolute) reached through localStorage, which no RLS policy can see.
   * Returns true when it dropped something, so the caller can say so rather than silently emptying
   * a screen.
   */
  dropIfOtherBusiness: (businessId: string) => boolean;

  setItem:            (plant: Plant, qty: number) => void;   // REPLACE cart with a single line (profile entry)
  addLine:            (plant: Plant, qty: number) => void;   // APPEND / merge-by-anchor (scan loop)
  setLineQty:         (key: string, qty: number) => void;    // key = anchorKey(plant)
  removeLine:         (key: string) => void;
  // Branch-driven transport select: the caller resolves the branch → selection (via
  // ../lib/transport) and hands both here, so the store never re-resolves roles.
  setTransportChoice: (choice: TransportChoice, selection: TransportSelection) => void;
  setPlantingSelected:(val: boolean) => void;                // CartReview add/remove planting within branch 1
  setServices:        (transportOfferings: ServiceOffering[], addonOfferings: ServiceOffering[]) => void;
  toggleService:      (offeringId: string) => void;
  setNettingDeclined: (val: boolean) => void;
  setCustomer:        (c: CustomerInput) => void;
  // Attach a customer at the start of the order (way 1 lookup, or way 4 new). customerId set →
  // submit uses that existing row directly (no dedup). customerId null → a NEW customer that
  // submit creates via findOrCreateCustomer (way 4). invokedTier = an order-scoped tier invoke
  // (not saved to the customer); null when using the customer's stored tier.
  attachCustomer:     (args: { customerId: string | null; name: string; customer: CustomerInput; invokedTier: string | null; tierLabel: string | null; resolvedTier: DiscountTier | null }) => void;
  clearAttachedCustomer: () => void;
  setDeliveryDate:    (val: string | null) => void;
  setShipTo:          (val: ShipToInput | null) => void;
  clear:              () => void;
}

export const useCart = create<CartStore>()(persist((set) => ({
  items:             [],
  transportChoice:   null,
  selectedTransport: null,
  plantingOffering:  null,
  plantingSelected:  false,
  services:          [],
  nettingDeclined:   false,
  customer:          null,
  attachedCustomerId:   null,
  attachedCustomerName: null,
  invokedTier:          null,
  orderTierLabel:       null,
  orderTier:            null,
  deliveryDate:      null,
  shipTo:            null,
  parkedAt:          null,
  startedBy:         null,
  startedByName:     null,

  setStartedBy: (id, name) => set({ startedBy: id, startedByName: name }),

  dropIfOtherBusiness: (businessId) => {
    const s = useCart.getState();
    const owner = s.items[0]?.plant?.business_id ?? null;
    if (!owner || owner === businessId) return false;
    if (TRACE_CART) console.log('[TRACE:CART] parked order belongs to another business — dropped', { parkedFor: owner, activeBusiness: businessId, lines: s.items.length });
    s.clear();
    return true;
  },

  // Single-item entry (PlantProfile "Add to cart"): replace the cart with just this line.
  // Preserves the proven N=1 flow exactly. A profile scan starts a fresh ANONYMOUS order —
  // reset any attach state carried in this browser session (path B never attaches a customer).
  setItem: (plant, qty) => {
    if (TRACE_CART) console.log('[TRACE:CART] setItem (single-line replace)', { anchor: anchorKey(plant), qty });
    set({ items: [{ plant, quantity: qty }], attachedCustomerId: null, attachedCustomerName: null, invokedTier: null, orderTierLabel: null, orderTier: null, parkedAt: new Date().toISOString() });
  },

  // Scan-loop entry: add a line, merging by ANCHOR so scanning the same lot twice bumps
  // that line's qty rather than creating a duplicate (mirrors the count loop's lot dedup).
  addLine: (plant, qty) =>
    set((s) => {
      const key = anchorKey(plant);
      const existing = s.items.findIndex(l => anchorKey(l.plant) === key);
      const parkedAt = s.parkedAt ?? new Date().toISOString();   // stamped once, on the first line
      if (existing >= 0) {
        const items = s.items.map((l, i) => i === existing ? { ...l, quantity: l.quantity + qty } : l);
        if (TRACE_CART) console.log('[TRACE:CART] scan-add — merged into existing line', { anchor: key, addedQty: qty, newQty: items[existing].quantity });
        return { items, parkedAt };
      }
      if (TRACE_CART) console.log('[TRACE:CART] scan-add — new line', { anchor: key, qty, lineCount: s.items.length + 1 });
      return { items: [...s.items, { plant, quantity: qty }], parkedAt };
    }),

  setLineQty: (key, qty) =>
    set((s) => {
      if (TRACE_CART) console.log('[TRACE:CART] review adjust — line qty', { anchor: key, qty });
      return {
        items: s.items.map(l => anchorKey(l.plant) === key ? { ...l, quantity: Math.max(1, qty) } : l),
      };
    }),

  removeLine: (key) =>
    set((s) => {
      if (TRACE_CART) console.log('[TRACE:CART] review adjust — remove line', { anchor: key });
      return { items: s.items.filter(l => anchorKey(l.plant) !== key) };
    }),

  // Selecting a transport BRANCH (the three-branch radio). The caller resolved the branch
  // to its concrete selection (primary transport + optional planting). Switching away from
  // self-transport auto-declines any addons gated on self transport (netting).
  setTransportChoice: (choice, selection) =>
    set((s) => {
      const isNowSelf = selection.transport?.transport_mode === 'self';
      const services = isNowSelf
        ? s.services
        : s.services.map(sel =>
            sel.offering.trigger_transport_mode === 'self'
              ? { ...sel, selected: false }
              : sel
          );
      if (TRACE_CART) console.log('[TRACE:CART] transport branch', {
        choice: `${choice.kind}:${choice.transportId}`,
        transport: selection.transport?.name ?? null,
        planting:  selection.planting?.name ?? null,
      });
      return {
        transportChoice:   choice,
        selectedTransport: selection.transport,
        plantingOffering:  selection.planting,
        plantingSelected:  selection.planting != null,
        services,
        nettingDeclined:   isNowSelf ? s.nettingDeclined : false,
      };
    }),

  // CartReview add/remove of planting within the "Delivery + planting" branch (keeps the
  // offering so it can be re-added). Never invents planting on a branch that has none.
  setPlantingSelected: (val) =>
    set((s) => {
      if (!s.plantingOffering) return {};
      if (TRACE_CART) console.log('[TRACE:CART] planting toggle', { selected: val, name: s.plantingOffering.name });
      return { plantingSelected: val };
    }),

  // Called once when services load from DB. Initializes all addons at their pre_selected
  // state. The initial transport BRANCH is set by the AddOns page (it resolves roles).
  setServices: (_transportOfferings, addonOfferings) =>
    set(() => {
      const services: ServiceSelection[] = addonOfferings.map(o => ({
        offering: o,
        selected: o.pre_selected,
      }));
      return { services };
    }),

  toggleService: (offeringId) =>
    set((s) => ({
      services: s.services.map(sel =>
        sel.offering.id === offeringId ? { ...sel, selected: !sel.selected } : sel
      ),
    })),

  setNettingDeclined: (val) =>
    set((s) => ({
      nettingDeclined: val,
      // Keep service selection in sync with decline state
      services: s.services.map(sel =>
        sel.offering.trigger_transport_mode === 'self'
          ? { ...sel, selected: !val }
          : sel
      ),
    })),

  setCustomer: (c) => set({ customer: c }),

  attachCustomer: ({ customerId, name, customer, invokedTier, tierLabel, resolvedTier }) => {
    if (TRACE_CART) console.log('[TRACE:lookup] customer attached to order', {
      customerId, name, invokedTier: invokedTier ?? null, tierLabel: tierLabel ?? null,
      resolvedTier: resolvedTier ? { name: resolvedTier.name, basis: resolvedTier.basis, discountPercent: resolvedTier.discountPercent } : null,
    });
    set({
      attachedCustomerId:   customerId,
      attachedCustomerName: name,
      customer,                       // prefill the rest of the flow (CustomerCapture reads this)
      invokedTier:          invokedTier ?? null,
      orderTierLabel:       tierLabel ?? null,
      orderTier:            resolvedTier ?? null,
    });
  },

  clearAttachedCustomer: () => {
    if (TRACE_CART) console.log('[TRACE:lookup] customer detached from order');
    set({ attachedCustomerId: null, attachedCustomerName: null, customer: null, invokedTier: null, orderTierLabel: null, orderTier: null });
  },

  setDeliveryDate: (val) => {
    if (TRACE_CART) console.log('[TRACE:DELIVERY] delivery date set', { deliveryDate: val });
    set({ deliveryDate: val });
  },

  setShipTo: (val) => {
    if (TRACE_CART) console.log('[TRACE:SITES] ship-to set for this order', {
      source: val?.source ?? '(none)', line1: val?.line1 ?? null, city: val?.city ?? null,
    });
    set({ shipTo: val });
  },

  clear: () => set({
    items:             [],
    transportChoice:   null,
    selectedTransport: null,
    plantingOffering:  null,
    plantingSelected:  false,
    services:          [],
    nettingDeclined:   false,
    customer:          null,
    attachedCustomerId:   null,
    attachedCustomerName: null,
    invokedTier:          null,
    orderTierLabel:       null,
    orderTier:            null,
    deliveryDate:      null,
    shipTo:            null,
    // 🔴 THE PARK IS CLEARED WITH THE CART, and `clear()` has exactly two callers: a successful
    // submit, and the discard confirm. Nothing else empties it and no timer does (R-174 ④).
    parkedAt:          null,
    startedBy:         null,
    startedByName:     null,
  }),
}), {
  name: PARKED_KEY,
  storage: createJSONStorage(() => localStorage),
  version: 1,

  // 🔴 ONLY THE CART'S OWN DATA IS WRITTEN. The actions are functions and would be lost on
  // rehydrate anyway; listing the fields means a NEW field is not silently persisted before
  // anyone has decided it should be.
  partialize: (s) => ({
    items: s.items,
    transportChoice: s.transportChoice,
    selectedTransport: s.selectedTransport,
    plantingOffering: s.plantingOffering,
    plantingSelected: s.plantingSelected,
    services: s.services,
    nettingDeclined: s.nettingDeclined,
    customer: s.customer,
    attachedCustomerId: s.attachedCustomerId,
    attachedCustomerName: s.attachedCustomerName,
    invokedTier: s.invokedTier,
    orderTierLabel: s.orderTierLabel,
    orderTier: s.orderTier,
    deliveryDate: s.deliveryDate,
    shipTo: s.shipTo,
    parkedAt: s.parkedAt,
    startedBy: s.startedBy,
    startedByName: s.startedByName,
  }),

  // 🔴 A STORED CART FROM AN OLDER SHAPE IS DISCARDED, NOT MIGRATED. A half-understood cart is
  // worse than none: it would price against fields this build no longer writes. Discarding loses
  // an in-progress sale once, at a deploy; migrating a shape nobody checked can mis-bill silently.
  migrate: () => undefined as never,

  onRehydrateStorage: () => (state, error) => {
    if (error) { console.log('[TRACE:CART] parked order could not be read — starting empty', { message: String(error) }); return; }
    // ⚠️ A REHYDRATED CART THAT IS NOT A LIST OF LINES IS NOT A CART. localStorage is editable by
    // anyone at the keyboard, so the shape is checked rather than trusted (money is priced off it —
    // though submit re-reads every price server-side, which is what makes this a display concern
    // and not a tamper hole).
    if (state && !Array.isArray(state.items)) { console.log('[TRACE:CART] parked order was malformed — dropped'); state.items = []; state.parkedAt = null; return; }
    if (TRACE_CART && state?.items?.length) {
      console.log('[TRACE:CART] parked order resumed', { lines: state.items.length, parkedAt: state.parkedAt, startedBy: state.startedByName ?? null });
    }
  },
}));
