/**
 * ── itemImportWriter — the write, the order, and the undo that has to be complete ─────────
 *
 * 🔴 WHAT IS UNDER TEST IS WHAT THE RUN LEAVES BEHIND, NOT WHETHER IT SUCCEEDS. Lauren is
 * promised she can import, look, wipe and reload as many times as she likes. Every probe here is
 * about a state she could be left in: a catalogue that vanished, a catalogue stacked on the old
 * one, an undo that took her deliveries with it, or a ledger row nothing can remove.
 *
 * §A  🔴 the row a create writes — qty 0, price null-not-zero, unit columns derived
 * §B  🔴 NO LEDGER, NO RPC — R-93, asserted against a recording client, not a comment
 * §C  🔴 create BEFORE retire, and the retire excludes THIS run's own rows
 * §D  🔴 a zero-row write is a failure (R-12 / A8), and a partial create stops
 * §E  🔴 the write boundary, exhaustively — which tables are touched and which are not
 * §F  🔴 the undo REFUSES while QuickBooks writes are on
 * §G  🔴 the undo un-retires by RUN ID, never by timestamp
 * §H  🔴 receipts and deliveries are asserted before AND after
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/itemImportWriter.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import {
  rowForItem, previewItemImport, commitItemImport, undoItemImport,
  ITEM_IMPORT_SOURCE, RETIRE_REASON, ITEM_IMPORT_INSERT_COLUMNS,
} from './itemImportWriter';
import { adaptQboItems } from './qboItemAdapter';
import type { QboItemRow } from './itemList';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

const BIZ = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const RUN = '11111111-2222-3333-4444-555555555555';
const OLD_RUN = '99999999-8888-7777-6666-555555555555';

const it = (id: string, name: string, o: Partial<QboItemRow> = {}): QboItemRow => ({
  id, name, type: 'NonInventory', incomeAccount: 'Sales of Nursery Stock', active: true,
  unitPrice: null, purchaseCost: null, sku: null, description: null, fullyQualifiedName: name, ...o,
});

/**
 * A RECORDING supabase double.
 *
 * 🔴 IT MODELS WHAT CAN REFUSE (§6 r19a). `insert` returns only the rows the fixture says landed,
 * so a partial write is reachable; `update`/`delete` return only rows matching the filters that
 * were actually applied, so a MISSING filter changes the answer instead of being invisible. A
 * double that always echoes its input is a rubber stamp and the assertions resting on it are
 * decoration (tech-debt #138).
 */
function recorder(opts: {
  inventory?: any[];
  customers?: any[];
  receipts?: number; deliveries?: number;
  insertLands?: number | 'all';
  failOn?: 'insert' | 'update' | null;
  /** 🔴 SIMULATES THE IMPOSSIBLE. Applied to the count the SECOND time each table is read, so the
   *  before/after assertion has a case where it must disagree. Without this the double reported a
   *  fixed number both times and `untouched` could never be false — mutant W11 (hardcoding it to
   *  `true`) survived exactly there. A double that cannot produce the failure cannot prove the
   *  check for it exists (§6 r19a). */
  driftAfter?: { receipts?: number; deliveries?: number };
  /** 🔴 SIMULATES AN RLS REFUSAL: the statement returns NO ERROR and changes nothing, which is
   *  exactly what PostgREST does when a policy declines the write. Without this the double could
   *  not produce the one state the leftover re-read exists to detect (§6 r19a — a double must be
   *  able to refuse what the real thing refuses). */
  refuseWrites?: boolean;
  /** 🔴 THE OWNER'S SWITCH — `businesses.qbo_writes_enabled`. Defaults to FALSE (test mode), which
   *  is LAWNS's live value. `undefined` here means the businesses row could not be read at all. */
  writesEnabled?: boolean | undefined;
  /** Simulates the businesses read FAILING, so the "we could not check" refusal is reachable. */
  businessReadFails?: boolean;
} = {}) {
  const calls: { table: string; verb: string; filters: [string, string, any][]; payload?: any }[] = [];
  const inventory: any[] = (opts.inventory ?? []).map(r => ({ ...r }));
  // 🔴 SEPARATE STORES PER TABLE. The first draft of this double gave `customers` and
  // `business_inventory` ONE array, so the undo's customer DELETE removed an inventory row and
  // §G/§H went red. The probes caught the harness, which is the direction that should be cheap:
  // a double that cannot tell two tables apart cannot prove a write touched only one of them.
  const customers: any[] = (opts.customers ?? []).map(r => ({ ...r }));
  // The tenant's own row. Present unless `businessReadFails`.
  const businesses: any[] = opts.businessReadFails ? [] : [{
    id: BIZ, qbo_writes_enabled: opts.writesEnabled === undefined ? false : opts.writesEnabled,
  }];
  const store = (t: string) => (t === 'customers' ? customers : t === 'businesses' ? businesses : inventory);
  const counts: Record<string, number> = { receipts: opts.receipts ?? 0, deliveries: opts.deliveries ?? 0 };
  const reads: Record<string, number> = { receipts: 0, deliveries: 0 };

  function builder(table: string, verb: string, payload?: any) {
    const filters: [string, string, any][] = [];
    const rec = { table, verb, filters, payload };
    calls.push(rec);
    let headMode = false;
    const b: any = {
      select(_c?: string, o?: any) { if (o?.head) headMode = true; return b; },
      eq(c: string, v: any)  { filters.push([c, 'eq', v]);  return b; },
      neq(c: string, v: any) { filters.push([c, 'neq', v]); return b; },
      is(c: string, v: any)  { filters.push([c, 'is', v]);  return b; },
      gt(c: string, v: any)  { filters.push([c, 'gt', v]);  return b; },
      or(s: string)          { filters.push(['__or', 'or', s]); return b; },
      order() { return b; },
      limit() { return b; },
      // 🔴 ADDED 2026-09-06 AND IT WENT RED FIRST. The gate now reads `businesses.qbo_writes_enabled`
      // via `.maybeSingle()`, which this double did not implement, so the whole suite THREW. That is
      // the double being NARROWER than the client — the harmless direction. The dangerous one is a
      // double more FORGIVING than the real thing (tech-debt #138), which a silent catch-all would
      // have been.
      maybeSingle() { const r: any = result(); const rows = r.data ?? []; return Promise.resolve({ data: rows[0] ?? null, error: r.error }); },
      then(resolve: any) { return Promise.resolve(result()).then(resolve); },
    };
    function matches(row: any): boolean {
      for (const [c, op, v] of filters) {
        if (c === '__or') {
          // "import_run_id.is.null,import_run_id.neq.<run>"
          const clauses = String(v).split(',');
          const anyTrue = clauses.some(cl => {
            const [col, o2, val] = cl.split('.');
            if (o2 === 'is' && val === 'null') return row[col] == null;
            if (o2 === 'neq') return row[col] != null && String(row[col]) !== val;
            return false;
          });
          if (!anyTrue) return false;
          continue;
        }
        if (op === 'eq'  && String(row[c]) !== String(v)) return false;
        if (op === 'neq' && String(row[c]) === String(v)) return false;
        if (op === 'is'  && v === null && row[c] != null) return false;
        if (op === 'gt'  && !(Number(row[c]) > Number(v))) return false;
      }
      return true;
    }
    function result(): any {
      if (opts.failOn === verb) return { data: null, error: { message: `simulated ${verb} failure` }, count: null };
      if (table !== 'business_inventory' && table !== 'customers' && table !== 'businesses') {
        reads[table] = (reads[table] ?? 0) + 1;
        const drift = (opts.driftAfter as any)?.[table];
        const n = (reads[table] > 1 && drift !== undefined) ? drift : (counts[table] ?? 0);
        return { data: [], error: null, count: n };
      }
      const rows_ = store(table);
      if (verb === 'select') {
        const hits = rows_.filter(matches);
        return headMode ? { data: null, error: null, count: hits.length } : { data: hits, error: null, count: hits.length };
      }
      if (verb === 'insert') {
        const rows = Array.isArray(payload) ? payload : [payload];
        const n = opts.insertLands === undefined || opts.insertLands === 'all' ? rows.length : opts.insertLands;
        const landed = rows.slice(0, n).map((r: any, i: number) => ({ ...r, id: `new-${i}` }));
        rows_.push(...landed);
        return { data: landed.map((r: any) => ({ id: r.id })), error: null, count: landed.length };
      }
      if (verb === 'update') {
        if (opts.refuseWrites) return { data: [], error: null, count: 0 };
        const hits = rows_.filter(matches);
        for (const h of hits) Object.assign(h, payload);
        return { data: hits.map(h => ({ id: h.id })), error: null, count: hits.length };
      }
      if (verb === 'delete') {
        // An RLS refusal: no error, no rows changed, and the caller cannot tell it from "nothing
        // matched" without reading the table back.
        if (opts.refuseWrites) return { data: [], error: null, count: 0 };
        const hits = rows_.filter(matches);
        for (const h of hits) rows_.splice(rows_.indexOf(h), 1);
        return { data: hits.map(h => ({ id: h.id })), error: null, count: hits.length };
      }
      return { data: [], error: null, count: 0 };
    }
    return b;
  }

  const db = {
    from(table: string) {
      return {
        select: (c?: string, o?: any) => builder(table, 'select').select(c, o),
        insert: (p: any) => builder(table, 'insert', p),
        update: (p: any) => builder(table, 'update', p),
        delete: () => builder(table, 'delete'),
      };
    },
  };
  return { db, calls, inventory, customers, businesses };
}

const HELD = 'all';        // QBO_PUSH_HOLD=all → the OPERATOR's hold covers every business.
// ✏️ `WRITES_ON = ''` IS GONE, AND ITS NAME WAS THE BUG IN ONE WORD. An unset env var never meant
// "writes are live" — it means the OPERATOR is not holding, which says nothing about whether the
// OWNER has switched writes on. §F now drives both switches as a matrix instead of naming one of
// them after the answer it does not have.

// ── §A the row a create writes ───────────────────────────────────────────────
{
  const a = adaptQboItems([it('859', 'NZCM30', { unitPrice: 900, description: 'Natchez Crape Myrtle - 30 gallon' })]);
  const r = rowForItem(BIZ, RUN, a.items[0]);
  ok(r.qty === 0, '§A 🔴 qty is 0 — this import brings a PRODUCT LIST, not stock');
  ok(r.business_id === BIZ, '§A business_id is stamped (AC-3)');
  ok(r.qb_item_id === '859', '§A the Intuit Item.Id is the identity, not the SKU');
  ok(r.import_run_id === RUN, '§A the run id is on the row — that is what makes the undo exact');
  ok(r.source === ITEM_IMPORT_SOURCE, '§A the row says where it came from in plain text');
  ok(r.name === 'Natchez Crape Myrtle', '§A 🔴 the NAME is the product, not the QuickBooks code "NZCM30"');
  ok(r.size === '30 gallon', '§A the size is the string QuickBooks wrote — faithful, never normalised (D-23)');
  ok(r.sell_price === 900, '§A the published price rides across');
  ok(r.unit_kind === 'container' && r.unit_value === 30 && r.unit_name === 'gallon',
     '§A 🔴 the unit projection is DERIVED through unitColumnsFor and no other path (R-27)');
  ok(r.unit_parsed_from === '30 gallon', '§A unit_parsed_from carries the exact string the parse ran on');

  // 🔴 THE PRICE THAT IS NOT THERE MUST BE NULL, NEVER 0.
  const noPrice = adaptQboItems([it('1', 'X', { unitPrice: null, description: 'Live Oak - 15 gallon' })]);
  const rn = rowForItem(BIZ, RUN, noPrice.items[0]);
  ok(rn.sell_price === null, '§A 🔴 an item with NO published price writes NULL — a $0 price card would make every sale read "at or above list"');
  ok(rn.price_basis === null, '§A and no basis is claimed for a price that does not exist');

  // An unreadable size: the projection says "the parser ran and declined", not "nothing here".
  const unread = adaptQboItems([it('1', 'X', { description: 'Bermuda sod, 450 sq. ft.' })]);
  const ru = rowForItem(BIZ, RUN, unread.items[0]);
  ok(ru.size === null && ru.unit_kind === null, '§A an unreadable size stores no size and no unit');
  ok(ru.unit_parsed_from === null, '§A 🔴 and unit_parsed_from is NULL — nothing was parsed, so nothing claims to have been');

  ok(ITEM_IMPORT_INSERT_COLUMNS.every(c => c in r), '§A every DECLARED insert column is actually present on the row (#179 class)');
  ok(Object.keys(r).every(k => (ITEM_IMPORT_INSERT_COLUMNS as readonly string[]).includes(k)),
     '§A 🔴 and the row carries NO column the declaration omits — the list is the source, both directions');
}

// ── §B NO LEDGER, NO RPC (R-93) ──────────────────────────────────────────────
async function sectionB() {
  const { db, calls } = recorder({ inventory: [{ id: 'old1', business_id: BIZ, qty: 0, retired_at: null, import_run_id: null }] });
  await commitItemImport(db as any, BIZ, [it('1', 'X', { description: 'Live Oak - 15 gallon' })], RUN, HELD);
  const tables = new Set(calls.map(c => c.table));
  ok(!tables.has('business_inventory_ledger'),
     '§B 🔴 NOT ONE WRITE TO business_inventory_ledger — reuse of importWrites would have landed 647 IMMUTABLE rows and the undo could never be complete (R-93)');
  ok(!(db as any).rpc, '§B the double exposes no `rpc`, so a D-50 RPC call could not even compile here');
  ok(calls.every(c => c.verb !== 'rpc'), '§B no RPC verb was issued');
}

// ── §C create BEFORE retire, and the retire excludes THIS run ────────────────
async function sectionC() {
  const existing = [
    { id: 'old1', business_id: BIZ, qty: 0, retired_at: null, import_run_id: null },
    { id: 'old2', business_id: BIZ, qty: 1, retired_at: null, import_run_id: null },
    { id: 'prev', business_id: BIZ, qty: 0, retired_at: null, import_run_id: OLD_RUN },
  ];
  const { db, calls, inventory } = recorder({ inventory: existing });
  const rep = await commitItemImport(db as any, BIZ,
    [it('1', 'A', { description: 'Live Oak - 15 gallon' }), it('2', 'B', { description: 'Red Maple - 30 gallon' })], RUN, HELD);

  const writeVerbs = calls.filter(c => c.verb === 'insert' || c.verb === 'update');
  ok(writeVerbs[0]?.verb === 'insert', '§C 🔴 CREATE runs FIRST — a failure leaves a superset, never an empty catalogue');
  ok(writeVerbs[1]?.verb === 'update', '§C RETIRE runs second');
  ok(rep.created === 2 && rep.committed, '§C both rows created and the run committed');

  // 🔴 THE TRAP. "Retire everything live" after the insert would retire the rows just made.
  const madeRows = inventory.filter(r => r.import_run_id === RUN);
  ok(madeRows.length === 2, '§C both new rows are in the table');
  ok(madeRows.every(r => r.retired_at == null),
     '§C 🔴 THIS RUN\'S OWN ROWS ARE NOT RETIRED BY ITS OWN RETIRE STEP — the trap the ordering sets, disarmed');
  ok(inventory.find(r => r.id === 'old1')?.retired_at != null, '§C the pre-existing row IS retired');
  ok(inventory.find(r => r.id === 'old2')?.retired_at != null,
     '§C 🔴 a row carrying a real COUNT is retired too — R-A: all 447, no exceptions, they are David\'s test data');
  ok(inventory.find(r => r.id === 'prev')?.retired_at != null,
     '§C 🔴 a PREVIOUS run\'s rows are retired as well — the filter is "not THIS run", not "has no run"');
  ok(rep.retired === 3, '§C three old rows retired, the two new ones untouched');
  ok(inventory.find(r => r.id === 'old1')?.retired_by_run_id === RUN, '§C the retire stamps WHICH run hid it');
  ok(inventory.find(r => r.id === 'old1')?.retired_reason === RETIRE_REASON, '§C and why, in the owner\'s words');

  // The retire filter itself, read off the recorded call.
  const upd = calls.find(c => c.verb === 'update')!;
  ok(upd.filters.some(([c, o, v]) => c === 'retired_at' && o === 'is' && v === null),
     '§C the retire only touches rows that are not already retired');
  ok(upd.filters.some(([c]) => c === '__or'),
     '§C 🔴 the run exclusion is an `.or(is.null, neq)` — a bare `.neq` would match NO rows at LAWNS, where all 447 have a NULL import_run_id');
}

// ── §D a zero-row write is a failure ─────────────────────────────────────────
async function sectionD() {
  // 🔴 UNDER RLS A REFUSED INSERT RETURNS NO ERROR AND NO ROWS. "No error" is not evidence.
  const { db } = recorder({ inventory: [], insertLands: 0 });
  const rep = await commitItemImport(db as any, BIZ, [it('1', 'X', { description: 'Live Oak - 15 gallon' })], RUN, HELD);
  ok(!rep.committed, '§D 🔴 an insert that landed ZERO rows is NOT reported as success (R-12 / A8)');
  ok(rep.stoppedAt === 'create', '§D and the report names the phase that stopped');
  ok((rep.error ?? '').includes('0 of 1'), '§D the message says how many of how many landed');

  // A PARTIAL create is a failure too — 2 of 3 is not a catalogue.
  const p = recorder({ inventory: [], insertLands: 2 });
  const rp = await commitItemImport(p.db as any, BIZ, [
    it('1', 'A', { description: 'Live Oak - 15 gallon' }),
    it('2', 'B', { description: 'Red Maple - 30 gallon' }),
    it('3', 'C', { description: 'Cedar Elm - 45 gallon' }),
  ], RUN, HELD);
  ok(!rp.committed && rp.stoppedAt === 'create', '§D 🔴 a PARTIAL create stops the run — 2 of 3 rows is not a catalogue');
  ok(!p.calls.some(c => c.verb === 'update'),
     '§D 🔴 AND THE RETIRE NEVER RUNS — a half-built catalogue plus a retired old one is the one state that loses her products');

  // A failing retire is reported, and the created rows stay identifiable by run id.
  const f = recorder({ inventory: [{ id: 'old1', business_id: BIZ, qty: 0, retired_at: null, import_run_id: null }], failOn: 'update' });
  const rf = await commitItemImport(f.db as any, BIZ, [it('1', 'X', { description: 'Live Oak - 15 gallon' })], RUN, HELD);
  ok(!rf.committed && rf.stoppedAt === 'retire', '§D a failing retire names itself');
  ok(rf.created === 1, '§D and the created count is reported, so the undo has a number to check against');
  ok(f.inventory.some(r => r.import_run_id === RUN), '§D 🔴 the half-landed rows carry the run id — which is why no transaction is needed');
}

// ── §E the write boundary, exhaustively ──────────────────────────────────────
async function sectionE() {
  const { db, calls } = recorder({ inventory: [{ id: 'old1', business_id: BIZ, qty: 0, retired_at: null, import_run_id: null }] });
  await commitItemImport(db as any, BIZ, [it('1', 'X', { description: 'Live Oak - 15 gallon' })], RUN, HELD);
  const written = new Set(calls.filter(c => c.verb !== 'select').map(c => c.table));
  ok(written.size === 1 && written.has('business_inventory'),
     `§E 🔴 the commit writes business_inventory AND NOTHING ELSE (wrote: ${[...written].join(', ') || 'nothing'})`);
  for (const forbidden of ['orders', 'order_items', 'deliveries', 'receipts', 'customers', 'business_inventory_ledger', 'uppot_plans']) {
    ok(!written.has(forbidden), `§E no write to \`${forbidden}\``);
  }
  ok(!calls.some(c => c.verb === 'delete'), '§E 🔴 the COMMIT never deletes — deleting is the undo\'s job alone');
  // 🔴 AC-3 IS "SCOPED TO ONE TENANT", NOT "USES A COLUMN CALLED business_id" — and the gate read
  // made that distinction load-bearing. It selects the tenant's OWN row from `businesses`, whose
  // primary key is `id`, so a probe matching the literal string `business_id` failed it. Widening
  // to "`business_id` on every other table, `id` on `businesses`" keeps the assertion exact rather
  // than turning it into "some filter is present", which would pass a query scoped to nothing.
  ok(calls.every(c =>
       c.verb === 'insert'
       || (c.table === 'businesses'
             ? c.filters.some(([col, op, v]) => col === 'id' && op === 'eq' && v === BIZ)
             : c.filters.some(([col, op, v]) => col === 'business_id' && op === 'eq' && v === BIZ))),
     '§E every read and update is scoped to THIS tenant (AC-3) — business_id everywhere, and `id` on `businesses` itself');
  ok(calls.some(c => c.table === 'businesses'),
     '§E 🔴 and the gate read HAPPENED — an assertion about a query that was never issued proves nothing');
}

// ── §F 🔴 TWO SWITCHES, AND THE FIRST DRAFT READ ONLY ONE ─────────────────────
async function sectionF() {
  // 🔴 THIS SECTION EXISTS BECAUSE DAVID ASKED WHICH SWITCH `undoable` READS, AND THE ANSWER WAS
  // THE WRONG ONE. The first draft gated on `QBO_PUSH_HOLD` alone — the OPERATOR's env hold —
  // while the OWNER's switch is `businesses.qbo_writes_enabled` (`20260902`, NOT NULL DEFAULT
  // false), which is what `QboWriteSwitch.tsx` flips and `submit.ts:856` gates the real push on.
  // At LAWNS today that is `false` with the env var unset, so the old gate computed
  // `undoable: false` and REFUSED — in exactly the state the undo exists to serve.
  //
  // The matrix is the whole assertion. `pushPermitted` AND-s the two, so the undo is open whenever
  // EITHER hold is active, and closed only when both are clear.
  const lot = () => [{ id: 'made', business_id: BIZ, import_run_id: RUN, retired_at: null }];
  const MATRIX: { env: string; writes: boolean; open: boolean; why: string }[] = [
    { env: '',      writes: false, open: true,
      why: "🔴 LAWNS TODAY — env UNSET, owner's switch OFF. The undo is OPEN, and the first draft closed it here." },
    { env: 'all',   writes: false, open: true,
      why: 'both holds active — open' },
    { env: 'all',   writes: true,  open: true,
      why: "🔴 owner went live but the OPERATOR still holds — nothing can reach their books, so the undo stays OPEN" },
    { env: '',      writes: true,  open: false,
      why: '🔴 THE ONLY CLOSED CELL — both clear, an invoice can have gone out, the undo is SHUT' },
  ];
  for (const m of MATRIX) {
    const rec = recorder({ inventory: lot(), writesEnabled: m.writes, receipts: 111, deliveries: 31 });
    const r = await undoItemImport(rec.db as any, BIZ, RUN, m.env);
    ok(r.refused === !m.open,
       `§F [env=${JSON.stringify(m.env)} writes_enabled=${m.writes}] undo ${m.open ? 'OPEN' : 'REFUSED'} — ${m.why}`);
    ok(r.inventoryDeleted === (m.open ? 1 : 0), `§F …and it ${m.open ? 'deleted the row' : 'changed nothing'}`);
  }

  // The same matrix through the COMMIT's `undoable`, because a commit that reports the wrong
  // answer sends someone into an import believing it is reversible when it is not.
  for (const m of MATRIX) {
    const rec = recorder({ inventory: [], writesEnabled: m.writes });
    const r = await commitItemImport(rec.db as any, BIZ, [it('1', 'X', { description: 'Live Oak - 15 gallon' })], RUN, m.env);
    ok(r.undoable === m.open, `§F commit reports undoable=${m.open} for [env=${JSON.stringify(m.env)} writes=${m.writes}]`);
  }

  // 🔴 A FAILED READ CLOSES THE UNDO, AND SAYS SO IN DIFFERENT WORDS.
  const blind = recorder({ inventory: lot(), businessReadFails: true });
  const rb = await undoItemImport(blind.db as any, BIZ, RUN, '');
  ok(rb.refused === true, '§F 🔴 if we could not READ the switch, the undo REFUSES — deleting rows that might sit behind an invoice is the unrecoverable direction');
  ok(rb.inventoryDeleted === 0, '§F and nothing was changed');
  ok(/could not read/i.test(rb.error ?? ''), '§F 🔴 and the sentence says WE COULD NOT CHECK, not "you are live" — a person who cannot tell those apart acts on the wrong one');
  ok(!/switched on/i.test(rb.error ?? ''), '§F it does not claim the business is live');

  // The live refusal says the other thing.
  const liveRec = recorder({ inventory: lot(), writesEnabled: true });
  const rl = await undoItemImport(liveRec.db as any, BIZ, RUN, '');
  ok(/switched on/i.test(rl.error ?? '') && /Nothing was changed/i.test(rl.error ?? ''),
     '§F the LIVE refusal names the state and says what did not happen');
  ok(!/could not read/i.test(rl.error ?? ''), '§F 🔴 and the two refusals are NOT the same sentence');

  // 🔴 A REFUSAL ISSUES THE GATE READ AND NOTHING ELSE. It cannot be "first and absolute" any more
  // — the gate has to ask the database — so the assertion is now the one that matters: NO WRITE,
  // and no read of anything but the tenant's own row.
  ok(liveRec.calls.every(c => c.verb === 'select'), '§F 🔴 a refused undo issues ONLY reads — not one delete, not one update');
  ok(liveRec.calls.every(c => c.table === 'businesses'), '§F and the only table it touched was `businesses`, to ask the question');
  ok(liveRec.calls.length === 1, '§F exactly one query — it asks once and stops');

  // A per-business env hold still works, on top of the owner's switch.
  const one = recorder({ inventory: lot(), writesEnabled: true });
  ok((await undoItemImport(one.db as any, BIZ, RUN, BIZ)).refused === false, '§F an env hold naming THIS business re-opens the undo even though the owner is live');
  const other = recorder({ inventory: lot(), writesEnabled: true });
  ok((await undoItemImport(other.db as any, BIZ, RUN, 'some-other-business-id')).refused === true,
     '§F 🔴 an env hold naming a DIFFERENT business does NOT open this one\'s undo');
}

// ── §G the undo un-retires by RUN ID, never by timestamp ────────────────────
async function sectionG() {
  const { db, inventory, calls } = recorder({ inventory: [
    { id: 'thisRun',  business_id: BIZ, import_run_id: null,  retired_at: '2026-09-06T10:00:00Z', retired_by_run_id: RUN },
    { id: 'earlier',  business_id: BIZ, import_run_id: null,  retired_at: '2026-09-06T09:59:00Z', retired_by_run_id: OLD_RUN },
    { id: 'made',     business_id: BIZ, import_run_id: RUN,   retired_at: null, retired_by_run_id: null },
    { id: 'madePrev', business_id: BIZ, import_run_id: OLD_RUN, retired_at: null, retired_by_run_id: null },
  ] });
  const rep = await undoItemImport(db as any, BIZ, RUN, HELD);
  ok(rep.inventoryDeleted === 1, '§G only THIS run\'s created row is deleted');
  ok(inventory.some(r => r.id === 'madePrev'), '§G 🔴 a PREVIOUS run\'s created row survives — the delete is keyed on the run, not on "was imported"');
  ok(rep.unretired === 1, '§G one row un-retired');
  ok(inventory.find(r => r.id === 'thisRun')?.retired_at === null, '§G this run\'s retirement is lifted');
  ok(inventory.find(r => r.id === 'thisRun')?.retired_by_run_id === null, '§G and the stamp is cleared with it');
  ok(inventory.find(r => r.id === 'earlier')?.retired_at === '2026-09-06T09:59:00Z',
     '§G 🔴 A ROW RETIRED ONE MINUTE EARLIER BY A DIFFERENT RUN IS UNTOUCHED — a timestamp window would have silently restored a catalogue the owner had already replaced');
  const un = calls.find(c => c.verb === 'update')!;
  ok(un.filters.some(([c, o, v]) => c === 'retired_by_run_id' && o === 'eq' && v === RUN),
     '§G the un-retire filter is retired_by_run_id, read off the issued call');
  ok(!un.filters.some(([c]) => c === 'retired_at'), '§G and it does not filter on retired_at at all');
}

// ── §H receipts and deliveries, before AND after ────────────────────────────
async function sectionH() {
  const { db, calls } = recorder({
    inventory: [{ id: 'made', business_id: BIZ, import_run_id: RUN, retired_at: null }],
    receipts: 111, deliveries: 31,
  });
  const rep = await undoItemImport(db as any, BIZ, RUN, HELD);
  ok(rep.receiptsBefore === 111 && rep.receiptsAfter === 111, '§H 🔴 111 receipts before, 111 after');
  ok(rep.deliveriesBefore === 31 && rep.deliveriesAfter === 31, '§H 🔴 31 deliveries before, 31 after — 13 of them scheduled after today');
  ok(rep.ok === true, '§H unchanged counts is the ok condition, not merely a reported number');
  const touched = calls.filter(c => (c.table === 'receipts' || c.table === 'deliveries') && c.verb !== 'select');
  ok(touched.length === 0, '§H 🔴 NEITHER TABLE IS WRITTEN TO — asserted against the issued calls, not against the paragraph that claims it');

  // The customer delete runs, matches nothing today, and SAYS so rather than being skipped.
  ok(rep.customersDeleted === 0, '§H the customer delete matches zero rows today — the merge is not built — and reports 0 rather than being absent');
  ok(calls.some(c => c.table === 'customers' && c.verb === 'delete'), '§H but the statement IS issued, so the undo is complete the day the merge lands');
  const cd = calls.find(c => c.table === 'customers' && c.verb === 'delete')!;
  ok(cd.filters.some(([c, , v]) => c === 'import_run_id' && v === RUN), '§H and it is scoped to this run');
  ok(cd.filters.some(([c, , v]) => c === 'business_id' && v === BIZ), '§H and to this tenant (AC-3)');

  // 🔴 THE NEGATIVE CONTROL FOR THE ZERO. `customersDeleted === 0` above proves nothing on its
  // own — a customer delete that could never match anything would report 0 identically. So: give
  // the double a customer carrying this run id and watch the SAME call remove it.
  const withCust = recorder({
    inventory: [{ id: 'made', business_id: BIZ, import_run_id: RUN, retired_at: null }],
    customers: [
      { id: 'c1', business_id: BIZ, import_run_id: RUN },
      { id: 'c2', business_id: BIZ, import_run_id: OLD_RUN },
      { id: 'c3', business_id: BIZ, import_run_id: null },
    ],
    receipts: 111, deliveries: 31,
  });
  const rc = await undoItemImport(withCust.db as any, BIZ, RUN, HELD);
  ok(rc.customersDeleted === 1, '§H 🔴 the customer delete DOES delete when there is something to delete — the 0 above is a fact, not an incapacity');
  ok(withCust.customers.map(c => c.id).sort().join(',') === 'c2,c3',
     '§H and it leaves a PREVIOUS run\'s customer and a hand-made one alone');
  ok(rc.inventoryDeleted === 1, '§H 🔴 and the customer delete did NOT reach into business_inventory — two tables, two stores');

  // 🔴 THE IMPOSSIBLE CASE, SIMULATED — because a check nobody has watched refuse is a claim
  // (§6 r19b). Nothing in the undo can change a delivery count; this makes it change anyway and
  // asserts the undo NOTICES. Mutant W11 hardcodes `untouched = true` and dies here.
  const drifted = recorder({
    inventory: [{ id: 'made', business_id: BIZ, import_run_id: RUN, retired_at: null }],
    receipts: 111, deliveries: 31, driftAfter: { deliveries: 30 },
  });
  const rd = await undoItemImport(drifted.db as any, BIZ, RUN, HELD);
  ok(rd.deliveriesBefore === 31 && rd.deliveriesAfter === 30, '§H the drift is visible in the report');
  ok(rd.ok === false, '§H 🔴 A CHANGED DELIVERY COUNT MAKES THE UNDO NOT-OK, even though nothing in it could have caused one');
  ok((rd.error ?? '').includes('31') && (rd.error ?? '').includes('30'),
     '§H 🔴 and the message names BOTH numbers — "something changed" is not something an owner can act on');
  ok((rd.error ?? '').includes('Check before running anything else'),
     '§H it tells her what to do rather than only what happened');

  // The same shape for receipts, so neither half is asserted by accident.
  const dr = recorder({
    inventory: [{ id: 'made', business_id: BIZ, import_run_id: RUN, retired_at: null }],
    receipts: 111, deliveries: 31, driftAfter: { receipts: 110 },
  });
  const rr = await undoItemImport(dr.db as any, BIZ, RUN, HELD);
  ok(rr.ok === false, '§H 🔴 a changed RECEIPT count is caught too — both tables, not just the one that was tested');
}

// ── §I 🔴 the undo PROVES it landed, rather than trusting "no error" ─────────
async function sectionI() {
  // 🔴 THE SITUATION THIS EXISTS FOR. Under RLS a refused delete returns NO ERROR and zero rows —
  // identical, to the caller, to "there was nothing to delete". So the undo re-reads the tenant
  // and counts what still carries this run id.
  const refused = recorder({
    inventory: [
      { id: 'made',    business_id: BIZ, import_run_id: RUN, retired_at: null },
      { id: 'thisRun', business_id: BIZ, import_run_id: null, retired_at: '2026-09-06T10:00:00Z', retired_by_run_id: RUN },
    ],
    customers: [{ id: 'c1', business_id: BIZ, import_run_id: RUN }],
    receipts: 111, deliveries: 31, refuseWrites: true,
  });
  const rr = await undoItemImport(refused.db as any, BIZ, RUN, HELD);
  ok(rr.inventoryDeleted === 0 && rr.unretired === 0 && rr.customersDeleted === 0,
     '§I every statement reported zero rows and NO ERROR — the refusal is invisible at this layer');
  ok(rr.ok === false, '§I 🔴 AND THE UNDO REPORTS FAILURE ANYWAY, because it read the tenant back');
  ok(rr.leftovers.length === 3, '§I all three leftovers are named — created rows, hidden rows, and customers');
  ok(rr.leftovers.some(l => /still here/.test(l)) && rr.leftovers.some(l => /still hidden/.test(l)),
     '§I 🔴 and they say WHAT is still wrong in words an owner can act on, not a code');
  ok((rr.error ?? '').includes('refused write'), '§I the message names the shape of the failure');
  ok((rr.error ?? '').includes('Nothing else was run'), '§I and says nothing further was attempted');

  // 🔴 THE NEGATIVE CONTROL. The SAME fixture with writes permitted must come back clean — so the
  // failure above is caused by the refusal, not by the fixture (§6 r19b).
  const allowed = recorder({
    inventory: [
      { id: 'made',    business_id: BIZ, import_run_id: RUN, retired_at: null },
      { id: 'thisRun', business_id: BIZ, import_run_id: null, retired_at: '2026-09-06T10:00:00Z', retired_by_run_id: RUN },
    ],
    customers: [{ id: 'c1', business_id: BIZ, import_run_id: RUN }],
    receipts: 111, deliveries: 31,
  });
  const ra = await undoItemImport(allowed.db as any, BIZ, RUN, HELD);
  ok(ra.ok === true && ra.leftovers.length === 0, '§I 🔴 the identical fixture with writes ALLOWED comes back clean');
  ok(ra.inventoryDeleted === 1 && ra.unretired === 1 && ra.customersDeleted === 1, '§I and all three statements landed');

  // A genuinely empty undo — a run that made nothing — is OK, not a failure. This is why a bare
  // `length === 0` check would have been the WRONG guard on these three sites.
  const empty = recorder({ inventory: [], customers: [], receipts: 111, deliveries: 31 });
  const re = await undoItemImport(empty.db as any, BIZ, 'a-run-that-made-nothing', HELD);
  ok(re.ok === true, '§I 🔴 an undo that legitimately matches NOTHING is OK — a row-count guard would have called it an error');
  ok(re.leftovers.length === 0, '§I and it reports no leftovers');
}

// ── §J the commit refuses a total retire shortfall ──────────────────────────
async function sectionJ() {
  // Planning to retire rows and retiring NONE is a refusal, not a race. A tenant being uploaded to
  // all weekend can lose a row between the plan and the write; it cannot lose all of them.
  const { db } = recorder({
    inventory: [
      { id: 'old1', business_id: BIZ, qty: 0, retired_at: null, import_run_id: null },
      { id: 'old2', business_id: BIZ, qty: 0, retired_at: null, import_run_id: null },
    ],
    refuseWrites: true,
  });
  // `refuseWrites` blocks updates but not inserts, so the create still lands and the retire is the
  // step that silently does nothing — the exact live shape.
  const rep = await commitItemImport(db as any, BIZ, [it('1', 'X', { description: 'Live Oak - 15 gallon' })], RUN, HELD);
  ok(rep.committed === false, '§J 🔴 a retire that planned 2 and landed 0 FAILS the run');
  ok(rep.stoppedAt === 'retire', '§J and names the phase');
  ok((rep.error ?? '').includes('refused'), '§J and calls it a refusal rather than an empty result');
}

// ── preview writes nothing ───────────────────────────────────────────────────
async function sectionPreview() {
  const { db, calls } = recorder({ inventory: [
    { id: 'a', business_id: BIZ, qty: 0, retired_at: null },
    { id: 'b', business_id: BIZ, qty: 4, retired_at: null },
  ] });
  const p = await previewItemImport(db as any, BIZ, [
    it('1', 'X', { description: 'Live Oak - 15 gallon' }),
    it('2', 'Cat', { type: 'Category' }),
  ]);
  ok(calls.every(c => c.verb === 'select'), '🔴 PREVIEW ISSUES ONLY READS — it plans everything and writes nothing');
  ok(p.wouldRetire === 2, 'preview counts the live rows it would retire');
  ok(p.wouldCreate === 1, 'preview counts one create — the Category folder is not a product');
  ok(p.countedRowsBeingRetired.length === 1 && p.countedRowsBeingRetired[0].qty === 4,
     '🔴 A ROW WITH A REAL COUNT ABOUT TO BE RETIRED IS LISTED, NOT SUMMARISED — a destroyed count must not be a number somebody has to go looking for');
}

// Sequential, not Promise.all: each section builds its own recorder, and a shared failure order
// is what makes a red run readable.
(async () => {
  for (const section of [sectionB, sectionC, sectionD, sectionE, sectionF, sectionG, sectionH, sectionI, sectionJ, sectionPreview]) {
    await section();
  }
  console.log(`\nitemImportWriter — ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})().catch((e) => { console.error('itemImportWriter: threw —', e); process.exit(1); });
