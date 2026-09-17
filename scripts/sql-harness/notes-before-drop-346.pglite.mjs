#!/usr/bin/env node
/**
 * ── notes-before-drop-346 — no phone note is lost when the old street column is dropped ─────────
 *
 * PURPOSE:      Ledger #346. Runs the REAL `20260917a` and the REAL `20260915b` (and, red-first, the
 *               `20260915b` on `origin/main` before this build) against the LIVE schema on PGlite
 *               (`scripts/path-tests/lib/liveDb.mjs`), on two data sets:
 *                 · SYNTHETIC (default, committed, runs in `npm run verify`): the five LAWNS customer
 *                   ids the migration names, with made-up numbers and words, plus controls.
 *                 · COPY (`--copy`): the read-only LAWNS contact copy in
 *                   `supabase/local-data/2026-09-17_lawns_contact_state.json` (ignored by git — it holds
 *                   customer data; this script prints ids and counts only).
 * DEPENDENCIES: @electric-sql/pglite (dev) · liveDb · git (for the red-first old 20260915b).
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { openLiveDb } from '../path-tests/lib/liveDb.mjs';

const ROOT = process.cwd();
const MIG = (f) => readFileSync(`${ROOT}/supabase/migrations/${f}`, 'utf8');
const FIX = MIG('20260917a_keep_phone_notes_before_street_drop.sql');
const DROP_NEW = MIG('20260915b_drop_legacy_customer_address.sql');
let DROP_OLD = null;
try { DROP_OLD = execSync('git show 9d9214b:supabase/migrations/20260915b_drop_legacy_customer_address.sql', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { /* shallow clone */ }
const COPY = process.argv.includes('--copy');
const COPY_FILE = `${process.env.HOME}/Desktop/trace-platform/supabase/local-data/2026-09-17_lawns_contact_state.json`;

const L = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const OWNER = '0a000000-0000-4000-8000-0000000000aa';
const FIVE = ['492e0cda-b9fb-4549-ac5c-c24d5c46c368', '5fa0c32e-cc60-480d-883b-293d16881f2c', '5fd58cd9-9bd9-4fd9-91c0-64632628dba6',
  '7c775806-f3c2-463d-abbe-814e7b7f46b8', 'c395e570-23ac-4a4d-89e1-f43f9d79b2de'];

let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++; };
const run = async (db, sql) => { try { await db.exec(sql); return null; } catch (e) { try { await db.exec('ROLLBACK'); } catch { /* none open */ } return String(e.message); } };
const one = async (db, q, p = []) => (await db.query(q, p)).rows[0];

async function insertAll(db, table, rows) {
  if (!rows.length) return;
  const cols = (await db.query(`select column_name from information_schema.columns where table_schema='public' and table_name=$1`, [table])).rows.map(r => r.column_name);
  const keys = Object.keys(rows[0]).filter(k => cols.includes(k));
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const params = [];
    const values = chunk.map(r => `(${keys.map(k => { const v = r[k]; params.push(v !== null && typeof v === 'object' ? JSON.stringify(v) : v); return `$${params.length}`; }).join(',')})`).join(',');
    await db.query(`insert into public."${table}" (${keys.map(k => `"${k}"`).join(',')}) values ${values}`, params);
  }
}

function synthetic() {
  const now = new Date().toISOString();
  const cust = (id, phone, street, extra = {}) => ({ id, business_id: L, first_name: 'Synthetic', last_name: id.slice(0, 4), phone, address_line1: street, billing_line1: null, state: null, source: 'test', created_at: now, updated_at: now, ...extra });
  const ph = (customer_id, value, note, primary, source) => ({ id: crypto.randomUUID(), business_id: L, customer_id, label: primary ? 'main' : 'other', value, value_norm: value.replace(/\D/g, ''), note, is_primary: primary, source, active: true, created_at: now, updated_at: now });
  const customers = [], phones = [];
  FIVE.forEach((id, i) => {
    const n = `(512) 555-01${10 + i}`;
    customers.push(cust(id, n, `${n} - word${i}`));
    phones.push(ph(id, n, null, true, 'migrated:customers.phone'));
  });
  // four whose words are already kept on an added row
  for (let i = 0; i < 4; i++) {
    const id = crypto.randomUUID(); const main = `(512) 555-02${10 + i}`; const other = `(512) 555-03${10 + i}`;
    customers.push(cust(id, main, `${other} (kept${i})`));
    phones.push(ph(id, main, null, true, 'migrated:customers.phone'), ph(id, other, `kept${i}`, false, 'migrated:customers.billing_line1'));
  }
  // a plain phone-in-street, and a real street already in billing
  const plain = crypto.randomUUID();
  customers.push(cust(plain, '(512) 555-0400', '(512) 555-0400'));
  phones.push(ph(plain, '(512) 555-0400', null, true, 'migrated:customers.phone'));
  customers.push(cust(crypto.randomUUID(), null, '1 Real St', { billing_line1: '1 Real St' }));
  return { customers, customer_phones: phones, customer_emails: [], customer_addresses: [] };
}

async function freshDb(data) {
  const db = await openLiveDb();
  await db.exec(`insert into auth.users (id) values ('${OWNER}')`);
  await db.exec(`insert into public.businesses (id, owner_id, name, business_type, qbo_writes_enabled) values ('${L}', '${OWNER}', 'LAWNS copy', 'nursery', false)`);
  await db.exec(`SET session_replication_role = replica`);
  await insertAll(db, 'customers', data.customers);
  await insertAll(db, 'customer_phones', data.customer_phones);
  await insertAll(db, 'customer_emails', data.customer_emails);
  await insertAll(db, 'customer_addresses', data.customer_addresses);
  await db.exec(`SET session_replication_role = origin`);
  return db;
}

// The words beside a phone in every old street, and whether a phone row keeps them — the question
// this build answers, asked with the seed's own reader.
async function wordsNotKept(db) {
  await db.exec(FIX.slice(FIX.indexOf('CREATE OR REPLACE FUNCTION pg_temp.clean_text'), FIX.indexOf('DO $$')));
  return (await db.query(`
    select c.id, q.note from public.customers c cross join lateral pg_temp.phones_in_text(c.address_line1) q
     where q.note is not null and not exists (select 1 from public.customer_phones p
       where p.customer_id = c.id and p.active and btrim(p.note) = btrim(q.note))`)).rows;
}
const phoneState = async (db) => (await db.query(`select id, customer_id, value, note, is_primary, active from public.customer_phones order by id`)).rows;

const data = COPY ? JSON.parse(readFileSync(COPY_FILE, 'utf8')) : synthetic();
if (COPY && !existsSync(COPY_FILE)) { console.error('no local copy'); process.exit(2); }
console.log(`── data: ${COPY ? 'LAWNS read-only copy (ids and counts only)' : 'synthetic'} · ${data.customers.length} customers, ${data.customer_phones.length} phones`);

// ── R · RED-FIRST: the 20260915b on main before this build drops the column with the words unkept ──
if (DROP_OLD) {
  const db = await freshDb(data);
  const lost = await wordsNotKept(db);
  ok(lost.length === 5 && FIVE.every(id => lost.some(r => r.id === id)), `R0 before the fix, exactly the five customers' words are kept nowhere but the street (${lost.length})`);
  const err = await run(db, DROP_OLD);
  const gone = !(await one(db, `select 1 as x from information_schema.columns where table_schema='public' and table_name='customers' and column_name='address_line1'`));
  ok(err === null && gone, `R1 🔴 RED: the OLD 20260915b applies without refusing and the street column is gone — the five notes are lost (${err ? err.slice(0, 80) : 'applied'})`);
} else ok(false, 'R1 could not read the old 20260915b from git (9d9214b) — the red-first run did not happen');

// ── N · the NEW 20260915b refuses while the words are unkept ──
{
  const db = await freshDb(data);
  const before = await phoneState(db);
  // A customer whose phone VALUE already holds the whole street text (number and words) keeps its
  // words there — the guard counts that as kept. On the LAWNS copy that is one of the five.
  const valueKept = (await db.query(`select distinct c.id from public.customers c join public.customer_phones p
    on p.customer_id = c.id and p.active where lower(btrim(p.value)) = lower(btrim(c.address_line1)) and c.id = any($1::uuid[])`, [FIVE])).rows.map(r => r.id);
  const atRisk = FIVE.filter(id => !valueKept.includes(id));
  const err = await run(db, DROP_NEW);
  ok(err !== null && err.includes(`REFUSED: ${atRisk.length} customer(s) hold words beside a phone`) && atRisk.every(id => err.includes(id.slice(0, 8)))
    && valueKept.every(id => !err.includes(id.slice(0, 8))),
    `N1 the new 20260915b REFUSES and names exactly the ${atRisk.length} at risk (${valueKept.length} keep the words in the phone value) (${(err ?? 'applied').slice(0, 90)})`);
  const still = await one(db, `select 1 as x from information_schema.columns where table_schema='public' and table_name='customers' and column_name='address_line1'`);
  ok(!!still && JSON.stringify(await phoneState(db)) === JSON.stringify(before), 'N2 …and nothing changed: the column is still there, the phone rows untouched');
}

// ── N3 · a phone VALUE holding the whole street text keeps the words — the guard accepts it ──
if (!COPY) {
  const v = structuredClone(data);
  const c = v.customers.find(x => x.id === FIVE[1]);
  c.phone = c.address_line1;
  v.customer_phones.find(p => p.customer_id === FIVE[1]).value = c.address_line1;
  const db = await freshDb(v);
  const err = await run(db, DROP_NEW);
  ok(err !== null && err.includes('REFUSED: 4 customer(s)') && !err.includes(FIVE[1].slice(0, 8)),
    `N3 words kept in the phone value count as kept — the guard names the other four only (${(err ?? 'applied').slice(0, 60)})`);
}

// ── A · 20260917a copies exactly the five notes, then the new 20260915b applies and loses nothing ──
{
  const db = await freshDb(data);
  const before = await phoneState(db);
  const mainBefore = (await db.query(`select id, phone from public.customers order by id`)).rows;
  const err = await run(db, FIX);
  ok(err === null, `A1 20260917a applies (${err ?? 'ok'})`);
  const after = await phoneState(db);
  const changed = after.filter((r, i) => JSON.stringify(r) !== JSON.stringify(before[i]));
  ok(changed.length === 5 && changed.every(r => FIVE.includes(r.customer_id) && r.note), `A2 exactly five phone rows changed, one per expected customer, each now holding words (${changed.length})`);
  ok(changed.every(r => { const b = before.find(x => x.id === r.id); return b.note === null && b.value === r.value && b.is_primary === r.is_primary && b.active === r.active; }),
    'A3 only the empty note was filled — value, main and active are unchanged');
  ok(JSON.stringify((await db.query(`select id, phone from public.customers order by id`)).rows) === JSON.stringify(mainBefore), 'A4 no customer\'s phone (the main number) changed');
  ok((await wordsNotKept(db)).length === 0, 'A5 every phone-with-words in an old street is now kept on a phone row');
  const again = await run(db, FIX);
  ok(again === null && JSON.stringify(await phoneState(db)) === JSON.stringify(after), `A6 a second run changes nothing (${again ?? 'no-op'})`);
  const kept = (await db.query(`select c.id, q.note from public.customers c cross join lateral pg_temp.phones_in_text(c.address_line1) q where q.note is not null`)).rows;
  const dropErr = await run(db, DROP_NEW);
  ok(dropErr === null, `A7 the new 20260915b now applies (${dropErr ? dropErr.slice(0, 90) : 'ok'})`);
  const notes = (await db.query(`select customer_id, note from public.customer_phones where active and note is not null`)).rows;
  ok(dropErr === null && kept.length >= 9 && kept.every(k => notes.some(n => n.customer_id === k.id && n.note.trim() === k.note.trim())),
    `A8 after the drop, every one of the ${kept.length} phone-with-words texts is still held as a phone note`);
}

// ── S · 20260917a refuses anything but exactly the five ──
{
  const extra = structuredClone(data);
  const id = crypto.randomUUID(); const n = '(512) 555-0999';
  extra.customers.push({ ...data.customers[0], id, phone: n, address_line1: `${n} extra`, billing_line1: null });
  extra.customer_phones.push({ ...data.customer_phones[0], id: crypto.randomUUID(), customer_id: id, value: n, value_norm: '5125550999', note: null, is_primary: true, active: true });
  const db = await freshDb(extra);
  const before = await phoneState(db);
  const err = await run(db, FIX);
  ok(err !== null && /outside the expected five/.test(err) && JSON.stringify(await phoneState(db)) === JSON.stringify(before),
    `S1 a sixth customer needing a note → REFUSED, nothing changed (${(err ?? 'applied').slice(0, 70)})`);
}
{
  // one of the five already holds its words → the set is four, not five
  const db = await freshDb(data);
  await wordsNotKept(db);
  await db.query(`update public.customer_phones p set note = q.note
    from public.customers c cross join lateral pg_temp.phones_in_text(c.address_line1) q
    where c.id = $1 and p.customer_id = c.id and p.active and p.value_norm = regexp_replace(q.phone, '\\D', '', 'g')`, [FIVE[0]]);
  const err = await run(db, FIX);
  ok(err !== null && /4 of the expected five need a note/.test(err), `S2 only four of the five needing a note → REFUSED (${(err ?? 'applied').slice(0, 70)})`);
}
{
  // one of the five holds DIFFERENT words on its row → the empty-only update writes four → refused, rolled back
  const other = structuredClone(data);
  other.customer_phones.find(p => p.customer_id === FIVE[1] && p.active).note = 'something else';
  const db = await freshDb(other);
  const before = await phoneState(db);
  const err = await run(db, FIX);
  ok(err !== null && /wrote 4 notes, not 5/.test(err) && JSON.stringify(await phoneState(db)) === JSON.stringify(before),
    `S3 a row that already holds OTHER words is never overwritten — REFUSED and rolled back (${(err ?? 'applied').slice(0, 70)})`);
}

console.log(fails ? `\n${fails} probe(s) FAILED` : '\nall probes passed');
process.exit(fails ? 1 : 0);
