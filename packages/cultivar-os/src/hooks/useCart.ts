import { create } from 'zustand';
import type { Plant, Addon } from '../types/plant';
import type { CartItem, CartAddon } from '../types/order';
import { TRANSPORT_OPTIONS, type TransportOption } from '../lib/constants';

interface CartStore {
  item:      CartItem | null;
  addons:    CartAddon[];
  transport: TransportOption;

  setItem:      (plant: Plant, qty: number) => void;
  setQty:       (qty: number) => void;
  setTransport: (t: TransportOption) => void;
  setAddons:    (addons: Addon[]) => void;
  toggleAddon:  (addonId: string) => void;
  clear:        () => void;
}

export const useCart = create<CartStore>((set) => ({
  item:      null,
  addons:    [],
  transport: TRANSPORT_OPTIONS.SELF,

  setItem: (plant, qty) =>
    set({ item: { plant, quantity: qty } }),

  setQty: (qty) =>
    set((s) => s.item ? { item: { ...s.item, quantity: qty } } : {}),

  setTransport: (t) => set({ transport: t }),

  setAddons: (addons) =>
    set({
      addons: addons.map((a) => ({
        addon: a,
        selected: a.pre_selected,
      })),
    }),

  toggleAddon: (addonId) =>
    set((s) => ({
      addons: s.addons.map((a) =>
        a.addon.id === addonId ? { ...a, selected: !a.selected } : a
      ),
    })),

  clear: () => set({ item: null, addons: [], transport: TRANSPORT_OPTIONS.SELF }),
}));
