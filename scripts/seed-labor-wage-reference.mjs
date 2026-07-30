#!/usr/bin/env node
/**
 * ── seed-labor-wage-reference — one labour resource + its walled wage row ─────────────
 *
 * PURPOSE:      `labor_resources` AND `labor_resource_wages` were BOTH EMPTY PLATFORM-WIDE
 *               (probed 2026-07-30, service key, every business). The financial wall's GATE 2
 *               proof therefore could not test its ALLOW direction for wages — there were no rows
 *               to become visible — so it sat at 5 pass / 1 fail for an unknown period with
 *               nobody running it. David ruled: SEED THE ROW, do not drop the assertion.
 * DEPENDENCIES: ./lib/memberSession.mjs (env + admin client). Service key: seeding is a
 *               setup act, and `lrw_owner_all` would otherwise require an owner session.
 * OUTPUTS:      one `labor_resources` row + one `labor_resource_wages` row on the target tenant.
 *
 * IDEMPOTENT — re-running finds the existing rows by name and leaves them alone. This is
 * deliberate design, not politeness: the four scripts retired the same day
 * (`scripts/lib/retiredScript.mjs`) became hazards precisely because they were one-shot writers
 * whose second run would have done damage. A seed that is safe to re-run does not rot into a
 * loaded weapon.
 *
 * 🔴 THE NUMBERS BELOW ARE REFERENCE DATA — INVENTED, NOT MEASURED. They are not LAWNS's real
 * wages, not a David ruling, and not derived from any decision doc. They exist so the wall has
 * something to hide and reveal. Nothing may assert their VALUES; the wall test asserts only that
 * a denied session sees NOTHING and a permitted session sees ROWS (STD-025 — capability, not
 * configuration). If real payroll ever lands here, these must be replaced, not added to.
 *
 * WHY THE WAGE COLUMNS ON `labor_resources` STAY NULL: Phase 2 (20260621_financial_wall_phase2)
 * MOVED pay off that table precisely because it is member-readable, leaving the base columns
 * "vestigial (drop in a later gated step)". Writing a wage there would re-open the hole the wall
 * closed — and would break the wall proof's own assertion that base wages read NULL. The pay
 * lives in `labor_resource_wages` and only there.
 *
 * Run: node scripts/seed-labor-wage-reference.mjs [businessId]
 */

import { adminClient, requireBusinessId } from './lib/memberSession.mjs';

const admin = adminClient();
const businessId = await requireBusinessId(process.argv[2] || process.env.RLS_BUSINESS_ID);

const RESOURCE_NAME = 'Yard Crew (reference)';

// 🔴 INVENTED reference figures — see the header. Plausible, not measured.
const WAGES = {
  base_wage: 18.00,   // $/hr before burden
  burden: 4.50,       // $/hr employer burden
  cost_rate: 22.50,   // base_wage + burden — the TRUE cost
  bill_rate: 45.00,   // $/hr charged out; margin lives above cost_rate
  rate: null,                    // EMPLOYEE, not CONTRACTOR
  pass_through_expenses: null,   // ditto
};

console.log(`\n── seeding reference labour on ${businessId.slice(0, 8)} ──\n`);

const existing = await admin.from('labor_resources')
  .select('id').eq('business_id', businessId).eq('name', RESOURCE_NAME).maybeSingle();

let resourceId = existing.data?.id ?? null;

if (resourceId) {
  console.log(`  · labor_resources "${RESOURCE_NAME}" already present (${resourceId.slice(0, 8)}) — reusing`);
} else {
  const { data, error } = await admin.from('labor_resources').insert({
    business_id: businessId,
    resource_type: 'EMPLOYEE',
    rate_basis: 'HOURLY',
    name: RESOURCE_NAME,
    // base_wage / burden / cost_rate / bill_rate DELIBERATELY OMITTED — see the header.
  }).select('id').single();
  if (error) { console.error('  ✗ labor_resources insert failed:', error.message); process.exit(1); }
  resourceId = data.id;
  console.log(`  ✓ labor_resources created (${resourceId.slice(0, 8)}) — EMPLOYEE / HOURLY, wage columns NULL`);
}

const wageRow = await admin.from('labor_resource_wages')
  .select('resource_id').eq('resource_id', resourceId).maybeSingle();

if (wageRow.data) {
  console.log('  · labor_resource_wages row already present — leaving it alone');
} else {
  const { error } = await admin.from('labor_resource_wages').insert({
    resource_id: resourceId,
    business_id: businessId,
    ...WAGES,
  });
  if (error) { console.error('  ✗ labor_resource_wages insert failed:', error.message); process.exit(1); }
  console.log('  ✓ labor_resource_wages created — cost_rate 22.50, bill_rate 45.00 (walled)');
}

// Prove the split held: the value must NOT have landed on the member-readable table.
const check = await admin.from('labor_resources')
  .select('base_wage,cost_rate,bill_rate,rate').eq('id', resourceId).single();
const leaked = Object.entries(check.data ?? {}).filter(([, v]) => v != null);
if (leaked.length > 0) {
  console.error(`\n  ✗ WALL BREACH: wage values are on labor_resources: ${JSON.stringify(Object.fromEntries(leaked))}`);
  process.exit(1);
}
console.log('  ✓ verified: labor_resources carries NO wage value — the Phase 2 split holds\n');
