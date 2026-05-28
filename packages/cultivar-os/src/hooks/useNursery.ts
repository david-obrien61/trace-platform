import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Nursery } from '../types/nursery';

export function useNursery(nurseryId: string) {
  const [nursery, setNursery] = useState<Nursery | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('nurseries')
      .select('*')
      .eq('id', nurseryId)
      .single()
      .then(({ data }) => {
        if (!cancelled) {
          setNursery(data as Nursery | null);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [nurseryId]);

  return { nursery, loading };
}
