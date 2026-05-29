import { create } from 'zustand';
import type { Plant, ServiceOffering } from '../types/plant';
import type { CartItem, ServiceSelection } from '../types/order';
import type { CustomerInput } from '../types/customer';

interface CartStore {
  item:              CartItem | null;
  selectedTransport: ServiceOffering | null;
  services:          ServiceSelection[];
  nettingDeclined:   boolean;
  customer:          CustomerInput | null;

  setItem:            (plant: Plant, qty: number) => void;
  setQty:             (qty: number) => void;
  setTransport:       (offering: ServiceOffering) => void;
  setServices:        (transportOfferings: ServiceOffering[], addonOfferings: ServiceOffering[]) => void;
  toggleService:      (offeringId: string) => void;
  setNettingDeclined: (val: boolean) => void;
  setCustomer:        (c: CustomerInput) => void;
  clear:              () => void;
}

export const useCart = create<CartStore>((set) => ({
  item:              null,
  selectedTransport: null,
  services:          [],
  nettingDeclined:   false,
  customer:          null,

  setItem: (plant, qty) =>
    set({ item: { plant, quantity: qty } }),

  setQty: (qty) =>
    set((s) => s.item ? { item: { ...s.item, quantity: qty } } : {}),

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
    item:              null,
    selectedTransport: null,
    services:          [],
    nettingDeclined:   false,
    customer:          null,
  }),
}));
