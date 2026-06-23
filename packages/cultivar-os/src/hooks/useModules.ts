/**
 * useModules — builds the Dashboard tile grid FROM the single tile registry (MB_D-012).
 *
 * PURPOSE:      Return the dashboard grid tiles the active session is permitted to see, in
 *               registry order, with their per-tenant state overlaid. The catalog (label, icon,
 *               color, order, route, required_permission) comes from tileRegistry.ts — the ONE
 *               source. The three drifting lists this used to own (MODULE_META, MODULE_ORDER,
 *               and the Dashboard routing switches) are GONE.
 * DEPENDENCIES: tileRegistry.ts (catalog); business_modules (per-tenant enablement overlay);
 *               the permission chokepoint `can` (BusinessProvider) for visibility gating.
 * OUTPUTS:      { modules, loading, error } — modules = ModuleTile[] (dashboard grid only).
 *
 * Visibility rule (the wiring point of D-012): a tile renders iff
 *   placement==dashboard (registry) AND the tile's vertical is in the business's vertical set
 *   (business_type → general + its own vertical) AND the role holds required_permission (can()).
 * Status drives interactivity: status==planned → 'locked' (greyed); status==live → 'active'
 * (navigable) or 'available' (has a module_key but not yet enabled+configured → tap to set up).
 */
import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { dashboardTilesForVerticals, verticalsForBusinessType } from '../registry/tileRegistry';

export type TileState = 'active' | 'available' | 'locked';

export interface ModuleTile {
  key: string;
  label: string;
  icon: ComponentType<LucideProps>;
  color: string;
  bg: string;
  state: TileState;
  /** Navigation target (from the registry) — Dashboard navigates here on tap. */
  route?: string;
}

interface BusinessModuleRow {
  module_key: string;
  enabled: boolean;
  configured: boolean;
  config: Record<string, unknown> | null;
}

/**
 * @param businessId   active business
 * @param can          permission chokepoint (BusinessProvider). Owner ⇒ true for all; member ⇒
 *                     their explicit list. A tile the session can't see is filtered out.
 * @param businessType the business's vertical (businesses.business_type). Drives vertical-aware
 *                     enablement: the business gets `general` tiles + its own vertical's tiles.
 */
export function useModules(
  businessId: string | null,
  can: (permissionId: string) => boolean,
  businessType: string | null,
) {
  const [modules, setModules] = useState<ModuleTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!businessId) return;
      setLoading(true);
      setError(null);

      try {
        // Per-tenant enablement overlay — registry is the catalog; business_modules is the
        // tenant's enabled/configured state (used only for active-vs-available styling/badge).
        const { data: nmData } = await supabase
          .from('business_modules')
          .select('module_key, enabled, configured, config')
          .eq('business_id', businessId);

        if (cancelled) return;

        const nmByKey: Record<string, BusinessModuleRow> = {};
        for (const row of (nmData ?? []) as BusinessModuleRow[]) {
          nmByKey[row.module_key] = row;
        }

        // vertical-aware: only this business's verticals (general + its own) reach the grid.
        const verticals = verticalsForBusinessType(businessType);
        const result: ModuleTile[] = dashboardTilesForVerticals(verticals)
          // visibility: vertical-scoped + dashboard placement; gate on the locked permission.
          .filter((t) => can(t.required_permission))
          .map((t) => {
            let state: TileState;
            if (t.status === 'planned') {
              state = 'locked'; // greyed/disabled forward declaration
            } else if (t.module_key) {
              // a tile backed by an enablement row: active once enabled+configured, else available
              const nm = nmByKey[t.module_key] ?? null;
              state = nm?.enabled && nm?.configured ? 'active' : 'available';
            } else {
              // a live surface with no enablement gate (cost/assets/etc.) — directly navigable
              state = 'active';
            }
            return { key: t.key, label: t.label, icon: t.icon, color: t.color, bg: t.bg, state, route: t.route };
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
  }, [businessId, can, businessType]);

  return { modules, loading, error };
}
