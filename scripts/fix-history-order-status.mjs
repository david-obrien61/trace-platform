#!/usr/bin/env node
/**
 * fix-history-order-status.mjs
 * ═══════════════════════════════════════════════════════════════════════════════
 * PURPOSE:      Correct history orders written with a hardcoded `fulfilled` status so that each
 *               one FOLLOWS ITS DELIVERY: complete → fulfilled, otherwise → confirmed.
 * DEPENDENCIES: SUPABASE_PAT in the shell. Reads the same rule the writers use, restated here
 *               only because a .mjs script cannot import the TypeScript module (see note below).
 * OUTPUTS:      DRY RUN by default. Writes only with --apply.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 WHY THIS SCRIPT EXISTS. Eight orders shipped reading `fulfilled` while their own delivery rows
 * read `scheduled` — four of them for a Saturday that had not happened yet and one for a date three
 * weeks out. The status was chosen for a MECHANICAL reason (`holdsCommitment()` excludes exactly
 * `fulfilled` and `cancelled`) and nobody checked whether it was a true statement about the world.
 *
 * 🔴 AND WHY THE CHECK AT THE END IS THE REAL DELIVERABLE. `confirmed` DOES hold a commitment in the
 * D-52 derivation. Moving these orders onto it is safe for exactly ONE reason — every history line
 * carries a NULL `business_inventory_id` — so that invariant stops being belt-and-braces and becomes
 * the only thing keeping eight orders out of available-to-sell. The script therefore REFUSES to
 * write if any history line carries a lot id, and re-proves availability across every lot after.
 */
import { sql } from './lib/pgQuery.mjs';

const TENANT = process.env.TENANT_ID || 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const APPLY  = process.argv.includes('--apply');
const P = s => console.log(s);

// ⚠️ RESTATED, NOT FORKED. The rule lives in packages/shared/src/business-logic/historyOrder.ts;
// this file is .mjs and cannot import TypeScript. Kept to the two literal lists so a drift is
// visible at a glance, and the probe below asserts the outcome rather than trusting the copy.
const DELIVERY_COMPLETE = ['complete', 'completed', 'delivered', 'fulfilled', 'done'];
const statusFor = ds => (ds && DELIVERY_COMPLETE.includes(String(ds).trim().toLowerCase()))
  ? 'fulfilled' : 'confirmed';

async function availability() {
  return sql(`
    SELECT bi.id::text lot, COALESCE(bi.qty,0)::int on_hand,
      COALESCE((SELECT sum(oi.quantity)::int FROM public.order_items oi
                JOIN public.orders o ON o.id = oi.order_id
                WHERE oi.business_inventory_id = bi.id
                  AND o.status NOT IN ('fulfilled','cancelled')), 0) committed
    FROM public.business_inventory bi WHERE bi.business_id = '${TENANT}' ORDER BY bi.id;`);
}

// ── the refusal, BEFORE anything is read for writing ──────────────────────────
const leaked = await sql(`SELECT count(*)::int n FROM public.order_items i
  JOIN public.orders o ON o.id = i.order_id
  WHERE o.order_kind = 'history' AND i.business_inventory_id IS NOT NULL;`);
if (leaked[0].n > 0) {
  P(`🔴 STOP — ${leaked[0].n} history line(s) carry a business_inventory_id.`);
  P('   Moving these orders to `confirmed` would put them INTO the committed-stock derivation and');
  P('   silently reduce available-to-sell. Fix the lines first. Nothing written.');
  process.exit(1);
}
P(`✅ GUARD: zero history lines carry a lot id — \`confirmed\` cannot reach available-to-sell.\n`);

const before = await availability();

const rows = await sql(`
  SELECT o.id::text, o.status ostatus, o.sale_date::text sd, o.source_document_number docn,
         c.first_name f, c.last_name l,
         d.id::text did, d.delivery_date::text dd, d.status dstatus
  FROM public.orders o
  JOIN public.customers c ON c.id = o.customer_id
  LEFT JOIN public.deliveries d ON d.order_id = o.id
  WHERE o.business_id = '${TENANT}' AND o.order_kind = 'history'
  ORDER BY d.delivery_date NULLS LAST;`);

P(`${APPLY ? '🔴 APPLY' : 'DRY RUN (no writes)'} — ${rows.length} history orders\n`);
P('customer                   #doc       delivery     deliv.status  status: now  →  correct');
P('─'.repeat(100));
const plan = [];
for (const r of rows) {
  const want = statusFor(r.dstatus);
  const change = want !== r.ostatus;
  if (change) plan.push({ id: r.id, want, who: [r.f, r.l].filter(Boolean).join(' ') });
  P(`${String([r.f,r.l].filter(Boolean).join(' ')).padEnd(26)} ${String(r.docn).padEnd(10)} ${String(r.dd ?? '(none)').padEnd(12)} ${String(r.dstatus ?? '(no row)').padEnd(13)} ${String(r.ostatus).padEnd(11)} ${change ? '→  ' + want : '=  (unchanged)'}`);
}
P(`\n  ${plan.length} of ${rows.length} need correcting.`);

if (!APPLY) { P('\nDRY RUN — nothing written. Re-run with --apply.'); process.exit(0); }

P('\nWRITING');
for (const p of plan) {
  const r = await sql(`UPDATE public.orders SET status = '${p.want}'
    WHERE id = '${p.id}' AND business_id = '${TENANT}' RETURNING id::text, status;`);
  if (r.length !== 1) { P(`  🔴 ${p.who}: affected ${r.length} rows, expected 1`); process.exit(1); }
  P(`  ✅ ${p.who.padEnd(26)} → ${r[0].status}`);
}

// ── 🔴 RE-PROVE. The last pass's acceptance test passed and two defects shipped anyway. ──
const after = await availability();
const key = s => s.map(r => `${r.lot}:${r.on_hand}:${r.committed}`).join('|');
const moved = after.filter((a, i) => a.on_hand !== before[i].on_hand || a.committed !== before[i].committed);
P(`\n🔴 AVAILABLE-TO-SELL RE-PROOF (${before.length} lots)`);
P(`  committed before: ${before.reduce((a,r)=>a+r.committed,0)}   after: ${after.reduce((a,r)=>a+r.committed,0)}`);
P(`  lots whose availability MOVED: ${moved.length} ${moved.length === 0 ? '✅' : '🔴'}`);
P(`  snapshot identical: ${key(before) === key(after) ? '✅ YES' : '🔴 NO'}`);
const still = await sql(`SELECT count(*)::int n FROM public.order_items i JOIN public.orders o ON o.id=i.order_id
  WHERE o.order_kind='history' AND i.business_inventory_id IS NOT NULL;`);
P(`  history lines carrying a lot id: ${still[0].n} ${still[0].n === 0 ? '✅' : '🔴'}`);
const mismatch = await sql(`SELECT count(*)::int n FROM public.orders o
  LEFT JOIN public.deliveries d ON d.order_id=o.id
  WHERE o.business_id='${TENANT}' AND o.order_kind='history'
    AND o.status <> CASE WHEN lower(coalesce(d.status,'')) IN ('complete','completed','delivered','fulfilled','done')
                         THEN 'fulfilled' ELSE 'confirmed' END;`);
P(`  orders whose status disagrees with their delivery: ${mismatch[0].n} ${mismatch[0].n === 0 ? '✅' : '🔴'}`);
