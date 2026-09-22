// ============================================================
// recipeDraft — WHAT A PERSON TYPES INTO A RECIPE, AND WHAT IS WRONG WITH IT (ledger #370)
//
// PURPOSE:      The recipe modal's form state and its refusals, as PURE values, so a probe can
//               assert them without a database handle or a DOM — the same split as
//               `containerLadderDraft` (tech-debt #179's lesson). Nothing here reads or writes.
//
// 🔴 A COMPONENT WITH NO PURCHASE IS LEGAL AND SAYS SO. LAWNS's own first recipe proves why:
//   measured 2026-09-21, MicroMax and 12-24-12 are on no captured receipt at all. A form that
//   refused to save them would force somebody to invent a price, which is the one outcome the whole
//   costing chain exists to prevent.
//
// 🔴 THE UNIT IS THE PERSON'S, NOT A DROPDOWN'S. A grower says "2 yd", "25 lb", "10 in", "1 each".
//   `recipeCost` converts within a family and REFUSES across families, so the draft only checks that
//   a unit was given — it never rewrites one, and it never guesses a family (D-23).
//
// DEPENDENCIES: @trace/shared/costing (costRecipeBatch, for the live total under the form) — pure.
// OUTPUTS:      RecipeDraft · ComponentDraft · emptyRecipeDraft · recipeDraftProblems ·
//               componentDraftProblems · draftToRecipeRow · draftToComponentRows · draftCost.
// ============================================================
import { costRecipeBatch, type RecipeCostResult } from '@trace/shared/costing/recipeCost';
import type { ComponentPurchase } from '@trace/shared/costing/recipeCost';

export interface ComponentDraft {
  name: string;
  /** As typed. '' is a problem; '0' is a problem; '2.5' is fine. */
  quantity: string;
  unit: string;
  /** The catalogue item this component IS, when it is one — the identity that survives a wipe. */
  componentQbItemId: string | null;
  /** The confirmed purchase behind it, once somebody has said yes to a proposal. */
  purchase: ComponentPurchase | null;
  /** Which receipt line that confirmation came from, for the write. */
  confirmed: { receiptId: string; lineIndex: number; documentKey: string; spread: 'equal_per_item' | 'pro_rata_by_value' } | null;
}

export interface RecipeDraft {
  /** The made item's identity — a QuickBooks id, or a row id for an item QuickBooks never had. */
  qbItemId: string | null;
  inventoryId: string | null;
  yieldQuantity: string;
  yieldUnit: string;
  buildMinutes: string;
  buildMinutesBecause: string;
  notes: string;
  components: ComponentDraft[];
}

export const NOT_TIMED = 'not timed — nobody has timed a build yet';

export function emptyRecipeDraft(item: { qbItemId: string | null; inventoryId: string }): RecipeDraft {
  return {
    // A catalogue item is keyed by its QuickBooks id; only an item QuickBooks never had uses the row.
    qbItemId: item.qbItemId,
    inventoryId: item.qbItemId ? null : item.inventoryId,
    yieldQuantity: '', yieldUnit: '', buildMinutes: '', buildMinutesBecause: NOT_TIMED, notes: '',
    components: [],
  };
}

export function emptyComponentDraft(): ComponentDraft {
  return { name: '', quantity: '', unit: '', componentQbItemId: null, purchase: null, confirmed: null };
}

const positive = (s: string): number | 'bad' => {
  if (s.trim() === '') return 'bad';
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : 'bad';
};

/** Everything wrong with one component, in words. Empty = it may be saved. */
export function componentDraftProblems(c: ComponentDraft): string[] {
  const out: string[] = [];
  if (!c.name.trim()) out.push('A component needs a name — it is what somebody reads off the bench.');
  if (positive(c.quantity) === 'bad') out.push(`How much ${c.name.trim() || 'of it'} does one batch use? It must be a number above 0.`);
  if (!c.unit.trim()) out.push(`What is ${c.name.trim() || 'that'} measured in — lb, yd, in, each?`);
  return out;
}

/** Everything wrong with the recipe, in words. Empty = it may be saved (§1.6 item 3). */
export function recipeDraftProblems(d: RecipeDraft): string[] {
  const out: string[] = [];
  if (positive(d.yieldQuantity) === 'bad') out.push('How much does one batch make? It must be a number above 0.');
  if (!d.yieldUnit.trim()) out.push('What does a batch make — yards, each?');
  if (d.buildMinutes.trim() !== '') {
    const m = Number(d.buildMinutes);
    if (!Number.isFinite(m) || m < 0) out.push('Build minutes must be a number, 0 or more — or left blank if nobody has timed it.');
  }
  if (!d.buildMinutesBecause.trim()) out.push('Say where the build time came from — even "not timed".');
  if (d.components.length === 0) out.push('A recipe with no components is not a recipe yet.');
  d.components.forEach((c, i) => componentDraftProblems(c).forEach(p => out.push(`Component ${i + 1}: ${p}`)));
  // 🔴 EXACTLY ONE IDENTITY — the database CHECK says the same thing; this says it before the write,
  // in the person's words rather than as a constraint name.
  if ((d.qbItemId == null) === (d.inventoryId == null)) {
    out.push('This recipe must belong to exactly one item.');
  }
  return out;
}

/** The `item_recipes` row. Call only on a draft with no problems. */
export function draftToRecipeRow(d: RecipeDraft, businessId: string) {
  return {
    business_id: businessId,
    qb_item_id: d.qbItemId,
    inventory_id: d.inventoryId,
    yield_quantity: Number(d.yieldQuantity),
    yield_unit: d.yieldUnit.trim(),
    build_minutes: d.buildMinutes.trim() === '' ? null : Number(d.buildMinutes),
    build_minutes_because: d.buildMinutesBecause.trim(),
    notes: d.notes.trim() || null,
  };
}

/** The `recipe_components` rows, in the order they were typed. */
export function draftToComponentRows(d: RecipeDraft, recipeId: string) {
  return d.components.map((c, i) => ({
    recipe_id: recipeId,
    position: i + 1,
    name: c.name.trim(),
    quantity: Number(c.quantity),
    unit: c.unit.trim(),
    component_qb_item_id: c.componentQbItemId,
    // ⚠️ NEVER a row id for an imported product: the database refuses it (the wipe guard), and the
    // modal has no reason to offer it — a catalogue component is always keyed by its QuickBooks id.
    component_inventory_id: null,
  }));
}

/** What the draft costs as it stands — the live total under the form, incomplete parts and all. */
export function draftCost(d: RecipeDraft, opts: {
  labourRates?: Array<{ who: string; hourlyRate: number }>;
  spread?: 'equal_per_item' | 'pro_rata_by_value';
} = {}): RecipeCostResult {
  return costRecipeBatch({
    yieldQuantity: Number(d.yieldQuantity) || 0,
    yieldUnit: d.yieldUnit.trim(),
    buildMinutes: d.buildMinutes.trim() === '' ? null : Number(d.buildMinutes),
    components: d.components.map(c => ({
      name: c.name.trim() || '(unnamed)',
      quantity: Number(c.quantity) || 0,
      unit: c.unit.trim(),
      purchase: c.purchase,
    })),
    labourRates: opts.labourRates ?? [],
    spread: opts.spread,
  });
}

/**
 * 🔴 NO PRICE IS SUGGESTED WHILE THE COST IS INCOMPLETE (David, 2026-09-22). Suggesting off a
 * partial cost is how a number that excludes three components becomes the basis of a price — the
 * same failure as a partial total presented as a total, one step further downstream.
 */
export function maySuggestPrice(cost: RecipeCostResult): boolean {
  return !cost.incomplete && cost.costPerYieldUnit != null;
}
