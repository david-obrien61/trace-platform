/**
 * ── customerAddresses — the ship-to address book, and the invariant it must never break ──────
 *
 * WHAT THIS GUARDS (ledger #303, David's build prompt 2026-09-11):
 *   · 🔴 THE ORDER STILL SNAPSHOTS. Editing a saved site must NEVER change a past delivery. §E
 *     proves it by ACT, not by inspection: the module's own write path is driven against a
 *     recording client and asserted to touch exactly one table.
 *   · D-41 L1 survives: nothing here writes `customers`, and no `shipping_*` key is ever composed.
 *   · R-133 soft delete — retiring is an UPDATE of `active`; no code path deletes a row.
 *   · §4 of the migration: NO BACKFILL. §F reads the migration corpus and fails if anything seeds
 *     this table — the promise made checkable rather than merely written down.
 *   · §1.6 item 3 — every refusal is in words, and a saved site needs a street plus a city or ZIP.
 *
 * 🔴 THE FAKE CAN REFUSE WHAT THE REAL THING REFUSES (§6 r19 / R-33): zero rows (an RLS refusal),
 * an error, two rows, and a unique-violation are all modelled, and every table touched is RECORDED
 * — so a write to `customers` or `deliveries` would be SEEN rather than silently accepted. A double
 * more forgiving than the database is a rubber stamp (tech-debt #138).
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/customerAddresses.test.ts --bundle --platform=node --format=cjs | node
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  planSaveSite, saveCustomerAddress, readCustomerAddresses, retireCustomerAddress,
  addressOf, siteLine, sameAddress, findSameAddress, sortSites, normalizeAddressPart,
  SITE_ADDRESS_FIELDS, CUSTOMER_ADDRESS_COLUMNS, type CustomerAddress,
} from './customerAddresses';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg);
}

type Reply = 'ok' | 'error' | 'zero' | 'two' | 'dup';
interface Call { table: string; op: string; payload: Record<string, unknown>; filters: string[] }

function recordingDb(mode: { write?: Reply; read?: Reply } = {}, readRows: CustomerAddress[] = []) {
  const calls: Call[] = [];
  const answer = (m: Reply, row: Record<string, unknown>) => {
    if (m === 'error') return Promise.resolve({ data: null, error: { message: 'permission denied', code: '42501' } });
    if (m === 'dup')   return Promise.resolve({ data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } });
    if (m === 'zero')  return Promise.resolve({ data: [], error: null });
    if (m === 'two')   return Promise.resolve({ data: [row, { ...row, id: 'second' }], error: null });
    return Promise.resolve({ data: [row], error: null });
  };
  const db = {
    from(table: string) {
      return {
        select(_c: string) {
          const call: Call = { table, op: 'select', payload: {}, filters: [] };
          calls.push(call);
          const chain = {
            eq(k: string, v: unknown) {
              call.filters.push(`${k}=${String(v)}`);
              // The read chain is awaited after its last .eq(), so the chain is thenable.
              return Object.assign(chain, {
                then: (res: (v: unknown) => void) =>
                  answer(mode.read ?? 'ok', {}).then(r =>
                    res(mode.read === 'error' ? r : { data: readRows, error: null })),
              });
            },
          };
          return chain;
        },
        insert(payload: Record<string, unknown>) {
          calls.push({ table, op: 'insert', payload, filters: [] });
          return { select: (_c: string) => answer(mode.write ?? 'ok', { ...payload, id: 'site-new' }) };
        },
        update(payload: Record<string, unknown>) {
          const call: Call = { table, op: 'update', payload, filters: [] };
          calls.push(call);
          const chain = {
            eq(k: string, v: unknown) { call.filters.push(`${k}=${String(v)}`); return chain; },
            select: (_c: string) => answer(mode.write ?? 'ok', { id: 'site-1' }),
          };
          return chain;
        },
        // A delete would be a rule break, so the double OFFERS one and records it. A fake that
        // cannot express the forbidden act cannot prove the act does not happen (R-33).
        delete() {
          const call: Call = { table, op: 'delete', payload: {}, filters: [] };
          calls.push(call);
          const chain = { eq(k: string, v: unknown) { call.filters.push(`${k}=${String(v)}`); return chain; } };
          return chain;
        },
      };
    },
  };
  return { db: db as unknown as SupabaseClient, calls };
}

const BIZ = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'; // LAWNS
const CUST = 'cust-agave';

function site(over: Partial<CustomerAddress> = {}): CustomerAddress {
  return {
    id: 'site-1', business_id: BIZ, customer_id: CUST, label: 'The yard',
    line1: '501 County Road 107', line2: null, city: 'Georgetown', state: 'TX', zip: '78626',
    notes: null, is_default: true, active: true, ...over,
  };
}

async function main(): Promise<void> {
  // ══ A. THE PLAN — a save is an ACT, and every refusal is in words ════════════════════════════
  {
    const p = planSaveSite({ businessId: BIZ, customerId: CUST, label: '  ', address: site(), existing: [] });
    ok(p.kind === 'refused' && /name/i.test(p.reason), 'A1 a site with no NAME is refused — the label is what makes saving an act');
  }
  {
    const p = planSaveSite({ businessId: BIZ, customerId: CUST, label: 'Yard', address: { line1: '  ', city: 'Georgetown' }, existing: [] });
    ok(p.kind === 'refused' && /street/i.test(p.reason), 'A2 a blank street is REFUSED in words');
  }
  {
    const p = planSaveSite({ businessId: BIZ, customerId: CUST, label: 'Yard', address: { line1: '501 CR 107' }, existing: [] });
    ok(p.kind === 'refused' && /city or a ZIP/i.test(p.reason), 'A3 no city AND no ZIP is refused — the map cannot place it');
  }
  ok(planSaveSite({ businessId: BIZ, customerId: CUST, label: 'Yard', address: { line1: '501 CR 107', zip: '78626' }, existing: [] }).kind === 'insert',
    'A4 a ZIP alone is enough');
  ok(planSaveSite({ businessId: BIZ, customerId: CUST, label: 'Yard', address: { line1: '501 CR 107', city: 'Georgetown' }, existing: [] }).kind === 'insert',
    'A5 a city alone is enough');
  {
    const p = planSaveSite({ businessId: BIZ, customerId: CUST, label: '  Job site A  ', address: site(), existing: [] });
    ok(p.kind === 'insert' && p.row.label === 'Job site A', 'A6 the label is trimmed');
    ok(p.kind === 'insert' && p.row.is_default === true, 'A7 a customer\'s FIRST site is their default');
    ok(p.kind === 'insert' && p.row.active === true, 'A8 a new site is active');
    ok(p.kind === 'insert' && p.row.line2 === null, 'A9 line2 is always null — no surface offers it (tech-debt #279)');
  }
  {
    const p = planSaveSite({ businessId: BIZ, customerId: CUST, label: 'Second', address: { line1: '9 Oak Ln', city: 'Leander' }, existing: [site()] });
    ok(p.kind === 'insert' && p.row.is_default === false, 'A10 a SECOND site is not default — it has something to compete with');
  }

  // ══ B. THE ANTI-DRIFT GUARD — the whole reason the book exists ═══════════════════════════════
  // AGAVE's four spellings are the defect. The book must not reproduce them.
  {
    const p = planSaveSite({
      businessId: BIZ, customerId: CUST, label: 'The yard again',
      address: { line1: '501 county road 107', city: 'georgetown', state: 'tx', zip: '78626' },
      existing: [site()],
    });
    ok(p.kind === 'already_saved', 'B1 the SAME yard typed in lower case is already saved — not a second row');
    ok(p.kind === 'already_saved' && p.site.label === 'The yard', 'B2 and it names the site they already have');
  }
  ok(sameAddress(site(), { line1: '501 County Road 107.', city: 'Georgetown,', state: 'TX', zip: '78626' }),
    'B3 trailing punctuation does not make a second place');
  ok(sameAddress(site(), { line1: '501  County   Road 107', city: 'Georgetown', state: 'TX', zip: '78626' }),
    'B4 repeated whitespace does not make a second place');
  ok(!sameAddress(site(), { line1: '502 County Road 107', city: 'Georgetown', state: 'TX', zip: '78626' }),
    'B5 a DIFFERENT street is a different place — the guard is conservative, never eager');
  ok(!sameAddress(site(), { line1: '501 County Rd 107', city: 'Georgetown', state: 'TX', zip: '78626' }),
    'B6 `Rd` is NOT expanded to `Road` — refusing to save a genuinely different site is the worse failure');
  {
    // A RETIRED twin must not block a save: the site was deliberately removed from the picker.
    const p = planSaveSite({ businessId: BIZ, customerId: CUST, label: 'Back again', address: site(), existing: [site({ active: false })] });
    ok(p.kind === 'insert', 'B7 a RETIRED twin does not block saving the place again');
  }
  {
    const p = planSaveSite({ businessId: BIZ, customerId: CUST, label: 'the YARD', address: { line1: '9 Oak Ln', city: 'Leander' }, existing: [site()] });
    ok(p.kind === 'refused' && /already has a site called/i.test(p.reason),
      'B8 a duplicate LABEL is refused in words, before the database has to say it');
  }

  // ══ C. THE WRITE — proven by the COUNT, and it names ONE table ══════════════════════════════
  {
    const { db, calls } = recordingDb();
    const out = await saveCustomerAddress(db, { businessId: BIZ, customerId: CUST, label: 'Job site A', address: site(), existing: [] });
    ok(out.kind === 'saved', 'C1 a permitted save reports saved');
    ok(calls.length === 1 && calls[0].table === 'customer_addresses' && calls[0].op === 'insert',
      `C2 exactly ONE table is written, and it is the book (got ${calls.map(c => `${c.table}.${c.op}`).join(',')})`);
    ok(!calls.some(c => c.table === 'customers'), 'C3 🔴 the save NEVER writes `customers` — D-41 L1');
    ok(!calls.some(c => c.table === 'deliveries'), 'C4 🔴 the save NEVER writes `deliveries` — the snapshot is the record');
    ok(!Object.keys(calls[0].payload).some(k => k.startsWith('shipping')), 'C5 no `shipping_*` key is ever composed');
  }
  {
    const { db } = recordingDb({ write: 'zero' });
    const out = await saveCustomerAddress(db, { businessId: BIZ, customerId: CUST, label: 'Job site A', address: site(), existing: [] });
    ok(out.kind === 'failed' && /permission/i.test(out.error),
      'C6 🔴 an RLS-REFUSED insert returns ZERO ROWS AND NO ERROR — the count is the proof (R-12/A8)');
  }
  {
    const { db } = recordingDb({ write: 'two' });
    const out = await saveCustomerAddress(db, { businessId: BIZ, customerId: CUST, label: 'Job site A', address: site(), existing: [] });
    ok(out.kind === 'failed', 'C7 two rows back is a failure, not a success');
  }
  {
    const { db } = recordingDb({ write: 'dup' });
    const out = await saveCustomerAddress(db, { businessId: BIZ, customerId: CUST, label: 'Job site A', address: site(), existing: [] });
    ok(out.kind === 'refused' && /already has a site called/i.test(out.reason),
      'C8 a 23505 race reaches the person as the human fact, not as a Postgres string');
  }
  {
    const { db } = recordingDb({ write: 'error' });
    const out = await saveCustomerAddress(db, { businessId: BIZ, customerId: CUST, label: 'Job site A', address: site(), existing: [] });
    ok(out.kind === 'failed' && /permission denied/.test(out.error), 'C9 a real error is reported as one');
  }

  // ══ D. RETIRE — R-133, and no path deletes ══════════════════════════════════════════════════
  {
    const { db, calls } = recordingDb();
    const out = await retireCustomerAddress(db, BIZ, 'site-1');
    ok(out.ok === true, 'D1 a permitted retire succeeds');
    ok(calls[0].op === 'update', 'D2 🔴 retiring is an UPDATE — R-133, you cannot delete, you can mark deleted');
    ok(calls[0].payload.active === false, 'D3 it clears `active`');
    ok(calls[0].payload.is_default === false, 'D4 and clears `is_default`, so restoring it cannot mint a second default');
    ok(!calls.some(c => c.op === 'delete'), 'D5 nothing calls delete');
    ok(calls[0].filters.includes(`business_id=${BIZ}`), 'D6 the write is tenant-scoped (AC-3)');
  }
  {
    const { db } = recordingDb({ write: 'zero' });
    const out = await retireCustomerAddress(db, BIZ, 'site-1');
    ok(out.ok === false, 'D7 an RLS-refused retire is a failure, not a silent success');
  }

  // ══ E. 🔴 THE INVARIANT — EDITING THE BOOK CANNOT MOVE A PAST DELIVERY ═══════════════════════
  // This is the acceptance clause, proven by ACT rather than by reading the source. Every write
  // this module can perform is driven, and the set of tables touched is asserted to be exactly one.
  {
    const { db, calls } = recordingDb();
    await saveCustomerAddress(db, { businessId: BIZ, customerId: CUST, label: 'A', address: site(), existing: [] });
    await retireCustomerAddress(db, BIZ, 'site-1');
    await readCustomerAddresses(db, BIZ, CUST);
    const tables = [...new Set(calls.map(c => c.table))];
    ok(tables.length === 1 && tables[0] === 'customer_addresses',
      `E1 🔴 EVERY operation this module offers touches ONE table — the book (got ${tables.join(',')})`);
    ok(!calls.some(c => c.table === 'deliveries'),
      'E2 🔴 no operation writes `deliveries` — so a saved site cannot rewrite where a past load went');
  }
  {
    // The source, read as a corpus: a future edit that reaches for `deliveries` fails here even if
    // it is written in a shape the recording client above never drives (#182 — a probe that cannot
    // reach its target reports the same as one that passed).
    const src = readFileSync(join(process.cwd(), 'packages/shared/src/business-logic/customerAddresses.ts'), 'utf8');
    const written = [...src.matchAll(/\.from\(\s*'([^']+)'\s*\)/g)].map(m => m[1]);
    ok(written.length > 0, 'E3 the corpus probe REACHED the source (it found at least one .from)');
    ok([...new Set(written)].join(',') === 'customer_addresses',
      `E4 🔴 the source names exactly one table (got ${[...new Set(written)].join(',')})`);
    ok(!/shipping_/.test(src), 'E5 the word `shipping_` appears nowhere — D-41\'s redline');
  }

  // ══ F. 🔴 NO BACKFILL — the migration\'s §4 promise, made checkable ══════════════════════════
  // If the book were seeded from QuickBooks history, AGAVE's four spellings would become four
  // SAVED SITES and the drift would be permanent. This goes red the day anything seeds the table.
  {
    const dir = join(process.cwd(), 'supabase/migrations');
    const files = readdirSync(dir).filter(f => f.endsWith('.sql'));
    ok(files.length > 50, `F1 the migration corpus was READ (${files.length} files) — the probe reached its target`);
    const seeders: string[] = [];
    for (const f of files) {
      // Comments stripped first: the migration DISCUSSES backfilling at length, and a probe that
      // matched prose would report the file that forbids the act as the file that commits it.
      const body = readFileSync(join(dir, f), 'utf8').split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
      if (/(insert\s+into|copy)\s+(public\.)?customer_addresses/i.test(body)) seeders.push(f);
    }
    ok(seeders.length === 0, `F2 🔴 NOTHING seeds customer_addresses (found: ${seeders.join(', ') || 'none'})`);
    // The negative control: the stripped-comment predicate must still be able to SEE a real seed.
    const planted = 'INSERT INTO public.customer_addresses (label) VALUES (\'x\');';
    ok(/(insert\s+into|copy)\s+(public\.)?customer_addresses/i.test(planted), 'F3 the seed probe can detect a real seed');
    const commented = '-- INSERT INTO public.customer_addresses (label) VALUES (\'x\');';
    const strippedPlant = commented.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
    ok(!/(insert\s+into)\s+(public\.)?customer_addresses/i.test(strippedPlant), 'F4 and it does NOT fire on a commented one');
  }

  // ══ G. THE COLUMN LIST IS THE MIGRATION\'S, NOT A HAND-MAINTAINED COPY (#179) ════════════════
  {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260911b_customer_addresses.sql'), 'utf8');
    const body = sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS public.customer_addresses'));
    const block = body.slice(body.indexOf('(') + 1, body.indexOf('\n);'));
    const declared = block.split('\n')
      .map(l => l.replace(/--.*$/, '').trim())
      .filter(l => l && !/^(PRIMARY|UNIQUE|CHECK|CONSTRAINT|FOREIGN)/i.test(l))
      .map(l => l.split(/\s+/)[0]).filter(Boolean);
    ok(declared.length > 10, `G1 the CREATE TABLE was parsed (${declared.length} columns) — the probe reached its target`);
    const selected = CUSTOMER_ADDRESS_COLUMNS.split(',').map(s => s.trim());
    const missing = declared.filter(c => !selected.includes(c));
    ok(missing.length === 0, `G2 🔴 every column the migration CREATES is in the select (missing: ${missing.join(', ') || 'none'})`);
    const extra = selected.filter(c => !declared.includes(c));
    ok(extra.length === 0, `G3 and the select names nothing the migration does not create (extra: ${extra.join(', ') || 'none'})`);
    ok(/line2/.test(block), 'G4 `line2` IS created — present from day one for tech-debt #254');
    ok(!selected.includes('shipping_line1'), 'G5 no shipping_* column exists to select');
  }

  // ══ H. THE POLICIES REUSE `customers:*` AND MINT NOTHING ════════════════════════════════════
  {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260911b_customer_addresses.sql'), 'utf8');
    const stmts = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
    const strings = [...stmts.matchAll(/has_permission\(business_id,\s*'([^']+)'\)/g)].map(m => m[1]);
    ok(strings.length >= 4, `H1 the policy block was parsed (${strings.length} permission checks)`);
    ok([...new Set(strings)].sort().join(',') === 'customers:create,customers:read,customers:update',
      `H2 🔴 only the THREE existing customers strings are used — nothing minted (got ${[...new Set(strings)].sort().join(',')})`);
    ok(!/sites:/.test(stmts), 'H3 no `sites:*` string appears');
    ok(!/owner_id/.test(stmts), 'H4 🔴 no raw owner_id policy — 20260910b took 49 to 12; this is not the 50th');
    ok(/is_active_member\(business_id\)/.test(stmts), 'H5 membership is checked alongside the permission');
    ok(!/FOR\s+DELETE/i.test(stmts), 'H6 no DELETE policy — retiring is an UPDATE (R-133), so DELETE is fail-closed');
    ok(/ENABLE ROW LEVEL SECURITY/.test(stmts), 'H7 RLS is enabled');
    // 🔴 UNIQUE is the whole assertion. Mutant D4 renamed the index and kept it non-unique, and a
    // name-only probe stayed green — an index that permits three defaults is not "at most one".
    ok(/CREATE UNIQUE INDEX[^;]*customer_addresses_one_default[^;]*WHERE is_default AND active/s.test(stmts),
      'H8 at most one default per customer is a UNIQUE, PARTIAL database rule — not just an index with that name');
    ok(/CREATE UNIQUE INDEX[^;]*customer_addresses_one_label[^;]*lower\(label\)/s.test(stmts),
      'H9 one label per customer is a UNIQUE database rule, case-insensitively');
    ok(!/CREATE UNIQUE INDEX[^;]*customer_addresses_one_default[^;]*WHERE is_default AND active/s.test(
      'CREATE INDEX customer_addresses_one_default ON t (a) WHERE is_default AND active;'),
      'H10 …and the UNIQUE probe REFUSES a plain index carrying the same name (D4\'s survivor)');
  }

  // ══ I. HELPERS ══════════════════════════════════════════════════════════════════════════════
  ok(siteLine(site()) === '501 County Road 107, Georgetown, TX, 78626', 'I1 the address as one line');
  ok(siteLine({ line1: '9 Oak Ln', city: '  ', state: null, zip: '78641' }) === '9 Oak Ln, 78641', 'I2 blanks are skipped');
  ok(addressOf({ line1: '  ' }).line1 === null, 'I3 a blank field is NULL, never an empty string (A9)');
  ok(normalizeAddressPart(null) === '', 'I4 a null part normalises to empty, and never to the string "null"');
  ok([...SITE_ADDRESS_FIELDS].join(',') === 'line1,city,state,zip', 'I5 the four parts a delivery row can hold — line2 is NOT among them');
  {
    const sorted = sortSites([site({ id: 'b', label: 'Zebra', is_default: false }), site({ id: 'a', label: 'Alpha', is_default: false }), site({ id: 'd', label: 'Mid', is_default: true })]);
    ok(sorted.map(s => s.id).join(',') === 'd,a,b', 'I6 default first, then alphabetical — a stable picker order');
  }
  ok(findSameAddress([], site()) === null, 'I7 an empty book matches nothing');

  // ══ J. THE READ — a refusal is an EMPTY BOOK, never a broken screen ═════════════════════════
  {
    const { db, calls } = recordingDb({}, [site({ id: 'x', label: 'B', is_default: false }), site({ id: 'y', label: 'A', is_default: true })]);
    const out = await readCustomerAddresses(db, BIZ, CUST);
    ok(out.ok === true && out.sites.length === 2, 'J1 the read returns the customer\'s sites');
    ok(out.ok === true && out.sites[0].id === 'y', 'J2 sorted for the picker');
    ok(calls[0].filters.includes('active=true'), 'J3 retired sites are not offered');
    ok(calls[0].filters.includes(`business_id=${BIZ}`), 'J4 the read is tenant-scoped (AC-3)');
  }
  {
    const { db } = recordingDb({ read: 'error' });
    const out = await readCustomerAddresses(db, BIZ, CUST);
    ok(out.ok === false, 'J5 a failed read says so rather than reporting an empty book as a fact (A9)');
  }

  // ══ K. NEGATIVE CONTROLS — the probes can refuse ════════════════════════════════════════════
  {
    const fake: Call[] = [{ table: 'deliveries', op: 'update', payload: {}, filters: [] }];
    ok(fake.some(c => c.table === 'deliveries'), 'K1 the deliveries probe can SEE a deliveries write');
  }
  {
    const fake: Call[] = [{ table: 'customers', op: 'update', payload: {}, filters: [] }];
    ok(fake.some(c => c.table === 'customers'), 'K2 the customers probe can SEE a customers write');
  }
  ok(!sameAddress(site(), { line1: null, city: null, state: null, zip: null }),
    'K3 an EMPTY address does not match a real one — otherwise every blank would read as already-saved');

  console.log(`\ncustomerAddresses: ${passed} passed, ${failed} failed`);
  if (failed) { for (const f of failures) console.log(`   ✗ ${f}`); process.exit(1); }
}

void main();
