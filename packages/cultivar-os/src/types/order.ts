import type { Plant, Addon } from './plant';
import type { CustomerInput } from './customer';
import type { TransportOption } from '../lib/constants';

export interface CartItem {
  plant: Plant;
  quantity: number;
}

export interface CartAddon {
  addon: Addon;
  selected: boolean;
}

export interface OrderPayload {
  nursery_id: string;
  customer: CustomerInput;
  item: CartItem;
  addons: CartAddon[];
  transport: TransportOption;
}

export interface Order {
  id: string;
  nursery_id: string;
  customer_id: string;
  employee_id: string | null;
  qb_invoice_id: string | null;
  qb_invoice_url: string | null;
  transport_method: TransportOption;
  install_date: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  addons_amount: number;
  status: 'pending' | 'invoiced' | 'paid' | 'cancelled';
  leakage_flag: boolean;
  notes: string | null;
  created_at: string;
}
