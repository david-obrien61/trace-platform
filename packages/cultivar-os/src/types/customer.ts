export interface Customer {
  id: string;
  nursery_id: string;
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
}
