/**
 * ── measure-vendor-chain-applied — READ-ONLY census of the applied vendor chain ─────
 *
 * PURPOSE:      Prove, from the live catalog rather than from a report, that
 *               20260902_vendor_identity_and_preference.sql and
 *               20260902b_vendor_preferences_join_on_vendor_id.sql are applied and that
 *               R-50 held — no stored receipt was retro-classified to a vendor. Also
 *               re-measures the receipts population, because #259 quoted 36 as a fixed
 *               figure and it had already moved to 37 (R-26's shape).
 * DEPENDENCIES: SUPABASE_URL + SUPABASE_SERVICE_KEY from .env.local (root or cultivar-os);
 *               @supabase/supabase-js. Must run from the repo root so node_modules resolves.
 * OUTPUTS:      A measure/population table on stdout. WRITES NOTHING — every call is a
 *               .select() or an auth admin LIST. No insert, no update, no delete, no rpc.
 *
 * Every count states the POPULATION it was taken over, and the empty-table reads are
 * backed by a NEGATIVE CONTROL: a table that does not exist must error (PGRST205), so
 * "0 rows" is proven to be a real read rather than a failed one ([[R-33]] — a check that
 * cannot disagree is not a check).
 *
 * Run: node scripts/measure-vendor-chain-applied.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const CANDIDATES = [
  '/Users/terrenceobrien/Desktop/trace-platform/.env.local',
  '/Users/terrenceobrien/Desktop/trace-platform/packages/cultivar-os/.env.local',
];
for (const p of CANDIDATES) {
  let text = ''; try { text = readFileSync(p, 'utf8'); } catch { continue; }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    const v = m && m[2].replace(/^["']|["']$/g, '');
    if (m && v && !process.env[m[1]]) process.env[m[1]] = v;
  }
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const { data: r, error } = await db.from('receipts')
  .select('id,business_id,vendor,date,amount,status,created_at,vendor_id,uploaded_by')
  .order('created_at', { ascending: false });
if (error) { console.error('receipts read FAILED:', error.message); process.exit(1); }
console.log(`\n── RECEIPTS CENSUS ── population: ${r.length} rows read, ALL tenants\n`);

const { data: biz } = await db.from('businesses').select('id,name');
const name = id => (biz || []).find(b => b.id === id)?.name ?? '(unknown business)';

const byBiz = {};
for (const row of r) (byBiz[row.business_id] ||= []).push(row);
console.log('PER-TENANT (population: %d rows):', r.length);
for (const [id, rows] of Object.entries(byBiz)) {
  console.log(`  ${name(id).padEnd(28)} ${String(rows.length).padStart(3)}  newest capture ${rows[0].created_at}`);
}

console.log('\nNEWEST 4 ROWS ACROSS ALL TENANTS (population: %d):', r.length);
for (const row of r.slice(0, 4)) {
  console.log(`  ${row.created_at}  ${name(row.business_id).padEnd(24)} vendor=${JSON.stringify(row.vendor)} amount=${row.amount} status=${row.status} id=${row.id.slice(0,8)} uploaded_by=${row.uploaded_by ? row.uploaded_by.slice(0,8) : 'NULL'}`);
}

// R-50 assertion, restated with its population
const unresolved = r.filter(x => x.vendor_id === null).length;
console.log(`\nR-50 CHECK: vendor_id IS NULL on ${unresolved} of ${r.length} receipts (population: ${r.length} rows read)`);

// the chain's new tables
for (const t of ['vendors', 'vendor_aliases', 'vendor_preferences']) {
  const { data, error: e } = await db.from(t).select('id', { count: 'exact' });
  console.log(`  ${t.padEnd(20)} ${e ? 'READ FAILED: ' + e.message : `${data.length} rows`}`);
}
// negative control: a table that does not exist must read as an error, so ABSENT is distinguishable
const { error: nc } = await db.from('vendors_does_not_exist').select('id');
console.log(`  NEGATIVE CONTROL      ${nc ? 'a missing table errors (' + nc.code + ') — so "0 rows" above is a real read' : '🔴 no error — reads are NOT trustworthy'}`);

// the view from 20260902b
const { data: v, error: ve } = await db.from('vendor_preferences_resolved').select('*');
console.log(`  vendor_preferences_resolved  ${ve ? 'READ FAILED: ' + ve.message : `${v.length} rows, no error`}`);
console.log('\n── end ──');

// ── who captured the 37th row, and is it attributable to an owner test? ──
const { data: m } = await db.from('business_members').select('user_id,business_id,role,active');
const { data: users } = await db.auth.admin.listUsers({ perPage: 200 });
const who = id => (users?.users || []).find(u => u.id === id)?.email ?? '(no auth row)';
console.log('\nUPLOADER IDENTITY (population: %d auth users, %d memberships):', users?.users?.length ?? 0, m?.length ?? 0);
for (const uid of ['95c1b2e9', '790b31d2']) {
  const full = (users?.users || []).find(u => u.id.startsWith(uid));
  const roles = (m || []).filter(x => x.user_id === full?.id).map(x => `${x.role}${x.active ? '' : ' (inactive)'}`);
  console.log(`  ${uid}…  ${full ? who(full.id) : 'NOT FOUND'}  roles: ${roles.join(', ') || 'none'}`);
}
// audit trail around the 37th row — did an owner test touch it?
const { data: a, error: ae } = await db.from('audit_log')
  .select('action,created_at,actor_user_id')
  .gte('created_at', '2026-09-02T00:00:00Z').order('created_at', { ascending: false }).limit(20);
console.log(`\nAUDIT SINCE 2026-09-02 (population: ${ae ? 'READ FAILED ' + ae.message : a.length + ' rows'}):`);
for (const x of (a || [])) console.log(`  ${x.created_at}  ${x.action}`);

// ── image types, so the PDF card's population is corrected with a number not a hedge ──
const { data: imgs } = await db.from('receipts').select('id,business_id,image_url');
const isPdf = u => typeof u === 'string' && u.toLowerCase().includes('.pdf');
const LAWNS = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
console.log(`\nCAPTURE FORMAT (population: ${imgs.length} rows, all tenants):`);
console.log(`  PDFs, all tenants   ${imgs.filter(x => isPdf(x.image_url)).length} of ${imgs.length}`);
const lawns = imgs.filter(x => x.business_id === LAWNS);
console.log(`  PDFs, LAWNS         ${lawns.filter(x => isPdf(x.image_url)).length} of ${lawns.length}`);
console.log(`  null image_url      ${imgs.filter(x => !x.image_url).length} of ${imgs.length}`);
