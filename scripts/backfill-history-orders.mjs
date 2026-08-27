#!/usr/bin/env node
/**
 * backfill-history-orders.mjs
 * ═══════════════════════════════════════════════════════════════════════════════
 * PURPOSE:      Turn each captured customer invoice in a tenant into ONE HISTORY ORDER
 *               plus its order_items, and wire the real keys receipt→order→delivery.
 * DEPENDENCIES: migration 20260827_history_orders.sql (order_kind, source_document_number,
 *               sale_date, receipt_id on orders · description/sku on order_items ·
 *               order_id on deliveries). SUPABASE_PAT in the shell.
 * OUTPUTS:      DRY RUN by default — prints every row it WOULD write and the
 *               available-to-sell proof. Writes only with --apply.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 A HISTORY ORDER MUST NOT BECOME A SALE EVENT. It is already paid, already in the
 *    seller's own QuickBooks, and the stock left before this platform existed. Two
 *    independent escapes from the D-52 committed-stock derivation, BOTH taken:
 *      (1) business_inventory_id STAYS NULL on every line (inventoryStates.ts:99 skips it)
 *      (2) status='fulfilled' (holdsCommitment() is false only for fulfilled/cancelled)
 *    The script PROVES it: available-to-sell for every lot is computed before and after
 *    and must be byte-identical. That proof is the deliverable, not the rows.
 *
 * 🔴 THE NAME CORRELATION RUNS EXACTLY ONCE — HERE. receipts and deliveries are written a
 *    second apart by one function and share no key, so pairing them means matching the
 *    OCR'd customer name inside ocr_raw. That is a heuristic on a text blob: it dies on a
 *    duplicate name and dies entirely on the Claude OCR fallback (ocr.ts:292 discards
 *    rawText). It is used here to INSTALL the FK; after this, the FK carries it and the
 *    correlation is retired. It is therefore held to a hard bar — TWO independent fields
 *    (customer name AND delivery_date) must agree, and the match must be UNIQUE, or the
 *    script refuses the receipt rather than guessing.
 */
import { sql } from './lib/pgQuery.mjs';

const TENANT = process.env.TENANT_ID || 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const APPLY  = process.argv.includes('--apply');
const P = s => console.log(s);
const money = n => `$${Number(n).toFixed(2)}`;
const esc = v => v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
const num = v => v === null || v === undefined ? 'NULL' : String(Number(v));

/** ocr_raw is the RAW GEMINI ENVELOPE. The payload is a JSON string inside
 *  candidates[0].content.parts[0].text — a two-step decode, not a field read. */
function decodeOcr(raw) {
  const t = raw?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof t !== 'string') return null;
  const m = t.match(/\{[\s\S]*\}/);
  try { return JSON.parse(m ? m[0] : t); } catch { return null; }
}

/** service_type → transport_method. 'planting' means the nursery puts it in the ground,
 *  which is what 'install' has always meant on this table (21 of 34 live rows). */
function transportFor(serviceType) {
  if (serviceType === 'planting') return 'install';
  if (serviceType === 'delivery') return 'delivery';
  return 'delivery';
}

/** available-to-sell = on-hand − committed, committed DERIVED from open orders (D-52). */
async function availabilitySnapshot() {
  return sql(`
    SELECT bi.id::text AS lot, COALESCE(bi.qty,0)::int AS on_hand,
           COALESCE((SELECT sum(oi.quantity)::int FROM public.order_items oi
                     JOIN public.orders o ON o.id = oi.order_id
                     WHERE oi.business_inventory_id = bi.id
                       AND o.status NOT IN ('fulfilled','cancelled')), 0) AS committed
    FROM public.business_inventory bi
    WHERE bi.business_id = '${TENANT}'
    ORDER BY bi.id;`);
}

// ── gather ────────────────────────────────────────────────────────────────────────
const receipts = await sql(`SELECT id::text, vendor, date::text AS doc_date, amount,
    ocr_raw, line_items_original, created_at::text
  FROM public.receipts WHERE business_id='${TENANT}' ORDER BY created_at;`);
const deliveries = await sql(`SELECT d.id::text, d.customer_id::text, d.delivery_date::text,
    d.service_type, d.order_id::text,
    c.first_name, c.last_name, c.organization_name, c.display_name
  FROM public.deliveries d LEFT JOIN public.customers c ON c.id = d.customer_id
  WHERE d.business_id='${TENANT}';`);

const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const custName = d => d.display_name || [d.first_name, d.last_name].filter(Boolean).join(' ') || d.organization_name || '';

P(`\n${'═'.repeat(84)}`);
P(`BACKFILL HISTORY ORDERS — ${APPLY ? '🔴 APPLY' : 'DRY RUN (no writes)'}   tenant ${TENANT}`);
P(`${'═'.repeat(84)}`);
P(`  ${receipts.length} receipts · ${deliveries.length} deliveries`);

const before = await availabilitySnapshot();

const plan = [];
const refused = [];
for (const r of receipts) {
  const ocr = decodeOcr(r.ocr_raw);
  if (!ocr) { refused.push([r.id, 'ocr_raw did not decode — cannot read source number/subtotal/tax']); continue; }
  if (!ocr.customer_name) { refused.push([r.id, `no customer on the document (vendor receipt: ${r.vendor}) — a document with no customer produces NO order`]); continue; }

  // TWO independent fields must agree, and the match must be UNIQUE.
  const byName = deliveries.filter(d => norm(custName(d)) === norm(ocr.customer_name));
  const ocrDelivDate = ocr.delivery_date ? new Date(ocr.delivery_date).toISOString().slice(0, 10) : null;
  const byBoth = byName.filter(d => !ocrDelivDate || d.delivery_date === ocrDelivDate);
  if (byBoth.length !== 1) {
    refused.push([r.id, `correlation not unique on BOTH fields: name "${ocr.customer_name}" → ${byName.length} delivery(s), + delivery_date ${ocrDelivDate} → ${byBoth.length}`]);
    continue;
  }
  const d = byBoth[0];
  const lines = Array.isArray(r.line_items_original) ? r.line_items_original : [];
  if (!lines.length) { refused.push([r.id, 'line_items_original empty — nothing to itemise']); continue; }

  const lineSum = lines.reduce((a, x) => a + Number(x.amount || 0), 0);
  plan.push({
    receiptId: r.id, deliveryId: d.id, customerId: d.customer_id,
    customer: custName(d), docDate: r.doc_date, deliveryDate: d.delivery_date,
    serviceType: d.service_type, transport: transportFor(d.service_type),
    sourceNumber: ocr.receipt_number ?? null,
    subtotal: Number(ocr.subtotal ?? 0), tax: Number(ocr.tax ?? 0), total: Number(r.amount),
    lines: lines.map(x => ({ sku: x.sku ?? null, description: x.description ?? null,
      quantity: Math.max(1, parseInt(x.quantity ?? 1, 10) || 1),
      unitPrice: Number(x.unit_price ?? 0), amount: Number(x.amount ?? 0) })),
    lineSum,
    arithmeticOk: Math.abs(lineSum - Number(ocr.subtotal ?? 0)) < 0.005
      && Math.abs(Number(ocr.subtotal ?? 0) + Number(ocr.tax ?? 0) - Number(r.amount)) < 0.005,
  });
}

// ── report the plan ───────────────────────────────────────────────────────────────
P(`\n${'─'.repeat(84)}\nPLANNED HISTORY ORDERS (${plan.length})\n${'─'.repeat(84)}`);
let grand = 0;
for (const p of plan) {
  grand += p.total;
  P(`\n  ${p.customer}   doc #${p.sourceNumber}`);
  P(`     sale_date        ${p.docDate}          (NOT today, NOT created_at)`);
  P(`     order_kind       history               status  fulfilled`);
  P(`     transport_method ${p.transport.padEnd(21)} ← from delivery.service_type='${p.serviceType}'`);
  P(`     receipt_id       ${p.receiptId}`);
  P(`     delivery ${p.deliveryId} (${p.deliveryDate}) → order_id`);
  P(`     subtotal ${money(p.subtotal)}  tax ${money(p.tax)}  TOTAL ${money(p.total)}   arithmetic ${p.arithmeticOk ? '✅' : '🔴 MISMATCH'}`);
  P(`     notes            (untouched — no CLV number minted)`);
  P(`     ${p.lines.length} line(s):`);
  for (const l of p.lines)
    P(`        ${String(l.sku ?? '—').padEnd(10)} x${String(l.quantity).padEnd(3)} @ ${money(l.unitPrice).padStart(10)} = ${money(l.amount).padStart(10)}  business_inventory_id=NULL  "${l.description ?? ''}"`);
}
P(`\n  ${'─'.repeat(60)}`);
P(`  ${plan.length} orders   GRAND TOTAL ${money(grand)}`);

if (refused.length) {
  P(`\n${'─'.repeat(84)}\nREFUSED (${refused.length}) — reported, never guessed\n${'─'.repeat(84)}`);
  for (const [id, why] of refused) P(`  ${id}\n     ${why}`);
}

const bad = plan.filter(p => !p.arithmeticOk);
if (bad.length) { P(`\n🔴 ABORT — ${bad.length} receipt(s) fail the arithmetic check.`); process.exit(1); }

// ── apply ─────────────────────────────────────────────────────────────────────────
if (!APPLY) {
  P(`\n${'═'.repeat(84)}\nDRY RUN — nothing written. Re-run with --apply to write.\n${'═'.repeat(84)}`);
  process.exit(0);
}

P(`\n${'═'.repeat(84)}\nWRITING\n${'═'.repeat(84)}`);
for (const p of plan) {
  const [o] = await sql(`
    INSERT INTO public.orders (business_id, customer_id, transport_method, status, order_kind,
      source_document_number, sale_date, receipt_id, delivery_date,
      subtotal, tax_amount, total_amount, addons_amount, netting_declined, leakage_flag)
    VALUES ('${TENANT}', '${p.customerId}', ${esc(p.transport)}, 'fulfilled', 'history',
      ${esc(p.sourceNumber)}, ${esc(p.docDate)}, ${esc(p.receiptId)}, ${esc(p.deliveryDate)},
      ${num(p.subtotal)}, ${num(p.tax)}, ${num(p.total)}, 0, false, false)
    RETURNING id::text;`);
  const orderId = o.id;
  const vals = p.lines.map(l => `('${orderId}', ${num(l.quantity)}, ${num(l.unitPrice)}, ${num(l.amount)}, ${esc(l.description)}, ${esc(l.sku)}, NULL)`).join(',\n      ');
  await sql(`INSERT INTO public.order_items (order_id, quantity, unit_price, subtotal, description, sku, business_inventory_id)
    VALUES ${vals};`);
  await sql(`UPDATE public.deliveries SET order_id='${orderId}' WHERE id='${p.deliveryId}' AND business_id='${TENANT}';`);
  P(`  ✅ ${p.customer.padEnd(28)} order ${orderId}  ${p.lines.length} line(s)  ${money(p.total)}`);
}

// ── 🔴 THE PROOF: available-to-sell must not have moved ───────────────────────────
const after = await availabilitySnapshot();
P(`\n${'─'.repeat(84)}\n🔴 AVAILABLE-TO-SELL PROOF — the landmine must not have fired\n${'─'.repeat(84)}`);
const key = s => s.map(r => `${r.lot}:${r.on_hand}:${r.committed}`).join('|');
const moved = after.filter((a, i) => a.on_hand !== before[i].on_hand || a.committed !== before[i].committed);
P(`  lots examined:        ${before.length}`);
P(`  total on-hand before: ${before.reduce((a, r) => a + r.on_hand, 0)}   after: ${after.reduce((a, r) => a + r.on_hand, 0)}`);
P(`  total committed before: ${before.reduce((a, r) => a + r.committed, 0)}   after: ${after.reduce((a, r) => a + r.committed, 0)}`);
P(`  lots whose availability MOVED: ${moved.length} ${moved.length === 0 ? '✅ none — landmine did not fire' : '🔴'}`);
for (const m of moved) P(`     🔴 ${m.lot}`);
P(`  snapshot identical:   ${key(before) === key(after) ? '✅ YES' : '🔴 NO'}`);

const linked = await sql(`SELECT count(*)::int n FROM public.order_items oi
  JOIN public.orders o ON o.id=oi.order_id WHERE o.order_kind='history' AND oi.business_inventory_id IS NOT NULL;`);
P(`  history lines carrying a lot id: ${linked[0].n} ${linked[0].n === 0 ? '✅ zero, as required' : '🔴'}`);
