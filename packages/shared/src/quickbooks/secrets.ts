// QB OAuth secret storage — owner-only `business_accounting_secrets`.
//
// PURPOSE: read/write the QuickBooks BEARER secrets (access + refresh token) from the
//   owner-only `business_accounting_secrets` table instead of the member-readable
//   `businesses` row. Closes the Gate-3 credential leak (an active member could SELECT
//   businesses.* and read live QB tokens). See migration
//   20260622_oauth_secrets_relocation_and_cost_wall.sql.
// DEPENDENCIES: a supabase-js client with access to the secrets table — SERVER-SIDE
//   SERVICE-KEY clients only (RLS is owner-only; the service key bypasses RLS). Callers:
//   api/qbo/router.ts (connect/status), api/qbo/invoice/cultivar.ts (invoice push),
//   shared/quickbooks/refresh.ts (proactive refresh).
// OUTPUTS: readQBSecrets(), writeQBSecrets().
//
// DEPLOY-WINDOW SAFETY: both FALL BACK to the (soon-NULL) businesses columns when the
// secrets table is absent — so the code is correct BOTH before the migration (table
// missing → businesses columns hold the live token) AND after (table present → businesses
// columns NULL → secrets table authoritative). Mirrors the financialDataAccess fallback
// pattern (20260621 financial wall).
// ⚠️ Remove the businesses-column fallback when the follow-up migration DROPs
//   businesses.accounting_token / accounting_refresh_token (the SELECT/UPDATE on those
//   columns will error once they no longer exist).

/**
 * The `businesses` projection that answers "what is this business's QuickBooks connection
 * state?" — the realm to call, when the access token expires, and the display name.
 *
 * ONE list, IMPORTED by every reader (§6 r8 / A4), because it is one question asked in more
 * than one place: `/api/qbo/status` asks it to report the connection, and `/api/qbo/items`
 * asks it to make a call. Two hand-written copies of one projection is how the two drift —
 * and the field-list cap refused the second copy the moment it was written, which is the cap
 * working. Note what is NOT here: the bearer secrets live in `business_accounting_secrets`
 * and are read through readQBSecrets below, never off this row.
 */
// 🔴 `qbo_writes_enabled` ADDED 2026-09-06 SO `/api/qbo/status` CAN ANSWER THE QUESTION IT WAS
// ALREADY BEING ASKED. The status payload reported `push_held` (the operator's env hold) and said
// nothing about the OWNER's switch — the one `QboWriteSwitch.tsx` flips and `submit.ts:856` gates
// the real push on. So "are writes off for this business?" could not be answered from the one
// endpoint whose whole job is answering it without completing a real order, and a reader who saw
// `push_held: false` would reasonably conclude writes were LIVE when the owner had them off.
export const QBO_CONNECTION_COLUMNS = 'accounting_company_id, name, accounting_token_expires_at, qbo_writes_enabled';

export interface QBSecrets {
  accounting_token: string | null;
  accounting_refresh_token: string | null;
}

/**
 * Read the QB bearer secrets for a business. Prefers the owner-only secrets table;
 * falls back to the legacy businesses columns when the table is absent or has no row yet.
 */
export async function readQBSecrets(db: any, businessId: string): Promise<QBSecrets> {
  try {
    const { data, error } = await db
      .from('business_accounting_secrets')
      .select('accounting_token, accounting_refresh_token')
      .eq('business_id', businessId)
      .maybeSingle();

    if (!error && data && (data.accounting_token || data.accounting_refresh_token)) {
      return {
        accounting_token: data.accounting_token ?? null,
        accounting_refresh_token: data.accounting_refresh_token ?? null,
      };
    }
  } catch {
    // table absent (pre-migration) or transient — fall through to the legacy read
  }

  // Fallback: legacy businesses columns (live pre-migration; NULL post-migration).
  const { data: legacy } = await db
    .from('businesses')
    .select('accounting_token, accounting_refresh_token')
    .eq('id', businessId)
    .maybeSingle();

  return {
    accounting_token: legacy?.accounting_token ?? null,
    accounting_refresh_token: legacy?.accounting_refresh_token ?? null,
  };
}

/**
 * Persist the QB bearer secrets for a business into the owner-only secrets table.
 * Falls back to writing the legacy businesses columns only when the table is absent
 * (pre-migration) — the same exposure that exists today, self-healing once the migration
 * copies the values across and NULLs the businesses columns.
 */
export async function writeQBSecrets(db: any, businessId: string, secrets: QBSecrets): Promise<void> {
  const { error } = await db
    .from('business_accounting_secrets')
    .upsert(
      {
        business_id: businessId,
        accounting_token: secrets.accounting_token,
        accounting_refresh_token: secrets.accounting_refresh_token,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'business_id' },
    );

  if (!error) return;

  // Fallback (pre-migration only): table absent → write legacy columns.
  await db
    .from('businesses')
    .update({
      accounting_token: secrets.accounting_token,
      accounting_refresh_token: secrets.accounting_refresh_token,
    })
    .eq('id', businessId);
}
