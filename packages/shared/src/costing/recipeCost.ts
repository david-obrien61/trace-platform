// ============================================================
// recipeCost — WHAT A BATCH COSTS, AND WHAT IT HONESTLY CANNOT SAY (ledger #370)
//
// PURPOSE:      A recipe's components are bought in PACKS and used in UNITS — a 50 lb bag used 25 lb
//               at a time, a roll of hose used in inches — and the cost of a batch is the sum of what
//               those uses cost LANDED, plus the build minutes at somebody's rate. This turns a
//               recipe plus its confirmed purchases into that number, and into the sentence that says
//               which parts of it are missing.
//
// 🔴 THE CONVERSION IS WHERE A RECIPE GOES WRONG BY A FACTOR OF FIFTY (the spec's own words, about
//   the bubbler's hose: bought by the roll, used in inches). So a conversion is only ever made
//   WITHIN one family — weight to weight, length to length, volume to volume — and a component whose
//   unit cannot be converted to its pack's unit is REFUSED BY NAME rather than guessed at. There is
//   no default factor anywhere in this file.
//
// 🔴 AN INCOMPLETE TOTAL SAYS SO, AND NAMES WHAT IS MISSING. The mockup is blunt about why: *"A
//   partial total presented as a total is the thing that gets someone fired."* Measured on LAWNS's
//   own special planting mix, 2026-09-21: of seven components, four are on captured receipts, one
//   (compost) is capturable, and MicroMax and 12-24-12 are on no receipt at all. So the first real
//   recipe is incomplete by construction, and this module's job is to say that out loud.
//
// 🔴 LABOUR IS MINUTES UNTIL SOMEBODY ENTERS A RATE (David, 2026-09-21: *"no yard-crew rates exist,
//   and crews change week to week"*). `labour_rates` ships empty, so the labour line reads "not
//   costed yet — no rates entered" and the batch total is incomplete. It is never silently zero:
//   zero labour is a claim that the work was free.
//
// 🔴 MARKUP IS A SUGGESTION, NEVER AN APPLIED PRICE (David, 2026-09-21). The business's own 40% is
//   a MARKUP (× 1.40), not a margin (÷ 0.60) — the mockup measures the difference at $7 on half a
//   yard. Lauren sets the price; this module hands her a number and says where it came from.
//
// DEPENDENCIES: ./landedCost (the freight spread — both ways, never one).
// OUTPUTS:      convertQuantity · costRecipeBatch · RecipeCostResult · suggestedPrice.
// AC-1:         generic. A recipe is a recipe; nothing here knows what a nursery is.
// STORY:        `user_stories.md` → the cost-to-produce arc ([[R-118]], the recipe builder).
// ============================================================

/** Units this module can convert between, by family. Anything else is refused, never assumed. */
const FAMILIES: Record<string, Record<string, number>> = {
  // weight, in pounds
  weight: { lb: 1, lbs: 1, pound: 1, pounds: 1, oz: 1 / 16, ounce: 1 / 16, ounces: 1 / 16, kg: 2.20462, g: 0.00220462 },
  // length, in feet
  // ⚠️ NO `yd` HERE, AND THAT IS THE POINT: a grower's yard is a CUBIC yard (see volume below).
  // Listing it in both families made `familyOf` answer with whichever table it met first — length —
  // so gallons could not be converted to yards at all. Caught by the test that converts them.
  length: { ft: 1, foot: 1, feet: 1, in: 1 / 12, inch: 1 / 12, inches: 1 / 12, m: 3.28084 },
  // volume, in cubic yards — a nursery's own unit for bulk
  volume: { yd: 1, yd3: 1, 'cubic yard': 1, 'cubic yards': 1, cf: 1 / 27, 'cubic foot': 1 / 27, 'cubic feet': 1 / 27, gal: 1 / 201.974025974, gallon: 1 / 201.974025974, gallons: 1 / 201.974025974 },
  // countable things
  each: { each: 1, ea: 1, unit: 1, units: 1, piece: 1, pieces: 1, bag: 1, bags: 1, roll: 1, rolls: 1, bottle: 1, bottles: 1 },
};

const norm = (u: string | null | undefined): string => (u ?? '').trim().toLowerCase().replace(/\.$/, '');

/** Which family a unit belongs to, or null when this module does not know it. */
function familyOf(unit: string | null | undefined): string | null {
  const u = norm(unit);
  if (!u) return null;
  // ⚠️ 'yd' IS VOLUME AND ONLY VOLUME, and this is the one ambiguity worth naming: a grower saying
  // "2 yards of bark" means cubic yards. A yard of ribbon would be wrong here — and a nursery that
  // sells ribbon by the yard needs this ASKED, not assumed (the onboarding question set, #350).
  for (const [family, table] of Object.entries(FAMILIES)) {
    if (u in table) return family;
  }
  return null;
}

export type Conversion =
  | { ok: true; factor: number }
  | { ok: false; reason: 'unknown_unit' | 'different_families'; detail: string };

/**
 * How many `to` units are in one `from` unit. Same family only; anything else is a refusal carrying
 * the words a person reads.
 */
export function convertQuantity(from: string | null | undefined, to: string | null | undefined): Conversion {
  const a = familyOf(from), b = familyOf(to);
  if (!a) return { ok: false, reason: 'unknown_unit', detail: `"${(from ?? '').trim() || '(blank)'}" is not a unit this can convert.` };
  if (!b) return { ok: false, reason: 'unknown_unit', detail: `"${(to ?? '').trim() || '(blank)'}" is not a unit this can convert.` };
  if (a !== b) {
    return { ok: false, reason: 'different_families',
      detail: `"${(from ?? '').trim()}" and "${(to ?? '').trim()}" measure different things (${a} and ${b}), so one cannot be turned into the other.` };
  }
  return { ok: true, factor: FAMILIES[a][norm(from)] / FAMILIES[a][norm(to)] };
}

/** What a confirmed purchase says about one component — both spreads, as `landedCost` produces them. */
export interface ComponentPurchase {
  /** Landed cost of ONE pack, freight split evenly across the receipt's goods lines. */
  landedPackCostEqualPerItem: number | null;
  /** Landed cost of ONE pack, freight in proportion to line value. */
  landedPackCostProRataByValue: number | null;
  /** How much is IN a pack — 50, for a 50 lb bag. */
  packSize: number | null;
  /** The unit that pack size is in — "lb". */
  packUnit: string | null;
  vendor?: string | null;
  purchasedOn?: string | null;
  /** vendor + date + amount: which DOCUMENT, not which capture of it (tech-debt #143). */
  documentKey?: string | null;
}

export interface RecipeComponentInput {
  name: string;
  /** How much of it one batch uses. */
  quantity: number;
  /** The unit that quantity is in — "lb", "yd", "each". */
  unit: string;
  /** The confirmed purchase behind it, or null when nobody has matched one yet. */
  purchase?: ComponentPurchase | null;
}

export interface RecipeCostInput {
  yieldQuantity: number;
  yieldUnit: string;
  buildMinutes?: number | null;
  components: RecipeComponentInput[];
  /** Hourly rates, as `labour_rates` holds them. EMPTY is the normal case today. */
  labourRates?: Array<{ who: string; hourlyRate: number }>;
  /** Which spread to lead with. Equal-per-item is the default (David, 2026-09-21). */
  spread?: 'equal_per_item' | 'pro_rata_by_value';
}

export interface CostedComponent {
  name: string;
  quantity: number;
  unit: string;
  /** Cost of the quantity this batch uses, on the CHOSEN spread — null when it cannot be costed. */
  cost: number | null;
  /** The same, on the other spread, so both are always in hand. */
  costOtherSpread: number | null;
  /** Cost of ONE of the component's own units ($/lb), on the chosen spread. */
  unitCost: number | null;
  /** Why this component has no cost, in the reader's words. Null when it has one. */
  refusal: string | null;
  vendor: string | null;
  purchasedOn: string | null;
}

export interface RecipeCostResult {
  components: CostedComponent[];
  /** Components that could be costed — the rest are named in `missing`. */
  materials: number;
  materialsOtherSpread: number;
  /** Null when no rate exists: labour is MINUTES until somebody enters one. */
  labour: number | null;
  labourNote: string;
  buildMinutes: number | null;
  /** materials + labour, on the chosen spread. Null only when nothing at all could be costed. */
  batchTotal: number | null;
  /** batchTotal ÷ yield. The number everything downstream wants — and the one most easily wrong. */
  costPerYieldUnit: number | null;
  /** True when ANY part is missing: an uncosted component, or labour with no rate. */
  incomplete: boolean;
  /** What is missing, by name, for the sentence on screen. */
  missing: string[];
  /** The sentence itself — empty when nothing is missing. */
  incompleteNote: string;
  spread: 'equal_per_item' | 'pro_rata_by_value';
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Cost one batch. Pure: no clock, no database, no default that stands in for a missing figure. */
export function costRecipeBatch(input: RecipeCostInput): RecipeCostResult {
  const spread = input.spread ?? 'equal_per_item';
  const pick = (p: ComponentPurchase, which: 'equal_per_item' | 'pro_rata_by_value'): number | null =>
    which === 'equal_per_item' ? p.landedPackCostEqualPerItem : p.landedPackCostProRataByValue;

  const components: CostedComponent[] = input.components.map(c => {
    const base: CostedComponent = {
      name: c.name, quantity: c.quantity, unit: c.unit,
      cost: null, costOtherSpread: null, unitCost: null, refusal: null,
      vendor: c.purchase?.vendor ?? null, purchasedOn: c.purchase?.purchasedOn ?? null,
    };
    if (!c.purchase) {
      return { ...base, refusal: `${c.name} is on no purchase we hold, so it has no cost yet.` };
    }
    const packCost = pick(c.purchase, spread);
    const packCostOther = pick(c.purchase, spread === 'equal_per_item' ? 'pro_rata_by_value' : 'equal_per_item');
    if (packCost == null) {
      return { ...base, refusal: `${c.name}'s purchase does not say what it cost.` };
    }
    if (c.purchase.packSize == null || c.purchase.packSize <= 0) {
      return { ...base, refusal: `${c.name}'s purchase does not say how much is in a pack, so a price per ${c.unit} cannot be worked out.` };
    }
    const conv = convertQuantity(c.unit, c.purchase.packUnit);
    if (!conv.ok) {
      return { ...base, refusal: `${c.name}: ${conv.detail}` };
    }
    // cost per ONE of the component's own units = pack cost ÷ (pack size expressed in those units)
    const packSizeInUseUnits = c.purchase.packSize / conv.factor;
    if (!(packSizeInUseUnits > 0)) {
      return { ...base, refusal: `${c.name}: the pack size works out to nothing in ${c.unit}.` };
    }
    const unitCost = packCost / packSizeInUseUnits;
    const unitCostOther = packCostOther == null ? null : packCostOther / packSizeInUseUnits;
    return {
      ...base,
      unitCost: round2(unitCost),
      cost: round2(unitCost * c.quantity),
      costOtherSpread: unitCostOther == null ? null : round2(unitCostOther * c.quantity),
    };
  });

  const costed = components.filter(c => c.cost != null);
  const materials = round2(costed.reduce((t, c) => t + (c.cost ?? 0), 0));
  const materialsOther = round2(costed.reduce((t, c) => t + (c.costOtherSpread ?? c.cost ?? 0), 0));

  // ── LABOUR: minutes are a fact, money is not, until a rate exists ──────────────────────────
  const rates = input.labourRates ?? [];
  const minutes = input.buildMinutes ?? null;
  let labour: number | null = null;
  let labourNote: string;
  if (minutes == null) {
    labourNote = 'No build time recorded for this recipe.';
  } else if (rates.length === 0) {
    labourNote = `${minutes} minutes to build — labour not costed yet, no rates entered.`;
  } else {
    const avg = rates.reduce((t, r) => t + r.hourlyRate, 0) / rates.length;
    labour = round2((minutes / 60) * avg);
    labourNote = rates.length === 1
      ? `${minutes} minutes at $${rates[0].hourlyRate.toFixed(2)} an hour (${rates[0].who}).`
      : `${minutes} minutes at $${avg.toFixed(2)} an hour, the average of ${rates.length} rates.`;
  }

  const missing: string[] = components.filter(c => c.cost == null).map(c => c.name);
  if (minutes != null && rates.length === 0) missing.push('labour');
  const incomplete = missing.length > 0;

  const batchTotal = costed.length === 0 && labour == null ? null : round2(materials + (labour ?? 0));
  const costPerYieldUnit = batchTotal == null || !(input.yieldQuantity > 0)
    ? null : round2(batchTotal / input.yieldQuantity);

  const incompleteNote = !incomplete ? '' :
    `This total is incomplete — ${missing.length === 1 ? 'one part is' : `${missing.length} parts are`} missing: ${missing.join(', ')}. `
    + 'What is shown is only what we could cost.';

  return {
    components, materials, materialsOtherSpread: materialsOther,
    labour, labourNote, buildMinutes: minutes,
    batchTotal, costPerYieldUnit, incomplete, missing, incompleteNote, spread,
  };
}

/**
 * The SUGGESTED price at a markup — never an applied one (David, 2026-09-21).
 * ⚠️ MARKUP, NOT MARGIN, AND THE DIFFERENCE IS STATED WHEREVER THIS IS SHOWN: at 40%, markup is
 * cost × 1.40 and margin would be cost ÷ 0.60 — on the mockup's half-yard scoop that is $36.37
 * against $43.30. The business's own listed 40% is a markup, so that is what this does.
 */
export function suggestedPrice(cost: number | null, markupPct = 40): { price: number | null; how: string } {
  if (cost == null) return { price: null, how: 'No cost yet, so there is no suggestion to make.' };
  const price = round2(cost * (1 + markupPct / 100));
  return { price, how: `Cost $${cost.toFixed(2)} plus ${markupPct}% markup — a suggestion, not a price. You set the price.` };
}
