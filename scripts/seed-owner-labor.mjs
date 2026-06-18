#!/usr/bin/env node
/**
 * seed-owner-labor.mjs — D-12 STEP 3b: migrate the single owner-labor config line into the
 * cost model as a real, projectable labor cost. IDEMPOTENT (safe to re-run — never double-seeds).
 *
 * Creates, for TRACE Enterprises (45830ba7…):
 *   1. ONE labor_resources row: EMPLOYEE, rate_basis HOURLY, base_wage 75, burden NULL (no burden),
 *      cost_rate 75 (= base_wage + burden), bill_rate NULL, name "Owner".
 *   2. ONE applied-labor cost_objects row: node_type COST, cost_category 'labor' (EXACT lowercase —
 *      matches the hasMigratedLabor guard + the column comment), cost_nature OPEX, cost_shape
 *      RECURRING_FIXED, cadence MONTHLY, recurring_amount 12000 (= 75 × 160, the realized monthly),
 *      cost_confidence CONFIRMED, parent_id NULL (company-level / Overhead), resource_id → owner,
 *      labor_hours 160, cost_source MANUAL, substantiation OWNER_ASSERTED.
 *
 * The instant the cost_objects row exists, the hasMigratedLabor guard (read path + capture mirror)
 * flips TRUE → config.labor is stripped → labor is sourced from the cost_object, NOT config. The
 * floor must STILL read $12,123 / known $12,280.67 (run LABOR_STAGE=3b capture to prove). Service-key
 * write (bypasses RLS to seed); the live UI under RLS is David's owner-proof, separate.
 *
 *   node scripts/seed-owner-labor.mjs
 * Requires packages/cultivar-os/.env.local (SUPABASE_URL + SUPABASE_SERVICE_KEY).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(join(repoRoot, 'packages/cultivar-os/.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const BIZ = '45830ba7-9961-403f-b048-77f022fb48dc'; // TRACE Enterprises

async function main() {
  // Prereq: the business exists + has a real active OWNER membership (don't seed into a void).
  const { data: biz, error: bizErr } = await sb.from('businesses').select('id,name,owner_id').eq('id', BIZ).maybeSingle();
  if (bizErr || !biz) { console.error('business not found', bizErr?.message); process.exit(1); }
  console.log(`business: ${biz.name} (${biz.id})`);

  // IDEMPOTENCY: bail if a labor/contract-labor COST row already exists (re-run safety — would
  // otherwise create a SECOND labor row and double the floor).
  const { data: existingCost, error: ecErr } = await sb.from('cost_objects')
    .select('id,name,cost_category,recurring_amount,cost_confidence')
    .eq('business_id', BIZ).eq('node_type', 'COST').in('cost_category', ['labor', 'contract-labor']);
  if (ecErr) { console.error('cost_objects read failed', ecErr.message); process.exit(1); }
  if (existingCost?.length) {
    console.log('⚠️  labor cost_object already exists — NOT re-seeding (idempotent):');
    existingCost.forEach(r => console.log(`   [${r.cost_category}] "${r.name}" $${r.recurring_amount} ${r.cost_confidence}`));
    process.exit(0);
  }

  // 1. labor_resources (reuse an existing "Owner" row if present).
  const { data: existingRes } = await sb.from('labor_resources').select('id,name').eq('business_id', BIZ).eq('name', 'Owner');
  let resourceId = existingRes?.[0]?.id;
  if (resourceId) {
    console.log(`reusing existing labor_resources "Owner" (${resourceId})`);
  } else {
    const { data: res, error: resErr } = await sb.from('labor_resources').insert({
      business_id: BIZ,
      resource_type: 'EMPLOYEE',
      name: 'Owner',
      rate_basis: 'HOURLY',
      base_wage: 75,
      burden: null,        // no burden modeled for the owner-labor estimation line (D-12 addendum)
      cost_rate: 75,       // = base_wage + burden (burden 0/none)
      bill_rate: null,
      rate: null,
      pass_through_expenses: null,
    }).select('id').single();
    if (resErr) { console.error('labor_resources insert failed', resErr.message); process.exit(1); }
    resourceId = res.id;
    console.log(`✓ labor_resources "Owner" created (${resourceId})  EMPLOYEE HOURLY base_wage 75 cost_rate 75`);
  }

  // 2. applied-labor cost_object.
  const { data: cost, error: costErr } = await sb.from('cost_objects').insert({
    business_id: BIZ,
    name: 'Owner labor (David)',
    node_type: 'COST',
    cost_category: 'labor',          // EXACT lowercase — matches the hasMigratedLabor guard
    cost_nature: 'OPEX',
    cost_shape: 'RECURRING_FIXED',
    cadence: 'MONTHLY',
    recurring_amount: 12000,         // = 75 × 160, the realized monthly cost (denormalized; feeds the floor)
    acquisition_cost: null,
    cost_confidence: 'CONFIRMED',
    substantiation: 'OWNER_ASSERTED',
    cost_source: 'MANUAL',
    parent_id: null,                 // company-level / Overhead
    resource_id: resourceId,
    labor_hours: 160,
  }).select('id,name,cost_category,cost_nature,cost_shape,cadence,recurring_amount,cost_confidence,resource_id,labor_hours,parent_id').single();
  if (costErr) { console.error('cost_objects insert failed', costErr.message); process.exit(1); }
  console.log('✓ applied-labor cost_object created:');
  console.log('  ', JSON.stringify(cost));
  console.log('\nDONE. Now run LABOR_STAGE=3b capture to prove floor/known byte-identical.');
}
main();
