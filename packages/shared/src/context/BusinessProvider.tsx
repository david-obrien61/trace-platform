import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase/client';

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  tax_rate: number;
  business_type: string;
  accounting_type: string | null;
  accounting_needs_reconnect: boolean;
  accounting_company_id: string | null;
  trial_started_at: string | null;
  created_at: string;
}

interface BusinessContextValue {
  business: Business | null;
  businessId: string | null;
  businessError: string | null;
  loading: boolean;
  reload: () => void;
}

const BusinessContext = createContext<BusinessContextValue>({
  business: null,
  businessId: null,
  businessError: null,
  loading: true,
  reload: () => {},
});

export function BusinessProvider({
  children,
  businessType,
}: {
  children: React.ReactNode;
  businessType: string;
}) {
  const [business, setBusiness] = useState<Business | null>(null);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      setLoading(true);
      setBusinessError(null);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setBusiness(null);
          setBusinessError(null);
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', user.id)
        .eq('business_type', businessType)
        .single();

      if (cancelled) return;

      if (error || !data) {
        setBusinessError('no_business');
        setBusiness(null);
      } else {
        setBusiness(data as Business);
        setBusinessError(null);
      }
      setLoading(false);
    }

    resolve();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      if (!cancelled) resolve();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [tick, businessType]);

  return (
    <BusinessContext.Provider value={{
      business,
      businessId: business?.id ?? null,
      businessError,
      loading,
      reload: () => setTick(t => t + 1),
    }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusinessContext(): BusinessContextValue {
  return useContext(BusinessContext);
}
