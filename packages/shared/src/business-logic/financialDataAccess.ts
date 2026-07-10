/**
 * financialDataAccess.ts — read/write seam for the Phase 2 hard wall (decision 2026-06-21).
 *
 * PURPOSE: the single place that reads/writes the two walled surfaces — labor WAGES
 *   (labor_resources ↔ labor_resource_wages child) and the PRICING CONFIG
 *   (business_modules.config ↔ business_pricing_config child). All call sites
 *   (CostToProduceSettings load/save/reload, CostToProduce /costs read) go through here
 *   so the wall's data model + its migration-window resilience live in ONE place.
 *
 * MIGRATION-WINDOW RESILIENCE: each reader/writer targets the gated CHILD table and
 *   FALLS BACK to the legacy location ONLY when the child table is ABSENT (relation
 *   error) — never on an RLS-filtered empty result. So the code works:
 *     • before the migration (child missing → reads/writes the legacy base location), and
 *     • after  the migration (child present → reads/writes the child; the base copy is
 *       cleared and a session lacking the permission gets zero child rows = the wall).
 *   ⇒ DEPLOY THIS CODE FIRST, then apply 20260621_financial_wall_phase2.sql.
 *
 * DEPENDENCIES: @supabase/supabase-js client (caller-supplied; runs under the user
 *   session for RLS, or service key for proofs). OUTPUTS: { data, error } shapes that
 *   drop into the existing call sites unchanged.
 *
 * THE WALL IS RLS, NOT THIS FILE: a member without the permission gets zero child rows
 *   from the data layer. This helper never decides access — it just reads what RLS allows.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const WAGE_COLS = ['base_wage', 'burden', 'cost_rate', 'bill_rate', 'rate', 'pass_through_expenses'] as const;
type WageCol = (typeof WAGE_COLS)[number];

export interface LaborResourceRow {
  id: string;
  resource_type: string | null;
  name: string | null;
  rate_basis: string | null;
  base_wage: number | null;
  burden: number | null;
  cost_rate: number | null;
  bill_rate: number | null;
  rate: number | null;
  pass_through_expenses: number | null;
}

/** True only for "relation/table absent" (pre-migration) — NOT for an RLS-filtered empty read. */
function isMissingRelation(error: any): boolean {
  if (!error) return false;
  const code = String(error.code ?? '');
  const msg = String(error.message ?? '').toLowerCase();
  return (
    code === '42P01' ||      // undefined_table
    code === 'PGRST205' ||   // PostgREST: table not found
    code === 'PGRST200' ||   // PostgREST: relationship/embed not found
    msg.includes('does not exist') ||
    msg.includes('could not find') ||
    msg.includes('schema cache')
  );
}

const pickWages = (src: any): Record<WageCol, number | null> => {
  const out = {} as Record<WageCol, number | null>;
  for (const c of WAGE_COLS) out[c] = src?.[c] == null ? null : Number(src[c]);
  return out;
};

// ── LABOR RESOURCES (view_wages) ──────────────────────────────────────────────

/**
 * Read labor resources with wages merged from the gated child. A session lacking
 * view_wages gets the resources (type/name/basis) with NULL wages — the wall. Returns
 * the SAME row shape the legacy single-table read returned, so call sites are unchanged.
 */
export async function readLaborResources(
  supabase: SupabaseClient,
  businessId: string,
): Promise<{ data: LaborResourceRow[] | null; error: { message: string } | null }> {
  // base row (post-migration the wage columns here are NULL; pre-migration they hold the value)
  const baseRes = await supabase
    .from('labor_resources')
    .select('id,resource_type,name,rate_basis,base_wage,burden,cost_rate,bill_rate,rate,pass_through_expenses')
    .eq('business_id', businessId);
  if (baseRes.error) return { data: null, error: baseRes.error };
  const base = (baseRes.data ?? []) as any[];

  // gated child wages
  const childRes = await supabase
    .from('labor_resource_wages')
    .select('resource_id,base_wage,burden,cost_rate,bill_rate,rate,pass_through_expenses')
    .eq('business_id', businessId);

  if (childRes.error && isMissingRelation(childRes.error)) {
    // pre-migration: the child table does not exist yet → base wages are the source of truth.
    return { data: base.map((r) => ({ ...r, ...pickWages(r) })) as LaborResourceRow[], error: null };
  }
  if (childRes.error) return { data: null, error: childRes.error };

  // post-migration: wages come from the (RLS-gated) child; a resource with no visible child
  // row gets NULL wages (owner/permitted member sees them; everyone else does not).
  const wageById = new Map<string, any>((childRes.data ?? []).map((w: any) => [String(w.resource_id), w]));
  const merged = base.map((r) => {
    const w = wageById.get(String(r.id));
    return { ...r, ...pickWages(w ?? {}) };
  });
  return { data: merged as LaborResourceRow[], error: null };
}

/**
 * Write a labor resource: non-wage fields → labor_resources; wage fields → the gated child.
 * Returns the resource id. Resilient: if the child is absent (pre-migration) the wage
 * fields are written to the base table instead.
 */
export async function writeLaborResource(
  supabase: SupabaseClient,
  businessId: string,
  resourceId: string | null,
  fields: {
    resource_type: string;
    name: string;
    rate_basis: string;
    base_wage: number | null;
    burden: number | null;
    cost_rate: number | null;
    bill_rate: number | null;
    rate: number | null;
    pass_through_expenses: number | null;
  },
): Promise<{ resourceId: string | null; error: { message: string } | null }> {
  const nonWage = {
    business_id: businessId,
    resource_type: fields.resource_type,
    name: fields.name,
    rate_basis: fields.rate_basis,
  };
  const wages = {
    base_wage: fields.base_wage,
    burden: fields.burden,
    cost_rate: fields.cost_rate,
    bill_rate: fields.bill_rate,
    rate: fields.rate,
    pass_through_expenses: fields.pass_through_expenses,
  };

  // 1. base row (non-wage)
  let id = resourceId;
  if (!id) {
    const { data, error } = await supabase.from('labor_resources').insert(nonWage).select('id').single();
    if (error) return { resourceId: null, error };
    id = String(data.id);
  } else {
    const { error } = await supabase.from('labor_resources').update(nonWage).eq('id', id).eq('business_id', businessId);
    if (error) return { resourceId: id, error };
  }

  // 2. wages → gated child (upsert by resource_id); fall back to base if child absent.
  const childUpsert = await supabase
    .from('labor_resource_wages')
    .upsert({ resource_id: id, business_id: businessId, ...wages }, { onConflict: 'resource_id' });
  if (childUpsert.error && isMissingRelation(childUpsert.error)) {
    const { error } = await supabase.from('labor_resources').update(wages).eq('id', id).eq('business_id', businessId);
    return { resourceId: id, error };
  }
  return { resourceId: id, error: childUpsert.error };
}

// ── PRICING CONFIG (view_pricing_config) ──────────────────────────────────────

/**
 * Read the cost_to_produce pricing config from the gated table; fall back to the legacy
 * business_modules.config when the gated table is absent. A session lacking
 * view_pricing_config gets null (RLS-filtered) — the wall.
 */
export async function readPricingConfig(
  supabase: SupabaseClient,
  businessId: string,
): Promise<{ data: { config: any } | null; error: { message: string } | null }> {
  const res = await supabase
    .from('business_pricing_config')
    .select('config')
    .eq('business_id', businessId)
    .maybeSingle();
  if (res.error && isMissingRelation(res.error)) {
    // pre-migration: config still lives on business_modules
    const legacy = await supabase
      .from('business_modules')
      .select('config')
      .eq('business_id', businessId)
      .eq('module_key', 'cost_to_produce')
      .maybeSingle();
    return { data: legacy.data ? { config: (legacy.data as any).config } : null, error: legacy.error };
  }
  if (res.error) return { data: null, error: res.error };
  return { data: res.data ? { config: (res.data as any).config } : null, error: null };
}

/**
 * Write the pricing config to the gated table (or the legacy location pre-migration), and
 * keep the business_modules cost_to_produce ENABLEMENT flags (enabled/configured) set —
 * those govern module enablement and stay on business_modules either way.
 */
export async function writePricingConfig(
  supabase: SupabaseClient,
  businessId: string,
  config: any,
): Promise<{ error: { message: string } | null }> {
  const gated = await supabase
    .from('business_pricing_config')
    .upsert({ business_id: businessId, config }, { onConflict: 'business_id' });

  if (gated.error && isMissingRelation(gated.error)) {
    // pre-migration: config lives on business_modules (with the enablement flags)
    const { error } = await supabase.from('business_modules').upsert(
      { business_id: businessId, module_key: 'cost_to_produce', enabled: true, configured: true, config },
      { onConflict: 'business_id,module_key' },
    );
    return { error };
  }
  if (gated.error) return { error: gated.error };

  // post-migration: config is in the gated table; keep the module enabled (config stays '{}' here)
  const { error } = await supabase.from('business_modules').upsert(
    { business_id: businessId, module_key: 'cost_to_produce', enabled: true, configured: true },
    { onConflict: 'business_id,module_key' },
  );
  return { error };
}

/**
 * READ-MERGE-WRITE the pricing config: read the current config jsonb, shallow-merge `patch` over it,
 * write it back via writePricingConfig. This is the clobber-safe path for the THREE partial writers
 * of business_pricing_config.config that own DIFFERENT keys — Discounts (discountTypes + aiBiEnabled)
 * and the Cost-to-Produce panel (cost keys). Each writer patches ONLY its keys; a stale in-memory
 * blob from one screen can never wipe another screen's keys (money-safety on shared config).
 * Returns the read error if the read fails (never writes a config it couldn't first read).
 */
export async function mergePricingConfig(
  supabase: SupabaseClient,
  businessId: string,
  patch: Record<string, unknown>,
): Promise<{ error: { message: string } | null }> {
  const { data, error: readErr } = await readPricingConfig(supabase, businessId);
  if (readErr) return { error: readErr };
  const current = (data?.config && typeof data.config === 'object') ? (data.config as Record<string, unknown>) : {};
  const next = { ...current, ...patch };
  return writePricingConfig(supabase, businessId, next);
}
