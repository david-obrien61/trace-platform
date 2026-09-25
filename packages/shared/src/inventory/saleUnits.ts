// ============================================================
// saleUnits — ONE ITEM, HELD IN ONE UNIT, SOLD IN SEVERAL.
//
// PURPOSE:      LAWNS blends one pile of planting mix and sells it five ways — a 1 Yard Scoop, a
//               1/2 Yard Scoop, and 15/30/45 gallon Buckets. Today those are FIVE SEPARATE STOCK
//               ROWS with five separate counts, so selling a bucket moves a number that has nothing
//               to do with the pile, and no screen can answer "how much mix is there?"
//
//               This module is the item-master standard: a BASE item held in ONE stocking unit, and
//               every sale unit a CONVERSION of it. Selling any unit draws the base; on-hand is one
//               figure. It holds no numbers of its own and reads no database — the conversions are
//               tenant config, and the yards⇄gallons factor is the caller's `trueGallonsPerCubicYard`.
//
// 🔴 A MISSING CONVERSION IS A REFUSAL, NEVER A 1:1 GUESS. `drawForSale` returns a sentence, not a
//    quantity, when a sale item has no conversion. A default of 1 would silently take one gallon
//    off the pile for a 45-gallon bucket — wrong by 45×, and invisible. D-9 / A9: absent is not
//    empty, and this is the one place in the package where a guess would be cheapest to write.
//
// 🔴 KEYED ON `qb_item_id`, NEVER AN INTERNAL ROW ID (STD-019). LAWNS's catalogue is RECREATED by
//    the QuickBooks reload, so every `business_inventory.id` changes. A conversion keyed on a row id
//    is a conversion that dies on the wipe and takes the pile's identity with it.
//    ⚠️ MEASURED 2026-09-25: `sku` is NULL on all ten of LAWNS's mix rows, so `sku` cannot be the
//    key either — the prompt that asked for `SFCM1`/`FCMB15` named SKUs that do not exist. Only
//    `qb_item_id` is populated (52 · 51 · 40 · 41 · 42 for the Fertile family).
//
// DEPENDENCIES: ./unitOfMeasure (parseUnitOfMeasure — the ONE place a size label is interpreted;
//               reused rather than re-parsed, §6 r8). Otherwise PURE — no db, no clock, no env.
// OUTPUTS:      SaleUnit · SaleUnitResolution · OnHandInBase · SaleUnitProposal ·
//               drawForSale · chainProblem · onHandInBase · inDisplayUnit · proposeSaleUnits ·
//               SALE_UNIT_COLUMNS · SALE_UNIT_SELECT.
//
// AC-1: no vertical noun. "Mix" appears only in comments describing why this exists; the code says
//       base item, sale unit and quantity. A hardware shop selling rope by the foot and the coil is
//       the same shape.
// STORY: user_stories.md → *Is there enough mix for Saturday?*
// ============================================================

import { parseUnitOfMeasure } from './unitOfMeasure';

/** The five columns `item_sale_units` owns, in one place so the select and the writers cannot drift
 *  (#179's lesson: a declarative column list that does not match its migration). */
export const SALE_UNIT_COLUMNS = ['sale_qb_item_id', 'base_qb_item_id', 'base_quantity', 'base_unit', 'because'] as const;
export const SALE_UNIT_SELECT = SALE_UNIT_COLUMNS.join(', ');

/** One sale unit, and what ONE of it is worth in the base item's stocking unit. */
export interface SaleUnit {
  saleQbItemId: string;
  baseQbItemId: string;
  /** How many base units ONE of this sale unit is. A 45 gal bucket off a gallon-held pile is 45. */
  baseQuantity: number;
  /** The base item's stocking unit — 'gal' for a pile held in gallons. Display is a separate question. */
  baseUnit: string;
  /** Where this figure came from, in words. Never blank: a conversion nobody can explain is one
   *  nobody should trust, and this is the field a person reads when the arithmetic surprises them. */
  because: string;
}

/** A draw against the base, or a refusal that says why. There is deliberately no third state. */
export type SaleUnitResolution =
  | { ok: true; baseQbItemId: string; baseQuantity: number; baseUnit: string; isBaseItself: boolean; because: string }
  | { ok: false; reason: string };

export interface OnHandInBase {
  baseQbItemId: string;
  /** The single figure. Null when no row for the base item was supplied — which is NOT zero. */
  baseQuantity: number | null;
  /** Rows that carried a real count, and rows that did not. A figure resting on placeholders is not
   *  a measurement, and the caller must be able to say so (`qty_basis`, ledger #393). */
  countedRows: number;
  uncountedRows: number;
  /** The sale rows that still hold a separate quantity of their own. NEVER merged into the figure —
   *  those counts are somebody's, and folding them in silently would invent a total nobody counted. */
  strandedSaleRows: Array<{ qbItemId: string; qty: number; name: string }>;
}

/** A conversion proposed from a product NAME, for a person to accept or correct. Never written. */
export interface SaleUnitProposal {
  saleQbItemId: string;
  name: string;
  baseQuantity: number | null;
  baseUnit: string;
  because: string;
  /** True when the name could not be read. The row is still LISTED — a silent omission would make
   *  a sale unit nobody configured look like one nobody sells (the load list's own rule). */
  unreadable: boolean;
}

/**
 * 🔴 ONE LEVEL ONLY — A CHAIN WOULD DOUBLE-CONVERT, SILENTLY.
 *
 * If a 1/2 Yard Scoop converts to the 1 Yard Scoop, and the 1 Yard Scoop converts to the pile, then
 * drawing for a half-yard sale either stops one hop short or multiplies twice, depending on which
 * caller reads it. Both are wrong and neither raises anything. So a base item may be a sale unit OF
 * ITSELF (factor = its own size, which is the ordinary item-master case) but may NOT convert to a
 * DIFFERENT base. Enforced here for the editor and by a trigger in the database for everything else.
 */
export function chainProblem(units: readonly SaleUnit[]): string | null {
  const byId = new Map(units.map(u => [u.saleQbItemId, u]));
  for (const u of units) {
    if (u.baseQbItemId === u.saleQbItemId) continue;      // a base item as its own sale unit — fine
    const target = byId.get(u.baseQbItemId);
    if (target && target.baseQbItemId !== u.baseQbItemId) {
      return `Item ${u.saleQbItemId} converts to ${u.baseQbItemId}, which itself converts to `
        + `${target.baseQbItemId}. A sale unit must point straight at the item that holds the stock, `
        + `or the quantity gets converted twice.`;
    }
  }
  return null;
}

/**
 * What one sale takes off the base item. `quantitySold` is in SALE units (two buckets → 2).
 * A sale item with no conversion returns a REFUSAL naming the item — never a 1:1 fallback.
 */
export function drawForSale(
  saleQbItemId: string | null | undefined,
  quantitySold: number,
  units: readonly SaleUnit[],
): SaleUnitResolution {
  if (!saleQbItemId) {
    return { ok: false, reason: 'This line has no QuickBooks item, so there is nothing to convert from.' };
  }
  if (!Number.isFinite(quantitySold) || quantitySold <= 0) {
    return { ok: false, reason: `Say how many were sold — ${JSON.stringify(quantitySold)} is not a quantity.` };
  }
  const u = units.find(x => x.saleQbItemId === saleQbItemId);
  if (!u) {
    return { ok: false, reason: `Item ${saleQbItemId} is not set up as a sale unit of anything, so a sale of it cannot draw stock. Set its conversion first.` };
  }
  if (!(u.baseQuantity > 0)) {
    return { ok: false, reason: `Item ${saleQbItemId} has a conversion of ${u.baseQuantity}, which cannot be used. One of it must be worth more than nothing.` };
  }
  return {
    ok: true,
    baseQbItemId: u.baseQbItemId,
    baseQuantity: u.baseQuantity * quantitySold,
    baseUnit: u.baseUnit,
    isBaseItself: u.baseQbItemId === u.saleQbItemId,
    because: u.because,
  };
}

/**
 * The ONE on-hand figure for a base item, plus what it is resting on.
 *
 * 🔴 IT DOES NOT ADD THE SALE ROWS UP. LAWNS's five Fertile rows hold 1 · 10 · 10 · 10 · 10 today,
 * every one of them `qty_basis = 'placeholder'` — catalogue-import seed values, not counts. Summing
 * them through the conversions would produce a confident total nobody measured. They are returned
 * as `strandedSaleRows` so a screen can SHOW them and a person can decide.
 */
export function onHandInBase(
  baseQbItemId: string,
  rows: ReadonlyArray<{ qbItemId: string | null; qty: number | null; name: string; counted: boolean }>,
): OnHandInBase {
  const base = rows.filter(r => r.qbItemId === baseQbItemId);
  const stranded = rows
    .filter(r => r.qbItemId !== baseQbItemId && (r.qty ?? 0) !== 0 && r.qbItemId != null)
    .map(r => ({ qbItemId: r.qbItemId as string, qty: r.qty ?? 0, name: r.name }));
  return {
    baseQbItemId,
    baseQuantity: base.length === 0 ? null : base.reduce((n, r) => n + (r.qty ?? 0), 0),
    countedRows: base.filter(r => r.counted).length,
    uncountedRows: base.filter(r => !r.counted).length,
    strandedSaleRows: stranded,
  };
}

/**
 * The base figure in the unit a person thinks in. A pile is HELD in gallons — because an integer
 * `qty` column cannot hold half a yard (ledger #410) — and READ in yards.
 * `gallonsPerDisplayUnit` is the caller's `trueGallonsPerCubicYard`, never a constant here.
 */
export function inDisplayUnit(
  baseQuantity: number | null,
  baseUnit: string,
  displayUnit: string,
  gallonsPerDisplayUnit: number,
): { value: number | null; text: string } {
  if (baseQuantity == null) return { value: null, text: `not set up — no stock row for this item` };
  if (baseUnit === displayUnit) return { value: baseQuantity, text: `${round2(baseQuantity)} ${displayUnit}` };
  if (baseUnit === 'gal' && !(gallonsPerDisplayUnit > 0)) {
    return { value: null, text: `cannot be shown in ${displayUnit} — no conversion set` };
  }
  if (baseUnit !== 'gal') {
    return { value: null, text: `held in ${baseUnit}, which cannot be shown in ${displayUnit}` };
  }
  const v = baseQuantity / gallonsPerDisplayUnit;
  return { value: v, text: `${round2(v)} ${displayUnit} (${round2(baseQuantity)} ${baseUnit})` };
}

/**
 * Conversions PROPOSED from the product names, for a person to accept or correct. Nothing here is
 * written, and nothing is inferred beyond what the name literally says.
 *
 * ⚠️ MEASURED, NOT ASSUMED (tech-debt #193 says a size at the FRONT of a QuickBooks description is
 * not read — these names are exactly that shape, so it was worth checking): `parseUnitOfMeasure`
 * reads all five of LAWNS's correctly — "1 Yard Scoop: …" → 1 yard, "1/2 Yard Scoop: …" → 0.5 yard,
 * "15gal Bucket: …" → 15 gallon. The buckets come back `kind: 'container'` rather than `volume`,
 * because that parser's job is pot sizes; the VALUE and UNIT are what a conversion needs and both
 * are right, so this reads them rather than "fixing" a parser that serves pots.
 */
export function proposeSaleUnits(
  rows: ReadonlyArray<{ qbItemId: string | null; name: string }>,
  baseUnit: string,
  gallonsPerCubicYard: number,
): SaleUnitProposal[] {
  const out: SaleUnitProposal[] = [];
  for (const r of rows) {
    if (!r.qbItemId) continue;
    const p = parseUnitOfMeasure(r.name);
    const unreadable = p == null || p.value == null || !isVolumeish(p.unit);
    if (unreadable) {
      out.push({ saleQbItemId: r.qbItemId, name: r.name, baseQuantity: null, baseUnit,
        because: `the name "${r.name}" does not state a volume — set this one by hand`, unreadable: true });
      continue;
    }
    const value = p.value as number;
    const inGallons = /^y/.test(p.unit) ? value * gallonsPerCubicYard : value;
    const qty = baseUnit === 'gal' ? inGallons : baseUnit === 'yd' ? inGallons / gallonsPerCubicYard : null;
    out.push({
      saleQbItemId: r.qbItemId, name: r.name,
      baseQuantity: qty == null ? null : round6(qty), baseUnit,
      because: qty == null
        ? `the base is held in ${baseUnit}, which this cannot be converted to — set it by hand`
        : `proposed from the product name: "${r.name}" reads as ${value} ${p.unit}`,
      unreadable: qty == null,
    });
  }
  return out;
}

const isVolumeish = (unit: string) => /^(gal|gallon|y|yard|cubic)/.test(unit);
const round2 = (n: number) => Math.round(n * 100) / 100;
/** 6 dp, not 4. A gallon figure is fine at 4 dp; a YARDS figure is not — a 15 gal bucket off a
 *  yard-held base is 0.0742574 yd, and 4 dp rounds that to 0.0743, an error of 0.06%. A fixed
 *  decimal count is wrong across units, so this keeps enough for the smallest unit anyone sells in.
 *  Found by a probe, not by review: F7 in the test suite is the yard-held case. */
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
