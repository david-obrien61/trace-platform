#!/usr/bin/env node
/**
 * backfill-recurring-costs.mjs — Unified Cost Model, BUILD step 4: backfill.
 *
 * Migrates recurring cost lines from business_modules.config.locations[].recurring[]
 * into first-class cost_objects rows, LOSSLESSLY:
 *   node_type='COST' · cost_nature='OPEX' · cost_source='MANUAL' ·
 *   cost_shape='RECURRING_FIXED' · cadence←period (monthly→MONTHLY, annual→ANNUAL) ·
 *   recurring_amount←amount (NULL stays NULL — UNKNOWN, NEVER $0) ·
 *   cost_confidence←confidence · substantiation='OWNER_ASSERTED' (typed config = no proof) ·
 *   notes←note · acquisition_cost=NULL (recurring, not capex) · parent_id=NULL (company-level).
 *
 * Labor STAYS in config (R3 — flagged, not migrated this pass).
 *
 * IDEMPOTENT: refuses to run for a tenant that already has node_type='COST' rows
 * (a prior backfill) — prevents double-insert. Re-running is safe (no-op + report).
 *
 * DRY-RUN by default — prints the rows it WOULD insert. Pass --apply to write.
 *   node scripts/backfill-recurring-costs.mjs            # dry run
 *   node scripts/backfill-recurring-costs.mjs --apply    # write (service key, RLS-bypassing)
 *
 * Service key only (DML) — no PAT. Read-only against config; writes only cost_objects.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const APPLY = process.argv.includes('--apply');
const repoRoot = process.cwd();
const env = Object.fromEntries(
  readFileSync(join(repoRoot, 'packages/cultivar-os/.env.local'), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

const CADENCE = { monthly: 'MONTHLY', annual: 'ANNUAL' };

async function main() {
  console.log(`\n=== BACKFILL recurring config → cost_objects  [${APPLY ? 'APPLY' : 'DRY-RUN'}] ===\n`);
  const { data: mods, error } = await sb
    .from('business_modules').select('business_id, config').eq('module_key', 'cost_to_produce');
  if (error) { console.error('business_modules read failed:', error.message); process.exit(1); }

  let totalLines = 0, totalInserted = 0;
  for (const m of mods ?? []) {
    const businessId = m.business_id;
    const cfg = m.config;
    if (!cfg || !Array.isArray(cfg.locations) || !cfg.locations.length) continue;

    // Idempotency guard — skip a tenant that already has COST nodes.
    const { data: existing, error: exErr } = await sb
      .from('cost_objects').select('id', { count: 'exact', head: false })
      .eq('business_id', businessId).eq('node_type', 'COST');
    if (exErr) { console.error(`[${businessId}] guard read failed:`, exErr.message); process.exit(1); }
    if (existing && existing.length) {
      console.log(`[${businessId}] SKIP — already has ${existing.length} COST node(s); refusing double-backfill.`);
      continue;
    }

    // Build one cost_objects row per recurring line (labor excluded — R3).
    const rows = [];
    for (const loc of cfg.locations) {
      for (const line of loc.recurring ?? []) {
        const cadence = CADENCE[line.period] ?? 'MONTHLY';
        rows.push({
          business_id: businessId,
          name: line.label,
          node_type: 'COST',
          cost_nature: 'OPEX',
          cost_source: 'MANUAL',
          cost_shape: 'RECURRING_FIXED',
          cadence,
          // NULL stays NULL (UNKNOWN) — never coerced to 0. A real $0 (e.g. free tier) stays 0.
          recurring_amount: line.amount == null ? null : line.amount,
          cost_confidence: line.confidence,
          substantiation: 'OWNER_ASSERTED',
          acquisition_cost: null,
          parent_id: null,
          notes: line.note ?? null,
        });
      }
    }
    totalLines += rows.length;
    console.log(`[${businessId}] ${rows.length} recurring line(s) → COST rows:`);
    rows.forEach((r) => console.log(
      `   • ${r.name}  $${r.recurring_amount == null ? 'UNKNOWN' : r.recurring_amount}/${r.cadence}  conf=${r.cost_confidence}`));

    if (APPLY) {
      const { data: ins, error: insErr } = await sb.from('cost_objects').insert(rows).select('id');
      if (insErr) { console.error(`[${businessId}] INSERT failed:`, insErr.message); process.exit(1); }
      totalInserted += ins.length;
      console.log(`   ✓ inserted ${ins.length} row(s)`);
    }
  }

  console.log(`\n=== ${APPLY ? `INSERTED ${totalInserted}` : `WOULD INSERT ${totalLines}`} COST row(s) across all tenants ===`);
  if (!APPLY) console.log('   (dry run — re-run with --apply to write)\n');
}
main();
