/**
 * ── contactWriter — what actually lands, and what must never land ────────────────────────────
 *
 * WHAT THIS GUARDS (ledger #335, tech-debt #306):
 *   · 🔴 `value_norm` IS NEVER SENT. The database trigger owns the normalisation, so a payload
 *     carrying it would be a SECOND implementation of one rule — the STD-011 defect this build
 *     exists to remove. §B asserts its absence from every row of every payload.
 *   · 🔴 THIS MODULE NEVER WRITES `customers`. The flat columns are derived by trigger; a write
 *     here would make two authors of one fact. §C drives the real write path against the double
 *     and asserts the exact set of tables touched — by ACT, not by reading the source.
 *   · 🔴 #306: importing the same customers TWICE lands ZERO new rows and raises NO error (§F),
 *     a genuinely new number on an existing customer IS added (§G), and the migration's seed does
 *     not make the FIRST run error (§H).
 *   · #179: the column lists are asserted against what the MIGRATIONS create, in both directions.
 *
 * 🔴 THE DOUBLE REFUSES WHAT POSTGRES REFUSES (§6 r19 / R-33 / tech-debt #138). #306 existed
 * because the previous double answered ANY collision with "success, zero rows" — a behaviour real
 * Postgres does not have. This one enforces every unique index `20260911b` and `20260915` create,
 * WITH their predicates, and answers the way Postgres was MEASURED to answer (PGlite, 2026-09-16):
 *   · a collision on a partial index, conflict target = the primary key → 23505, NOT a skip;
 *   · `onConflict` naming columns of a PARTIAL index (no predicate — PostgREST cannot send one)
 *     → 42P10 "no unique or exclusion constraint matching the ON CONFLICT specification".
 * §I proves the double's index set IS the migrations' index set, so it cannot quietly fall behind.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/contactWriter.test.ts --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  planContactRows, reconcileContactRows, writeContactRecord,
  CONTACT_PHONE_COLUMNS, CONTACT_EMAIL_COLUMNS, CONTACT_ADDRESS_READ_COLUMNS,
} from './contactWriter';
import { buildContactRecord } from './contactRecord';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg);
}

type Row = Record<string, unknown>;
type Table = 'customer_phones' | 'customer_emails' | 'customer_addresses';
interface Call { table: string; op: string; rows: Row[]; opts: unknown }
interface PgError { message: string; code: string }

// ── THE DATABASE, AS FAR AS THESE THREE TABLES GO ───────────────────────────────────────────
// Each index: its NAME (asserted against the migrations in §I) and the key a row occupies in it,
// or null when the index PREDICATE excludes the row — which is what makes it partial.
const bc = (r: Row) => `${String(r.business_id)}|${String(r.customer_id)}`;
const INDEXES: Record<Table, { name: string; key: (r: Row) => string | null }[]> = {
  customer_phones: [
    { name: 'customer_phones_one_primary', key: r => (r.is_primary && r.active ? bc(r) : null) },
    { name: 'customer_phones_one_per_value', key: r => (r.active && r.value_norm != null ? `${bc(r)}|${String(r.value_norm)}` : null) },
  ],
  customer_emails: [
    { name: 'customer_emails_one_primary', key: r => (r.is_primary && r.active ? bc(r) : null) },
    { name: 'customer_emails_one_per_value', key: r => (r.active && r.value_norm != null ? `${bc(r)}|${String(r.value_norm)}` : null) },
  ],
  customer_addresses: [
    { name: 'customer_addresses_one_default', key: r => (r.is_default && r.active ? bc(r) : null) },
    { name: 'customer_addresses_one_label', key: r => (r.active ? `${bc(r)}|${String(r.label ?? '').toLowerCase()}` : null) },
  ],
};

// The BEFORE trigger (20260915 §5), restated from the SQL rather than imported from
// contactRecord.ts — the double stands in for the DATABASE, so it must not borrow the app's copy.
function trigger(table: Table, r: Row): Row {
  if (table === 'customer_phones') return { ...r, value_norm: String(r.value ?? '').replace(/\D/g, '') || null };
  if (table === 'customer_emails') return { ...r, value_norm: String(r.value ?? '').trim().toLowerCase() || null };
  return r;
}
const DEFAULTS: Record<Table, Row> = {
  customer_phones: { active: true, is_primary: false },
  customer_emails: { active: true, is_primary: false },
  customer_addresses: { active: true, is_default: false },
};

type Mode = 'ok' | 'deny';

function fakeDb(mode: Mode = 'ok') {
  const calls: Call[] = [];
  const store: Record<Table, Row[]> = { customer_phones: [], customer_emails: [], customer_addresses: [] };
  let seq = 0;

  /** Every unique index checked across the WHOLE table as it would stand — a statement is atomic. */
  const collision = (table: Table, rows: Row[]): string | null => {
    for (const idx of INDEXES[table]) {
      const seen = new Set<string>();
      for (const r of rows) {
        const k = idx.key(r);
        if (k === null) continue;
        if (seen.has(k)) return idx.name;
        seen.add(k);
      }
    }
    return null;
  };
  const dupErr = (name: string): PgError => ({ code: '23505', message: `duplicate key value violates unique constraint "${name}"` });
  const denied: PgError = { code: '42501', message: 'new row violates row-level security policy' };

  const doInsert = (table: Table, rows: Row[]): { data: Row[] | null; error: PgError | null } => {
    if (mode === 'deny') return { data: null, error: denied };
    const fresh = rows.map(r => trigger(table, { ...DEFAULTS[table], ...r, id: `${table}-${++seq}` }));
    const name = collision(table, [...store[table], ...fresh]);
    if (name) return { data: null, error: dupErr(name) };
    store[table].push(...fresh);
    return { data: fresh.map(r => ({ ...r })), error: null };
  };

  class Query implements PromiseLike<{ data: Row[] | null; error: PgError | null }> {
    private filters: ((r: Row) => boolean)[] = [];
    constructor(private table: Table, private run: (match: (r: Row) => boolean) => { data: Row[] | null; error: PgError | null }) {}
    eq(col: string, val: unknown) { this.filters.push(r => r[col] === val); return this; }
    in(col: string, vals: unknown[]) { this.filters.push(r => vals.includes(r[col])); return this; }
    select(_cols?: string) { return this; }
    then<A, B>(res?: ((v: { data: Row[] | null; error: PgError | null }) => A | PromiseLike<A>) | null, rej?: ((e: unknown) => B | PromiseLike<B>) | null) {
      return Promise.resolve(this.run(r => this.filters.every(f => f(r)))).then(res, rej);
    }
  }

  const db = {
    from(t: string) {
      const table = t as Table;
      if (!(table in store)) {
        // A table the double does not model is RECORDED and refused, so a stray write is SEEN.
        const refuse = (op: string) => { calls.push({ table: t, op, rows: [], opts: null }); return new Query(table, () => ({ data: null, error: { code: 'X', message: `unmodelled table ${t}` } })); };
        return { select: () => refuse('select'), insert: () => refuse('insert'), upsert: () => refuse('upsert'), update: () => refuse('update') };
      }
      return {
        select(_cols: string) {
          calls.push({ table, op: 'select', rows: [], opts: null });
          return new Query(table, match => ({ data: store[table].filter(match).map(r => ({ ...r })), error: null }));
        },
        insert(rows: Row[]) {
          calls.push({ table, op: 'insert', rows, opts: null });
          return new Query(table, () => doInsert(table, rows));
        },
        upsert(rows: Row[], opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
          calls.push({ table, op: 'upsert', rows, opts });
          return new Query(table, () => {
            // Every non-PK unique index on these tables is PARTIAL; PostgREST cannot restate a
            // predicate, so Postgres infers no arbiter for a column list. MEASURED: 42P10.
            if (opts.onConflict && opts.onConflict !== 'id') {
              return { data: null, error: { code: '42P10', message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification' } };
            }
            // Conflict target = PK. The rows carry no id, so the arbiter never fires and any
            // partial-index collision RAISES — `ignoreDuplicates` does not absorb it. MEASURED: 23505.
            return doInsert(table, rows);
          });
        },
        update(patch: Row) {
          calls.push({ table, op: 'update', rows: [patch], opts: null });
          return new Query(table, match => {
            if (mode === 'deny') return { data: null, error: denied };
            const next = store[table].map(r => (match(r) ? trigger(table, { ...r, ...patch }) : r));
            const name = collision(table, next);
            if (name) return { data: null, error: dupErr(name) };
            const hit = next.filter((r, i) => r !== store[table][i]);
            store[table] = next;
            return { data: hit.map(r => ({ ...r })), error: null };
          });
        },
      };
    },
  } as unknown as SupabaseClient;

  const active = (table: Table, cust = CUST) => store[table].filter(r => r.customer_id === cust && r.active);
  /** Rows as a migration would have put them — straight into the store, through the trigger. */
  const seed = (table: Table, rows: Row[]) => {
    for (const r of rows) store[table].push(trigger(table, { ...DEFAULTS[table], business_id: BIZ, customer_id: CUST, id: `seed-${++seq}`, ...r }));
  };
  return { db, calls, store, active, seed };
}

const BIZ = 'b-1', CUST = 'c-1';
const FULL = buildContactRecord({
  Id: '1', DisplayName: 'AGAVE LD LLC',
  PrimaryPhone: { FreeFormNumber: '(512) 111-2222' },
  PrimaryEmailAddr: { Address: 'terry@lawnstrees.com' },
  BillAddr: { Line1: '(737) 348-9534', Line2: '501 County Road 107', City: 'Georgetown', PostalCode: '78628' },
});

async function main(): Promise<void> {
  // ══ A. THE PLAN IS THE WRITE — shape, before any client is involved ═════════════════════════
  {
    const plan = planContactRows(BIZ, CUST, FULL);
    ok(plan.phones.length === 2, `A1 both numbers are planned (got ${plan.phones.length})`);
    ok(plan.addresses.length === 1 && plan.addresses[0].line1 === '501 County Road 107',
      'A2 the recovered street is planned');
    ok(plan.emails.length === 1, 'A3 the email is planned');
    ok(plan.phones.every(r => r.business_id === BIZ && r.customer_id === CUST),
      'A4 🔴 every row is scoped to the business AND the customer (AC-3)');
    ok(plan.addresses[0].kind === 'billing', 'A5 the address carries its kind');
    // The negative control: an empty record plans nothing rather than one blank row.
    const empty = planContactRows(BIZ, CUST, buildContactRecord({ Id: '2', DisplayName: 'Nobody' }));
    ok(empty.phones.length === 0 && empty.emails.length === 0 && empty.addresses.length === 0,
      'A6 a record with no contact details plans NO rows (absent ≠ empty — A9)');
  }

  // ══ B. 🔴 `value_norm` IS NEVER SENT ════════════════════════════════════════════════════════
  {
    const plan = planContactRows(BIZ, CUST, FULL);
    const all = [...plan.phones, ...plan.emails, ...plan.addresses];
    ok(all.length > 0, 'B1 the probe REACHED some rows (it can fail)');
    ok(all.every(r => !('value_norm' in r)),
      'B2 🔴 no payload carries `value_norm` — the trigger owns the normalisation, and two homes for one rule is the defect being fixed');
    ok(all.every(r => !('id' in r) && !('created_at' in r) && !('updated_at' in r)),
      'B3 no payload carries a system-managed column (§6 r13)');
  }

  // ══ C. 🔴 THE TABLES TOUCHED — BY ACT, NOT BY READING THE SOURCE ════════════════════════════
  {
    const { db, calls } = fakeDb();
    const out = await writeContactRecord(db, BIZ, CUST, FULL);
    ok(out.ok === true, `C1 a clean write succeeds (${out.ok ? '' : out.error})`);
    ok(out.ok === true && out.landed.phones === 2 && out.planned.phones === 2,
      'C1b 🔴 the LANDED count is read back from the write, not assumed from the plan (A8)');
    const tables = [...new Set(calls.map(c => c.table))].sort();
    ok(tables.join(',') === 'customer_addresses,customer_emails,customer_phones',
      `C2 🔴 exactly three tables are touched (got ${tables.join(',')})`);
    ok(!tables.includes('customers'),
      'C3 🔴 `customers` is NEVER written — the flat columns are derived, and a second author would drift');
    ok(!tables.includes('deliveries'),
      'C4 `deliveries` is never written — D-41\'s invariant is not this module\'s to break');
    ok(!calls.some(c => c.op === 'upsert'),
      'C5 🔴 #306: NO upsert. Every unique key here is PARTIAL, so no conflict target PostgREST can name will arbitrate it');
    ok(calls.filter(c => c.op !== 'select').every(c => c.op === 'insert' || (c.op === 'update' && c.table === 'customer_addresses')),
      'C6 writes are INSERTs, plus the one address retirement — nothing else');
  }

  // ══ D. REFUSALS ARE VALUES ══════════════════════════════════════════════════════════════════
  {
    const { db } = fakeDb('deny');
    const out = await writeContactRecord(db, BIZ, CUST, FULL);
    ok(out.ok === false, 'D1 a permission error is reported, not swallowed');
    ok(out.ok === false && out.error.includes('customer_phones'),
      'D2 …and it names the table that refused');

    const emptyRec = buildContactRecord({ Id: '3', DisplayName: 'Nobody' });
    const none = fakeDb();
    const out3 = await writeContactRecord(none.db, BIZ, CUST, emptyRec);
    ok(out3.ok === true && none.calls.filter(c => c.op !== 'select').length === 0,
      'D4 a record with nothing to write performs NO write at all');
  }

  // ══ F. 🔴 #306 — THE SAME CUSTOMERS IMPORTED TWICE: ZERO NEW ROWS, NO ERROR ══════════════════
  {
    const TWO = buildContactRecord({
      Id: '9', DisplayName: 'Two Numbers',
      PrimaryPhone: { FreeFormNumber: '(512) 111-2222' }, Mobile: { FreeFormNumber: '512-333-4444' },
      PrimaryEmailAddr: { Address: 'two@example.com' },
      BillAddr: { Line1: '1 Oak St', City: 'Leander', PostalCode: '78641' },
      ShipAddr: { Line1: '9 Elm Rd', City: 'Cedar Park', PostalCode: '78613' },
    });
    for (const [label, rec] of [['FULL', FULL], ['TWO', TWO]] as const) {
      const f = fakeDb();
      const first = await writeContactRecord(f.db, BIZ, CUST, rec);
      const counts = () => ({ p: f.store.customer_phones.length, e: f.store.customer_emails.length, a: f.store.customer_addresses.length });
      const after1 = counts();
      ok(first.ok === true && after1.p > 0 && after1.a > 0, `F1-${label} the first run lands rows (${JSON.stringify(after1)})`);
      const second = await writeContactRecord(f.db, BIZ, CUST, rec);
      ok(second.ok === true, `F2-${label} 🔴 the SECOND run raises NO error (${second.ok ? 'ok' : second.error})`);
      ok(JSON.stringify(counts()) === JSON.stringify(after1),
        `F3-${label} 🔴 the second run creates ZERO new rows (before ${JSON.stringify(after1)}, after ${JSON.stringify(counts())})`);
      ok(second.ok === true && second.landed.phones === 0 && second.landed.emails === 0 && second.landed.addresses === 0,
        `F4-${label} …and SAYS so: nothing landed`);
      ok(second.ok === true && second.held.phones === rec.phones.length && second.held.addresses === rec.addresses.length,
        `F5-${label} …and says WHY: every planned row was already held`);
      ok(second.ok === true && second.retired === 0, `F6-${label} a re-import retires nothing`);
    }
    // A DIFFERENT SPELLING of a held number is the same number — the trigger's normalisation decides.
    const f = fakeDb();
    await writeContactRecord(f.db, BIZ, CUST, FULL);
    const respelled = buildContactRecord({ Id: '1', DisplayName: 'AGAVE LD LLC', PrimaryPhone: { FreeFormNumber: '512.111.2222' } });
    const again = await writeContactRecord(f.db, BIZ, CUST, respelled);
    ok(again.ok === true && f.active('customer_phones').length === 2,
      'F7 a re-spelled number (512.111.2222 vs (512) 111-2222) is ONE number — no third row, no error');

    // 🔴 THE NEGATIVE CONTROL — the defect #306 names, reproduced against this double. If this ever
    // stops failing, the double has gone soft again and every assertion above is decoration.
    const g = fakeDb();
    const plan = planContactRows(BIZ, CUST, FULL);
    await g.db.from('customer_phones').insert(plan.phones).select('id');
    const old = await g.db.from('customer_phones').upsert(plan.phones, { ignoreDuplicates: true }).select('id');
    ok(old.error?.code === '23505',
      `F8 🔴 the OLD write (upsert, ignoreDuplicates, PK target) RAISES on a re-import — the defect is reachable (got ${old.error?.code ?? 'no error'})`);
    const named = await g.db.from('customer_phones').upsert(plan.phones, { onConflict: 'business_id,customer_id,value_norm', ignoreDuplicates: true }).select('id');
    ok(named.error?.code === '42P10',
      `F9 🔴 naming the partial index's columns in onConflict is REFUSED outright (got ${named.error?.code ?? 'no error'})`);
  }

  // ══ G. 🔴 A GENUINELY NEW NUMBER ON AN EXISTING CUSTOMER IS ADDED ═══════════════════════════
  {
    const f = fakeDb();
    await writeContactRecord(f.db, BIZ, CUST, buildContactRecord({
      Id: '5', DisplayName: 'Grows', PrimaryPhone: { FreeFormNumber: '(512) 111-2222' },
    }));
    // QuickBooks now carries a DIFFERENT primary number, plus a mobile.
    const later = buildContactRecord({
      Id: '5', DisplayName: 'Grows',
      PrimaryPhone: { FreeFormNumber: '(512) 999-0000' }, Mobile: { FreeFormNumber: '(512) 111-2222' },
      PrimaryEmailAddr: { Address: 'new@example.com' },
    });
    const out = await writeContactRecord(f.db, BIZ, CUST, later);
    const phones = f.active('customer_phones');
    ok(out.ok === true, `G1 🔴 adding to an existing customer raises no error (${out.ok ? 'ok' : out.error})`);
    ok(phones.some(p => p.value_norm === '5129990000'), 'G2 🔴 the NEW number IS added');
    ok(phones.length === 2, `G3 …and the held one is not added twice (got ${phones.length})`);
    ok(phones.filter(p => p.is_primary).length === 1 && phones.find(p => p.is_primary)?.value_norm === '5121112222',
      'G4 🔴 exactly ONE primary, and it is the one already held — an import never demotes what is on file');
    ok(out.ok === true && out.landed.phones === 1 && out.held.phones === 1, 'G5 the counts say one new, one held');
    ok(f.active('customer_emails').length === 1 && f.active('customer_emails')[0].is_primary === true,
      'G6 a customer with NO email gets the imported one as primary');
    // Planning is PURE — the same decision is visible without a client.
    const r = reconcileContactRows(planContactRows(BIZ, CUST, later), {
      phones: [{ value_norm: '5121112222', is_primary: true }], emails: [], addresses: [],
    });
    ok(r.insert.phones.length === 1 && r.insert.phones[0].is_primary === false,
      'G7 reconcile (pure): the new number is planned NON-primary when a primary is already held');
  }

  // ══ H. 🔴 THE SEED — `20260915` §5b puts each customer's flat values into the lists FIRST ═════
  {
    // The LAWNS shape, measured 2026-09-16: 464 customers whose billing street IS their phone,
    // because the old importer never read BillAddr.Line2 (tech-debt #254). The seed copies it.
    const f = fakeDb();
    f.seed('customer_phones', [{ label: 'main', value: '(737) 348-9534', is_primary: true, source: 'migrated:customers.phone' }]);
    f.seed('customer_emails', [{ label: 'main', value: 'Terry@LawnsTrees.com', is_primary: true, source: 'migrated:customers.email' }]);
    f.seed('customer_addresses', [{ label: 'Billing', kind: 'billing', line1: '(737) 348-9534', city: 'Georgetown', zip: '78628', is_default: true, source: 'migrated:customers.billing_*' }]);
    const PHONE_STREET = buildContactRecord({
      Id: '1', DisplayName: 'AGAVE LD LLC',
      PrimaryPhone: { FreeFormNumber: '(737) 348-9534' },
      PrimaryEmailAddr: { Address: 'terry@lawnstrees.com' },
      BillAddr: { Line1: '(737) 348-9534', Line2: '501 County Road 107', City: 'Georgetown', PostalCode: '78628' },
    });
    const out = await writeContactRecord(f.db, BIZ, CUST, PHONE_STREET);
    ok(out.ok === true, `H1 🔴 the FIRST import after the seed raises NO error — #306's "why it matters now" (${out.ok ? 'ok' : out.error})`);
    ok(f.active('customer_phones').length === 1 && f.active('customer_emails').length === 1,
      'H2 the seeded phone and email are recognised as held — no duplicate');
    const addrs = f.active('customer_addresses');
    const def = addrs.filter(a => a.is_default);
    ok(def.length === 1 && def[0].line1 === '501 County Road 107',
      `H3 🔴 the default address is now the REAL street, not the phone (got ${def.map(a => String(a.line1)).join(',')})`);
    const retired = f.store.customer_addresses.filter(a => !a.active);
    ok(retired.length === 1 && retired[0].source === 'migrated:customers.billing_*',
      'H4 🔴 the seeded row is RETIRED (active = false), not deleted — R-133');
    ok(out.ok === true && out.retired === 1, 'H5 …and the outcome counts it');
    // Re-run: still idempotent after a supersede.
    const before = f.store.customer_addresses.length;
    const again = await writeContactRecord(f.db, BIZ, CUST, PHONE_STREET);
    ok(again.ok === true && f.store.customer_addresses.length === before && again.ok && again.retired === 0,
      'H6 a second run after the supersede changes nothing');

    // A seed that AGREES with QuickBooks is simply held — nothing retired.
    const same = fakeDb();
    same.seed('customer_addresses', [{ label: 'Billing', kind: 'billing', line1: '1 Oak St', city: 'Leander', zip: '78641', is_default: true, source: 'migrated:customers.billing_*' }]);
    const o2 = await writeContactRecord(same.db, BIZ, CUST, buildContactRecord({
      Id: '2', DisplayName: 'Same', BillAddr: { Line1: '1 Oak St', City: 'Leander', PostalCode: '78641' },
    }));
    ok(o2.ok === true && o2.retired === 0 && same.store.customer_addresses.length === 1,
      'H7 a seed that matches the import is held, not retired and re-added');
  }

  // ══ J. 🔴 WHAT THE IMPORT NEVER TOUCHES — a row a PERSON wrote, or an earlier import ═════════
  {
    const f = fakeDb();
    // Lauren typed a billing address by hand (the interactive path leaves `source` NULL).
    f.seed('customer_addresses', [{ label: 'Billing', kind: 'billing', line1: '77 Hand St', city: 'Leander', zip: '78641', is_default: true, source: null }]);
    const out = await writeContactRecord(f.db, BIZ, CUST, FULL);
    ok(out.ok === true, `J1 a clash with a hand-entered row raises no error (${out.ok ? 'ok' : out.error})`);
    const hand = f.store.customer_addresses.find(a => a.line1 === '77 Hand St');
    ok(hand?.active === true && hand?.is_default === true, 'J2 🔴 the hand-entered row is untouched — still active, still the default');
    ok(out.ok === true && out.retired === 0, 'J3 nothing is retired');
    ok(out.ok === true && out.notTaken.length === 1 && out.notTaken[0].reason === 'label-held',
      'J4 🔴 the imported address that could not land is REPORTED, not silently dropped');

    // Same label free, only the default taken → the import lands as a NON-default site.
    const g = fakeDb();
    g.seed('customer_addresses', [{ label: 'Yard', kind: 'shipping', line1: '5 Yard Ln', city: 'Leander', zip: '78641', is_default: true, source: null }]);
    const o2 = await writeContactRecord(g.db, BIZ, CUST, FULL);
    const added = g.active('customer_addresses').find(a => a.line1 === '501 County Road 107');
    ok(o2.ok === true && added?.is_default === false, 'J5 the import lands beside a hand-chosen default without taking it');

    // An earlier IMPORT is not a seed either: QuickBooks changed the street → reported, not overwritten.
    const h = fakeDb();
    h.seed('customer_addresses', [{ label: 'Billing', kind: 'billing', line1: '1 Old Rd', city: 'Georgetown', zip: '78628', is_default: true, source: 'quickbooks:BillAddr' }]);
    const o3 = await writeContactRecord(h.db, BIZ, CUST, FULL);
    ok(o3.ok === true && o3.retired === 0 && o3.notTaken.length === 1, 'J6 an earlier import\'s row is never retired by a later one');
  }

  // ══ I. THE DOUBLE'S INDEXES ARE THE MIGRATIONS' INDEXES ═══════════════════════════════════════
  // #182: a double that silently lacks an index answers "success" for a collision the database
  // would refuse. So the population the double models is DERIVED-and-compared, both directions.
  {
    const files = ['20260911b_customer_addresses.sql', '20260915_contact_record.sql'];
    const sqlAll = files.map(fn => readFileSync(join(process.cwd(), 'supabase/migrations', fn), 'utf8')).join('\n');
    const declared = [...sqlAll.matchAll(/CREATE UNIQUE INDEX IF NOT EXISTS (\w+)\s+ON public\.(customer_phones|customer_emails|customer_addresses)/g)]
      .map(m => m[1]).sort();
    const modelled = Object.values(INDEXES).flat().map(i => i.name).sort();
    ok(declared.length >= 6, `I1 the migrations were PARSED (${declared.length} unique indexes) — the probe reached its target`);
    ok(declared.join(',') === modelled.join(','),
      `I2 🔴 the double models EXACTLY the migrations' unique indexes (declared ${declared.join(',')} · modelled ${modelled.join(',')})`);
  }

  // ══ E. #179 — THE COLUMN LIST IS THE MIGRATION'S, IN BOTH DIRECTIONS ════════════════════════
  // `VENDORS_SELECT` named 10 columns while its migration created 14, and the four missing were the
  // ADDRESS. Nothing we own could have caught it: a column with no reader and no writer is invisible
  // to tsc, eslint, knip and every probe. So the list is asserted against the CREATE TABLE.
  {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260915_contact_record.sql'), 'utf8');
    const columnsOf = (table: string): string[] => {
      const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS public.${table}`);
      const block = sql.slice(sql.indexOf('(', start) + 1, sql.indexOf('\n);', start));
      return block.split('\n')
        .map(l => l.replace(/--.*$/, '').trim())
        .filter(l => l && !/^(PRIMARY|UNIQUE|CHECK|CONSTRAINT|FOREIGN)/i.test(l))
        .map(l => l.split(/\s+/)[0]).filter(Boolean);
    };
    for (const [table, list] of [['customer_phones', CONTACT_PHONE_COLUMNS], ['customer_emails', CONTACT_EMAIL_COLUMNS]] as const) {
      const declared = columnsOf(table);
      ok(declared.length > 5, `E1-${table} the migration was PARSED (${declared.length} columns) — the probe reached its target`);
      const selected = list.split(',');
      const missing = selected.filter(c => !declared.includes(c));
      ok(missing.length === 0, `E2-${table} 🔴 every selected column EXISTS in the migration (missing: ${missing.join(',') || 'none'})`);
      const unselected = declared.filter(c => !selected.includes(c) && !['created_at', 'updated_at'].includes(c));
      ok(unselected.length === 0,
        `E3-${table} 🔴 …and every column the migration creates is SELECTED — #179's direction (unselected: ${unselected.join(',') || 'none'})`);
    }
    // The address READ list is deliberately narrow (what the already-held check needs), so only
    // one direction applies: every column it names must exist in a migration that shapes the table.
    const addrSql = ['20260911b_customer_addresses.sql', '20260915_contact_record.sql']
      .map(fn => readFileSync(join(process.cwd(), 'supabase/migrations', fn), 'utf8')).join('\n');
    const created = new Set([
      ...[...addrSql.matchAll(/^\s{2}(\w+)\s+(?:uuid|text|boolean|timestamptz)\b/gm)].map(m => m[1]),
      ...[...addrSql.matchAll(/ALTER TABLE public\.customer_addresses\s+ADD COLUMN IF NOT EXISTS (\w+)/g)].map(m => m[1]),
    ]);
    const addrCols = CONTACT_ADDRESS_READ_COLUMNS.split(',');
    const absent = addrCols.filter(c => !created.has(c));
    ok(created.has('source') && created.has('line1'), 'E4a the address columns were PARSED (source, line1 found)');
    ok(absent.length === 0, `E4 the address read list names only columns the migrations create (absent: ${absent.join(',') || 'none'})`);
  }

  console.log(`\ncontactWriter: ${passed} passed, ${failed} failed`);
  if (failed > 0) { failures.forEach(f => console.error('  \u2717 ' + f)); process.exit(1); }
}

void main();
