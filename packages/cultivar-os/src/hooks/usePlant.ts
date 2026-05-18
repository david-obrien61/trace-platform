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

export function usePlant(tagId: string | undefined): UsePlantResult {
  const [plant,          setPlant]          = useState<Plant | null>(null);
  const [events,         setEvents]         = useState<PlantEvent[]>([]);
  const [availableCount, setAvailableCount] = useState(1);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);

  useEffect(() => {
    if (!tagId) return;

    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      // Fetch plant by tag_id (public — no auth required per RLS policy)
      const { data: plantData, error: plantErr } = await supabase
        .from('plants')
        .select('*')
        .eq('tag_id', tagId)
        .single();

      if (plantErr || !plantData) {
        if (!cancelled) {
          setError(plantErr?.message ?? 'Plant not found');
          setLoading(false);
        }
        return;
      }

      // Fetch journey events
      const { data: eventData } = await supabase
        .from('plant_events')
        .select('*')
        .eq('plant_id', plantData.id)
        .order('occurred_at', { ascending: true });

      // Fetch count of available siblings (same species + container)
      const { count } = await supabase
        .from('plants')
        .select('*', { count: 'exact', head: true })
        .eq('nursery_id', plantData.nursery_id)
        .eq('species', plantData.species)
        .eq('current_container', plantData.current_container)
        .eq('status', 'available');

      if (!cancelled) {
        setPlant(plantData as Plant);
        setEvents((eventData ?? []) as PlantEvent[]);
        setAvailableCount(count ?? 1);
        setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [tagId]);

  return { plant, events, availableCount, loading, error };
}
