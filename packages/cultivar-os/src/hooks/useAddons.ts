import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Addon } from '../types/plant';

interface UseAddonsResult {
  addons: Addon[];
  loading: boolean;
  error: string | null;
}

export function useAddons(nurseryId: string): UseAddonsResult {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('addons')
        .select('*')
        .eq('nursery_id', nurseryId)
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (cancelled) return;

      if (err) {
        console.error('[useAddons] Supabase error:', err.message, err);
        setError(err.message);
      } else {
        console.log('[useAddons] fetched addons:', data);
        setAddons(data ?? []);
      }
      setLoading(false);
    }

    fetch();
    return () => { cancelled = true; };
  }, [nurseryId]);

  return { addons, loading, error };
}
