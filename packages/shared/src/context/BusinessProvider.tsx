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

export interface BusinessContextValue {
  business: Business | null;
  businessId: string | null;
  businessError: string | null;
  loading: boolean;
  reload: () => void;
  // null = owner (full access implied). string[] = member's explicit permission list.
  userPermissions: string[] | null;
  isOwner: boolean;
}

const BusinessContext = createContext<BusinessContextValue>({
  business: null,
  businessId: null,
  businessError: null,
  loading: true,
  reload: () => {},
  userPermissions: null,
  isOwner: false,
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
  const [userPermissions, setUserPermissions] = useState<string[] | null>(null);
  const [isOwner, setIsOwner] = useState(false);

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

      // 1. Try owner lookup (fast path — covers 99% of logins)
      let { data: biz } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', user.id)
        .eq('business_type', businessType)
        .single();

      let resolvedPerms: string[] | null = null; // null = owner (full access)
      let resolvedIsOwner = true;

      // 2. If not an owner, check business_members (member path)
      if (!biz) {
        const { data: member } = await supabase
          .from('business_members')
          .select('business_id, role, permissions, businesses(*)')
          .eq('user_id', user.id)
          .eq('active', true)
          .single();
        const memberBiz = (member?.businesses as any) ?? null;
        // Scope to current vertical — prevents cross-vertical data exposure (audit #13)
        if (member && memberBiz?.business_type === businessType) {
          biz = memberBiz;
          resolvedPerms = (member.permissions as string[]) ?? [];
          resolvedIsOwner = false;
        }
      }

      if (cancelled) return;

      if (!biz) {
        setBusinessError('no_business');
        setBusiness(null);
        setUserPermissions(null);
        setIsOwner(false);
      } else {
        setBusiness(biz as Business);
        setBusinessError(null);
        setUserPermissions(resolvedPerms);
        setIsOwner(resolvedIsOwner);
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
      userPermissions,
      isOwner,
    }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusinessContext(): BusinessContextValue {
  return useContext(BusinessContext);
}
