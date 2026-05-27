-- Migration: Add SELECT RLS policy for orders table
-- Date: 2026-05-27
-- Reason: Dashboard loadMetrics() uses anon key client, which is subject to RLS.
-- Without a SELECT policy, queries return empty arrays silently.
-- This matches the pattern established by the modules and nursery_modules SELECT
-- policies added on 2026-05-22.
-- Discovered during 2026-05-27 pre-LAWNS dry-run when "Today's Sales" tile
-- showed 0 after a successful test order. Investigation report:
-- docs/dashboard-today-sales-investigation-2026-05-27.md

CREATE POLICY "authenticated_select_orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (true);

NOTE: Per existing pattern documented in CLAUDE.md Tech Debt Log, this is
intentionally loose RLS (any authenticated user can read any orders row).
Tighten to owner_id join post-demo once nurseries.owner_id is populated
for all rows. See nursery_modules RLS policy for reference pattern.
