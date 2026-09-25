/**
 * -- work-orders-413.pglite -- 20260925d EXECUTED against the live schema ------------------------
 *
 * PURPOSE:      §6 r26. The migration is EXECUTED end to end against the live schema snapshot, its own
 *               V-blocks are extracted and run VERBATIM, and the file is executed a second time for
 *               idempotence. RED-FIRST: neither table exists before it.
 *
 *               S· structure, RLS, 8 policies, the timing columns · C· the three timing CHECKs ·
 *               K· the kind trigger BOTH directions · D· Done builds once, a second tap moves nothing,
 *               a partial failure stays open · T· tenant isolation and the permission refusal ·
 *               V1–V4 verbatim · I· idempotence · M1–M4 mutants.
 *
 * DEPENDENCIES: scripts/path-tests/lib/liveDb.mjs (openLiveDb). The snapshot already carries
 *               `delivery_teams` (the [[R-168]] rename is live), `item_recipes`, `build_runs`,
 *               `production_rung_dates` and `record_build_run`, so nothing is hand-rolled here —
 *               tech-debt #357's lesson.
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure, 2 if PGlite is not available.
 * ⚠️ NOT in `npm run verify` — PGlite is Postgres 18; Supabase runs an older major.
 *
 * Run: PGLITE_DIR=node_modules node scripts/sql-harness/work-orders-413.pglite.mjs
 */
import { readFileSync } from 'node:fs';
if (!process.env.PGLITE_DIR) { console.error('Set PGLITE_DIR to a node_modules folder with @electric-sql/pglite.'); process.exit(2); }
const { openLiveDb, closeLiveDbs } = await import(process.cwd() + '/scripts/path-tests/lib/liveDb.mjs');

const FILE = process.cwd() + '/supabase/migrations/20260925d_production_work_orders.sql';
const RAW = readFileSync(FILE, 'utf8');
const BODY = RAW.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
const uncomment = (t) => t.split('\n').filter((l) => /^--\s{2,}/.test(l)).map((l) => l.replace(/^--\s{2}/, '')).join('\n');
const doBlocks = (sql) => { const out = []; const re = /DO\s+\$([a-z0-9_]+)\$[\s\S]*?\$\1\$\s*;/gi; let m; while ((m = re.exec(sql)) !== null) out.push(m[0]); return out; };

let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const one = async (db, q) => (await db.query(q)).rows[0];
const refuses = async (db, sql) => { try { await db.exec(sql); return false; } catch { return true; } };

/** A tenant with a made item and a recipe. `perms` lets a probe strip the write string. */
async function tenant(db, tag, { yieldQty = 2, onHand = 0, perms = '["inventory:update"]' } = {}) {
  const b = crypto.randomUUID(), u = crypto.randomUUID();
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${u}');
    INSERT INTO public.businesses (id,name,owner_id,qbo_writes_enabled) VALUES ('${b}','${tag}','${u}',true);
    INSERT INTO public.business_members (business_id,user_id,active,role,name,permissions)
      VALUES ('${b}','${u}',true,'owner','${tag}','${perms}'::jsonb);
    INSERT INTO public.business_inventory (business_id,name,qty,qb_item_id,item_type,qty_basis,qty_basis_because,status)
      VALUES ('${b}','Mix ${tag}',${onHand},'${tag}ITEM','manufactured','placeholder','${tag}','available');
    INSERT INTO public.item_recipes (business_id,qb_item_id,yield_quantity,yield_unit,build_minutes_because)
      VALUES ('${b}','${tag}ITEM',${yieldQty},'yd','${tag}');`);
  const rc = (await db.query(`SELECT id FROM public.item_recipes WHERE business_id='${b}'`)).rows[0].id;
  const it = (await db.query(`SELECT id FROM public.business_inventory WHERE business_id='${b}'`)).rows[0].id;
  return { b, u, rc, it };
}
async function order(db, b, kind = 'mix_batch', extra = '') {
  const r = await db.query(`INSERT INTO public.production_work_orders (business_id,kind,scheduled_for,origin,because${extra ? ',' + extra.split('=')[0] : ''})
    VALUES ('${b}','${kind}',current_date,'person','probe'${extra ? ',' + extra.split('=')[1] : ''}) RETURNING id`);
  return r.rows[0].id;
}
const mixLine = (w, rc, batches = 1, pos = 1) =>
  `INSERT INTO public.production_work_order_lines (work_order_id,position,recipe_id,batches) VALUES ('${w}',${pos},'${rc}',${batches});`;
async function apply(db, u, w) {
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${u}',false)`);
  return (await db.query(`SELECT public.work_order_apply('${w}'::uuid) AS out`)).rows[0].out;
}

// ── RED FIRST ─────────────────────────────────────────────────────────────────────────────────
{
  const db = await openLiveDb({});
  const r = await one(db, `select count(*)::int n from information_schema.tables
    where table_schema='public' and table_name in ('production_work_orders','production_work_order_lines')`);
  ok(r.n === 0, `R1 RED — neither work-order table exists before the migration (so every probe below could have failed)`);
  const t = await one(db, `select count(*)::int n from information_schema.columns
    where table_schema='public' and table_name='build_runs' and column_name in ('started_at','finished_at')`);
  ok(t.n === 0, `R2 RED — build_runs has no started_at/finished_at before the migration`);
  const dt = await one(db, `select count(*)::int n from information_schema.tables where table_schema='public' and table_name='delivery_teams'`);
  ok(dt.n === 1, `R3 the snapshot already carries delivery_teams — the [[R-168]] rename is live, and the FK resolves against the real table`);
}

// ── GREEN ─────────────────────────────────────────────────────────────────────────────────────
{
  const db = await openLiveDb({});
  await db.exec(BODY);

  const s = await one(db, `select
    (select count(*)::int from information_schema.columns where table_schema='public' and table_name='production_work_orders') wo,
    (select count(*)::int from information_schema.columns where table_schema='public' and table_name='production_work_order_lines') wol,
    (select count(*)::int from pg_policies where schemaname='public' and tablename in ('production_work_orders','production_work_order_lines')) pols,
    (select relrowsecurity from pg_class where oid='public.production_work_orders'::regclass) rls1,
    (select relrowsecurity from pg_class where oid='public.production_work_order_lines'::regclass) rls2,
    (select count(*)::int from information_schema.columns where table_schema='public' and table_name='build_runs' and column_name in ('started_at','finished_at')) timing`);
  ok(s.wo === 14, `S1 — work orders: 14 columns (${s.wo})`);
  ok(s.wol === 11, `S2 — lines: 11 columns (${s.wol})`);
  ok(s.rls1 === true && s.rls2 === true, `S3 — RLS ENABLED on both tables`);
  ok(s.pols === 8, `S4 — 8 policies (${s.pols}): 4 per table`);
  ok(s.timing === 2, `S5 — build_runs gained started_at and finished_at (P5)`);
  ok((await one(db, `select count(*)::int n from public.production_work_orders`)).n === 0,
    `S6 — the tables ship EMPTY: no migration plans a job for anyone`);

  const { b, rc } = await tenant(db, 'C');
  // ── THE TIMING CHECKS ───────────────────────────────────────────────────────────────────────
  ok(await refuses(db, `INSERT INTO public.production_work_orders (business_id,kind,scheduled_for,origin,because,finished_at)
       VALUES ('${b}','mix_batch',current_date,'person','p',now());`),
    `C1 — you cannot FINISH what never started (finished_at with no started_at is refused)`);
  ok(await refuses(db, `INSERT INTO public.production_work_orders (business_id,kind,scheduled_for,origin,because,started_at,finished_at)
       VALUES ('${b}','mix_batch',current_date,'person','p',now(),now() - interval '1 hour');`),
    `C2 — you cannot finish BEFORE you start`);
  ok(await refuses(db, `INSERT INTO public.production_work_orders (business_id,kind,scheduled_for,origin,because,status)
       VALUES ('${b}','mix_batch',current_date,'person','p','done');`),
    `C3 — status 'done' REQUIRES a finished_at, so "done" always carries the fact that makes a batch time computable`);
  ok(await refuses(db, `INSERT INTO public.production_work_orders (business_id,kind,scheduled_for,origin,because)
       VALUES ('${b}','mix_batch',current_date,'person','   ');`),
    `C4 — a blank "because" is refused`);
  ok(await refuses(db, `INSERT INTO public.production_work_orders (business_id,kind,scheduled_for,origin,because)
       VALUES ('${b}','sharpen_mower',current_date,'person','p');`),
    `C5 — an unknown kind is refused`);
  ok(await refuses(db, `INSERT INTO public.production_work_orders (business_id,kind,scheduled_for,origin,because)
       VALUES ('${b}','mix_batch',current_date,'the_planner','p');`),
    `C6 — an unknown origin is refused`);

  // ── THE KIND TRIGGER, BOTH DIRECTIONS ───────────────────────────────────────────────────────
  const w = await order(db, b, 'mix_batch');
  ok(await refuses(db, `INSERT INTO public.production_work_order_lines (work_order_id,position,quantity) VALUES ('${w}',1,5);`),
    `K1 — a mix_batch line with no recipe is refused`);
  ok(await refuses(db, `INSERT INTO public.production_work_order_lines (work_order_id,position,recipe_id,batches,inventory_id)
       VALUES ('${w}',1,'${rc}',1,'${crypto.randomUUID()}');`),
    `K2 — a mix_batch line naming a LOT is refused — it names the recipe that makes the item`);
  await db.exec(mixLine(w, rc, 2));
  ok(true, `K3 — a correct mix_batch line is accepted`);
  const wu = await order(db, b, 'uppot');
  ok(await refuses(db, `INSERT INTO public.production_work_order_lines (work_order_id,position,recipe_id,batches)
       VALUES ('${wu}',1,'${rc}',1);`),
    `K4 — an uppot line naming a recipe is refused`);
  ok(await refuses(db, `INSERT INTO public.production_work_order_lines (work_order_id,position) VALUES ('${wu}',1);`),
    `K5 — an uppot line with no lot is refused`);
}

// ── DONE ──────────────────────────────────────────────────────────────────────────────────────
{
  const db = await openLiveDb({});
  await db.exec(BODY);
  const t = await tenant(db, 'D', { yieldQty: 2, onHand: 0 });
  const w = await order(db, t.b, 'mix_batch');
  await db.exec(mixLine(w, t.rc, 1));

  const r1 = await apply(db, t.u, w);
  ok(r1.ok === true && r1.applied === 1 && r1.status === 'done',
    `D1 — Done applied 1 line and the job is done`);
  ok(Number(await one(db, `select qty from public.business_inventory where id='${t.it}'`).then(r => r.qty)) === 2,
    `D2 — the build ran: on-hand moved 0 → 2 through record_build_run, not through new stock logic`);
  // 🔴 D3 IS THE PROBE THAT CHANGED THE DESIGN. It first read a build_runs row that did not exist:
  // `record_build_run` never writes that table (verified against the live function body — it does not
  // contain the string), and neither does any migration or any line of app code. So the work order is
  // its FIRST writer. Without this probe the UPDATE would have matched zero rows in silence.
  const run = await one(db, `select started_at, finished_at, batches, cost_incomplete, cost_note, yield_cubic_yards
                               from public.build_runs where business_id='${t.b}'`);
  ok(run != null && run.started_at != null && run.finished_at != null,
    `D3 — a build_runs row EXISTS and carries start and finish, so "measured over N batches" reads real work (P5)`);
  ok(run != null && run.cost_incomplete === true && /costed nowhere yet/.test(run.cost_note ?? ''),
    `D3b — and its cost is recorded as INCOMPLETE with a reason, never a 0 that would read as "this batch was free" (D-9)`);
  ok(run != null && Number(run.yield_cubic_yards) === 2,
    `D3c — the yield stored is what went ON THE BOOKS (2), the figure record_build_run reported as "recorded"`);
  const wo = await one(db, `select status, started_at, finished_at from public.production_work_orders where id='${w}'`);
  ok(wo.status === 'done' && wo.finished_at != null, `D4 — and the work order carries its finish time`);

  // 🔴 THE DOUBLE-TAP GUARD — a crew on a bad signal taps Done twice.
  const r2 = await apply(db, t.u, w);
  ok(r2.applied === 0 && r2.skipped_already_applied === 1,
    `D5 — a SECOND tap applied 0 and skipped 1 (already applied)`);
  ok(Number(await one(db, `select qty from public.business_inventory where id='${t.it}'`).then(r => r.qty)) === 2,
    `D6 — and on-hand is STILL 2: no stock moved twice. Without this, one double-tap invents a batch`);
  ok((await one(db, `select count(*)::int n from public.build_runs where business_id='${t.b}'`)).n === 1,
    `D7 — exactly ONE build run exists`);
  ok(/already been applied/.test(r2.message ?? ''), `D8 — and the second response SAYS so: "${r2.message}"`);
}

// ── A PARTIAL FAILURE STAYS OPEN ──────────────────────────────────────────────────────────────
{
  const db = await openLiveDb({});
  await db.exec(BODY);
  const t = await tenant(db, 'P');
  // A second recipe whose target stock row does NOT exist → record_build_run returns no_stock_row.
  await db.exec(`INSERT INTO public.item_recipes (business_id,qb_item_id,yield_quantity,yield_unit,build_minutes_because)
                   VALUES ('${t.b}','GHOSTITEM',1,'yd','p');`);
  const bad = (await db.query(`select id from public.item_recipes where business_id='${t.b}' and qb_item_id='GHOSTITEM'`)).rows[0].id;
  const w = await order(db, t.b, 'mix_batch');
  await db.exec(mixLine(w, t.rc, 1, 1));
  await db.exec(mixLine(w, bad, 1, 2));
  const r = await apply(db, t.u, w);
  ok(r.ok === false && r.applied === 1 && r.failed === 1,
    `E1 — one line landed and one failed, and the response says BOTH (applied 1, failed 1)`);
  ok(r.status === 'in_progress',
    `E2 — 🔴 the job is NOT 'done' — a partly applied work order stays open rather than reporting success because most of it worked`);
  ok(Array.isArray(r.problems) && r.problems.length === 1 && /no_stock_row/.test(JSON.stringify(r.problems)),
    `E3 — the failure is NAMED with its line number and reason, not swallowed`);
  ok(/still open/.test(r.message ?? ''), `E4 — and the message says the job is still open: "${r.message}"`);
  // The line that DID land must not be re-applied by a retry.
  const r2 = await apply(db, t.u, w);
  ok(r2.skipped_already_applied === 1,
    `E5 — a retry skips the line that already landed, so a fix-and-retry never double-counts the good half`);
}

// ── AN UPPOT ORDER RECORDS THE POTTING DATE ───────────────────────────────────────────────────
{
  const db = await openLiveDb({});
  await db.exec(BODY);
  const t = await tenant(db, 'U');
  const w = await order(db, t.b, 'uppot');
  await db.exec(`INSERT INTO public.production_work_order_lines (work_order_id,position,inventory_id,quantity)
                   VALUES ('${w}',1,'${t.it}',30);`);
  const r = await apply(db, t.u, w);
  ok(r.ok === true && r.applied === 1, `U1 — an uppot Done applied its line`);
  const rd = await one(db, `select count(*)::int n, max(unit_value::text) uv from public.production_rung_dates where business_id='${t.b}'`);
  ok(rd.n === 1 && Number(rd.uv) === 30,
    `U2 — it wrote ONE row to production_rung_dates, the append-only table that already owns the potting date, carrying the size`);
  const r2 = await apply(db, t.u, w);
  ok(r2.applied === 0 && (await one(db, `select count(*)::int n from public.production_rung_dates where business_id='${t.b}'`)).n === 1,
    `U3 — a second tap writes NO second date row`);
}

// ── TENANT ISOLATION AND THE PERMISSION REFUSAL ───────────────────────────────────────────────
{
  const db = await openLiveDb({});
  await db.exec(BODY);
  const mine = await tenant(db, 'T1'), theirs = await tenant(db, 'T2');
  const w1 = await order(db, mine.b), w2 = await order(db, theirs.b);
  await db.exec(mixLine(w1, mine.rc)); await db.exec(mixLine(w2, theirs.rc));
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${mine.u}',false); SET ROLE authenticated;`);
  const seen = await one(db, `select count(*)::int n from public.production_work_orders`);
  const seenLines = await one(db, `select count(*)::int n from public.production_work_order_lines`);
  ok(seen.n === 1, `T1 — AC-3: a member of one business sees ONLY its own work order (${seen.n} of 2)`);
  ok(seenLines.n === 1,
    `T2 — and only its own LINES (${seenLines.n} of 2) — the lines inherit their tenant through the parent, with no business_id copied onto them`);
  await db.exec(`RESET ROLE;`);
  const other = await apply(db, mine.u, w2);
  ok(other.ok === false && other.code === 'not_a_member',
    `T3 — applying ANOTHER business's work order is refused as not_a_member, not silently ignored`);

  const ro = await tenant(db, 'T4', { perms: '["inventory:read"]' });
  const w4 = await order(db, ro.b);
  await db.exec(mixLine(w4, ro.rc));
  const refused = await apply(db, ro.u, w4);
  ok(refused.ok === false && refused.code === 'not_allowed' && /change stock/.test(refused.message),
    `T4 — a member without inventory:update cannot finish a job, and the refusal explains that finishing moves stock`);
}

// ── THE FILE'S OWN V-BLOCKS, VERBATIM ─────────────────────────────────────────────────────────
{
  const db = await openLiveDb({});
  await db.exec(BODY);
  const blocks = doBlocks(uncomment(RAW));
  ok(blocks.length === 4, `V — ${blocks.length} DO block(s) extracted (expected 4)`);
  const ph = blocks.join('\n').match(/(?<![:\w]):[a-z_]{2,}\b|<[a-z][a-z _]+>/gi) ?? [];
  ok(ph.length === 0, `V — NO psql placeholder in the SQL David pastes${ph.length ? ` — found ${JSON.stringify([...new Set(ph)])}` : ''}`);
  for (const block of blocks) {
    const tag = block.match(/\$([a-z0-9_]+)\$/)[1];
    let msg = '(completed WITHOUT raising — it reported nothing)';
    try { await db.exec(block); } catch (e) { msg = String(e.message || e); }
    ok(/PASS/.test(msg), `V · $${tag}$ executed VERBATIM → ${msg.slice(0, 170)}`);
  }
}

// ── IDEMPOTENCE ───────────────────────────────────────────────────────────────────────────────
{
  const db = await openLiveDb({});
  await db.exec(BODY);
  let twice = true, why = '';
  try { await db.exec(BODY); } catch (e) { twice = false; why = String(e.message || e); }
  ok(twice, `I1 — the whole file executes a SECOND time with no error${twice ? '' : ` — ${why.slice(0, 140)}`}`);
  const s = await one(db, `select (select count(*)::int from pg_policies where tablename in ('production_work_orders','production_work_order_lines')) p,
                                  (select count(*)::int from public.production_work_orders) rows`);
  ok(s.p === 8 && s.rows === 0, `I2 — still 8 policies and still 0 rows after the second apply`);
}

// ── MUTANTS ───────────────────────────────────────────────────────────────────────────────────
const MUTANTS = [
  ['M1 the double-tap guard is removed', 'catches',
   /    IF v_line\.applied_at IS NOT NULL THEN\n      v_skipped := v_skipped \+ 1;\n      CONTINUE;\n    END IF;/,
   `    -- guard removed by the mutant`],
  ['M2 the kind trigger is dropped', 'catches',
   /CREATE TRIGGER pwol_matches_kind[\s\S]*?production_work_order_line_matches_kind\(\);/,
   `-- trigger removed by the mutant`],
  ['M3 a partial failure is reported as done', 'catches',
   /  IF v_failed = 0 AND \(v_applied \+ v_skipped\) > 0 THEN/,
   `  IF (v_applied + v_skipped) > 0 THEN`],
  ['M4 the done-needs-finished_at CHECK is dropped', 'catches',
   /  CONSTRAINT wo_done_has_finished_at CHECK \(status <> 'done' OR finished_at IS NOT NULL\)/,
   `  CONSTRAINT wo_done_has_finished_at CHECK (true)`],
];
for (const [label, kind, find, replace] of MUTANTS) {
  const db = await openLiveDb({});
  const mutated = BODY.replace(find, replace);
  ok(mutated !== BODY, `${label} — the mutant text differs from the original (the pattern matched)`);
  await db.exec(mutated);
  let caught = false, note = '';
  try {
    if (label.startsWith('M1')) {
      const t = await tenant(db, 'M1', { yieldQty: 2 });
      const w = await order(db, t.b); await db.exec(mixLine(w, t.rc, 1));
      await apply(db, t.u, w); await apply(db, t.u, w);
      const q = Number((await one(db, `select qty from public.business_inventory where id='${t.it}'`)).qty);
      const runs = (await one(db, `select count(*)::int n from public.build_runs where business_id='${t.b}'`)).n;
      caught = q !== 2 || runs !== 1;
      note = caught ? `a double tap built TWICE — qty ${q}, ${runs} runs` : 'still guarded';
    } else if (label.startsWith('M2')) {
      const t = await tenant(db, 'M2');
      const w = await order(db, t.b, 'mix_batch');
      caught = !(await refuses(db, `INSERT INTO public.production_work_order_lines (work_order_id,position,quantity) VALUES ('${w}',1,5);`));
      note = caught ? 'a mix_batch line with no recipe was ACCEPTED' : 'still refused';
    } else if (label.startsWith('M3')) {
      const t = await tenant(db, 'M3');
      await db.exec(`INSERT INTO public.item_recipes (business_id,qb_item_id,yield_quantity,yield_unit,build_minutes_because)
                       VALUES ('${t.b}','GHOST',1,'yd','m');`);
      const bad = (await db.query(`select id from public.item_recipes where business_id='${t.b}' and qb_item_id='GHOST'`)).rows[0].id;
      const w = await order(db, t.b); await db.exec(mixLine(w, t.rc, 1, 1)); await db.exec(mixLine(w, bad, 1, 2));
      const r = await apply(db, t.u, w);
      caught = r.status === 'done';
      note = caught ? `a job with a FAILED line reported status ${r.status}` : `still ${r.status}`;
    } else {
      const t = await tenant(db, 'M4');
      caught = !(await refuses(db, `INSERT INTO public.production_work_orders (business_id,kind,scheduled_for,origin,because,status)
        VALUES ('${t.b}','mix_batch',current_date,'person','m','done');`));
      note = caught ? "a 'done' job with NO finished_at was accepted — its batch time is uncomputable" : 'still refused';
    }
  } catch (e) { caught = true; note = String(e.message || e).slice(0, 90); }
  if (kind === 'catches') ok(caught, `${label} — CAUGHT (${note})`);
  else ok(!caught, `${label} — EQUIVALENT as declared (${note})`);
}

const closed = await closeLiveDbs();
console.log(fails === 0
  ? `\n✅ work-orders-413 — every probe passed; ${closed} PGlite instance(s) closed`
  : `\n❌ ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
