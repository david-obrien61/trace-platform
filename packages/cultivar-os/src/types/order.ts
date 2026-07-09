import type { Plant, Addon, ServiceOffering } from './plant';
import type { CustomerInput } from './customer';
import type { TransportOption } from '../lib/constants';

export type { ServiceOffering };

export interface CartItem {
  plant: Plant;
  quantity: number;
}

export interface CartAddon {
  addon: Addon;
  selected: boolean;
}

export interface ServiceSelection {
  offering: ServiceOffering;
  selected: boolean;
}

export interface Order {
  id:               string;
  nursery_id?:      string;
  customer_id:      string;
  employee_id:      string | null;
  qb_invoice_id:    string | null;
  qb_invoice_url:   string | null;
  transport_method: TransportOption;
  transport_note:   string | null;
  netting_declined: boolean;
  install_date:     string | null;
  subtotal:         number;
  tax_amount:       number;
  total_amount:     number;
  addons_amount:    number;
  status:           'pending' | 'invoiced' | 'paid' | 'cancelled';
  leakage_flag:     boolean;
  notes:            string | null;
  created_at:       string;
}

export function buildTransportNote(
  transport: TransportOption,
  nettingDeclined: boolean,
  nettingSelected: boolean,
): string {
  if (transport !== 'self') {
    return 'Staff transport';
  }
  if (nettingSelected && !nettingDeclined) {
    return 'Customer self-transport — netting purchased';
  }
  return 'Customer self-transport — netting declined, Texas TCC Ch.725 waiver acknowledged';
}
