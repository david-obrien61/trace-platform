// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      EXECUTE 20260921 against real Postgres (PGlite, WASM) and prove the sharpened
//               R-165: the undo DELETES the load's history orders and their lines, and STILL
//               REFUSES on a live capture. Reading the SQL is not evidence that it runs — the
//               first draft of this migration carried a duplicated `$function$;` terminator and
//               would have failed on paste; only executing it found that.
// DEPENDENCIES: PGLITE_DIR pointing at a node_modules holding @electric-sql/pglite.
// OUTPUTS:      pass/fail per probe; exit 1 on any failure, 2 if PGlite is unavailable.
// ⚠️ NOT in `npm run verify` — PGlite is Postgres 18, Supabase runs an older major (the standing
//    reason recorded on the other harnesses in this folder).
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
const pgliteDir = process.env.PGLITE_DIR;
if (!pgliteDir) { console.error('Set PGLITE_DIR to a node_modules folder containing @electric-sql/pglite.'); process.exit(2); }
const { PGlite } = await import(pgliteDir.replace(/\/$/, '') + '/@electric-sql/pglite/dist/index.js');

const MIG = process.cwd() + '/supabase/migrations/';
const M = f => readFileSync(MIG + f, 'utf8');
const C16_FILE = '20260916c_practice_orders_and_one_unit_undo.sql';
const C16 = existsSync(MIG + C16_FILE) ? M(C16_FILE)
  : execSync(`git show origin/fix/rehearsal-never-writes-the-record:supabase/migrations/${C16_FILE}`, { encoding: 'utf8' });
const MINE_FILE = '20260921_history_lines_qbo_item_and_undo_exempt.sql';
const RELINK_FILE = '20260921b_capture_relink.sql';

const L = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const RUN = '11111111-1111-1111-1111-111111111111';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

async function fresh(mineSql) {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE businesses (id uuid PRIMARY KEY, qbo_writes_enabled boolean DEFAULT true);
    INSERT INTO businesses (id) VALUES ('${L}');
    CREATE FUNCTION public.is_active_member(uuid) RETURNS boolean LANGUAGE sql AS 'select true';
    CREATE FUNCTION public.has_permission(uuid, text) RETURNS boolean LANGUAGE sql AS 'select true';
    CREATE FUNCTION public.set_updated_at_generic() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $f$;
    CREATE TABLE customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id),
      import_run_id uuid, first_name text, last_name text, phone text, email text, billing_line1 text, billing_line2 text, billing_city text,
      billing_state text, billing_zip text, address_line1 text,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT '2020-01-01');
    CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
    CREATE TABLE business_inventory (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL,
      name text, qb_item_id text, import_run_id uuid, retired_at timestamptz, retired_reason text, retired_by_run_id uuid, created_at timestamptz DEFAULT now());
    -- 🔴 THE NOT NULL SET IS COPIED FROM THE LIVE SCHEMA, NOT INVENTED (tech-debt #357).
    -- The first version of this harness declared customer_id and transport_method NULLABLE.
    -- LIVE REQUIRES BOTH. So 19 probes passed against a double MORE FORGIVING THAN THE REAL
    -- THING, and the same probes pasted into the SQL editor died on 23502 before reaching the
    -- undo at all — R-33's exact class, inside a build that quotes R-33. Source:
    -- scripts/sql-harness/fixtures/live-schema-public.sql, CREATE TABLE public.orders.
    CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id uuid NOT NULL,
      customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
      transport_method text NOT NULL,
      netting_declined boolean NOT NULL DEFAULT false,
      subtotal numeric(10,2) NOT NULL DEFAULT 0,
      tax_amount numeric(10,2) NOT NULL DEFAULT 0,
      total_amount numeric(10,2) NOT NULL DEFAULT 0,
      addons_amount numeric(10,2) NOT NULL DEFAULT 0,
      status text NOT NULL,
      leakage_flag boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      tax_exempt_applied boolean NOT NULL DEFAULT false,
      order_kind text, import_run_id uuid);
    CREATE TABLE order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      quantity integer NOT NULL,
      unit_price numeric(10,2) NOT NULL,
      subtotal numeric(10,2) NOT NULL,
      is_manual_override boolean NOT NULL DEFAULT false,
      sku text, description text,
      business_inventory_id uuid REFERENCES business_inventory(id) ON DELETE SET NULL);
    CREATE TABLE order_compliance_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES orders(id));
    CREATE TABLE order_service_selections (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES orders(id));
    CREATE TABLE deliveries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL,
      customer_id uuid REFERENCES customers(id) ON DELETE SET NULL, order_id uuid REFERENCES orders(id) ON DELETE SET NULL);
    CREATE TABLE business_inventory_ledger (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid,
      inventory_id uuid REFERENCES business_inventory(id) ON DELETE SET NULL);
  `);
  await db.exec(M('20260911b_customer_addresses.sql'));
  await db.exec(C16);
  await db.exec(M('20260915_contact_record.sql'));
  await db.exec(M('20260916d_contact_rows_leave_with_their_run.sql'));
  await db.exec(M('20260917b_undo_takes_test_mode_edits.sql'));
  let err = null;
  try { await db.exec(mineSql); } catch (e) { err = String(e.message).slice(0, 200); await db.exec('ROLLBACK').catch(() => {}); }
  return { db, err };
}
const one = async (db, q) => Object.values((await db.query(q)).rows[0])[0];
const n = async (db, q) => Number(await one(db, q));
const undo = async (db, run = RUN) => await one(db, `SELECT public.undo_import_run('${L}','${run}')`);

// A customer belonging to the load, so the undo has something to try to delete.
const seedCustomer = async db => await one(db,
  `INSERT INTO customers (business_id, import_run_id, first_name) VALUES ('${L}','${RUN}','Load') RETURNING id`);

console.log('\n── 20260921 · the load\'s history leaves with it ──────────────────────────────\n');

// ── A · IT RUNS AT ALL. The duplicated terminator the first draft carried dies here.
{ const { err } = await fresh(M(MINE_FILE));
  ok(err === null, 'A1 the migration EXECUTES on real Postgres ' + (err ?? '')); }

// ── B · THE COLUMN
{ const { db } = await fresh(M(MINE_FILE));
  ok(await one(db, `select data_type from information_schema.columns where table_name='order_items' and column_name='qbo_item_id'`) === 'text',
     'B1 order_items.qbo_item_id exists and is text');
  ok(await one(db, `select is_nullable from information_schema.columns where table_name='order_items' and column_name='qbo_item_id'`) === 'YES',
     'B2 nullable — an OCR line has no QuickBooks id and NULL is the honest value');
  ok(await one(db, `select column_default is null from information_schema.columns where table_name='order_items' and column_name='qbo_item_id'`) === true,
     'B3 no default — a default would assert a fact about rows this migration never read (A9)');
  ok(await n(db, `select count(*) from pg_indexes where indexname='order_items_qbo_item_idx'`) === 1,
     'B4 the partial index exists'); }

// ── C · THE UNDO DELETES THE LOAD'S HISTORY, AND KEEPS EVERY LIVE CAPTURE
{ const { db } = await fresh(M(MINE_FILE));
  const c = await seedCustomer(db);
  const hist = await one(db, `INSERT INTO orders (business_id, customer_id, transport_method, status, order_kind, import_run_id)
                              VALUES ('${L}','${c}','delivery','fulfilled','history','${RUN}') RETURNING id`);
  await db.exec(`INSERT INTO order_items (order_id, quantity, unit_price, subtotal, is_manual_override, qbo_item_id)
                 VALUES ('${hist}', 3, 100, 300, false, '99');`);
  // A LIVE CAPTURE on its own customer — it must not make the undo refuse, and must survive it.
  // 🔴 ITS OWN CUSTOMER, OUTSIDE THE RUN — and that is not a workaround for NOT NULL, it is
  // what the probe always meant: an OCR capture on a RUN customer must make the undo REFUSE
  // (that is D1). To prove it SURVIVES a completed undo it has to sit on a customer the undo
  // does not delete. The first version hid this by leaving customer_id NULL, which live forbids.
  const outside = await one(db, `INSERT INTO customers (business_id, import_run_id, first_name)
                                 VALUES ('${L}',NULL,'Outside') RETURNING id`);
  const ocr = await one(db, `INSERT INTO orders (business_id, customer_id, transport_method, status, order_kind, import_run_id)
                             VALUES ('${L}','${outside}','delivery','fulfilled','history',NULL) RETURNING id`);

  const res = await undo(db);
  ok(res.refused === false, 'C1 the undo did NOT refuse — the load\'s history is deleted, not blocking');
  ok(Number(res.history_orders_deleted) === 1, `C2 it reports history_orders_deleted = 1 (got ${res.history_orders_deleted})`);
  ok(Number(res.history_lines_deleted) === 1, `C3 and history_lines_deleted = 1 (got ${res.history_lines_deleted})`);
  ok(await n(db, `select count(*) from orders where id='${hist}'`) === 0,
     'C4 🔴 THE LOAD\'S HISTORY ORDER IS GONE — the claim the previous draft never made');
  ok(await n(db, `select count(*) from order_items where order_id='${hist}'`) === 0, 'C5 and its lines with it');
  ok(await n(db, `select count(*) from orders where id='${ocr}'`) === 1,
     'C6 🔴 THE OCR CAPTURE SURVIVED — R-160: only live captures are never removed');
  ok(await n(db, `select count(*) from customers where id='${c}'`) === 0,
     'C7 and the customer it pointed at was deleted, which RESTRICT would have blocked'); }

// ── D · IT STILL REFUSES ON A LIVE CAPTURE THAT SITS ON A LOAD CUSTOMER
{ const { db } = await fresh(M(MINE_FILE));
  const c = await seedCustomer(db);
  await db.exec(`INSERT INTO orders (business_id, customer_id, transport_method, status, order_kind, import_run_id)
                 VALUES ('${L}','${c}','delivery','fulfilled','history',NULL);`);   // an OCR capture
  const res = await undo(db);
  ok(res.refused === true, 'D1 🔴 REFUSES on an OCR capture — the 25 rows R-160 protects');
  ok(Number(res.live_orders) === 1, `D2 and it NAMES it in live_orders (got ${res.live_orders})`);
  ok(await n(db, `select count(*) from customers where id='${c}'`) === 1, 'D3 nothing was deleted'); }

// ── E · AND ON A GENUINE LIVE ORDER (the second probe R-165's guard cell owes)
{ const { db } = await fresh(M(MINE_FILE));
  const c = await seedCustomer(db);
  await db.exec(`INSERT INTO orders (business_id, customer_id, transport_method, status, order_kind, import_run_id)
                 VALUES ('${L}','${c}','delivery','invoiced',NULL,NULL);`);  // a real checkout sale
  const res = await undo(db);
  ok(res.refused === true, 'E1 REFUSES on a live checkout order — the exemption is not a blanket'); }

// ── F · 🔴 THE MUTANT. `=` instead of `IS NOT DISTINCT FROM` reads identically and silently stops
//        the undo refusing on every OCR capture, because NULL = <run> is NULL, not false.
{ const mutant = M(MINE_FILE).replace(
    "AND NOT (o.order_kind IS NOT DISTINCT FROM 'history' AND o.import_run_id IS NOT DISTINCT FROM p_run_id);",
    "AND NOT (o.order_kind = 'history' AND o.import_run_id = p_run_id);");
  ok(mutant !== M(MINE_FILE), 'F0 the mutant actually changed the file — the probe can reach its target (#182)');
  const { db } = await fresh(mutant);
  const c = await seedCustomer(db);
  const ocr = await one(db, `INSERT INTO orders (business_id, customer_id, transport_method, status, order_kind, import_run_id)
                             VALUES ('${L}','${c}','delivery','fulfilled','history',NULL) RETURNING id`);
  let refused = null, threw = null;
  try { refused = (await undo(db)).refused; } catch (e) { threw = String(e.message).slice(0, 120); }
  ok(refused === false || threw !== null,
     `F1 🔴 UNDER THE MUTANT THE PROTECTION IS GONE — refused=${refused} threw=${threw ?? 'no'}`);
  ok(!(refused === true), 'F2 so D1 is a real assertion: it FAILS when the null-safe form is removed'); }


// ── G · 🔴 THE V-BLOCKS DAVID PASTES ARE EXECUTED HERE, NOT JUST READ (ledger #363).
//        This morning the first V5–V7 were handed over unvalidated and died on 23502 before
//        reaching the undo. Nothing goes to the SQL editor again without being run first.
//        The file under test is the one in David's folder, read from disk.
{
  const { readFileSync: rf } = await import('node:fs');
  const path = '/Users/terrenceobrien/Desktop/trace-platform/V5-V7-results-363.sql';
  let file = null;
  try { file = rf(path, 'utf8'); } catch { /* not present */ }
  ok(file !== null, 'G0 the hand-over file exists at the path David was given');
  if (file) {
    const blocks = file.split(/^DO \$verify\$/m).slice(1)
      .map(b => 'DO $verify$' + b.split('$verify$;')[0] + '$verify$;');
    ok(blocks.length === 3, `G1 three DO blocks parsed (got ${blocks.length})`);
    const BIZ = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
    for (let i = 0; i < blocks.length; i++) {
      const { db } = await fresh(M(MINE_FILE));
      // the file is written against LAWNS' id; this harness uses the same constant, so no rewrite
      let msg = null;
      try { await db.exec(blocks[i]); } catch (e) { msg = String(e.message); }
      const v = 'V' + (5 + i);
      ok(msg !== null, `G2.${v} the block raised, as designed (it rolls itself back)`);
      ok(!!msg && msg.includes(`${v} PASSED`),
         `G3.${v} 🔴 and the message reads "${v} PASSED" — the verdict is IN THE ERROR, where the editor shows it. Got: ${String(msg).slice(0, 150)}`);
      ok(!!msg && !msg.includes('FAILED'), `G4.${v} and it does NOT read FAILED`);
    }
  }
}


// ── H · 🔴 THE HARNESS CHECKS ITS OWN SCHEMA AGAINST THE LIVE ONE (tech-debt #357).
//        This is the durable answer to the defect that cost a round trip this morning: instead of
//        a human comparing two files, the harness DERIVES live's NOT NULL set from
//        fixtures/live-schema-public.sql and fails if it does not enforce every one of them.
//        It cannot drift, because nothing here is written down twice.
//        ⚠️ IT CHECKS THE TABLES THIS HARNESS WRITES TO, not all of them — customers,
//        business_inventory and deliveries are still hand-rolled and still short of live. That is
//        #357's open half and it is NOT silently passed over: the count is printed.
{
  const { readFileSync: rf } = await import('node:fs');
  const fixture = rf(process.cwd() + '/scripts/sql-harness/fixtures/live-schema-public.sql', 'utf8');
  const L = rf(process.cwd() + '/scripts/sql-harness/history-undo-363.pglite.mjs', 'utf8').split('\n');
  const a = L.findIndex(x => x.trim() === 'await db.exec(`');
  const b = L.findIndex((x, i) => i > a && x.trim() === '`);');
  const harnessSchema = L.slice(a + 1, b).join('\n');

  const liveNotNull = (table) => {
    const m = fixture.match(new RegExp('CREATE TABLE public\\."' + table + '" \\(([\\s\\S]*?)\\n\\);'));
    if (!m) return null;
    return m[1].split('\n')
      .filter(l => /NOT NULL/i.test(l))
      .map(l => (l.match(/"([a-z_]+)"/) || [])[1])
      .filter(Boolean);
  };
  const harnessBlock = (table) => {
    const m = harnessSchema.match(new RegExp('CREATE TABLE ' + table + ' \\(([\\s\\S]*?)\\);'));
    return m ? m[1] : '';
  };

  for (const table of ['orders', 'order_items']) {
    const live = liveNotNull(table);
    ok(Array.isArray(live) && live.length > 0, `H1.${table} live NOT NULL set read from the fixture (${live?.length ?? 0} columns)`);
    const blk = harnessBlock(table);
    const missing = (live ?? []).filter(c => {
      if (c === 'id') return false;                       // PRIMARY KEY implies it
      // ⚠️ END OF LINE, NOT THE FIRST COMMA — `numeric(10,2)` carries a comma inside the TYPE,
      // so a `[^,]*` match stops before reaching NOT NULL and reports a gap that is not there.
      // The first version of this check did exactly that and flagged four sound columns.
      const col = blk.split('\n').find(l => new RegExp('\\b' + c + '\\b').test(l));
      return !col || !/NOT NULL/i.test(col);
    });
    ok(missing.length === 0,
       `H2.${table} 🔴 the harness enforces every NOT NULL live has — missing: ${missing.join(', ') || 'none'}`);
  }
  // The open half, COUNTED rather than quietly skipped.
  const stillShort = ['customers', 'business_inventory', 'deliveries'].filter(t => {
    const live = liveNotNull(t) ?? []; const blk = harnessBlock(t);
    return live.some(c => c !== 'id' && !/NOT NULL/i.test(blk.split('\n').find(l => new RegExp('\\b' + c + '\\b').test(l)) ?? ''));
  });
  console.log(`  note  H3 — ${stillShort.length} table(s) this harness does NOT write to are still short of live: ${stillShort.join(', ')} (tech-debt #357)`);
}


// ── J · 🔴 THE RE-LINK MIGRATION (ledger #372) EXECUTED, AND ITS W-BLOCKS RUN.
//        20260921b changes the wipe so a RE-LINKED capture is put back on its twin BEFORE the
//        delete. W1 proves the capture survives and lands on the twin; W2 is the negative control
//        proving V5's refusal still fires on a capture that was never re-linked — without it, W1
//        passes on a function that unlinks everything.
{
  const { db, err } = await fresh(M(MINE_FILE));
  ok(err === null, 'J0 the base migration still applies ' + (err ?? ''));
  let e2 = null;
  try { await db.exec(M(RELINK_FILE)); } catch (e) { e2 = String(e.message).slice(0, 180); await db.exec('ROLLBACK').catch(() => {}); }
  ok(e2 === null, 'J1 20260921b EXECUTES on real Postgres ' + (e2 ?? ''));
  if (e2 === null) {
    ok(await one(db, `select data_type from information_schema.columns where table_name='orders' and column_name='relinked_from_customer_id'`) === 'uuid',
       'J2 orders.relinked_from_customer_id exists and is uuid');

    // W1 — a re-linked capture survives and goes home
    const twin = await one(db, `INSERT INTO customers (business_id, import_run_id, first_name) VALUES ('${L}',NULL,'Twin') RETURNING id`);
    const loaded = await one(db, `INSERT INTO customers (business_id, import_run_id, first_name) VALUES ('${L}','${RUN}','Loaded') RETURNING id`);
    const cap = await one(db, `INSERT INTO orders (business_id, customer_id, transport_method, status, order_kind, import_run_id, relinked_from_customer_id)
                               VALUES ('${L}','${loaded}','delivery','fulfilled','history','${RUN}','${twin}') RETURNING id`);
    const res = await undo(db);
    ok(res.refused === false, 'J3 the undo did not refuse on a RE-LINKED capture');
    ok(Number(res.captures_unlinked) === 1, `J4 it reports captures_unlinked = 1 (got ${res.captures_unlinked})`);
    ok(await n(db, `select count(*) from orders where id='${cap}'`) === 1,
       'J5 🔴 THE CAPTURE SURVIVED THE WIPE — R-160');
    ok(await one(db, `select customer_id from orders where id='${cap}'`) === twin,
       'J6 🔴 and it went back to its TWIN, not left on a deleted customer');
    ok(await n(db, `select count(*) from orders where id='${cap}' and import_run_id is null and relinked_from_customer_id is null`) === 1,
       'J7 the run id and the pointer were both cleared');
    ok(await n(db, `select count(*) from customers where id='${twin}'`) === 1, 'J8 the twin is never deleted');
    ok(await n(db, `select count(*) from customers where id='${loaded}'`) === 0, 'J9 the loaded customer went with the load');
  }
}
// ── K · W2's claim: V5 IS UNCHANGED. A capture that was never re-linked still refuses.
{
  const { db } = await fresh(M(MINE_FILE));
  await db.exec(M(RELINK_FILE));
  const c = await seedCustomer(db);
  await db.exec(`INSERT INTO orders (business_id, customer_id, transport_method, status, order_kind, import_run_id, relinked_from_customer_id)
                 VALUES ('${L}','${c}','delivery','fulfilled','history',NULL,NULL);`);
  const res = await undo(db);
  ok(res.refused === true, 'K1 🔴 V5 STILL HOLDS — a plain live capture makes the undo refuse');
  ok(await n(db, `select count(*) from customers where id='${c}'`) === 1, 'K2 and nothing was deleted');
}

console.log(`\nPGlite: ${fails === 0 ? 'ALL PASS' : fails + ' FAILED'}`);
process.exit(fails ? 1 : 0);
