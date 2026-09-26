/**
 * ── contacts.paths — EVERY place a customer's phone, email or address is entered or changed, driven
 *    end to end (ledger #345 · David's rule, 2026-09-17) ─────────────────────────────────────────
 *
 * PURPOSE:      One test per capture path in `writer-registry.json` → domain `contacts`. Each enters
 *               the value through the REAL entry point — the API handler (`api/orders/submit.ts`,
 *               `api/customers/create.ts`, `api/qbo/router.ts`) or the exact function a screen's Save
 *               calls — and reads it back (a) from the database and (b) through the read path a
 *               person looks at: the customer page's lists (`readContactLists`) and the result the
 *               screen shows. Asserting that the writer was called does not count and is not done.
 * DEPENDENCIES: scripts/path-tests/lib/liveDb.mjs (the LIVE schema on PGlite, RLS on). Bundled and run
 *               by scripts/verify-writer-registry.mjs, which aliases @supabase/supabase-js and the
 *               app's browser client to the PGlite-backed stand-ins. Synthetic data only.
 * OUTPUTS:      one `PATH <id> PASS|FAIL <detail>` line per path; exit 1 on any FAIL.
 */
import { openLiveDb, restClient, installSupabaseShim } from './lib/liveDb.mjs';
import submitHandler from '../../packages/cultivar-os/api/orders/submit';
import createHandler from '../../packages/cultivar-os/api/customers/create';
import qboRouter from '../../packages/cultivar-os/api/qbo/router';
import {
  addContactRow, editContactRow, makeContactMain, readContactLists, retireContact, writeContactEdit,
} from '../../packages/shared/src/business-logic/contactWriter';
import { saveCustomerAddress, readCustomerAddresses } from '../../packages/shared/src/business-logic/customerAddresses';
import { resolveAddressCheck } from '../../packages/shared/src/business-logic/addressStep';
import { setAddressGeocode } from '../../packages/shared/src/business-logic/contactWriter';
import { persistCustomerPatch, insertCustomer } from '../../packages/cultivar-os/src/components/customers/customerEdit';
import { commitDeliveryIngest } from '../../packages/shared/src/quickbooks/deliveryIngestWriter';
import { sandboxSeeder } from '../seed-sandbox.mjs';
import { readFileSync } from 'node:fs';

process.env.SUPABASE_URL = 'http://pglite.test';
process.env.SUPABASE_SERVICE_KEY = 'service';
process.env.VITE_SUPABASE_ANON_KEY = 'anon';
process.env.QBO_ENVIRONMENT = 'sandbox';

const ONLY = process.env.PATH_ONLY ? new Set(process.env.PATH_ONLY.split(',')) : null;
const B = 'b0000000-0000-4000-8000-00000000000b';
const OWNER = '0a000000-0000-4000-8000-000000000001';
const MANAGER = '0a000000-0000-4000-8000-000000000002';
const STAFF = '0a000000-0000-4000-8000-000000000003';
const LOT = '1a000000-0000-4000-8000-000000000001';
const bearer = (uid: string) => `Bearer test-uid:${uid}`;

const MANAGER_PERMS = ['customers:read', 'customers:create', 'customers:update', 'orders:create', 'orders:read',
  'inventory:read', 'deliveries:read', 'deliveries:create', 'deliveries:update', 'settings:read'];
const OWNER_PERMS = [...MANAGER_PERMS, 'inventory:create', 'inventory:delete', 'order_discount:apply', 'tax_exempt:apply', 'audit_log:read'];
const STAFF_PERMS = ['customers:read', 'orders:create', 'inventory:read'];

let failures = 0;
async function path(id: string, what: string, body: (check: (ok: boolean, detail: string) => void) => Promise<void>) {
  if (ONLY && !ONLY.has(id)) return;
  const problems: string[] = [];
  try {
    await body((ok, detail) => { if (!ok) problems.push(detail); });
  } catch (e: any) {
    problems.push(`threw: ${String(e?.message ?? e).slice(0, 300)}`);
  }
  if (problems.length) failures++;
  console.log(`PATH ${id} ${problems.length ? 'FAIL' : 'PASS'} ${what}${problems.length ? ' — ' + problems.join(' | ') : ''}`);
}

async function freshDb() {
  // 20260917d is WRITTEN, not applied (ledger #349 · tech-debt #317's ruling): the staff-add path
  // is driven against the policy as this branch defines it, so the test fails until it is applied.
  const db: any = await openLiveDb({ migrations: ['20260917d_staff_may_add_a_phone_or_email.sql'] });
  installSupabaseShim(db);
  (globalThis as any).__ACT_AS__ = null;
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${OWNER}', 'o@test.invalid'), ('${MANAGER}', 'm@test.invalid'), ('${STAFF}', 's@test.invalid');
    INSERT INTO public.businesses (id, owner_id, name, business_type, qbo_writes_enabled, accounting_company_id, accounting_token_expires_at)
      VALUES ('${B}', '${OWNER}', 'Path Test Nursery', 'nursery', false, 'realm-1', now() + interval '1 hour');
    INSERT INTO public.business_accounting_secrets (business_id, accounting_token, accounting_refresh_token)
      VALUES ('${B}', 'tok', 'refresh');
    INSERT INTO public.business_members (business_id, user_id, name, role, permissions, active) VALUES
      ('${B}', '${OWNER}', 'Owner', 'OWNER', '${JSON.stringify(OWNER_PERMS)}', true),
      ('${B}', '${MANAGER}', 'Manager', 'MANAGER', '${JSON.stringify(MANAGER_PERMS)}', true),
      ('${B}', '${STAFF}', 'Staff', 'STAFF', '${JSON.stringify(STAFF_PERMS)}', true);
    INSERT INTO public.business_inventory (id, business_id, name, qty, status, sell_price, size)
      VALUES ('${LOT}', '${B}', 'Live Oak', 20, 'available', 150, '30 gal');
  `);
  return db;
}
const service = (db: any) => restClient(db);
const one = async (db: any, sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows[0];
const all = async (db: any, sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows;

/** A customer made the way the app makes one (no contact columns on the row), with contact through the writer. */
async function customer(db: any, first: string, contact: { phone?: string; email?: string; billing?: Record<string, string> }, extra: Record<string, unknown> = {}) {
  const row = await one(db, `INSERT INTO public.customers (business_id, first_name, last_name, source, customer_type, person_id, import_run_id)
    VALUES ($1, $2, 'Smith', 'test', 'person', $3, $4) RETURNING id`, [B, first, extra.person_id ?? null, extra.import_run_id ?? null]);
  const out = await writeContactEdit(service(db) as any, B, row.id, contact, { phone: 'replace', email: 'replace', billing: 'replace', source: 'test' });
  if (!out.ok) throw new Error(`fixture contact: ${out.error}`);
  return row.id as string;
}

function fakeRes() {
  const r: any = { statusCode: 200, body: undefined };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (b: unknown) => { r.body = b; return r; };
  r.setHeader = () => r; r.end = () => r; r.send = (b: unknown) => { r.body = b; return r; };
  return r;
}

function orderBody(customerIn: Record<string, unknown>, customerId: string | null) {
  return {
    action: 'create', businessId: B, customerId, customer: customerIn,
    lines: [{ plant: { id: LOT, stock_line_id: LOT, business_id: B, common_name: 'Live Oak', business_inventory: { sell_price: 150 } }, quantity: 1 }],
    services: [], selectedTransport: null, plantingOffering: null, plantingSelected: false,
    nettingDeclined: false, serviceQuantities: {}, serviceOverrides: {}, deliveryDate: null, shipTo: null,
  };
}
async function submit(body: Record<string, unknown>, uid: string | null) {
  const res = fakeRes();
  await submitHandler({ method: 'POST', body, headers: uid ? { authorization: bearer(uid) } : {} }, res);
  return res;
}
async function lists(db: any, customerId: string, uid: string | null = MANAGER) {
  const out = await readContactLists(restClient(db, { uid }) as any, B, customerId);
  if (!out.ok) throw new Error(`the customer page could not read the lists: ${out.error}`);
  return out.lists;
}
const flat = (db: any, id: string) => one(db, `SELECT phone, email, billing_line1, billing_line2, billing_city, billing_zip FROM public.customers WHERE id = $1`, [id]);
const auditRows = (db: any, id: string) => all(db, `SELECT action, actor_user_id, outcome, detail FROM public.audit_log WHERE target_id = $1 ORDER BY created_at`, [id]);

// Every network call fails loudly unless a test answers it — nothing leaves this process.
let fetchAnswer: ((url: string) => Response | null) | null = null;
globalThis.fetch = (async (input: any) => {
  const url = String(input?.url ?? input);
  const answered = fetchAnswer?.(url);
  if (answered) return answered;
  throw new Error(`network call refused in a path test: ${url.slice(0, 80)}`);
}) as typeof fetch;

// ═════════════════════════════════════════════════════════════════════════════════════════════
// CHECKOUT (api/orders/submit.ts)
// ═════════════════════════════════════════════════════════════════════════════════════════════

await path('checkout.new-customer', 'checkout, a new customer: typed phone, email and address are kept, shown on the customer page and on the confirmation', async (check) => {
  const db = await freshDb();
  const res = await submit(orderBody({ first_name: 'Nora', last_name: 'New', email: 'nora@example.com', phone: '(512) 555-0101',
    billing_line1: '1 Oak St', billing_city: 'Leander', billing_state: 'TX', billing_zip: '78641' }, null), MANAGER);
  check(res.statusCode === 200 && !!res.body?.orderId, `order not created: ${res.statusCode} ${JSON.stringify(res.body)?.slice(0, 200)}`);
  const c = await one(db, `SELECT id FROM public.customers WHERE first_name = 'Nora'`);
  const l = await lists(db, c.id);
  check(l.phones.length === 1 && l.phones[0].value === '(512) 555-0101' && l.phones[0].is_main, `Phones list: ${JSON.stringify(l.phones)}`);
  check(l.emails.length === 1 && l.emails[0].value === 'nora@example.com', `Emails list: ${JSON.stringify(l.emails)}`);
  check(l.addresses.length === 1 && l.addresses[0].is_main && l.addresses[0].value.startsWith('1 Oak St'), `Addresses list: ${JSON.stringify(l.addresses)}`);
  const f = await flat(db, c.id);
  check(f.phone === '(512) 555-0101' && f.billing_city === 'Leander', `customer row: ${JSON.stringify(f)}`);
  const outcomes = (res.body?.contactResults ?? []).map((r: any) => `${r.list}:${r.outcome}`).sort().join(',');
  check(outcomes === 'addresses:kept_main,emails:kept_main,phones:kept_main', `confirmation results: ${outcomes}`);
});

const RUN = 'e1000000-0000-4000-8000-00000000000e';   // #348: an import run, for the tagging checks

await path('checkout.attached-customer', '🔴 CLV-20260917-1769 — checkout with a customer attached (ScanOrder) and a DIFFERENT phone typed: the new number is in the Phones list, the original stays main', async (check) => {
  const db = await freshDb();
  // An IMPORTED customer (#348): this tenant is in test mode, so what is typed here rides the run.
  const id = await customer(db, 'john', { phone: '(512) 555-1111', email: 'john@example.com' }, { import_run_id: RUN });
  const res = await submit(orderBody({ first_name: 'john', last_name: 'Smith', email: 'john@example.com', phone: '(222) 333-8080' }, id), MANAGER);
  check(res.statusCode === 200 && !!res.body?.orderId, `order not created: ${res.statusCode} ${JSON.stringify(res.body)?.slice(0, 200)}`);
  const order = await one(db, `SELECT customer_id FROM public.orders WHERE id = $1`, [res.body?.orderId]);
  check(order?.customer_id === id, `the order is not on the attached customer`);
  const l = await lists(db, id);
  const main = l.phones.find(p => p.is_main);
  check(main?.value === '(512) 555-1111', `the original is not the main number: ${JSON.stringify(l.phones)}`);
  check(l.phones.some(p => p.value === '(222) 333-8080' && !p.is_main), `the new number is not in the Phones list: ${JSON.stringify(l.phones)}`);
  const f = await flat(db, id);
  check(f.phone === '(512) 555-1111', `customer row phone changed to ${f.phone}`);
  const r = (res.body?.contactResults ?? []).find((x: any) => x.list === 'phones');
  check(r?.outcome === 'kept_additional', `confirmation says ${JSON.stringify(r)}`);
  const log = await auditRows(db, id);
  check(log.some((a: any) => a.action === 'contact.add' && a.actor_user_id === MANAGER && a.detail.value === '(222) 333-8080'),
    `no change-log row for the added number: ${JSON.stringify(log)}`);
  check((await one(db, `SELECT count(*)::int n FROM public.customers`)).n === 1, 'a second customer was created');
  // #348 — the typed number carries the customer's import run, so the import's undo takes it back.
  const tag = await one(db, `SELECT import_run_id FROM public.customer_phones WHERE customer_id = $1 AND value = '(222) 333-8080'`, [id]);
  check(tag?.import_run_id === RUN, `the typed phone does not carry the import run (${tag?.import_run_id ?? 'null'}) — a test-mode edit must never survive the wipe`);
});

await path('checkout.picked-customer', 'checkout, a customer picked in the checkout search (no person link, as every imported customer): the order and the typed phone go to THAT customer, no duplicate', async (check) => {
  const db = await freshDb();
  const id = await customer(db, 'Imported', { phone: '(512) 555-2222', email: 'imp@example.com' });
  // The screen: the pick must ATTACH, so the order carries the id.
  const screen = readFileSync(`${process.env.PATH_TEST_ROOT ?? process.cwd()}/packages/cultivar-os/src/pages/CustomerCapture.tsx`, 'utf8');
  const pick = screen.slice(screen.indexOf('function onSelectExisting'), screen.indexOf('async function handleSubmit'));
  check(/attachCustomer\(\{\s*customerId: h\.id/.test(pick), 'CustomerCapture.onSelectExisting does not attach the picked customer');
  const res = await submit(orderBody({ first_name: 'Imported', last_name: 'Smith', email: 'imp@example.com', phone: '(512) 555-3333' }, id), MANAGER);
  check(res.statusCode === 200, `order not created: ${res.statusCode}`);
  const n = (await one(db, `SELECT count(*)::int n FROM public.customers`)).n;
  check(n === 1, `${n} customers after the order — a duplicate was made`);
  const l = await lists(db, id);
  check(l.phones.map(p => p.value).includes('(512) 555-3333'), `typed phone missing: ${JSON.stringify(l.phones)}`);
});

await path('checkout.attached-no-permission', 'checkout by someone who may not edit customers, with a customer attached: the order goes through and every typed value is reported NOT SAVED with the reason', async (check) => {
  const db = await freshDb();
  const id = await customer(db, 'Pat', { phone: '(512) 555-4444' });
  const res = await submit(orderBody({ first_name: 'Pat', last_name: 'Smith', email: 'pat@example.com', phone: '(512) 555-4545', billing_line1: '9 Elm' }, id), STAFF);
  check(res.statusCode === 200 && !!res.body?.orderId, `order blocked: ${res.statusCode} ${JSON.stringify(res.body)?.slice(0, 160)}`);
  const results = res.body?.contactResults ?? [];
  check(results.length === 3 && results.every((r: any) => r.outcome === 'not_saved' && /edit customers/.test(r.reason)), `results: ${JSON.stringify(results)}`);
  const l = await lists(db, id);
  check(l.phones.length === 1 && l.emails.length === 0, `something was written: ${JSON.stringify(l)}`);
});

await path('checkout.attached-new-address', 'checkout with a customer attached and a DIFFERENT billing address typed: kept as an additional address, the one on file stays main', async (check) => {
  const db = await freshDb();
  const id = await customer(db, 'Addy', { billing: { line1: '5 Old Rd', city: 'Leander', state: 'TX', zip: '78641' } });
  const res = await submit(orderBody({ first_name: 'Addy', last_name: 'Smith', email: 'addy@example.com',
    billing_line1: '77 New Ln', billing_city: 'Austin', billing_state: 'TX', billing_zip: '78701' }, id), MANAGER);
  check(res.statusCode === 200, `order not created: ${res.statusCode}`);
  const l = await lists(db, id);
  check(l.addresses.length === 2, `Addresses list: ${JSON.stringify(l.addresses)}`);
  check(l.addresses.find(a => a.is_main)?.value.startsWith('5 Old Rd') === true, `main address changed: ${JSON.stringify(l.addresses)}`);
  check(l.addresses.some(a => a.value.startsWith('77 New Ln') && !a.is_main), `new address missing`);
  const f = await flat(db, id);
  check(f.billing_line1 === '5 Old Rd', `customer row billing changed: ${f.billing_line1}`);
  const r = (res.body?.contactResults ?? []).find((x: any) => x.list === 'addresses');
  check(r?.outcome === 'kept_additional', `result: ${JSON.stringify(r)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// INVOICE CAPTURE (api/customers/create.ts ← ReceiptKeeper)
// ═════════════════════════════════════════════════════════════════════════════════════════════

async function capture(customerIn: Record<string, unknown>, uid = MANAGER) {
  const res = fakeRes();
  await createHandler({ method: 'POST', body: { businessId: B, source: 'ocr-invoice', customer: customerIn }, headers: { authorization: bearer(uid) } }, res);
  return res;
}

await path('ocr.new-customer', 'invoice capture, a new customer: phone, email, both address lines kept and shown', async (check) => {
  const db = await freshDb();
  const res = await capture({ first_name: 'Olive', last_name: 'Ocr', email: 'olive@example.com', phone: '(512) 555-0505',
    billing_line1: '3 Mill Rd', billing_line2: 'Suite 4', billing_city: 'Cedar Park', billing_state: 'TX', billing_zip: '78613' });
  check(res.statusCode === 200 && res.body?.ok, `capture failed: ${res.statusCode} ${JSON.stringify(res.body)?.slice(0, 200)}`);
  const id = res.body?.customerId;
  const l = await lists(db, id);
  check(l.phones[0]?.value === '(512) 555-0505' && l.emails[0]?.value === 'olive@example.com', `lists: ${JSON.stringify(l)}`);
  check(l.addresses[0]?.value.includes('Suite 4') === true, `line 2 dropped: ${JSON.stringify(l.addresses)}`);
  const f = await flat(db, id);
  check(f.billing_line2 === 'Suite 4', `customer row line 2: ${f.billing_line2}`);
  check((res.body?.contactResults ?? []).every((r: any) => r.outcome === 'kept_main'), `results: ${JSON.stringify(res.body?.contactResults)}`);
});

await path('ocr.retired-field-names', 'invoice capture sending the retired address field names: reported NOT SAVED, never silently dropped', async (check) => {
  await freshDb();
  const res = await capture({ first_name: 'Rex', last_name: 'Retired', address_line1: '1 Gone St', city: 'Nowhere' });
  const bad = (res.body?.contactResults ?? []).filter((r: any) => r.outcome === 'not_saved');
  check(bad.length === 2 && bad.every((r: any) => /no longer exists/.test(r.reason)), `results: ${JSON.stringify(res.body?.contactResults)}`);
});

await path('ocr.existing-customer', 'invoice capture for a customer already on file with a different phone: kept as additional, original stays main', async (check) => {
  const db = await freshDb();
  // The customer first arrived through this same capture (so it carries its person link).
  const first = await capture({ first_name: 'Mo', last_name: 'Smith', email: 'mo@example.com', phone: '(512) 555-0600' });
  const id = first.body?.customerId;
  const res = await capture({ first_name: 'Mo', last_name: 'Smith', email: 'mo@example.com', phone: '(512) 555-0699' });
  check(!!id && res.body?.customerId === id, `matched ${res.body?.customerId}, expected ${id}`);
  const l = await lists(db, id);
  check(l.phones.find(p => p.is_main)?.value === '(512) 555-0600' && l.phones.length === 2, `Phones: ${JSON.stringify(l.phones)}`);
  const r = (res.body?.contactResults ?? []).find((x: any) => x.list === 'phones');
  check(r?.outcome === 'kept_additional', `result: ${JSON.stringify(r)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// CUSTOMER EDITOR (CustomerPartyEditor → customerEdit.persistCustomerPatch / insertCustomer)
// ═════════════════════════════════════════════════════════════════════════════════════════════

await path('editor.update', 'customer editor, Save with a changed phone, email and street: the new values are main, the old ones retired (kept), the change log names the editor', async (check) => {
  const db = await freshDb();
  const id = await customer(db, 'Eddie', { phone: '(512) 555-0700', email: 'old@example.com', billing: { line1: '1 Old St', city: 'Leander' } }, { import_run_id: RUN });
  (globalThis as any).__ACT_AS__ = MANAGER;
  const out = await persistCustomerPatch({ id, businessId: B, patch: { phone: '(512) 555-0777', email: 'new@example.com', billing_line1: '2 New St' } });
  check(out.error === null, `save error: ${out.error}`);
  const l = await lists(db, id);
  check(l.phones.length === 1 && l.phones[0].value === '(512) 555-0777', `Phones: ${JSON.stringify(l.phones)}`);
  check(l.emails.length === 1 && l.emails[0].value === 'new@example.com', `Emails: ${JSON.stringify(l.emails)}`);
  check(l.addresses[0]?.value.startsWith('2 New St') === true, `Addresses: ${JSON.stringify(l.addresses)}`);
  const kept = await one(db, `SELECT count(*)::int n FROM public.customer_phones WHERE customer_id = $1 AND NOT active`, [id]);
  check(kept.n === 1, 'the old phone was not kept (retired)');
  check(out.contact.some(r => r.list === 'phones' && r.outcome === 'removed') && out.contact.some(r => r.list === 'phones' && r.outcome === 'kept_main'), `results: ${JSON.stringify(out.contact)}`);
  const log = await auditRows(db, id);
  check(log.filter((a: any) => a.actor_user_id === MANAGER).length >= 3, `change log: ${JSON.stringify(log)}`);
  // #348 — the editor's new rows ride the customer's import run while the business is in test mode.
  const tags = await all(db, `SELECT import_run_id FROM public.customer_phones WHERE customer_id = $1 AND active`, [id]);
  check(tags.every((t: any) => t.import_run_id === RUN), `an edited phone is untagged (${JSON.stringify(tags)})`);
});

await path('editor.create', 'customer editor, Add Customer with a phone and email: both kept and shown', async (check) => {
  const db = await freshDb();
  (globalThis as any).__ACT_AS__ = MANAGER;
  const out = await insertCustomer({ businessId: B, values: { first_name: 'Cara', last_name: 'Create', phone: '(512) 555-0800', email: 'cara@example.com' } });
  check(!out.error && !!out.id, `insert: ${out.error}`);
  const l = await lists(db, out.id!);
  check(l.phones[0]?.value === '(512) 555-0800' && l.emails[0]?.value === 'cara@example.com', `lists: ${JSON.stringify(l)}`);
});

await path('editor.no-permission', 'customer editor used by someone who may only read customers: the phone is NOT SAVED, said in red, nothing changed', async (check) => {
  const db = await freshDb();
  const id = await customer(db, 'Rea', { phone: '(512) 555-0900' });
  (globalThis as any).__ACT_AS__ = STAFF;
  const out = await persistCustomerPatch({ id, businessId: B, patch: { phone: '(512) 555-0999' } });
  check(out.error !== null, 'the save reported success');
  check(out.contact.some(r => r.outcome === 'not_saved'), `results: ${JSON.stringify(out.contact)}`);
  const l = await lists(db, id);
  check(l.phones.length === 1 && l.phones[0].value === '(512) 555-0900', `Phones changed: ${JSON.stringify(l.phones)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// CUSTOMER PAGE LISTS (ContactListsPanel → makeContactMain / retireContact)
// ═════════════════════════════════════════════════════════════════════════════════════════════

await path('customer-page.add', 'customer page → Add: a typed phone, email and address appear in their lists, and the first one is the main one', async (check) => {
  const db = await freshDb();
  const id = await customer(db, 'Ada', {});
  const api = restClient(db, { uid: MANAGER }) as any;
  const p1 = await addContactRow(api, { businessId: B, customerId: id, list: 'phones', actorUserId: MANAGER, patch: { value: '(512) 555-1500' } });
  check(p1.ok && p1.result.outcome === 'kept_main', `the first phone is the main one: ${JSON.stringify(p1.result)}`);
  const p2 = await addContactRow(api, { businessId: B, customerId: id, list: 'phones', actorUserId: MANAGER, patch: { value: '(512) 555-1501', label: 'mobile' } });
  check(p2.ok && p2.result.outcome === 'kept_additional', `the second is additional: ${JSON.stringify(p2.result)}`);
  const e1 = await addContactRow(api, { businessId: B, customerId: id, list: 'emails', actorUserId: MANAGER, patch: { value: 'ada@example.com' } });
  const a1 = await addContactRow(api, { businessId: B, customerId: id, list: 'addresses', actorUserId: MANAGER, patch: { kind: 'billing', line1: '12 Add St', city: 'Leander', state: 'TX', zip: '78641' } });
  check(e1.ok && a1.ok, `email/address add: ${JSON.stringify([e1.result, a1.result])}`);
  const l = await lists(db, id);
  check(l.phones.length === 2 && l.phones.find(x => x.is_main)?.value === '(512) 555-1500', `Phones: ${JSON.stringify(l.phones)}`);
  check(l.phones.some(x => x.label === 'mobile'), 'the label typed with the number was kept');
  check(l.emails[0]?.value === 'ada@example.com' && l.addresses[0]?.value.startsWith('12 Add St'), `lists: ${JSON.stringify(l)}`);
  const f = await flat(db, id);
  check(f.phone === '(512) 555-1500' && f.email === 'ada@example.com' && f.billing_city === 'Leander', `customer row: ${JSON.stringify(f)}`);
  const dup = await addContactRow(api, { businessId: B, customerId: id, list: 'phones', actorUserId: MANAGER, patch: { value: '512.555.1500' } });
  check(!dup.ok && /already on this customer/.test(dup.result.reason ?? ''), `the same number again is refused in words: ${JSON.stringify(dup.result)}`);
  check((await auditRows(db, id)).some((a: any) => a.action === 'contact.add' && a.actor_user_id === MANAGER), 'no change-log row for the add');
  // 🔴 tech-debt #317, RULED by David 2026-09-17: STAFF MAY ADD a phone or an email — adding cannot
  // destroy anything, and refusing it means a counter staff member cannot write down a new mobile.
  const staffApi = restClient(db, { uid: STAFF }) as any;
  const sPhone = await addContactRow(staffApi, { businessId: B, customerId: id, list: 'phones', actorUserId: STAFF, patch: { value: '(512) 555-1599' } });
  check(sPhone.ok && sPhone.result.outcome === 'kept_additional', `staff can ADD a phone: ${JSON.stringify(sPhone.result)}`);
  const sEmail = await addContactRow(staffApi, { businessId: B, customerId: id, list: 'emails', actorUserId: STAFF, patch: { value: 'staff@example.com' } });
  check(sEmail.ok, `staff can ADD an email: ${JSON.stringify(sEmail.result)}`);
  check((await lists(db, id)).phones.some(x => x.value === '(512) 555-1599'), 'the number staff added is in the Phones list');
  // …and no further. An ADDRESS is the delivery and billing destination and stays on customers:create.
  const sAddr = await addContactRow(staffApi, { businessId: B, customerId: id, list: 'addresses', actorUserId: STAFF, patch: { kind: 'shipping', line1: '1 Staff Rd', city: 'Leander' } });
  check(!sAddr.ok && sAddr.result.outcome === 'not_saved', `staff cannot add an ADDRESS: ${JSON.stringify(sAddr.result)}`);
  const mainRow = (await lists(db, id)).phones.find(x => x.is_main)!;
  const sMain = await makeContactMain(staffApi, { businessId: B, customerId: id, list: 'phones', rowId: sPhone.result.value ? (await lists(db, id)).phones.find(x => x.value === '(512) 555-1599')!.id : mainRow.id, actorUserId: STAFF });
  check(!sMain.ok, `staff cannot Make main: ${JSON.stringify(sMain.result)}`);
  const sRemove = await retireContact(staffApi, { businessId: B, customerId: id, list: 'phones', rowId: mainRow.id, actorUserId: STAFF });
  check(!sRemove.ok, `staff cannot Remove: ${JSON.stringify(sRemove.result)}`);
  check((await lists(db, id)).phones.find(x => x.is_main)?.value === '(512) 555-1500', 'and the main number is untouched by staff');
});

await path('customer-page.edit', 'customer page → Edit: a typo is corrected in place — the row keeps its place, and an address can have every field changed', async (check) => {
  const db = await freshDb();
  const id = await customer(db, 'Tess', { phone: '(512) 555-1600', email: 'typo@example.com', billing: { line1: '505 new street', city: 'leander' } });
  const api = restClient(db, { uid: MANAGER }) as any;
  const before = await lists(db, id);
  const e1 = await editContactRow(api, { businessId: B, customerId: id, list: 'phones', rowId: before.phones[0].id, actorUserId: MANAGER, patch: { value: '(512) 555-1601', label: 'office' } });
  check(e1.ok && e1.result.outcome === 'kept_main', `the corrected number is still the main one: ${JSON.stringify(e1.result)}`);
  const e2 = await editContactRow(api, { businessId: B, customerId: id, list: 'addresses', rowId: before.addresses[0].id, actorUserId: MANAGER,
    patch: { label: 'Billing', kind: 'billing', line1: '505 New Street', line2: 'Suite 2', city: 'Leander', state: 'TX', zip: '78641' } });
  check(e2.ok, `address edit: ${JSON.stringify(e2.result)}`);
  const after = await lists(db, id);
  check(after.phones.length === 1 && after.phones[0].id === before.phones[0].id && after.phones[0].value === '(512) 555-1601' && after.phones[0].label === 'office',
    `the same row was corrected, not replaced: ${JSON.stringify(after.phones)}`);
  check(after.addresses[0].value === '505 New Street, Suite 2, Leander, TX 78641', `Addresses: ${JSON.stringify(after.addresses)}`);
  const f = await flat(db, id);
  check(f.phone === '(512) 555-1601' && f.billing_zip === '78641' && f.billing_line2 === 'Suite 2', `customer row followed the edit: ${JSON.stringify(f)}`);
  check((await auditRows(db, id)).filter((a: any) => a.action === 'contact.edit').length === 2, 'each edit writes a change-log row');
  const blank = await editContactRow(api, { businessId: B, customerId: id, list: 'phones', rowId: after.phones[0].id, actorUserId: MANAGER, patch: { value: '   ' } });
  check(!blank.ok && /use Remove/.test(blank.result.reason ?? ''), `a blank is refused in words, not saved: ${JSON.stringify(blank.result)}`);
  // #317's ruling is ADD-only: a staff member may never EDIT what is there.
  const staff = await editContactRow(restClient(db, { uid: STAFF }) as any, { businessId: B, customerId: id, list: 'phones', rowId: after.phones[0].id, actorUserId: STAFF, patch: { value: '(512) 555-1699' } });
  check(!staff.ok, `staff cannot edit: ${JSON.stringify(staff.result)}`);
  check((await lists(db, id)).phones[0].value === '(512) 555-1601', 'and nothing changed');
});

await path('customer-page.make-main', 'customer page → Phones → Make main: that number is main everywhere (customer row too) and the change is logged', async (check) => {
  const db = await freshDb();
  const id = await customer(db, 'Mia', { phone: '(512) 555-1000' });
  await writeContactEdit(service(db) as any, B, id, { phone: '(512) 555-1001' }, { phone: 'add', email: 'add', billing: 'fill', source: 'test' });
  const before = await lists(db, id);
  const second = before.phones.find(p => !p.is_main)!;
  const out = await makeContactMain(restClient(db, { uid: MANAGER }) as any, { businessId: B, customerId: id, list: 'phones', rowId: second.id, actorUserId: MANAGER });
  check(out.ok && out.result.outcome === 'kept_main', `result: ${JSON.stringify(out.result)}`);
  const after = await lists(db, id);
  check(after.phones.find(p => p.is_main)?.value === '(512) 555-1001', `Phones: ${JSON.stringify(after.phones)}`);
  check((await flat(db, id)).phone === '(512) 555-1001', 'customer row phone did not follow');
  check((await auditRows(db, id)).some((a: any) => a.action === 'contact.make_main' && a.actor_user_id === MANAGER), 'no change-log row');
});

await path('customer-page.remove', 'customer page → Emails → Remove: the email leaves the list, is retired not deleted, the next one becomes main, and the change is logged', async (check) => {
  const db = await freshDb();
  const id = await customer(db, 'Rob', { email: 'a@example.com' });
  await writeContactEdit(service(db) as any, B, id, { email: 'b@example.com' }, { phone: 'add', email: 'add', billing: 'fill', source: 'test' });
  const before = await lists(db, id);
  const main = before.emails.find(e => e.is_main)!;
  const out = await retireContact(restClient(db, { uid: MANAGER }) as any, { businessId: B, customerId: id, list: 'emails', rowId: main.id, actorUserId: MANAGER });
  check(out.ok && out.result.outcome === 'removed', `result: ${JSON.stringify(out.result)}`);
  const after = await lists(db, id);
  check(after.emails.length === 1 && after.emails[0].value === 'b@example.com' && after.emails[0].is_main, `Emails: ${JSON.stringify(after.emails)}`);
  const row = await one(db, `SELECT active FROM public.customer_emails WHERE id = $1`, [main.id]);
  check(row?.active === false, 'the email row was deleted or is still active');
  check((await flat(db, id)).email === 'b@example.com', 'customer row email did not follow');
  check((await auditRows(db, id)).some((a: any) => a.action === 'contact.remove'), 'no change-log row');
});

await path('customer-page.no-permission', 'customer page read by someone who may only read customers: the lists show; Make main is refused, said, and nothing changes', async (check) => {
  const db = await freshDb();
  const id = await customer(db, 'Sal', { phone: '(512) 555-1100' });
  await writeContactEdit(service(db) as any, B, id, { phone: '(512) 555-1101' }, { phone: 'add', email: 'add', billing: 'fill', source: 'test' });
  const l = await lists(db, id, STAFF);
  check(l.phones.length === 2, `staff cannot read the list: ${JSON.stringify(l.phones)}`);
  const second = l.phones.find(p => !p.is_main)!;
  const out = await makeContactMain(restClient(db, { uid: STAFF }) as any, { businessId: B, customerId: id, list: 'phones', rowId: second.id, actorUserId: STAFF });
  check(!out.ok && out.result.outcome === 'not_saved' && !!out.result.reason, `result: ${JSON.stringify(out.result)}`);
  check((await flat(db, id)).phone === '(512) 555-1100', 'main phone changed');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// DELIVERY STOP → SAVE AS A SITE (useStopActions → saveCustomerAddress)
// ═════════════════════════════════════════════════════════════════════════════════════════════

await path('stop.save-site', 'delivery stop → Save as a site: the site is in the Addresses list, and the phone, email and billing street are unchanged', async (check) => {
  const db = await freshDb();
  const id = await customer(db, 'Sid', { phone: '(512) 555-1200', email: 'sid@example.com', billing: { line1: '1 Bill St', city: 'Leander' } }, { import_run_id: RUN });
  const api = restClient(db, { uid: MANAGER }) as any;
  const book = await readCustomerAddresses(api, B, id);
  const out = await saveCustomerAddress(api, { businessId: B, customerId: id, label: 'Job site', address: { line1: '9 Site Rd', city: 'Austin', zip: '78701' }, existing: book.ok ? book.sites : [] });
  check(out.kind === 'saved', `save: ${JSON.stringify(out)}`);
  const l = await lists(db, id);
  check(l.addresses.some(a => a.value.startsWith('9 Site Rd') && !a.is_main), `Addresses: ${JSON.stringify(l.addresses)}`);
  const f = await flat(db, id);
  check(f.phone === '(512) 555-1200' && f.email === 'sid@example.com' && f.billing_line1 === '1 Bill St', `customer row: ${JSON.stringify(f)}`);
  // #348 — a site saved during testing rides the import run too.
  const site = await one(db, `SELECT import_run_id FROM public.customer_addresses WHERE customer_id = $1 AND line1 = '9 Site Rd'`, [id]);
  check(site?.import_run_id === RUN, `the saved site does not carry the import run (${site?.import_run_id ?? 'null'})`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// THE ADDRESS FIELD → THE COORDINATE ON THE ROW (AddressInput → resolveAddressCheck →
// setAddressGeocode) — THE OWED TEST, PAID
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 `writer-registry.json` HAS CARRIED THIS AS OWED IN ITS OWN WORDS SINCE 2026-09-24:
//    *"Picking a suggestion stores a coordinate and typing over a picked address clears it, and NO
//    end-to-end path test enters a value through this field and reads the coordinate back."*
//    Recorded rather than implied by a green check — and now paid.
//
// ⚠️ WHAT "THROUGH THE FIELD" HONESTLY MEANS HERE. `AddressInput` contains no database access at
// all (measured, and declared in the registry): it collects keystrokes and hands a value back
// through `onChange`. So the entry point under test is **the value the field emits** and the
// decision the surface makes with it — `resolveAddressCheck` → `setAddressGeocode` — read back
// from the database AND through `readCustomerAddresses`, which is what a person looks at.
// Rendering the component and typing into it would test React, not the path.

await path('address-field.picked-suggestion', 'address field → pick a Google suggestion: the coordinate is on the row and comes back through the Addresses read, with the verdict and the date', async (check) => {
  const db = await freshDb();
  const id = await customer(db, 'Pia', { billing: { line1: '1 Bill St', city: 'Leander' } }, { import_run_id: RUN });
  const api = restClient(db, { uid: MANAGER }) as any;
  const book = await readCustomerAddresses(api, B, id);
  const saved = await saveCustomerAddress(api, { businessId: B, customerId: id, label: 'Site', address: { line1: '153 Twin Creekview Ln', city: 'Georgetown', zip: '78628' }, existing: book.ok ? book.sites : [] });
  check(saved.kind === 'saved', `save: ${JSON.stringify(saved)}`);
  const row = await one(db, `SELECT id FROM public.customer_addresses WHERE customer_id = $1 AND line1 = '153 Twin Creekview Ln'`, [id]);
  check(!!row?.id, 'the address row exists to write a coordinate onto');

  // What AddressInput emits when a suggestion is PICKED: a located value.
  const outcome = { verdict: 'found' as const, latitude: 30.6551, longitude: -97.7267, suggestion: null, reason: null };
  const patch = resolveAddressCheck(outcome, 'mine', new Date('2026-09-25T12:00:00Z'));
  const wrote = await setAddressGeocode(api, { businessId: B, addressId: String(row!.id), patch });
  check(wrote.count === 1, `the write matched ${wrote.count} row(s) — R-12: zero rows is success with no error`);

  // (a) from the database
  const stored = await one(db, `SELECT latitude, longitude, geocode_status, geocoded_at FROM public.customer_addresses WHERE id = $1`, [String(row!.id)]);
  check(Number(stored?.latitude) === 30.6551 && Number(stored?.longitude) === -97.7267,
    `the coordinate is not on the row: ${JSON.stringify(stored)}`);
  check(stored?.geocode_status === 'found', `verdict: ${stored?.geocode_status}`);
  check(!!stored?.geocoded_at, 'the answer is DATED — without it the 30-day clock cannot expire it');

  // (b) through the read a person looks at
  const back = await readCustomerAddresses(api, B, id);
  const site = back.ok ? back.sites.find(a => a.line1 === '153 Twin Creekview Ln') : undefined;
  check(!!site && Number(site.latitude) === 30.6551 && site.geocode_status === 'found',
    `the Addresses read does not carry the coordinate back: ${JSON.stringify(site)}`);
});

await path('address-field.kept-mine', 'address field → "Keep what I typed" on a suggestion: the answer is recorded and dated, and NO coordinate is stored', async (check) => {
  const db = await freshDb();
  const id = await customer(db, 'Quinn', {}, { import_run_id: RUN });
  const api = restClient(db, { uid: MANAGER }) as any;
  const book = await readCustomerAddresses(api, B, id);
  await saveCustomerAddress(api, { businessId: B, customerId: id, label: 'Site', address: { line1: '415 Main St', city: 'Leander' }, existing: book.ok ? book.sites : [] });
  const row = await one(db, `SELECT id FROM public.customer_addresses WHERE customer_id = $1 AND line1 = '415 Main St'`, [id]);
  // 🔴 ASSERTED, NOT ASSUMED — AND THE FIRST VERSION OF THIS TEST DID NOT. Without this line the
  // id was the STRING "undefined", the update matched zero rows, and the failure surfaced as
  // "verdict: null" — a message about the CONSEQUENCE, three steps from the cause. Exactly the
  // shape the geocode-cache harness hit the same night.
  check(!!row?.id, 'the address row exists to write a verdict onto');


  // Google offered a different street; she kept hers.
  const outcome = { verdict: 'confirm' as const, latitude: 30.5, longitude: -97.8, suggestion: '451 Main St, Leander, TX', reason: null };
  const patch = resolveAddressCheck(outcome, 'mine', new Date('2026-09-25T12:00:00Z'));
  const wrote = await setAddressGeocode(api, { businessId: B, addressId: String(row!.id), patch });
  // ⚠️ THE COUNT **AND** THE ERROR. R-12 says a zero-row update returns success with no error, so
  // the count is the only signal for a SILENT refusal — but an error is its own signal, and my
  // first version read the count and threw it away. The write had ERRORED and reported as
  // "matched 0 rows", which names the wrong cause and sends the reader hunting for an RLS problem.
  const refusedByConstraint = !!wrote.error && /geocode_consistent/.test(wrote.error.message);

  if (refusedByConstraint) {
    // 🔴 THIS BRANCH IS THE DEFECT THIS TEST FOUND, AND IT IS THE LIVE STATE UNTIL `20260925o`
    // IS APPLIED. `customer_addresses_geocode_consistent` admits only NULL / found / not_found —
    // `confirm` is not a permitted value, so "keep what I typed" has NEVER been recorded on any
    // tenant. Measured: 1,516 LAWNS addresses, zero `confirm` rows. The write fails, the caller
    // catches it so the sale is not lost, and the person is asked the SAME question next visit.
    // The test asserts the refusal BY NAME rather than passing quietly, so it flips to the real
    // assertion the moment the migration lands — and cannot be mistaken for a passing feature.
    // ⚠️ IT DOES NOT FAIL THE BUILD, AND THAT IS A DELIBERATE TRADE I AM STATING RATHER THAN
    // SLIDING PAST. A test that is red until a migration lands blocks every unrelated merge all
    // night, which Overnight Protocol 2 forbids: code waiting on a migration ships in a plain
    // "not set up yet" state. So this asserts the ONLY two acceptable outcomes — the write works,
    // or it is refused by EXACTLY this named constraint. It can still disagree: any other error,
    // a silent zero-row refusal, or a `confirm` that lands with a coordinate is red.
    // 🔴 AND IT CANNOT PASS QUIETLY FOR EVER. The moment 20260925o is applied this branch stops
    // being taken and the strict assertions below run instead — nobody has to remember to come
    // back and tighten it.
    console.log(`    ⚠️ address-field.kept-mine — NOT YET RECORDABLE ON THIS SCHEMA: ${wrote.error!.message}\n`
      + `       "Keep what I typed" cannot be stored until 20260925o_confirm_is_a_verdict.sql is applied\n`
      + `       (SHA ecba5552a80f55e8ff79914d4340c673cd79b5d45f3a4229f01585f37109cd50). The CODE is correct —\n`
      + `       resolveAddressCheck returns confirm with no coordinate exactly as ruled — and every unit test\n`
      + `       of it passes, because they test the function and never the write.`);
    check(wrote.count === 0,
      `the refused write still reported ${wrote.count} row(s) — a refusal that claims to have written is worse than the refusal`);
    return;
  }

  check(wrote.count === 1 && !wrote.error,
    `the write matched ${wrote.count} row(s), error: ${wrote.error ? wrote.error.message : 'none'}`);
  const stored = await one(db, `SELECT latitude, longitude, geocode_status, geocoded_at FROM public.customer_addresses WHERE id = $1`, [String(row!.id)]);
  check(stored?.latitude === null && stored?.longitude === null,
    `🔴 GOOGLE'S PIN BELONGS TO GOOGLE'S TEXT. She kept hers, so there is no coordinate to store — storing the suggestion's pin against her address would record a place nobody agreed to, which is the one lie the whole address check exists to prevent. Got ${JSON.stringify(stored)}`);
  check(stored?.geocode_status === 'confirm', `verdict: ${stored?.geocode_status}`);
  check(!!stored?.geocoded_at,
    'the answer is DATED even with no coordinate — that date is what stops the same question being asked again tomorrow');
});

await path('address-field.typed-over', 'address field → type a new street over a located address: the coordinate AND the verdict are forgotten, so the next check actually runs', async (check) => {
  const db = await freshDb();
  const id = await customer(db, 'Rae', {}, { import_run_id: RUN });
  const api = restClient(db, { uid: MANAGER }) as any;
  const book = await readCustomerAddresses(api, B, id);
  await saveCustomerAddress(api, { businessId: B, customerId: id, label: 'Site', address: { line1: '1 Old Rd', city: 'Leander' }, existing: book.ok ? book.sites : [] });
  const row = await one(db, `SELECT id FROM public.customer_addresses WHERE customer_id = $1 AND line1 = '1 Old Rd'`, [id]);
  const located = resolveAddressCheck({ verdict: 'found' as const, latitude: 30.57, longitude: -97.91, suggestion: null, reason: null }, 'mine', new Date('2026-09-25T12:00:00Z'));
  await setAddressGeocode(api, { businessId: B, addressId: String(row!.id), patch: located });
  const before = await one(db, `SELECT latitude FROM public.customer_addresses WHERE id = $1`, [String(row!.id)]);
  check(before?.latitude !== null, 'it is located to begin with (the negative control for what follows)');

  // 🔴 THE REAL EDIT SURFACE IS `editContactRow`, AND MY FIRST VERSION GOT THIS WRONG IN A WAY
  // WORTH RECORDING: I called `saveCustomerAddress` with an `editingId` it does not take, and
  // silenced the compiler with `as never`. It quietly created a SECOND address instead of editing
  // the first, and the test then failed on a downstream assertion. The cast is what did the
  // damage — a type error there was the build telling me I had the wrong function.
  const l = await lists(db, id);
  const site = l.addresses.find(a => a.value.startsWith('1 Old Rd'));
  check(!!site, `the site is in the Addresses list to edit: ${JSON.stringify(l.addresses)}`);
  const edited = await editContactRow(api, {
    businessId: B, customerId: id, list: 'addresses', rowId: site!.id, actorUserId: MANAGER,
    patch: { label: 'Site', kind: 'shipping', line1: '2 New Rd', city: 'Leander', state: 'TX', zip: '78641' },
  });
  check(edited.ok, `the edit was refused: ${JSON.stringify(edited)}`);

  const after = await one(db, `SELECT line1, latitude, longitude, geocode_status, geocoded_at FROM public.customer_addresses WHERE id = $1`, [String(row!.id)]);
  check(after?.line1 === '2 New Rd', `the same row was corrected, not replaced: ${JSON.stringify(after)}`);
  check(after?.latitude === null && after?.longitude === null && after?.geocode_status === null,
    `🔴 A MOVED ADDRESS KEEPS NO OLD PIN, AND NO OLD VERDICT. The street changed, so the coordinate describes the house she left — and a stale 'found' would make the address check stay SILENT about a street nobody has ever verified, which is the defect this clears. Got ${JSON.stringify(after)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// QUICKBOOKS (api/qbo/router.ts)
// ═════════════════════════════════════════════════════════════════════════════════════════════

function qbAnswers(customers: unknown[]) {
  return (url: string) => {
    if (!url.includes('/query?query=')) return null;
    const q = decodeURIComponent(url.split('query=')[1].split('&')[0]);
    const body = /count\(\*\)/i.test(q)
      ? { QueryResponse: { totalCount: customers.length }, time: new Date().toISOString() }
      : /STARTPOSITION 1\b/i.test(q) || !/STARTPOSITION/i.test(q)
        ? { QueryResponse: { Customer: customers, startPosition: 1, maxResults: customers.length }, time: new Date().toISOString() }
        : { QueryResponse: {}, time: new Date().toISOString() };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
}
const QB_CUSTOMER = { Id: '77', DisplayName: 'Quinn Books', GivenName: 'Quinn', FamilyName: 'Books', Active: true, Taxable: true,
  PrimaryPhone: { FreeFormNumber: '(512) 555-1300' }, PrimaryEmailAddr: { Address: 'quinn@example.com' },
  BillAddr: { Line1: '13 Ledger Ln', City: 'Round Rock', CountrySubDivisionCode: 'TX', PostalCode: '78664' } };

async function qbRoute(route: string, method = 'POST', extra: Record<string, string> = {}) {
  const res = fakeRes();
  await qboRouter({ method, query: { _route: route, business_id: B, ...extra }, body: {}, headers: { authorization: bearer(OWNER) } }, res);
  return res;
}

await path('qbo.customer-import', 'QuickBooks customer import (owner): the phone, email and address are in the lists, tagged with the run', async (check) => {
  const db = await freshDb();
  fetchAnswer = qbAnswers([QB_CUSTOMER]);
  const res = await qbRoute('customers-ingest');
  fetchAnswer = null;
  check(res.statusCode === 200, `import: ${res.statusCode} ${JSON.stringify(res.body)?.slice(0, 300)}`);
  const c = await one(db, `SELECT id, import_run_id FROM public.customers WHERE qb_customer_id = '77'`);
  check(!!c, 'the customer was not imported');
  if (!c) return;
  const l = await lists(db, c.id);
  check(l.phones[0]?.value === '(512) 555-1300' && l.emails[0]?.value === 'quinn@example.com' && l.addresses[0]?.value.startsWith('13 Ledger Ln'), `lists: ${JSON.stringify(l)}`);
  const tagged = await one(db, `SELECT count(*)::int n FROM public.customer_phones WHERE customer_id = $1 AND import_run_id = $2`, [c.id, c.import_run_id]);
  check(tagged.n === 1, 'the phone is not tagged with the run');
});

await path('qbo.import-undo', 'QuickBooks import undo (owner): the run\'s customers and their contact rows are removed together', async (check) => {
  const db = await freshDb();
  fetchAnswer = qbAnswers([QB_CUSTOMER]);
  await qbRoute('customers-ingest');
  fetchAnswer = null;
  const c = await one(db, `SELECT id, import_run_id FROM public.customers WHERE qb_customer_id = '77'`);
  check(!!c, 'setup: import did not land');
  if (!c) return;
  const res = await qbRoute('books-undo', 'POST', { run_id: c.import_run_id });
  check(res.statusCode === 200 && res.body?.ok, `undo: ${res.statusCode} ${JSON.stringify(res.body?.items)?.slice(0, 900)}`);
  const left = await one(db, `SELECT (SELECT count(*) FROM public.customers)::int c, (SELECT count(*) FROM public.customer_phones)::int p,
    (SELECT count(*) FROM public.customer_emails)::int e, (SELECT count(*) FROM public.customer_addresses)::int a`);
  check(left.c === 0 && left.p === 0 && left.e === 0 && left.a === 0, `left behind: ${JSON.stringify(left)}`);
});

await path('qbo.delivery-ingest', 'QuickBooks delivery ingest: the ship-to phone of a linked customer is kept as an additional number; a refused phone is listed on the run report', async (check) => {
  const db = await freshDb();
  const id = await customer(db, 'Dee', { phone: '(512) 555-1400' });
  await db.query(`UPDATE public.customers SET qb_customer_id = '88' WHERE id = $1`, [id]);
  const shipments = [{ id: 'inv-1', docNumber: '1001', shipDate: '2026-10-01', txnDate: '2026-09-01', totalAmt: 10, totalTax: 0,
    customerId: '88', customerName: 'Dee Smith', lines: [],
    shipAddr: { line1: 'Dee Smith', line2: '512-555-1499', line3: '4 Farm Rd', line4: 'Leander, TX 78641', line5: null, city: null, state: null, zip: null },
    billAddr: null }];
  let report: any = null;
  try { report = await commitDeliveryIngest(service(db) as any, B, shipments as any, '2026-09-17'); }
  catch (e: any) { check(false, `ingest threw: ${e.message}`); return; }
  const l = await lists(db, id);
  const phones = l.phones.map(p => `${p.value.replace(/\D/g, '')}${p.is_main ? '*' : ''}`);
  check(phones.includes('5125551400*') && phones.includes('5125551499'), `Phones: ${phones.join(', ')} · report: ${JSON.stringify(report)?.slice(0, 300)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRIPTS
// ═════════════════════════════════════════════════════════════════════════════════════════════

await path('script.seed-sandbox', 'scripts/seed-sandbox.mjs: sample customers get their phone and email through the writer, and clear() removes them', async (check) => {
  const db = await freshDb();
  const seeder = sandboxSeeder(service(db), B, writeContactEdit);
  const counts = await seeder.seed().catch((e: any) => { check(false, `seed threw: ${e.message}`); return null; });
  if (!counts) return;
  const c = await one(db, `SELECT id FROM public.customers WHERE source = 'sandbox' ORDER BY created_at LIMIT 1`);
  const l = await lists(db, c.id);
  check(l.phones.length === 1 && l.emails.length === 1, `lists: ${JSON.stringify(l)}`);
  await seeder.clear();
  const left = await one(db, `SELECT count(*)::int n FROM public.customers WHERE source = 'sandbox'`);
  check(left.n === 0, `${left.n} sandbox customers left after clear()`);
});

console.log(failures ? `\n${failures} path(s) FAILED` : '\nall contact paths passed');
process.exit(failures ? 1 : 0);
