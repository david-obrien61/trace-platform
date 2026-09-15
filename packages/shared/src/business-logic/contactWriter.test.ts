/**
 * ── contactWriter — what actually lands, and what must never land ────────────────────────────
 *
 * WHAT THIS GUARDS (ledger #335):
 *   · 🔴 `value_norm` IS NEVER SENT. The database trigger owns the normalisation, so a payload
 *     carrying it would be a SECOND implementation of one rule — the STD-011 defect this build
 *     exists to remove. §B asserts its absence from every row of every payload.
 *   · 🔴 THIS MODULE NEVER WRITES `customers`. The flat columns are derived by trigger; a write
 *     here would make two authors of one fact. §C drives the real write path against a recording
 *     client and asserts the exact set of tables touched — by ACT, not by reading the source.
 *   · A duplicate is SUCCESS, not failure — what lets a nervous owner run the import twice.
 *   · #179: the column list is asserted against what the MIGRATION creates, in both directions.
 *     A column with no reader and no writer is invisible to tsc, eslint, knip and every probe.
 *
 * 🔴 THE FAKE CAN REFUSE WHAT THE REAL THING REFUSES (§6 r19 / R-33): a permission error and a
 * unique violation are both modelled, and every table touched is RECORDED — so a write to
 * `customers` would be SEEN rather than silently accepted (tech-debt #138).
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/contactWriter.test.ts --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  planContactRows, writeContactRecord, CONTACT_PHONE_COLUMNS, CONTACT_EMAIL_COLUMNS,
} from './contactWriter';
import { buildContactRecord } from './contactRecord';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg);
}

interface Call { table: string; op: string; rows: Record<string, unknown>[]; opts: unknown }
type Reply = 'ok' | 'error' | 'dup';

function recordingDb(mode: Reply = 'ok') {
  const calls: Call[] = [];
  // 🔴 THE DOUBLE MODELS THE REAL CHAIN, INCLUDING `.select()` AFTER `.upsert()` (§6 r19 / R-33).
  // The first version returned a bare Promise from `upsert`, so `.select('id')` threw — and had it
  // instead returned `{data,error}` directly, every assertion below would have passed against a
  // shape the real client does not have. A double more forgiving than the real system is a rubber
  // stamp (tech-debt #138); one that cannot even be CALLED the way production calls it is worse.
  const db = {
    from(table: string) {
      const settle = (rows: Record<string, unknown>[]) => {
        if (mode === 'error') return Promise.resolve({ data: null, error: { message: 'permission denied', code: '42501' } });
        // 🔴 `ignoreDuplicates` + a collision = SUCCESS WITH ZERO ROWS AND NO ERROR. That is the
        // real PostgREST behaviour and it is the whole reason `landed` exists — the double must be
        // able to produce it, or the zero-landed branch is untested.
        if (mode === 'dup') return Promise.resolve({ data: [], error: null });
        return Promise.resolve({ data: rows.map((_, i) => ({ id: `row-${i}` })), error: null });
      };
      return {
        upsert(rows: Record<string, unknown>[], opts: unknown) {
          calls.push({ table, op: 'upsert', rows, opts });
          return { select: (_cols: string) => settle(rows) };
        },
        insert(rows: Record<string, unknown>[]) {
          calls.push({ table, op: 'insert', rows, opts: null });
          return { select: (_cols: string) => settle(rows) };
        },
        update(row: Record<string, unknown>) {
          calls.push({ table, op: 'update', rows: [row], opts: null });
          return { select: (_cols: string) => settle([row]) };
        },
        select(_cols: string) { calls.push({ table, op: 'select', rows: [], opts: null }); return Promise.resolve({ data: [], error: null }); },
      };
    },
  } as unknown as SupabaseClient;
  return { db, calls };
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
    const { db, calls } = recordingDb('ok');
    const out = await writeContactRecord(db, BIZ, CUST, FULL);
    ok(out.ok === true, 'C1 a clean write succeeds');
  ok(out.ok === true && out.landed.phones === 2 && out.planned.phones === 2,
    'C1b 🔴 the LANDED count is read back from the write, not assumed from the plan (A8)');
    const tables = [...new Set(calls.map(c => c.table))].sort();
    ok(tables.join(',') === 'customer_addresses,customer_emails,customer_phones',
      `C2 🔴 exactly three tables are touched (got ${tables.join(',')})`);
    ok(!tables.includes('customers'),
      'C3 🔴 `customers` is NEVER written — the flat columns are derived, and a second author would drift');
    ok(!tables.includes('deliveries'),
      'C4 `deliveries` is never written — D-41\'s invariant is not this module\'s to break');
    ok(calls.every(c => c.op === 'upsert'), 'C5 every write is an upsert');
    ok(calls.every(c => (c.opts as { ignoreDuplicates?: boolean })?.ignoreDuplicates === true),
      'C6 🔴 every write asks to ignore duplicates — what makes a second import a no-op rather than an error');
  }

  // ══ D. REFUSALS ARE VALUES, AND A DUPLICATE IS NOT A REFUSAL ════════════════════════════════
  {
    const { db } = recordingDb('error');
    const out = await writeContactRecord(db, BIZ, CUST, FULL);
    ok(out.ok === false, 'D1 a permission error is reported, not swallowed');
    ok(out.ok === false && out.error.includes('customer_phones'),
      'D2 …and it names the table that refused');

    const dup = recordingDb('dup');
    const out2 = await writeContactRecord(dup.db, BIZ, CUST, FULL);
    ok(out2.ok === true,
      'D3 🔴 a duplicate is SUCCESS — re-importing a customer must not raise an error at the owner');
    ok(out2.ok === true && out2.planned.phones === 2 && out2.landed.phones === 0,
      'D3b 🔴 …and the pair TELLS THE TRUTH: 2 planned, 0 landed — what makes a run-wide refusal visible');

    const emptyRec = buildContactRecord({ Id: '3', DisplayName: 'Nobody' });
    const none = recordingDb('ok');
    const out3 = await writeContactRecord(none.db, BIZ, CUST, emptyRec);
    ok(out3.ok === true && none.calls.length === 0,
      `D4 a record with nothing to write performs NO write at all (got ${none.calls.length} calls)`);
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
  }

  console.log(`\ncontactWriter: ${passed} passed, ${failed} failed`);
  if (failed > 0) { failures.forEach(f => console.error('  \u2717 ' + f)); process.exit(1); }
}

void main();
