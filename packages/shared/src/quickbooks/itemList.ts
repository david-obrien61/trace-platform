// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the PURE half of the QuickBooks item-list read — the query string, the shape of
//   one item row, the parse of Intuit's response body, the deterministic raw-capture
//   filename, and the failure classification. No network, no secrets, no storage: this
//   module is what `api/qbo/router.ts` (_route=items) and the Accounting card both read so
//   the endpoint and the screen cannot describe the same response differently (§6 r8).
// DEPENDENCIES: none.
// OUTPUTS: QBO_ITEM_QUERY, QboItemRow, parseItemList, rawCaptureFileName, classifyFailure.
//
// 🔴 WHY THIS EXISTS AT ALL — THE ARMED LANDMINE. The invoice push carries TWELVE hardcoded
//   `ItemRef: { value: '1', name: 'Services' }` literals (`api/qbo/invoice/cultivar.ts`).
//   Nothing has pushed to LAWNS yet, so their books are clean; the next completed checkout is
//   the first real push and would land every line — the trees included — as generic
//   "Services", corrupting the Sales of Nursery Stock vs Services split the cost model rests
//   on. Reading their actual item list is what tells us the real ids. THIS PASS READS ONLY.
//
// 🔴 NOTHING HERE PERSISTS AND NOTHING HERE LOGS A BODY. The response is a customer's live
//   chart of items. It goes to the screen and to a file the operator's browser saves OUTSIDE
//   this repo; it is never written to a table, and never passed to console.log. Storing their
//   chart of items is a later decision with its own ruling (user_stories.md — "QuickBooks
//   read-back"), and this module is deliberately not the place it gets made by accident.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The read. `Item` is the QuickBooks entity behind every invoice line's `ItemRef` — a Service
 * or Inventory record carrying the income account that decides which revenue bucket a line
 * lands in. One page is enough to answer the question; pagination (STARTPOSITION) is a later
 * concern and is deliberately absent rather than half-written.
 */
export const QBO_ITEM_QUERY = 'select * from Item';

/** One item, reduced to the five fields that answer "what should a tree map to?". */
export interface QboItemRow {
  id: string;
  name: string;
  /** 'Service' | 'Inventory' | 'NonInventory' | … — Intuit's own vocabulary, not ours. */
  type: string | null;
  /** The revenue bucket. This is the field that makes the Nursery-Stock/Services split real. */
  incomeAccount: string | null;
  active: boolean | null;
}

export interface ParsedItemList {
  ok: boolean;
  items: QboItemRow[];
  /** Set when the body could not be read as an item list. The body itself is NEVER in here. */
  parseError: string | null;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/**
 * Parse Intuit's `{ QueryResponse: { Item: [...] } }` body.
 *
 * 🔴 AN EMPTY ITEM LIST AND A FAILED PARSE ARE DIFFERENT FACTS AND MUST NOT RENDER THE SAME
 * (D-9 / A9 — absent is not empty). A QuickBooks company with no items returns
 * `QueryResponse: {}` with NO `Item` key at all, which is a true, readable answer: ok, zero
 * rows. A body we could not read is `ok:false` and says so. Reporting "0 items" for a
 * response we failed to understand would be the confident-label-over-unread-data defect one
 * more time, in the one place whose whole job is reading someone else's books.
 */
export function parseItemList(rawBody: string): ParsedItemList {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { ok: false, items: [], parseError: 'Response was not JSON' };
  }
  const qr = (body as { QueryResponse?: unknown } | null)?.QueryResponse;
  if (qr === null || qr === undefined || typeof qr !== 'object') {
    return { ok: false, items: [], parseError: 'Response carried no QueryResponse' };
  }
  const raw = (qr as { Item?: unknown }).Item;
  // No `Item` key = a real, empty answer (see above). A non-array `Item` is a shape we do not
  // understand, and saying "0 items" about it would be a claim we cannot support.
  if (raw === undefined) return { ok: true, items: [], parseError: null };
  if (!Array.isArray(raw)) {
    return { ok: false, items: [], parseError: 'QueryResponse.Item was not a list' };
  }

  const items: QboItemRow[] = [];
  for (const it of raw as Record<string, unknown>[]) {
    const id = str(it?.Id);
    // An item with no Id cannot be an ItemRef target — which is the ONLY thing we want these
    // for — so it is dropped rather than rendered as a row that looks usable.
    if (!id) continue;
    const income = (it?.IncomeAccountRef ?? null) as { name?: unknown } | null;
    items.push({
      id,
      name: str(it?.Name) ?? '(unnamed)',
      type: str(it?.Type),
      incomeAccount: str(income?.name),
      active: typeof it?.Active === 'boolean' ? (it.Active as boolean) : null,
    });
  }
  return { ok: true, items, parseError: null };
}

/**
 * The name of the raw-capture file. Deterministic and self-describing so a file found six
 * months from now says which company it came from and when — a bare `items.json` in a
 * downloads folder is an unattributable copy of a customer's accounting data.
 *
 * `.json` regardless of what came back: on failure the file holds Intuit's verbatim error
 * body, which is the artifact worth keeping (a 401 names the refresh path, a 403 names the
 * scope) and is JSON too.
 */
export function rawCaptureFileName(realmId: string, at: Date): string {
  const stamp = at.toISOString().replace(/[:.]/g, '-');
  const realm = String(realmId || 'unknown-realm').replace(/[^A-Za-z0-9_-]/g, '');
  return `qbo-items-${realm || 'unknown-realm'}-${stamp}.json`;
}

export interface FailureNote {
  /** What the operator is told. Never contains the body — the body goes to the file. */
  headline: string;
  /** Which Stage-0 finding this status points at, so the next step is not a guess. */
  points_at: 'G3-token-refresh' | 'G2-scope' | 'connection' | 'unclassified';
}

/**
 * Turn an HTTP status into the next action, because 401 and 403 are DIFFERENT PROBLEMS and a
 * generic "the read failed" sends someone hunting the wrong one. Stage 0 named both in
 * advance; this is that naming, mechanised.
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
