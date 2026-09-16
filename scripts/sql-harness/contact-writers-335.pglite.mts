/**
 * -- contact-writers-335.pglite -- EVERY contact writer, driven against the REAL migrated schema ----
 *
 * PURPOSE:      David, 2026-09-16: *"every writer … a save followed by a ship-to save loses nothing."*
 *               The real 20260911b + 20260915 (seed, derivation, GUARD) + 20260916c + 20260916d run on
 *               PGlite, and the REAL writer functions run against them through a small PostgREST-shaped
 *               adapter (below): OCR capture / checkout / delivery ingest (`findOrCreateCustomer`), the
 *               customer editor (`updateCustomerFields` / `insertCustomerFields`), the QuickBooks import
 *               (`commitCustomerImport`) and its undo, and the ship-to picker (`saveCustomerAddress`).
 *               Each writer saves, then a ship-to site is saved for the same customer, then the stored
 *               row is read back: phone, email and street must be exactly what the writer saved.
 *               Plus: a direct write is REFUSED by the guard; the undo takes a run's contact rows and
 *               blocks a customer with a hand-added one.
 * DEPENDENCIES: @electric-sql/pglite via PGLITE_DIR (NOT a repo dependency — same convention as the
 *               other sql-harness scripts). WRITERS_ROOT (optional) points the imports at another
 *               checkout — that is how the red-first run drives the OLD writers against the NEW schema.
 *               20260916c is read from the tree, or from origin/fix/rehearsal-never-writes-the-record.
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure, 2 if PGlite is not available. SYNTHETIC
 *               data only — no customer from any tenant.
 * ⚠️ NOT in `npm run verify` (PGlite is not a dependency; Postgres 18 vs Supabase's older major).
 *
 * Run: PGLITE_DIR=/tmp/pgl/node_modules npx tsx scripts/sql-harness/contact-writers-335.pglite.mts
 */
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const pgliteDir = process.env.PGLITE_DIR;
if (!pgliteDir) { console.error('Set PGLITE_DIR to a node_modules folder containing @electric-sql/pglite.'); process.exit(2); }
const { PGlite } = await import(pgliteDir.replace(/\/$/, '') + '/@electric-sql/pglite/dist/index.js') as any;
const ROOT = (process.env.WRITERS_ROOT ?? process.cwd()).replace(/\/$/, '');
const { findOrCreateCustomer } = await import(`${ROOT}/packages/shared/src/business-logic/customerUpsert.ts`);
const { saveCustomerAddress, readCustomerAddresses } = await import(`${ROOT}/packages/shared/src/business-logic/customerAddresses.ts`);
const { adaptCustomers } = await import(`${ROOT}/packages/shared/src/quickbooks/qboCustomerAdapter.ts`);
const { commitCustomerImport, undoCustomerImport } = await import(`${ROOT}/packages/shared/src/quickbooks/customerImportWriter.ts`);
const fieldWrite = existsSync(`${ROOT}/packages/shared/src/business-logic/customerFieldWrite.ts`)
  ? await import(`${ROOT}/packages/shared/src/business-logic/customerFieldWrite.ts`) : null;

const MIG = process.cwd() + '/supabase/migrations/';
const M = (f: string) => readFileSync(MIG + f, 'utf8');
const C16_FILE = '20260916c_practice_orders_and_one_unit_undo.sql';
const C16 = existsSync(MIG + C16_FILE) ? M(C16_FILE)
  : execSync(`git show origin/fix/rehearsal-never-writes-the-record:supabase/migrations/${C16_FILE}`, { encoding: 'utf8' });
const B = 'b0000000-0000-0000-0000-00000000000b';
let fails = 0;
const ok = (c: boolean, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

// ── a PostgREST-shaped client over PGlite (only what these writers call) ───────────────────────
function rest(db: any) {
  const q = (s: string) => `"${s.trim()}"`;
  class Query implements PromiseLike<any> {
    verb = 'select'; cols = '*'; rows: any[] = []; patch: any = {}; where: string[] = []; params: any[] = [];
    orders: string[] = []; lim: number | null = null; off: number | null = null; count = false; head = false;
    returning: string | null = null; mode: 'many' | 'one' | 'maybe' = 'many';
    constructor(public table: string) {}
    p(v: any) { this.params.push(v === null || v === undefined ? null : Array.isArray(v) ? v : typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v); return `$${this.params.length}`; }
    select(cols = '*', opts?: any) { if (this.verb === 'select') { this.cols = cols; this.count = !!opts?.count; this.head = !!opts?.head; } else this.returning = cols; return this; }
    insert(r: any) { this.verb = 'insert'; this.rows = Array.isArray(r) ? r : [r]; return this; }
    update(p: any) { this.verb = 'update'; this.patch = p; return this; }
    delete() { this.verb = 'delete'; return this; }
    eq(c: string, v: any) { this.where.push(`${q(c)}::text = ${this.p(String(v))}::text`); return this; }
    neq(c: string, v: any) { this.where.push(`${q(c)}::text <> ${this.p(String(v))}::text`); return this; }
    in(c: string, vs: any[]) { this.where.push(`${q(c)}::text = ANY(${this.p(vs.map(String))}::text[])`); return this; }
    is(c: string, v: any) { this.where.push(v === null ? `${q(c)} IS NULL` : `${q(c)} IS ${v ? 'TRUE' : 'FALSE'}`); return this; }
    not(c: string, op: string, v: any) { if (op === 'is' && v === null) this.where.push(`${q(c)} IS NOT NULL`); else throw new Error('adapter: not.' + op); return this; }
    or(expr: string) {
      const parts = expr.split(',').map(part => {
        const [c, o, ...r] = part.split('.'); const v = r.join('.');
        if (o === 'is' && v === 'null') return `${q(c)} IS NULL`;
        if (o === 'neq') return `${q(c)}::text <> ${this.p(v)}::text`;
        if (o === 'eq') return `${q(c)}::text = ${this.p(v)}::text`;
        throw new Error('adapter: or.' + o);
      });
      this.where.push(`(${parts.join(' OR ')})`); return this;
    }
    order(c: string, o?: { ascending?: boolean }) { this.orders.push(`${q(c)} ${o?.ascending === false ? 'DESC' : 'ASC'}`); return this; }
    limit(n: number) { this.lim = n; return this; }
    range(a: number, b: number) { this.off = a; this.lim = b - a + 1; return this; }
    single() { this.mode = 'one'; return this.run(); }
    maybeSingle() { this.mode = 'maybe'; return this.run(); }
    then(res: any, rej?: any) { return this.run().then(res, rej); }
    sql(): string {
      const w = this.where.length ? ` WHERE ${this.where.join(' AND ')}` : '';
      const cols = (c: string | null) => (c ?? 'id').split(',').map(x => x.trim()).filter(Boolean).map(x => x === '*' ? '*' : q(x)).join(', ');
      if (this.verb === 'select') {
        if (this.count) return `SELECT count(*)::int AS n FROM public.${q(this.table)}${w}`;
        return `SELECT ${cols(this.cols)} FROM public.${q(this.table)}${w}${this.orders.length ? ' ORDER BY ' + this.orders.join(', ') : ''}${this.lim !== null ? ` LIMIT ${this.lim}` : ''}${this.off !== null ? ` OFFSET ${this.off}` : ''}`;
      }
      const ret = ` RETURNING ${this.returning ? cols(this.returning) : 'id'}`;
      if (this.verb === 'insert') {
        const keys = [...new Set(this.rows.flatMap(r => Object.keys(r)))];
        const values = this.rows.map(r => `(${keys.map(k => (k in r ? this.p(r[k]) : 'DEFAULT')).join(', ')})`).join(', ');
        return `INSERT INTO public.${q(this.table)} (${keys.map(q).join(', ')}) VALUES ${values}${ret}`;
      }
      if (this.verb === 'update') {
        const set = Object.entries(this.patch).map(([k, v]) => `${q(k)} = ${this.p(v)}`).join(', ');
        // the WHERE params were pushed first; re-number by building SET first
        return `UPDATE public.${q(this.table)} SET ${set}${w}${ret}`;
      }
      return `DELETE FROM public.${q(this.table)}${w}${ret}`;
    }
    async run(): Promise<any> {
      try {
        let text: string;
        if (this.verb === 'update') {
          // SET params must be numbered before WHERE params: rebuild with SET first.
          const whereParams = this.params; this.params = [];
          const set = Object.entries(this.patch).map(([k, v]) => `${q(k)} = ${this.p(v)}`).join(', ');
          const offset = this.params.length;
          const w = this.where.map(x => x.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + offset}`));
          this.params.push(...whereParams);
          text = `UPDATE public.${q(this.table)} SET ${set}${w.length ? ' WHERE ' + w.join(' AND ') : ''} RETURNING ${this.returning ? this.returning.split(',').map(x => q(x)).join(', ') : 'id'}`;
        } else text = this.sql();
        const res = await db.query(text, this.params);
        if (this.count) return { data: this.head ? null : [], error: null, count: res.rows[0].n };
        const rows = res.rows;
        if (this.mode === 'one') return rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { code: 'PGRST116', message: `expected one row, got ${rows.length}` } };
        if (this.mode === 'maybe') return { data: rows[0] ?? null, error: null };
        return { data: rows, error: null, count: rows.length };
      } catch (e: any) {
        return { data: null, error: { code: e.code, message: e.message }, count: null };
      }
    }
  }
  return { from: (t: string) => new Query(t) };
}

async function fresh() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE businesses (id uuid PRIMARY KEY, qbo_writes_enabled boolean NOT NULL DEFAULT false);
    INSERT INTO businesses VALUES ('${B}', false);
    CREATE FUNCTION public.is_active_member(uuid) RETURNS boolean LANGUAGE sql AS 'select true';
    CREATE FUNCTION public.has_permission(uuid, text) RETURNS boolean LANGUAGE sql AS 'select true';
    CREATE FUNCTION public.set_updated_at_generic() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $f$;
    CREATE TABLE people (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), auth_user_id uuid, first_name text, last_name text,
      full_name text, email text, phone text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
    CREATE TABLE customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id),
      first_name text, last_name text, email text, phone text, address_line1 text, city text, state text, zip text,
      qb_customer_id text, marketing_opt_in boolean, source text, created_at timestamptz DEFAULT now(), person_id uuid,
      price_tier text, customer_type text, tax_exempt boolean, tax_exempt_reason text, tax_exempt_cert_ref text,
      organization_name text, display_name text, billing_line1 text, billing_line2 text, billing_city text,
      billing_state text, billing_zip text, status text, updated_at timestamptz DEFAULT now(), notes text, import_run_id uuid);
    CREATE UNIQUE INDEX customers_business_qb_customer_uidx ON customers (business_id, qb_customer_id);
    CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
    CREATE TABLE business_inventory (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL,
      name text, import_run_id uuid, retired_at timestamptz, retired_reason text, retired_by_run_id uuid, created_at timestamptz DEFAULT now());
    CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL,
      customer_id uuid REFERENCES customers(id) ON DELETE RESTRICT, order_kind text);
    CREATE TABLE order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id),
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
  await db.exec(M('20260915_backfill_legacy_customer_address.sql'));
  await db.exec(M('20260915_contact_record.sql'));
  await db.exec(M('20260916d_contact_rows_leave_with_their_run.sql'));
  return db;
}
const one = async (db: any, sql: string, p: any[] = []) => (await db.query(sql, p)).rows[0];
const flat = (db: any, id: string) => one(db, `select phone, email, billing_line1, billing_city from customers where id = $1`, [id]);
const shipTo = async (api: any, id: string) => {
  const book = await readCustomerAddresses(api, B, id);
  return saveCustomerAddress(api, { businessId: B, customerId: id, label: 'Job site', address: { line1: '9 Site Rd', city: 'Austin', zip: '78701' }, existing: book.ok ? book.sites : [] });
};
async function saveThenShipTo(label: string, save: (api: any, db: any) => Promise<string | null>, expect: { phone: string; email: string | null; street: string | null }) {
  const db = await fresh(); const api = rest(db);
  let id: string | null = null; let err: string | null = null;
  try { id = await save(api, db); } catch (e: any) { err = String(e.message).slice(0, 120); }
  if (!id) { ok(false, `${label}: the save itself failed — ${err ?? 'no id'}`); return; }
  const before = await flat(db, id);
  ok(before.phone === expect.phone && before.email === expect.email && before.billing_line1 === expect.street,
    `${label}: the save landed — ${JSON.stringify([before.phone, before.email, before.billing_line1])}`);
  const s = await shipTo(api, id);
  const after = await flat(db, id);
  ok(s.kind === 'saved' && after.phone === before.phone && after.email === before.email && after.billing_line1 === before.billing_line1,
    `🔴 ${label}: a ship-to save afterwards loses NOTHING (${s.kind}) — ${JSON.stringify([after.phone, after.email, after.billing_line1])}`);
}

// W1 — OCR capture (new customer)
await saveThenShipTo('W1 OCR capture, new customer', async (api) =>
  (await findOrCreateCustomer(api, B, { first_name: 'Olive', last_name: 'Ocr', email: 'olive@example.com', phone: '(512) 555-0101', billing_line1: '1 Ocr St', billing_city: 'Leander' }, 'ocr-invoice')).customerId,
  { phone: '(512) 555-0101', email: 'olive@example.com', street: '1 Ocr St' });

// W2 — checkout, repeat customer: a different phone is ADDED, the curated one stays shown
await saveThenShipTo('W2 checkout, repeat customer', async (api) => {
  const first = await findOrCreateCustomer(api, B, { first_name: 'Rita', last_name: 'Repeat', email: 'rita@example.com', phone: '(512) 555-0202', billing_line1: '2 Home Rd', billing_city: 'Cedar Park' }, 'qr-scan');
  const again = await findOrCreateCustomer(api, B, { first_name: 'Rita', last_name: 'Repeat', email: 'rita@example.com', phone: '(512) 555-0299' }, 'qr-scan');
  if (again.customerId !== first.customerId) throw new Error('the repeat was not matched');
  return first.customerId;
}, { phone: '(512) 555-0202', email: 'rita@example.com', street: '2 Home Rd' });

// W3 — delivery ingest (caller-resolved customer, QuickBooks id, phone only)
await saveThenShipTo('W3 delivery ingest, caller-resolved', async (api, db) => {
  const c = await one(db, `insert into customers (business_id, first_name, qb_customer_id) values ($1, 'Ivan', '77') returning id`, [B]);
  return (await findOrCreateCustomer(api, B, { first_name: 'Ivan', last_name: 'Ingest', phone: '(512) 555-0303', qb_customer_id: '77' }, 'shipdate-ingest', { resolvedCustomerId: c.id })).customerId;
}, { phone: '(512) 555-0303', email: null, street: null });

// W4 — the customer editor, editing an existing customer
if (fieldWrite) {
  await saveThenShipTo('W4 customer editor, edit', async (api) => {
    const c = await findOrCreateCustomer(api, B, { first_name: 'Eddie', last_name: 'Edit', email: 'old@example.com', phone: '(512) 555-0404', billing_line1: '4 Old Rd', billing_city: 'Austin' }, 'qr-scan');
    const r = await fieldWrite.updateCustomerFields(api, { id: c.customerId, businessId: B, patch: { phone: '(512) 555-0444', email: 'new@example.com', billing_line1: '44 New Rd', notes: 'edited' } });
    if (r.error || r.zeroRows) throw new Error(r.error ?? 'zero rows');
    return c.customerId;
  }, { phone: '(512) 555-0444', email: 'new@example.com', street: '44 New Rd' });
  // W5 — the customer editor, creating
  await saveThenShipTo('W5 customer editor, create', async (api) => {
    const r = await fieldWrite.insertCustomerFields(api, { businessId: B, values: { first_name: 'Cara', last_name: 'Create', phone: '(512) 555-0505', email: 'cara@example.com', billing_line1: '5 Made Ln', billing_city: 'Round Rock' } });
    if (r.error) throw new Error(r.error);
    return r.id;
  }, { phone: '(512) 555-0505', email: 'cara@example.com', street: '5 Made Ln' });
} else {
  ok(false, 'W4/W5 customer editor: this checkout has no shared editor write (customerFieldWrite.ts) — the editor writes customers.phone directly');
}

// W6 — the QuickBooks import (tagged), a ship-to save, then the customer-import undo
{
  const db = await fresh(); const api = rest(db);
  const RUN = '11111111-1111-1111-1111-111111111111';
  const body = JSON.stringify({ QueryResponse: { Customer: [
    { Id: '501', DisplayName: 'Quinn Import', GivenName: 'Quinn', FamilyName: 'Import', PrimaryPhone: { FreeFormNumber: '(512) 555-0601' },
      PrimaryEmailAddr: { Address: 'quinn@example.com' }, BillAddr: { Line1: '(512) 555-0602 - cell', Line2: '6 Import Way', City: 'Leander', CountrySubDivisionCode: 'TX', PostalCode: '78641' } },
    { Id: '502', DisplayName: 'Kept Person', GivenName: 'Kept', FamilyName: 'Person', PrimaryEmailAddr: { Address: 'a@example.com, b@example.com' } },
  ] } });
  let err: string | null = null; let run: any = null;
  try { run = await commitCustomerImport(api, B, adaptCustomers([body]), RUN); } catch (e: any) { err = String(e.message).slice(0, 160); }
  ok(err === null && run?.created === 2, `W6 the import commits (${err ?? `created ${run?.created}`})`);
  if (run) {
    const q = await one(db, `select id from customers where qb_customer_id = '501'`);
    const k = await one(db, `select id from customers where qb_customer_id = '502'`);
    const f = await flat(db, q.id);
    ok(f.phone === '(512) 555-0601' && f.email === 'quinn@example.com' && f.billing_line1 === '6 Import Way',
      `W6 the imported customer shows its phone, email and the REAL street (not the phone in Line1) — ${JSON.stringify([f.phone, f.email, f.billing_line1])}`);
    const cell = await one(db, `select note, is_primary, import_run_id from customer_phones where customer_id = $1 and value = '(512) 555-0602'`, [q.id]);
    ok(cell?.note === 'cell' && cell?.is_primary === false && cell?.import_run_id === RUN, 'W6 the phone from Line1 is a non-primary phone with its note, tagged with the run');
    ok((await one(db, `select count(*)::int n from customer_emails where customer_id = $1`, [k.id])).n === 2, 'W6 the two-address email field is two rows');
    ok((await one(db, `select count(*)::int n from (select import_run_id from customer_phones union all select import_run_id from customer_emails union all select import_run_id from customer_addresses) x where import_run_id is distinct from $1`, [RUN])).n === 0,
      '🔴 W6 every contact row the import wrote carries the run id');
    const s = await shipTo(api, q.id);
    const after = await flat(db, q.id);
    ok(s.kind === 'saved' && after.phone === f.phone && after.email === f.email && after.billing_line1 === f.billing_line1,
      `🔴 W6 a ship-to save on an imported customer loses NOTHING — ${JSON.stringify([after.phone, after.email, after.billing_line1])}`);
    // the ship-to site is a person's act (no run tag) → the undo must block Quinn and remove Kept
    const u = await undoCustomerImport(api, B, RUN, undefined);
    ok(u.deleted === 1 && u.blocked.length === 1 && u.blocked[0].customerId === q.id,
      `🔴 W7 the customer-import undo removes the untouched customer and BLOCKS the one with a hand-saved site (deleted ${u.deleted}, blocked ${u.blocked.map((b: any) => b.displayName).join(',')})`);
    ok((await one(db, `select count(*)::int n from customer_emails where customer_id = $1`, [k.id])).n === 0, 'W7 …and the removed customer\'s contact rows went with it');
    ok((await one(db, `select count(*)::int n from customer_phones where customer_id = $1`, [q.id])).n === 2, 'W7 …and the blocked customer keeps every row');
  }
}

// W8 — the guard, against the real trigger, through the client
{
  const db = await fresh(); const api = rest(db);
  const c = await findOrCreateCustomer(api, B, { first_name: 'Gus', last_name: 'Guard', phone: '(512) 555-0808' }, 'qr-scan');
  const r = await api.from('customers').update({ phone: '(512) 555-0000' }).eq('id', c.customerId).select('id');
  ok(r.error?.code === 'P0001' && /contact lists/.test(r.error.message), `🔴 W8 a direct phone write is REFUSED with a sentence — ${r.error?.message?.slice(0, 70)}`);
  const r2 = await api.from('customers').insert({ business_id: B, first_name: 'X', email: 'x@example.com' }).select('id');
  ok(r2.error?.code === 'P0001', 'W8 …and a direct insert carrying an email');
  ok((await flat(db, c.customerId)).phone === '(512) 555-0808', 'W8 …and nothing changed');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
