// ============================================================
// columnMap — the FOUR-RUNG mapping ladder for a grower's CSV headers → the catalog spine.
//
// PURPOSE:      A grower's price-list columns never match ours. Something must decide, per
//               column, whether it is a spine field we OPERATE on (sku · name · size · qty ·
//               sell_price) or DESCRIPTION that just varies by grower (D-24's spine/blob cut).
//               This is that decision, PURE — the reconcileMath.ts / countPromote.ts shape:
//               no DB, no React, a plan the surface renders and the owner overrides.
//
// THE ONE CONFIGURABLE THING (docs/decisions/2026-06-21-grower-import-and-mobile-roles.md §1):
//   the SYNONYM DICTIONARY. It is PLATFORM-WIDE — one dictionary for every tenant, never a
//   per-customer mapping template (§1: "one configurable thing, not N hand-built things"). A
//   new grower does not get a new config; their headers resolve through the same ladder.
//
// THE LADDER (in order; the WINNING rung is carried on every mapping so the owner sees WHY):
//   L1 exact    — the header normalises to a spine field's own name.
//   L2 synonym  — the header normalises to an entry in the shared dictionary.
//   L3 shape    — inferred from the VALUES, not the header (a column of small whole numbers is a
//                 qty candidate; a currency-formatted column is a price candidate). L3 NEVER
//                 auto-applies: it PROPOSES (`proposed: true`) and the human must confirm.
//   L4 unmapped — offered as keep-as-attribute (the default) or ignore. Never guessed.
//
// THE SPINE/BLOB CUT (D-24), enforced downstream by the surface + importPlan, decided here:
//   a column the owner maps to a spine field is spine; a column kept-as-attribute lands in the
//   `attributes` jsonb bag keyed by its OWN header, value verbatim.
//   🔴 A BLOB FIELD MAY NEVER BE MONEY. An unmapped column that looks load-bearing — currency
//   values, or a money header (wholesale/cost/net/landed/…) — is `loadBearing: true`: held in
//   the bag AND flagged "this looks like a real field; nothing will compute on it." Making it a
//   real column is a spine decision + a migration, never something an import invents. (Quantity
//   is surfaced instead via the L3 proposal, so it is never silently bagged either.)
//
// DEPENDENCIES: none. OUTPUTS: SPINE_FIELDS · SYNONYMS · mapColumns · duplicateSpineTargets.
// ============================================================

/** The spine fields an import may fill. `sell_price` pairs with `price_basis` (asked once, in the
 *  surface — D-9); `size` is the existing 20260628 column; qty is written only via the ledger RPCs. */
export type SpineField = 'sku' | 'name' | 'size' | 'qty' | 'sell_price';
export const SPINE_FIELDS: SpineField[] = ['sku', 'name', 'size', 'qty', 'sell_price'];

export type MapTarget = SpineField | 'attribute' | 'ignore';
export type Rung = 'exact' | 'synonym' | 'shape' | 'unmapped';

export interface ColumnMapping {
  index: number;
  header: string;
  /** where this column goes. */
  target: MapTarget;
  /** which rung produced it — shown on screen so the owner sees the reasoning. */
  rung: Rung;
  /** L3 only: a suggestion the owner MUST confirm; it does not auto-apply. */
  proposed: boolean;
  /** an unmapped column that looks like money — flagged, held in the bag, nothing computes on it. */
  loadBearing: boolean;
  /** a few non-blank example values, for the UI. */
  sample: string[];
}

// ── THE SHARED SYNONYM DICTIONARY (platform-wide; seeded from the fixture + obvious siblings) ──
// NB: `ready` is DELIBERATELY NOT a qty synonym. The fixture header `Ready` is the L3 exemplar —
// "a header that carries no meaning" that must be INFERRED from its integer values and CONFIRMED
// (owner-test card 1). Seeding it here would auto-apply it and defeat that proof. `price_basis` is
// not mappable from a column in this build; it is asked once in the surface (its own D-9 question).
export const SYNONYMS: Record<SpineField, string[]> = {
  sku:        ['sku', 'item', 'item no', 'item number', 'code', 'part', 'part no', 'part number', 'id'],
  name:       ['name', 'botanical', 'botanical name', 'variety', 'common name', 'plant', 'plant name', 'item name'],
  size:       ['size', 'cont', 'container', 'gal', 'gallon', 'pot', 'caliper', 'size or container'],
  qty:        ['qty', 'quantity', 'on hand', 'onhand', 'avail', 'available', 'count', 'stock', 'in stock'],
  sell_price: ['price', 'retail', 'list', 'list price', 'each', 'msrp', 'sell price', 'unit price', 'retail price'],
};

/** Normalise a header the same way for both sides of the match: lowercase, punctuation → space,
 *  collapse whitespace. "Item #" → "item", "Cont." → "cont", "Botanical Name" → "botanical name". */
function norm(h: string): string {
  return (h ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// Header words that mark a column as money even when its sample happens to look plain.
const MONEY_HEADER = /\b(wholesale|cost|net|landed|price|retail|list|msrp|margin|markup|each)\b/;

const nonBlank = (v: string) => (v ?? '').trim() !== '';
const moneyLike = (v: string) => {
  const t = (v ?? '').trim();
  return /\$/.test(t) || /^\d{1,3}(,\d{3})*(\.\d{1,2})$/.test(t) || /^\d+\.\d{1,2}$/.test(t);
};
const intLike = (v: string) => /^\d+$/.test((v ?? '').trim());

/** Does a MAJORITY of the non-blank sample match the predicate? (a single stray cell shouldn't
 *  flip the shape). Returns false when there is nothing to judge. */
function majority(vals: string[], pred: (v: string) => boolean): boolean {
  const seen = vals.filter(nonBlank);
  if (seen.length === 0) return false;
  return seen.filter(pred).length >= Math.ceil(seen.length / 2);
}

/**
 * Build the initial per-column mapping for a header row + the column-wise sample values.
 * PURE — the surface renders this and lets the owner override ANY row (including an L1 exact).
 *
 * @param headers      the CSV header record.
 * @param columnSample values per column (columnSample[i] = a few example values from column i).
 */
export function mapColumns(headers: string[], columnSample: string[][]): ColumnMapping[] {
  const sampleOf = (i: number) => (columnSample[i] ?? []).filter(nonBlank).slice(0, 5);

  // Pass 1 — L1 exact + L2 synonym. These CLAIM a spine field so L3 cannot propose a taken one.
  const claimed = new Set<SpineField>();
  const base: ColumnMapping[] = headers.map((header, index) => {
    const h = norm(header);
    const sample = sampleOf(index);

    // L1 exact — header normalises to a field's own token.
    const exact = SPINE_FIELDS.find(f => h === f || (f === 'sell_price' && h === 'sell price'));
    if (exact && !claimed.has(exact)) {
      claimed.add(exact);
      return { index, header, target: exact, rung: 'exact', proposed: false, loadBearing: false, sample };
    }
    // L2 synonym.
    const syn = SPINE_FIELDS.find(f => !claimed.has(f) && SYNONYMS[f].includes(h));
    if (syn) {
      claimed.add(syn);
      return { index, header, target: syn, rung: 'synonym', proposed: false, loadBearing: false, sample };
    }
    // defer L3/L4 to pass 2 (needs the final `claimed` set).
    return { index, header, target: 'attribute', rung: 'unmapped', proposed: false, loadBearing: false, sample };
  });

  // Pass 2 — L3 shape (proposes, respects claims) then L4 unmapped (+ load-bearing money flag).
  return base.map(m => {
    if (m.rung !== 'unmapped') return m;   // already L1/L2
    const { sample } = m;

    // L3 — infer from values. Propose ONLY an unclaimed target; NEVER auto-apply.
    if (majority(sample, intLike) && !majority(sample, moneyLike) && !claimed.has('qty')) {
      claimed.add('qty');
      return { ...m, target: 'qty', rung: 'shape', proposed: true };
    }
    if (majority(sample, moneyLike) && !claimed.has('sell_price')) {
      claimed.add('sell_price');
      return { ...m, target: 'sell_price', rung: 'shape', proposed: true };
    }

    // L4 — unmapped. Flag it load-bearing if it looks like money (values OR a money header): the
    // bag will hold it, but the owner is told nothing computes on it (🔴 the Wholesale case).
    const loadBearing = majority(sample, moneyLike) || MONEY_HEADER.test(norm(m.header));
    return { ...m, target: 'attribute', rung: 'unmapped', proposed: false, loadBearing };
  });
}

/**
 * Which spine fields are targeted by MORE THAN ONE column (an owner override can create this).
 * The surface uses it to block an Accept that would write two columns into one field. Proposed
 * (unconfirmed L3) columns do not count until confirmed.
 */
export function duplicateSpineTargets(mappings: ColumnMapping[]): SpineField[] {
  const counts = new Map<SpineField, number>();
  for (const m of mappings) {
    if (m.target === 'attribute' || m.target === 'ignore') continue;
    if (m.proposed) continue;
    counts.set(m.target, (counts.get(m.target) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([f]) => f);
}
