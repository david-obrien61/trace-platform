import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ServiceOffering } from '../types/plant';

interface UseServicesResult {
  transportOfferings: ServiceOffering[];
  addonOfferings: ServiceOffering[];
  loading: boolean;
  error: string | null;
}

export function useServices(businessId: string): UseServicesResult {
  const [transportOfferings, setTransportOfferings] = useState<ServiceOffering[]>([]);
  const [addonOfferings, setAddonOfferings]         = useState<ServiceOffering[]>([]);
  const [loading, setLoading]                       = useState(true);
  const [error, setError]                           = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('service_offerings')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .eq('timing', 'at_checkout')
        .order('sort_order', { ascending: true });

      if (cancelled) return;

      if (err) {
        setError(err.message);
      } else {
        const all = (data ?? []) as ServiceOffering[];
        setTransportOfferings(all.filter(o => o.category === 'transport'));
        setAddonOfferings(all.filter(o => o.category === 'addon'));
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [businessId]);

  return { transportOfferings, addonOfferings, loading, error };
}
