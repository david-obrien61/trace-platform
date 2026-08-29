// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the entity-agnostic half of every QuickBooks READ — how a query is built, how a
//   count is read, how a page of rows is unwrapped, when the loop is done, whether the walk
//   was COMPLETE, what a capture file is called, and what an HTTP status means. `Item` and
//   `Customer` are the same operation with one word changed, so they are ONE implementation
//   here rather than two that drift (§6 r8).
// DEPENDENCIES: none. No network, no secrets, no storage.
// OUTPUTS: QboEntity · QBO_PAGE_SIZE · qboCountQuery · qboPageQuery · parseCount · parseRows ·
//   pageIsLast · completeness · rawCaptureFileName · classifyFailure.
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
// 🔴 NOTHING HERE PERSISTS AND NOTHING HERE TAKES A BODY TO A LOG. Both entities are a live
//   customer's books; `Customer` is roughly 1,900 real people. Bodies go to the operator's own
//   download folder and to nowhere else (R-23 clause b/c).
// ─────────────────────────────────────────────────────────────────────────────

/** The two entities this platform reads. Adding a third is one string, not a second client. */
export type QboEntity = 'Item' | 'Customer';

/**
 * QuickBooks caps a page at 1000 rows and silently returns 100 when MAXRESULTS is absent —
 * which is exactly how #229's read looked complete while holding a tenth of the list.
 */
export const QBO_PAGE_SIZE = 1000;

/** An absolute stop, so a server that keeps answering can never spin this loop forever. */
export const QBO_MAX_PAGES = 50;

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
 * Unwrap `{ QueryResponse: { Item: [...] } }` / `{ QueryResponse: { Customer: [...] } }` into
 * plain row objects, WITHOUT interpreting any field. Field interpretation is per-entity and
 * lives in itemList.ts / customerList.ts; this function only answers "did we get a list, and
 * what is in it".
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
 * 🔴 THE ENTITY IS IN THE NAME because the two files are NOT the same kind of thing. The item
 * file is a product catalogue. The customer file is ~1,900 real people with addresses, phones
 * and email. A person who finds one must be able to tell which they are holding.
 */
export function rawCaptureFileName(entity: QboEntity, realmId: string, at: Date): string {
  const stamp = at.toISOString().replace(/[:.]/g, '-');
  const realm = String(realmId || 'unknown-realm').replace(/[^A-Za-z0-9_-]/g, '');
  const kind  = entity === 'Customer' ? 'customers' : 'items';
  return `qbo-${kind}-${realm || 'unknown-realm'}-${stamp}.json`;
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
