/**
 * ── SANDBOX SEEDER (capability 1.2 — onboarding Phase 2) ───────────────────────
 *
 * PURPOSE: Make a brand-new vertical's dashboard ALIVE on arrival instead of empty.
 *   Seeds a believable, BRANDED 7-day slice of sample sales/activity under the
 *   business's own name (customers, plant inventory, orders incl. a couple of
 *   leakage flags). Every row is LABELLED sample/sandbox so it is unmistakable and
 *   removable — the label "comes off" the moment real data loads (call clear()).
 *
 * DEPENDENCIES: packages/cultivar-os/.env.local (SUPABASE_URL + SUPABASE_SERVICE_KEY).
 *   Tables: customers, cultivar_plants, business_inventory, orders (all live, tenant-scoped).
 *
 * OUTPUTS: idempotent seed() / clear() for one business_id. Markers used for EXACT
 *   removal (clear deletes ONLY these, never real rows):
 *     customers.source        = 'sandbox'
 *     cultivar_plants.tag_id   LIKE 'SMPL-%'   + notes '[SANDBOX] …'
 *     business_inventory.sku   LIKE 'SMPL-%'   + notes '[SANDBOX] …'
 *     orders.notes             LIKE '[SANDBOX]%'
 *
 * Instrumentation: emits [TRACE:SEED] (seed/clear with counts). ON by default.
 *
 * Usage:
 *   node scripts/seed-sandbox.mjs --business=<uuid>          # clear+seed (idempotent)
 *   node scripts/seed-sandbox.mjs --business=<uuid> --clear  # clear only
 *   node scripts/seed-sandbox.mjs --business=<uuid> --verify # seed, count, clear, assert 0
 *   (no --business → uses VITE_DEMO_BUSINESS_ID)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync(new URL('../packages/cultivar-os/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

const arg = (k) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : null; };
const flag = (k) => process.argv.includes(`--${k}`);
const BUSINESS = arg('business') || env.VITE_DEMO_BUSINESS_ID || 'a1b2c3d4-0000-0000-0000-000000000001';

const trace = (phase, extra = {}) =>
  console.log(JSON.stringify({ tag: '[TRACE:SEED]', phase, business: BUSINESS, ...extra }));

// ── believable, branded source material ──────────────────────────────────────────
const CUSTOMERS = [
  ['Marcus', 'Hollis',   'Leander',     '78641', 'tree sales'],
  ['Priya',  'Nandakumar','Cedar Park',  '78613', 'planting'],
  ['Dale',   'Whitfield', 'Liberty Hill','78642', 'tree sales'],
  ['Sofia',  'Reyes',     'Georgetown',  '78628', 'delivery'],
  ['Ben',    'Okafor',    'Leander',     '78641', 'planting'],
  ['Hannah', 'Castellano','Austin',      '78717', 'tree sales'],
];
const PLANTS = [
  ['Lagerstroemia indica \'Natchez\'', 'Natchez Crape Myrtle', '15 gal', 12, 189.0],
  ['Quercus virginiana',               'Texas Live Oak',        '30 gal', 24, 329.0],
  ['Sophora secundiflora',             'Texas Mountain Laurel', '5 gal',  12,  89.0],
  ['Platanus mexicana',                'Mexican Sycamore',      '30 gal', 24, 279.0],
  ['Prosopis glandulosa',              'Honey Mesquite',        '15 gal', 12, 149.0],
];

async function clear() {
  // FK-safe order: orders (→customers) first, then plants (→inventory), then inventory, then customers.
  const counts = {};
  let r;
  r = await sb.from('orders').delete({ count: 'exact' }).eq('business_id', BUSINESS).like('notes', '[SANDBOX]%');
  counts.orders = r.count ?? 0;
  r = await sb.from('cultivar_plants').delete({ count: 'exact' }).eq('business_id', BUSINESS).like('tag_id', 'SMPL-%');
  counts.cultivar_plants = r.count ?? 0;
  r = await sb.from('business_inventory').delete({ count: 'exact' }).eq('business_id', BUSINESS).like('sku', 'SMPL-%');
  counts.business_inventory = r.count ?? 0;
  r = await sb.from('customers').delete({ count: 'exact' }).eq('business_id', BUSINESS).eq('source', 'sandbox');
  counts.customers = r.count ?? 0;
  trace('clear', { removed: counts });
  return counts;
}

async function seed() {
  const { data: biz } = await sb.from('businesses').select('name').eq('id', BUSINESS).maybeSingle();
  const brand = biz?.name || 'this business';
  const stamp = `[SANDBOX] sample data for ${brand} — remove when real data loads`;

  await clear(); // idempotent re-seed

  // customers
  const custRows = CUSTOMERS.map(([fn, ln, city, zip], i) => ({
    business_id: BUSINESS, first_name: fn, last_name: ln,
    email: `${fn.toLowerCase()}.${ln.toLowerCase()}@example-sample.com`,
    phone: `(512) 555-0${(100 + i).toString().padStart(3, '0')}`,
    address_line1: `${100 + i * 7} Sample Oak Dr`, city, state: 'TX', zip,
    marketing_opt_in: i % 2 === 0, source: 'sandbox', lifetime_value: 0,
  }));
  const { data: custs, error: cErr } = await sb.from('customers').insert(custRows).select('id');
  if (cErr) throw new Error(`customers: ${cErr.message}`);

  // plant identity rows + inventory lots (branded sample stock)
  const plantRows = PLANTS.map(([species, common, container, warranty], i) => ({
    business_id: BUSINESS, tag_id: `SMPL-${1001 + i}`, species, common_name: common,
    plant_type: 'tree', current_container: container, location_zone: `Row ${String.fromCharCode(65 + i)}`,
    warranty_months: warranty, notes: stamp,
  }));
  const { error: pErr } = await sb.from('cultivar_plants').insert(plantRows);
  if (pErr) throw new Error(`cultivar_plants: ${pErr.message}`);

  const invRows = PLANTS.map(([species, common, , , cost], i) => ({
    business_id: BUSINESS, sku: `SMPL-${1001 + i}`, name: common, description: species,
    qty: 4 + i * 3, unit_cost: cost, status: 'available', notes: stamp, cost_confidence: 'CONFIRMED',
  }));
  const { error: iErr } = await sb.from('business_inventory').insert(invRows);
  if (iErr) throw new Error(`business_inventory: ${iErr.message}`);

  // orders spread across the last 7 days; 2 leakage flags; varied totals
  const now = Date.now();
  const DAY = 86400000;
  const orderSpec = [
    [0, 1, 920.13, 'self',     false, false],
    [0, 0, 478.00, 'delivery', false, false],
    [1, 2, 1289.50,'self',     true,  true ],   // leakage: large container, no netting
    [2, 3, 329.00, 'self',     false, false],
    [3, 4, 656.25, 'delivery', false, false],
    [4, 5, 189.00, 'self',     false, false],
    [4, 0, 1102.00,'self',     true,  true ],   // leakage
    [5, 1, 547.80, 'delivery', false, false],
    [5, 2, 268.00, 'self',     false, false],
    [6, 3, 832.40, 'self',     false, false],
    [6, 4, 415.00, 'delivery', false, false],
    [6, 5, 158.50, 'self',     false, false],
  ];
  const orderRows = orderSpec.map(([daysAgo, ci, total, transport, leak, nettingDeclined], i) => {
    const subtotal = +(total / 1.0825).toFixed(2);
    const tax = +(total - subtotal).toFixed(2);
    const createdAt = new Date(now - daysAgo * DAY - i * 1800000).toISOString();
    return {
      business_id: BUSINESS, customer_id: custs[ci].id,
      transport_method: transport, netting_declined: nettingDeclined,
      transport_note: transport === 'self'
        ? (nettingDeclined ? 'Customer self-transport — netting declined' : 'Customer self-transport')
        : 'Nursery delivery',
      subtotal, tax_amount: tax, addons_amount: 0, total_amount: total,
      status: daysAgo <= 1 ? 'pending' : 'invoiced', leakage_flag: leak,
      notes: stamp, created_at: createdAt,
    };
  });
  const { error: oErr } = await sb.from('orders').insert(orderRows);
  if (oErr) throw new Error(`orders: ${oErr.message}`);

  const counts = { customers: custRows.length, cultivar_plants: plantRows.length, business_inventory: invRows.length, orders: orderRows.length };
  trace('seed', { brand, inserted: counts });
  return counts;
}

async function countSandbox() {
  const c = {};
  c.customers = (await sb.from('customers').select('id', { count: 'exact', head: true }).eq('business_id', BUSINESS).eq('source', 'sandbox')).count ?? 0;
  c.cultivar_plants = (await sb.from('cultivar_plants').select('id', { count: 'exact', head: true }).eq('business_id', BUSINESS).like('tag_id', 'SMPL-%')).count ?? 0;
  c.business_inventory = (await sb.from('business_inventory').select('id', { count: 'exact', head: true }).eq('business_id', BUSINESS).like('sku', 'SMPL-%')).count ?? 0;
  c.orders = (await sb.from('orders').select('id', { count: 'exact', head: true }).eq('business_id', BUSINESS).like('notes', '[SANDBOX]%')).count ?? 0;
  return c;
}

// ── run ────────────────────────────────────────────────────────────────────────
if (flag('clear')) {
  await clear();
  console.log('Cleared sandbox rows for', BUSINESS);
} else if (flag('verify')) {
  // count real rows BEFORE → seed → count sandbox → clear → assert sandbox 0 AND real unchanged
  const realBefore = {
    customers: (await sb.from('customers').select('id', { count: 'exact', head: true }).eq('business_id', BUSINESS).neq('source', 'sandbox')).count ?? 0,
    orders: (await sb.from('orders').select('id', { count: 'exact', head: true }).eq('business_id', BUSINESS).not('notes', 'like', '[SANDBOX]%')).count ?? 0,
  };
  const seeded = await seed();
  const after = await countSandbox();
  await clear();
  const post = await countSandbox();
  const realAfter = {
    customers: (await sb.from('customers').select('id', { count: 'exact', head: true }).eq('business_id', BUSINESS).neq('source', 'sandbox')).count ?? 0,
    orders: (await sb.from('orders').select('id', { count: 'exact', head: true }).eq('business_id', BUSINESS).not('notes', 'like', '[SANDBOX]%')).count ?? 0,
  };
  const seededOk = seeded.orders === after.orders && after.orders > 0;
  const clearedOk = Object.values(post).every(v => v === 0);
  const realOk = realBefore.customers === realAfter.customers && realBefore.orders === realAfter.orders;
  console.log('\n=== VERIFY ===');
  console.log('seeded   :', JSON.stringify(seeded));
  console.log('counted  :', JSON.stringify(after), seededOk ? '✓ seeded rows present' : '✗ mismatch');
  console.log('post-clear:', JSON.stringify(post), clearedOk ? '✓ exactly zero remain' : '✗ residue');
  console.log('real rows :', `before ${JSON.stringify(realBefore)} → after ${JSON.stringify(realAfter)}`, realOk ? '✓ real data untouched' : '✗ real data changed!');
  process.exit(seededOk && clearedOk && realOk ? 0 : 1);
} else {
  const counts = await seed();
  console.log('Seeded sandbox for', BUSINESS, JSON.stringify(counts));
}
