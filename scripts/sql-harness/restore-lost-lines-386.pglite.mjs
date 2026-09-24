// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: EXECUTE docs/decisions/2026-09-23-restore-lost-capture-lines.sql against real
//   Postgres (PGlite, WASM) loaded with the LIVE schema snapshot — every statement,
//   including the audit_log insert. Then run V1–V7, then run the file a SECOND time and
//   prove it inserts nothing.
//
// 🔴 WHY THIS EXISTS. v1 of that file was "verified" by a READ-ONLY simulation: I computed
//   what the post-state would look like with SELECTs. That cannot execute an INSERT, so it
//   was structurally incapable of failing on the statement that broke — `audit_log.detail`
//   is jsonb NOT NULL and the file passed text (ERROR 42804). David ran it; the whole
//   transaction aborted and nothing was written. A check that cannot disagree is not a
//   check ([[R-33]]) — and the schema snapshot already carried `"detail" jsonb NOT NULL`,
//   so the fixture was adequate and the METHOD was the defect.
//
// OUTPUTS: pass/fail per probe; exit 1 on any failure, 2 if PGlite is unavailable.
// ⚠️ NOT in `npm run verify` — PGlite is a different Postgres major to Supabase's.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, existsSync } from 'node:fs';
const ROOT = new URL('../../', import.meta.url).pathname;
let PGlite;
try { ({ PGlite } = await import(ROOT + 'node_modules/@electric-sql/pglite/dist/index.js')); }
catch { console.error('PGlite unavailable'); process.exit(2); }

const SCHEMA = ROOT + 'scripts/sql-harness/fixtures/live-schema-public.sql';
const FILE   = ROOT + 'docs/decisions/2026-09-23-restore-lost-capture-lines.sql';
if (!existsSync(SCHEMA)) { console.error('schema snapshot missing'); process.exit(2); }

const db = new PGlite();
let passed = 0, failed = 0;
const ok = (c, m, extra='') => { if (c) { passed++; console.log(`  ✅ ${m}${extra?'  — '+extra:''}`); }
                                 else { failed++; console.log(`  🔴 FAIL ${m}${extra?'  — '+extra:''}`); } };

// ── 1. the live schema ────────────────────────────────────────────────────────
const raw = readFileSync(SCHEMA, 'utf8');
// Load ONLY the CREATE TABLE blocks for the tables this file touches.
// ⚠️ Loading the whole snapshot blows PGlite's stack (54001) on its recursive RLS policies,
// and those are not what this harness is testing. What matters is the COLUMN DEFINITIONS —
// `audit_log."detail" jsonb NOT NULL` is the one that killed v1, and it is carried here
// verbatim from the live snapshot, not retyped.
const NEEDED = ['orders','order_items','deliveries','customers','audit_log'];
let loaded = 0;
for (const t of NEEDED) {
  const re = new RegExp(`CREATE TABLE public\\."?${t}"?\\s*\\(([\\s\\S]*?)\\n\\);`, 'm');
  const m = raw.match(re);
  if (!m) { console.error(`🔴 ${t} not found in the snapshot`); process.exit(2); }
  // drop FK/REFERENCES clauses: we seed a subset of rows, not the whole graph
  const cols = m[1].split('\n')
    .filter(l => !/^\s*(CONSTRAINT|FOREIGN KEY|PRIMARY KEY \()/i.test(l))
    .map(l => l.replace(/\s+REFERENCES[^,]*/i, ''))
    .join('\n').replace(/,(\s*)$/, '');
  await db.exec(`CREATE TABLE public."${t}" (\n${cols}\n);`);
  loaded++;
}
// The snapshot puts DEFAULTS in separate ALTER statements (256 of them). Without these,
// `id uuid NOT NULL` has no generator and every insert fails — which is a defect of the
// harness, not of the file under test. Load them for the tables in play.
for (const t of NEEDED) {
  const re = new RegExp(`ALTER TABLE (?:ONLY )?public\\."?${t}"?\\s+ALTER COLUMN[^;]*SET DEFAULT[^;]*;`, 'gi');
  for (const stmt of raw.match(re) || []) { try { await db.exec(stmt); } catch {} }
}
console.log(`schema: ${loaded} tables loaded from the live snapshot (columns + types verbatim)`);
const dt = (await db.query(`select data_type, is_nullable from information_schema.columns where table_name='audit_log' and column_name='detail'`)).rows[0];
console.log(`  audit_log.detail → ${dt.data_type} ${dt.is_nullable === 'NO' ? 'NOT NULL' : ''}  (the column v1 died on)\n`);

for (const t of ['orders','order_items','deliveries','customers','audit_log']) {
  const r = await db.query(`select to_regclass('public.${t}') as t`);
  if (!r.rows[0].t) { console.error(`🔴 table ${t} did not load — cannot execute honestly`); process.exit(2); }
}

// ── 2. LAWNS-shaped rows, exactly as measured live ────────────────────────────
const BIZ='ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const LP='f6dea1c9-757a-48b7-90de-ce2e0268c84b', DL='82a97473-1b6f-490d-a73a-7484c23e1095';
// Fill every NOT NULL column the live schema requires but this test does not care about.
// 🔴 DELIBERATELY NOT `ALTER COLUMN ... DROP NOT NULL`: a double that is more forgiving than
// the real system is exactly tech-debt #357, and the strictness is the reason this harness
// exists. The constraints stay; the seed satisfies them.
async function fillRequired(table, supplied) {
  const rows = (await db.query(`select column_name, data_type from information_schema.columns
     where table_schema='public' and table_name=$1 and is_nullable='NO' and column_default is null`, [table])).rows;
  const extra = {};
  for (const { column_name, data_type } of rows) {
    if (supplied.includes(column_name)) continue;
    extra[column_name] =
      /bool/.test(data_type)                    ? 'false' :
      /int|numeric|double|real/.test(data_type) ? '0' :
      /timestamp|date/.test(data_type)          ? "'2026-09-23'" :
      /uuid/.test(data_type)                    ? "'00000000-0000-0000-0000-000000000000'" :
      /json/.test(data_type)                    ? "'{}'::jsonb" : "'x'";
  }
  return extra;
}
async function seed(table, cols, rowsets) {
  const extra = await fillRequired(table, cols);
  const allCols = [...cols, ...Object.keys(extra)];
  const vals = rowsets.map(r => `(${[...r, ...Object.values(extra)].join(',')})`).join(',\n ');
  await db.exec(`insert into "${table}" (${allCols.map(c=>`"${c}"`).join(',')}) values\n ${vals};`);
}
const Q = v => v === null ? 'NULL' : (typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

await seed('customers', ['id','business_id','first_name','last_name'], [
  [Q('11111111-1111-1111-1111-111111111111'), Q(BIZ), Q('Lindsey'), Q('LaPrime')],
  [Q('22222222-2222-2222-2222-222222222222'), Q(BIZ), Q('Duy'), Q('Le')]]);
await seed('orders', ['id','business_id','customer_id','status','subtotal','tax_amount','total_amount','receipt_id','delivery_date'], [
  [Q(LP), Q(BIZ), Q('11111111-1111-1111-1111-111111111111'), Q('invoiced'), 1900.00, 156.75, 2056.75, Q('f8dc9fa6-a238-4e33-b09e-d860bcbe77de'), Q('2026-09-24')],
  [Q(DL), Q(BIZ), Q('22222222-2222-2222-2222-222222222222'), Q('invoiced'),  432.50,  35.68,  468.18, Q('14afc47d-8dc1-4e48-9df9-2806b8ad3c23'), Q('2026-09-26')]]);
await seed('order_items', ['order_id','quantity','unit_price','subtotal','description','sku'], [
  [Q(LP), 8, -37.50, -300.00, Q('Customer Discount'), 'NULL'],
  [Q(LP), 1, 200.00,  200.00, Q('Backyard Delivery'), 'NULL'],
  [Q(DL), 1, -67.50,  -67.50, Q('Customer Discount 15%'), Q('Customer Discount')],
  [Q(DL), 1,  50.00,   50.00, Q('Trip Charge'), Q('TC')]]);
await seed('deliveries', ['id','business_id','customer_id','order_id','delivery_date','status','address_line1'], [
  [Q('6224f79a-af13-45e0-8de0-d4b9cd28fa03'), Q(BIZ), Q('11111111-1111-1111-1111-111111111111'), Q(LP), Q('2026-09-24'), Q('scheduled'), Q('LaPrime address')],
  [Q('33333333-3333-3333-3333-333333333333'), Q(BIZ), Q('22222222-2222-2222-2222-222222222222'), Q(DL), Q('2026-09-26'), Q('scheduled'), Q('1145 Canna Bend')]]);
// Live carries FOUR other mis-footing captured orders this file deliberately does not touch
// (Fleishman, two LEANDER duplicates, Terry Schultz). V7 asserts they REMAIN. Without them the
// harness reports 0 and V7 fails for a reason belonging to the fixture, not to the file.
const OTHERS = ['aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002',
                'aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000004'];
await seed('orders', ['id','business_id','customer_id','status','subtotal','tax_amount','total_amount','receipt_id'],
  OTHERS.map(id => [Q(id), Q(BIZ), Q('11111111-1111-1111-1111-111111111111'), Q('invoiced'), 100.00, 0, 100.00, Q('deadbeef-0000-4000-8000-000000000000')]));
await seed('order_items', ['order_id','quantity','unit_price','subtotal','description'],
  OTHERS.map(id => [Q(id), 1, 1.00, 1.00, Q('a line that does not foot')]));

console.log('seeded the two orders in their PRE-restore state (mis-footing, as live)\n');

const foots = async (id) => (await db.query(
  `select (o.subtotal - coalesce((select sum(quantity*unit_price) from order_items where order_id=o.id),0)) as gap
     from orders o where o.id='${id}'`)).rows[0].gap;
ok(Math.abs(await foots(LP)) > 0.005, 'RED-FIRST: LaPrime does NOT foot before the file runs', `gap ${await foots(LP)}`);
ok(Math.abs(await foots(DL)) > 0.005, 'RED-FIRST: Duy Le does NOT foot before the file runs', `gap ${await foots(DL)}`);

// ── 3. EXECUTE THE FILE — the whole apply block, every statement ───────────────
const text = readFileSync(FILE, 'utf8');
const apply = text.slice(text.indexOf('\nBEGIN;'), text.indexOf('\nCOMMIT;') + '\nCOMMIT;'.length);
console.log('\nexecuting the file (BEGIN … COMMIT), every statement including the audit insert:');
try { await db.exec(apply); console.log('  ✅ executed with no error\n'); passed++; }
catch (e) { failed++; console.log(`  🔴 THE FILE FAILED TO EXECUTE: ${e.message}\n`); }

// ── 4. V1–V7, run as SQL from the file itself ─────────────────────────────────
const vblocks = text.slice(text.indexOf('\nCOMMIT;') + 8).split(/;\s*\n/).filter(s => /SELECT 'V\d/.test(s));
for (const v of vblocks) {
  try {
    const r = await db.query(v + ';');
    const row = r.rows[0] || {};
    const verdict = row.verdict ?? '(no verdict)';
    ok(verdict === 'PASS', `${row.check ?? 'V?'} → ${verdict}`,
       Object.entries(row).filter(([k]) => !['check','verdict'].includes(k)).map(([k,val])=>`${k}=${val}`).join(' '));
  } catch (e) { failed++; console.log(`  🔴 V-block errored: ${e.message.slice(0,120)}`); }
}

// ── 5. IDEMPOTENCE — run the whole file a second time ─────────────────────────
const before = (await db.query('select count(*)::int as n from order_items')).rows[0].n;
const auditBefore = (await db.query('select count(*)::int as n from audit_log')).rows[0].n;
try { await db.exec(apply); } catch (e) { failed++; console.log(`  🔴 second run errored: ${e.message.slice(0,120)}`); }
const after = (await db.query('select count(*)::int as n from order_items')).rows[0].n;
const auditAfter = (await db.query('select count(*)::int as n from audit_log')).rows[0].n;
console.log();
ok(after === before, 'second run inserts 0 order_items', `${before} → ${after}`);
ok(auditAfter === auditBefore, 'second run adds 0 audit rows — fully idempotent',
   `audit ${auditBefore} -> ${auditAfter}`);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
