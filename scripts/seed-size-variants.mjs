/**
 * ── SIZE-VARIANT PICKER FIXTURE (count-side L5 size-picker) ────────────────────
 *
 * PURPOSE: Seed ONE clearly-tagged FIXTURE variety stocked in 3 sizes (same name,
 *   same variant_group, distinct size) PLUS one single-size control row, so the
 *   count-side size-picker can be owner-proven on a phone, then removed via --clear.
 *   The 3 size siblings reproduce the same-name multi-size collision that used to
 *   regress to AMBIGUOUS→UNKNOWN (#61); the control proves the single-match path is
 *   unchanged. ADDED rows only — real LAWNS catalog rows are never touched.
 *
 * DEPENDENCIES: packages/cultivar-os/.env.local (SUPABASE_URL + SUPABASE_SERVICE_KEY).
 *   Table: business_inventory (live, tenant-scoped; size/variant_group cols from
 *   migration 20260628 must be applied — they are).
 *
 * OUTPUTS: idempotent seed() / clear() for one business_id. EXACT-removal markers
 *   (clear deletes ONLY these, never real rows):
 *     business_inventory.variant_group = 'fixture:size-picker'   (the 3 siblings)
 *     business_inventory.sku           LIKE 'FIXTURE-%'          (siblings + control)
 *
 * SCOPE: writes go ONLY to the one --business id (tenant isolation, AC-3). The size
 *   feature's real per-size catalog population is SEPARATE and NOT done here.
 *
 * Instrumentation: emits [TRACE:SEED] (seed/clear/verify with counts). ON by default.
 *
 * Usage:
 *   node scripts/seed-size-variants.mjs --business=<uuid>          # clear+seed (idempotent)
 *   node scripts/seed-size-variants.mjs --business=<uuid> --clear  # clear only
 *   node scripts/seed-size-variants.mjs --business=<uuid> --verify # round-trip proof, then clear
 *   (no --business → uses VITE_DEMO_BUSINESS_ID — the #61 demo nursery)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync(new URL('../packages/cultivar-os/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

const arg  = (k) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : null; };
const flag = (k) => process.argv.includes(`--${k}`);
// Default = the #61 demo nursery ("Test Dave's Tree Nest", the discovery-populated
// catalog the size-picker is owner-proven against). Override with --business=<uuid>.
const BUSINESS = arg('business') || 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b';

const trace = (phase, extra = {}) =>
  console.log(JSON.stringify({ tag: '[TRACE:SEED]', phase, business: BUSINESS, ...extra }));

const GROUP = 'fixture:size-picker';
const SKU_PREFIX = 'FIXTURE-';

// 3 size siblings (one variety, one group, distinct size) + 1 single-size control.
const PICKER_NAME  = 'Fixture Picker Shrub';
const CONTROL_NAME = 'Fixture Single Oak';
const SIBLINGS = [
  { sku: 'FIXTURE-PS-07G', name: PICKER_NAME, size: '7 gal',  variant_group: GROUP, qty: 7  },
  { sku: 'FIXTURE-PS-15G', name: PICKER_NAME, size: '15 gal', variant_group: GROUP, qty: 15 },
  { sku: 'FIXTURE-PS-30G', name: PICKER_NAME, size: '30 gal', variant_group: GROUP, qty: 30 },
];
const CONTROL = { sku: 'FIXTURE-CTL-01', name: CONTROL_NAME, size: null, variant_group: null, qty: 22 };

// ── resolve predicates — MIRROR the canonical source (do not let drift) ───────────
//   nameTokenSet / tokenSetsEqual  → packages/shared/src/utils/canonicalName.ts
//   detectSizeCollision            → packages/cultivar-os/src/pages/InventoryCount.tsx
const BOTANICAL_CONNECTORS = new Set(['var', 'ssp', 'subsp', 'cv']);
function nameTokenSet(raw) {
  if (raw == null) return new Set();
  const cleaned = String(raw).toLowerCase().replace(/&amp;|&/g, ' ').replace(/[^a-z0-9]+/g, ' ');
  return new Set(cleaned.split(/\s+/).filter(Boolean)
    .filter(t => t !== 'amp').filter(t => t.length > 1).filter(t => !BOTANICAL_CONNECTORS.has(t)));
}
function tokenSetsEqual(a, b) { if (a.size !== b.size) return false; for (const t of a) if (!b.has(t)) return false; return true; }
function detectSizeCollision(matches) {
  if (matches.length < 2) return false;
  const group = matches[0].variant_group;
  if (group == null || String(group).trim() === '') return false;
  if (!matches.every(m => m.variant_group === group)) return false;
  const sizes = matches.map(m => (m.size ?? '').trim());
  if (sizes.some(s => s === '')) return false;
  return new Set(sizes).size === matches.length;
}

// ── lifecycle ─────────────────────────────────────────────────────────────────
async function clear() {
  // Marker-scoped delete: the fixture group OR any FIXTURE- sku, this business only.
  const { data, error } = await sb.from('business_inventory')
    .delete()
    .eq('business_id', BUSINESS)
    .or(`variant_group.eq.${GROUP},sku.like.${SKU_PREFIX}%`)
    .select('id');
  if (error) { console.error('[TRACE:SEED] clear FAILED', error); process.exit(1); }
  trace('clear', { removed: data?.length ?? 0 });
  return data?.length ?? 0;
}

async function seed() {
  const rows = [...SIBLINGS, CONTROL].map(r => ({
    business_id: BUSINESS, status: 'available',
    sku: r.sku, name: r.name, size: r.size, variant_group: r.variant_group, qty: r.qty,
    notes: '[FIXTURE] size-picker owner-prove — remove with --clear',
  }));
  const { data, error } = await sb.from('business_inventory').insert(rows).select('id, sku, size, qty');
  if (error) { console.error('[TRACE:SEED] seed FAILED', error); process.exit(1); }
  trace('seed', { inserted: data.length, siblings: SIBLINGS.length, control: 1 });
  return data;
}

// Count REAL (non-fixture) rows for this business — must be invariant across seed/clear.
async function realRowCount() {
  const { count } = await sb.from('business_inventory')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', BUSINESS)
    .not('sku', 'like', `${SKU_PREFIX}%`)
    .or(`variant_group.is.null,variant_group.neq.${GROUP}`);
  return count ?? 0;
}

async function verify() {
  let pass = 0, fail = 0;
  const ok  = (n, cond, detail = '') => { cond ? pass++ : fail++; console.log(`  ${cond ? '✅' : '❌'} ${n}${detail ? ' — ' + detail : ''}`); };

  await clear();                                   // clean slate
  const realBefore = await realRowCount();
  await seed();

  // Read back the fixture rows the way the resolver does.
  const { data: rows } = await sb.from('business_inventory')
    .select('id, name, sku, qty, size, variant_group')
    .eq('business_id', BUSINESS)
    .like('sku', `${SKU_PREFIX}%`);

  // (A) collision path — scanning the variety slug returns the 3 siblings → size collision.
  const pickerKey = nameTokenSet('fixture-picker-shrub');
  const pMatches = rows.filter(r => tokenSetsEqual(nameTokenSet(r.name), pickerKey));
  ok('(A) variety slug token-matches the 3 siblings', pMatches.length === 3, `matched ${pMatches.length}`);
  ok('(A) detectSizeCollision → TRUE (one group, distinct sizes)', detectSizeCollision(pMatches));
  const sizes = pMatches.map(m => (m.size ?? '').trim()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  ok('(A) picker offers the 3 distinct sizes', JSON.stringify(sizes) === JSON.stringify(['7 gal', '15 gal', '30 gal']), sizes.join(' / '));

  // (B) pick a size → qty lands on THAT per-size row only; siblings unchanged.
  const chosen = pMatches.find(m => (m.size ?? '').trim() === '15 gal');
  await sb.from('business_inventory').update({ qty: 99 }).eq('id', chosen.id).eq('business_id', BUSINESS);
  const { data: after } = await sb.from('business_inventory')
    .select('id, size, qty').eq('business_id', BUSINESS).eq('variant_group', GROUP);
  const chosenAfter   = after.find(r => r.id === chosen.id);
  const siblingsAfter = after.filter(r => r.id !== chosen.id);
  ok('(B) chosen per-size row (15 gal) updated to 99', chosenAfter.qty === 99);
  ok('(B) sibling sizes untouched (7→7, 30→30)',
     siblingsAfter.every(r => (r.size === '7 gal' && r.qty === 7) || (r.size === '30 gal' && r.qty === 30)),
     siblingsAfter.map(r => `${r.size}:${r.qty}`).join(' '));

  // (C) NO-REGRESSION — single-size control slug → exactly 1 match → no picker (#61 path).
  const ctlKey = nameTokenSet('fixture-single-oak');
  const cMatches = rows.filter(r => tokenSetsEqual(nameTokenSet(r.name), ctlKey));
  ok('(C) single-size control → exactly 1 match (resolves direct, no picker)', cMatches.length === 1, `matched ${cMatches.length}`);
  ok('(C) detectSizeCollision on 1 match → FALSE', detectSizeCollision(cMatches) === false);

  // (D) reversible — clear removes exactly the fixtures, real rows invariant.
  const removed = await clear();
  const { data: leftover } = await sb.from('business_inventory')
    .select('id').eq('business_id', BUSINESS).or(`variant_group.eq.${GROUP},sku.like.${SKU_PREFIX}%`);
  const realAfter = await realRowCount();
  ok('(D) clear removed all 4 fixture rows', removed === 4 && (leftover?.length ?? 0) === 0, `removed ${removed}, leftover ${leftover?.length ?? 0}`);
  ok('(D) real catalog rows untouched (count invariant)', realBefore === realAfter, `before ${realBefore} / after ${realAfter}`);

  console.log(`\n[TRACE:SEED] verify — ${pass}/${pass + fail} PASS`);
  process.exit(fail === 0 ? 0 : 1);
}

// ── entry ─────────────────────────────────────────────────────────────────────
if (flag('verify'))      { await verify(); }
else if (flag('clear'))  { await clear(); }
else                     { await clear(); await seed(); }   // idempotent reseed
