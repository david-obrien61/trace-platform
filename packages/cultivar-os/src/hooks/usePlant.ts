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
      // If we already seeded from cache, don't show the loading spinner again
      if (!readCache(tagId!)) setLoading(true);
      setError(null);

      const { data: plantData, error: plantErr } = await supabase
        .from('plants')
        .select('*')
        .ilike('tag_id', tagId!)
        .single();

      if (plantErr || !plantData) {
        if (!cancelled) {
          // Only set error if we have no cached data to show
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

      const { count } = await supabase
        .from('plants')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', plantData.business_id)
        .eq('species', plantData.species)
        .eq('current_container', plantData.current_container)
        .eq('status', 'available');

      if (!cancelled) {
        const resolvedEvents  = (eventData ?? []) as PlantEvent[];
        const resolvedCount   = count ?? 1;
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
