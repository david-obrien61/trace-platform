// PURPOSE:      The client half of THE PERMISSION FUNNEL (David's ruling 2026-07-23, OPTION 1).
//               The ONLY way the app changes a role→permission fact: thin wrappers over the two
//               SECURITY DEFINER RPCs (save_role_permissions / assign_member_role,
//               20260723_permission_funnel.sql) that write the role_definitions template AND
//               re-materialize business_members.permissions AND append the audit_log row in one
//               transaction. Replaces the old upsertTenantRole / deleteTenantRole / updateMemberRole
//               direct writes — which the migration's §1 side-door close now REFUSES anyway.
// DEPENDENCIES: supabase.rpc('save_role_permissions' | 'assign_member_role') · the caller's
//               authenticated session (supabase.auth.getUser() supplies the passed actor id; the
//               RPC's forgery pin requires it to equal auth.uid()).
// OUTPUTS:      saveRolePermissions / assignMemberRole (RPC wrappers) · diffPermissions (PURE —
//               the blast-radius the Roles-tab confirm shows BEFORE a save; tested RED-first) ·
//               RoleSaveOp / RoleSaveResult / AffectedMember / MemberRoleResult / PermissionDiff.

import type { SupabaseClient } from '@supabase/supabase-js';

export type RoleSaveOp = 'save' | 'create' | 'reset' | 'delete';

export interface AffectedMember {
  memberId: string;
  memberName: string | null;
  before: string[];
  after: string[];
}

export interface RoleSaveResult {
  applied: boolean;
  reason?: string;
  /** One entry per ACTIVE member re-materialized by this save (WIPE-not-merge, sub-ruling #1). */
  affected: AffectedMember[];
}

export interface MemberRoleResult {
  applied: boolean;
  reason?: string;
  roleBefore?: string | null;
  roleAfter?: string | null;
  before?: string[];
  after?: string[];
}

export interface PermissionDiff {
  added: string[];    // in `after`, not in `before`
  removed: string[];  // in `before`, not in `after`
}

/**
 * PURE. The blast radius of changing a permission set: what is GAINED and what is LOST.
 * The Roles-tab save-confirm renders this per affected member BEFORE the write, so a save
 * that REMOVES authority names how many people lose what (ruling #1's consequence — a silent
 * revocation is the same defect class as a silent grant). Order-preserving on the source arrays.
 */
export function diffPermissions(before: string[], after: string[]): PermissionDiff {
  const b = new Set(before);
  const a = new Set(after);
  return {
    added: after.filter((p) => !b.has(p)),
    removed: before.filter((p) => !a.has(p)),
  };
}

// The RPC's returned row shape (snake_case, as PostgREST returns it).
interface SaveRow {
  applied: boolean;
  reason: string | null;
  member_id: string | null;
  member_name: string | null;
  perms_before: string[] | null;
  perms_after: string[] | null;
}
interface AssignRow {
  applied: boolean;
  reason: string | null;
  role_before: string | null;
  role_after: string | null;
  perms_before: string[] | null;
  perms_after: string[] | null;
}

async function actorId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('saveRolePermissions: no authenticated session');
  return data.user.id;
}

/**
 * Write a role's permission set through the funnel. op selects the audit verb + delete semantics:
 *   'save'   — upsert the tenant override + propagate to active members (role.permissions_changed)
 *   'create' — new custom/clone role, no members yet (role.created)
 *   'reset'  — delete the tenant override, floor shows through, propagate (role.factory_reset)
 *   'delete' — delete a custom role (role.deleted; members left as-is)
 * A non-owner caller is refused server-side and the attempt is audited; { applied:false, reason } here.
 */
export async function saveRolePermissions(
  supabase: SupabaseClient,
  businessId: string,
  roleKey: string,
  op: RoleSaveOp,
  fields: { label?: string | null; description?: string | null; permissions?: string[] },
): Promise<RoleSaveResult> {
  const actor = await actorId(supabase);
  const { data, error } = await supabase.rpc('save_role_permissions', {
    p_business_id: businessId,
    p_actor_user_id: actor,
    p_role_key: roleKey,
    p_op: op,
    p_label: fields.label ?? null,
    p_description: fields.description ?? null,
    p_permissions: fields.permissions ?? [],
  });
  if (error) throw new Error(`saveRolePermissions: ${error.message}`);
  const rows = (data ?? []) as SaveRow[];
  const first = rows[0];
  if (!first || first.applied === false) {
    return { applied: false, reason: first?.reason ?? 'save refused', affected: [] };
  }
  const affected: AffectedMember[] = rows
    .filter((r) => r.member_id)
    .map((r) => ({
      memberId: r.member_id as string,
      memberName: r.member_name,
      before: r.perms_before ?? [],
      after: r.perms_after ?? [],
    }));
  return { applied: true, affected };
}

/** Re-assign ONE member's role through the funnel (Users tab dropdown). */
export async function assignMemberRole(
  supabase: SupabaseClient,
  businessId: string,
  memberId: string,
  roleKey: string,
): Promise<MemberRoleResult> {
  const actor = await actorId(supabase);
  const { data, error } = await supabase.rpc('assign_member_role', {
    p_business_id: businessId,
    p_actor_user_id: actor,
    p_member_id: memberId,
    p_role_key: roleKey,
  });
  if (error) throw new Error(`assignMemberRole: ${error.message}`);
  const row = ((data ?? []) as AssignRow[])[0];
  if (!row || row.applied === false) {
    return { applied: false, reason: row?.reason ?? 'assignment refused' };
  }
  return {
    applied: true,
    roleBefore: row.role_before,
    roleAfter: row.role_after,
    before: row.perms_before ?? [],
    after: row.perms_after ?? [],
  };
}
