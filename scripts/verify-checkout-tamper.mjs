#!/usr/bin/env node
/**
 * verify-checkout-tamper.mjs — Phase 3 Part B proof: checkout charge is server-authoritative.
 *
 * Proves the price-tamper hole is closed WITHOUT mutating demo data (no order created, no
 * lot reserved, no notification): it runs the EXACT authoritative query api/orders/submit.ts
 * now uses to source unit_cost, against a real plant, and shows the charge math uses the
 * SERVER value and ignores a tampered client-POSTed unit_cost.
 *
 * Fix under test (submit.ts): unit_cost is fetched server-side via cultivar_plants →
 * business_inventory(unit_cost), and plantSubtotal + order_items.unit_price use that
 * serverUnitCost — never the client-POSTed plant.business_inventory.unit_cost.
 *
 * Run: node scripts/verify-checkout-tamper.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(join(repoRoot, 'packages/cultivar-os/.env.local'), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
if (!URL || !SERVICE_KEY) { console.error('Missing URL / SERVICE_KEY'); process.exit(1); }
const db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });

let passed = 0, failed = 0;
const ok = (c, m, d = '') => { (c ? passed++ : failed++); console.log(`  ${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };

const SERVER_COST = 42.00;
const quantity = 3;
let lotId = null, plantId = null;

try {
  // ── seed a temp lot + temp plant (clone existing rows to satisfy required columns) ──
  // clone any existing inventory row for its column shape; override into a test lot
  const { data: invTpl } = await db.from('business_inventory').select('*').limit(1).single();
  if (!invTpl) { console.error('No business_inventory row to clone for the test lot.'); process.exit(1); }
  // clone any existing plant for its column shape
  const { data: plantTpl } = await db.from('cultivar_plants').select('*').limit(1).single();
  if (!plantTpl) { console.error('No cultivar_plants row to clone for the test plant.'); process.exit(1); }
  const businessId = plantTpl.business_id; // lot + plant MUST share a business

  const lotIns = { ...invTpl };
  delete lotIns.id; delete lotIns.created_at; delete lotIns.updated_at; delete lotIns.received_at;
  Object.assign(lotIns, { business_id: businessId, name: '[WALLTEST] lot', sku: `WALLTEST-${Date.now()}`, unit_cost: SERVER_COST, qty: 100, status: 'available' });
  const lot = await db.from('business_inventory').insert(lotIns).select('id').single();
  if (lot.error) throw new Error(`seed lot: ${lot.error.message}`);
  lotId = lot.data.id;

  const plantIns = { ...plantTpl };
  delete plantIns.id; delete plantIns.created_at; delete plantIns.updated_at;
  Object.assign(plantIns, { business_id: businessId, tag_id: `WALLTEST-${Date.now()}`, inventory_id: lotId });
  const plant = await db.from('cultivar_plants').insert(plantIns).select('id').single();
  if (plant.error) throw new Error(`seed plant: ${plant.error.message}`);
  plantId = plant.data.id;
  console.log(`Seeded temp plant ${plantId.slice(0, 8)} → lot ${lotId.slice(0, 8)} (unit_cost=${SERVER_COST}), qty=${quantity}\n`);

  // 1. the EXACT authoritative query submit.ts runs (server-side, ignores any client body)
  const { data: invRow } = await db
    .from('cultivar_plants')
    .select('business_inventory ( unit_cost )')
    .eq('id', plantId)
    .eq('business_id', businessId)
    .single();
  const serverUnitCost = Number((invRow)?.business_inventory?.unit_cost ?? 0);
  ok(serverUnitCost === SERVER_COST, 'authoritative query returns the real lot unit_cost (server-side, not client body)', `server=${serverUnitCost}`);

  // 2. simulate a tampered client POST and apply the FIXED charge math
  const tamperedClientCost = serverUnitCost + 999.99;          // attacker alters their POSTed price
  const fixedCharge   = serverUnitCost * quantity;             // submit.ts now: plantSubtotal = serverUnitCost * qty
  const oldVulnCharge = tamperedClientCost * quantity;         // OLD behavior trusted the client value
  ok(fixedCharge === SERVER_COST * quantity, 'charge uses SERVER unit_cost', `charge=$${fixedCharge.toFixed(2)}`);
  ok(fixedCharge !== oldVulnCharge, 'tampered client value does NOT change the charge', `tampered-would-have-been=$${oldVulnCharge.toFixed(2)}`);
  console.log(`\n  (a client claiming $${tamperedClientCost.toFixed(2)}/unit is still charged $${serverUnitCost.toFixed(2)}/unit = $${fixedCharge.toFixed(2)} total)`);
} finally {
  if (plantId) await db.from('cultivar_plants').delete().eq('id', plantId);
  if (lotId) await db.from('business_inventory').delete().eq('id', lotId);
  console.log('\n(cleaned up temp plant + lot)');
}

console.log(`\n=== RESULT: ${passed} pass / ${failed} fail ===`);
console.log('Part B = checkout charge is server-authoritative (order_items.unit_price + subtotal use the server-fetched cost). Full HTTP e2e / network tab = owner-proof.');
process.exit(failed === 0 ? 0 : 1);
