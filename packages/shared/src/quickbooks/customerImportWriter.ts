// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the IO half of the QuickBooks customer import. Reads which QuickBooks ids the tenant
//   already holds, asks the pure adapter what every record should look like, and — only on an
//   explicit commit — CREATES the ones that are new and applies the exemption to the ones that
//   already exist. Holds the undo, because an undo written elsewhere drifts from the write.
// DEPENDENCIES: ./qboCustomerAdapter (every decision) · ./pushHold (the writes switch) · a
//   supabase client passed in. No client constructed here; no env read here; no clock.
// OUTPUTS: CustomerPlanReport · CustomerRunReport · CustomerUndoReport · CUSTOMER_INSERT_COLUMNS ·
//   rowForCustomer · previewCustomerImport · commitCustomerImport · undoCustomerImport.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 WHAT THIS FILE WRITES, EXHAUSTIVELY: `customers` — an INSERT of new rows, and an UPDATE of
//   THREE exemption columns on rows that already exist. THAT IS THE WHOLE LIST.
//   NO `people`. NO `orders`, `order_items`, `deliveries`, `receipts`, `business_inventory`,
//   `business_inventory_ledger`. NO RPC of any kind. NO DELETE outside `undoCustomerImport`.
//   §E asserts this against a recording client rather than trusting this paragraph — a comment
//   claiming a boundary is a comment, and R-26 has instances of one being false the day it was
//   written.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THIS FILE MUST NOT USE `findOrCreateCustomer`, AND A BUILDER FOLLOWING §6 r8 WILL REACH FOR
//    IT. THIS IS R-93's SHAPE, ON THE OTHER TABLE.
// ══════════════════════════════════════════════════════════════════════════════════════════
// `findOrCreateCustomer` is the ONE shared write path for resolving a customer, and reusing it
// here would be the obvious correct-looking move. It is wrong for three measured reasons:
//
//   ① IT CREATES A `people` ROW PER PERSON, and `people` has NO `import_run_id` — probed live
//     2026-09-06: 9 columns, no run provenance, 45 rows. So an import of 1,946 would mint ~1,900
//     person rows that NOTHING CAN UNDO, and each wipe-and-reload cycle would leave permanent
//     sediment. That is exactly the argument R-93 made about ledger rows, on a different table.
//   ② IT IS ONE ROUND TRIP PER RECORD — a dedup SELECT then a write, 1,946 times, sequentially,
//     inside one serverless invocation. This path upserts in batches.
//   ③ ITS SEMANTICS ARE A CAPTURE PATH'S, NOT AN IMPORT'S. Fill-never-clobber exists so a counter
//     checkout cannot blank a curated address; it dedups by person/email/name. The import's
//     identity is `qb_customer_id`, which QuickBooks guarantees, and which the non-partial unique
//     index makes a database-level fact.
//
// The rule of three is about the same OPERATION appearing twice. Resolving ONE customer from a
// counter sale and seeding a company's whole customer book are not the same operation, and the
// `people` spine is what distinguishes them. Declared in `verify-write-paths.mjs` so the cap
// states it on every run rather than leaving it as a comment somebody could reasonably overrule.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 AN EXISTING CUSTOMER IS NEVER STAMPED WITH THE RUN ID. THIS IS THE DATA-LOSS TRAP.
// ══════════════════════════════════════════════════════════════════════════════════════════
// The obvious implementation is one `upsert(..., { onConflict: 'business_id,qb_customer_id' })`
// over all 1,946 rows. It is WRONG, and the failure is silent until the undo runs: PostgREST's
// upsert writes every supplied column on the conflict path too, so all 19 of LAWNS's PRE-EXISTING
// QuickBooks-linked customers would receive this run's `import_run_id` — and
// `undoCustomerImport` deletes by exactly that. The undo would delete real customers that
// predate the import, with their orders and deliveries pointing at them.
//
// So the ids the tenant already holds are READ FIRST and the set is PARTITIONED: new ids are
// INSERTed carrying the run id; existing ids take a narrow UPDATE that does not mention it.
// §D asserts the update payload has no `import_run_id` key at all, and mutant M4 restores the
// naive single-upsert to prove the probe fails on it.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 WHAT AN EXISTING ROW ACTUALLY RECEIVES: THE EXEMPTION, AND NOTHING ELSE.
// ══════════════════════════════════════════════════════════════════════════════════════════
// The exemption is the one-time fix this build exists for — "miss it and we charge tax to a
// church" — and it is the one fact the local row cannot have got right on its own: all 30 of
// LAWNS's customers read `tax_exempt = false` today, including the ones QuickBooks says are
// exempt. So the three exemption columns are applied to an existing match.
//
// ⚠️ NAME, EMAIL, PHONE AND ADDRESS ARE NOT TOUCHED ON AN EXISTING ROW. Those may have been
// curated locally — corrected by Lauren, filled from a delivery, fixed after a bounced email —
// and QuickBooks is not automatically the better copy. Overwriting them would be the clobber
// `findOrCreateCustomer` was rewritten in August to stop doing. A row that exists keeps its
// contact details; only its tax status is reconciled.
// ─────────────────────────────────────────────────────────────────────────────
import { isPushHeld } from './pushHold';
import { pushPermitted } from '../business-logic/testMode';
import {
  CUSTOMER_IMPORT_SOURCE, type AdaptedCustomer, type CustomerAdaptation, type DuplicateFlag,
} from './qboCustomerAdapter';

/** The narrow slice of a supabase client this file uses. Passed in, never constructed. */
export interface DbLike {
  from: (table: string) => any;
}

/** How many rows go in one insert. Large enough to be few calls, small enough to stay well
 *  inside a serverless request body limit at ~1,950 records. */
export const CUSTOMER_INSERT_BATCH = 500;

export interface CustomerPlanReport {
  ok: boolean;
  /** Records the capture yielded, after the adapter's own refusals. */
  readable: number;
  /** Of those, how many have no matching `qb_customer_id` in this tenant — the ones that land. */
  toCreate: number;
  /** How many already exist here and will have their exemption reconciled. */
  toReconcile: number;
  skipped: { reason: string; count: number }[];
  exemptCount: number;
  exemptWithNamedReason: number;
  organizationCount: number;
  duplicates: DuplicateFlag[];
  duplicateRecordCount: number;
  /** The tenant's customer count BEFORE anything is written. */
  existingCustomers: number;
  /** Stated, never assumed: a preview writes nothing. */
  wrote: false;
  headline: string | null;
}

export interface CustomerRunReport extends Omit<CustomerPlanReport, 'wrote'> {
  runId: string;
  created: number;
  reconciled: number;
  /** Re-read AFTER the write, so the number is observed rather than predicted. */
  customersAfter: number;
  stampedWithThisRun: number;
  wrote: true;
}

export interface CustomerUndoReport {
  ok: boolean;
  runId: string;
  deleted: number;
  /**
   * 🔴 THE CUSTOMERS THE DATABASE REFUSED TO DELETE, NAMED, WITH THE REASON.
   *
   * `orders_customer_id_fkey` is **ON DELETE RESTRICT** (confirmed against `pg_constraint`,
   * 2026-09-06), so a customer carrying an order cannot be removed — Postgres refuses outright.
   * That is the strongest possible answer to R2/A3's FK-cascade condition: no cascade, no orphan,
   * no silent damage. But RESTRICT ERRORS rather than degrading, so the undo has to expect it and
   * report it, not die on it.
   */
  blocked: { customerId: string; displayName: string; orders: number }[];
  /**
   * ⚠️ THE OTHER FK BEHAVES DIFFERENTLY AND IT IS COUNTED RATHER THAN ASSUMED HARMLESS.
   * `deliveries.customer_id` is **ON DELETE SET NULL** (`20260620_deliveries.sql:28`), so a
   * delivery raised against an imported customer SURVIVES the undo with its customer blanked.
   * Nothing refuses; nothing warns. This number is the only place that says it happened.
   */
  deliveriesUnlinked: number;
  /** Non-null when the undo REFUSED WHOLESALE. A refusal is not an error and not a silent no-op. */
  refusedBecause: string | null;
  remainingWithThisRun: number;
}

/**
 * The columns an INSERT writes. Declared as data so a probe can assert the payload against it,
 * and so adding one is a visible edit rather than a silently wider write.
 *
 * ⚠️ `import_run_id` IS HERE AND IS DELIBERATELY ABSENT FROM THE RECONCILE PAYLOAD BELOW.
 */
export const CUSTOMER_INSERT_COLUMNS = [
  'business_id', 'qb_customer_id', 'import_run_id', 'source',
  'display_name', 'customer_type', 'first_name', 'last_name', 'organization_name',
  'email', 'phone',
  'address_line1', 'city', 'state', 'zip',
  'billing_line1', 'billing_city', 'billing_state', 'billing_zip',
  'tax_exempt', 'tax_exempt_reason', 'tax_exempt_cert_ref',
  'notes',
] as const;

/** The THREE columns an existing row receives. Nothing else, ever — see the header. */
export const CUSTOMER_RECONCILE_COLUMNS = ['tax_exempt', 'tax_exempt_reason', 'tax_exempt_cert_ref'] as const;

/**
 * One adapted customer → the INSERT payload.
 *
 * 🔴 CANONICAL + MIRROR (D-41). `billing_*` is the home and the legacy unprefixed four are
 * written alongside it, exactly as `findOrCreateCustomer` and the party editor do. Writing only
 * one set is how the invoice printed one address and the delivery route showed another.
 */
export function rowForCustomer(businessId: string, runId: string, c: AdaptedCustomer): Record<string, unknown> {
  return {
    business_id: businessId,
    qb_customer_id: c.qb_customer_id,
    import_run_id: runId,
    source: CUSTOMER_IMPORT_SOURCE,
    display_name: c.display_name,
    customer_type: c.customer_type,
    first_name: c.first_name,
    last_name: c.last_name,
    organization_name: c.organization_name,
    email: c.email,
    phone: c.phone,
    address_line1: c.address_line1,
    city: c.city,
    state: c.state,
    zip: c.zip,
    billing_line1: c.address_line1,
    billing_city: c.city,
    billing_state: c.state,
    billing_zip: c.zip,
    tax_exempt: c.tax_exempt,
    tax_exempt_reason: c.tax_exempt_reason,
    tax_exempt_cert_ref: c.tax_exempt_cert_ref,
    notes: c.notes,
  };
}

/** Every `qb_customer_id` this tenant already holds. Paged, because PostgREST caps a read. */
async function existingQbIds(db: DbLike, businessId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('customers')
      .select('qb_customer_id')
      .eq('business_id', businessId)
      .not('qb_customer_id', 'is', null)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`could not read existing customer ids: ${error.message}`);
    const rows = (data ?? []) as { qb_customer_id: string | null }[];
    for (const r of rows) if (r.qb_customer_id) ids.add(String(r.qb_customer_id));
    if (rows.length < PAGE) break;
  }
  return ids;
}

async function countCustomers(db: DbLike, businessId: string): Promise<number> {
  const { count, error } = await db.from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId);
  if (error) throw new Error(`could not count customers: ${error.message}`);
  return count ?? 0;
}

async function countStamped(db: DbLike, businessId: string, runId: string): Promise<number> {
  const { count, error } = await db.from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('import_run_id', runId);
  if (error) throw new Error(`could not count this run's rows: ${error.message}`);
  return count ?? 0;
}

/** Split the adapted set against what the tenant already holds. */
function partition(customers: AdaptedCustomer[], held: Set<string>) {
  const create: AdaptedCustomer[] = [], reconcile: AdaptedCustomer[] = [];
  for (const c of customers) (held.has(c.qb_customer_id) ? reconcile : create).push(c);
  return { create, reconcile };
}

/**
 * PLAN the import. Reads; writes NOTHING.
 *
 * 🔴 THE PREVIEW IS WHERE THE 72 ARE SHOWN. Merging is not on a switch anywhere in this file —
 * there is no merge to enable. The flags are carried so a human can look at them.
 */
export async function previewCustomerImport(
  db: DbLike, businessId: string, adaptation: CustomerAdaptation,
): Promise<CustomerPlanReport> {
  const held = await existingQbIds(db, businessId);
  const { create, reconcile } = partition(adaptation.customers, held);
  const existingCustomers = await countCustomers(db, businessId);
  console.log('[TRACE:CUSTIMPORT] preview', {
    businessId, readable: adaptation.customers.length, toCreate: create.length,
    toReconcile: reconcile.length, exempt: adaptation.exemptCount,
    duplicateRecords: adaptation.duplicateRecordCount,
  });
  return {
    ok: true,
    readable: adaptation.customers.length,
    toCreate: create.length,
    toReconcile: reconcile.length,
    skipped: adaptation.skipped,
    exemptCount: adaptation.exemptCount,
    exemptWithNamedReason: adaptation.exemptWithNamedReason,
    organizationCount: adaptation.organizationCount,
    duplicates: adaptation.duplicates,
    duplicateRecordCount: adaptation.duplicateRecordCount,
    existingCustomers,
    wrote: false,
    headline: adaptation.customers.length === 0
      ? 'Nothing to import — this capture holds no readable customer records.'
      : null,
  };
}

/**
 * COMMIT. Creates the new customers and reconciles the exemption on the ones already here.
 *
 * 🔴 CREATE FIRST, RECONCILE SECOND, and the order is chosen on what a HALF-LANDED run leaves:
 * create-then-reconcile fails to "the new customers are here, some existing tax flags not yet
 * corrected" — every created row identifiable by its run id and removable. The other order fails
 * to "some tax flags corrected, no customers imported", which is a half-finished job with nothing
 * naming it. Neither order needs a transaction, because the run id makes every partial state
 * nameable and reversible from the data alone.
 *
 * ⚠️ THE RECONCILE IS ONE STATEMENT PER ROW, ON PURPOSE. It touches at most the handful that
 * already exist (19 at LAWNS), each with a different value, so there is no batch form of it that
 * is not an upsert — and an upsert is precisely what would stamp the run id onto a pre-existing
 * customer. A loop over 19 is the cheap correct thing.
 */
export async function commitCustomerImport(
  db: DbLike, businessId: string, adaptation: CustomerAdaptation, runId: string,
): Promise<CustomerRunReport> {
  const plan = await previewCustomerImport(db, businessId, adaptation);
  const held = await existingQbIds(db, businessId);
  const { create, reconcile } = partition(adaptation.customers, held);

  let created = 0;
  for (let i = 0; i < create.length; i += CUSTOMER_INSERT_BATCH) {
    const batch = create.slice(i, i + CUSTOMER_INSERT_BATCH).map(c => rowForCustomer(businessId, runId, c));
    const { error } = await db.from('customers').insert(batch);
    if (error) throw new Error(`customer insert failed at row ${i}: ${error.message}`);
    created += batch.length;
  }

  let reconciled = 0;
  for (const c of reconcile) {
    // 🔴 NO `import_run_id` IN THIS PAYLOAD. See the header — stamping it here is the data-loss bug.
    const { data, error } = await db.from('customers')
      .update({
        tax_exempt: c.tax_exempt,
        tax_exempt_reason: c.tax_exempt_reason,
        tax_exempt_cert_ref: c.tax_exempt_cert_ref,
      })
      .eq('business_id', businessId)
      .eq('qb_customer_id', c.qb_customer_id)
      .select('id');
    if (error) throw new Error(`exemption reconcile failed for ${c.qb_customer_id}: ${error.message}`);
    // 🔴 A REFUSED UPDATE RETURNS NO ERROR AND ZERO ROWS (A8), AND THIS IS THE WRITE WHERE THAT
    // MATTERS MOST: a silently declined exemption leaves a church marked taxable, and the next
    // invoice charges them. EXACTLY ONE row must have been touched — `qb_customer_id` is unique
    // per tenant, so anything other than one is a fact worth stopping on rather than a count to
    // log. Caught by `verify-zero-row-writes`, which was right to flag the version without it.
    const rows = (data ?? []) as unknown[];
    if (rows.length !== 1) {
      throw new Error(`exemption reconcile affected ${rows.length} rows for QuickBooks customer `
        + `${c.qb_customer_id} — expected exactly 1. Nothing further was written. This is what a `
        + `permission refusal looks like: no error, no rows.`);
    }
    reconciled++;
  }

  // Observed, not predicted — the run re-reads what it claims to have done.
  const customersAfter = await countCustomers(db, businessId);
  const stampedWithThisRun = await countStamped(db, businessId, runId);
  console.log('[TRACE:CUSTIMPORT] commit', { businessId, runId, created, reconciled, customersAfter, stampedWithThisRun });

  return {
    ...plan, wrote: true, runId, created, reconciled, customersAfter, stampedWithThisRun,
  };
}

/**
 * UNDO — delete exactly the rows this run created.
 *
 * 🔴 IT REFUSES WHILE QUICKBOOKS WRITES ARE ON, and reuses the existing `QBO_PUSH_HOLD` rather
 * than a second mechanism that could disagree with it (R-95). While the push is HELD, an imported
 * customer is disposable: nothing has been sent to them and no invoice bearing their name has
 * left the building. Once writes go on, an invoice can have been raised against an imported
 * customer, and deleting that row would orphan a document in a real company's books.
 *
 * 🔴 WHAT IT CANNOT TOUCH IS BY CONSTRUCTION, NOT BY A FILTER. Every customer that predates this
 * run has a different `import_run_id` or none — including all 19 QuickBooks-linked rows the
 * reconcile updated, which were never stamped — so they are outside `WHERE import_run_id = <run>`
 * by definition rather than by a clause somebody could drop.
 *
 * ⚠️ A DELETE THAT MATCHES NOTHING RETURNS NO ERROR, so the undo proves it LANDED by re-reading
 * how many rows still carry the run id (#274's lesson: a PostgREST write matching zero rows
 * reports success).
 */
/** How many ids go in one `.in(...)` — a URL, not a body, so it has a real length limit. */
const UNDO_ID_CHUNK = 200;

/** Postgres 23503 = foreign_key_violation. Matched on CODE first, message second — a message
 *  match alone would break the day Supabase rewords it, and a code match alone misses a driver
 *  that only forwards text. */
function isForeignKeyRefusal(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '23503' || /violates foreign key constraint/i.test(error.message ?? '');
}

/**
 * Delete these customer ids, and NEVER let one refusal take the batch down with it.
 *
 * 🔴 A BULK DELETE IS ONE STATEMENT, SO UNDER RESTRICT A SINGLE BLOCKED CUSTOMER REMOVES NOTHING
 * AT ALL — not "most of them". That is why a chunk that comes back with a foreign-key refusal is
 * retried ROW BY ROW rather than reported as a failed chunk: the honest outcome is "1,926 gone,
 * this one stayed and here is why", and only per-row retry can produce it.
 */
async function deleteCustomerIds(
  db: DbLike, businessId: string, ids: string[],
): Promise<{ deleted: number; refused: string[] }> {
  let deleted = 0;
  const refused: string[] = [];
  for (let i = 0; i < ids.length; i += UNDO_ID_CHUNK) {
    const chunk = ids.slice(i, i + UNDO_ID_CHUNK);
    const { data, error } = await db.from('customers')
      .delete().eq('business_id', businessId).in('id', chunk).select('id');
    if (!error) {
      // A8: no error and no rows, on ids we have just read back, is not "nothing to do" — it is a
      // policy declining the delete. NOT thrown: the post-delete re-read in the caller is the
      // authority and reports `remaining` honestly, so aborting here would turn a reportable
      // partial into a crash. It is logged so the trail says which chunk went quiet.
      if (((data ?? []) as unknown[]).length === 0 && chunk.length > 0) {
        console.log('[TRACE:CUSTIMPORT] undo — a chunk removed NOTHING and reported no error', {
          businessId, asked: chunk.length,
        });
      }
      deleted += ((data ?? []) as unknown[]).length;
      continue;
    }
    if (!isForeignKeyRefusal(error)) throw new Error(`undo failed: ${error.message}`);
    // The chunk held at least one customer with an order. Find out which, one at a time.
    for (const id of chunk) {
      const one = await db.from('customers')
        .delete().eq('business_id', businessId).eq('id', id).select('id');
      if (!one.error) {
        // Same A8 reading, per row: no error, no row, on an id we just read.
        if (((one.data ?? []) as unknown[]).length === 0) {
          console.log('[TRACE:CUSTIMPORT] undo — a row removed NOTHING and reported no error', { businessId, id });
        }
        deleted += ((one.data ?? []) as unknown[]).length;
        continue;
      }
      if (!isForeignKeyRefusal(one.error)) throw new Error(`undo failed: ${one.error.message}`);
      refused.push(id);
    }
  }
  return { deleted, refused };
}

/**
 * UNDO — remove exactly the customers this run created, and say plainly what it could not remove.
 *
 * 🔴 IT REFUSES ENTIRELY WHILE QUICKBOOKS WRITES ARE ON, reusing the existing `QBO_PUSH_HOLD`
 * rather than a second mechanism that could disagree with it (R-95).
 *
 * 🔴 WHAT IT CANNOT TOUCH IS BY CONSTRUCTION, NOT BY A FILTER. Every customer that predates this
 * run has a different `import_run_id` or none — including all 19 QuickBooks-linked rows the
 * reconcile updated, which were never stamped — so they are outside `WHERE import_run_id = <run>`
 * by definition rather than by a clause somebody could drop.
 *
 * ⚠️ IT IS NOT A FULL RESTORE AND THE REPORT MUST NOT IMPLY THAT IT IS. The exemption RECONCILE
 * is not reversed: rows that already existed had three columns corrected toward QuickBooks and
 * they keep those values. That is a deliberate asymmetry — the reconcile is a correction, not
 * something this run invented — but it means "undo" means "un-create", never "put the tenant back
 * byte for byte".
 */
export async function undoCustomerImport(
  db: DbLike, businessId: string, runId: string, pushHoldRaw: string | undefined,
): Promise<CustomerUndoReport> {
  const empty = { runId, deleted: 0, blocked: [] as CustomerUndoReport['blocked'], deliveriesUnlinked: 0 };

  // ── 🔴 BOTH SWITCHES, AND-ED THROUGH THE ONE SHARED PREDICATE ──────────────────────────────
  // CORRECTED 2026-09-06, before this ever ran: the first draft read ONLY `QBO_PUSH_HOLD`, which
  // is the OPERATOR's deploy-wide hold. The OWNER has their own switch — `businesses.
  // qbo_writes_enabled` (`20260902_business_qbo_writes_switch.sql:65`), what `QboWriteSwitch.tsx`
  // flips, what the TEST MODE banner reads, and what `api/orders/submit.ts` gates the real push
  // on. **At LAWNS today that column is `false` and the env var is unset**, so an env-only gate
  // computes "writes are on" and REFUSES THE UNDO IN EXACTLY THE STATE IT EXISTS TO SERVE — not
  // incomplete, inverted in practice. The same defect was found in the catalogue import's undo by
  // David asking which switch it read (#277, `e04a697`); this one is corrected from that finding
  // rather than from its own failure.
  //
  // `pushPermitted` is the ONE shared predicate — its own header: *"TWO SWITCHES, AND-ED, BECAUSE
  // THEY BELONG TO DIFFERENT PEOPLE… Either one saying no means no."* The undo is open exactly
  // when a push is NOT permitted.
  const platformHeld = isPushHeld(pushHoldRaw, businessId);
  const biz = await db.from('businesses').select('qbo_writes_enabled').eq('id', businessId).maybeSingle();
  if (biz.error || !biz.data) {
    // 🔴 A FAILED READ CLOSES THE UNDO, and says something DIFFERENT from "you are live". Failing
    // open here would delete customers on the strength of a query that did not answer.
    console.log('[TRACE:CUSTIMPORT] undo CLOSED — could not read qbo_writes_enabled', {
      businessId, runId, message: (biz.error as { message?: string } | null)?.message ?? 'no row',
    });
    return {
      ...empty, ok: false,
      refusedBecause: 'We could not check whether this business is sending invoices to QuickBooks, '
        + 'so the undo is closed. This is not a statement that you are live — it is that we could '
        + 'not tell. Nothing was deleted.',
      remainingWithThisRun: await countStamped(db, businessId, runId),
    };
  }
  const writesEnabled = (biz.data as { qbo_writes_enabled?: boolean }).qbo_writes_enabled ?? null;
  if (pushPermitted({ writesEnabled, platformHeld })) {
    console.log('[TRACE:CUSTIMPORT] undo REFUSED — QuickBooks writes are on', { businessId, runId, writesEnabled, platformHeld });
    return {
      ...empty, ok: false,
      refusedBecause: 'QuickBooks writes are ON for this business. Once writes are on, an invoice '
        + 'can have been raised against an imported customer, and deleting them would orphan a '
        + 'real document. Nothing was deleted.',
      remainingWithThisRun: await countStamped(db, businessId, runId),
    };
  }

  // ── who this run made, by id and by name, so a refusal can be reported as a PERSON ──
  const mine: { id: string; display_name: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('customers')
      .select('id, display_name')
      .eq('business_id', businessId).eq('import_run_id', runId)
      .range(from, from + 999);
    if (error) throw new Error(`could not read this run's customers: ${error.message}`);
    const rows = (data ?? []) as { id: string; display_name: string | null }[];
    mine.push(...rows);
    if (rows.length < 1000) break;
  }
  if (mine.length === 0) {
    console.log('[TRACE:CUSTIMPORT] undo — nothing carries this run id', { businessId, runId });
    return { ...empty, ok: true, refusedBecause: null, remainingWithThisRun: 0 };
  }
  const nameOf = new Map(mine.map(r => [r.id, r.display_name ?? '(unnamed)']));
  const ids = mine.map(r => r.id);

  // ── what points at them, read BEFORE the delete so both FK behaviours are reportable ──
  const orderCount = new Map<string, number>();
  let deliveriesUnlinked = 0;
  for (let i = 0; i < ids.length; i += UNDO_ID_CHUNK) {
    const chunk = ids.slice(i, i + UNDO_ID_CHUNK);
    const o = await db.from('orders').select('customer_id').in('customer_id', chunk);
    if (o.error) throw new Error(`could not read orders: ${o.error.message}`);
    for (const r of ((o.data ?? []) as { customer_id: string }[])) {
      orderCount.set(r.customer_id, (orderCount.get(r.customer_id) ?? 0) + 1);
    }
    // SET NULL, so these are not blocked — they are SILENTLY unlinked, which is why they are counted.
    const d = await db.from('deliveries').select('id').in('customer_id', chunk);
    if (d.error) throw new Error(`could not read deliveries: ${d.error.message}`);
    deliveriesUnlinked += ((d.data ?? []) as unknown[]).length;
  }

  // Skip the ones we already know Postgres will refuse — a delete we know will error is not worth
  // issuing. The per-row fallback below still catches any order that lands after this read.
  const knownBlocked = new Set([...orderCount.keys()]);
  const attempt = ids.filter(id => !knownBlocked.has(id));

  const { deleted, refused } = await deleteCustomerIds(db, businessId, attempt);
  for (const id of refused) knownBlocked.add(id);

  const blocked = [...knownBlocked].map(id => ({
    customerId: id,
    displayName: nameOf.get(id) ?? '(unnamed)',
    orders: orderCount.get(id) ?? 0,
  }));

  // 🔴 THE RE-READ IS THE PROOF, NOT THE ROW COUNT. A PostgREST delete an RLS policy declines
  // returns NO error and zero rows — identical to a delete that had nothing to do (#274).
  const remaining = await countStamped(db, businessId, runId);
  console.log('[TRACE:CUSTIMPORT] undo', { businessId, runId, deleted, blocked: blocked.length, deliveriesUnlinked, remaining });

  // 🔴 ok MEANS "EVERYTHING THAT COULD GO, WENT" — not "the table is empty". A run with three
  // blocked customers and 1,924 removed is a SUCCESSFUL partial undo, and calling it a failure
  // would push an operator to retry something that will refuse again for the same good reason.
  const ok = remaining === blocked.length;
  return {
    ok, runId, deleted, blocked, deliveriesUnlinked,
    remainingWithThisRun: remaining,
    refusedBecause: blocked.length === 0
      ? (ok ? null : `The database declined the delete: ${remaining} rows still carry this run id `
          + 'and no foreign key explains it. Nothing further was attempted. This is a permissions '
          + 'refusal, not an empty undo.')
      : `${blocked.length} customer(s) could not be removed because they carry orders — the `
        + 'database refuses to delete a customer an order points at (ON DELETE RESTRICT), which is '
        + 'the protection working, not a fault. Everything else this run created was removed. To '
        + 'clear these, the orders have to go first, and that is a separate decision.',
  };
}

