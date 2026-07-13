export interface Customer {
  id: string;
  nursery_id?: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  city: string | null;
  state: string;
  zip: string | null;
  qb_customer_id: string | null;
  marketing_opt_in: boolean;
  source: string;
  lifetime_value: number;
  created_at: string;
}

export interface CustomerInput {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  zip?: string;
  marketing_opt_in?: boolean;
  // The customer's stored pricing tier NAME (D-39). Carried so the Review preview can resolve the
  // discount the SAME way submit does (authoritative resolution, not the fragile orderTier snapshot).
  // Set from an attached customer (ScanOrder) or an email lookup (CustomerCapture). Undefined/null →
  // no stored tier → retail. Never authoritative for the CHARGE — submit re-resolves server-side.
  price_tier?: string | null;
}
