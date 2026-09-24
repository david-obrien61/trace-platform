/**
 * -- rung-dates-391.pglite -- 20260924a/b/c EXECUTED -------------------------------------------
 * (built from ladder-grow-hold-390.pglite.mjs — same minimal surrounding schema.)
 *
 * PURPOSE:      the three migrations David will paste are RUN by a Postgres engine before he sees
 *               them, and their V-blocks answered in the verdict style.
 *               J1–J6  production_rung_dates: shape · RLS on · NO update/delete policy for anyone ·
 *                      🔴 the append-only trigger REFUSES both UPDATE and DELETE · business_inventory
 *                      gained no column · current-is-latest is a projection, not a flag.
 *               K1–K4  container_ladder.sellability: shape · NAMED check · 🔴 refuses a fourth value ·
 *                      every existing rung reads `sold` so nothing changes on apply.
 *               L1–L5  config history: no write policy · 🔴 the trigger FIRES and records only the
 *                      key that moved · a no-op save writes nothing · a key ADDED is recorded ·
 *                      a key REMOVED is recorded.
 *               M1–M3  mutants: `<>` instead of IS DISTINCT FROM (L4/L5 must catch) · the trigger
 *                      dropped (L2 must catch) · sellability default 'never_sold' (K4 must catch).
 * DEPENDENCIES: @electric-sql/pglite via PGLITE_DIR.
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure, 2 if PGlite is unavailable.
 * ⚠️ NOT in `npm run verify`. PGlite is Postgres 18; Supabase runs an older major. This proves the
 *    SQL is well-formed and the guards bite — it does not replace applying it.
 *
 * Run: PGLITE_DIR=node_modules node scripts/sql-harness/rung-dates-391.pglite.mjs
 */
import { readFileSync } from 'node:fs';
const pgliteDir = process.env.PGLITE_DIR;
if (!pgliteDir) { console.error('Set PGLITE_DIR to a node_modules folder containing @electric-sql/pglite.'); process.exit(2); }
const { PGlite } = await import(process.cwd() + '/' + pgliteDir.replace(/\/$/, '') + '/@electric-sql/pglite/dist/index.js');

const MIG = process.cwd() + '/supabase/migrations/';
const read = (f) => readFileSync(MIG + f, 'utf8');
const LADDER = read('20260914_container_ladder.sql');
const POSTS = read('20260916_container_ladder_install_t_posts.sql');
const CAL = read('20260918c_container_ladder_caliper.sql');
const PRICE = read('20260923e_container_ladder_install_price.sql');
const GROW = read('20260923h_container_ladder_grow_and_hold.sql');
const DATES = read('20260924a_rung_entry_dates.sql');
const SELL = read('20260924b_rung_sellability.sql');
const HIST = read('20260924c_operations_config_history.sql');

const L = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74', T = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b';
const MEMBER = '11111111-1111-1111-1111-111111111111';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// 🔴 A `date` COLUMN COMES BACK AS A JS Date, NOT A STRING, AND `String(d)` IS "Thu Jul 02 2026…".
// The first draft of J6 compared with `.startsWith('2026-07-02')` and FAILED against a migration
// that was correct — a probe defect that read exactly like a schema defect, and cost a debug cycle.
// One helper so no probe below can make that mistake again.
const ymd = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const refused = async (db, sql) => { try { await db.exec(sql); return null; } catch (e) { return String(e.message || e); } };

async function fresh({ dates = DATES, sell = SELL, hist = HIST } = {}) {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $f$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
    CREATE TABLE public.businesses (id uuid PRIMARY KEY, name text NOT NULL, owner_id uuid);
    INSERT INTO public.businesses VALUES ('${L}', 'LAWNS Tree Farm, LLC', null), ('${T}', 'Test Dave''s Tree Nest', null);
    CREATE TABLE public.business_members (business_id uuid, user_id uuid, active boolean);
    INSERT INTO public.business_members VALUES ('${L}', '${MEMBER}', true);
    CREATE FUNCTION public.is_active_member(p_business_id uuid) RETURNS boolean
      LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $f$
      SELECT EXISTS (SELECT 1 FROM public.business_members
                      WHERE business_id = p_business_id AND user_id = auth.uid() AND active = true) $f$;
    CREATE FUNCTION public.has_permission(uuid, text) RETURNS boolean LANGUAGE sql AS 'select true';
    CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS
      $f$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $f$;
    CREATE TABLE public.business_operations_config (business_id uuid PRIMARY KEY, config jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
    CREATE TABLE public.business_inventory (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id uuid NOT NULL, name text, size text, qty int);
    INSERT INTO public.business_inventory (business_id, name, size, qty)
      VALUES ('${L}', 'Mexican Sycamore', '3/5 gal', 140);
  `);
  await db.exec(LADDER); await db.exec(POSTS); await db.exec(CAL); await db.exec(PRICE); await db.exec(GROW);
  if (dates) await db.exec(dates);
  if (sell) await db.exec(sell);
  if (hist) await db.exec(hist);
  return db;
}
const lotId = async (db) => (await db.query(`SELECT id FROM public.business_inventory LIMIT 1`)).rows[0].id;

const db = await fresh();

// ══ J — production_rung_dates ══════════════════════════════════════════════════════════════════
{
  const r = await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname='production_rung_dates'`);
  ok(r.rows[0]?.relrowsecurity === true, 'J1 the table exists with RLS ENABLED');

  const w = await db.query(`SELECT policyname, cmd FROM pg_policies
    WHERE tablename='production_rung_dates' AND cmd IN ('UPDATE','DELETE')`);
  ok(w.rows.length === 0, `J2 🔴 NO UPDATE and NO DELETE policy exists for ANYONE, owner included (${w.rows.length})`);

  const all = await db.query(`SELECT policyname FROM pg_policies WHERE tablename='production_rung_dates'`);
  ok(all.rows.length === 4, `J3 the four expected policies are present (${all.rows.length} of 4)`);

  const id = await lotId(db);
  await db.exec(`INSERT INTO public.production_rung_dates (business_id, inventory_id, entered_on, unit_value, note)
    VALUES ('${L}', '${id}', '2026-06-25', 4, '140 Cedar Creek liners landed')`);
  const upd = await refused(db, `UPDATE public.production_rung_dates SET entered_on='2020-01-01' WHERE inventory_id='${id}'`);
  ok(upd != null && /append-only/.test(upd), 'J4 🔴 the append-only trigger REFUSES an UPDATE — the error is the pass');
  const del = await refused(db, `DELETE FROM public.production_rung_dates WHERE inventory_id='${id}'`);
  ok(del != null && /append-only/.test(del), 'J4 🔴 …and REFUSES a DELETE');

  const still = await db.query(`SELECT count(*)::int n FROM public.production_rung_dates WHERE inventory_id='${id}'`);
  ok(still.rows[0].n === 1, 'J4 …and the row is still there afterwards — nothing was lost to the refusal');

  const cols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='business_inventory'
    AND column_name IN ('entered_on','potted_on','rung_started_on','current_rung_date')`);
  ok(cols.rows.length === 0, 'J5 🔴 business_inventory gained NO column — the date is a row, not a field that can be overwritten');

  // A CORRECTION IS A NEW ROW, and current is the latest — the whole shape, end to end.
  await db.exec(`INSERT INTO public.production_rung_dates (business_id, inventory_id, entered_on, unit_value, note)
    VALUES ('${L}', '${id}', '2026-07-02', 4, 'Joel: it was the week after')`);
  const cur = await db.query(`SELECT entered_on, note FROM public.production_rung_dates
    WHERE inventory_id='${id}' ORDER BY recorded_at DESC, seq DESC LIMIT 1`);
  const hist = await db.query(`SELECT count(*)::int n FROM public.production_rung_dates WHERE inventory_id='${id}'`);
  ok(ymd(cur.rows[0].entered_on) === '2026-07-02',
    '🔴 J6 current = the LATEST row, so a correction takes effect. ⚠️ THIS WENT RED FIRST AND THE PROBE WAS WRONG, NOT THE MIGRATION — a `date` column returns a JS Date and `String(d)` is "Thu Jul 02 2026…". The `seq` column it prompted is still right, and M4 below is the case that proves it.');
  ok(hist.rows[0].n === 2, 'J6 …and the ORIGINAL is still there — nothing was overwritten');
  const flag = await db.query(`SELECT column_name FROM information_schema.columns
    WHERE table_name='production_rung_dates' AND column_name IN ('is_current','current','latest')`);
  ok(flag.rows.length === 0, '⚠️ J6 SELF-CATCH: there is no is_current/latest FLAG — current is a projection, not a second truth');
}

// ══ K — sellability ════════════════════════════════════════════════════════════════════════════
{
  const c = await db.query(`SELECT column_name, is_nullable, column_default FROM information_schema.columns
    WHERE table_name='container_ladder' AND column_name IN ('sellability','sellability_because') ORDER BY column_name`);
  ok(c.rows.length === 2 && c.rows.every((x) => x.is_nullable === 'NO'), 'K1 both columns exist and are NOT NULL');

  const ck = await db.query(`SELECT conname FROM pg_constraint WHERE conrelid='public.container_ladder'::regclass
    AND conname='container_ladder_sellability_check'`);
  ok(ck.rows.length === 1, 'K2 the CHECK exists and is findable BY NAME');

  const bad = await refused(db, `UPDATE public.container_ladder SET sellability='sometimes' WHERE label='15 gal'`);
  ok(bad != null && /sellability_check/.test(bad), 'K3 🔴 a fourth value is REFUSED by name — the error is the pass');
  const good = await refused(db, `UPDATE public.container_ladder SET sellability='never_sold', sellability_because='production only' WHERE label='slip'`);
  ok(good == null, 'K3 …and never_sold is accepted');

  const all = await db.query(`SELECT count(*)::int n FROM public.container_ladder WHERE business_id='${L}' AND sellability='sold'`);
  const tot = await db.query(`SELECT count(*)::int n FROM public.container_ladder WHERE business_id='${L}'`);
  ok(all.rows[0].n === tot.rows[0].n - 1, `K4 🔴 every rung but the one just changed still reads 'sold' — nothing changed on apply (${all.rows[0].n} of ${tot.rows[0].n})`);
}

// ══ L — the config history trigger ═════════════════════════════════════════════════════════════
{
  const w = await db.query(`SELECT policyname, cmd FROM pg_policies
    WHERE tablename='business_operations_config_history' AND cmd <> 'SELECT'`);
  ok(w.rows.length === 0, `L1 🔴 NO write policy of any kind — only the SECURITY DEFINER trigger writes (${w.rows.length})`);

  await db.exec(`INSERT INTO public.business_operations_config (business_id, config)
    VALUES ('${L}', '{"caliperMeasuredAtInches":12}'::jsonb)
    ON CONFLICT (business_id) DO UPDATE SET config = EXCLUDED.config`);
  await db.exec(`DELETE FROM public.business_operations_config_history WHERE business_id='${L}'`);

  await db.exec(`UPDATE public.business_operations_config
    SET config = config || '{"windowStart":"2026-11-04"}'::jsonb WHERE business_id='${L}'`);
  const h = await db.query(`SELECT config_key, old_value, new_value FROM public.business_operations_config_history
    WHERE business_id='${L}'`);
  ok(h.rows.length === 1 && h.rows[0].config_key === 'windowStart',
    `L2 🔴 the trigger FIRES and records ONLY the key that moved (${h.rows.length} row(s): ${h.rows.map(x=>x.config_key).join(',')})`);
  ok(h.rows[0].old_value === null && String(h.rows[0].new_value).includes('2026-11-04'),
    'L2 …with the old value NULL and the new one recorded — a key APPEARING is a change');

  const before = (await db.query(`SELECT count(*)::int n FROM public.business_operations_config_history WHERE business_id='${L}'`)).rows[0].n;
  await db.exec(`UPDATE public.business_operations_config SET config = config WHERE business_id='${L}'`);
  const after = (await db.query(`SELECT count(*)::int n FROM public.business_operations_config_history WHERE business_id='${L}'`)).rows[0].n;
  ok(before === after, `L3 🔴 a save that changes NOTHING writes nothing (${before} → ${after})`);

  await db.exec(`UPDATE public.business_operations_config SET config = config - 'windowStart' WHERE business_id='${L}'`);
  const rm = await db.query(`SELECT config_key, old_value, new_value FROM public.business_operations_config_history
    WHERE business_id='${L}' ORDER BY changed_at DESC LIMIT 1`);
  ok(rm.rows[0].config_key === 'windowStart' && rm.rows[0].new_value === null,
    'L4 🔴 a key REMOVED is recorded too — this is the case `<>` silently drops');
}

// ══ M — MUTANTS ════════════════════════════════════════════════════════════════════════════════
{
  const m1 = HIST.replace(/IF oldv IS DISTINCT FROM newv THEN/, 'IF oldv <> newv THEN');
  const d1 = await fresh({ hist: m1 });
  await d1.exec(`INSERT INTO public.business_operations_config (business_id, config) VALUES ('${L}', '{}'::jsonb)
    ON CONFLICT (business_id) DO UPDATE SET config = EXCLUDED.config`);
  await d1.exec(`DELETE FROM public.business_operations_config_history WHERE business_id='${L}'`);
  await d1.exec(`UPDATE public.business_operations_config SET config = config || '{"windowStart":"2026-11-04"}'::jsonb WHERE business_id='${L}'`);
  const got = (await d1.query(`SELECT count(*)::int n FROM public.business_operations_config_history WHERE business_id='${L}'`)).rows[0].n;
  ok(got === 0, `M1 (setup) with \`<>\` the APPEARING key is silently dropped — ${got} rows, the mutant is live`);
  ok(!(got === 1), 'M1 🔴 …so L2 above would have gone RED against it — the probe can disagree');

  const m2 = SELL.replace(/DEFAULT 'sold'/, "DEFAULT 'never_sold'");
  const d2 = await fresh({ sell: m2 });
  const n = (await d2.query(`SELECT count(*)::int n FROM public.container_ladder WHERE business_id='${L}' AND sellability='sold'`)).rows[0].n;
  ok(n === 0, `M2 (setup) the mutant default makes every rung never_sold — ${n} read 'sold', the mutant is live`);
  ok(!(n > 0), 'M2 🔴 …so K4 would have gone RED — a default that silently stopped LAWNS selling anything');

  const m3 = DATES.replace(/BEFORE UPDATE OR DELETE ON public\.production_rung_dates/, 'BEFORE DELETE ON public.production_rung_dates');
  const d3 = await fresh({ dates: m3 });
  const id3 = await lotId(d3);
  await d3.exec(`INSERT INTO public.production_rung_dates (business_id, inventory_id, entered_on) VALUES ('${L}','${id3}','2026-06-25')`);
  const u3 = await refused(d3, `UPDATE public.production_rung_dates SET entered_on='2020-01-01' WHERE inventory_id='${id3}'`);
  ok(u3 == null, 'M3 (setup) with UPDATE dropped from the trigger, an edit SUCCEEDS — the mutant is live');
  ok(!(u3 != null), 'M3 🔴 …so J4 would have gone RED — a statement of fact silently rewritten');
}

{
  // ── M4 — IS THE `seq` TIEBREAK DOING ANY WORK? ────────────────────────────────────────────────
  // ⚠️ THE ROWS MUST GO IN ONE STATEMENT. `now()` is TRANSACTION time, so two separate inserts get
  // two different timestamps and `recorded_at DESC` alone already answers — which is why J6 passes
  // either way and CANNOT test this. One multi-row INSERT is the case that ties.
  // ⚠️ AND A FRESH LOT PER ROUND, because the table is append-only: there is no DELETE to reset with.
  const d4 = await fresh();
  let wrongById = 0, rounds = 12;
  for (let i = 0; i < rounds; i++) {
    const nl = await d4.query(`INSERT INTO public.business_inventory (business_id, name) VALUES ('${L}', 'round ${i}') RETURNING id`);
    const lot = nl.rows[0].id;
    await d4.exec(`INSERT INTO public.production_rung_dates (business_id, inventory_id, entered_on)
      VALUES ('${L}','${lot}','2026-06-25'), ('${L}','${lot}','2026-07-02')`);
    const tie = await d4.query(`SELECT count(DISTINCT recorded_at)::int n FROM public.production_rung_dates WHERE inventory_id='${lot}'`);
    ok(tie.rows[0].n === 1, `M4 round ${i + 1} (setup): both rows share one recorded_at — the tie is real, not contrived`);
    const byId = await d4.query(`SELECT entered_on FROM public.production_rung_dates
      WHERE inventory_id='${lot}' ORDER BY recorded_at DESC, id DESC LIMIT 1`);
    if (ymd(byId.rows[0].entered_on) !== '2026-07-02') wrongById++;
    const bySeq = await d4.query(`SELECT entered_on FROM public.production_rung_dates
      WHERE inventory_id='${lot}' ORDER BY recorded_at DESC, seq DESC LIMIT 1`);
    ok(ymd(bySeq.rows[0].entered_on) === '2026-07-02', `M4 round ${i + 1}: seq picks the correction`);
  }
  ok(wrongById > 0,
    `M4 🔴 …while the uuid tiebreak got it WRONG ${wrongById} of ${rounds} times. THAT is what \`seq\` fixes: two corrections in ONE transaction, and "current" decided by a coin toss.`);
}

console.log(fails === 0 ? '\n✅ rung-dates-391 — all probes pass' : `\n❌ ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
