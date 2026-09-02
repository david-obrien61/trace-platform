// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: read a saved QuickBooks capture file BACK, so a books review can be driven from a
//   file instead of from a live connection. David must be able to see exactly what Lauren will
//   see — same screens, same order, same sentences — without being the first person to run the
//   import against LAWNS, because if he runs it first there is nothing left for her to show him.
// DEPENDENCIES: ./qboRead (QBO_ENTITIES · qboCountQuery · parseCount · parseRows · completeness).
//   Pure: no db, no network, no env, no clock it did not receive, no DOM.
// OUTPUTS: CaptureReplay · ReplayRefusal · ReplayResult · readCaptureFile · REPLAY_SOURCE.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 A FILE REPLACES A CONNECTION, NOT A CODE PATH.
// ══════════════════════════════════════════════════════════════════════════════════════════
// This module deliberately does NOT parse items, customers or invoices. It hands back the
// verbatim ROW BODIES and lets the same `parseItemList` / `parseCustomerList` /
// `parseInvoiceList` / `summarise*` functions that serve the live read do the work downstream.
// A second parsing path for files would be a second representation of one fact (STD-011), and
// it is always the copy nobody exercises that drifts — which would make the preview a preview
// of something other than what Lauren gets, i.e. the one thing this harness exists to prevent.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE FILE DOOR IS GATED STRICTLY HARDER THAN THE LIVE DOOR, AND THAT IS THE DESIGN.
// ══════════════════════════════════════════════════════════════════════════════════════════
// The live path counts its own pages as it walks them, so it may trust its own arithmetic. A
// file arrived from a disk. It can be hand-edited, truncated by a failed download, assembled
// by someone helpful, or simply be the wrong file. So every number in it is treated as a CLAIM
// and re-derived from the page bodies underneath it:
//
//   ① `complete: true` is NEVER read as an answer.  `completeness()` is re-run.
//   ② `expected_total` is checked against the COUNT PAGE'S OWN BODY (`parseCount`).
//   ③ `retrieved_total` is checked against the rows that are ACTUALLY THERE (`parseRows`).
//
// A file whose header disagrees with its own pages is refused by name rather than loaded with
// a warning — a warning above a table gets read as a footnote to the table, which is the exact
// defect (#229's 100 rows presented as 1,127) the counting-first design exists to prevent.
//
// ⚠️ THE COUNT PAGE IS PAGE ZERO AND IT IS NOT A PAGE OF ROWS. `readAllPages` pushes the
// `select count(*)` response into `pages` alongside the row pages. Parsing it as rows yields
// zero rows and would therefore be SILENT — it would not break anything, it would just make
// every re-count one page's worth of nothing. It is identified by its DERIVED query string
// (`qboCountQuery(entity)`), never by its position in the array, because position is an
// assumption about a writer this module does not control.
// ─────────────────────────────────────────────────────────────────────────────
import {
  QBO_ENTITIES, qboCountQuery, parseCount, parseRows, completeness,
  type QboEntity,
} from './qboRead';

/** Stamped onto a replayed read so a screen can never quietly present a file as a live pull. */
export const REPLAY_SOURCE = 'capture-file' as const;

export interface ReplayRefusal {
  ok: false;
  /** Which refusal. Named, so the next step is not a guess — the live path's own discipline. */
  code:
    | 'NOT_JSON'         // the text on disk was not JSON at all
    | 'NOT_A_CAPTURE'    // JSON, but not a capture envelope
    | 'UNKNOWN_ENTITY'   // no `entity`, or one this platform does not read
    | 'NO_PAGES'         // no pages array, or an empty one
    | 'NO_COUNT_PAGE'    // the count page is missing — completeness is unprovable
    | 'UNREADABLE_PAGE'  // a row page did not come back 200, or did not parse
    | 'COUNT_DISAGREES'  // header `expected_total` != the count page's own body
    | 'ROWS_DISAGREE'    // header `retrieved_total` != the rows actually present
    | 'INCOMPLETE';      // expected != retrieved — the live refusal, re-run over the file
  headline: string;
}

export interface CaptureReplay {
  ok: true;
  source: typeof REPLAY_SOURCE;
  entity: QboEntity;
  realmId: string;
  queriedAt: string | null;
  /** Re-derived and agreed by all three of: header, count page, row pages. */
  expectedTotal: number;
  retrievedTotal: number;
  /** The row-page bodies, verbatim and in file order. The count page is NOT among them. */
  rowBodies: string[];
  /** Row pages only — the count page is excluded, so this is not `pages.length`. */
  rowPageCount: number;
}

export type ReplayResult = CaptureReplay | ReplayRefusal;

const refuse = (code: ReplayRefusal['code'], headline: string): ReplayRefusal =>
  ({ ok: false, code, headline });

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Read one capture file.
 *
 * `parsed` is the already-`JSON.parse`d file, or the raw text. Text is accepted so the caller
 * does not have to duplicate the try/catch that distinguishes "not JSON" from "not a capture" —
 * two different problems that a caller collapsing them would report as one wrong sentence.
 */
export function readCaptureFile(parsed: unknown): ReplayResult {
  let root: unknown = parsed;
  if (typeof root === 'string') {
    try { root = JSON.parse(root); }
    catch { return refuse('NOT_JSON', 'That file is not JSON. Choose a file saved by this screen — its name starts with “qbo-”.'); }
  }
  if (!isObj(root)) {
    return refuse('NOT_A_CAPTURE', 'That file does not look like a saved QuickBooks read.');
  }

  // ── the envelope ───────────────────────────────────────────────────────────
  const entity = root.entity;
  if (typeof entity !== 'string' || !(QBO_ENTITIES as readonly string[]).includes(entity)) {
    return refuse('UNKNOWN_ENTITY',
      `That file does not say which kind of record it holds, so it cannot be read back. Expected one of: ${QBO_ENTITIES.join(', ')}.`);
  }
  const ent = entity as QboEntity;

  const pages = root.pages;
  if (!Array.isArray(pages) || pages.length === 0) {
    return refuse('NO_PAGES', 'That file holds no pages, so there is nothing to read back.');
  }

  // ── ① split the count page off the row pages, by DERIVED QUERY, never by position ──
  const countQuery = qboCountQuery(ent);
  const countPages = pages.filter(p => isObj(p) && p.query === countQuery);
  const rowPages   = pages.filter(p => isObj(p) && p.query !== countQuery);

  if (countPages.length === 0) {
    return refuse('NO_COUNT_PAGE',
      'That file has no record of how many rows QuickBooks said there were, so it cannot be proven to be the whole list. It will not be read back.');
  }

  // ── ② the header's expected total must agree with the count page's own body ──
  const countBody = (countPages[0] as Record<string, unknown>).body;
  const counted = parseCount(typeof countBody === 'string' ? countBody : '');
  if (!counted.ok || counted.total === null) {
    return refuse('NO_COUNT_PAGE',
      'The saved count could not be read, so this file cannot be proven complete. It will not be read back.');
  }
  const headerExpected = root.expected_total;
  if (typeof headerExpected === 'number' && headerExpected !== counted.total) {
    return refuse('COUNT_DISAGREES',
      `This file disagrees with itself: it says QuickBooks reported ${headerExpected.toLocaleString()}, but the saved count says ${counted.total.toLocaleString()}. It will not be read back.`);
  }

  // ── ③ re-count the rows that are ACTUALLY THERE ────────────────────────────
  const rowBodies: string[] = [];
  let retrieved = 0;
  for (const p of rowPages) {
    const page = p as Record<string, unknown>;
    const status = page.http_status;
    if (typeof status === 'number' && status !== 200) {
      return refuse('UNREADABLE_PAGE',
        `One of the saved pages is a failure, not a page of records (it came back ${status}). This file is not a complete read and will not be read back.`);
    }
    const body = typeof page.body === 'string' ? page.body : '';
    const rows = parseRows(body, ent);
    if (!rows.ok) {
      return refuse('UNREADABLE_PAGE',
        `One of the saved pages could not be read (${rows.parseError ?? 'unreadable'}). This file will not be read back.`);
    }
    rowBodies.push(body);
    retrieved += rows.rows.length;
  }

  const headerRetrieved = root.retrieved_total;
  if (typeof headerRetrieved === 'number' && headerRetrieved !== retrieved) {
    return refuse('ROWS_DISAGREE',
      `This file disagrees with itself: it says ${headerRetrieved.toLocaleString()} records were retrieved, but ${retrieved.toLocaleString()} are actually in it. It will not be read back.`);
  }

  // ── ④ the live completeness refusal, re-run over the file's own numbers ─────
  // NOT `root.complete`. A boolean in a file is a claim about a check, not the check.
  const verdict = completeness(counted.total, retrieved);
  if (!verdict.complete) {
    return refuse('INCOMPLETE', verdict.headline);
  }

  return {
    ok: true,
    source: REPLAY_SOURCE,
    entity: ent,
    realmId: typeof root.realm_id === 'string' ? root.realm_id : 'unknown-realm',
    queriedAt: typeof root.queried_at === 'string' ? root.queried_at : null,
    expectedTotal: counted.total,
    retrievedTotal: retrieved,
    rowBodies,
    rowPageCount: rowBodies.length,
  };
}
