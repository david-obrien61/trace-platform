export interface Plant {
  id: string;
  nursery_id: string;
  tag_id: string;
  species: string;
  common_name: string | null;
  plant_type: 'tree' | 'shrub' | 'perennial' | 'annual' | 'garden';
  current_container: string;
  location_zone: string | null;
  status: 'available' | 'reserved' | 'sold' | 'lost' | 'donated';
  base_price: number;
  install_price: number;
  warranty_months: number;
  arrived_at: string | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlantEvent {
  id: string;
  plant_id: string;
  nursery_id: string;
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
  nursery_id: string;
  name: string;
  description: string | null;
  price_per_plant: number;
  trigger_rule: string | null;
  pre_selected: boolean;
  active: boolean;
  sort_order: number;
}
