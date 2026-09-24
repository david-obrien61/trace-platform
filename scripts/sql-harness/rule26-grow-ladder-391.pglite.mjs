/**
 * -- rule26-grow-ladder-391.pglite -- EVERY STATEMENT DAVID WILL PASTE, EXECUTED -----------------
 *
 * PURPOSE:      CLAUDE.md §6 r26, satisfied literally. The three migrations and the step-0 data
 *               file are RUN — not simulated, not read — top to bottom against the LIVE SCHEMA
 *               SNAPSHOT, then their V-blocks are answered, then the whole set is run A SECOND
 *               TIME to prove idempotence. Only then do they get a SHA and a hand-off.
 *
 * 🔴 WHY A READ-ONLY SIMULATION WOULD NOT DO, IN THIS REPO'S OWN WORDS (r26, ledger #395):
 *    a file was handed over as "5 of 5 V-blocks PASS" after a SELECT-only check, and died on its
 *    third statement — `42804: column "detail" is of type jsonb but expression is of type text`.
 *    The simulation never executed an INSERT, so it was structurally incapable of failing on the
 *    only statement that mattered.
 *
 * ⚠️ THE FIXTURE IS STALE AND THIS HARNESS SAYS SO RATHER THAN WORKING AROUND IT SILENTLY.
 *    `live-schema-public.sql` was generated 2026-09-17 and its `container_ladder` carries the
 *    13-column `20260914` shape — it PREDATES `20260916` (T-posts), `20260918c` (caliper),
 *    `20260923e` (install price) and `20260923h` (grow/hold, APPLIED by David 2026-09-24). Those
 *    four are therefore REPLAYED onto the fixture first, in order, so the base this runs against
 *    matches the real database rather than last week's. P0 asserts the replay actually happened.
 *
 * DEPENDENCIES: @electric-sql/pglite via PGLITE_DIR · the fixture · the four applied migrations.
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure, 2 if PGlite is unavailable.
 *
 * Run: PGLITE_DIR=node_modules node scripts/sql-harness/rule26-grow-ladder-391.pglite.mjs
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
// 🔴 THE CANONICAL LOADER, NOT A SECOND ONE (§6 r8). `openLiveDb` already loads the fixture, the
// Supabase roles, `auth.uid()`, the extensions and the GRANTs, and its `migrations` option exists
// for exactly this case — repo migrations applied ON TOP of the snapshot. A first draft of this
// harness hand-rolled all of that and died on `CREATE ROLE postgres` (it already exists in PGlite);
// the loader's own `IF NOT EXISTS` guard is one of the reasons it is the one to use.
import { openLiveDb } from '../path-tests/lib/liveDb.mjs';

const MIG = process.cwd() + '/supabase/migrations/';
const read = (f) => readFileSync(MIG + f, 'utf8');

// The four already-applied ladder migrations the 2026-09-17 fixture predates.
const REPLAY = ['20260916_container_ladder_install_t_posts.sql', '20260918c_container_ladder_caliper.sql',
                '20260923e_container_ladder_install_price.sql', '20260923h_container_ladder_grow_and_hold.sql'];
// The hand-off set, in apply order.
const HANDOFF = ['20260924a_rung_entry_dates.sql', '20260924b_rung_sellability.sql', '20260924c_operations_config_history.sql'];
const STEP0 = process.cwd() + '/docs/decisions/2026-09-23-lawns-grow-ladder-step0.sql';

const L = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const OWNER = '11111111-1111-1111-1111-111111111111';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sha = (t) => createHash('sha256').update(t, 'utf8').digest('hex').slice(0, 12);

async function base() {
  const db = await openLiveDb({ migrations: REPLAY });
  // One business, three rungs and one lot, so the INSERTs below have something real to hang off.
  // ⚠️ `owner_id` IS NOT NULL ON THE REAL SCHEMA and my earlier minimal stand-ins never were — the
  // first run against the true fixture failed here, which is the fixture doing its job.
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${OWNER}', 'owner@example.test') ON CONFLICT DO NOTHING;
    INSERT INTO public.businesses (id, name, owner_id) VALUES ('${L}', 'LAWNS Tree Farm, LLC', '${OWNER}') ON CONFLICT DO NOTHING;
    INSERT INTO public.container_ladder (business_id, label, sort_order, volume_gallons)
      VALUES ('${L}','3/5 gal',30,4), ('${L}','15 gal',40,15), ('${L}','30 gal',50,30);
    INSERT INTO public.business_inventory (business_id, name, size, qty)
      VALUES ('${L}','Mexican Sycamore','3/5 gal',140);
  `);
  return db;
}

// ── P0 — THE BASE IS THE REAL ONE ──────────────────────────────────────────────────────────────
const db = await base();
{
  const cols = await db.query(`SELECT column_name FROM information_schema.columns
    WHERE table_name='container_ladder' AND column_name IN ('install_t_posts_per_tree','caliper_min_inches','install_price','grow_months','hold_months')`);
  ok(cols.rows.length === 5,
    `P0 🔴 the stale 2026-09-17 fixture has been brought forward — all 5 post-snapshot ladder columns present (${cols.rows.length} of 5)`);
  const t = await db.query(`SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public'`);
  ok(t.rows[0].n > 55, `P0 …on the FULL live schema, not a minimal stand-in (${t.rows[0].n} tables)`);
}

// ── P1 — EVERY STATEMENT OF EVERY HAND-OFF FILE, EXECUTED ──────────────────────────────────────
for (const f of HANDOFF) {
  const text = read(f);
  let err = null;
  try { await db.exec(text); } catch (e) { err = String(e.message || e); }
  ok(err === null, `P1 ${f} — EXECUTED end to end, every statement${err ? ` — ${err}` : ''} · sha256:${sha(text)}`);
}

// ── P2 — THE STEP-0 DATA FILE, INCLUDING ITS UPDATEs ───────────────────────────────────────────
{
  await db.exec(`INSERT INTO public.business_operations_config (business_id, config) VALUES ('${L}',
    '{"madeItemLabel":"homemade","caliperMeasuredAtInches":12,"caliperMeasuredAtBecause":"LAWNS, David 2026-09-18"}'::jsonb)
    ON CONFLICT (business_id) DO UPDATE SET config = EXCLUDED.config`);
  const text = readFileSync(STEP0, 'utf8');
  let err = null;
  try { await db.exec(text); } catch (e) { err = String(e.message || e); }
  ok(err === null, `P2 step-0 data file — EXECUTED, INSERT/UPDATEs included${err ? ` — ${err}` : ''} · sha256:${sha(text)}`);
  const w = (await db.query(`SELECT config->>'windowStart' a, config->>'caliperMeasuredAtInches' c
    FROM public.business_operations_config WHERE business_id='${L}'`)).rows[0];
  ok(w.a === '2026-11-04', `P2 …the window landed (${w.a})`);
  ok(w.c === '12', `P2 …and LAWNS's caliper height SURVIVED the merge — 12, not the platform's 6 (${w.c})`);
}

// ── P3 — THE V-BLOCK ANSWERS, READ AT RUN TIME, NEVER PINNED ───────────────────────────────────
{
  const pol = await db.query(`SELECT policyname, cmd FROM pg_policies WHERE tablename='production_rung_dates'`);
  ok(pol.rows.length === 4 && !pol.rows.some((r) => r.cmd === 'UPDATE' || r.cmd === 'DELETE'),
    `V(a) 4 policies, none UPDATE or DELETE (${pol.rows.map((r) => r.cmd).join(',')})`);

  const lot = (await db.query(`SELECT id FROM public.business_inventory LIMIT 1`)).rows[0].id;
  await db.exec(`INSERT INTO public.production_rung_dates (business_id, inventory_id, entered_on, unit_value)
    VALUES ('${L}','${lot}','2026-06-25',4)`);
  let e = null; try { await db.exec(`UPDATE public.production_rung_dates SET entered_on='2020-01-01'`); } catch (x) { e = String(x.message || x); }
  ok(e != null && /append-only/.test(e), 'V(a) 🔴 the append-only trigger REFUSES an UPDATE — the error is the pass');

  // 🔴 READ AT RUN TIME. The count of rungs is a business fact that drifts; the RELATION does not.
  const s = (await db.query(`SELECT count(*)::int rungs,
      count(*) FILTER (WHERE sellability <> 'sold' OR sellability_because <> '')::int not_default,
      bool_and(sellability = 'sold' AND sellability_because = '') AS all_default
    FROM public.container_ladder`)).rows[0];
  ok(s.not_default === 0 && s.all_default === true,
    `V(b) every rung still reads 'sold' with an empty reason — ${s.rungs} rungs, ${s.not_default} not default. NOTHING CHANGED ON APPLY.`);

  const g = (await db.query(`SELECT count(*) FILTER (WHERE grow_months IS NOT NULL)::int with_grow,
      min(label) FILTER (WHERE grow_months IS NOT NULL) AS the_one, count(*)::int total
    FROM public.container_ladder WHERE business_id='${L}'`)).rows[0];
  ok(g.with_grow === 1 && g.the_one === '15 gal',
    `V(step0) EXACTLY ONE rung carries a grow figure and it is the 15 gal (${g.with_grow}, "${g.the_one}"); ${g.total} rungs total — context only, NOT an expected value`);

  await db.exec(`DELETE FROM public.business_operations_config_history WHERE business_id='${L}'`);
  await db.exec(`UPDATE public.business_operations_config SET config = config || '{"windowEnd":"2026-11-20"}'::jsonb WHERE business_id='${L}'`);
  const h = await db.query(`SELECT config_key FROM public.business_operations_config_history WHERE business_id='${L}'`);
  ok(h.rows.length === 1 && h.rows[0].config_key === 'windowEnd',
    `V(c) the trigger recorded ONLY the key that moved (${h.rows.map((r) => r.config_key).join(',') || 'none'})`);
  const before = (await db.query(`SELECT count(*)::int n FROM public.business_operations_config_history WHERE business_id='${L}'`)).rows[0].n;
  await db.exec(`UPDATE public.business_operations_config SET config = config WHERE business_id='${L}'`);
  const after = (await db.query(`SELECT count(*)::int n FROM public.business_operations_config_history WHERE business_id='${L}'`)).rows[0].n;
  ok(before === after, `V(c) a save that changes nothing writes nothing (${before} → ${after})`);
}

// ── P4 — IDEMPOTENCE: THE WHOLE SET, A SECOND TIME ─────────────────────────────────────────────
{
  for (const f of HANDOFF) {
    let err = null;
    try { await db.exec(read(f)); } catch (e) { err = String(e.message || e); }
    ok(err === null, `P4 ${f} — re-run on an ALREADY-MIGRATED database, no error${err ? ` — ${err}` : ''}`);
  }
  let err = null;
  try { await db.exec(readFileSync(STEP0, 'utf8')); } catch (e) { err = String(e.message || e); }
  ok(err === null, `P4 step-0 — re-run, no error${err ? ` — ${err}` : ''}`);
  const g = (await db.query(`SELECT count(*) FILTER (WHERE grow_months IS NOT NULL)::int n
    FROM public.container_ladder WHERE business_id='${L}'`)).rows[0];
  ok(g.n === 1, `P4 🔴 …and re-running changed nothing — still exactly one rung with a grow figure (${g.n})`);
}

// ── P5 — MUTANT: a hand-off file that does NOT execute must be caught by P1 ────────────────────
{
  const m = read(HANDOFF[0]).replace('entered_on    date        NOT NULL,', 'entered_on    date        NOT NULL DEFAULT (1/0),');
  const d = await base();
  let err = null;
  try { await d.exec(m); } catch (e) { err = String(e.message || e); }
  ok(err != null, 'P5 (setup) a broken hand-off file DOES throw when executed — the mutant is live');
  ok(!(err === null), '🔴 P5 …so P1 would have gone RED against it. A read-only simulation would not have — r26 in one probe.');
}

console.log(fails === 0 ? '\n✅ rule26-grow-ladder-391 — every file executed, V-blocks answered, idempotent' : `\n❌ ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
