/**
 * -- item-sale-units-409.pglite -- 20260925g EXECUTED against the live schema -------------------
 *
 * PURPOSE:      §6 r26. The migration is EXECUTED end to end against the live schema snapshot, its
 *               own V-blocks are extracted from the file and run VERBATIM, and the file is executed
 *               a second time to prove idempotence. RED-FIRST: the table must NOT exist before it.
 *
 *               R1 red · S1–S4 structure, RLS, policies, the unique index · C1–C4 the one-level
 *               trigger BOTH directions (a base as its own sale unit is accepted; a chain is refused
 *               from BOTH ends) · T1 tenant isolation under a real principal · V1–V4 verbatim ·
 *               I1 idempotence · M1–M3 mutants.
 *
 * DEPENDENCIES: scripts/path-tests/lib/liveDb.mjs (openLiveDb).
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure, 2 if PGlite is not available.
 * ⚠️ NOT in `npm run verify` — PGlite is Postgres 18; Supabase runs an older major.
 *
 * Run: PGLITE_DIR=node_modules node scripts/sql-harness/item-sale-units-409.pglite.mjs
 */
import { readFileSync } from 'node:fs';
if (!process.env.PGLITE_DIR) { console.error('Set PGLITE_DIR to a node_modules folder with @electric-sql/pglite.'); process.exit(2); }
const { openLiveDb, closeLiveDbs } = await import(process.cwd() + '/scripts/path-tests/lib/liveDb.mjs');

const FILE = process.cwd() + '/supabase/migrations/20260925g_item_sale_units.sql';
const RAW = readFileSync(FILE, 'utf8');
const BODY = RAW.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
const uncomment = (t) => t.split('\n').filter((l) => /^--\s{2,}/.test(l)).map((l) => l.replace(/^--\s{2}/, '')).join('\n');
const doBlocks = (sql) => { const out = []; const re = /DO\s+\$([a-z0-9_]+)\$[\s\S]*?\$\1\$\s*;/gi; let m; while ((m = re.exec(sql)) !== null) out.push(m[0]); return out; };

let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const one = async (db, q) => (await db.query(q)).rows[0];

async function tenant(db, tag, { perms = '["inventory:update"]' } = {}) {
  const b = crypto.randomUUID(), u = crypto.randomUUID();
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${u}');
    INSERT INTO public.businesses (id,name,owner_id) VALUES ('${b}','${tag}','${u}');
    INSERT INTO public.business_members (business_id,user_id,active,role,name,permissions)
      VALUES ('${b}','${u}',true,'owner','${tag}','${perms}'::jsonb);`);
  return { b, u };
}
const put = (b, sale, base, qty, unit = 'gal', because = 'probe') =>
  `INSERT INTO public.item_sale_units (business_id,sale_qb_item_id,base_qb_item_id,base_quantity,base_unit,because)
     VALUES ('${b}','${sale}','${base}',${qty},'${unit}','${because}');`;
async function refuses(db, sql) {
  try { await db.exec(sql); return false; } catch { return true; }
}

// ── RED FIRST ─────────────────────────────────────────────────────────────────────────────────
{
  const db = await openLiveDb({});
  const r = await one(db, `select count(*)::int n from information_schema.tables where table_schema='public' and table_name='item_sale_units'`);
  ok(r.n === 0, `R1 RED — item_sale_units does NOT exist before the migration (so every probe below could have failed)`);
}

// ── GREEN ─────────────────────────────────────────────────────────────────────────────────────
{
  const db = await openLiveDb({});
  await db.exec(BODY);

  const s = await one(db, `select
      (select count(*)::int from information_schema.columns where table_schema='public' and table_name='item_sale_units') cols,
      (select count(*)::int from pg_policies where schemaname='public' and tablename='item_sale_units') pols,
      (select relrowsecurity from pg_class where oid='public.item_sale_units'::regclass) rls,
      (select count(*)::int from pg_indexes where schemaname='public' and tablename='item_sale_units' and indexname='item_sale_units_one_per_item') uniq`);
  ok(s.cols === 9, `S1 — 9 columns (${s.cols})`);
  ok(s.rls === true, `S2 — RLS is ENABLED`);
  ok(s.pols === 4, `S3 — 4 policies (${s.pols}): select on membership, write on inventory:update`);
  ok(s.uniq === 1, `S4 — the one-sale-unit-per-item unique index exists`);

  const empty = await one(db, `select count(*)::int n from public.item_sale_units`);
  ok(empty.n === 0, `S5 — the table ships EMPTY: no migration seeds tenant config (the 2026-09-22 ruling)`);

  const { b } = await tenant(db, 'G');
  await db.exec(put(b, '52', '52', 201.974026, 'gal', 'the base sold as itself'));
  ok(true, `C1 — a base item as its OWN sale unit is ACCEPTED (the ordinary item-master case)`);
  await db.exec(put(b, '51', '52', 100.987013));
  ok(true, `C2 — a second sale unit pointing at the same base is accepted`);

  // 🔴 C3 AND C4 RUN IN THEIR OWN TENANT, AND THAT IS NOT TIDINESS — IT IS THE PROBE'S VALIDITY.
  // A first draft tested the chain as `52 → 99` in the tenant above, where `52 → 52` already
  // existed. The insert WAS refused, but by the UNIQUE INDEX on (business_id, sale_qb_item_id),
  // not by the trigger — so the probe passed while the trigger could have been absent.
  // **Mutant M1 is what found it**: with the trigger dropped the chain was still refused, and a
  // mutant that cannot be caught means the probe was never reaching its subject (tech-debt #182).
  // Here `52` has no row of its own, so the ONLY thing that can refuse `52 → 99` is the trigger.
  const chainT = await tenant(db, 'C3');
  await db.exec(put(chainT.b, '51', '52', 100.987013));
  ok(await refuses(db, put(chainT.b, '52', '99', 1)),
    `C3 — a chain is REFUSED when the MIDDLE link points away (51 → 52, then 52 → 99) — and ONLY the trigger can refuse it here`);
  ok(await refuses(db, put(chainT.b, '77', '51', 5)),
    `C4 — a chain is REFUSED from the other direction too (77 → 51, and 51 → 52)`);

  ok(await refuses(db, put(b, '40', '52', 0)), `S6 — a conversion of 0 is refused by the CHECK`);
  ok(await refuses(db, put(b, '40', '52', -3)), `S7 — a negative conversion is refused`);
  ok(await refuses(db, put(b, '41', '52', 30, 'gal', '   ')), `S8 — a blank "because" is refused: a conversion nobody can explain is one nobody should trust`);
  await db.exec(put(b, '41', '52', 30));
  ok(await refuses(db, put(b, '41', '52', 31)), `S9 — a SECOND row for one sale item is refused by the unique index`);

  // ── TENANT ISOLATION under a real principal ────────────────────────────────────────────────
  const mine = await tenant(db, 'T1'), theirs = await tenant(db, 'T2');
  await db.exec(put(mine.b, '40', '52', 15));
  await db.exec(put(theirs.b, '40', '52', 15));
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${mine.u}',false); SET ROLE authenticated;`);
  const seen = await one(db, `select count(*)::int n from public.item_sale_units`);
  ok(seen.n === 1, `T1 — AC-3: a member of one business sees ONLY its own row (${seen.n} of 2)`);
  const crossed = await refuses(db, put(theirs.b, '41', '52', 30));
  ok(crossed, `T2 — a write into a business the caller is not a member of is REFUSED by RLS`);
  await db.exec(`RESET ROLE;`);

  // a member WITHOUT the write string may read but not write
  const ro = await tenant(db, 'T3', { perms: '["inventory:read"]' });
  await db.exec(put(ro.b, '40', '52', 15));
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${ro.u}',false); SET ROLE authenticated;`);
  const roSees = await one(db, `select count(*)::int n from public.item_sale_units`);
  const roWrite = await refuses(db, put(ro.b, '41', '52', 30));
  ok(roSees.n === 1 && roWrite,
    `T3 — a member without inventory:update READS its conversions (${roSees.n}) but cannot write one`);
  await db.exec(`RESET ROLE;`);
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
    ok(/PASS/.test(msg), `V · $${tag}$ executed VERBATIM → ${msg.slice(0, 150)}`);
  }
}

// ── IDEMPOTENCE ───────────────────────────────────────────────────────────────────────────────
{
  const db = await openLiveDb({});
  await db.exec(BODY);
  let twice = true, why = '';
  try { await db.exec(BODY); } catch (e) { twice = false; why = String(e.message || e); }
  ok(twice, `I1 — the whole file executes a SECOND time with no error${twice ? '' : ` — ${why.slice(0, 140)}`}`);
  const s = await one(db, `select (select count(*)::int from pg_policies where tablename='item_sale_units') p,
                                  (select count(*)::int from public.item_sale_units) rows`);
  ok(s.p === 4 && s.rows === 0, `I2 — still 4 policies and still 0 rows after the second apply`);
}

// ── MUTANTS ───────────────────────────────────────────────────────────────────────────────────
const MUTANTS = [
  ['M1 the one-level trigger is dropped', 'catches',
   /CREATE TRIGGER item_sale_units_no_chain_trg[\s\S]*?item_sale_units_no_chain\(\);/,
   `-- trigger removed by the mutant`],
  ['M2 the unique index is dropped', 'catches',
   /CREATE UNIQUE INDEX IF NOT EXISTS item_sale_units_one_per_item\n\s+ON public\.item_sale_units \(business_id, sale_qb_item_id\);/,
   `-- unique index removed by the mutant`],
  ['M3 the write policies drop the permission check', 'catches',
   /AND public\.has_permission\(business_id, 'inventory:update'\)\);\n\nDROP POLICY IF EXISTS item_sale_units_member_update/,
   `);\n\nDROP POLICY IF EXISTS item_sale_units_member_update`],
];
for (const [label, kind, find, replace] of MUTANTS) {
  const db = await openLiveDb({});
  const mutated = BODY.replace(find, replace);
  ok(mutated !== BODY, `${label} — the mutant text differs from the original (the pattern matched)`);
  await db.exec(mutated);
  let caught = false, note = '';
  try {
    if (label.startsWith('M1')) {
      const { b } = await tenant(db, 'M1');
      // NO self-row for 52, so the unique index cannot stand in for the trigger — see C3's note.
      await db.exec(put(b, '51', '52', 100.987013));
      caught = !(await refuses(db, put(b, '52', '99', 1)));   // with no trigger the chain lands
      note = caught ? 'the chain 51 → 52 → 99 was ACCEPTED' : 'still refused';
    } else if (label.startsWith('M2')) {
      const { b } = await tenant(db, 'M2');
      await db.exec(put(b, '40', '52', 15));
      caught = !(await refuses(db, put(b, '40', '52', 31)));  // with no index a duplicate lands
      note = caught ? 'two rows for one sale item were ACCEPTED' : 'still refused';
    } else {
      const ro = await tenant(db, 'M3', { perms: '["inventory:read"]' });
      await db.exec(`SELECT set_config('request.jwt.claim.sub','${ro.u}',false); SET ROLE authenticated;`);
      caught = !(await refuses(db, put(ro.b, '41', '52', 30)));  // without the check, a reader writes
      note = caught ? 'a member without inventory:update WROTE a conversion' : 'still refused';
      await db.exec(`RESET ROLE;`);
    }
  } catch (e) { caught = true; note = String(e.message || e).slice(0, 80); }
  if (kind === 'catches') ok(caught, `${label} — CAUGHT (${note})`);
  else ok(!caught, `${label} — EQUIVALENT as declared (${note})`);
}

const closed = await closeLiveDbs();
console.log(fails === 0
  ? `\n✅ item-sale-units-409 — every probe passed; ${closed} PGlite instance(s) closed`
  : `\n❌ ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
