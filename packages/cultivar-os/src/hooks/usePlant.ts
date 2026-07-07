import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { resolveStockLine, STOCK_LINE_COLUMNS } from '@trace/shared/inventory';
import type { StockLineRow } from '@trace/shared/inventory';
import type { Plant, PlantEvent } from '../types/plant';

const TRACE_RESOLVE = true; // [TRACE:RESOLVE] STD-003 — which lane resolved; on until OWNER-PROVEN

// A size the customer must choose between when a scanned variety resolves to >1 sized
// stock line (L5 NEED_CLARIFICATION). Choosing one synthesizes the plant for that row.
// Not exported — PlantProfile consumes it via usePlant's inferred return type.
interface PlantSizeChoice {
  inventoryId: string;
  size:        string;
  qty:         number | null;
}

interface UsePlantResult {
  plant:          Plant | null;
  events:         PlantEvent[];
  availableCount: number;
  loading:        boolean;
  error:          string | null;
  // Non-null when the scan resolved to a multi-size stock line and the customer must pick
  // (the profile renders a size chooser instead of the plant). chooseSize resolves it.
  sizeChoices:    PlantSizeChoice[] | null;
  chooseSize:     (inventoryId: string) => void;
  // 'specimen' = a real cultivar_plants row; 'stock_line' = synthesized from business_inventory.
  resolvedVia:    'specimen' | 'stock_line' | null;
}

interface PlantCache {
  plant:          Plant;
  events:         PlantEvent[];
  availableCount: number;
  cachedAt:       number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function readCache(tagId: string): PlantCache | null {
  try {
    const raw = localStorage.getItem(`plant_cache:${tagId}`);
    if (!raw) return null;
    const entry: PlantCache = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return null;
    // Invalidate caches written before the business_id migration
    if (!entry.plant?.business_id) return null;
    return entry;
  } catch {
    return null;
  }
}

function writeCache(tagId: string, data: Omit<PlantCache, 'cachedAt'>): void {
  try {
    localStorage.setItem(`plant_cache:${tagId}`, JSON.stringify({ ...data, cachedAt: Date.now() }));
  } catch {
    /* non-fatal — storage full or private browsing */
  }
}

// D-34: build a plant-shaped object from a business_inventory STOCK LINE, so the existing
// cart/profile code (which expects a Plant) works unchanged for a lot that has no per-
// specimen cultivar_plants row. stock_line_id is the discriminator the order write reads.
function synthesizePlant(row: StockLineRow, businessId: string, tagId: string): Plant {
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

export function usePlant(tagId: string | undefined): UsePlantResult {
  const cached = tagId ? readCache(tagId) : null;
  const { businessId } = useBusinessContext();

  const [plant,          setPlant]          = useState<Plant | null>(cached?.plant ?? null);
  const [events,         setEvents]         = useState<PlantEvent[]>(cached?.events ?? []);
  const [availableCount, setAvailableCount] = useState(cached?.availableCount ?? 1);
  const [loading,        setLoading]        = useState(!cached);
  const [error,          setError]          = useState<string | null>(null);
  const [sizeChoices,    setSizeChoices]    = useState<PlantSizeChoice[] | null>(null);
  const [resolvedVia,    setResolvedVia]    = useState<'specimen' | 'stock_line' | null>(cached ? 'specimen' : null);
  // Candidate rows held so a size pick synthesizes without a re-query.
  const [candidates,     setCandidates]     = useState<StockLineRow[]>([]);

  useEffect(() => {
    if (!tagId) return;

    let cancelled = false;

    async function fetchFromNetwork() {
      if (!readCache(tagId!)) setLoading(true);
      setError(null);
      setSizeChoices(null);
      setCandidates([]);

      // (L1 — specimen) Join business_inventory via inventory_id FK. A real cultivar_plants
      // row WINS if present (the vertical identity lane); the stock-line fallback is only for
      // a lot that has no specimen row (the discovery-seeded catalog, D-34).
      const { data: plantData, error: plantErr } = await supabase
        .from('cultivar_plants')
        .select('*, business_inventory ( id, qty, unit_cost, sell_price, status, received_at )')
        .ilike('tag_id', tagId!)
        .maybeSingle();

      if (plantData && !plantErr) {
        const { data: eventData } = await supabase
          .from('plant_events')
          .select('*')
          .eq('plant_id', plantData.id)
          .order('occurred_at', { ascending: true });

        // availableCount comes from the lot's qty field.
        const resolvedCount = (plantData.business_inventory as any)?.qty ?? 1;

        if (!cancelled) {
          if (TRACE_RESOLVE) console.log('[TRACE:RESOLVE] usePlant — cultivar_plants HIT (specimen):', tagId);
          const resolvedEvents = (eventData ?? []) as PlantEvent[];
          setPlant(plantData as Plant);
          setEvents(resolvedEvents);
          setAvailableCount(resolvedCount);
          setResolvedVia('specimen');
          setLoading(false);
          writeCache(tagId!, { plant: plantData as Plant, events: resolvedEvents, availableCount: resolvedCount });
        }
        return;
      }

      // (L2→L5 — stock-line FALLBACK) No specimen row. Resolve the scanned tag against
      // business_inventory generically (SKU → name token-equality → size-picker) and
      // synthesize a plant from the lot. business_id-scoped (AC-3); needs a business
      // session (business_inventory has owner/member RLS, no anon read) — an anon scan
      // with no session simply falls through to "not found", as before.
      if (businessId) {
        const resolution = await resolveStockLine(supabase, businessId, tagId!, { columns: STOCK_LINE_COLUMNS });

        if (resolution.kind === 'resolved') {
          if (cancelled) return;
          if (TRACE_RESOLVE) console.log('[TRACE:RESOLVE] usePlant — cultivar_plants MISS → business_inventory', resolution.via, '(stock line):', resolution.row.name);
          const synth = synthesizePlant(resolution.row, businessId, tagId!);
          setPlant(synth);
          setEvents([]);                              // a stock line has no per-specimen timeline
          setAvailableCount(resolution.row.qty ?? 1);
          setResolvedVia('stock_line');
          setLoading(false);
          writeCache(tagId!, { plant: synth, events: [], availableCount: resolution.row.qty ?? 1 });
          return;
        }

        if (resolution.kind === 'collision') {
          if (cancelled) return;
          if (TRACE_RESOLVE) console.log('[TRACE:RESOLVE] usePlant — stock-line size collision → picker:', resolution.candidates.map(c => (c.size ?? '').trim()).join(' / '));
          setCandidates(resolution.candidates);
          setSizeChoices(resolution.candidates.map(c => ({
            inventoryId: c.id,
            size:        (c.size ?? '').trim(),
            qty:         c.qty ?? null,
          })));
          setPlant(null);
          setResolvedVia('stock_line');
          setLoading(false);
          return;
        }
      }

      // Nothing matched, in any lane.
      if (!cancelled) {
        if (TRACE_RESOLVE) console.log('[TRACE:RESOLVE] usePlant — UNRESOLVED (no specimen, no stock line):', tagId);
        if (!plant) setError(plantErr?.message ?? 'Plant not found');
        setLoading(false);
      }
    }

    fetchFromNetwork();
    return () => { cancelled = true; };
  }, [tagId, businessId]);

  // The customer chose a size from the collision picker → synthesize that stock line.
  function chooseSize(inventoryId: string) {
    const row = candidates.find(c => c.id === inventoryId);
    if (!row || !businessId || !tagId) return;
    if (TRACE_RESOLVE) console.log('[TRACE:RESOLVE] usePlant — size chosen (stock line):', (row.size ?? '').trim(), '→ row:', row.id);
    const synth = synthesizePlant(row, businessId, tagId);
    setPlant(synth);
    setEvents([]);
    setAvailableCount(row.qty ?? 1);
    setSizeChoices(null);
    setError(null);
    writeCache(tagId, { plant: synth, events: [], availableCount: row.qty ?? 1 });
  }

  return { plant, events, availableCount, loading, error, sizeChoices, chooseSize, resolvedVia };
}
