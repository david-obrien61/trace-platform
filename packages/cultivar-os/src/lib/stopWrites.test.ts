/**
 * ── stopWrites — the ship-to edit writes the STOP, records the change, and never the customer ──
 *
 * WHAT THIS GUARDS (ledger #301, David 2026-09-11):
 *   · "If the delivery location changes I need to be able to edit the ship-to address" — and it MUST
 *     NOT write back to `customers` (D-41 L1: the snapshot is the point).
 *   · "The edit is evidence, so do not discard it" — every saved edit leaves an `audit_log` row with
 *     the customer and the address on it, so "do customers reorder to the same sites?" can be asked.
 *   · R-12 / A8 — a write RLS refused returns NO ERROR and zero rows; success is the COUNT.
 *
 * 🔴 THE FAKE CAN REFUSE WHAT THE REAL THING REFUSES (§6 r19): zero rows (an RLS refusal), an error,
 * two rows, and a failed history insert are all modelled — and it RECORDS every table touched, so a
 * write to `customers` would be seen rather than silently accepted.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/stopWrites.test.ts --bundle --platform=node --format=cjs | node
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  planShipToEdit, saveShipTo, shipToAuditRow, shipToLine, shipToFormOf, updateStop,
  SHIP_TO_FIELDS, SHIP_TO_AUDIT_ACTION,
} from './stopWrites';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg);
}

type Reply = 'ok' | 'error' | 'zero' | 'two';
interface Call { table: string; op: string; payload: Record<string, unknown>; filters: string[] }

function recordingDb(mode: { update?: Reply; audit?: Reply } = {}) {
  const calls: Call[] = [];
  const answer = (m: Reply, id: string) => {
    if (m === 'error') return Promise.resolve({ data: null, error: { message: 'permission denied' } });
    if (m === 'zero')  return Promise.resolve({ data: [], error: null });
    if (m === 'two')   return Promise.resolve({ data: [{ id: 'a' }, { id: 'b' }], error: null });
    return Promise.resolve({ data: [{ id }], error: null });
  };
  const db = {
    from(table: string) {
      return {
        update(payload: Record<string, unknown>) {
          const call: Call = { table, op: 'update', payload, filters: [] };
          calls.push(call);
          const chain = {
            eq(k: string, v: string) { call.filters.push(`${k}=${v}`); return chain; },
            select(_c: string) { return answer(mode.update ?? 'ok', 'stop-1'); },
          };
          return chain;
        },
        insert(payload: Record<string, unknown>) {
          calls.push({ table, op: 'insert', payload, filters: [] });
          return { select(_c: string) { return answer(mode.audit ?? 'ok', 'audit-1'); } };
        },
      };
    },
  };
  return { db: db as unknown as SupabaseClient, calls };
}

// A real LAWNS ship-to from the 2026-09-09 route run (CARD 1 of the route board).
const STOP = {
  id: 'stop-1', customer_id: 'cust-9', order_id: 'ord-3',
  address_line1: '348 Blue Oasis Ln', city: 'Leander', state: 'TX', zip: '78641',
};
const FORM_SAME = shipToFormOf(STOP);
const FORM_MOVED = { ...FORM_SAME, address_line1: '  2020 Saco St ', city: 'Liberty Hill' };

async function main(): Promise<void> {
  // ══ A. THE PLAN ═════════════════════════════════════════════════════════════════════════════
  ok(planShipToEdit(STOP, FORM_SAME).kind === 'no_change', 'A1 an unchanged form writes nothing');
  ok(planShipToEdit(STOP, { ...FORM_SAME, city: ' Leander  ' }).kind === 'no_change', 'A2 whitespace is not a change');
  {
    const p = planShipToEdit(STOP, FORM_MOVED);
    ok(p.kind === 'write', 'A3 a moved address plans a write');
    if (p.kind === 'write') {
      ok(p.after.address_line1 === '2020 Saco St', `A4 the street is trimmed (got "${p.after.address_line1}")`);
      ok(p.changedFields.join(',') === 'address_line1,city', `A5 changed fields named (got ${p.changedFields.join(',')})`);
      ok(Object.keys(p.after).sort().join(',') === [...SHIP_TO_FIELDS].sort().join(','),
        'A6 all four fields travel together — one address, not four facts');
      ok(p.before.address_line1 === '348 Blue Oasis Ln', 'A7 the before is the stop as it was');
    }
  }
  {
    const p = planShipToEdit(STOP, { ...FORM_SAME, address_line1: '   ' });
    ok(p.kind === 'refused' && /street/i.test(p.reason), 'A8 a blank street is REFUSED in words');
  }
  {
    const p = planShipToEdit(STOP, { ...FORM_SAME, city: '', zip: '' });
    ok(p.kind === 'refused' && /city or a ZIP/i.test(p.reason), 'A9 no city AND no ZIP is refused — the map cannot place it');
  }
  ok(planShipToEdit(STOP, { ...FORM_SAME, city: '' }).kind === 'write', 'A10 a ZIP alone is enough');
  ok(planShipToEdit(STOP, { ...FORM_SAME, zip: '' }).kind === 'write', 'A11 a city alone is enough');
  {
    const p = planShipToEdit(STOP, { ...FORM_SAME, state: '' });
    ok(p.kind === 'write' && p.after.state === null, 'A12 a cleared field is NULL, never an empty string (A9)');
  }

  // ══ B. THE HISTORY ROW — the customer and the address are on it ══════════════════════════════
  {
    const p = planShipToEdit(STOP, FORM_MOVED);
    if (p.kind !== 'write') { ok(false, 'B0 fixture'); return; }
    const row = shipToAuditRow({
      businessId: 'biz-1', actorUserId: 'user-7', stopId: STOP.id, customerId: STOP.customer_id,
      orderId: STOP.order_id, before: p.before, after: p.after, changedFields: p.changedFields,
      at: new Date('2026-09-11T15:00:00Z'),
    });
    ok(row.action === SHIP_TO_AUDIT_ACTION && row.target_type === 'delivery' && row.target_id === 'stop-1', 'B1 action + target');
    ok(row.detail.customer_id === 'cust-9', 'B2 🔴 the CUSTOMER is on the row — the address-book question groups on it');
    ok(row.detail.after.address_line1 === '2020 Saco St' && row.detail.before.address_line1 === '348 Blue Oasis Ln',
      'B3 🔴 the address before AND after are on the row');
    ok(row.detail.order_id === 'ord-3' && row.actor_user_id === 'user-7' && row.business_id === 'biz-1', 'B4 order, actor, tenant');
    ok(row.outcome === 'success', 'B5 outcome');
  }

  // ══ C. THE SAVE — deliveries, then audit_log, and NEVER customers ════════════════════════════
  const args = { businessId: 'biz-1', stop: STOP, actorUserId: 'user-7', now: new Date('2026-09-11T15:00:00Z') };
  {
    const { db, calls } = recordingDb();
    const out = await saveShipTo(db, { ...args, form: FORM_MOVED });
    ok(out.kind === 'saved' && out.audited === true, `C1 saved and recorded (got ${JSON.stringify(out)})`);
    ok(calls.map(c => `${c.table}.${c.op}`).join(' → ') === 'deliveries.update → audit_log.insert',
      `C2 exactly two writes, stop first (got ${calls.map(c => `${c.table}.${c.op}`).join(' → ')})`);
    ok(!calls.some(c => c.table === 'customers'), 'C3 🔴 the customer\'s record is NEVER written');
    ok(calls[0].filters.includes('id=stop-1') && calls[0].filters.includes('business_id=biz-1'), 'C4 scoped to this stop AND this tenant (AC-3)');
    ok(Object.keys(calls[0].payload).sort().join(',') === [...SHIP_TO_FIELDS].sort().join(','),
      `C5 the update carries the four address fields and nothing else (got ${Object.keys(calls[0].payload).join(',')})`);
  }
  {
    const { db, calls } = recordingDb();
    const out = await saveShipTo(db, { ...args, form: FORM_SAME });
    ok(out.kind === 'no_change' && calls.length === 0, 'C6 no change → no write and no history row');
  }
  {
    const { db, calls } = recordingDb();
    const out = await saveShipTo(db, { ...args, form: { ...FORM_SAME, address_line1: '' } });
    ok(out.kind === 'refused' && calls.length === 0, 'C7 a refusal touches nothing');
  }
  for (const m of ['zero', 'error', 'two'] as const) {
    const { db, calls } = recordingDb({ update: m });
    const out = await saveShipTo(db, { ...args, form: FORM_MOVED });
    ok(out.kind === 'failed', `C8:${m} an update that did not land exactly one row is a FAILURE`);
    ok(!calls.some(c => c.table === 'audit_log'),
      `C9:${m} 🔴 no history row for a change that did not happen — the log is append-only and cannot be corrected`);
  }
  for (const m of ['error', 'zero'] as const) {
    const { db } = recordingDb({ audit: m });
    const out = await saveShipTo(db, { ...args, form: FORM_MOVED });
    ok(out.kind === 'saved' && out.audited === false && typeof out.auditError === 'string' && out.auditError.length > 0,
      `C10:${m} saved-but-not-recorded is its OWN outcome, with a reason`);
  }

  // ══ D. updateStop — the ONE client update, count-checked ═════════════════════════════════════
  {
    const { db } = recordingDb();
    ok((await updateStop(db, 'biz-1', 'stop-1', { delivery_date: '2026-09-12' }, 'That delivery date')).ok, 'D1 one row → ok');
  }
  {
    const { db } = recordingDb({ update: 'zero' });
    const r = await updateStop(db, 'biz-1', 'stop-1', { delivery_date: null }, 'That delivery date');
    ok(!r.ok && /That delivery date was not saved/.test(r.error), 'D2 the RLS-refused zero-row update is named in words');
  }

  // ══ E. THE LINE ════════════════════════════════════════════════════════════════════════════
  ok(shipToLine(STOP) === '348 Blue Oasis Ln, Leander, TX, 78641', 'E1 the address as one line');
  ok(shipToLine({ address_line1: '9 Oak Ln', city: '  ', state: null, zip: '78641' }) === '9 Oak Ln, 78641', 'E2 blanks are skipped');
  ok(shipToFormOf({ address_line1: null }).address_line1 === '', 'E3 a null field opens as an empty input');

  // ══ F. NEGATIVE CONTROLS — the probes can refuse ═════════════════════════════════════════════
  {
    // If a writer DID touch customers, C3's predicate must see it.
    const fake: Call[] = [{ table: 'customers', op: 'update', payload: {}, filters: [] }];
    ok(fake.some(c => c.table === 'customers'), 'F1 the customers probe can see a customers write');
  }
  ok(planShipToEdit(STOP, FORM_MOVED).kind !== 'no_change', 'F2 a real change is not swallowed as no_change');

  console.log(`\nstopWrites: ${passed} passed, ${failed} failed`);
  if (failed) { for (const f of failures) console.log(`   ✗ ${f}`); process.exit(1); }
}

void main();
