/**
 * ── CHECKOUT MUST PERSIST THE EMAIL IT USES — asserted by READING THE ROW BACK ────────────────
 *
 * WHAT THIS GUARDS: that an email typed at the register lands in `customers.email`. Before
 * 2026-08-25 it did not, on the branch that matters most — the REPEAT customer. `findOrCreateCustomer`
 * built its UPDATE payload from an `offer()` list of eight fields and `email` was not one of them,
 * so a new customer got their email (the INSERT carries it as its own literal) and an existing one
 * never did. Measured on customer `0ee368fe-5b2f-4458-a75d-d4498024a605` (Diane Foster): `email` = ''
 * after a checkout that typed one and SENT the invoice to it, `updated_at` stamped the same second
 * as order CLV-20260825-3196, `billing_line1/city/zip` filled correctly from the same payload. The
 * row was written. This one field was not in it.
 *
 * 🔴 WHY EVERY PROBE READS `db.rows.customers[0]` AND NEVER THE RETURN VALUE. The function returns
 * `{ customerId, created }` — it reports WHICH ROW, never WHAT LANDED IN IT. A build that dropped
 * the field again would return an identical, entirely truthful `{ customerId, created:false }`. The
 * only artifact that can disprove the defect is the stored row, so the stored row is what is read.
 * R-12's own reasoning, one layer out: the acknowledgement is not the outcome.
 *
 * THE FOUR CASES THE BUILD PROMISED, each read off the row:
 *     a new email supplied              → stored
 *     an email edited                   → stored, the old value REPLACED (supplied-wins)
 *     the email left blank              → the EXISTING stored value survives untouched
 *     no stored email, none supplied    → still empty, no crash
 *
 * AND THE TWO THIS FIX MUST NOT BREAK, asserted beside them because they are the reason
 * "supplied wins" is one named field and not a policy:
 *     a CURATED phone / address is never clobbered by a counter capture  (rule (b) intact)
 *     a write that matches zero rows — or two — THROWS                   (R-12)
 *
 * Run (pure TS, no deps):
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/customerUpsert.test.ts \
 *     --bundle --platform=node --format=cjs --external:@supabase/supabase-js | node
 */

import { findOrCreateCustomer } from './customerUpsert';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg);
}

// ── THE FAKE DATABASE ────────────────────────────────────────────────────────────────────────
// An in-memory PostgREST-shaped store. It holds REAL ROWS and mutates them, which is the whole
// point: a stub that returns canned responses can only ever prove what the code asked for, never
// what a row ended up holding. `updateMode` reproduces the two write shapes R-12 exists for — a
// success with zero rows affected (what RLS refusal looks like over PostgREST) and a multi-row hit.
type UpdateMode = 'ok' | 'zero_rows' | 'two_rows';

interface Row { [k: string]: unknown }

function fakeDb(seed: { people?: Row[]; customers?: Row[] } = {}, updateMode: UpdateMode = 'ok') {
  const rows: Record<string, Row[]> = {
    people:    (seed.people    ?? []).map(r => ({ ...r })),
    customers: (seed.customers ?? []).map(r => ({ ...r })),
  };
  let nextId = 100;
  const counts = { updates: 0, inserts: 0 };

  function builder(table: string) {
    let op: 'select' | 'insert' | 'update' = 'select';
    let payload: Row = {};
    let cols = '*';
    let lim: number | null = null;
    const filters: Array<{ kind: 'eq' | 'is'; col: string; val: unknown }> = [];

    const match = (r: Row) => filters.every(f =>
      f.kind === 'is' ? (r[f.col] ?? null) === f.val : r[f.col] === f.val);

    const project = (r: Row): Row => {
      if (cols === '*' || cols.includes('*')) return { ...r };
      const keep = cols.split(',').map(c => c.trim());
      const out: Row = {};
      for (const k of keep) out[k] = r[k] ?? null;
      return out;
    };

    function run(shape: 'many' | 'single' | 'maybeSingle') {
      let hits: Row[];
      if (op === 'insert') {
        counts.inserts++;
        const stored: Row = { id: `c-${nextId++}`, ...payload };
        (rows[table] ||= []).push(stored);
        hits = [stored];
      } else if (op === 'update') {
        counts.updates++;
        // 🔴 The two shapes the count check exists for, injected BEFORE any row is touched — a
        // refused write must not also mutate the store, or the probe would prove nothing.
        if (updateMode === 'zero_rows') return Promise.resolve({ data: [], error: null });
        if (updateMode === 'two_rows')  return Promise.resolve({ data: [{ id: 'x' }, { id: 'y' }], error: null });
        hits = (rows[table] ?? []).filter(match);
        for (const r of hits) Object.assign(r, payload);
      } else {
        hits = (rows[table] ?? []).filter(match);
        if (lim !== null) hits = hits.slice(0, lim);
      }
      const out = hits.map(project);
      if (shape === 'single') {
        return Promise.resolve(out.length === 1
          ? { data: out[0], error: null }
          : { data: null, error: { code: 'PGRST116', message: 'not exactly one row' } });
      }
      if (shape === 'maybeSingle') return Promise.resolve({ data: out[0] ?? null, error: null });
      return Promise.resolve({ data: out, error: null });
    }

    const api: any = {
      select(c: string) { if (op === 'select') cols = c; else cols = c; return api; },
      insert(p: Row) { op = 'insert'; payload = { ...p }; return api; },
      update(p: Row) { op = 'update'; payload = { ...p }; return api; },
      eq(col: string, val: unknown) { filters.push({ kind: 'eq', col, val }); return api; },
      is(col: string, val: unknown) { filters.push({ kind: 'is', col, val }); return api; },
      limit(n: number) { lim = n; return api; },
      single() { return run('single'); },
      maybeSingle() { return run('maybeSingle'); },
      then(res: any, rej: any) { return run('many').then(res, rej); },
    };
    return api;
  }

  return { rows, counts, from: (t: string) => builder(t) };
}

const BIZ = 'b-1';
const PHONE = '5125551234';

/** Diane's exact shape: a person already on the spine, reachable by PHONE, whose email is ''. */
function seedRepeatCustomer(over: Row = {}) {
  return {
    people: [{ id: 'p-1', auth_user_id: null, email: null, phone: PHONE, first_name: 'Diane', last_name: 'Foster' }],
    customers: [{
      id: 'cust-1', business_id: BIZ, person_id: 'p-1', customer_type: 'person',
      first_name: 'Diane', last_name: 'Foster', email: '', phone: PHONE,
      address_line1: '904 Hialeah Circle', city: 'Georgetown', state: 'TX', zip: '78628',
      billing_line1: null, billing_city: null, billing_state: null, billing_zip: null,
      marketing_opt_in: null, source: 'ocr-invoice', ...over,
    }],
  };
}

const cust = (db: ReturnType<typeof fakeDb>) => db.rows.customers[0];

async function main() {
  // ── CASE 1 — A NEW EMAIL SUPPLIED FOR A CUSTOMER WHO HAS NONE ───────────────────────────────
  // The measured defect, reproduced field-for-field: Diane's stored email is '', the register
  // types one, the same payload carries the billing address that DID persist.
  {
    const db = fakeDb(seedRepeatCustomer());
    const r = await findOrCreateCustomer(db as any, BIZ, {
      first_name: 'Diane', last_name: 'Foster', email: 'diane@example.com', phone: PHONE,
      address_line1: '100 Main St', city: 'Leander', state: 'TX', zip: '78641',
    }, 'qr-scan');
    ok(r.created === false, 'A1 the repeat customer MATCHED an existing row (no duplicate minted)');
    ok(db.rows.customers.length === 1, 'A1b exactly one customer row exists after the checkout');
    ok(cust(db).email === 'diane@example.com', `A1c THE ROW HOLDS THE TYPED EMAIL — read back: ${JSON.stringify(cust(db).email)}`);
    ok(cust(db).id === 'cust-1', 'A1d the email landed on the SAME row the order attached to');
    // The two facts that made this defect invisible: everything ELSE in the payload behaved.
    ok(cust(db).billing_line1 === '100 Main St', 'A1e billing_line1 still fills from the same payload (the fill that DID work)');
    ok(cust(db).address_line1 === '904 Hialeah Circle', 'A1f the OCR ship-to address is still NOT clobbered (rule (b) intact)');
  }

  // ── CASE 2 — AN EMAIL EDITED: THE OLD VALUE IS REPLACED ─────────────────────────────────────
  // This is the case that makes email SUPPLIED-WINS rather than fill-never-clobber. The register
  // is where a customer says "that address is old" — and the invoice is sent to whatever was typed.
  {
    const db = fakeDb(seedRepeatCustomer({ email: 'old@example.com' }));
    await findOrCreateCustomer(db as any, BIZ, {
      first_name: 'Diane', last_name: 'Foster', email: 'new@example.com', phone: PHONE,
    }, 'qr-scan');
    ok(cust(db).email === 'new@example.com', `A2 an EDITED email REPLACES the stored one — read back: ${JSON.stringify(cust(db).email)}`);
    ok(db.rows.customers.length === 1, 'A2b editing an email did not mint a second customer');
  }

  // ── CASE 3 — THE EMAIL LEFT BLANK: THE STORED VALUE SURVIVES ────────────────────────────────
  // 🔴 THE CLAUSE THAT MATTERS MOST. "Supplied wins" must never mean "absent blanks it" — that
  // would turn this fix into a worse defect than the one it repairs: a curated email destroyed by
  // any checkout that happened not to collect one. All THREE absent shapes are probed, because
  // `''`, `'   '` and `undefined` reach `given()` by different routes.
  for (const [label, value] of [['empty string', ''], ['whitespace', '   '], ['undefined', undefined], ['null', null]] as Array<[string, any]>) {
    const db = fakeDb(seedRepeatCustomer({ email: 'keep@example.com' }));
    await findOrCreateCustomer(db as any, BIZ, {
      first_name: 'Diane', last_name: 'Foster', email: value, phone: PHONE,
      city: 'Leander',
    }, 'qr-scan');
    ok(cust(db).email === 'keep@example.com',
      `A3 (${label}) a blank email LEAVES the stored value untouched — read back: ${JSON.stringify(cust(db).email)}`);
  }

  // ── CASE 4 — NO STORED EMAIL, NONE SUPPLIED ─────────────────────────────────────────────────
  // The phone-only OCR customer, rung up at the counter without an email. Nothing to write, and
  // nothing may break: the order must still resolve to their row.
  {
    const db = fakeDb(seedRepeatCustomer());
    let threw: string | null = null;
    let id = '';
    try {
      const r = await findOrCreateCustomer(db as any, BIZ, {
        first_name: 'Diane', last_name: 'Foster', phone: PHONE, city: 'Leander',
      }, 'qr-scan');
      id = r.customerId;
    } catch (e) { threw = e instanceof Error ? e.message : String(e); }
    ok(threw === null, `A4 no email stored and none supplied does not throw (${threw ?? 'clean'})`);
    ok(id === 'cust-1', 'A4b the order still resolves to the existing customer');
    ok(cust(db).email === '', `A4c the empty email is left exactly as found — read back: ${JSON.stringify(cust(db).email)}`);
    ok(db.rows.customers.length === 1, 'A4d no duplicate minted for the email-less repeat');
  }

  // ── THE INSERT HALF — a genuinely NEW customer still gets their email ────────────────────────
  // This branch was never broken; it is asserted so the fix cannot silently regress it while
  // repairing the other one.
  {
    const db = fakeDb({ people: [], customers: [] });
    const r = await findOrCreateCustomer(db as any, BIZ, {
      first_name: 'Marcus', last_name: 'Webb', email: 'marcus@example.com', phone: '5125559999',
      address_line1: '12 Oak', city: 'Leander', state: 'TX', zip: '78641',
    }, 'qr-scan');
    ok(r.created === true, 'B1 a genuinely new customer is INSERTED');
    ok(cust(db).email === 'marcus@example.com', `B1b the new row holds the email — read back: ${JSON.stringify(cust(db).email)}`);
    ok(cust(db).billing_line1 === '12 Oak' && cust(db).address_line1 === '12 Oak',
       'B1c canonical + mirror both written on insert (D-41, unchanged)');
  }
  {
    // A new customer with NO email: the column is written explicitly, never a fabricated value.
    const db = fakeDb({ people: [], customers: [] });
    await findOrCreateCustomer(db as any, BIZ, { first_name: 'Ana', last_name: 'Ruiz', phone: '5125558888' }, 'qr-scan');
    ok(!cust(db).email, `B2 an email-less new customer stores no email — read back: ${JSON.stringify(cust(db).email)}`);
  }

  // ── PHONE IS NOT THE SAME DEFECT, AND THIS IS THE PROOF ──────────────────────────────────────
  // 🔴 The question the build was asked to answer, asserted rather than reasoned. `phone` WAS
  // already offered and IS in FILLABLE, so it behaves as fill-never-clobber: it fills a blank and
  // it refuses to overwrite a curated value. That is a DIFFERENT rule from email's, deliberately,
  // and both directions are probed so a later edit cannot quietly move phone into either camp.
  {
    const db = fakeDb({
      people: [{ id: 'p-2', auth_user_id: null, email: 'ph@example.com', phone: null }],
      customers: [{ id: 'cust-2', business_id: BIZ, person_id: 'p-2', first_name: 'Ph', last_name: 'One',
                    email: 'ph@example.com', phone: null, address_line1: null, city: null, state: null, zip: null }],
    });
    await findOrCreateCustomer(db as any, BIZ, {
      first_name: 'Ph', last_name: 'One', email: 'ph@example.com', phone: '5125557777',
    }, 'qr-scan');
    ok(cust(db).phone === '5125557777', `C1 a BLANK phone is filled by the counter capture — read back: ${JSON.stringify(cust(db).phone)}`);
  }
  {
    // ⚠️ THE PERSON MUST STILL MATCH, or this probe silently tests the INSERT branch instead. The
    // first draft changed the phone and nothing else, which broke the spine's phone match, minted a
    // fresh person and a SECOND customer — and the assertion failed for a reason that had nothing to
    // do with either rule. The person is pinned by EMAIL here so the payload's changed phone cannot
    // move which row is being written.
    const db = fakeDb({
      people: [{ id: 'p-1', auth_user_id: null, email: 'diane@example.com', phone: null }],
      customers: [{ id: 'cust-1', business_id: BIZ, person_id: 'p-1', customer_type: 'person',
                    first_name: 'Diane', last_name: 'Foster', email: 'old@example.com', phone: '5125551111',
                    address_line1: '904 Hialeah Circle', city: 'Georgetown', state: 'TX', zip: '78628' }],
    });
    await findOrCreateCustomer(db as any, BIZ, {
      first_name: 'Diane', last_name: 'Foster', email: 'diane@example.com', phone: '5125552222',
    }, 'qr-scan');
    ok(db.rows.customers.length === 1, 'C2z the repeat still matched ONE row (the probe is on the update branch)');
    ok(cust(db).phone === '5125551111', `C2 a CURATED phone is NOT clobbered — fill-never-clobber, unlike email (read back: ${JSON.stringify(cust(db).phone)})`);
    ok(cust(db).email === 'diane@example.com', 'C2b …while the email on the SAME write DOES replace — the two rules coexist on one payload');
  }

  // ── R-12 — THE WRITE PROVES IT WROTE, IN BOTH DIRECTIONS ────────────────────────────────────
  // A PostgREST update matching zero rows returns success with no error. Under the service key that
  // means the row vanished between the dedup read and the write; under any narrower key it is what
  // a refusal looks like. Either way it must not be reported as a fill that happened.
  {
    const db = fakeDb(seedRepeatCustomer(), 'zero_rows');
    let threw: string | null = null;
    try {
      await findOrCreateCustomer(db as any, BIZ, { first_name: 'Diane', email: 'x@example.com', phone: PHONE }, 'qr-scan');
    } catch (e) { threw = e instanceof Error ? e.message : String(e); }
    ok(threw !== null, 'D1 a ZERO-ROW update THROWS rather than reporting a fill that never happened (R-12)');
    ok((threw ?? '').includes('exactly one row'), `D1b the failure NAMES the count, not a generic error — got: ${threw}`);
  }
  {
    // The other half of a count check. A guard that only refuses zero reports success here, and a
    // red-first run proved it: with `=== 0` this probe PASSED silently.
    const db = fakeDb(seedRepeatCustomer(), 'two_rows');
    let threw: string | null = null;
    try {
      await findOrCreateCustomer(db as any, BIZ, { first_name: 'Diane', email: 'x@example.com', phone: PHONE }, 'qr-scan');
    } catch (e) { threw = e instanceof Error ? e.message : String(e); }
    ok(threw !== null, 'D2 a TWO-ROW update THROWS — the count is asserted, not merely tested for zero (R-12)');
  }
  {
    // NEGATIVE CONTROL for D1/D2: the same probes must PASS on a healthy write, or they would be
    // asserting that this function throws unconditionally.
    const db = fakeDb(seedRepeatCustomer(), 'ok');
    let threw: string | null = null;
    try {
      await findOrCreateCustomer(db as any, BIZ, { first_name: 'Diane', email: 'x@example.com', phone: PHONE }, 'qr-scan');
    } catch (e) { threw = e instanceof Error ? e.message : String(e); }
    ok(threw === null, `D3 negative control — a healthy one-row update does NOT throw (${threw ?? 'clean'})`);
    ok(db.counts.updates === 1, `D3b exactly ONE update was issued (${db.counts.updates})`);
  }

  // ── THE NO-OP PATH — an already-complete row is not written at all ───────────────────────────
  // Guards the short-circuit above the write: if email is now offered, a row that already holds
  // the SAME email must still take the "nothing to fill" exit rather than issuing a pointless
  // update. (Email is supplied-wins, so it lands in the patch — this asserts the write is real
  // and idempotent, not that it is skipped.)
  {
    const db = fakeDb(seedRepeatCustomer({ email: 'same@example.com' }));
    await findOrCreateCustomer(db as any, BIZ, {
      first_name: 'Diane', last_name: 'Foster', email: 'same@example.com', phone: PHONE,
    }, 'qr-scan');
    ok(cust(db).email === 'same@example.com', 'E1 re-supplying the SAME email leaves the row holding it (idempotent)');
    ok(db.rows.customers.length === 1, 'E1b no duplicate');
  }

  // ── THE ORGANIZATION BRANCH — orgs skip the person spine and must still persist an email ─────
  {
    const db = fakeDb({
      people: [],
      customers: [{ id: 'cust-3', business_id: BIZ, customer_type: 'organization',
                    first_name: "Dave's Tree Svs", last_name: '', email: '', phone: null,
                    address_line1: '77 County Road', city: 'Leander', state: 'TX', zip: '78641' }],
    });
    await findOrCreateCustomer(db as any, BIZ, {
      first_name: "Dave's Tree Svs", customer_type: 'organization',
      email: 'dave@treesvs.com', address_line1: '77 County Road',
    }, 'qr-scan');
    ok(db.rows.customers.length === 1, 'F1 the org matched on name+billing — no duplicate (dedup untouched)');
    ok(cust(db).email === 'dave@treesvs.com', `F1b the org row holds the typed email too — read back: ${JSON.stringify(cust(db).email)}`);
  }

  // ── WHITESPACE IS TRIMMED, NOT STORED ───────────────────────────────────────────────────────
  {
    const db = fakeDb(seedRepeatCustomer());
    await findOrCreateCustomer(db as any, BIZ, {
      first_name: 'Diane', last_name: 'Foster', email: '  diane@example.com  ', phone: PHONE,
    }, 'qr-scan');
    ok(cust(db).email === 'diane@example.com', `G1 a typed email is TRIMMED before storage — read back: ${JSON.stringify(cust(db).email)}`);
  }

  console.log(`\ncustomerUpsert — ${passed} passed, ${failed} failed`);
  if (failures.length) { console.log('\nFAILURES:'); for (const f of failures) console.log('  ✗ ' + f); }
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error('harness error:', e); process.exit(1); });
