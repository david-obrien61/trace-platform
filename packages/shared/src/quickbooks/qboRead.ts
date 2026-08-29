// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the entity-agnostic half of every QuickBooks READ — how a query is built, how a
//   count is read, how a page of rows is unwrapped, when the loop is done, how big a list we
//   will pull in one go, whether the walk was COMPLETE, what a capture file is called, and what
//   an HTTP status means. `Item`, `Customer` and `Invoice` are the same operation with one word
//   changed, so they are ONE implementation here rather than three that drift (§6 r8).
// DEPENDENCIES: none. No network, no secrets, no storage.
// OUTPUTS: QBO_ENTITIES · QboEntity · QBO_ROUTE · QBO_PAGE_SIZE · QBO_WALK_CEILING · maxPagesFor ·
//   ceilingCheck · qboCountQuery · qboPageQuery · parseCount · parseRows · pageIsLast ·
//   completeness · rawCaptureFileName · classifyFailure.
//
// 🔴 WHY THIS FILE EXISTS AT ALL — THE ONE-PAGE SCOPE BAR WAS WRONG AND ITS OWN FLAG SAID SO.
//   #229 shipped `select * from Item` with no STARTPOSITION, and flagged that a truncated list
//   would not announce itself. It came back `maxResults: 100, startPosition: 1`, exactly 100
//   rows, with ids running past 1127 — i.e. TRUNCATED, and the only reason anybody knew is
//   that a human read the ids. That is the confident-label-over-unread-data defect wearing a
//   pagination costume: a partial answer rendered as a complete one.
//
// 🔴 SO COMPLETENESS IS NOT A NOTE HERE, IT IS A FAILURE. The count is asked FIRST, before the
//   loop runs, and a retrieved total that does not equal the expected total is `ok:false` with
//   its own code — never a table with a caveat under it. Truncation cannot hide again because
//   the read now carries the number it was supposed to reach.
//
// 🔴 NOTHING HERE PERSISTS AND NOTHING HERE TAKES A BODY TO A LOG. Every entity here is a live
//   customer's books: `Customer` is roughly 1,900 real people, and `Invoice` is what those
//   people bought. Bodies go to the operator's own download folder and nowhere else (R-23 b/c).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The entities this platform reads.
 *
 * 🔴 IT IS AN ARRAY RATHER THAN A BARE UNION SO THE SWEEPS CAN ITERATE IT. `qboRead.test.ts` §A
 * proves that NO query this module can generate carries a write verb, and it proves that over
 * `QBO_ENTITIES` — so a fourth entity is covered by that assertion the moment it is added,
 * instead of the moment somebody remembers to widen a hand-written list in a test. A coverage
 * list that has to be maintained by hand is a coverage list that eventually under-covers (R-19).
 */
export const QBO_ENTITIES = ['Item', 'Customer', 'Invoice'] as const;

/** Adding one is a string in the array above, not a second client. */
export type QboEntity = (typeof QBO_ENTITIES)[number];

/**
 * QuickBooks caps a page at 1000 rows and silently returns 100 when MAXRESULTS is absent —
 * which is exactly how #229's read looked complete while holding a tenth of the list.
 */
export const QBO_PAGE_SIZE = 1000;

/** An absolute stop, so a server that keeps answering can never spin this loop forever. */
export const QBO_MAX_PAGES = 50;

/**
 * 🔴 HOW MANY ROWS OF THIS ENTITY WE ARE WILLING TO PULL IN ONE GO — A REFUSAL, NOT A WARNING.
 *
 * An `Item` or a `Customer` is one flat record. An `Invoice` carries a nested `Line[]`, so a
 * year of a busy nursery's invoices is a materially bigger object than a year of its customers,
 * and "walk it and see" is how a read turns into a hundred-megabyte download nobody chose.
 *
 * `Invoice` is therefore capped at 10,000 and the endpoint STOPS AND REPORTS above it rather
 * than pulling the lot — the count is already in hand at that point, so the operator is told the
 * real number and can decide. The other two sit at the walk's own natural bound
 * (`QBO_MAX_PAGES` × `QBO_PAGE_SIZE`), i.e. this constant does not narrow the behaviour of a
 * read that already shipped.
 */
export const QBO_WALK_CEILING: Record<QboEntity, number> = {
  Item:     QBO_MAX_PAGES * QBO_PAGE_SIZE,
  Customer: QBO_MAX_PAGES * QBO_PAGE_SIZE,
  Invoice:  10_000,
};

/**
 * The page ceiling for one entity.
 *
 * 🔴 THIS IS THE HALF THAT HOLDS WHEN THE COUNT IS UNREADABLE. `ceilingCheck` can only refuse a
 * number it was given; if QuickBooks does not return a readable `totalCount` there is nothing to
 * compare, and a walk bounded only by `QBO_MAX_PAGES` would happily pull 50,000 invoices to find
 * that out. Bounding the LOOP as well means the ceiling holds whether or not the count arrived.
 */
export function maxPagesFor(entity: QboEntity): number {
  const byCeiling = Math.ceil(QBO_WALK_CEILING[entity] / QBO_PAGE_SIZE);
  return Math.max(1, Math.min(QBO_MAX_PAGES, byCeiling));
}

export interface CeilingVerdict {
  allowed: boolean;
  ceiling: number;
  /** Set only when the walk is refused. Names the real number so the decision is informed. */
  headline: string | null;
}

/**
 * Asked AFTER the count and BEFORE the loop: is this list small enough to pull in one go?
 *
 * An unreadable count is ALLOWED through here — deliberately, and it is not a hole: the loop is
 * independently bounded by `maxPagesFor`, and `completeness` refuses the result at the end
 * because a walk whose expected total is unknown can never be proven complete. Refusing here as
 * well would report "too many" for a company that might hold three.
 */
export function ceilingCheck(entity: QboEntity, expected: number | null): CeilingVerdict {
  const ceiling = QBO_WALK_CEILING[entity];
  if (expected === null || expected <= ceiling) return { allowed: true, ceiling, headline: null };
  return {
    allowed: false, ceiling,
    headline: `STOPPED BEFORE READING: QuickBooks reports ${expected.toLocaleString()} ${entity} records, above the ${ceiling.toLocaleString()} this read will pull in one go. Nothing was downloaded and nothing was changed. A list this size is a different conversation — say the number out loud before pulling it.`,
  };
}

/**
 * `select count(*) from <Entity>` — asked BEFORE the loop so the expected total is known in
 * advance and completeness is PROVABLE rather than assumed from "the last page looked short".
 */
export function qboCountQuery(entity: QboEntity): string {
  return `select count(*) from ${entity}`;
}

/**
 * One page. STARTPOSITION is 1-based in Intuit's query language (not 0-based — the off-by-one
 * here would silently drop the first row of every page after the first).
 */
export function qboPageQuery(entity: QboEntity, startPosition: number, pageSize = QBO_PAGE_SIZE): string {
  const start = Number.isFinite(startPosition) && startPosition >= 1 ? Math.floor(startPosition) : 1;
  const size  = Number.isFinite(pageSize) && pageSize >= 1 ? Math.min(Math.floor(pageSize), QBO_PAGE_SIZE) : QBO_PAGE_SIZE;
  return `select * from ${entity} startposition ${start} maxresults ${size}`;
}

export interface CountResult {
  ok: boolean;
  total: number | null;
  parseError: string | null;
}

/**
 * Read `{ QueryResponse: { totalCount: N } }`.
 *
 * 🔴 A COUNT WE COULD NOT READ IS `null`, NEVER 0. Defaulting an unreadable count to zero would
 * make every subsequent completeness check pass trivially — the guard would agree with any
 * number of rows, including none — which is the same class of lie as rendering an unparsed body
 * as an empty list (D-9 / A9).
 */
export function parseCount(rawBody: string): CountResult {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { ok: false, total: null, parseError: 'Count response was not JSON' };
  }
  const qr = (body as { QueryResponse?: unknown } | null)?.QueryResponse;
  if (qr === null || qr === undefined || typeof qr !== 'object') {
    return { ok: false, total: null, parseError: 'Count response carried no QueryResponse' };
  }
  const n = (qr as { totalCount?: unknown }).totalCount;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
    return { ok: false, total: null, parseError: 'Count response carried no readable totalCount' };
  }
  return { ok: true, total: Math.floor(n), parseError: null };
}

export interface RowsResult {
  ok: boolean;
  rows: Record<string, unknown>[];
  parseError: string | null;
}

/**
 * Unwrap `{ QueryResponse: { <Entity>: [...] } }` into plain row objects, WITHOUT interpreting
 * any field. Field interpretation is per-entity and lives in itemList.ts / customerList.ts /
 * invoiceList.ts; this function only answers "did we get a list, and what is in it".
 *
 * 🔴 AN EMPTY LIST AND A FAILED PARSE ARE DIFFERENT FACTS. A QuickBooks company genuinely can
 * hold zero items, and Intuit expresses that by OMITTING the key — so the true empty answer is
 * `ok:true, rows:[]`, and an unreadable body must not be able to hide inside it.
 */
export function parseRows(rawBody: string, entity: QboEntity): RowsResult {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { ok: false, rows: [], parseError: 'Response was not JSON' };
  }
  const qr = (body as { QueryResponse?: unknown } | null)?.QueryResponse;
  if (qr === null || qr === undefined || typeof qr !== 'object') {
    return { ok: false, rows: [], parseError: 'Response carried no QueryResponse' };
  }
  const raw = (qr as Record<string, unknown>)[entity];
  if (raw === undefined) return { ok: true, rows: [], parseError: null };
  if (!Array.isArray(raw)) {
    return { ok: false, rows: [], parseError: `QueryResponse.${entity} was not a list` };
  }
  return { ok: true, rows: raw as Record<string, unknown>[], parseError: null };
}

/**
 * The loop's stop condition: a page that came back SHORTER than we asked for is the last one.
 * A full page is never assumed to be the last — that assumption is what produced #229's 100.
 */
export function pageIsLast(rowsReturned: number, requested: number): boolean {
  return rowsReturned < requested;
}

export interface Completeness {
  complete: boolean;
  expected: number | null;
  retrieved: number;
  headline: string;
}

/**
 * 🔴 THE POINT OF THE WHOLE BUILD. Expected vs retrieved, and a mismatch is a FAILURE with its
 * own sentence — not a footnote under a table somebody will read as the whole list.
 *
 * An UNREADABLE expected count is also not-complete: we cannot prove the walk finished, and
 * "probably fine" is the posture that let 100 rows pass for 1,127.
 */
export function completeness(expected: number | null, retrieved: number): Completeness {
  if (expected === null) {
    return {
      complete: false, expected: null, retrieved,
      headline: `QuickBooks did not give a readable total, so this list of ${retrieved} CANNOT be proven complete. Do not treat it as the whole list.`,
    };
  }
  if (expected === retrieved) {
    return {
      complete: true, expected, retrieved,
      headline: `Complete: QuickBooks reports ${expected} and ${retrieved} were retrieved.`,
    };
  }
  const dir = retrieved < expected ? 'SHORT' : 'OVER';
  return {
    complete: false, expected, retrieved,
    headline: `INCOMPLETE — QuickBooks reports ${expected} but ${retrieved} were retrieved (${dir} by ${Math.abs(expected - retrieved)}). This list is not the whole list.`,
  };
}

/**
 * The name of the raw-capture file. Deterministic and self-describing so a file found six
 * months from now says which COMPANY and which ENTITY it came from — a bare `export.json` in a
 * downloads folder is an unattributable copy of somebody's live accounting data.
 *
 * 🔴 THE ENTITY IS IN THE NAME because the files are NOT the same kind of thing. The item file is
 * a product catalogue. The customer file is ~1,900 real people with addresses, phones and email.
 * The invoice file is what those people bought and what they paid. A person who finds one must
 * be able to tell which they are holding.
 *
 * 🔴 THE MAP IS A `Record` KEYED ON THE UNION, NOT A TERNARY, AND THAT IS THE POINT. The
 * previous form read `entity === 'Customer' ? 'customers' : 'items'` — under which a third
 * entity silently files itself as `qbo-items-…`, mislabelling a customer's invoice history as a
 * product catalogue in a folder where nobody would look again. A `Record` makes omitting a name
 * a COMPILE error rather than a wrong file name.
 *
 * 🔴 AND IT IS THE URL PATH TOO, DELIBERATELY THE SAME CONSTANT. `QboBooksReader` held its own
 * copy of that same ternary to build `/api/qbo/<route>`, so an invoice read would have fetched
 * the ITEM endpoint and rendered an item list under an invoice heading — the identical defect,
 * twice, because one fact was written down in two places (STD-011). Route word and file word
 * are ONE map; adding an entity now forces both at once, in the compiler.
 */
export const QBO_ROUTE: Record<QboEntity, string> = {
  Item: 'items',
  Customer: 'customers',
  Invoice: 'invoices',
};

export function rawCaptureFileName(entity: QboEntity, realmId: string, at: Date): string {
  const stamp = at.toISOString().replace(/[:.]/g, '-');
  const realm = String(realmId || 'unknown-realm').replace(/[^A-Za-z0-9_-]/g, '');
  return `qbo-${QBO_ROUTE[entity]}-${realm || 'unknown-realm'}-${stamp}.json`;
}

export interface FailureNote {
  /** What the operator is told. Never contains the body — the body goes to the file. */
  headline: string;
  /** Which Stage-0 finding this status points at, so the next step is not a guess. */
  points_at: 'G3-token-refresh' | 'G2-scope' | 'connection' | 'unclassified';
}

/**
 * Turn an HTTP status into the next action, because 401 and 403 are DIFFERENT PROBLEMS and a
 * generic "the read failed" sends someone hunting the wrong one.
 */
export function classifyFailure(status: number): FailureNote {
  if (status === 401) {
    return {
      headline: 'QuickBooks rejected the token (401). The access token is expired or was revoked — this is the token-refresh path (Stage 0 G3), not a permissions problem.',
      points_at: 'G3-token-refresh',
    };
  }
  if (status === 403) {
    return {
      headline: 'QuickBooks refused the read (403). The granted scope does not permit it — Stage 0 G2 read com.intuit.quickbooks.accounting from the code, and a 403 means that reading was wrong.',
      points_at: 'G2-scope',
    };
  }
  return {
    headline: `QuickBooks returned ${status}. The verbatim response body is in the capture file — read it before acting.`,
    points_at: 'unclassified',
  };
}
