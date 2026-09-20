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
//   ✏️ **AND THE READ SIDE IS NOT THE SAME LIST, SO IT IS STATED SEPARATELY RATHER THAN LEFT TO BE
//   INFERRED FROM A PARAGRAPH ABOUT WRITES.** Since 2026-09-15 the undo's GATE 2 READS
//   `business_inventory_ledger` — through an `!inner` embed on `business_inventory`, so the table
//   name appears in a select string rather than in a `from()`. **It still reads it.** The sentence
//   above remains exactly true (nothing is WRITTEN there, and R-93's whole point survives), but a
//   reader scanning for `business_inventory_ledger` would otherwise find only a denial.
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
// While no invoice can be pushed, everything the import made is disposable, INCLUDING an order
// Lauren rings up against an imported item: nothing is hers yet, no invoice went out, no stock
// moved. The moment writes go on, an invoice can have been sent against an imported item, and
// deleting that item's row would orphan a document in a real company's books.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 CORRECTED 2026-09-06 — THERE ARE **TWO** SWITCHES AND THE FIRST DRAFT GATED ON THE WRONG
//    ONE. R-95 AS FILED SAID "one control, not two". THAT SENTENCE WAS FALSE WHEN IT WAS WRITTEN.
// ══════════════════════════════════════════════════════════════════════════════════════════
// Found by David asking which switch `undoable` reads — not by any check we own.
//
//   · `QBO_PUSH_HOLD` (env) is the OPERATOR's hold — David's, over a tenant whose invoice line
//     mapping he has not yet watched land. Deploy-wide, invisible to the customer.
//   · `businesses.qbo_writes_enabled` (column, `20260902_business_qbo_writes_switch.sql:65`,
//     NOT NULL DEFAULT false) is the **OWNER's own decision about her own books**. It is what
//     `QboWriteSwitch.tsx` flips, what the TEST MODE banner reads, and what
//     `api/orders/submit.ts:856` gates the actual checkout push on.
//
// The first draft read ONLY the env var — so at LAWNS today (`qbo_writes_enabled = false`,
// `QBO_PUSH_HOLD` unset) it computed `undoable: false` and the undo REFUSED, **in exactly the
// state the undo exists to serve.** The gate was not merely incomplete; it was inverted in
// practice, and it would have made the operator set a deploy-wide env var to duplicate a switch
// the product already gives the owner.
//
// 🔴 AND THE SHARED PREDICATE ALREADY EXISTED: `pushPermitted({ writesEnabled, platformHeld })`
// in `../business-logic/testMode`, whose own header says *"TWO SWITCHES, AND-ED, BECAUSE THEY
// BELONG TO DIFFERENT PEOPLE… Either one saying no means no."* Not using it was a §6 r8 miss —
// the operation existed in exactly one place and this file wrote a second, narrower one.
//
// So: **the undo is open precisely when a push is NOT permitted** — `!pushPermitted(...)`. Either
// hold being active means nothing left the building, which is the only thing that matters here.
//
// ⚠️ NAMED AND NOT SOLVED: this reads CURRENT state, not history. A business that was live, sent
// invoices, and was then switched back to test mode re-opens the undo over rows that may sit
// behind real documents. That is a HISTORY question — it wants "has this business ever pushed",
// which nothing records today — and it is tech-debt #198, not a thing to guess at here.
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
import { pushPermitted } from '../business-logic/testMode';
import { unitColumnsFor } from '../inventory/unitOfMeasure';
import { LADDER_SELECT, rungFromRow, ladderCoverage, type LadderCoverage, type LadderRow } from '../inventory/containerLadder';
import { STOCK_LINE_IDENTITY_COLUMNS } from '../inventory/stockLineResolver';
import { variantGroupSlug } from '../inventory/variantGroup';
import type { QboItemRow } from './itemList';

/**
 * 🔴 REMOVED 2026-09-07 — `source` IS NOT A COLUMN ON `business_inventory` AND MUST NOT BE WRITTEN.
 *
 * The first draft set `source: 'quickbooks-items'` on every created row, PostgREST rejected the
 * insert with *"Could not find the 'source' column of 'business_inventory' in the schema cache"*,
 * and the whole run stopped on its first statement. Found by David on CARD 5 STEP 3.
 *
 * ⚠️ WHERE THE MISTAKE CAME FROM, BECAUSE IT WILL BE MADE AGAIN: copied from
 * `deliveryIngestWriter.ts:351`, which sets `deliveries.source = DELIVERY_INGEST_SOURCE`. That
 * table HAS the column (`20260620_deliveries.sql:35`) and NEEDS it — four different doors create a
 * delivery and none of them carries a run id, so `source` is the only discriminator there.
 *
 * 🔴 AND IT WOULD BE WRONG HERE EVEN IF THE COLUMN EXISTED. `business_inventory` already stores
 * the same fact twice: `qb_item_id IS NOT NULL` says the row came from QuickBooks, and
 * `import_run_id` says which run made it. `source: 'quickbooks-items'` is DERIVABLE from the first
 * and adds nothing the second does not already carry — a third copy of one fact, and the copy is
 * what drifts (STD-011). **No migration. The right fix was deleting the field.**
 *
 * The constant is kept, unused by the writer, ONLY so this note has somewhere to live and so a
 * grep for `ITEM_IMPORT_SOURCE` lands here rather than on a stale call site.
 * DO NOT re-introduce it into `ITEM_IMPORT_INSERT_COLUMNS`. `itemImportWriter.test.ts` §A asserts
 * the declared list against the columns `business_inventory`'s own migrations create.
 */
export const ITEM_IMPORT_SOURCE = 'quickbooks-items';

/** The sentence written into `retired_reason`. One place, so the report and the row agree. */
export const RETIRE_REASON = 'Replaced by your QuickBooks product list. Hidden, not deleted.';

/** Minimal structural type for the supabase client — the same shape the delivery and order
 *  ingests take, so a recording double can stand in for all three. */
export interface DbLike {
  from(table: string): any;
  /** Present on the real client. The UNDO needs it (`undo_import_run`, one transaction); the
   *  IMPORT never calls it (R-93 — §B asserts that against a recording double). */
  rpc?(fn: string, args: Record<string, unknown>): any;
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
  /**
   * 🔴 HOW THE INCOMING SIZES LAND ON THE NURSERY'S LADDER (ledger #343). Read-only: the import still
   * writes every size EXACTLY as QuickBooks states it (D-23) — this is the ladder saying, before the
   * commit, which products are sizes the nursery grows and which are not, NAMED. `ladder` says which
   * state the ladder read came back in, so "no sizes off the ladder" is never confused with "we
   * could not read the ladder".
   */
  sizes: { ladder: 'loaded' | 'none' | 'failed'; coverage: LadderCoverage | null };
  error: string | null;
}

export interface ImportRunReport extends ImportPlanReport {
  /** The run id. Every row created and every row retired carries it. */
  runId: string;
  created: number;
  retired: number;
  /**
   * 🔴 `ok` ON A RUN REPORT MEANS THE RUN SUCCEEDED — NOT THAT THE PLAN DID.
   *
   * It is REDECLARED here rather than inherited from `ImportPlanReport`, because inheriting it was
   * a live defect: a run that failed on its first insert returned `ok: true` beside
   * `created: 0`, `stoppedAt: 'create'` and a populated `error`, since `ok` had been spread from
   * the *preview*, which genuinely had succeeded. **A caller reading `ok` alone saw success on a
   * run that wrote nothing** — the exact A8/R-12 defect this build spent a week guarding other
   * people's writes against, in the code doing the guarding. Found by David on CARD 5 STEP 3.
   *
   * A stopped run and a completed run must be distinguishable by `ok` ALONE.
   */
  ok: boolean;
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
  /** 🔴 HOW MANY OF THIS RUN'S ROWS NOW CARRY STOCK HISTORY — the pre-flight's answer, and the
   *  reason a refusal is a refusal rather than a failure. `0` on every undo that proceeds.
   *  `-1` means the pre-flight could not be READ, which also refuses: see `ledgerHeldRows`. */
  ledgerHeld: number;
  /** 🔴 LEDGER #342 — the PRACTICE (test-mode checkout) orders this run owned, removed with it,
   *  and the delivery stops checkout had scheduled for them. Zero on a refusal. */
  practiceOrdersDeleted: number;
  practiceDeliveriesDeleted: number;
  /** 🔴 LIVE RECORDS that point at this run's rows — the reason a refusal is a refusal. Every key is
   *  a count; `other` is keyed `table.column`, read from the catalog at run time. Null when the
   *  database pre-flight did not run (an earlier gate refused first). */
  liveReferences: LiveReferences | null;
  /** The post-write RE-READ of customers still carrying this run — what the panel shows as proof. */
  customersRemaining: number | null;
  error: string | null;
}

/** What `undo_import_run`'s pre-flight counts, when it refuses. */
export interface LiveReferences {
  heldLots: number;
  liveOrders: number;
  liveOrderLines: number;
  liveDeliveries: number;
  other: Record<string, number>;
}

/** The columns a created catalogue row carries, DECLARED so the insert and the probes read one
 *  list. #179's class: a select naming fewer columns than its migration creates is invisible to
 *  tsc, eslint and knip. */
export const ITEM_IMPORT_INSERT_COLUMNS = [
  'business_id', 'name', 'size', 'description', 'sku', 'qty', 'status', 'variant_group',
  'sell_price', 'price_basis', 'qb_item_id', 'import_run_id',
  'unit_kind', 'unit_value', 'unit_value_max', 'unit_name', 'unit_parsed_from',
  // 🔴 WHAT QUICKBOOKS CALLS THE ITEM (ledger #357, `20260920b`). Read since the first import and
  // thrown away until now. `qb_item_name` is Intuit's CODE (`DLO30`) and is NOT a sku — where a
  // row has both they differ — so the display identifier `sku ?? qb_item_name` is computed on
  // read by `itemIdentifier()` and is never stored merged.
  'qb_item_name', 'qb_item_fqn', 'qb_item_type', 'qb_income_account',
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
    qb_item_name: item.qboName,
    qb_item_fqn: item.fullyQualifiedName,
    qb_item_type: item.qboType,
    qb_income_account: item.incomeAccount,
    // 🔴 `variant_group` ADDED 2026-09-07 (tech-debt #205) — THE IMPORT WAS LEAVING EVERY FAMILY
    // UNGROUPED AND THE SIZE PICKER COULD NOT FIRE ON ANY OF THEM.
    //
    // Measured on LAWNS's 647: `variant_group` was NULL on 647 of 647, while **124 variety names
    // carried more than one size — 416 rows, 64% of the catalogue** (Natchez Crape Myrtle 9 sizes,
    // Lacey Oak 8, Live Oak 8). `detectSizeCollision` returns false the instant the group is null
    // (`stockLineResolver.ts` — *"group must be set…"*), so scanning "Live Oak" in the lot returned
    // eight token-equal rows and no picker. That is exactly the state `countPromote.ts`'s D-49
    // invariant forbids: *"ANY path that mints a size-sibling must leave the family in a state
    // where the size-picker fires BY CONSTRUCTION."* This import mints size-siblings; it now
    // leaves them grouped.
    //
    // ⚠️ AND IT DOES **NOT** MERGE A COLLIDING PAIR, WHICH WAS THE WORRY. Two Lacey Oak 45 Gallon
    // rows land in one family with a duplicate normalised size, and `detectSizeCollision`
    // **correctly declines** to offer a picker for that family — its own comment says so: *"a
    // family carrying both spellings of one physical size is a DUP (not a clean picker)."* The
    // rows stay two rows, with two ids and two prices, and the collision flag marks them.
    // MEASURED over the 685: grouping by name gives **110 families a working picker and 13 a
    // correct refusal** — and fixing a flagged collision is what turns its family's picker on.
    variant_group: variantGroupSlug(item.name),
    // 🔴 NO `source` — see ITEM_IMPORT_SOURCE's note. The column does not exist on this table, and
    // `qb_item_id` + `import_run_id` already answer both questions it would have answered.
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
/**
 * Is the undo open for this business RIGHT NOW?
 *
 * 🔴 BOTH SWITCHES, THROUGH THE ONE SHARED PREDICATE. `pushPermitted` is AND-ed over the
 * operator's env hold and the owner's own `qbo_writes_enabled`; the undo is open exactly when a
 * push is NOT permitted, because either hold being active means nothing left the building.
 *
 * ⚠️ A FAILED READ MEANS THE UNDO IS CLOSED, AND THAT IS THE SAFE DIRECTION. `isTestMode` already
 * treats `undefined` as test mode — the right default for *may I push* — but this is the mirror
 * question, and the safe default flips with it: if we could not read whether writes are on, we
 * must not delete rows that might sit behind a real invoice. So a read failure is reported and
 * the undo refuses, rather than being read as "test mode, go ahead".
 */
async function undoIsOpen(
  db: DbLike, businessId: string, pushHoldRaw: string | undefined,
): Promise<{ open: boolean; writesEnabled: boolean | null; readFailed: boolean }> {
  const platformHeld = isPushHeld(pushHoldRaw, businessId);
  const { data, error } = await db.from('businesses')
    .select('qbo_writes_enabled').eq('id', businessId).maybeSingle();
  if (error || !data) {
    console.log('[TRACE:QBITEMS] could not read qbo_writes_enabled — undo treated as CLOSED', {
      businessId, message: (error as { message?: string } | null)?.message ?? 'no row',
    });
    return { open: false, writesEnabled: null, readFailed: true };
  }
  const writesEnabled = (data as { qbo_writes_enabled?: boolean }).qbo_writes_enabled ?? null;
  return { open: !pushPermitted({ writesEnabled, platformHeld }), writesEnabled, readFailed: false };
}

/** How many held lots the refusal NAMES. The rest are counted, never elided silently — the
 *  sentence says "and N more" so the number on screen is always the whole number. */
const LEDGER_NAMES_SHOWN = 5;

/**
 * 🔴 THE PRE-FLIGHT FOR THE UNDO: WHICH OF THIS RUN'S LOTS NOW HAVE STOCK HISTORY.
 *
 * `business_inventory_ledger.inventory_id` is declared `ON DELETE SET NULL`, and **SET NULL IS AN
 * UPDATE**. `20260720_inventory_movement_ledger.sql` §2 installs
 * `BEFORE UPDATE OR DELETE … FOR EACH ROW … RAISE EXCEPTION` **with no exemption**, and a
 * referential cascade fires row triggers like any other write. So the FK clause is INERT and the
 * migration's own header says so, having watched it fail live:
 *
 *   > *"DELETE on business_inventory → SET NULL here → REFUSED (observed live: "business_
 *   > inventory_ledger is append-only: UPDATE is not permitted"). A lot with history is
 *   > UNDELETABLE."*
 *
 * ⚠️ AND `itemImportWriter.ts` CARRIED THE OPPOSITE CLAIM IN A COMMENT FOR 48 DAYS — that all four
 * FKs were `ON DELETE SET NULL` *"so those rows survive with a null anchor and nothing cascades."*
 * True of three of the four, false of the fourth, and false in the file a builder reads before
 * deciding the undo is safe. That comment is now gone and this function is what replaced it.
 *
 * 🔴 THE SHAPE IS `business_inventory` → `!inner` CHILD, NOT A CHUNKED `.in(...)` OF LOT IDS, AND
 * THE REASON IS THE COUNT RATHER THAN THE SYNTAX. Filtering the LEDGER by an embedded parent
 * returns one row per ledger ENTRY, so a count of it answers *how many movements* — a lot sold
 * three times would be counted three times and the sentence would overstate the damage. Reading
 * the PARENT with an inner child returns each lot **once**, so `count` is the number of LOTS, which
 * is the number the refusal is about. It also needs no id list, so there is no URL-length ceiling
 * and no chunk loop (`customerImportWriter.ts:390` pays that cost because it must read two
 * unrelated tables by id; here one join answers it).
 *
 * 🔴 A FAILED READ RETURNS `-1` AND THE CALLER REFUSES ON IT. Deleting rows we could not check is
 * the unrecoverable direction, and this mirrors `undoIsOpen`'s own "we could not check" branch
 * exactly rather than inventing a second policy for the same situation.
 */
async function ledgerHeldRows(
  db: DbLike, businessId: string, runId: string,
): Promise<{ held: number; names: string[] }> {
  // 🔴 RETIRED-FILTER-EXEMPT: THE EXEMPTION IS LOAD-BEARING, NOT A CONVENIENCE. This counts what
  // the RUN MADE, not what a person can see. A row this run created and then RETIRED still has
  // ledger history and is still undeletable — and the undo deletes by `import_run_id` without
  // regard to `retired_at`, so a gate that looked only at live rows would wave through exactly the
  // rows that are going to refuse. Adding `.is('retired_at', null)` would make this gate weaker
  // than the statement it guards, which is the shape of a check that cannot disagree (§6 r19).
  const { data, error, count } = await db.from('business_inventory')
    .select('id, name, size, business_inventory_ledger!inner(id)', { count: 'exact' })
    .eq('business_id', businessId)
    .eq('import_run_id', runId)
    .limit(LEDGER_NAMES_SHOWN);
  if (error) {
    console.log('[TRACE:QBITEMS] undo pre-flight — could not read stock history', {
      businessId, runId, message: (error as { message?: string }).message,
    });
    return { held: -1, names: [] };
  }
  const rows = (data ?? []) as { id: string; name: string | null; size: string | null }[];
  const names = rows.map(r => {
    const n = (r.name ?? '').trim() || '(unnamed product)';
    const sz = (r.size ?? '').trim();
    return sz ? `${n} (${sz})` : n;
  });
  // 🔴 `count` IS THE AUTHORITY, NOT `rows.length`. The limit above is there to keep the NAMES
  // short; taking the total from the page would report "5" for a seeded catalogue of 647 and the
  // owner would act on a number an order of magnitude too small.
  return { held: count ?? rows.length, names };
}

/** The sentence a refusal is made of. Separate from the query so a probe can read it without a
 *  database, and so the wording is one string rather than three concatenations at the call site. */
export function ledgerRefusalSentence(held: number, names: string[]): string {
  if (held < 0) {
    return 'We could not check whether any of this run\'s products have stock history, so the undo '
      + 'refused rather than guessing. Nothing was deleted and nothing was changed. This is a failed '
      + 'read, NOT a statement that something is wrong with your catalogue — try again, and if it '
      + 'keeps happening say so.';
  }
  const shown = names.slice(0, LEDGER_NAMES_SHOWN);
  const more = held - shown.length;
  const list = shown.length === 0
    ? ''
    : ` — ${shown.join(', ')}${more > 0 ? `, and ${more} more` : ''}`;
  return `${held} product${held === 1 ? '' : 's'} from this import ${held === 1 ? 'has' : 'have'} `
    + `stock history${list}. A product that has been counted, sold or received cannot be removed: `
    + 'the stock ledger is permanent by design, so the database refuses to unlink it. '
    + '🔴 NOTHING WAS DELETED AND NOTHING WAS CHANGED — not the products, and not the customers '
    + 'this run created. The whole undo stopped here, deliberately, because removing part of an '
    + 'import is worse than removing none of it. '
    + 'That history is the record of real movements, which is why it is protected rather than a '
    + 'fault — but it does mean this import can no longer be wiped and reloaded. Clearing it is a '
    + 'separate decision, and it needs the movements dealt with first.';
}

/**
 * The sentence for a refusal the DATABASE pre-flight made (`undo_import_run`, 20260916c).
 *
 * 🔴 DAVID'S RULING ④ (2026-09-16): captured orders, receipts, deliveries and assets are LIVE and
 * are never removed. An undo that would delete a customer a captured invoice hangs off — or blank
 * the customer on a delivery Lauren is routing — is refused whole, and this says why in plain words.
 */
export function liveReferenceSentence(r: LiveReferences): string {
  const parts: string[] = [];
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  if (r.heldLots > 0) parts.push(n(r.heldLots, 'product with stock history', 'products with stock history'));
  if (r.liveOrders > 0) parts.push(n(r.liveOrders, 'order that is not practice (a captured invoice, or a real or older test sale)', 'orders that are not practice (captured invoices, or real or older test sales)'));
  if (r.liveOrderLines > 0) parts.push(n(r.liveOrderLines, 'line on those orders', 'lines on those orders'));
  if (r.liveDeliveries > 0) parts.push(n(r.liveDeliveries, 'delivery stop', 'delivery stops'));
  const other = Object.entries(r.other ?? {});
  for (const [where, k] of other) parts.push(`${k} record${k === 1 ? '' : 's'} in ${where.replace(/^public\./, '')}`);
  const list = parts.length ? parts.join(', ') : 'records we could not name';
  return `This import cannot be undone: ${list} still point at customers or products it created. `
    + 'Those are live records — undoing would delete what they point at or leave them pointing at nothing. '
    + '🔴 NOTHING WAS DELETED AND NOTHING WAS CHANGED. The whole undo stopped here, deliberately.';
}

/** Why the one-unit undo could not run at all — the migration is not applied yet. */
export const UNDO_FUNCTION_ABSENT =
  'The undo now runs as one single step, so it can never stop half-way — and that step is not '
  + 'installed in the database yet (migration 20260916c). Nothing was deleted and nothing was changed.';

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
    const sizes = await readLadderCoverage(db, businessId, adapted.items.map(i => i.size));
    console.log('[TRACE:QBITEMS] preview', {
      businessId, readIn: adapted.counts.readIn, sellable: adapted.counts.sellable,
      categories: adapted.counts.categories, wouldRetire, counted: counted.length,
      collisions: adapted.collisions.length,
      ladder: sizes.ladder, offLadderSizes: sizes.coverage?.offLadder.length ?? null,
    });
    return {
      ok: true, adapted, wouldRetire, wouldCreate: adapted.items.length,
      countedRowsBeingRetired: counted, sizes, error: null,
    };
  } catch (e: any) {
    console.log('[TRACE:QBITEMS] preview failed', { businessId, message: e?.message });
    return {
      ok: false, adapted, wouldRetire: 0, wouldCreate: adapted.items.length,
      countedRowsBeingRetired: [], sizes: { ladder: 'failed', coverage: null }, error: e?.message ?? 'unknown error',
    };
  }
}

/**
 * The ladder read for the preview. 🔴 A FAILED LADDER READ DOES NOT FAIL THE PREVIEW — the import
 * does not depend on the ladder, only this report does — and it is reported as `failed`, never as
 * an empty ladder (a failed read is not "no sizes").
 */
async function readLadderCoverage(db: DbLike, businessId: string, sizes: (string | null)[]): Promise<ImportPlanReport['sizes']> {
  try {
    const { data, error } = await db.from('container_ladder').select(LADDER_SELECT)
      .eq('business_id', businessId).order('sort_order', { ascending: true });
    if (error) throw new Error(error.message);
    const ladder = ((data ?? []) as LadderRow[]).map(rungFromRow);
    if (ladder.length === 0) return { ladder: 'none', coverage: null };
    return { ladder: 'loaded', coverage: ladderCoverage(sizes, ladder) };
  } catch (e: any) {
    console.log('[TRACE:QBITEMS] ladder read failed — preview continues without size coverage', { businessId, message: e?.message });
    return { ladder: 'failed', coverage: null };
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
  // BOTH switches, through the one shared predicate — see `undoIsOpen` and the header.
  const undoable = (await undoIsOpen(db, businessId, pushHoldRaw)).open;
  // 🔴 `ok: false` OVERRIDES THE PLAN'S `ok`, AND THE ORDER OF THESE KEYS IS LOAD-BEARING.
  // `...plan` carries the PREVIEW's `ok: true`; every early return below spreads `base`, so
  // without this override a run that wrote nothing reported success. It is set true exactly once —
  // on the committed path — and nowhere else.
  const base: ImportRunReport = {
    ...plan, ok: false, runId, created: 0, retired: 0, stoppedAt: null, undoable, committed: false,
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
  // The ONLY place `ok: true` is set on a run report. `wouldRetire` rides on `base` for comparison.
  return { ...base, ok: true, created, retired, stoppedAt: null, committed: true };
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
    leftovers: [], refused: false, ledgerHeld: 0,
    practiceOrdersDeleted: 0, practiceDeliveriesDeleted: 0, liveReferences: null, customersRemaining: null,
    error: null,
  };

  const gate = await undoIsOpen(db, businessId, pushHoldRaw);
  if (!gate.open) {
    console.log('[TRACE:QBITEMS] undo REFUSED', {
      businessId, runId, writesEnabled: gate.writesEnabled, readFailed: gate.readFailed,
    });
    return { ...empty, refused: true, error: gate.readFailed
      // 🔴 THE TWO REFUSALS SAY DIFFERENT THINGS BECAUSE THEY ARE DIFFERENT FACTS, and a person
      // who cannot tell "you are live" from "we could not check" will act on the wrong one.
      ? 'We could not read whether QuickBooks writes are on for this business, so the undo refused rather than guessing. Nothing was changed. This is a failed read, NOT a statement that you are live.'
      : 'QuickBooks writes are switched on for this business, so an imported product may already be on an invoice you have sent. Undo is closed. Nothing was changed.' };
  }

  // ── GATE 2 — STOCK HISTORY. READ BEFORE ANY WRITE, AND REFUSE THE WHOLE RUN. ────────────────
  // 🔴 THIS RUNS BEFORE ANY WRITE. When it was written (ledger #337) the customer delete was
  // issued first, as its own transaction, and the inventory delete after it was the one a lot with
  // ledger history refuses — so the undo DELETED THE CUSTOMERS, THEN THREW, and reported
  // `customersDeleted: 0` for rows already gone. ✏️ Since ledger #342 the writes are ONE database
  // transaction (`undo_import_run`, below), which re-checks this inside itself; this read stays
  // because it is the one that can NAME the held products, and it costs nothing when it passes.
  //
  // ⚠️ AND IT IS ALL-OR-NOTHING, WHICH IS A DELIBERATE DIVERGENCE FROM ITS SIBLING (§6 r8/r10).
  // `undoCustomerImport` does a PARTIAL undo — it removes what it can and names what it could not,
  // and that is right there, because each customer is independent and a blocked one is a fact
  // about that customer. Here the run is ONE thing: a catalogue with its customers. David's
  // ruling: *"the undo checks for ledger history BEFORE deleting anything and refuses the whole
  // thing with a sentence."* Removing part of an import is worse than removing none of it.
  //
  // 🔴 A REFUSAL ISSUES NO WRITES. §F already asserts that for GATE 1; §I asserts it for this one.
  const ledger = await ledgerHeldRows(db, businessId, runId);
  if (ledger.held !== 0) {
    console.log('[TRACE:QBITEMS] undo REFUSED — stock history', {
      businessId, runId, ledgerHeld: ledger.held, named: ledger.names.length,
      readFailed: ledger.held < 0,
    });
    return { ...empty, refused: true, ledgerHeld: ledger.held,
      error: ledgerRefusalSentence(ledger.held, ledger.names) };
  }

  try {
    // Asserted BEFORE — see the header. Receipts are never reachable by the undo; deliveries are,
    // but ONLY the stops checkout scheduled for this run's PRACTICE orders (ledger #342), and the
    // after-count is checked against exactly that number.
    const receiptsBefore   = await countReceipts(db, businessId);
    const deliveriesBefore = await countDeliveries(db, businessId);

    // ── ONE UNIT (ledger #342) ─────────────────────────────────────────────────────────────────
    // 🔴 THE WRITES ARE ONE plpgsql TRANSACTION, `undo_import_run` (20260916c). The version this
    // replaces issued four PostgREST statements, each its own transaction, customers FIRST — so a
    // refusal on the second left the tenant half-wiped (tech-debt #304). GATE 2 above fixed the
    // ORDER for the one refusal it can see; the function fixes the UNIT for every refusal,
    // including one nobody predicted: it re-checks everything live INSIDE the transaction
    // (stock history, captured and live orders, delivery stops, and every other FK into the two
    // tables, read from the catalog), and a failure anywhere rolls every write back.
    // It removes the run's PRACTICE orders first (David's ruling ④: removability is decided by
    // origin), then products, then customers, then un-retires. Never captured orders, receipts,
    // cost_objects, services or pricing.
    if (typeof db.rpc !== 'function') {
      return { ...empty, refused: true, error: UNDO_FUNCTION_ABSENT };
    }
    const { data: unit, error: unitErr } = await db.rpc('undo_import_run', {
      p_business_id: businessId, p_run_id: runId,
    });
    if (unitErr) {
      const code = (unitErr as { code?: string }).code;
      if (code === 'PGRST202' || code === '42883') {
        console.log('[TRACE:QBITEMS] undo REFUSED — undo_import_run absent (20260916c pending)', { businessId, runId, code });
        return { ...empty, refused: true, error: UNDO_FUNCTION_ABSENT };
      }
      // 🔴 THE ZEROES ARE TRUE NOW. The function is one transaction; an error rolled back every
      // write it had made. `{ ...empty }` used to hide landed deletes — here it reports what happened.
      console.log('[TRACE:QBITEMS] undo FAILED inside the one-unit function — rolled back whole', { businessId, runId, message: unitErr.message });
      return { ...empty, error: `The undo stopped and NOTHING was changed — it runs as one step, so a failure part-way undoes itself. The database said: ${unitErr.message}` };
    }
    const u = (unit ?? {}) as Record<string, any>;
    if (u.refused === true) {
      const refs: LiveReferences = {
        heldLots: Number(u.held_lots ?? 0), liveOrders: Number(u.live_orders ?? 0),
        liveOrderLines: Number(u.live_order_lines ?? 0), liveDeliveries: Number(u.live_deliveries ?? 0),
        other: (u.other_references ?? {}) as Record<string, number>,
      };
      console.log('[TRACE:QBITEMS] undo REFUSED — live references (database pre-flight)', { businessId, runId, ...refs });
      return { ...empty, refused: true, ledgerHeld: refs.heldLots, liveReferences: refs,
        error: liveReferenceSentence(refs) };
    }
    const inventoryDeleted          = Number(u.inventory_deleted ?? 0);
    const customersDeleted          = Number(u.customers_deleted ?? 0);
    const unretired                 = Number(u.unretired ?? 0);
    const practiceOrdersDeleted     = Number(u.practice_orders_deleted ?? 0);
    const practiceDeliveriesDeleted = Number(u.practice_deliveries_deleted ?? 0);
    const liveReferences: LiveReferences = { heldLots: 0, liveOrders: 0, liveOrderLines: 0, liveDeliveries: 0, other: {} };

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

    // 🔴 DELIVERIES MAY DROP BY EXACTLY THE PRACTICE STOPS REMOVED, AND BY NOTHING ELSE.
    const untouched = receiptsBefore === receiptsAfter
      && deliveriesAfter === deliveriesBefore - practiceDeliveriesDeleted;
    console.log('[TRACE:QBITEMS] undo', { businessId, runId, inventoryDeleted, customersDeleted, unretired, practiceOrdersDeleted, practiceDeliveriesDeleted, untouched });

    const changed = !untouched
      ? `Undo finished, but the number of receipts or deliveries changed by more than this run explains (receipts ${receiptsBefore}→${receiptsAfter}, deliveries ${deliveriesBefore}→${deliveriesAfter}, of which ${practiceDeliveriesDeleted} were practice-order stops this run owned). Nothing else in the undo touches either. Check before running anything else.`
      : null;
    const incomplete = leftovers.length > 0
      ? `The undo did not finish: ${leftovers.join('; ')}. This is what a refused write looks like — the statements reported no error and changed nothing. Nothing else was run.`
      : null;

    return {
      ok: untouched && leftovers.length === 0,
      runId, inventoryDeleted, customersDeleted, unretired,
      receiptsBefore, receiptsAfter, deliveriesBefore, deliveriesAfter, refused: false,
      // 🔴 ZERO, AND IT IS AN ASSERTION RATHER THAN A DEFAULT: reaching this line means GATE 2 read
      // the ledger and found nothing holding this run. `0` here is a measurement.
      ledgerHeld: 0,
      practiceOrdersDeleted, practiceDeliveriesDeleted, liveReferences,
      customersRemaining: custLeft ?? 0,
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
