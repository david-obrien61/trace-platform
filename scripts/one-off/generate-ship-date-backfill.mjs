// ============================================================
// generate-ship-date-backfill — rebuild the ShipDate backfill from a QuickBooks export
//
// PURPOSE:      ledger #392. Produces the 603-pair BEGIN…COMMIT that restores QuickBooks
//               Invoice.ShipDate onto `orders.ship_date`, keyed on qb_invoice_id.
//
// 🔴 THE GENERATED FILE IS NOT COMMITTED, AND THAT IS DELIBERATE. It carries 603 invoice ids and
//    dates out of a customer's books; David's instruction was to keep export data out of the repo.
//    This generator is committed instead, so the file is REPRODUCIBLE from the export without the
//    data living in git. Run it, hand the output to David, delete it.
//
// 🔴 IT REFUSES A SHORT READ. If the parsed row count does not equal the export's own
//    `retrieved_total`, it throws rather than emitting a backfill computed off a partial page —
//    a backfill silently missing rows is worse than no backfill (§6 r24's family).
//
// USAGE:        node scripts/one-off/generate-ship-date-backfill.mjs
//               (expects ~/Downloads/24SepLawns/qbo-invoices-*.json and live DB credentials)
// ============================================================
import { page } from './w1.mjs';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const DIR='/Users/terrenceobrien/Downloads/24SepLawns';
const d=JSON.parse(readFileSync(`${DIR}/${readdirSync(DIR).find(x=>x.startsWith('qbo-invoices-'))}`,'utf8'));
let rows=[]; for(const p of d.pages){ const b=typeof p.body==='string'?JSON.parse(p.body):p.body; rows=rows.concat(b.QueryResponse?.Invoice||[]); }
if(rows.length!==d.retrieved_total) throw new Error('parse shortfall');
const B='ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const orders=await page(`orders?business_id=eq.${B}&order_kind=eq.history&select=qb_invoice_id`);
const ours=new Set(orders.map(o=>String(o.qb_invoice_id)).filter(x=>x&&x!=='null'));
const pairs=rows.filter(r=>r.ShipDate && ours.has(String(r.Id))).map(r=>[String(r.Id), r.ShipDate]);
if(!pairs.every(([id,dt])=>/^\d+$/.test(id) && /^\d{4}-\d{2}-\d{2}$/.test(dt))) throw new Error('unexpected id/date shape');
const vals=pairs.map(([id,dt])=>`    ('${id}', DATE '${dt}')`).join(',\n');
const sql=`-- ============================================================================================
-- BACKFILL — QuickBooks ShipDate onto orders.ship_date
--   ledger #392 · source: QB export 2026-09-24 (~/Downloads/24SepLawns, queried_at
--   ${d.queried_at}, complete=${d.complete}, ${d.retrieved_total} of ${d.expected_total} invoices)
--
-- 🔴 A SNAPSHOT, NOT LIVE (Rule 25). Every figure here is "QB export 2026-09-24". The final reload
--    still runs through the live connection; this recovers what today's history is missing.
--
-- 🔴 ONE TRANSACTION, AND IT REFUSES RATHER THAN NO-OPS. A backfill that matches nothing and
--    reports success is §6 r24's failure mode as a migration — so the pre-flight RAISES if the
--    column is absent or if nothing matches, and the run reports matched and updated SEPARATELY.
--
-- ROWS: ${pairs.length} invoice→ShipDate pairs, every one already matched to an existing order by
--    qb_invoice_id. Measured: 1,503 of 1,546 history orders carry a qb_invoice_id and ALL 1,503
--    match an export invoice (zero unmatched); 900 matched invoices simply have no ShipDate in
--    QuickBooks, and 43 orders carry no qb_invoice_id at all and cannot be matched by any key.
-- ============================================================================================
BEGIN;

DO $backfill$
DECLARE
  v_biz uuid;
  v_matched int;
  v_updated int;
BEGIN
  SELECT id INTO v_biz FROM public.businesses WHERE name ILIKE 'LAWNS%' LIMIT 1;
  IF v_biz IS NULL THEN RAISE EXCEPTION 'BACKFILL REFUSED — no LAWNS business row'; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='orders' AND column_name='ship_date') THEN
    RAISE EXCEPTION 'BACKFILL REFUSED — orders.ship_date does not exist; apply 20260923j first';
  END IF;

  CREATE TEMP TABLE _ship(qb_id text PRIMARY KEY, ship date) ON COMMIT DROP;
  INSERT INTO _ship (qb_id, ship) VALUES
${vals};

  SELECT count(*) INTO v_matched
    FROM public.orders o JOIN _ship s ON s.qb_id = o.qb_invoice_id
   WHERE o.business_id = v_biz;
  IF v_matched = 0 THEN
    RAISE EXCEPTION 'BACKFILL REFUSED — 0 of % pairs matched an order. A run that matches nothing is not a success.', (SELECT count(*) FROM _ship);
  END IF;

  UPDATE public.orders o SET ship_date = s.ship
    FROM _ship s
   WHERE s.qb_id = o.qb_invoice_id
     AND o.business_id = v_biz
     AND o.ship_date IS DISTINCT FROM s.ship;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RAISE NOTICE 'BACKFILL OK — pairs %, matched %, updated % (matched-but-unchanged % were already correct)',
    (SELECT count(*) FROM _ship), v_matched, v_updated, v_matched - v_updated;
END $backfill$;

COMMIT;

-- VERIFY, after COMMIT. Shape and run-time reads only — no pinned live counts (§6 r26).
-- SELECT count(*) FILTER (WHERE ship_date IS NOT NULL) AS ship_date_set,
--        count(*)                                      AS history_orders,
--        min(ship_date) AS earliest, max(ship_date) AS latest
--   FROM public.orders
--  WHERE business_id = (SELECT id FROM public.businesses WHERE name ILIKE 'LAWNS%' LIMIT 1)
--    AND order_kind = 'history';
`;
writeFileSync('/tmp/claude-501/backfill_ship_date.sql', sql);
console.log(`generated ${pairs.length} pairs  ·  ${sql.length} bytes`);
console.log(`date range in the pairs: ${pairs.map(p=>p[1]).sort()[0]} .. ${pairs.map(p=>p[1]).sort().slice(-1)[0]}`);
