/**
 * ── seed-uppot-harness — plant the MESS at Test Dave's so the plan can be proven ──────
 *    2026-09-05 · ledger #276
 *
 * 🔴 WHY THIS EXISTS. Measured live at LAWNS on 2026-09-05: **447 lots, 2 with a real count, and
 * each of those two holds ONE TREE.** The smallest variety in David's own workbook is 70 on hand.
 * So the four-way split run against LAWNS returns a delta of zero on every row, and the screen is
 * correctly, uselessly empty. The model cannot be demonstrated on the live catalogue.
 * David's ruling: seed Test Dave's and prove it there.
 *
 * 🔴 AND SEED THE MESS, NOT THE HAPPY PATH — his words. A fixture where every row is clean proves
 * the model works on data we do not have. So this seeds, deliberately:
 *   · three spellings of ONE size — "30 gallon", "30 Gallon", "30G" — which MUST fold to one rung
 *   · a DUPLICATE name+size pair, whose on-hand is split across two rows (six such pairs are live
 *     at LAWNS and the plan must aggregate them or it reads only one)
 *   · a RANGE, "10/15 gallon", which must be SHOWN AND REFUSED rather than assigned an end
 *   · rows with NO COUNT AT ALL, which is 445 of LAWNS's 447 and must not read as zero
 *   · one lot with real stock at every rung, so the pot cascade has something to cascade
 *
 * 🔴 EVERY SEEDED ROW IS TAGGED SO ONE QUERY FINDS THEM ALL. The precedent is
 * `__harness_replay_lot` in `scripts/rls/inventory-ledger-replay.rls.mjs`, and the reason is that
 * Lauren had to clean up after an untagged harness herself. The tag is in `notes`, which no
 * planning path reads.
 *
 * ⚠️ REFUSES TO RUN AGAINST LAWNS. The tenant is hardcoded to Test Dave's and asserted against the
 * business name before a single write. This script inserts stock; pointing it at a real catalogue
 * would be unrecoverable without a hand cleanup.
 *
 * Run:     node scripts/seed-uppot-harness.mjs
 * Remove:  node scripts/seed-uppot-harness.mjs --remove
 */
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const env = {};
for (const line of readFileSync(ROOT + 'packages/cultivar-os/.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const URL_ = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_KEY;
if (!URL_ || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }

const TENANT = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b'; // Test Dave's Tree Nest
const EXPECTED_NAME = "Test Dave's Tree Nest";
const TAG = '__harness_uppot_lot';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const remove = process.argv.includes('--remove');

async function api(path, init) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init?.headers ?? {}) } });
  const body = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) { console.error(`HTTP ${r.status}`, body); process.exit(1); }
  return body;
}

// ── THE GUARD. Assert the tenant BEFORE writing anything. ────────────────────────────
const [biz] = await api(`businesses?select=id,name&id=eq.${TENANT}`);
if (!biz) { console.error('Tenant not found — refusing to write.'); process.exit(1); }
if (biz.name !== EXPECTED_NAME) {
  console.error(`🔴 REFUSING: tenant ${TENANT} is "${biz.name}", not "${EXPECTED_NAME}". This script inserts stock.`);
  process.exit(1);
}
console.log(`TENANT: ${biz.name} (${TENANT})`);

if (remove) {
  const before = await api(`business_inventory?select=id&business_id=eq.${TENANT}&notes=eq.${TAG}`);
  await api(`business_inventory?business_id=eq.${TENANT}&notes=eq.${TAG}`, { method: 'DELETE' });
  const after = await api(`business_inventory?select=id&business_id=eq.${TENANT}&notes=eq.${TAG}`);
  console.log(`REMOVED ${before.length} tagged rows · ${after.length} remain (expect 0)`);
  process.exit(after.length === 0 ? 0 : 1);
}

// name · size · qty · location — the mess is deliberate, see the header.
const ROWS = [
  // the ladder, with real stock at every rung so the cascade has something to cascade
  ['Joan Lionetti Texas Live Oak', '30 gallon', 220, 'Block A'],
  ['Joan Lionetti Texas Live Oak', '45 gallon', 40, 'Block A'],
  ['Lacey Oak', '30 Gallon', 90, 'Block A'],          // ← spelling 2 of the SAME rung
  ['Lacey Oak', '45 gallon', 25, 'Block B'],
  ['Eagleston Holly', '15 gallon', 310, 'Block B'],
  ['Eagleston Holly', '30G', 60, 'Block B'],           // ← spelling 3 of the SAME rung
  ['Colorama Scarlet Crape Myrtle', '15 gallon', 265, 'Block C'],
  ['Brodie Juniper', '3 gallon', 480, 'Block C'],
  ['Brodie Juniper', '15 gallon', 90, 'Block C'],
  ['Bubba Jones Desert Willow', '5 gallon', 120, 'Block D'],
  ['Little Gem Magnolia', '15 gallon', 150, 'Block D'],
  ['Black Pearl Redbud', '30 gallon', 70, 'Block D'],

  // 🔴 THE DUPLICATE PAIR — one physical variety+size, on-hand split across two rows.
  ['Monterrey Oak', '30 gallon', 55, 'Block A'],
  ['Monterrey Oak', '30 Gallon', 40, 'Block E'],

  // 🔴 THE RANGE — must be SHOWN AND REFUSED, never assigned an end.
  ['Mexican Buckeye', '10/15 gallon', 45, 'Block E'],

  // 🔴 NEVER COUNTED — the 445-of-447 case. NULL is not zero.
  ['Cedar Elm', '30 gallon', null, 'Block E'],
  ['Chinquapin Oak', '45 gallon', null, null],
  ['Possumhaw Holly', '15 gallon', null, 'Block F'],
];

const existing = await api(`business_inventory?select=id&business_id=eq.${TENANT}&notes=eq.${TAG}`);
if (existing.length > 0) {
  console.log(`${existing.length} tagged rows already present — run with --remove first. Nothing written.`);
  process.exit(1);
}

const payload = ROWS.map(([name, size, qty, location]) => ({
  business_id: TENANT, name, size, qty, location, notes: TAG,
  status: qty == null ? 'available' : qty > 0 ? 'available' : 'depleted',
  sell_price: 250,
}));

const written = await api('business_inventory', {
  method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload),
});

// 🔴 CHECK THE COUNT. A PostgREST insert refused by policy can return without an error (E5/R-12).
if (written.length !== payload.length) {
  console.error(`🔴 wrote ${written.length} of ${payload.length} — refusing to report success`);
  process.exit(1);
}

console.log(`\nWROTE ${written.length} rows, all tagged notes = ${TAG}`);
console.log(`  · ${ROWS.filter((r) => r[2] === null).length} with NO COUNT (must not read as zero)`);
console.log('  · 3 spellings of thirty ("30 gallon" / "30 Gallon" / "30G") — must fold to ONE rung');
console.log('  · 1 duplicate name+size pair (Monterrey Oak, 30 gallon) — on-hand split across two rows');
console.log('  · 1 range ("10/15 gallon") — must be SHOWN AND REFUSED');
console.log('\n⚠️ THE UNIT PROJECTION HAS NOT RUN ON THESE ROWS. `unit_kind`/`unit_value` are NULL until');
console.log('   `npm run units:backfill` is run, and until then EVERY row refuses as "not read as a');
console.log('   unit yet" — which is the honest state, and is itself worth seeing once.');
console.log('\nRemove with: node scripts/seed-uppot-harness.mjs --remove');
