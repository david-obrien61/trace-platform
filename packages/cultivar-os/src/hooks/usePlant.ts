import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Plant, PlantEvent } from '../types/plant';

interface UsePlantResult {
  plant:          Plant | null;
  events:         PlantEvent[];
  availableCount: number;
  loading:        boolean;
  error:          string | null;
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

export function usePlant(tagId: string | undefined): UsePlantResult {
  const cached = tagId ? readCache(tagId) : null;

  const [plant,          setPlant]          = useState<Plant | null>(cached?.plant ?? null);
  const [events,         setEvents]         = useState<PlantEvent[]>(cached?.events ?? []);
  const [availableCount, setAvailableCount] = useState(cached?.availableCount ?? 1);
  const [loading,        setLoading]        = useState(!cached);
  const [error,          setError]          = useState<string | null>(null);

  useEffect(() => {
    if (!tagId) return;

    let cancelled = false;

    async function fetchFromNetwork() {
      if (!readCache(tagId!)) setLoading(true);
      setError(null);

      // Join business_inventory via inventory_id FK — PostgREST resolves via FK constraint.
      // Returns null for business_inventory when inventory_id is null (no lot linked yet).
      const { data: plantData, error: plantErr } = await supabase
        .from('cultivar_plants')
        .select('*, business_inventory ( id, qty, unit_cost, sell_price, status, received_at )')
        .ilike('tag_id', tagId!)
        .single();

      if (plantErr || !plantData) {
        if (!cancelled) {
          if (!plant) setError(plantErr?.message ?? 'Plant not found');
          setLoading(false);
        }
        return;
      }

      const { data: eventData } = await supabase
        .from('plant_events')
        .select('*')
        .eq('plant_id', plantData.id)
        .order('occurred_at', { ascending: true });

      // availableCount comes from the lot's qty field.
      // When no inventory is linked (inventory_id null), default to 1 so the UI renders.
      const resolvedCount = (plantData.business_inventory as any)?.qty ?? 1;

      if (!cancelled) {
        const resolvedEvents = (eventData ?? []) as PlantEvent[];
        setPlant(plantData as Plant);
        setEvents(resolvedEvents);
        setAvailableCount(resolvedCount);
        setLoading(false);
        writeCache(tagId!, { plant: plantData as Plant, events: resolvedEvents, availableCount: resolvedCount });
      }
    }

    fetchFromNetwork();
    return () => { cancelled = true; };
  }, [tagId]);

  return { plant, events, availableCount, loading, error };
}
