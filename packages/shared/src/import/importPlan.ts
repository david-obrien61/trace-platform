// ============================================================
// importPlan — turn mapped CSV rows + the tenant's catalog into a PLAN of per-row verdicts.
//
// PURPOSE:      The second pure half of CSV catalog import (columnMap is the first). Given rows
//               already projected through the confirmed column mapping, plus the tenant's
//               business_inventory rows and which lots carry a physical count, decide for EACH
//               row exactly what it would do — and write NOTHING. The surface renders this and
//               only on Accept does the caller execute it. Same shape as reconcileMath.ts /
//               countPromote.ts: a pure decision, provable without a database.
//
// REUSE, NOT A SECOND MATCHER (STD-011 — the prompt's explicit instruction):
//   • name/size resolution → the SAME primitives resolveStockLine uses: nameTokenSet +
//     tokenSetsEqual (L4 token equality) and detectSizeCollision (L5 size-picker).
//   • the FILL / UPDATE / CREATE branch → resolveCountTarget (D-49). A CSV row and a physical
//     count both resolve a (variety × size, qty) onto the catalog; the branch rule is one rule.
//     This module is a DIFFERENT CALLER of that rule, adding the overlays a count does not have:
//     a SKU-exact fast path, AMBIGUOUS (owner disambiguates), and CONFLICT (never overwrite a
//     physical count without an explicit per-row say-so — David's ruling 2026-07-23).
//   • SKU lineage / grouping → variantGroupSlug (via resolveCountTarget's regroup).
//
// D-9:   $0.00 and blank prices are BOTH unknown (null), never 0; a blank qty is unknown, never
//        0 — it does not zero a lot. An unknown price never overwrites a known one.
// D-52:  a verdict touches ON-HAND only through qtyTo (executed by the ledger RPCs); it never
//        computes committed or available.
//
// DEPENDENCIES: canonicalName · stockLineResolver (detectSizeCollision, StockLineRow) ·
//               countPromote (resolveCountTarget) · variantGroup (variantGroupSlug). No DB/React.
// OUTPUTS:      projectRows · resolveImportPlan → ImportPlan.
// ============================================================
import { nameTokenSet, tokenSetsEqual } from '../utils/canonicalName';
import { detectSizeCollision, type StockLineRow } from '../inventory/stockLineResolver';
import { resolveCountTarget, type CountSibling } from '../inventory/countPromote';
import { variantGroupSlug } from '../inventory/variantGroup';
import type { ColumnMapping } from './columnMap';

// ── The row as interpreted through the confirmed mapping ────────────────────────
export interface MappedRow {
  rowIndex: number;                     // 1-based data-row number, for the owner
  name: string | null;
  size: string | null;
  qty: number | null;                   // null = unknown (blank/unparseable) — NEVER 0 (D-9)
  sku: string | null;
  sellPrice: number | null;             // null = unknown ($0.00 AND blank → null) (D-9)
  priceBasis: string | null;            // the file-level answer (null = "don't know")
  attributes: Record<string, string>;   // kept columns, keyed by their own header, verbatim
}

// ── The plan ────────────────────────────────────────────────────────────────────
export type ImportVerdict = 'FILL' | 'UPDATE' | 'CREATE' | 'AMBIGUOUS' | 'CONFLICT' | 'REFUSED';

export interface FieldDelta { field: string; from: string | null; to: string | null; }

export interface ImportRowPlan {
  rowIndex: number;
  name: string | null;
  size: string | null;
  verdict: ImportVerdict;
  reason: string;                       // a human sentence — the WHY, in the owner's words
  lotId?: string;                       // FILL / UPDATE / CONFLICT target
  create?: { name: string; size: string; variantGroup: string; sku: string | null; regroup: string[] };
  qtyFrom?: number | null;              // current on-hand of the target
  qtyTo?: number | null;                // the CSV's on-hand
  qtyChanges: boolean;                  // is there a real qty movement to make?
  fieldDeltas: FieldDelta[];            // size/price/basis/attributes old → new, for display
  patch: Record<string, unknown>;       // the exact non-qty patch to persist (never includes qty)
  candidates?: { lotId: string; size: string | null }[];  // AMBIGUOUS — the sizes to pick from
}

export interface ImportPlan {
  rows: ImportRowPlan[];
  counts: Record<ImportVerdict, number>;
}

const S = (v: string | null | undefined) => (v ?? '').trim();
const money = (n: number | null | undefined) => (n == null ? null : `$${n.toFixed(2)}`);

/** Parse a raw cell to an integer qty. Blank/unparseable → null (unknown), never 0 (D-9). */
export function parseQty(raw: string): number | null {
  const t = S(raw);
  if (t === '') return null;
  return /^\d+$/.test(t) ? parseInt(t, 10) : null;
}

/** Parse a raw price cell. Blank AND $0.00 → null (unknown, not free — D-9). */
export function parsePrice(raw: string): number | null {
  const t = S(raw).replace(/[$,\s]/g, '');
  if (t === '') return null;
  const n = Number(t);
  if (!isFinite(n) || n <= 0) return null;   // $0.00 → null: unknown, never "free"
  return n;
}

/**
 * Project parsed CSV rows through the confirmed column mapping into MappedRows. `fileBasis` is the
 * single file-level price-basis answer (null = "don't know" → written as NULL, not a guess).
 * Only CONFIRMED mappings apply: an unconfirmed L3 proposal is NOT treated as a spine field.
 */
export function projectRows(
  parsedRows: string[][],
  mappings: ColumnMapping[],
  fileBasis: string | null,
): MappedRow[] {
  const spineAt = (target: string) =>
    mappings.find(m => m.target === target && !m.proposed)?.index ?? -1;
  const iName = spineAt('name'), iSize = spineAt('size'), iQty = spineAt('qty');
  const iSku = spineAt('sku'), iPrice = spineAt('sell_price');
  const attrCols = mappings.filter(m => m.target === 'attribute');

  return parsedRows.map((cells, r): MappedRow => {
    const at = (i: number) => (i >= 0 ? (cells[i] ?? '') : '');
    const attributes: Record<string, string> = {};
    for (const m of attrCols) {
      const v = S(cells[m.index]);
      if (v !== '') attributes[m.header] = v;    // verbatim; blanks are simply absent
    }
    return {
      rowIndex: r + 1,
      name: S(at(iName)) || null,
      size: S(at(iSize)) || null,
      qty: parseQty(at(iQty)),
      sku: S(at(iSku)) || null,
      sellPrice: parsePrice(at(iPrice)),
      priceBasis: fileBasis,
      attributes,
    };
  });
}

const zero = (): Record<ImportVerdict, number> =>
  ({ FILL: 0, UPDATE: 0, CREATE: 0, AMBIGUOUS: 0, CONFLICT: 0, REFUSED: 0 });

/**
 * Resolve every mapped row against the catalog into a plan. Pure — no DB, no side effects.
 *
 * @param catalog        the tenant's business_inventory rows (business_id-scoped by the caller).
 * @param countedLotIds  lot ids that carry a physical count (a `count_reconcile` ledger event) —
 *                        the CONFLICT signal. Computed by the caller from the ledger.
 */
export function resolveImportPlan(params: {
  rows: MappedRow[];
  catalog: StockLineRow[];
  countedLotIds: Set<string>;
}): ImportPlan {
  const { rows, catalog, countedLotIds } = params;
  const plans = rows.map(row => resolveRow(row, catalog, countedLotIds));
  const counts = zero();
  for (const p of plans) counts[p.verdict]++;
  return { rows: plans, counts };
}

/**
 * Resolve one mapped row against ONE chosen lot (an AMBIGUOUS pick the owner made in the surface),
 * reusing the exact same UPDATE-vs-CONFLICT decision + patch as the automatic path. Keeps the
 * surface from re-spelling the decision (STD-011).
 */
export function planAgainstLot(row: MappedRow, lot: StockLineRow, counted: Set<string>): ImportRowPlan {
  return decideAgainstLot(row, lot, counted, `Matched "${lot.name}"${lot.size ? ` (${lot.size})` : ''}.`);
}

function resolveRow(row: MappedRow, catalog: StockLineRow[], counted: Set<string>): ImportRowPlan {
  const base = {
    rowIndex: row.rowIndex, name: row.name, size: row.size,
    qtyChanges: false, fieldDeltas: [] as FieldDelta[], patch: {} as Record<string, unknown>,
  };
  const refuse = (reason: string): ImportRowPlan => ({ ...base, verdict: 'REFUSED', reason });

  const name = S(row.name);
  if (!name) return refuse('This row has no plant name — there is nothing to import it as.');

  // ── SKU-exact fast path — the most specific identity. A SKU names ONE lot. ──────
  const skuHit = row.sku
    ? catalog.find(r => S(r.sku).toLowerCase() === S(row.sku).toLowerCase() && S(r.sku) !== '')
    : undefined;
  if (skuHit) return decideAgainstLot(row, skuHit, counted, `Matched by item # ${row.sku}.`);

  // ── Name family (L4 token equality) ─────────────────────────────────────────────
  const key = nameTokenSet(name);
  const family = catalog.filter(r => tokenSetsEqual(nameTokenSet(r.name), key));

  // A family that cannot be told apart by size (mixed/empty groups, duplicate sizes) — do not
  // guess which row (the resolveStockLine miss:ambiguous case).
  if (family.length > 1 && !detectSizeCollision(family)) {
    return { ...base, verdict: 'AMBIGUOUS',
      reason: `"${name}" matches ${family.length} rows that can't be told apart by size — pick one or skip.`,
      candidates: family.map(f => ({ lotId: f.id, size: f.size })) };
  }

  // Blank size but an existing family with sizes → the owner picks WHICH size (card 8, Alley Cat).
  const sizedCandidates = family
    .filter(f => S(f.size) !== '')
    .map(f => ({ lotId: f.id, size: f.size }));
  if (S(row.size) === '' && family.length >= 1) {
    if (sizedCandidates.length === 0) {
      return refuse(`"${name}" needs a size — the CSV row left it blank and the catalog row has none either.`);
    }
    return { ...base, verdict: 'AMBIGUOUS',
      reason: `"${name}" has no size in the CSV — which size is this? ${sizedCandidates.map(c => c.size).join(' · ')}`,
      candidates: sizedCandidates };
  }

  // ── The D-49 branch (FILL / UPDATE / CREATE / refuse), reused verbatim ───────────
  const groupKey = family.find(f => S(f.variant_group) !== '')?.variant_group ?? variantGroupSlug(name);
  const siblings: CountSibling[] = family.map(f => ({
    id: f.id, size: f.size, qty: f.qty, variant_group: f.variant_group, sku: f.sku,
  }));
  const target = resolveCountTarget({ siblings, groupKey, size: row.size });

  switch (target.action) {
    case 'update': {
      const lot = family.find(f => f.id === target.rowId)!;
      return decideAgainstLot(row, lot, counted, `Matched "${lot.name}"${lot.size ? ` (${lot.size})` : ''}.`);
    }
    case 'fill': {
      const lot = family.find(f => f.id === target.rowId)!;
      return decideAgainstLot(row, lot, counted, `Filling the "${lot.name}" placeholder with its first size + stock.`, target.size);
    }
    case 'create': {
      const p = buildPatch(row, null);
      return { ...base, verdict: 'CREATE',
        reason: `New: "${name}"${row.size ? ` (${row.size})` : ''}.`,
        create: { name, size: target.size, variantGroup: target.variantGroup, sku: target.sku, regroup: target.regroup },
        qtyFrom: 0, qtyTo: row.qty, qtyChanges: (row.qty ?? 0) > 0,
        fieldDeltas: createDeltas(row, target.size), patch: p };
    }
    case 'refuse':
      return refuse(`"${name}" needs a size — a lot has to say which size it is (the count size rule).`);
    default:  // 'record-only' — unreachable for import (a name always yields a groupKey), fail safe
      return refuse(`"${name}" could not be resolved to a lot safely.`);
  }
}

/** Decide UPDATE vs CONFLICT against a specific existing lot, and build its field patch. */
function decideAgainstLot(
  row: MappedRow, lot: StockLineRow, counted: Set<string>, matchReason: string, fillSize?: string,
): ImportRowPlan {
  const current = lot.qty ?? 0;
  const qtyKnown = row.qty != null;
  const qtyChanges = qtyKnown && row.qty !== current;
  const patch = buildPatch(row, lot, fillSize);
  const fieldDeltas = updateDeltas(row, lot, fillSize);

  const common = {
    rowIndex: row.rowIndex, name: row.name, size: row.size, lotId: lot.id,
    qtyFrom: current, qtyTo: row.qty, qtyChanges, fieldDeltas, patch,
  };

  // CONFLICT — a physically-counted lot whose count the CSV disagrees with. Held; never
  // overwritten without an explicit per-row say-so (David's ruling 2026-07-23).
  if (qtyChanges && counted.has(lot.id)) {
    return { ...common, verdict: 'CONFLICT',
      reason: `"${lot.name}" was physically counted at ${current}; the CSV says ${row.qty}. It will NOT overwrite the count unless you say so on this row.` };
  }

  const verdict: ImportVerdict = fillSize ? 'FILL' : 'UPDATE';
  return { ...common, verdict, reason: matchReason };
}

/** The non-qty patch to persist (price/basis/attributes/size). NEVER includes qty (a movement). */
function buildPatch(row: MappedRow, lot: StockLineRow | null, fillSize?: string): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  // Price: only when KNOWN — an unknown ($0.00/blank) price never overwrites a known one (D-9).
  if (row.sellPrice != null && row.sellPrice !== (lot?.sell_price ?? null)) {
    patch.sell_price = row.sellPrice;
    if (row.priceBasis != null) patch.price_basis = row.priceBasis;   // the D-9 pair
  }
  // Size: set on a fill, or when the lot has none and the CSV supplies one — never overwrite an
  // existing size silently.
  const setSize = fillSize ?? (lot && S(lot.size) === '' && S(row.size) !== '' ? S(row.size) : undefined);
  if (setSize) patch.size = setSize;
  // Attributes: MERGE into any existing bag (a prior import's descriptive fields survive).
  if (Object.keys(row.attributes).length > 0) {
    patch.attributes = { ...(lot?.attributes ?? {}), ...row.attributes };
  }
  return patch;
}

function updateDeltas(row: MappedRow, lot: StockLineRow, fillSize?: string): FieldDelta[] {
  const d: FieldDelta[] = [];
  const setSize = fillSize ?? (S(lot.size) === '' && S(row.size) !== '' ? S(row.size) : undefined);
  if (setSize) d.push({ field: 'size', from: lot.size ?? null, to: setSize });
  if (row.sellPrice != null && row.sellPrice !== (lot.sell_price ?? null)) {
    d.push({ field: 'sell_price', from: money(lot.sell_price), to: money(row.sellPrice) });
    if (row.priceBasis != null) d.push({ field: 'price_basis', from: lot.price_basis ?? null, to: row.priceBasis });
  }
  const n = Object.keys(row.attributes).length;
  if (n > 0) d.push({ field: 'attributes', from: null, to: `${n} descriptive field${n === 1 ? '' : 's'}` });
  return d;
}

function createDeltas(row: MappedRow, size: string): FieldDelta[] {
  const d: FieldDelta[] = [{ field: 'size', from: null, to: size }];
  if (row.qty != null) d.push({ field: 'qty', from: null, to: String(row.qty) });
  if (row.sellPrice != null) {
    d.push({ field: 'sell_price', from: null, to: money(row.sellPrice) });
    if (row.priceBasis != null) d.push({ field: 'price_basis', from: null, to: row.priceBasis });
  }
  const n = Object.keys(row.attributes).length;
  if (n > 0) d.push({ field: 'attributes', from: null, to: `${n} descriptive field${n === 1 ? '' : 's'}` });
  return d;
}
