import { create } from 'zustand';
import type { Plant, ServiceOffering } from '../types/plant';
import type { CartItem, ServiceSelection } from '../types/order';
import type { CustomerInput } from '../types/customer';
import { anchorKey } from '../lib/stockLinePlant';

const TRACE_CART = true; // [TRACE:CART] STD-003 — on until OWNER-PROVEN

interface CartStore {
  // Multi-item: a cart is an ARRAY of resolved order lines (each an Item-2 anchor —
  // stock_line_id OR specimen plant.id — carrying sell_price + qty). The single-item
  // profile path is the trivial N=1 case (setItem replaces the cart with one line).
  items:             CartItem[];
  selectedTransport: ServiceOffering | null;
  services:          ServiceSelection[];
  nettingDeclined:   boolean;
  customer:          CustomerInput | null;

  setItem:            (plant: Plant, qty: number) => void;   // REPLACE cart with a single line (profile entry)
  addLine:            (plant: Plant, qty: number) => void;   // APPEND / merge-by-anchor (scan loop)
  setLineQty:         (key: string, qty: number) => void;    // key = anchorKey(plant)
  removeLine:         (key: string) => void;
  setTransport:       (offering: ServiceOffering) => void;
  setServices:        (transportOfferings: ServiceOffering[], addonOfferings: ServiceOffering[]) => void;
  toggleService:      (offeringId: string) => void;
  setNettingDeclined: (val: boolean) => void;
  setCustomer:        (c: CustomerInput) => void;
  clear:              () => void;
}

export const useCart = create<CartStore>((set) => ({
  items:             [],
  selectedTransport: null,
  services:          [],
  nettingDeclined:   false,
  customer:          null,

  // Single-item entry (PlantProfile "Add to cart"): replace the cart with just this line.
  // Preserves the proven N=1 flow exactly.
  setItem: (plant, qty) => {
    if (TRACE_CART) console.log('[TRACE:CART] setItem (single-line replace)', { anchor: anchorKey(plant), qty });
    set({ items: [{ plant, quantity: qty }] });
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

  // Selecting a transport offering: if switching away from self-transport,
  // auto-decline any addons gated on self transport (netting).
  setTransport: (offering) =>
    set((s) => {
      const isNowSelf = offering.transport_mode === 'self';
      const services = isNowSelf
        ? s.services
        : s.services.map(sel =>
            sel.offering.trigger_transport_mode === 'self'
              ? { ...sel, selected: false }
              : sel
          );
      return {
        selectedTransport: offering,
        services,
        nettingDeclined: isNowSelf ? s.nettingDeclined : false,
      };
    }),

  // Called once when services load from DB.
  // Initializes: first pre_selected transport as selectedTransport,
  // all addons at their pre_selected state.
  setServices: (transportOfferings, addonOfferings) =>
    set((s) => {
      const defaultTransport =
        transportOfferings.find(o => o.pre_selected) ?? transportOfferings[0] ?? null;
      const services: ServiceSelection[] = addonOfferings.map(o => ({
        offering: o,
        selected: o.pre_selected,
      }));
      return {
        selectedTransport: s.selectedTransport ?? defaultTransport,
        services,
      };
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

  clear: () => set({
    items:             [],
    selectedTransport: null,
    services:          [],
    nettingDeclined:   false,
    customer:          null,
  }),
}));
