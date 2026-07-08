// ============================================================
// stockLinePlant — turn a resolved business_inventory STOCK LINE into the Plant
// shape the cart/checkout expects, and derive a line's ORDER ANCHOR key.
// PURPOSE:  D-34 ("the lot is the SKU"). A discovery-seeded lot has no per-specimen
//           cultivar_plants row, so the purchase path SYNTHESIZES a Plant from the
//           business_inventory row. usePlant's single-item fallback AND the multi-item
//           scan-loop (ScanOrder) both need this exact transform — ONE definition, not a
//           drifted copy (CLAUDE.md §6 rule 8, semantic-dup). Extracted here from usePlant.
// DEPENDENCIES: @trace/shared/inventory StockLineRow, ../types/plant Plant.
// OUTPUTS:  synthesizePlant(row, businessId, tagId) → Plant (stock_line_id set = the anchor);
//           anchorKey(plant) → the stable per-line key the order write anchors on
//           (stock_line_id for a synthesized lot, plant.id for a real specimen).
// ============================================================
import type { StockLineRow } from '@trace/shared/inventory';
import type { Plant } from '../types/plant';

// D-34: build a plant-shaped object from a business_inventory STOCK LINE, so the existing
// cart/profile code (which expects a Plant) works unchanged for a lot that has no per-
// specimen cultivar_plants row. stock_line_id is the discriminator the order write reads.
export function synthesizePlant(row: StockLineRow, businessId: string, tagId: string): Plant {
  return {
    id:                row.id,             // stable UI key; the ORDER anchors on stock_line_id, not this
    business_id:       businessId,
    inventory_id:      row.id,             // the stock line IS the lot
    tag_id:            tagId,
    species:           row.name,
    common_name:       row.name,
    plant_type:        'tree',             // synthetic default — a stock line carries no plant_type
    current_container: row.size ?? '',
    location_zone:     null,
    warranty_months:   0,
    photo_url:         null,
    notes:             row.description ?? null,
    created_at:        '',
    updated_at:        '',
    business_inventory: {
      id:          row.id,
      qty:         row.qty ?? 0,
      unit_cost:   row.unit_cost ?? null,
      sell_price:  row.sell_price ?? null,
      status:      row.status ?? 'available',
      received_at: row.received_at ?? null,
    },
    stock_line_id:     row.id,             // DISCRIMINATOR — this plant is a stock line, not a specimen
  };
}

// The ORDER ANCHOR key for a cart line (D-34). A synthesized stock line anchors on its
// business_inventory id (stock_line_id); a real specimen anchors on its cultivar_plants id.
// Also the stable de-dup key for merge-by-anchor in the multi-item cart (scanning the same
// lot twice bumps qty on ONE line rather than creating a duplicate line).
export function anchorKey(plant: Plant): string {
  return plant.stock_line_id ?? plant.id;
}
