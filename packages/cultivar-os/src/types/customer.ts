export interface Customer {
  id: string;
  nursery_id?: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  // ✏️ RENAMED FROM `address_line1`/`city`/`state`/`zip` (ledger #335, commit 3 of 3). Those four
  // columns are DROPPED from `customers`; the address list is the truth and `billing_*` is its
  // derived view, written by a database trigger. `state` is no longer non-null: it was NOT NULL on
  // the legacy column and `billing_state` has always been nullable, so the type now matches.
  billing_line1: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
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
  billing_line1?: string;
  billing_city?: string;
  billing_state?: string;
  billing_zip?: string;
  marketing_opt_in?: boolean;
  // The customer's stored pricing tier NAME (D-39). Carried so the Review preview can resolve the
  // discount the SAME way submit does (authoritative resolution, not the fragile orderTier snapshot).
  // Set from an attached customer (ScanOrder) or an email lookup (CustomerCapture). Undefined/null →
  // no stored tier → retail. Never authoritative for the CHARGE — submit re-resolves server-side.
  price_tier?: string | null;
  // The customer's PERSISTENT tax exemption (D-40 — the party attribute, mirrors price_tier). Carried
  // so the Review preview reflects a standing-exempt customer, matching what submit applies. Never
  // authoritative for the CHARGE — submit re-reads the customer's exemption server-side.
  tax_exempt?: boolean | null;
  tax_exempt_reason?: string | null;
  tax_exempt_cert_ref?: string | null;
}
