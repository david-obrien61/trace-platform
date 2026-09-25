/**
 * -- build-run-rounding-410.pglite -- 20260925f EXECUTED, AND THE DEFECT PROVEN FIRST ------------
 *
 * PURPOSE:      §6 r26. The migration is EXECUTED end to end against the live schema snapshot, its
 *               own V-blocks are extracted from the file and run VERBATIM, and the file is executed
 *               a second time to prove idempotence. RED-FIRST: every probe is first run against the
 *               PRE-migration function (20260921c) and must FAIL there, because a check nobody has
 *               watched refuse is a claim (§6 r19).
 *
 *               R1 the defect, on the real column types: a 2.5 yd yield moves the row by 3 while the
 *               ledger records 2.5 · R2 a clamped component writes a delta that never happened ·
 *               then V1–V4 from the file itself · I1 idempotence · M1–M4 mutants.
 *
 * 🔴 WHY A NEW HARNESS RATHER THAN EXTENDING build-runs-freeze-370: that file declares its own
 *    `business_inventory` with **`qty numeric DEFAULT 0`**, where production is `integer NOT NULL`.
 *    It is structurally incapable of seeing this defect — a double more forgiving than the real
 *    system (§6 r19, tech-debt #138's class). This harness uses the LIVE SNAPSHOT instead, so the
 *    column types are the ones LAWNS has.
 *
 * DEPENDENCIES: scripts/path-tests/lib/liveDb.mjs (openLiveDb — the live snapshot + its defaults).
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure, 2 if PGlite is not available.
 * ⚠️ NOT in `npm run verify` — PGlite is Postgres 18; Supabase runs an older major.
 *
 * Run: PGLITE_DIR=node_modules node scripts/sql-harness/build-run-rounding-410.pglite.mjs
 */
import { readFileSync } from 'node:fs';
if (!process.env.PGLITE_DIR) { console.error('Set PGLITE_DIR to a node_modules folder with @electric-sql/pglite.'); process.exit(2); }
const { openLiveDb, closeLiveDbs } = await import(process.cwd() + '/scripts/path-tests/lib/liveDb.mjs');

const FILE = process.cwd() + '/supabase/migrations/20260925f_build_run_records_what_it_moved.sql';
const RAW = readFileSync(FILE, 'utf8');
/** The executable half — the BEGIN…COMMIT body, with the commented V-blocks left out. */
const BODY = RAW.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
/** Un-comment a `--   ` indented block back into the SQL a human pastes. */
const uncomment = (t) => t.split('\n').filter((l) => /^--\s{2,}/.test(l)).map((l) => l.replace(/^--\s{2}/, '')).join('\n');
const doBlocks = (sql) => { const out = []; const re = /DO\s+\$([a-z0-9_]+)\$[\s\S]*?\$\1\$\s*;/gi; let m; while ((m = re.exec(sql)) !== null) out.push(m[0]); return out; };

let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

/** A tenant with one made item, one component, one recipe. `yield` and `compQty` vary per probe. */
async function seed(db, tag, { onHand, yieldQty, compOnHand = null, compWant = null }) {
  const b = crypto.randomUUID(), u = crypto.randomUUID();
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${u}');
    INSERT INTO public.businesses (id,name,owner_id,qbo_writes_enabled) VALUES ('${b}','${tag}','${u}',true);
    INSERT INTO public.business_members (business_id,user_id,active,role,name,permissions)
      VALUES ('${b}','${u}',true,'owner','${tag}','["inventory:update"]'::jsonb);
    INSERT INTO public.business_inventory (business_id,name,qty,qb_item_id,item_type,qty_basis,qty_basis_because,status)
      VALUES ('${b}','Mix ${tag}',${onHand},'${tag}ITEM','manufactured','placeholder','${tag}','available');
    INSERT INTO public.item_recipes (business_id,qb_item_id,yield_quantity,yield_unit,build_minutes_because)
      VALUES ('${b}','${tag}ITEM',${yieldQty},'yd','${tag}');`);
  if (compOnHand !== null) {
    await db.exec(`
      INSERT INTO public.business_inventory (business_id,name,qty,qb_item_id,item_type,qty_basis,qty_basis_because,status)
        VALUES ('${b}','Comp ${tag}',${compOnHand},'${tag}COMP','purchased','placeholder','${tag}','available');
      INSERT INTO public.recipe_components (recipe_id,position,name,quantity,unit,component_qb_item_id)
        SELECT id,1,'Comp ${tag}',${compWant},'lb','${tag}COMP' FROM public.item_recipes
         WHERE business_id='${b}';`);
  }
  const rc = (await db.query(`SELECT id FROM public.item_recipes WHERE business_id='${b}'`)).rows[0].id;
  return { b, u, rc };
}

async function build(db, { b, u, rc }, batches = 1) {
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${u}',false)`);
  const r = await db.query(`SELECT public.record_build_run('${b}'::uuid,'${rc}'::uuid,${batches}::numeric,'probe') AS out`);
  return r.rows[0].out;
}
const itemQty = async (db, b, suffix = 'ITEM') =>
  (await db.query(`SELECT qty FROM public.business_inventory WHERE business_id='${b}' AND qb_item_id like '%${suffix}'`)).rows[0].qty;
const ledgerDelta = async (db, b, kind) =>
  (await db.query(`SELECT delta FROM public.business_inventory_ledger WHERE business_id='${b}' AND kind='${kind}' ORDER BY occurred_at DESC LIMIT 1`)).rows[0]?.delta ?? null;

// ── RED FIRST: the PRE-migration function must show the defect ────────────────────────────────
{
  const db = await openLiveDb({});
  const s = await seed(db, 'RED1', { onHand: 1, yieldQty: 2.5 });
  const out = await build(db, s);
  const d = await ledgerDelta(db, s.b, 'build'), q = await itemQty(db, s.b);
  // ✏️ THIS ASSERTION WAS WRONG ON ITS FIRST RUN AND THE CORRECTION IS THE FINDING. It expected
  // `ledger === 2.5`; `delta` is an `integer`, so the ledger stores 3. The defect is NOT that the
  // ledger and the row disagree — they agree with each other and both overstate what was made.
  ok(Number(out.made) === 2.5 && Number(d) === 3 && Number(q) === 4,
    `R1 RED (pre-migration) — the defect IS present: made 2.5, but the books say ledger ${d} and row 1→${q} — half a yard invented`);
  ok(out.recorded === undefined && out.rounding === undefined,
    `R1 RED — and nothing reports it: no "recorded", no "rounding" field`);

  const s2 = await seed(db, 'RED2', { onHand: 0, yieldQty: 1, compOnHand: 10, compWant: 25 });
  await build(db, s2);
  const cd = await ledgerDelta(db, s2.b, 'consume'), cq = await itemQty(db, s2.b, 'COMP');
  ok(Number(cd) === -25 && Number(cq) === 0,
    `R2 RED (pre-migration) — a clamped component: ledger ${cd}, row moved 10→${cq} — a consumption that never happened`);
}

// ── GREEN: the migration applied ──────────────────────────────────────────────────────────────
{
  const db = await openLiveDb({});
  await db.exec(BODY);

  const s = await seed(db, 'G1', { onHand: 1, yieldQty: 2.5 });
  const out = await build(db, s);
  const d = await ledgerDelta(db, s.b, 'build'), q = await itemQty(db, s.b);
  ok(Number(d) === Number(q) - 1, `G1 — the ledger and the row move by the same number (${d} == ${q} - 1)`);
  ok(Number(out.made) === 2.5 && Number(out.recorded) === Number(d),
    `G1 — "made" 2.5 and "recorded" ${out.recorded} are BOTH reported, and recorded == the ledger`);
  ok(Number(out.rounding) === Number(d) - 2.5 && typeof out.rounding_note === 'string' && /gallons/.test(out.rounding_note),
    `G1 — the rounding is named (${out.rounding}) and the note points at the remedy`);

  const s2 = await seed(db, 'G2', { onHand: 10, yieldQty: 2 });
  const out2 = await build(db, s2);
  ok(out2.rounding === null && Number(await itemQty(db, s2.b)) === 12 && Number(await ledgerDelta(db, s2.b, 'build')) === 2,
    `G2 — NEGATIVE CONTROL: a whole yield rounds nothing, so "rounding" is null and the row is 12`);

  const s3 = await seed(db, 'G3', { onHand: 0, yieldQty: 1, compOnHand: 10, compWant: 25 });
  const out3 = await build(db, s3);
  const cd = await ledgerDelta(db, s3.b, 'consume');
  ok(Number(cd) === -10, `G3 — a clamped component records what actually moved (${cd}), not what was wanted (-25)`);
  ok(out3.components_short.length === 1 && Number(out3.components_short[0].wanted) === 25
     && Number(out3.components_short[0].taken) === 10 && /not enough/.test(out3.components_short[0].because),
    `G3 — and the shortfall is NAMED: wanted 25, taken 10, "${out3.components_short[0]?.because}"`);

  const s4 = await seed(db, 'G4', { onHand: 0, yieldQty: 1, compOnHand: 100, compWant: 25 });
  const out4 = await build(db, s4);
  ok(out4.components_short.length === 0 && Number(await ledgerDelta(db, s4.b, 'consume')) === -25,
    `G4 — NEGATIVE CONTROL: a component with enough on hand is not flagged and records -25`);
}

// ── THE FILE'S OWN V-BLOCKS, RUN VERBATIM (§6 r26 as sharpened 2026-09-24) ─────────────────────
{
  const db = await openLiveDb({});
  await db.exec(BODY);
  const blocks = doBlocks(uncomment(RAW));
  ok(blocks.length === 4, `V — ${blocks.length} DO block(s) extracted from the migration (expected 4)`);
  const ph = blocks.join('\n').match(/(?<![:\w]):[a-z_]{2,}\b|<[a-z][a-z _]+>/gi) ?? [];
  ok(ph.length === 0, `V — NO psql placeholder in the SQL David pastes${ph.length ? ` — found ${JSON.stringify([...new Set(ph)])}` : ''}`);
  for (const block of blocks) {
    const tag = block.match(/\$([a-z0-9_]+)\$/)[1];
    let msg = '(completed WITHOUT raising — it reported nothing)';
    try { await db.exec(block); } catch (e) { msg = String(e.message || e); }
    ok(/PASS/.test(msg), `V · $${tag}$ executed VERBATIM → ${msg.slice(0, 150)}`);
  }
}

// ── IDEMPOTENCE: the whole file twice ─────────────────────────────────────────────────────────
{
  const db = await openLiveDb({});
  await db.exec(BODY);
  let twice = true, why = '';
  try { await db.exec(BODY); } catch (e) { twice = false; why = String(e.message || e); }
  ok(twice, `I1 — the file executes a SECOND time with no error (CREATE OR REPLACE)${twice ? '' : ` — ${why.slice(0, 120)}`}`);
  const s = await seed(db, 'I2', { onHand: 1, yieldQty: 2.5 });
  const out = await build(db, s);
  ok(Number(out.recorded) === Number(await ledgerDelta(db, s.b, 'build')),
    `I2 — and still behaves the same after the second apply`);
}

// ── MUTANTS ────────────────────────────────────────────────────────────────────────────────────
// 🔴 TWO KINDS, AND THE DIFFERENCE IS DECLARED RATHER THAN BLURRED. A `catches` mutant restores a
// real defect and MUST be caught. An `equivalent` mutant is one whose output is provably IDENTICAL
// to the original — because `delta` and `qty` are both `integer`, two of this migration's clauses
// cannot change any observable value today. Scoring those as CAUGHT would be a false green, and
// silently deleting them would hide that the clauses are defensive rather than load-bearing
// (§6 r19: a check that cannot disagree is not a check, so it must not be presented as one).
const MUTANTS = [
  ['M1 the finished-unit ledger goes back to the wanted figure', 'equivalent',
   /VALUES \(p_business_id, v_target, v_applied, 'build'/, `VALUES (p_business_id, v_target, v_made, 'build'`],
  ['M2 the row update goes back to implicit rounding', 'equivalent',
   /UPDATE public\.business_inventory SET qty = v_made_rec WHERE id = v_target;/,
   `UPDATE public.business_inventory SET qty = COALESCE(qty,0) + v_made WHERE id = v_target;`],
  ['M3 the component ledger goes back to the wanted figure', 'catches',
   /VALUES \(p_business_id, v_component\.stock_id, v_applied, 'consume'/,
   `VALUES (p_business_id, v_component.stock_id, -v_want, 'consume'`],
  ['M4 the rounding stops being reported', 'catches',
   /'rounding', CASE WHEN v_round = 0 THEN NULL ELSE v_round END,/, `'rounding', NULL,`],
];
for (const [label, kind, find, replace] of MUTANTS) {
  const db = await openLiveDb({});
  const mutated = BODY.replace(find, replace);
  ok(mutated !== BODY, `${label} — the mutant text differs from the original (the pattern matched)`);
  await db.exec(mutated);
  let caught = false, note = '';
  try {
    const s = await seed(db, 'MU', { onHand: 1, yieldQty: 2.5, compOnHand: 10, compWant: 25 });
    const out = await build(db, s);
    const d = await ledgerDelta(db, s.b, 'build'), q = await itemQty(db, s.b);
    const cd = await ledgerDelta(db, s.b, 'consume');
    const agree = Number(d) === Number(q) - 1;
    const compAgree = Number(cd) === -10;
    const reports = out.rounding !== null && out.rounding !== undefined;
    caught = !(agree && compAgree && reports);
    note = `ledger=${d} rowmove=${Number(q) - 1} consume=${cd} rounding=${out.rounding}`;
  } catch (e) { caught = true; note = String(e.message || e).slice(0, 80); }
  if (kind === 'catches') ok(caught, `${label} — CAUGHT (${note})`);
  else ok(!caught, `${label} — EQUIVALENT as declared: output identical, nothing to catch (${note})`);
}

const closed = await closeLiveDbs();
console.log(fails === 0
  ? `\n✅ build-run-rounding-410 — every probe passed; ${closed} PGlite instance(s) closed`
  : `\n❌ ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
