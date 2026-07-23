// ============================================================
// parseCsv — a pure, dependency-free RFC-4180 CSV reader for the catalog-import surface.
//
// PURPOSE:      Turn the raw text of a grower's price-list file into a header row + data rows,
//               correctly, before any mapping or resolution runs. A grower's export is messy by
//               nature — quoted fields with embedded commas and newlines, CRLF from a Windows
//               spreadsheet, a UTF-8 BOM, blank lines, padded cells — and getting THIS wrong
//               silently corrupts everything downstream. So it is its own pure module with its
//               own RED-first test, the same shape reconcileMath.ts uses.
//
// WHY HAND-ROLLED, NOT A LIBRARY (§6 r10, standard-by-value — stated, not assumed):
//   No CSV parser is a dependency of this monorepo (checked every workspace package.json). The
//   established standard here is RFC 4180, and it is a well-understood ~1-state-machine problem.
//   Adding papaparse (~45 KB) would buy encodings and streaming this surface does not need — one
//   owner uploads one small file at a time — at the cost of a new runtime dep + a knip entry.
//   The lighter form suffices; the trigger to converge back to a library is a real need for
//   streaming, delimiter-sniffing, or non-UTF-8 encodings. Every RFC-4180 case the fixture
//   exercises is covered by parseCsv.test.ts.
//
// HANDLES (all proven in parseCsv.test.ts): quoted fields · embedded commas · embedded newlines
//   · escaped quotes ("") · CRLF / CR / LF line endings · a leading UTF-8 BOM · blank lines
//   (skipped) · short rows (padded to header width) · ragged trailing fields.
//
// DEPENDENCIES: none. No DB, no React, no network (a pure function, like reconcileMath).
// OUTPUTS:      parseCsv(text) → { headers, rows }. Field values are preserved VERBATIM (not
//               trimmed) — trimming is a semantic decision the mapping/resolution layer makes
//               where it matters (a name resolves through nameTokenSet, which trims), so the
//               reader keeps fidelity and never decides for a consumer.
// ============================================================

export interface ParsedCsv {
  /** The first non-blank record. */
  headers: string[];
  /** Every non-blank record after the header, each padded to headers.length. */
  rows: string[][];
}

/**
 * Parse CSV text into records. RFC 4180: fields separated by commas, records by CR/LF/CRLF, a
 * field may be double-quoted, and inside quotes a doubled quote ("") is a literal quote and
 * commas/newlines are literal. A leading BOM is stripped. Records that are entirely empty (a
 * blank physical line) are dropped.
 */
function parseRecords(text: string): string[][] {
  // Strip a leading UTF-8 BOM (U+FEFF) — a Windows spreadsheet export routinely carries one,
  // and left on the first header it corrupts that header's name (a BOM-prefixed "Item #" no
  // longer equals "Item #").
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;
  const n = src.length;

  const endField = () => { record.push(field); field = ''; };
  const endRecord = () => { endField(); records.push(record); record = []; };

  while (i < n) {
    const c = src[i];

    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }  // escaped quote
        inQuotes = false; i++; continue;                             // closing quote
      }
      field += c; i++; continue;                                     // literal (comma/newline/…)
    }

    if (c === '"') { inQuotes = true; i++; continue; }               // opening quote
    if (c === ',') { endField(); i++; continue; }
    if (c === '\r') {                                                // CR or CRLF
      endRecord();
      i += src[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    if (c === '\n') { endRecord(); i++; continue; }                  // LF
    field += c; i++;
  }
  // Flush the trailing field/record if the file did not end on a newline.
  if (field !== '' || record.length > 0) endRecord();

  // Drop blank records — a truly empty physical line parses to a single empty field.
  return records.filter(r => !(r.length === 1 && r[0] === ''));
}

export function parseCsv(text: string): ParsedCsv {
  const records = parseRecords(text ?? '');
  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0];
  const width = headers.length;
  const rows = records.slice(1).map(r => {
    if (r.length === width) return r;
    if (r.length < width) return [...r, ...Array(width - r.length).fill('')];  // pad short
    return r.slice(0, width);                                                   // ignore extras
  });
  return { headers, rows };
}
