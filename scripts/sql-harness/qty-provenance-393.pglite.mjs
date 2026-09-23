/**
 * -- qty-provenance-393.pglite -- 20260923m EXECUTED, AND ITS V-BLOCKS RUN --------------------------
 *
 * PURPOSE:      run the REAL `20260923m_inventory_qty_provenance.sql` on PGlite against a fixture that
 *               reproduces LAWNS's measured shape, so the migration David applies has been EXECUTED by a
 *               Postgres engine — not only read — and so its V-blocks have been seen to give the verdicts
 *               the hand-off promises.
 *
 * 🔴 THE FIXTURE IS LAWNS'S LIVE SHAPE (measured 2026-09-23), not a tidy invention:
 *               632 live lots — 512 at qty 10, 120 at 0, none at any other value — plus the THREE
 *               `inventory_counts` rows, which are a TEST: one never-completed session run from David's
 *               own account, three rows in 3.5 minutes, the same lot counted twice.
 *
 * 🔴 WHAT IT IS REALLY FOR: **V2 must show ZERO `counted`.** An earlier draft of the migration marked
 *               those three test rows `counted` with their real date, which would have put
 *               "1 · counted 26 Aug" in front of Lauren on a lot nobody has walked. David's red-team
 *               caught it before it was applied; M1 below restores that draft and P-V2 must go red.
 *
 * PROBES:       V1–V7 as the migration ships them · M1 the "seed them as counted" draft · M2 a re-run
 *               (idempotence) · M3 the CHECK accepting a fourth value.
 * DEPENDENCIES: @electric-sql/pglite via PGLITE_DIR.
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure, 2 if PGlite is unavailable.
 * ⚠️ NOT in `npm run verify`. PGlite is Postgres 18; Supabase runs an older major.
 *
 * Run: PGLITE_DIR=node_modules node scripts/sql-harness/qty-provenance-393.pglite.mjs
 */
import { readFileSync } from 'node:fs';
const pgliteDir = process.env.PGLITE_DIR;
if (!pgliteDir) { console.error('Set PGLITE_DIR to a node_modules folder containing @electric-sql/pglite.'); process.exit(2); }
const { PGlite } = await import(process.cwd() + '/' + pgliteDir.replace(/\/$/, '') + '/@electric-sql/pglite/dist/index.js');

const MIG = process.cwd() + '/supabase/migrations/20260923m_inventory_qty_provenance.sql';
const SRC = readFileSync(MIG, 'utf8');
const L = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const LOT_A = '5eb04bd1-228e-485b-bea7-7588f861245e';   // Brodie Juniper — counted TWICE in the test
const LOT_B = 'e2cfc4ef-6045-4138-99fc-a6fd926f55f6';   // Arizona Cypress Blue Ice
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

/** The migration body — everything before the V-blocks. Rule 24: this throws rather than returning junk. */
function migrationBody(src) {
  const i = src.indexOf('-- ═');
  if (i < 0) throw new Error('could not find the V-block separator in the migration');
  return src.slice(0, i);
}
/**
 * One V-block's SQL, by its `-- Vn` marker. Throws if the block is missing (Rule 24).
 *
 * ⚠️ IT SLICES TO THE NEXT MARKER, NOT TO THE FIRST SEMICOLON. A first draft cut at the first
 * `;` and truncated V1 mid-string — its own label contains one ("...default placeholder; _at
 * nullable"), so the harness fed Postgres half a literal and died at 42601. The bug was in the
 * reader, not the migration, and cutting on punctuation inside SQL is how it happened.
 */
function vblock(src, tag) {
  const start = src.indexOf(`-- ${tag} —`);
  if (start < 0) throw new Error(`V-block ${tag} not found`);
  // Keep the leading `--` so the comment filter strips this header line too, and search for the
  // NEXT marker from after the first newline — otherwise the block ends at its own header.
  const after = src.slice(start);
  const firstNl = after.indexOf('\n');
  const rel = after.slice(firstNl).search(/\n-- V[0-9] —|\n-- ─|\nBEGIN;/);
  const block = rel < 0 ? after : after.slice(0, firstNl + rel);
  const stmt = block.split('\n').filter(l => !l.trimStart().startsWith('--')).join('\n').trim();
  if (!/^SELECT/i.test(stmt)) throw new Error(`V-block ${tag} is not a SELECT: ${stmt.slice(0, 60)}`);
  return stmt.replace(/;\s*$/, '') + ';';
}

async function fresh() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE public.businesses (id uuid PRIMARY KEY, name text NOT NULL);
    INSERT INTO public.businesses VALUES ('${L}', 'LAWNS Tree Farm, LLC');
    CREATE TABLE public.business_inventory (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL,
      name text, qty integer, retired_at timestamptz, status text DEFAULT 'available',
      created_at timestamptz DEFAULT now());
    CREATE TABLE public.inventory_counts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL,
      inventory_id uuid, counted_qty integer, counted_at timestamptz);
  `);
  // LAWNS's measured distribution: 512 at 10, 120 at 0. The two test-counted lots are inside the 512.
  await db.exec(`INSERT INTO public.business_inventory (id, business_id, name, qty)
                 VALUES ('${LOT_A}', '${L}', 'Brodie Juniper', 10), ('${LOT_B}', '${L}', 'Arizona Cypress, Blue Ice', 10);`);
  await db.exec(`INSERT INTO public.business_inventory (business_id, name, qty)
                 SELECT '${L}', 'lot ' || g, 10 FROM generate_series(1, 510) g;`);
  await db.exec(`INSERT INTO public.business_inventory (business_id, name, qty)
                 SELECT '${L}', 'empty ' || g, 0 FROM generate_series(1, 120) g;`);
  // The THREE test counts — the same session, the same lot twice (the live shape).
  await db.exec(`INSERT INTO public.inventory_counts (business_id, inventory_id, counted_qty, counted_at) VALUES
    ('${L}', '${LOT_A}', 1, '2026-08-26 20:33:40+00'),
    ('${L}', '${LOT_A}', 1, '2026-08-26 20:34:07+00'),
    ('${L}', '${LOT_B}', 1, '2026-08-26 20:35:48+00');`);
  return db;
}

const one = async (db, sql) => (await db.query(sql)).rows[0];

// ── THE MIGRATION AS IT SHIPS ────────────────────────────────────────────────────────────────
{
  const db = await fresh();
  await db.exec(migrationBody(SRC));

  const v1 = await one(db, vblock(SRC, 'V1'));
  ok(v1.verdict === 'PASS', `V1 shape — ${v1.verdict} (${v1.shape})`);

  const v2 = await one(db, vblock(SRC, 'V2'));
  ok(v2.verdict === 'PASS', `V2 verdict — ${v2.verdict}`);
  ok(Number(v2.lots) === 632, `V2 632 lots — got ${v2.lots}`);
  ok(Number(v2.placeholder_expect_632) === 632, `V2 632 placeholder — got ${v2.placeholder_expect_632}`);
  ok(Number(v2.counted_expect_0) === 0, `🔴 V2 ZERO COUNTED — the whole point. got ${v2.counted_expect_0}`);
  ok(Number(v2.silent_expect_0) === 0, `V2 no silent row — got ${v2.silent_expect_0}`);

  const v3 = await one(db, vblock(SRC, 'V3'));
  ok(v3.verdict === 'PASS', `V3 verdict — ${v3.verdict}`);
  ok(Number(v3.lots_expect_2) === 2, `V3 the two test-counted lots — got ${v3.lots_expect_2}`);
  ok(String(v3.basis_expect_placeholder) === 'placeholder', `🔴 V3 they are PLACEHOLDERS — got ${v3.basis_expect_placeholder}`);
  ok(Number(v3.dated_expect_0) === 0, `V3 and carry NO date — got ${v3.dated_expect_0}`);

  const v4 = await one(db, vblock(SRC, 'V4'));
  ok(v4.verdict === 'PASS' && Number(v4.at_ten) === 512 && Number(v4.at_zero) === 120,
    `🔴 V4 NOT ONE QUANTITY MOVED — ${v4.at_ten} at ten, ${v4.at_zero} at zero, ${v4.anything_else_should_be_zero} elsewhere`);

  const v5 = await one(db, vblock(SRC, 'V5'));
  ok(v5.verdict === 'PASS', `V5 blast radius — ${v5.verdict} (${v5.rows_platform_wide} rows)`);

  // V6 — the CHECK must refuse a fourth value. The ERROR is the pass.
  let refused = false;
  try { await db.exec(`UPDATE public.business_inventory SET qty_basis = 'guessed' WHERE id = '${LOT_A}';`); }
  catch (e) { refused = /check/i.test(String(e.message)); }
  ok(refused, '🔴 V6 the CHECK REFUSES a fourth value (23514) — the error is the pass');

  // V7 — idempotence. Re-run the whole body; nothing may change.
  const before = await one(db, `SELECT count(*) FILTER (WHERE qty_basis='placeholder') p, string_agg(DISTINCT qty_basis_because, '|') r FROM public.business_inventory`);
  await db.exec(migrationBody(SRC));
  const after = await one(db, `SELECT count(*) FILTER (WHERE qty_basis='placeholder') p, string_agg(DISTINCT qty_basis_because, '|') r FROM public.business_inventory`);
  ok(before.p === after.p && before.r === after.r, 'V7 a second run changes nothing');
  const v7 = await one(db, vblock(SRC, 'V7'));
  ok(v7.verdict === 'PASS', `V7 verdict — ${v7.verdict}`);
  await db.close();
}

// ── M1 — 🔴 THE DRAFT DAVID'S RED-TEAM CAUGHT, RESTORED ──────────────────────────────────────
// It marked the three TEST rows `counted` with their real date. V2 must go red.
{
  const db = await fresh();
  await db.exec(migrationBody(SRC));
  await db.exec(`UPDATE public.business_inventory bi SET qty_basis='counted', qty_basis_at=c.counted_at
                 FROM (SELECT DISTINCT ON (inventory_id) inventory_id, counted_at FROM public.inventory_counts
                       ORDER BY inventory_id, counted_at DESC) c
                 WHERE bi.id = c.inventory_id;`);
  const v2 = await one(db, vblock(SRC, 'V2'));
  ok(v2.verdict === 'FAIL' && Number(v2.counted_expect_0) === 2,
    `🔴 M1 the "seed them as counted" draft is CAUGHT by V2 — verdict ${v2.verdict}, counted ${v2.counted_expect_0}`);
  const v3 = await one(db, vblock(SRC, 'V3'));
  ok(v3.verdict === 'FAIL', `🔴 M1 …and by V3 — verdict ${v3.verdict}`);
  await db.close();
}

// ── M2 — the CHECK removed: V6's refusal must stop refusing ──────────────────────────────────
{
  const db = await fresh();
  await db.exec(migrationBody(SRC));
  await db.exec('ALTER TABLE public.business_inventory DROP CONSTRAINT business_inventory_qty_basis_check;');
  let refused = false;
  try { await db.exec(`UPDATE public.business_inventory SET qty_basis='guessed' WHERE id='${LOT_A}';`); }
  catch { refused = true; }
  ok(!refused, '🔴 M2 NEGATIVE CONTROL — with the CHECK dropped the write is ACCEPTED, so V6 was measuring the constraint and not something else');
  await db.close();
}

console.log(fails === 0 ? '\nqty-provenance-393.pglite — all probes passed' : `\nqty-provenance-393.pglite — ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
