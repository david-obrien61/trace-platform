/**
 * invoice.ts — QuickBooks invoice sync (frontend).
 * Extracted from CAI/ExternalBridge.js (qbo.pullInvoices + qbo.mapInvoice + qbo.pushInvoice + qbo.toQboInvoice).
 */

const API_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
  'http://localhost:8000';

export interface QBOInvoice {
  id:           string;   // prefixed "QBO-INV-<Id>"
  qboId:        string;
  customerId:   string | null;
  customerName: string;
  date:         string;
  dueDate:      string;
  total:        number;
  balance:      number;
  paid:         number;
  status:       'PAID' | 'UNPAID' | 'PARTIAL';
  lineItems:    QBOLineItem[];
  source:       'QUICKBOOKS';
}

export interface QBOLineItem {
  description: string;
  qty:         number;
  unitPrice:   number;
  amount:      number;
}

/**
 * Map a raw QuickBooks Invoice to the shared invoice schema.
 */
export function mapQBOInvoice(raw: any): QBOInvoice | null {
  if (!raw || !raw.Id) return null;
  const total   = parseFloat(raw.TotalAmt || 0);
  const balance = parseFloat(raw.Balance  || 0);
  return {
    id:           `QBO-INV-${raw.Id}`,
    qboId:        raw.Id,
    customerId:   raw.CustomerRef?.value ? `QBO-${raw.CustomerRef.value}` : null,
    customerName: raw.CustomerRef?.name || '',
    date:         raw.TxnDate,
    dueDate:      raw.DueDate,
    total,
    balance,
    paid:   total - balance,
    status: balance === 0 ? 'PAID' : balance === total ? 'UNPAID' : 'PARTIAL',
    lineItems: (raw.Line || [])
      .filter((l: any) => l.DetailType === 'SalesItemLineDetail')
      .map((l: any) => ({
        description: l.Description || l.SalesItemLineDetail?.ItemRef?.name || '',
        qty:         l.SalesItemLineDetail?.Qty || 1,
        unitPrice:   l.SalesItemLineDetail?.UnitPrice || 0,
        amount:      l.Amount || 0,
      })),
    source: 'QUICKBOOKS',
  };
}

/**
 * Pull last N days of invoices from QuickBooks.
 */
export async function pullQBOInvoices(days = 90): Promise<{ imported: number; invoices: QBOInvoice[] }> {
  const res = await fetch(`${API_URL}/api/qbo/invoices?days=${days}`);
  if (!res.ok) throw new Error('Failed to fetch QuickBooks invoices.');
  const { invoices: rawInvoices } = await res.json();
  const mapped = (rawInvoices as any[]).map(mapQBOInvoice).filter(Boolean) as QBOInvoice[];
  return { imported: mapped.length, invoices: mapped };
}

/**
 * Convert a platform invoice object to the QuickBooks invoice payload format.
 */
export function toQBOInvoicePayload(invoice: {
  qboCustomerId: string;
  lineItems: { description: string; qty: number; unitPrice: number; amount: number }[];
}): object {
  return {
    CustomerRef: { value: invoice.qboCustomerId },
    Line: invoice.lineItems.map(item => ({
      Amount:     item.amount,
      DetailType: 'SalesItemLineDetail',
      Description: item.description,
      SalesItemLineDetail: {
        Qty:       item.qty,
        UnitPrice: item.unitPrice,
        ItemRef:   { value: '1', name: item.description },
      },
    })),
    TxnDate: new Date().toISOString().split('T')[0],
  };
}

/**
 * Push a completed platform invoice to QuickBooks Online.
 */
export async function pushQBOInvoice(invoice: Parameters<typeof toQBOInvoicePayload>[0]): Promise<any> {
  const payload = toQBOInvoicePayload(invoice);
  const res = await fetch(`${API_URL}/api/qbo/invoice`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to push invoice to QuickBooks.');
  return res.json();
}
