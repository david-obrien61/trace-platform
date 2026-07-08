import { create } from 'zustand';
import type { Plant, ServiceOffering } from '../types/plant';
import type { CartItem, ServiceSelection } from '../types/order';
import type { CustomerInput } from '../types/customer';
import type { TransportChoice, TransportSelection } from '../lib/transport';
import { anchorKey } from '../lib/stockLinePlant';

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

  clear: () => set({
    items:             [],
    transportChoice:   null,
    selectedTransport: null,
    plantingOffering:  null,
    plantingSelected:  false,
    services:          [],
    nettingDeclined:   false,
    customer:          null,
  }),
}));
