// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the IO half of the QuickBooks catalogue import. Reads what the tenant already has,
//   asks the pure adapter and planner what to do, and — only on an explicit commit — retires the
//   old catalogue and creates the new one, both stamped with ONE run id so the whole pass can be
//   undone. Also holds the UNDO, because an undo written anywhere else would drift from the write.
// DEPENDENCIES: ./qboItemAdapter (every decision about an item) · ./pushHold (the writes switch) ·
//   ../inventory/unitOfMeasure (unitColumnsFor — the ONE derive) · a supabase client passed in.
//   No client constructed here; no env read here.
// OUTPUTS: ITEM_IMPORT_SOURCE · ImportPlanReport · ImportRunReport · UndoReport ·
//   previewItemImport · commitItemImport · undoItemImport.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THIS FILE MUST NOT USE `importWrites.ts`, AND THAT IS THE MOST IMPORTANT LINE IN IT.
// ══════════════════════════════════════════════════════════════════════════════════════════
// R-93 (David, 2026-09-06). `importWrites.ts`'s own header states its contract: *"Every qty change
// rides the D-50 Layer-1 RPCs… A CREATE is `count_promote_create_inventory` at qty 0 (a born-empty
// opening_balance — never fabricate stock)"*. That RPC emits a ledger row of
// `kind = 'opening_balance'`, and that is where LAWNS's existing opening_balance ledger rows came
// from. Riding it here would land **647 IMMUTABLE LEDGER ROWS** — `business_inventory_ledger` is
// append-only and its trigger rejects even `postgres` — and **THE UNDO COULD NOT BE COMPLETE.**
// Lauren is promised she can wipe and reload as many times as she likes; each cycle would leave a
// permanent sediment of ledger rows nothing can remove.
//
// ⚠️ §6 r8 SAYS REUSE BEFORE FORKING, SO A BUILDER FOLLOWING THE STANDARDS WILL DO THE WRONG
// THING CORRECTLY. That is why this is a ruling and not a comment. The rule of three is about the
// same OPERATION appearing twice; a catalogue seed under a reversible test mode and a stock
// movement are not the same operation, and the ledger is exactly what distinguishes them.
//
// 🔴 A PLAIN `INSERT INTO business_inventory` WRITES NO LEDGER ROW, AND THAT IS VERIFIED, NOT
// ASSUMED: the only two triggers on the table are `business_inventory_updated_at` and
// `business_inventory_unit_projection` (`20260612:152`, `20260830:151`; the whole migration corpus
// grepped, and 20260906's V5 re-asserts it against the live catalog). Neither emits.
// **IN TEST MODE THIS IMPORT WRITES NO LEDGER ROWS. THE LEDGER BEGINS WHEN WRITES GO ON.**
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 WHAT THIS FILE WRITES, EXHAUSTIVELY: `business_inventory` — an UPDATE that sets the three
//   retirement columns, and an INSERT of new catalogue rows. THAT IS THE WHOLE LIST.
//   NO `business_inventory_ledger`. NO `orders`, `order_items`, `deliveries`, `receipts`,
//   `customers`, `uppot_*`. NO RPC of any kind. NO DELETE outside `undoItemImport`.
//   `itemImportWriter.test.ts` §E asserts this against a recording client rather than trusting
//   this paragraph — a comment claiming a boundary is a comment, and R-26 has instances of one
//   being false the day it was written.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 CREATE FIRST, RETIRE SECOND — AND THE RETIRE EXCLUDES THE RUN'S OWN ROWS.
// ══════════════════════════════════════════════════════════════════════════════════════════
// The order is chosen on what a HALF-LANDED run leaves behind:
//   · create-then-retire fails to a SUPERSET — the old catalogue plus the new one. Ugly, nothing
//     lost, and every new row is identifiable by `import_run_id`.
//   · retire-then-create fails to an EMPTY CATALOGUE. Recoverable, but what Lauren SEES is her
//     product list gone, which is the one outcome this build exists to make impossible.
// So: create first.
//
// ⚠️ AND THAT ORDER SETS A TRAP THIS FILE HAS TO DISARM. "Retire everything live" run after the
// insert would retire the 647 rows just created, because they are live too. The retire is
// therefore scoped `import_run_id IS DISTINCT FROM <run>` — not `IS NULL`, which would spare a
// PREVIOUS run's rows and leave two catalogues stacked. Probe §D and mutant M6 both hold it.
//
// 🔴 SO NO TRANSACTION IS NEEDED, AND THAT IS A CONCLUSION RATHER THAN A CONVENIENCE. The run id
// makes every partial state nameable and reversible from the data alone: rows this run created
// carry it, rows this run retired carry it, and `undoItemImport` undoes both halves independently.
// This is NOT tech-debt #69's shape — #69 is about a sequence of D-50 ledger RPCs that cannot be
// rolled back because the ledger is append-only. Nothing here is append-only.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE UNDO REFUSES WHILE QUICKBOOKS WRITES ARE ON. A REFUSAL, NOT A WARNING.
// ══════════════════════════════════════════════════════════════════════════════════════════
// The whole promise — import, look, wipe, reload — rests on nothing having left the building.
// While the push is HELD, everything the import made is disposable, INCLUDING an order Lauren
// rings up against an imported item: nothing is hers yet, no invoice went out, no stock moved.
// The moment writes go on, an invoice can have been sent against an imported item, and deleting
// that item's row would orphan a document in a real company's books. So the switch that turns
// writes on is the switch that CLOSES the undo — one control, not two, and it is the existing
// `QBO_PUSH_HOLD` (`./pushHold`) rather than a second mechanism that could disagree with it.
//
// ⚠️ IT REFUSES BY NAME, THE SHAPE `seed-uppot-harness.mjs` USES — the tenant is checked and the
// run stops before it writes, rather than warning and proceeding.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 WHAT THE UNDO CANNOT TOUCH, BY CONSTRUCTION RATHER THAN BY A FILTER.
// ══════════════════════════════════════════════════════════════════════════════════════════
// LAWNS's 111 receipts and 31 deliveries carry NO `import_run_id` — the column does not exist on
// `receipts` at all, and on `customers` it is NULL on every row — so they are outside a
// `WHERE import_run_id = <run>` delete BY DEFINITION, not because somebody remembered to exclude
// them. **13 of those deliveries are scheduled after today** (measured live 2026-09-06; the
// figure in the build prompt was 3, from an earlier read). The undo asserts their counts before
// and after anyway: "cannot happen by construction" is how the last several silent failures were
// described before they happened.
//
// INSTRUMENTATION (STD-003): `[TRACE:QBITEMS]` on every phase, ON by default.
// ─────────────────────────────────────────────────────────────────────────────
import { adaptQboItems, type AdaptedItem, type AdaptedItemList } from './qboItemAdapter';
import { isPushHeld } from './pushHold';
import { unitColumnsFor } from '../inventory/unitOfMeasure';
import { STOCK_LINE_IDENTITY_COLUMNS } from '../inventory/stockLineResolver';
import type { QboItemRow } from './itemList';

/** Stamped on every row this import creates, so a human reading the grid can see where it came
 *  from without knowing what a run id is. */
export const ITEM_IMPORT_SOURCE = 'quickbooks-items';

/** The sentence written into `retired_reason`. One place, so the report and the row agree. */
export const RETIRE_REASON = 'Replaced by your QuickBooks product list. Hidden, not deleted.';

/** Minimal structural type for the supabase client — the same shape the delivery and order
 *  ingests take, so a recording double can stand in for all three. */
export interface DbLike {
  from(table: string): any;
}

export interface ImportPlanReport {
  ok: boolean;
  /** What the adapter made of the QuickBooks list. */
  adapted: AdaptedItemList;
  /** Live rows that would be retired. Measured, not assumed. */
  wouldRetire: number;
  /** Rows that would be created — one per sellable item, always. */
  wouldCreate: number;
  /** Live rows carrying a real count, listed rather than summarised. R-A retires these too, and
   *  a count being destroyed should never be a number the owner has to go looking for. */
  countedRowsBeingRetired: { id: string; name: string; size: string | null; qty: number }[];
  error: string | null;
}

export interface ImportRunReport extends ImportPlanReport {
  /** The run id. Every row created and every row retired carries it. */
  runId: string;
  created: number;
  retired: number;
  /** Which phase stopped, when one did. Null on a clean run. */
  stoppedAt: 'create' | 'retire' | null;
  /** True only when the push is held — i.e. only when this run is undoable. */
  undoable: boolean;
  committed: boolean;
}

export interface UndoReport {
  ok: boolean;
  runId: string;
  inventoryDeleted: number;
  customersDeleted: number;
  unretired: number;
  /** Asserted before AND after — see the header. */
  receiptsBefore: number; receiptsAfter: number;
  deliveriesBefore: number; deliveriesAfter: number;
  /** 🔴 WHAT IS STILL THERE THAT SHOULD NOT BE — the evidence the writes landed, read back rather
   *  than inferred from "no error". Empty on a clean undo. */
  leftovers: string[];
  refused: boolean;
  error: string | null;
}

/** The columns a created catalogue row carries, DECLARED so the insert and the probes read one
 *  list. #179's class: a select naming fewer columns than its migration creates is invisible to
 *  tsc, eslint and knip. */
export const ITEM_IMPORT_INSERT_COLUMNS = [
  'business_id', 'name', 'size', 'description', 'sku', 'qty', 'status',
  'sell_price', 'price_basis', 'qb_item_id', 'import_run_id', 'source',
  'unit_kind', 'unit_value', 'unit_value_max', 'unit_name', 'unit_parsed_from',
] as const;

/** One adapted item → one row to insert. Pure, so the probes can assert the row without a client.
 *
 *  🔴 `qty: 0` IS NOT A PLACEHOLDER, IT IS THE TRUTH. This import brings a PRODUCT LIST, not
 *  stock. Nothing here has been counted, and writing any other number would fabricate inventory
 *  from an accounting document. The count arrives when somebody walks the lot.
 *
 *  🔴 THE UNIT COLUMNS ARE DERIVED THROUGH `unitColumnsFor` AND NO OTHER PATH (R-27). `size`
 *  stays exactly the string QuickBooks wrote; the projection is computed from it here so the row
 *  lands already consistent, and the DB trigger re-derives on every later write. An item whose
 *  size we could not read gets `unit_parsed_from` set with the rest NULL — "the parser ran and
 *  declined", which stays distinguishable from "nothing was ever parsed here" (all-NULL). */
export function rowForItem(businessId: string, runId: string, item: AdaptedItem): Record<string, unknown> {
  return {
    business_id: businessId,
    name: item.name,
    size: item.size,
    description: item.sourceDescription,
    sku: item.sku,
    qty: 0,
    status: 'available',
    // The item's published price, or NULL. NEVER 0 — a price card of free items would make every
    // sale read "at or above list" (itemList.ts's own rule, and R-79's class).
    sell_price: item.unitPrice,
    price_basis: item.unitPrice === null ? null : 'quickbooks_item_price',
    qb_item_id: item.qboId,
    import_run_id: runId,
    source: ITEM_IMPORT_SOURCE,
    ...unitColumnsFor(item.size),
  };
}

async function countLive(db: DbLike, businessId: string): Promise<number> {
  const { count, error } = await db.from('business_inventory')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId).is('retired_at', null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * 🔴 THE TABLE NAMES ARE LITERALS, NOT A PARAMETER, AND THAT IS DELIBERATE. The first draft took
 * `table: string` and read both through one helper — three lines shorter, and it made
 * `verify-write-paths.mjs` report `table ← itemImportWriter.ts` under *"ADVISORY — DYNAMIC TABLE
 * NAMES (NOT RESOLVED)"*. A cap that cannot see which table a file touches cannot tell you the
 * file stayed off `receipts`, which is the single most important claim this file makes about
 * itself. Two literal functions keep the scanner able to answer.
 */
async function countReceipts(db: DbLike, businessId: string): Promise<number> {
  const { count, error } = await db.from('receipts')
    .select('id', { count: 'exact', head: true }).eq('business_id', businessId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countDeliveries(db: DbLike, businessId: string): Promise<number> {
  const { count, error } = await db.from('deliveries')
    .select('id', { count: 'exact', head: true }).eq('business_id', businessId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * PREVIEW — reads Intuit's list and our own table, decides everything, WRITES NOTHING.
 */
export async function previewItemImport(
  db: DbLike, businessId: string, qboItems: QboItemRow[],
): Promise<ImportPlanReport> {
  const adapted = adaptQboItems(qboItems);
  try {
    const wouldRetire = await countLive(db, businessId);
    // 🔴 THE COLUMN LIST IS THE EXISTING SHARED ONE, NOT A NEW HAND-WRITTEN STRING. `id, name,
    // sku, qty, size, variant_group` is already the canonical identity projection for a stock line
    // and it is a strict superset of what this needs. A second list would be one more thing to
    // keep in step with the table (STD-011 / §6 r8), which is what `verify-field-lists` is for —
    // it flagged the hand-written version and it was right to.
    const { data, error } = await db.from('business_inventory')
      .select(STOCK_LINE_IDENTITY_COLUMNS)
      .eq('business_id', businessId).is('retired_at', null).gt('qty', 0);
    if (error) throw new Error(error.message);
    const counted = (data ?? []) as { id: string; name: string; size: string | null; qty: number }[];
    console.log('[TRACE:QBITEMS] preview', {
      businessId, readIn: adapted.counts.readIn, sellable: adapted.counts.sellable,
      categories: adapted.counts.categories, wouldRetire, counted: counted.length,
      collisions: adapted.collisions.length,
    });
    return {
      ok: true, adapted, wouldRetire, wouldCreate: adapted.items.length,
      countedRowsBeingRetired: counted, error: null,
    };
  } catch (e: any) {
    console.log('[TRACE:QBITEMS] preview failed', { businessId, message: e?.message });
    return {
      ok: false, adapted, wouldRetire: 0, wouldCreate: adapted.items.length,
      countedRowsBeingRetired: [], error: e?.message ?? 'unknown error',
    };
  }
}

/**
 * COMMIT — the same plan, then the write. Create first, then retire everything that is not this
 * run's own work. See the header for why that order and why no transaction.
 */
export async function commitItemImport(
  db: DbLike, businessId: string, qboItems: QboItemRow[], runId: string, pushHoldRaw: string | undefined,
): Promise<ImportRunReport> {
  const plan = await previewItemImport(db, businessId, qboItems);
  const undoable = isPushHeld(pushHoldRaw, businessId);
  const base: ImportRunReport = {
    ...plan, runId, created: 0, retired: 0, stoppedAt: null, undoable, committed: false,
  };
  if (!plan.ok) return base;

  const rows = plan.adapted.items.map(i => rowForItem(businessId, runId, i));

  // ── CREATE ────────────────────────────────────────────────────────────────────────────────
  // `.select('id')` and a COUNT CHECK, not "no error" (R-12 / A8): under RLS a refused insert
  // returns without an error and zero rows, which is indistinguishable from success to a caller
  // that only looks at `error`.
  let created = 0;
  try {
    const { data, error } = await db.from('business_inventory').insert(rows).select('id');
    if (error) throw new Error(error.message);
    created = (data ?? []).length;
    if (created !== rows.length) {
      throw new Error(`wrote ${created} of ${rows.length} catalogue rows — refusing to report success`);
    }
  } catch (e: any) {
    console.log('[TRACE:QBITEMS] create FAILED', { businessId, runId, attempted: rows.length, message: e?.message });
    // The half-landed state is nameable rather than mysterious: `created` says how many rows
    // carry this run id, and `undoItemImport` removes exactly those.
    return { ...base, created, stoppedAt: 'create', error: e?.message ?? 'unknown error' };
  }

  // ── RETIRE ────────────────────────────────────────────────────────────────────────────────
  // 🔴 `neq('import_run_id', runId)` WOULD BE WRONG. PostgREST's `neq` does not match NULL — SQL
  // three-valued logic — so it would retire NOTHING at LAWNS, where all 447 rows have a NULL
  // `import_run_id`. `not.is` + `or` is the honest spelling of "everything that is not this run".
  let retired = 0;
  try {
    const { data, error } = await db.from('business_inventory')
      .update({ retired_at: new Date().toISOString(), retired_reason: RETIRE_REASON, retired_by_run_id: runId })
      .eq('business_id', businessId)
      .is('retired_at', null)
      .or(`import_run_id.is.null,import_run_id.neq.${runId}`)
      .select('id');
    if (error) throw new Error(error.message);
    const retiredRows = data ?? [];
    retired = retiredRows.length;
    // 🔴 A ZERO-ROW UPDATE IS WHAT AN RLS REFUSAL LOOKS LIKE, AND PostgREST RETURNS NO ERROR FOR
    // IT (A8 / R-12). Planning to retire 447 rows and retiring none is not a race — a tenant being
    // uploaded to all weekend can lose a row or gain one between the plan and the write, but it
    // cannot lose all of them. So a TOTAL shortfall FAILS; a partial one is REPORTED.
    if (plan.wouldRetire > 0 && retiredRows.length === 0) {
      throw new Error(`planned to retire ${plan.wouldRetire} rows and retired none — the write was refused, not merely empty`);
    }
    if (retired !== plan.wouldRetire) {
      // Reported rather than failed: a silent difference between planned and actual is how a wrong
      // number becomes a trusted one, but a moved row is a legitimate thing for the tenant to do.
      console.log('[TRACE:QBITEMS] retire count differs from plan', { businessId, runId, planned: plan.wouldRetire, actual: retired });
    }
  } catch (e: any) {
    console.log('[TRACE:QBITEMS] retire FAILED', { businessId, runId, created, message: e?.message });
    return { ...base, created, retired: 0, stoppedAt: 'retire', error: e?.message ?? 'unknown error' };
  }

  console.log('[TRACE:QBITEMS] commit ok', { businessId, runId, created, retired, undoable });
  return { ...base, created, retired, stoppedAt: null, committed: true };  // wouldRetire rides on `base` for the comparison
}

/**
 * UNDO — put the tenant back. Refuses while QuickBooks writes are ON.
 *
 * 🔴 THE REFUSAL IS FIRST AND IT IS ABSOLUTE. Nothing below runs when the push is live.
 */
export async function undoItemImport(
  db: DbLike, businessId: string, runId: string, pushHoldRaw: string | undefined,
): Promise<UndoReport> {
  const empty: UndoReport = {
    ok: false, runId, inventoryDeleted: 0, customersDeleted: 0, unretired: 0,
    receiptsBefore: 0, receiptsAfter: 0, deliveriesBefore: 0, deliveriesAfter: 0,
    leftovers: [], refused: false, error: null,
  };

  if (!isPushHeld(pushHoldRaw, businessId)) {
    console.log('[TRACE:QBITEMS] undo REFUSED — QuickBooks writes are on for this business', { businessId, runId });
    return { ...empty, refused: true, error:
      'QuickBooks writes are switched on for this business, so an imported product may already be on an invoice you have sent. Undo is closed. Nothing was changed.' };
  }

  try {
    // Asserted BEFORE — see the header. These two tables carry no run id and cannot be reached by
    // any statement below; the counts prove it rather than the sentence claiming it.
    const receiptsBefore   = await countReceipts(db, businessId);
    const deliveriesBefore = await countDeliveries(db, businessId);

    // FK ORDER. Every FK pointing at `business_inventory` in the migration corpus is
    // `ON DELETE SET NULL` (cultivar_plants.inventory_id, order_items.business_inventory_id,
    // inventory_counts.inventory_id, business_inventory_ledger.inventory_id) — so those rows
    // survive with a null anchor and nothing cascades. The ONE exception is
    // `20260905_production_planning.sql`'s `ON DELETE RESTRICT`, which is NOT APPLIED today; when
    // it is, a plan line holding an imported lot will REFUSE the delete, and that refusal is the
    // correct answer, surfaced rather than swallowed.
    // Customers are deleted FIRST because a future customer import will hang orders off them; the
    // order is fixed now so it does not have to be discovered later.
    const cust = await db.from('customers').delete().eq('business_id', businessId).eq('import_run_id', runId).select('id');
    if (cust.error) throw new Error(`customers: ${cust.error.message}`);
    const customersDeleted = (cust.data ?? []).length;

    const inv = await db.from('business_inventory').delete().eq('business_id', businessId).eq('import_run_id', runId).select('id');
    if (inv.error) throw new Error(`business_inventory: ${inv.error.message}`);
    const inventoryDeleted = (inv.data ?? []).length;

    // 🔴 SCOPED ON `retired_by_run_id`, NEVER ON `retired_at`. A timestamp window would un-retire
    // rows an EARLIER run hid, silently restoring a catalogue the owner had already replaced.
    const un = await db.from('business_inventory')
      .update({ retired_at: null, retired_reason: null, retired_by_run_id: null })
      .eq('business_id', businessId).eq('retired_by_run_id', runId).select('id');
    if (un.error) throw new Error(`un-retire: ${un.error.message}`);
    const unretired = (un.data ?? []).length;

    // 🔴 THE EVIDENCE THE WRITES LANDED, AND IT IS A RE-READ RATHER THAN A ROW COUNT (A8 / R-12).
    // A delete that matches zero rows returns NO ERROR, and under RLS that is EXACTLY what a
    // refusal looks like — so `inventoryDeleted === 0` cannot tell "there was nothing to remove"
    // apart from "you were not allowed to remove it". Counting what REMAINS can: after a
    // successful undo, nothing carries this run id in either column, whatever the deltas were.
    // RETIRED-FILTER-EXEMPT: this counts what this RUN made, not what a person can see. A row it
    // created and a row it created-then-hid are both leftovers, so the count must span both.
    const { count: invLeft, error: invLeftErr } = await db.from('business_inventory')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId).eq('import_run_id', runId);
    if (invLeftErr) throw new Error(`could not verify the delete: ${invLeftErr.message}`);
    // 🔴 RETIRED-FILTER-EXEMPT: THE EXEMPTION IS LOAD-BEARING HERE RATHER THAN MERELY CORRECT —
    // this read counts rows that are STILL HIDDEN. Adding `.is('retired_at', null)` would
    // make it return 0 unconditionally and the un-retire check would pass forever without ever
    // examining anything — a check that cannot disagree (§6 r19 / R-33), built by obeying a cap.
    const { count: retiredLeft, error: retiredLeftErr } = await db.from('business_inventory')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId).eq('retired_by_run_id', runId);
    if (retiredLeftErr) throw new Error(`could not verify the un-retire: ${retiredLeftErr.message}`);
    const { count: custLeft, error: custLeftErr } = await db.from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId).eq('import_run_id', runId);
    if (custLeftErr) throw new Error(`could not verify the customer delete: ${custLeftErr.message}`);

    const leftovers: string[] = [];
    if ((invLeft ?? 0) > 0)     leftovers.push(`${invLeft} product row(s) this run created are still here`);
    if ((retiredLeft ?? 0) > 0) leftovers.push(`${retiredLeft} product row(s) this run hid are still hidden`);
    if ((custLeft ?? 0) > 0)    leftovers.push(`${custLeft} customer row(s) this run created are still here`);

    const receiptsAfter   = await countReceipts(db, businessId);
    const deliveriesAfter = await countDeliveries(db, businessId);

    const untouched = receiptsBefore === receiptsAfter && deliveriesBefore === deliveriesAfter;
    console.log('[TRACE:QBITEMS] undo', { businessId, runId, inventoryDeleted, customersDeleted, unretired, untouched });

    const changed = !untouched
      ? `Undo finished, but the number of receipts or deliveries changed (receipts ${receiptsBefore}→${receiptsAfter}, deliveries ${deliveriesBefore}→${deliveriesAfter}). Nothing in the undo touches either. Check before running anything else.`
      : null;
    const incomplete = leftovers.length > 0
      ? `The undo did not finish: ${leftovers.join('; ')}. This is what a refused write looks like — the statements reported no error and changed nothing. Nothing else was run.`
      : null;

    return {
      ok: untouched && leftovers.length === 0,
      runId, inventoryDeleted, customersDeleted, unretired,
      receiptsBefore, receiptsAfter, deliveriesBefore, deliveriesAfter, refused: false,
      leftovers,
      // 🔴 BOTH FAILURES ARE NAMED, AND A CHANGED COUNT IS AN ERROR EVEN THOUGH NOTHING HERE COULD
      // HAVE CAUSED ONE. If the impossible happened, the owner is told, not reassured.
      error: [incomplete, changed].filter(Boolean).join(' ') || null,
    };
  } catch (e: any) {
    console.log('[TRACE:QBITEMS] undo FAILED', { businessId, runId, message: e?.message });
    return { ...empty, error: e?.message ?? 'unknown error' };
  }
}
