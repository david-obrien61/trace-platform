import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import {
  QrCode, BookOpen, ShoppingBag, Share2, MessageCircle,
  Map, Users, Leaf, BarChart2, Camera, Calculator,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export type TileState = 'active' | 'available' | 'locked';

export interface ModuleData {
  key: string;
  name: string;
  description: string | null;
  icon: ComponentType<LucideProps>;
  color: string;
  bg: string;
  tier_required: string | null;
  state: TileState;
  enabled: boolean;
  configured: boolean;
  config: Record<string, unknown> | null;
}

interface ModuleMeta {
  icon: ComponentType<LucideProps>;
  color: string;
  bg: string;
  name: string;
}

const MODULE_META: Record<string, ModuleMeta> = {
  qr_checkout:       { icon: QrCode,         color: '#34d399', bg: '#1e293b', name: 'QR Checkout'  },
  qb_invoicing:      { icon: BookOpen,        color: '#60a5fa', bg: '#1e293b', name: 'QuickBooks'   },
  online_shop:       { icon: ShoppingBag,     color: '#c084fc', bg: '#1e293b', name: 'Online Shop'  },
  social_media:      { icon: Share2,          color: '#f472b6', bg: '#1e293b', name: 'Social'       },
  followup_engine:   { icon: MessageCircle,   color: '#fbbf24', bg: '#1e293b', name: 'Follow-Up'    },
  delivery_routing:  { icon: Map,             color: '#22d3ee', bg: '#1e293b', name: 'Delivery'     },
  contractor_tiers:  { icon: Users,           color: '#fb923c', bg: '#1e293b', name: 'Contractors'  },
  seasonal_module:   { icon: Leaf,            color: '#4ade80', bg: '#1e293b', name: 'Seasonal'     },
  business_insights: { icon: BarChart2,       color: '#818cf8', bg: '#1e293b', name: 'Insights'     },
  inventory_intake:  { icon: Camera,          color: '#fb7185', bg: '#1e293b', name: 'Inventory'    },
  cost_to_produce:   { icon: Calculator,      color: '#2dd4bf', bg: '#1e293b', name: 'Cost'        },
};

const MODULE_ORDER = [
  'qr_checkout', 'qb_invoicing', 'online_shop', 'social_media',
  'followup_engine', 'delivery_routing', 'contractor_tiers',
  'seasonal_module', 'business_insights', 'inventory_intake',
  'cost_to_produce',
] as const;

interface BusinessModuleRow {
  module_key: string;
  enabled: boolean;
  configured: boolean;
  config: Record<string, unknown> | null;
}

interface ModuleRow {
  key: string;
  name: string;
  description: string | null;
  tier_required: string | null;
}

export function useModules(businessId: string | null) {
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!businessId) return;
      setLoading(true);
      setError(null);

      try {
        const [businessRes, nmRes, modsRes] = await Promise.all([
          supabase
            .from('businesses')
            .select('accounting_company_id')
            .eq('id', businessId)
            .single(),

          supabase
            .from('business_modules')
            .select('module_key, enabled, configured, config')
            .eq('business_id', businessId),

          supabase
            .from('modules')
            .select('key, name, description, tier_required'),
        ]);

        if (cancelled) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const accountingCompanyId = (businessRes.data as any)?.accounting_company_id ?? null;
        const businessPlan = 'starter'; // post-demo: fetch from subscription table

        const nmByKey: Record<string, BusinessModuleRow> = {};
        for (const row of (nmRes.data ?? []) as BusinessModuleRow[]) {
          nmByKey[row.module_key] = row;
        }

        const modByKey: Record<string, ModuleRow> = {};
        for (const row of (modsRes.data ?? []) as ModuleRow[]) {
          modByKey[row.key] = row;
        }

        const result: ModuleData[] = MODULE_ORDER.map((key) => {
          const meta = MODULE_META[key];
          const nm   = nmByKey[key] ?? null;
          const mod  = modByKey[key] ?? null;

          const name          = mod?.name          ?? meta.name;
          const description   = mod?.description   ?? null;
          const tier_required = mod?.tier_required ?? null;
          const enabled       = nm?.enabled        ?? false;
          const configured    = nm?.configured     ?? false;
          const config        = nm?.config         ?? null;

          const base = { key, name, description, icon: meta.icon, color: meta.color, bg: meta.bg, tier_required, enabled, configured, config };

          // QB: active if business has a connected accounting company
          if (key === 'qb_invoicing') {
            return { ...base, state: (accountingCompanyId ? 'active' : 'available') as TileState };
          }

          // Growth-tier module on starter plan → locked
          if (tier_required === 'growth' && businessPlan === 'starter') {
            return { ...base, state: 'locked' as TileState };
          }

          // Enabled and configured → active
          if (enabled && configured) {
            return { ...base, state: 'active' as TileState };
          }

          return { ...base, state: 'available' as TileState };
        });

        setModules(result);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(String((err as Error)?.message ?? 'Failed to load modules'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [businessId]);

  return { modules, loading, error };
}
