// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: prove tech-debt #319 — finishing a stop fulfils its order, undoing puts it back, and
//   every half-completed case SAYS which half moved. David, 2026-09-22: *"say on screen when a
//   stop finished but the order could not be fulfilled for lack of orders:update; Undo done
//   reverses the fulfil."*
// DEPENDENCIES: stopFulfilsOrder (pure apart from the client and fetch, both injected here).
// OUTPUTS: assertions only.
// ─────────────────────────────────────────────────────────────────────────────
import { fulfilOrderForStop, restoreOrderForStop, stopOrderNote } from './stopFulfilsOrder';

let passed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else failures.push(m); };

const BIZ = 'b0000000-0000-4000-8000-00000000000b';

/** A client that answers the two reads and records the writes. `missingColumn` models the hours
 *  between this code going live and `20260923` being applied — PostgREST refuses the column. */
function fakeClient(opts: {
  orderStatus?: string | null; remembered?: string | null; missingColumn?: boolean;
} = {}) {
  const writes: Record<string, unknown>[] = [];
  const client: any = {
    auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) },
    from(table: string) {
      const b: any = {
        _sel: '',
        select(c: string) { b._sel = c; return b; },
        update(p: Record<string, unknown>) { writes.push({ table, ...p }); return b; },
        eq() { return b; },
        async maybeSingle() {
          if (table === 'orders') return { data: { status: opts.orderStatus ?? null }, error: null };
          if (b._sel.includes('order_status_before_finish')) {
            if (opts.missingColumn) {
              return { data: null, error: { code: '42703', message: 'column does not exist' } };
            }
            return { data: { order_status_before_finish: opts.remembered ?? null }, error: null };
          }
          return { data: null, error: null };
        },
        then(res: any) { return Promise.resolve({ data: null, error: null }).then(res); },
      };
      return b;
    },
  };
  return { client, writes };
}

/** Replaces global fetch for the status call, recording what was asked of the endpoint. */
function fakeFetch(result: { ok: boolean; error?: string }) {
  const calls: any[] = [];
  (globalThis as any).fetch = async (_url: string, init: any) => {
    calls.push(JSON.parse(init.body));
    return { ok: result.ok, status: result.ok ? 200 : 403,
             json: async () => (result.ok ? { ok: true } : { error: result.error ?? 'nope' }) } as any;
  };
  return calls;
}

async function main(): Promise<void> {
  // ── §A · FINISH ────────────────────────────────────────────────────────────────────────────
  {
    const { client, writes } = fakeClient({ orderStatus: 'invoiced' });
    const calls = fakeFetch({ ok: true });
    const out = await fulfilOrderForStop(client, BIZ, { id: 's1', order_id: 'o1' }, true);
    ok(out.kind === 'fulfilled', `A1 finishing a stop fulfils its order (${out.kind})`);
    ok(calls.length === 1 && calls[0].action === 'status' && calls[0].status === 'fulfilled',
       'A2 🔴 THROUGH THE ONE ENDPOINT THAT OWNS STOCK — no second copy of the fulfil rule lives here');
    ok(writes.some(w => w.order_status_before_finish === 'invoiced'),
       'A3 🔴 THE STOP REMEMBERS WHAT THE ORDER WAS — without it, Undo cannot put the order back and the stock stays sold');
  }
  {
    // 🔴 THE HALF-MOVE DAVID ASKED FOR BY NAME.
    const { client, writes } = fakeClient({ orderStatus: 'invoiced' });
    const calls = fakeFetch({ ok: true });
    const out = await fulfilOrderForStop(client, BIZ, { id: 's1', order_id: 'o1' }, false);
    ok(out.kind === 'not-allowed', `A4 without orders:update the order is NOT fulfilled (${out.kind})`);
    ok(calls.length === 0 && writes.length === 0, 'A5 …and nothing is attempted — no write, no call');
    const note = stopOrderNote(out);
    ok(!!note?.bad && /NOT marked fulfilled/.test(note!.text) && /nothing will come off your stock/.test(note!.text),
       `A6 🔴 AND THE SCREEN SAYS SO, in words that name the consequence (${note?.text.slice(0, 60)})`);
  }
  {
    const { client } = fakeClient({ orderStatus: 'invoiced' });
    fakeFetch({ ok: false, error: 'Not authorized to change order status' });
    const out = await fulfilOrderForStop(client, BIZ, { id: 's1', order_id: 'o1' }, true);
    ok(out.kind === 'failed' && /The stop is finished\./.test((out as any).message),
       'A7 a refusal from the endpoint still reports the stop as finished — the halves are named separately');
  }
  {
    const { client } = fakeClient({ orderStatus: null });
    const calls = fakeFetch({ ok: true });
    const out = await fulfilOrderForStop(client, BIZ, { id: 's1', order_id: null }, true);
    ok(out.kind === 'no-order' && calls.length === 0,
       'A8 a stop with no order finishes quietly — one of LAWNS\'s 45 has none, and that is ordinary');
    ok(stopOrderNote(out) === null, 'A9 …and says nothing, because there is nothing to say');
  }
  {
    const { client } = fakeClient({ orderStatus: 'fulfilled' });
    const calls = fakeFetch({ ok: true });
    const out = await fulfilOrderForStop(client, BIZ, { id: 's1', order_id: 'o1' }, true);
    ok(out.kind === 'already' && calls.length === 0,
       'A10 🔴 AN ALREADY-FULFILLED ORDER IS NOT RE-FULFILLED — a second decrement would invent a sale');
  }

  // ── §B · UNDO ──────────────────────────────────────────────────────────────────────────────
  {
    const { client, writes } = fakeClient({ orderStatus: 'fulfilled', remembered: 'invoiced' });
    const calls = fakeFetch({ ok: true });
    const out = await restoreOrderForStop(client, BIZ, { id: 's1', order_id: 'o1' }, true);
    ok(out.kind === 'restored' && (out as any).to === 'invoiced',
       `B1 🔴 UNDO DONE REVERSES THE FULFIL (${out.kind}) — otherwise a run that did not happen leaves stock decremented`);
    ok(calls[0]?.status === 'invoiced', 'B2 …back to the status the stop remembered, not a guessed one');
    ok(writes.some(w => w.order_status_before_finish === null), 'B3 …and the stop forgets, so a later undo cannot re-apply it');
  }
  {
    const { client } = fakeClient({ orderStatus: 'fulfilled', remembered: null });
    const calls = fakeFetch({ ok: true });
    const out = await restoreOrderForStop(client, BIZ, { id: 's1', order_id: 'o1' }, true);
    ok(out.kind === 'nothing-remembered', `B4 with nothing remembered it refuses to guess (${out.kind})`);
    ok(calls.length === 0, 'B5 …and changes nothing');
    ok(/stock stays sold/.test(stopOrderNote(out)!.text),
       'B6 🔴 …and says the consequence out loud, because the order IS still fulfilled');
  }
  {
    // The hours between this code going live and the migration being applied.
    const { client } = fakeClient({ orderStatus: 'fulfilled', missingColumn: true });
    const calls = fakeFetch({ ok: true });
    const out = await restoreOrderForStop(client, BIZ, { id: 's1', order_id: 'o1' }, true);
    ok(out.kind === 'nothing-remembered' && calls.length === 0,
       '🔴 B7 WITH THE COLUMN NOT YET APPLIED IT DEGRADES HONESTLY — it does not throw, and it does not guess a status');
  }
  {
    const { client } = fakeClient({ orderStatus: 'invoiced', remembered: null });
    const out = await restoreOrderForStop(client, BIZ, { id: 's1', order_id: 'o1' }, true);
    ok(out.kind === 'no-order' && stopOrderNote(out) === null,
       'B8 🔴 NEGATIVE CONTROL — an order that is not fulfilled produces no complaint: there is nothing to put back');
  }
  {
    const { client } = fakeClient({ orderStatus: 'fulfilled', remembered: 'invoiced' });
    const calls = fakeFetch({ ok: true });
    const out = await restoreOrderForStop(client, BIZ, { id: 's1', order_id: 'o1' }, false);
    ok(out.kind === 'not-allowed' && calls.length === 0,
       'B9 without orders:update the reopen leaves the order alone, and says so');
  }

  // ── §C · the sentences ─────────────────────────────────────────────────────────────────────
  ok(stopOrderNote({ kind: 'fulfilled', from: 'invoiced' })!.bad === false,
     'C1 🔴 "its order is marked fulfilled" is NOT an error — rendering it red would read as a failure');
  ok(stopOrderNote({ kind: 'restored', to: 'invoiced' })!.text.includes('invoiced'),
     'C2 the restore names where the order went, so it is checkable on screen');

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) { console.log(failures.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
}

void main();
