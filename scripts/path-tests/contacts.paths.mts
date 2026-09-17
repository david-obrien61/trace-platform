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
import { readContactLists, makeContactMain, retireContact, writeContactEdit } from '../../packages/shared/src/business-logic/contactWriter';
import { saveCustomerAddress, readCustomerAddresses } from '../../packages/shared/src/business-logic/customerAddresses';
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
  const db: any = await openLiveDb();
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
  const row = await one(db, `INSERT INTO public.customers (business_id, first_name, last_name, source, customer_type, person_id)
    VALUES ($1, $2, 'Smith', 'test', 'person', $3) RETURNING id`, [B, first, extra.person_id ?? null]);
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
const flat = (db: any, id: string) => one(db, `SELECT phone, email, billing_line1, billing_line2, billing_city FROM public.customers WHERE id = $1`, [id]);
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

await path('checkout.attached-customer', '🔴 CLV-20260917-1769 — checkout with a customer attached (ScanOrder) and a DIFFERENT phone typed: the new number is in the Phones list, the original stays main', async (check) => {
  const db = await freshDb();
  const id = await customer(db, 'john', { phone: '(512) 555-1111', email: 'john@example.com' });
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
  const id = await customer(db, 'Eddie', { phone: '(512) 555-0700', email: 'old@example.com', billing: { line1: '1 Old St', city: 'Leander' } });
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
  const id = await customer(db, 'Sid', { phone: '(512) 555-1200', email: 'sid@example.com', billing: { line1: '1 Bill St', city: 'Leander' } });
  const api = restClient(db, { uid: MANAGER }) as any;
  const book = await readCustomerAddresses(api, B, id);
  const out = await saveCustomerAddress(api, { businessId: B, customerId: id, label: 'Job site', address: { line1: '9 Site Rd', city: 'Austin', zip: '78701' }, existing: book.ok ? book.sites : [] });
  check(out.kind === 'saved', `save: ${JSON.stringify(out)}`);
  const l = await lists(db, id);
  check(l.addresses.some(a => a.value.startsWith('9 Site Rd') && !a.is_main), `Addresses: ${JSON.stringify(l.addresses)}`);
  const f = await flat(db, id);
  check(f.phone === '(512) 555-1200' && f.email === 'sid@example.com' && f.billing_line1 === '1 Bill St', `customer row: ${JSON.stringify(f)}`);
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
