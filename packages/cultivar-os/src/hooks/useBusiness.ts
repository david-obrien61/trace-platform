import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Business } from '../types/nursery';

export function useBusiness(businessId: string) {
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single()
      .then(({ data }) => {
        if (!cancelled) {
          setBusiness(data as Business | null);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [businessId]);

  return { business, loading };
}
