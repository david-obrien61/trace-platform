/**
 * customer.ts — QuickBooks customer sync (frontend).
 * Extracted from CAI/ExternalBridge.js (qbo.pullCustomers + qbo.mapCustomer).
 */

const API_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
  'http://localhost:8000';

export interface QBOCustomer {
  id:        string;   // prefixed "QBO-<Id>"
  name:      string;
  phone:     string;
  email:     string;
  address:   string;
  type:      'CONTRACT' | 'PERSONAL';
  tier:      string;
  source:    'QUICKBOOKS';
  qboId:     string;
  vehicles:  any[];
}

/**
 * Map a raw QuickBooks Customer object to the shared customer schema.
 */
export function mapQBOCustomer(raw: any): QBOCustomer | null {
  if (!raw || !raw.DisplayName) return null;
  return {
    id:      `QBO-${raw.Id}`,
    name:    raw.DisplayName,
    phone:   raw.PrimaryPhone?.FreeFormNumber || '',
    email:   raw.PrimaryEmailAddr?.Address || '',
    address: raw.BillAddr
      ? `${raw.BillAddr.Line1 || ''}, ${raw.BillAddr.City || ''}, ${raw.BillAddr.CountrySubDivisionCode || ''}`
      : '',
    type:     raw.Job ? 'CONTRACT' : 'PERSONAL',
    tier:     'STANDARD',
    source:   'QUICKBOOKS',
    qboId:    raw.Id,
    vehicles: [],
  };
}

/**
 * Pull all active customers from QuickBooks and return mapped records.
 * Caller is responsible for merging into local customer store.
 */
export async function pullQBOCustomers(): Promise<{ imported: number; customers: QBOCustomer[] }> {
  const res = await fetch(`${API_URL}/api/qbo/customers`);
  if (!res.ok) throw new Error('Failed to fetch QuickBooks customers.');
  const { customers: rawCustomers } = await res.json();
  const mapped = (rawCustomers as any[]).map(mapQBOCustomer).filter(Boolean) as QBOCustomer[];
  return { imported: mapped.length, customers: mapped };
}
