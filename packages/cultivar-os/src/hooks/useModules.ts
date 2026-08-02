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
import { trialDaysRemaining } from '../../../shared/src/business-logic/trialClock';
import { BUSINESS_MODULE_COLUMNS } from '../../../shared/src/business-logic/moduleState';
import type { BusinessModuleRow } from '../../../shared/src/business-logic/moduleState';
import { dashboardTilesForVerticals, verticalsForBusinessType } from '../registry/tileRegistry';

export type TileState = 'active' | 'available' | 'locked' | 'planned';

export interface ModuleTile {
  key: string;
  label: string;
  icon: ComponentType<LucideProps>;
  color: string;
  bg: string;
  state: TileState;
  /** Navigation target (from the registry) — Dashboard navigates here on tap. */
  route?: string;
  /**
   * Days left in this module's trial, or `null` when it is not on a clock (core, unpriced, or
   * never trialled). **`null` and `0` are different answers** — see trialClock.ts. A trialling
   * module is `state:'active'` and carries this; it is an ANNOTATION on a working tile, not a
   * state of its own (David's ruling 2026-08-02).
   */
  trialDaysLeft?: number | null;
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
          .select(BUSINESS_MODULE_COLUMNS)
          .eq('business_id', businessId);

        if (cancelled) return;

        const nmByKey: Record<string, BusinessModuleRow> = {};
        for (const row of (nmData ?? []) as BusinessModuleRow[]) {
          nmByKey[row.module_key] = row;
        }

        // vertical-aware: only this business's verticals (general + its own) reach the grid.
        const verticals = verticalsForBusinessType(businessType);
        const result: ModuleTile[] = dashboardTilesForVerticals(verticals)
          // ═══════════════════════════════════════════════════════════════════════════════════
          // 🔴 THE PERMISSION FILTER NO LONGER RUNS BEFORE THE STATUS READ (ledger #176).
          // ═══════════════════════════════════════════════════════════════════════════════════
          // It read `.filter((t) => can(t.required_permission))` — full stop — and the `status ===
          // 'planned'` branch below sat AFTER it. So a planned tile only ever rendered if the
          // session already held its string: **`planned` was reachable exactly for the people who
          // did not need to be told the feature was coming.** That is the inverse of what the
          // state is for. A planned tile must render BECAUSE IT IS PLANNED (David's ruling).
          //
          // The permission gate still applies to everything else, unchanged — this widens the grid
          // by the planned tiles ONLY, and a planned tile exposes nothing: it has no route, no
          // data, and cannot be clicked.
          .filter((t) => t.status === 'planned' || can(t.required_permission))
          .map((t) => {
            let state: TileState;
            // ═══════════════════════════════════════════════════════════════════════════════════
            // 🔴 THE TRIAL TERM IS READ (2026-08-02). `config` was SELECTED and then DROPPED.
            // ═══════════════════════════════════════════════════════════════════════════════════
            // The pair landed in the row on 2026-08-01 and nothing read it, so a module on a live
            // 30-day trial and a module nobody had ever touched rendered the SAME PIXEL. Note this
            // was invisible to tsc AND to knip: `config` appears in the select string and in
            // `BusinessModuleRow`, so it is "used" everywhere except where it matters.
            //
            // It is an ANNOTATION, not a state. A trialling module is ACTIVE — it works — and the
            // countdown rides along. Computed from the STORED pair, never the catalog.
            const trialDaysLeft = t.module_key
              ? trialDaysRemaining(nmByKey[t.module_key]?.config)
              : null;
            if (t.status === 'planned') {
              // 'planned', NOT 'locked'. The old mapping rendered a RED LOCK on every unbuilt
              // tile, so "not built yet" and "not allowed" were the same pixel. See Tile.tsx.
              state = 'planned';
            } else if (t.module_key) {
              // a tile backed by an enablement row: active once enabled+configured, else available
              const nm = nmByKey[t.module_key] ?? null;
              state = nm?.enabled && nm?.configured ? 'active' : 'available';
            } else {
              // a live surface with no enablement gate (cost/assets/etc.) — directly navigable
              state = 'active';
            }
            return { key: t.key, label: t.label, icon: t.icon, color: t.color, bg: t.bg, state, route: t.route, trialDaysLeft };
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
