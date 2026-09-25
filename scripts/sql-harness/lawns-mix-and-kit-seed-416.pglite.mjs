/**
 * -- lawns-mix-and-kit-seed-416.pglite -- the two held DATA FILES executed, per §6 r26 -----------
 *
 * PURPOSE:      David pastes these. So they are RUN FIRST — every statement, in their own
 *               `BEGIN … COMMIT`, against the live schema snapshot with `20260925g`/`20260925h`
 *               applied on top — then their V-blocks are extracted and run VERBATIM, then the whole
 *               file AGAIN to prove idempotence. A read-only simulation is not verification (§6 r26,
 *               whose own instance was a file that died on its third statement after "5 of 5 PASS").
 *
 *               RED-FIRST: each file must FAIL before its migration is applied, because that is the
 *               state David will be in if he pastes them out of order.
 *
 * DEPENDENCIES: scripts/path-tests/lib/liveDb.mjs. The LAWNS fixture mirrors the live rows measured
 *               2026-09-25: the ten mix items in two families, every one `qty_basis='placeholder'`.
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure, 2 without PGlite.
 * ⚠️ NOT in `npm run verify` — PGlite is Postgres 18; Supabase runs an older major.
 *
 * Run: PGLITE_DIR=node_modules node scripts/sql-harness/lawns-mix-and-kit-seed-416.pglite.mjs
 */
import { readFileSync } from 'node:fs';
if (!process.env.PGLITE_DIR) { console.error('Set PGLITE_DIR.'); process.exit(2); }
const { openLiveDb, closeLiveDbs } = await import(process.cwd() + '/scripts/path-tests/lib/liveDb.mjs');

const D = process.cwd() + '/docs/decisions/';
const MIX = readFileSync(D + '2026-09-26-lawns-mix-base-and-sale-units.sql', 'utf8');
const KIT = readFileSync(D + '2026-09-26-lawns-install-kit-seed.sql', 'utf8');
const body = (s) => s.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
const uncomment = (t) => t.split('\n').filter((l) => /^--\s{2,}/.test(l)).map((l) => l.replace(/^--\s{2}/, '')).join('\n');
const doBlocks = (s) => { const o = []; const re = /DO\s+\$([a-z0-9_]+)\$[\s\S]*?\$\1\$\s*;/gi; let m; while ((m = re.exec(s)) !== null) o.push(m[0]); return o; };

let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const one = async (db, q) => (await db.query(q)).rows[0];

/** LAWNS as measured live 2026-09-25: ten mix rows, two families, all placeholders. */
const MIX_ROWS = [
  ['52', '1 Yard Scoop: Fertile Compost Mix - Proprietary Blend', 1, 'manufactured'],
  ['51', '1/2 Yard Scoop: Fertile Compost Mix - Proprietary Blend', 10, 'purchased'],
  ['40', '15gal Bucket: Fertile Compost Mix - Proprietary Blend', 10, 'purchased'],
  ['41', '30gal Bucket: Fertile Compost Mix - Proprietary Blend', 10, 'purchased'],
  ['42', '45gal Bucket: Fertile Compost Mix - Proprietary Blend', 10, 'purchased'],
  ['54', '1 Yard Scoop: Regular Compost Mix - w/o Fertilizer', 10, 'purchased'],
  ['53', '1/2 Yard Scoop: Regular Compost Mix - w/o Fertilizer', 10, 'purchased'],
  ['48', '15gal Bucket: Regular Compost Mix - w/o Fertilizer', 10, 'purchased'],
  ['49', '30gal Bucket: Regular Compost Mix - w/o Fertilizer', 10, 'purchased'],
  ['50', '45gal Bucket: Regular Compost Mix - w/o Fertilizer', 10, 'purchased'],
];
async function lawns(db) {
  const b = crypto.randomUUID(), u = crypto.randomUUID();
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${u}');
    INSERT INTO public.businesses (id,name,owner_id) VALUES ('${b}','LAWNS Tree Farm, LLC','${u}');`);
  for (const [qb, name, qty, type] of MIX_ROWS) {
    await db.exec(`INSERT INTO public.business_inventory
      (business_id,name,qty,qb_item_id,item_type,qty_basis,qty_basis_because,status)
      VALUES ('${b}',$n$${name}$n$,${qty},'${qb}','${type}','placeholder','catalogue import seed','available');`);
  }
  return b;
}

// ── RED FIRST: out of order, each file must FAIL and write nothing ─────────────────────────────
for (const [label, sql, dep] of [['mix/D3', MIX, '20260925g'], ['kit', KIT, '20260925h']]) {
  const db = await openLiveDb({});
  await lawns(db);
  let refused = false;
  try { await db.exec(body(sql)); } catch { refused = true; }
  ok(refused, `R-${label} RED — pasted WITHOUT ${dep} applied it FAILS (the table does not exist), so nothing half-lands`);
}

// ── GREEN ─────────────────────────────────────────────────────────────────────────────────────
{
  const db = await openLiveDb({ migrations: ['20260925g_item_sale_units.sql', '20260925h_install_kit_components.sql'] });
  const b = await lawns(db);

  await db.exec(body(MIX));
  ok(true, 'G1 — the mix/D3 file executed end to end, every statement, in one transaction');
  await db.exec(body(KIT));
  ok(true, 'G2 — the kit seed executed end to end');

  const su = await one(db, `select count(*)::int n,
      max(case when sale_qb_item_id='52' then round(base_quantity,4) end) yard,
      max(case when sale_qb_item_id='51' then round(base_quantity,4) end) half,
      count(*) filter (where base_qb_item_id<>'52')::int wrong
    from public.item_sale_units where business_id='${b}'`);
  ok(su.n === 5 && su.wrong === 0 && Number(su.yard) === 201.974 && Number(su.half) === 100.987,
    `G3 — 5 sale units, all on qb 52; 1 yd = ${su.yard} gal, 1/2 yd = ${su.half} gal (the exact 46656/231, not a rounded 201.97)`);

  const base = await one(db, `select qty, reorder_point, qty_basis, qty_basis_because from public.business_inventory
    where business_id='${b}' and qb_item_id='52'`);
  ok(base.reorder_point === 1010, `G4 — the minimum is ${base.reorder_point} gal on qb 52 (5 yd = 1009.87, an integer column holds 1010)`);
  ok(base.qty === 0 && base.qty_basis === 'placeholder' && /HOLDS THE PILE/.test(base.qty_basis_because),
    'G5 — the base opens at 0 gal, honestly a PLACEHOLDER, and its note says it now holds the pile');

  const stranded = await one(db, `select count(*) filter (where qty=0)::int zeroed,
      count(*) filter (where qty_basis_because like '%SALE UNIT of qb 52%')::int noted
    from public.business_inventory where business_id='${b}' and qb_item_id in ('51','40','41','42')`);
  ok(stranded.zeroed === 4 && stranded.noted === 4, 'G6 — D3: all four stranded Fertile portions are 0 and carry the dated note');

  const regular = await one(db, `select count(*) filter (where qty<>0)::int untouched
    from public.business_inventory where business_id='${b}' and qb_item_id in ('54','53','48','49','50')`);
  ok(regular.untouched === 5,
    '🔴 G7 — THE REGULAR (BOUGHT) FAMILY IS UNTOUCHED: all 5 still hold their own counts. David ruled it stays separate, and a file that zeroed them would be silently wrong');

  const kit = await one(db, `select count(*)::int n, count(*) filter (where qb_item_id is not null)::int linked,
      max(case when component_key='special_mix' then qb_item_id end) mix,
      count(*) filter (where rule='per_rung' and factor is not null)::int rung_bad
    from public.install_kit_components where business_id='${b}'`);
  ok(kit.n === 7 && kit.linked === 1 && kit.mix === '52',
    `G8 — 7 kit components; only the mix is linked (qb ${kit.mix}) — the other six are UNLINKED and listed, never guessed`);
  ok(kit.rung_bad === 0, 'G9 — the per_rung component carries NO factor: the rung owns that count (STD-011)');

  // ── IDEMPOTENCE ─────────────────────────────────────────────────────────────────────────────
  const before = JSON.stringify((await db.query(`select sale_qb_item_id, base_quantity from public.item_sale_units where business_id='${b}' order by 1`)).rows);
  await db.exec(body(MIX)); await db.exec(body(KIT));
  const after = JSON.stringify((await db.query(`select sale_qb_item_id, base_quantity from public.item_sale_units where business_id='${b}' order by 1`)).rows);
  ok(before === after, 'I1 — both files run a SECOND time and change nothing');
  const dup = await one(db, `select count(*)::int n from public.install_kit_components where business_id='${b}'`);
  ok(dup.n === 7, `I2 — and no duplicate kit rows (${dup.n})`);

  // 🔴 A LINK SOMEBODY PICKED MUST SURVIVE A RE-RUN.
  await db.exec(`update public.install_kit_components set qb_item_id='999' where business_id='${b}' and component_key='rope'`);
  await db.exec(body(KIT));
  const rope = await one(db, `select qb_item_id from public.install_kit_components where business_id='${b}' and component_key='rope'`);
  ok(rope.qb_item_id === '999',
    '🔴 I3 — a product David picks SURVIVES a re-run of the seed (qb_item_id is deliberately absent from the DO UPDATE list)');
}

// ── THE FILES' OWN V-BLOCKS, RUN VERBATIM ─────────────────────────────────────────────────────
for (const [label, sql, n] of [['mix/D3', MIX, 4], ['kit', KIT, 3]]) {
  const db = await openLiveDb({ migrations: ['20260925g_item_sale_units.sql', '20260925h_install_kit_components.sql'] });
  await lawns(db);
  await db.exec(body(MIX)); await db.exec(body(KIT));
  const blocks = doBlocks(uncomment(sql));
  ok(blocks.length === n, `V-${label} — ${blocks.length} DO block(s) extracted (expected ${n})`);
  const ph = blocks.join('\n').match(/(?<![:\w]):[a-z_]{2,}\b|<[a-z][a-z _]+>/gi) ?? [];
  ok(ph.length === 0, `V-${label} — NO placeholder in the SQL David pastes${ph.length ? ` — ${JSON.stringify([...new Set(ph)])}` : ''}`);
  for (const blk of blocks) {
    const tag = blk.match(/\$([a-z0-9_]+)\$/)[1];
    let msg = '(completed WITHOUT raising — it reported nothing)';
    try { await db.exec(blk); } catch (e) { msg = String(e.message || e); }
    ok(/PASS/.test(msg), `V-${label} · $${tag}$ verbatim → ${msg.slice(0, 155)}`);
  }
}

const closed = await closeLiveDbs();
console.log(fails === 0 ? `\n✅ lawns-mix-and-kit-seed-416 — every probe passed; ${closed} PGlite instance(s) closed`
                        : `\n❌ ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
