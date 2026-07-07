// business_inventory fields joined via inventory_id FK (null when no lot is linked yet)
export interface PlantInventory {
  id: string;
  qty: number;
  unit_cost: number | null;   // what the grower PAID (cost) — never the sale price
  sell_price: number | null;  // D-35: the retail price the customer pays — cart reads THIS
  status: string;
  received_at: string | null;
}

export interface Plant {
  id: string;
  business_id: string;
  inventory_id: string | null;
  tag_id: string;
  species: string;
  common_name: string | null;
  plant_type: 'tree' | 'shrub' | 'perennial' | 'annual' | 'garden';
  current_container: string;
  location_zone: string | null;
  warranty_months: number;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Populated by PostgREST FK join in usePlant — null when inventory_id is null
  business_inventory?: PlantInventory | null;
}

export interface PlantEvent {
  id: string;
  plant_id: string;
  business_id: string;
  event_type:
    | 'arrived'
    | 'repotted'
    | 'moved'
    | 'treated'
    | 'photo'
    | 'priced'
    | 'reserved'
    | 'sold'
    | 'lost'
    | 'returned';
  from_container: string | null;
  to_container: string | null;
  notes: string | null;
  employee_id: string | null;
  occurred_at: string;
}

export interface Addon {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price_per_plant: number;
  trigger_rule: string | null;
  pre_selected: boolean;
  active: boolean;
  sort_order: number;
}

export interface ServiceOffering {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  category: 'transport' | 'addon' | 'maintenance' | 'inspection' | 'subscription';
  timing: 'at_checkout' | 'post_purchase' | 'recurring';
  price_type: 'flat' | 'per_unit';
  price_unit: 'order' | 'plant' | 'vehicle' | 'visit';
  price: number;
  transport_mode: 'self' | 'staff' | null;
  trigger_transport_mode: 'self' | 'staff' | null;
  recurrence_days: number | null;
  requires_address: boolean;
  pre_selected: boolean;
  is_active: boolean;
  sort_order: number;
  compliance_title: string | null;
  compliance_body: string | null;
  service_note: string | null;
}
