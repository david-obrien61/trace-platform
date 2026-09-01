/**
 * ── measure-receipts-view — READ-ONLY census of the receipts read path ──────────────
 *
 * PURPOSE:      Re-measure, at close-out, every figure the 2026-09-01 recon reported as a
 *               snapshot, so the as-built records the drift rather than carrying a stale
 *               number forward as a fact. Lauren is still uploading; a snapshot is a
 *               snapshot.
 * DEPENDENCIES: SUPABASE_URL + SUPABASE_SERVICE_KEY from .env.local (root or cultivar-os);
 *               @supabase/supabase-js.
 * OUTPUTS:      A measure/population table on stdout. WRITES NOTHING — every call is
 *               .select(). No insert, no update, no delete, no rpc.
 *
 * Every count states the POPULATION it was taken over (rows examined), not only the rows
 * that matched: a pass over an empty set is a failure, not a pass.
 *
 * Run: node scripts/measure-receipts-view.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// Env loading mirrors scripts/find-org-duplicates.mjs. Extra path: this build runs in a git
// worktree, whose root carries no .env.local — fall through to the primary checkout.
const CANDIDATES = [
  new URL('../.env.local', import.meta.url).pathname,
  new URL('../packages/cultivar-os/.env.local', import.meta.url).pathname,
  '/Users/terrenceobrien/Desktop/trace-platform/.env.local',
  '/Users/terrenceobrien/Desktop/trace-platform/packages/cultivar-os/.env.local',
];
for (const p of CANDIDATES) {
  let text = '';
  try { text = readFileSync(p, 'utf8'); } catch { continue; }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    const v = m && m[2].replace(/^["']|["']$/g, '');
    if (m && v && !process.env[m[1]]) process.env[m[1]] = v;
  }
}
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY — cannot measure.'); process.exit(2); }
const db = createClient(url, key);

const LAWNS = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const dist = (rows, f) => {
  const out = {};
  for (const r of rows) { const k = String(f(r)); out[k] = (out[k] ?? 0) + 1; }
  return Object.entries(out).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`).join(' · ');
};
const line = (label, value, population) =>
  console.log(`  ${label.padEnd(52)} ${String(value).padEnd(34)} (population: ${population})`);

const die = (what, err) => { console.error(`READ FAILED — ${what}: ${err.message}`); process.exit(1); };

console.log(`\n── RECEIPTS READ PATH — measured ${new Date().toISOString()} ──\n`);

// ── receipts ────────────────────────────────────────────────────────────────────────
const { data: allReceipts, error: e1 } = await db
  .from('receipts')
  .select('id, business_id, vendor, date, amount, category, created_at, status, reconcile_status, reconcile_delta, reconcile_overridden_at, accept_vs_edit, amount_original, header_amount_edited');
if (e1) die('receipts', e1);
const lawns = allReceipts.filter(r => r.business_id === LAWNS);

line('receipts rows, ALL tenants', allReceipts.length, `${allReceipts.length} rows read`);
line('receipts rows, LAWNS', lawns.length, `${allReceipts.length} rows read`);
line('vendor distribution, LAWNS', dist(lawns, r => r.vendor ?? '(null)'), `${lawns.length} LAWNS rows`);
line('reconcile_status distribution, LAWNS', dist(lawns, r => r.reconcile_status ?? '(null)'), `${lawns.length} LAWNS rows`);
line('reconcile_delta zero, LAWNS', lawns.filter(r => Number(r.reconcile_delta) === 0).length, `${lawns.length} LAWNS rows`);
line('reconcile_delta NULL, LAWNS', lawns.filter(r => r.reconcile_delta === null).length, `${lawns.length} LAWNS rows`);
line('accept_vs_edit distribution, LAWNS', dist(lawns, r => r.accept_vs_edit ?? '(null)'), `${lawns.length} LAWNS rows`);
line('reconcile_overridden_at populated, LAWNS', lawns.filter(r => r.reconcile_overridden_at).length, `${lawns.length} LAWNS rows`);
line('amount_original populated, LAWNS', lawns.filter(r => r.amount_original !== null).length, `${lawns.length} LAWNS rows`);
line('header_amount_edited=true, LAWNS', lawns.filter(r => r.header_amount_edited === true).length, `${lawns.length} LAWNS rows`);
line('status distribution, LAWNS', dist(lawns, r => r.status ?? '(null)'), `${lawns.length} LAWNS rows`);

// Does receipts carry ANY origin / shape / source column? Measured, not assumed: read one row
// and enumerate its keys. A migration grep says what SHOULD be there; this says what IS.
const keys = allReceipts.length ? Object.keys(allReceipts[0]).sort() : [];
const originish = ['origin', 'shape', 'source', 'doc_type', 'document_type', 'kind'];
const { data: probeRow, error: eProbe } = await db.from('receipts').select('*').limit(1);
if (eProbe) die('receipts *', eProbe);
const realKeys = probeRow?.length ? Object.keys(probeRow[0]).sort() : keys;
line('receipts columns (live)', realKeys.join(','), `${probeRow?.length ?? 0} row(s) via select *`);
line('origin/shape/source column present?',
  originish.filter(k => realKeys.includes(k)).join(',') || 'NONE',
  `${realKeys.length} live columns examined`);

// ── duplicate pairs by content key ──────────────────────────────────────────────────
const bucket = {};
for (const r of lawns) {
  const k = `${(r.vendor ?? '').trim().toLowerCase()}|${r.date ?? ''}|${Number(r.amount ?? 0).toFixed(2)}`;
  (bucket[k] ??= []).push(r);
}
const dupes = Object.entries(bucket).filter(([, rows]) => rows.length > 1);
line('duplicate groups by (vendor,date,amount), LAWNS', dupes.length, `${lawns.length} LAWNS rows bucketed`);
for (const [k, rows] of dupes) console.log(`        · ${k} → ${rows.length} receipts [${rows.map(r => r.id.slice(0, 8)).join(', ')}]`);

// ── orders ──────────────────────────────────────────────────────────────────────────
const { data: orders, error: e2 } = await db
  .from('orders')
  .select('id, business_id, receipt_id, order_kind, status, total_amount, sale_date, source_document_number')
  .eq('business_id', LAWNS);
if (e2) die('orders', e2);
const byReceipt = new Map();
for (const o of orders) if (o.receipt_id) { const a = byReceipt.get(o.receipt_id) ?? []; a.push(o); byReceipt.set(o.receipt_id, a); }
const withOrder = lawns.filter(r => byReceipt.has(r.id));
line('LAWNS orders total', orders.length, `${orders.length} LAWNS orders read`);
line('orders carrying a receipt_id', orders.filter(o => o.receipt_id).length, `${orders.length} LAWNS orders`);
line('receipts that produced an order, LAWNS', withOrder.length, `${lawns.length} LAWNS receipts`);
line('receipts that produced NO order, LAWNS', lawns.length - withOrder.length, `${lawns.length} LAWNS receipts`);
line('receipts with >1 order, LAWNS', lawns.filter(r => (byReceipt.get(r.id) ?? []).length > 1).length, `${lawns.length} LAWNS receipts`);
const receiptOrders = orders.filter(o => o.receipt_id);
line('order kinds produced (receipt-linked)', dist(receiptOrders, o => `${o.order_kind ?? '(null)'}/${o.status ?? '(null)'}`), `${receiptOrders.length} receipt-linked orders`);

// ── deliveries ──────────────────────────────────────────────────────────────────────
const { data: deliveries, error: e3 } = await db
  .from('deliveries')
  .select('id, business_id, order_id, delivery_date, status, service_type, source')
  .eq('business_id', LAWNS);
if (e3) die('deliveries', e3);
const ocr = deliveries.filter(d => d.source === 'ocr-invoice');
line('LAWNS deliveries total', deliveries.length, `${deliveries.length} LAWNS deliveries read`);
line("deliveries source='ocr-invoice'", ocr.length, `${deliveries.length} LAWNS deliveries`);
line('…of those, delivery_date NULL', ocr.filter(d => !d.delivery_date).length, `${ocr.length} ocr-invoice deliveries`);
line('deliveries carrying an order_id', deliveries.filter(d => d.order_id).length, `${deliveries.length} LAWNS deliveries`);
line('delivery source distribution', dist(deliveries, d => d.source ?? '(null)'), `${deliveries.length} LAWNS deliveries`);
line('delivery status distribution', dist(deliveries, d => d.status ?? '(null)'), `${deliveries.length} LAWNS deliveries`);

// ── the two other receipt_id seams ──────────────────────────────────────────────────
for (const [tbl] of [['cost_objects'], ['business_inventory']]) {
  const { data, error } = await db.from(tbl).select('id, receipt_id').eq('business_id', LAWNS);
  if (error) { console.log(`  ${tbl}: READ FAILED — ${error.message}`); continue; }
  line(`${tbl}.receipt_id populated, LAWNS`, data.filter(r => r.receipt_id).length, `${data.length} LAWNS ${tbl} rows`);
}

console.log('\n── end ──\n');
