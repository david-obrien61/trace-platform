// PURPOSE:      Read/resolve/write the three-tier role-definition store (role_definitions),
//               the data layer behind the role-config console (visibility axis).
// DEPENDENCIES: role_definitions table (20260623_role_definitions_and_self_grant_fix.sql) —
//               shared floor (business_id IS NULL, is_system=true), per-tenant overrides, and
//               per-tenant custom roles. RLS: rd_read (floor + own tenant rows), rd_owner_write
//               (owner only, tenant rows only — the floor is never tenant-writable). Runs with
//               the owner's authenticated Supabase session (same contract as members.ts).
// OUTPUTS:      getRoleDefinitions, resolveRoles, upsertTenantRole, deleteTenantRole +
//               ResolvedRole / RoleDefinitionRow types.
//
// RESOLUTION CHAIN (MB_D-010): shared floor → per-tenant override (replaces the floor for a
// matching role_key) → [member's own business_members.permissions jsonb, applied elsewhere].
// CLONE-NOT-MUTATE: tuning a system role writes a SEPARATE per-tenant override row; the shared
// floor row is never mutated. FACTORY-RESET = delete the tenant override row → the floor shows
// through again (NOT a snapshot restore).

import type { SupabaseClient } from '@supabase/supabase-js';

export interface RoleDefinitionRow {
  id: string;
  business_id: string | null; // null = shared system floor
  role_key: string;
  is_system: boolean;
  label: string | null;
  description: string | null;
  permissions: string[];
  created_at: string;
  updated_at: string;
}

export type RoleSource = 'system' | 'override' | 'custom';

export interface ResolvedRole {
  role_key: string;
  label: string;
  description: string;
  permissions: string[];
  source: RoleSource;     // system = floor only · override = floor key tuned per-tenant · custom = tenant-made
  locked: boolean;        // true for the three system role_keys (cannot be deleted/renamed)
  isOverridden: boolean;  // true when a per-tenant override row exists for a system role_key
}

interface RoleDefinitionsResult {
  floor: RoleDefinitionRow[];   // business_id IS NULL
  tenant: RoleDefinitionRow[];  // business_id = businessId
}

/**
 * Fetch the shared floor + this tenant's role rows. The floor is visible to every
 * authenticated user (rd_read); tenant rows only to active members of the business.
 */
export async function getRoleDefinitions(
  supabase: SupabaseClient,
  businessId: string,
): Promise<RoleDefinitionsResult> {
  // floor: business_id IS NULL. tenant: business_id = businessId. One query, split in JS,
  // so we never miss the floor if a tenant has zero rows yet.
  const { data, error } = await supabase
    .from('role_definitions')
    .select('*')
    .or(`business_id.is.null,business_id.eq.${businessId}`)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`getRoleDefinitions: ${error.message}`);

  const rows = (data ?? []) as RoleDefinitionRow[];
  return {
    floor: rows.filter((r) => r.business_id === null),
    tenant: rows.filter((r) => r.business_id === businessId),
  };
}

/**
 * Collapse floor + tenant rows into the effective role list the console renders.
 * Floor roles come first (in floor order), each replaced by its override if present;
 * tenant custom roles (role_key not in the floor) follow.
 */
export function resolveRoles(
  floor: RoleDefinitionRow[],
  tenant: RoleDefinitionRow[],
): ResolvedRole[] {
  const floorKeys = new Set(floor.map((f) => f.role_key));
  const tenantByKey = new Map(tenant.map((t) => [t.role_key, t]));

  const resolved: ResolvedRole[] = floor.map((f) => {
    const override = tenantByKey.get(f.role_key);
    return {
      role_key: f.role_key,
      label: override?.label ?? f.label ?? f.role_key,
      description: override?.description ?? f.description ?? '',
      permissions: override ? override.permissions : f.permissions,
      source: override ? 'override' : 'system',
      locked: true,            // system role_keys are locked anchors (no delete/rename)
      isOverridden: !!override,
    };
  });

  // tenant custom roles = tenant rows whose key is NOT a floor key
  for (const t of tenant) {
    if (floorKeys.has(t.role_key)) continue;
    resolved.push({
      role_key: t.role_key,
      label: t.label ?? t.role_key,
      description: t.description ?? '',
      permissions: t.permissions,
      source: 'custom',
      locked: false,
      isOverridden: false,
    });
  }

  return resolved;
}

/**
 * Write (insert or update) a per-tenant role row. Used for BOTH tuning a system role
 * (role_key = a floor key → creates/updates the override) and saving a custom role
 * (role_key = a new key). Never touches the shared floor (RLS forbids it anyway).
 * Avoids PostgREST upsert because the uniqueness is a PARTIAL index, which conflict
 * inference can't target — so we explicit select-then-insert/update by (business_id, role_key).
 */
export async function upsertTenantRole(
  supabase: SupabaseClient,
  businessId: string,
  roleKey: string,
  fields: { is_system?: boolean; label?: string | null; description?: string | null; permissions: string[] },
): Promise<void> {
  const { data: existing, error: selErr } = await supabase
    .from('role_definitions')
    .select('id')
    .eq('business_id', businessId)
    .eq('role_key', roleKey)
    .maybeSingle();

  if (selErr) throw new Error(`upsertTenantRole(select): ${selErr.message}`);

  if (existing) {
    const patch: Record<string, unknown> = { permissions: fields.permissions };
    if (fields.label !== undefined) patch.label = fields.label;
    if (fields.description !== undefined) patch.description = fields.description;
    const { error } = await supabase
      .from('role_definitions')
      .update(patch)
      .eq('id', (existing as { id: string }).id);
    if (error) throw new Error(`upsertTenantRole(update): ${error.message}`);
  } else {
    const { error } = await supabase.from('role_definitions').insert({
      business_id: businessId,
      role_key: roleKey,
      is_system: fields.is_system ?? false, // tenant rows are never system anchors
      label: fields.label ?? null,
      description: fields.description ?? null,
      permissions: fields.permissions,
    });
    if (error) throw new Error(`upsertTenantRole(insert): ${error.message}`);
  }
}

/**
 * Delete a per-tenant role row. For a system role_key this is FACTORY-RESET (removes the
 * override → the shared floor shows through again). For a custom role_key it deletes the
 * custom role. The shared floor is never matched (business_id scope).
 */
export async function deleteTenantRole(
  supabase: SupabaseClient,
  businessId: string,
  roleKey: string,
): Promise<void> {
  const { error } = await supabase
    .from('role_definitions')
    .delete()
    .eq('business_id', businessId)
    .eq('role_key', roleKey);
  if (error) throw new Error(`deleteTenantRole: ${error.message}`);
}
