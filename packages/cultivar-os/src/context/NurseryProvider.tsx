import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Nursery } from '../types/nursery';

interface NurseryContextValue {
  nurseryId: string | null;
  nursery: Nursery | null;
  loading: boolean;
  error: string | null;
}

const NurseryContext = createContext<NurseryContextValue>({
  nurseryId: null,
  nursery: null,
  loading: true,
  error: null,
});

export function NurseryProvider({ children }: { children: React.ReactNode }) {
  const [nurseryId, setNurseryId] = useState<string | null>(null);
  const [nursery, setNursery]     = useState<Nursery | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Unauthenticated — public routes are fine with null nursery
        if (!cancelled) {
          setNurseryId(null);
          setNursery(null);
          setLoading(false);
        }
        return;
      }

      const { data, error: dbErr } = await supabase
        .from('nurseries')
        .select('*')
        .eq('owner_id', user.id)
        .single();

      if (cancelled) return;

      if (dbErr || !data) {
        setError(
          dbErr?.message ??
          'No nursery found for this account. Contact support.'
        );
        setLoading(false);
        return;
      }

      setNurseryId(data.id);
      setNursery(data as Nursery);
      setLoading(false);
    }

    resolve();

    // Re-resolve whenever the auth state changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      if (!cancelled) resolve();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <NurseryContext.Provider value={{ nurseryId, nursery, loading, error }}>
      {children}
    </NurseryContext.Provider>
  );
}

export function useNursery(): NurseryContextValue {
  return useContext(NurseryContext);
}
