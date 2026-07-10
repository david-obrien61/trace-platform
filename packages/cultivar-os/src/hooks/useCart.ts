import { create } from 'zustand';
import type { Plant, ServiceOffering } from '../types/plant';
import type { CartItem, ServiceSelection } from '../types/order';
import type { CustomerInput } from '../types/customer';
import type { TransportChoice, TransportSelection } from '../lib/transport';
import { anchorKey } from '../lib/stockLinePlant';
import type { DiscountTier } from '@trace/shared/business-logic';

const TRACE_CART = true; // [TRACE:CART] STD-003 — on until OWNER-PROVEN

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
  clear:              () => void;
}

export const useCart = create<CartStore>((set) => ({
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

  // Single-item entry (PlantProfile "Add to cart"): replace the cart with just this line.
  // Preserves the proven N=1 flow exactly. A profile scan starts a fresh ANONYMOUS order —
  // reset any attach state carried in this browser session (path B never attaches a customer).
  setItem: (plant, qty) => {
    if (TRACE_CART) console.log('[TRACE:CART] setItem (single-line replace)', { anchor: anchorKey(plant), qty });
    set({ items: [{ plant, quantity: qty }], attachedCustomerId: null, attachedCustomerName: null, invokedTier: null, orderTierLabel: null, orderTier: null });
  },

  // Scan-loop entry: add a line, merging by ANCHOR so scanning the same lot twice bumps
  // that line's qty rather than creating a duplicate (mirrors the count loop's lot dedup).
  addLine: (plant, qty) =>
    set((s) => {
      const key = anchorKey(plant);
      const existing = s.items.findIndex(l => anchorKey(l.plant) === key);
      if (existing >= 0) {
        const items = s.items.map((l, i) => i === existing ? { ...l, quantity: l.quantity + qty } : l);
        if (TRACE_CART) console.log('[TRACE:CART] scan-add — merged into existing line', { anchor: key, addedQty: qty, newQty: items[existing].quantity });
        return { items };
      }
      if (TRACE_CART) console.log('[TRACE:CART] scan-add — new line', { anchor: key, qty, lineCount: s.items.length + 1 });
      return { items: [...s.items, { plant, quantity: qty }] };
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
        choice,
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
  }),
}));
