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
import { costRecipeBatch, type RecipeCostResult, type RecipeOperations } from '@trace/shared/costing/recipeCost';
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
  /**
   * 🔴 A PRICE SOMEBODY TYPED BECAUSE NO RECEIPT EXISTS (David, 2026-09-22): *"No receipt → a typed
   * price flagged 'no receipt', never zero."* All three parts or none — a cost with no pack size
   * cannot give a price per pound, and a half-typed price is the blank that reads as zero. The
   * database CHECK says the same thing; this says it in the person's words first.
   */
  typedPrice: { packCost: string; packSize: string; packUnit: string; because: string } | null;
  /** Which receipt line that confirmation came from, for the write. */
  confirmed: { receiptId: string; lineIndex: number; documentKey: string; spread: 'equal_per_item' | 'pro_rata_by_value' } | null;
}

export interface RecipeDraft {
  /** The made item's identity — a QuickBooks id, or a row id for an item QuickBooks never had. */
  qbItemId: string | null;
  inventoryId: string | null;
  /**
   * 🔴 THERE IS NO TYPED YIELD ANY MORE (David, 2026-09-22, ruling ①). The batch size is the sum of
   * the volume ingredients, settled — `recipeCost` derives it and the form shows the working. What
   * remains is the ACTUAL yield somebody MEASURED after a real batch, which replaces the estimate.
   * ⚠️ Blank is the normal state. A blank here means "nobody has measured one", not zero.
   */
  actualYieldCubicYards: string;
  actualYieldBecause: string;
  /**
   * A build time somebody TIMED. Also blank normally — the minutes are worked out from the mixer's
   * output (`mixerCubicYardsPerHour` × `peopleMakingMix`), and this only overrides that.
   */
  measuredBuildMinutes: string;
  measuredBuildBecause: string;
  notes: string;
  components: ComponentDraft[];
}

export const NOT_TIMED = 'not timed — nobody has timed a build yet';

export function emptyRecipeDraft(item: { qbItemId: string | null; inventoryId: string }): RecipeDraft {
  return {
    // A catalogue item is keyed by its QuickBooks id; only an item QuickBooks never had uses the row.
    qbItemId: item.qbItemId,
    inventoryId: item.qbItemId ? null : item.inventoryId,
    actualYieldCubicYards: '', actualYieldBecause: '',
    measuredBuildMinutes: '', measuredBuildBecause: '', notes: '',
    components: [],
  };
}

export function emptyComponentDraft(): ComponentDraft {
  return { name: '', quantity: '', unit: '', componentQbItemId: null, purchase: null, confirmed: null, typedPrice: null };
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
  // 🔴 A TYPED PRICE IS ALL THREE PARTS OR NONE. The database CHECK refuses a half-typed one; this
  // refuses it in words first, naming the part that is missing rather than the constraint.
  const t = c.typedPrice;
  if (t && (t.packCost.trim() || t.packSize.trim() || t.packUnit.trim())) {
    if (positive(t.packCost) === 'bad') out.push(`What does one pack of ${c.name.trim() || 'it'} cost? It must be a number above 0.`);
    if (positive(t.packSize) === 'bad') out.push(`How much is in one pack of ${c.name.trim() || 'it'}? Without that, a price per ${c.unit.trim() || 'unit'} cannot be worked out.`);
    if (!t.packUnit.trim()) out.push(`What is that pack measured in — lb, yd, gal, each?`);
  }
  return out;
}

/** Everything wrong with the recipe, in words. Empty = it may be saved (§1.6 item 3). */
export function recipeDraftProblems(d: RecipeDraft): string[] {
  const out: string[] = [];
  // 🔴 NOTHING HERE ASKS HOW MUCH A BATCH MAKES ANY MORE (David, 2026-09-22, ruling ①). The two
  // refusals that used to stand here — "How much does one batch make?" and "What does a batch make
  // — yards, each?" — are GONE, because the answer is the sum of what goes in. Asking a person for
  // a number the system can work out is how the two come to disagree.
  if (d.actualYieldCubicYards.trim() !== '' && positive(d.actualYieldCubicYards) === 'bad') {
    out.push('The measured yield must be a number above 0 — or left blank if nobody has measured a batch.');
  }
  if (d.actualYieldCubicYards.trim() !== '' && !d.actualYieldBecause.trim()) {
    out.push('Say where the measured yield came from — who measured it, and when.');
  }
  if (d.measuredBuildMinutes.trim() !== '') {
    const m = Number(d.measuredBuildMinutes);
    if (!Number.isFinite(m) || m < 0) out.push('A timed build must be a number of minutes, 0 or more — or left blank if nobody has timed one.');
    if (!d.measuredBuildBecause.trim()) out.push('Say who timed the build.');
  }
  if (d.components.length === 0) out.push('A recipe with no components is not a recipe yet.');
  d.components.forEach((c, i) => componentDraftProblems(c).forEach(p => out.push(`Component ${i + 1}: ${p}`)));
  // 🔴 EXACTLY ONE IDENTITY — the database CHECK says the same thing; this says it before the write,
  // in the person's words rather than as a constraint name.
  if ((d.qbItemId == null) === (d.inventoryId == null)) {
    out.push('This recipe must belong to exactly one item.');
  }
  return out;
}

/**
 * The `item_recipes` row. Call only on a draft with no problems.
 *
 * 🔴 `yield_quantity` / `yield_unit` ARE A DERIVED SNAPSHOT, NOT AN INPUT. They are NOT NULL in
 * `20260921`, which is applied and cannot be altered (§6 r1), and under the 2026-09-22 ruling
 * nobody types a yield. So they are written with what the recipe CURRENTLY derives — because
 * `record_build_run` runs in the database and reads `v_recipe.yield_quantity` to work out how many
 * units a build produced. **No screen reads them**; the modal re-derives from the components every
 * time it opens. ⚠️ They can therefore go stale if a component is ever changed by a path that does
 * not re-save the recipe. There is one such path today — this modal — and it always writes both
 * together. Said here so the second one is written knowing it.
 */
export function draftToRecipeRow(d: RecipeDraft, businessId: string, derivedYieldCubicYards: number | null) {
  return {
    business_id: businessId,
    qb_item_id: d.qbItemId,
    inventory_id: d.inventoryId,
    // A recipe that derives nothing still needs a positive number here (the CHECK demands > 0).
    // 1 is the honest placeholder for "one batch", and `actual_yield_cubic_yards` is where a real
    // figure lives — never 0, which the CHECK would refuse anyway.
    yield_quantity: derivedYieldCubicYards && derivedYieldCubicYards > 0 ? derivedYieldCubicYards : 1,
    yield_unit: 'yd',
    actual_yield_cubic_yards: d.actualYieldCubicYards.trim() === '' ? null : Number(d.actualYieldCubicYards),
    actual_yield_because: d.actualYieldBecause.trim() || null,
    build_minutes: d.measuredBuildMinutes.trim() === '' ? null : Number(d.measuredBuildMinutes),
    build_minutes_because: d.measuredBuildBecause.trim() || NOT_TIMED,
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
    typed_pack_cost: c.typedPrice?.packCost.trim() ? Number(c.typedPrice.packCost) : null,
    typed_pack_size: c.typedPrice?.packSize.trim() ? Number(c.typedPrice.packSize) : null,
    typed_pack_unit: c.typedPrice?.packUnit.trim() || null,
    typed_because: c.typedPrice?.because.trim() || null,
    // ⚠️ NEVER a row id for an imported product: the database refuses it (the wipe guard), and the
    // modal has no reason to offer it — a catalogue component is always keyed by its QuickBooks id.
    component_inventory_id: null,
  }));
}

/** What the draft costs as it stands — the live total under the form, incomplete parts and all. */
export function draftCost(d: RecipeDraft, opts: {
  labourRates?: Array<{ who: string; hourlyRate: number }>;
  spread?: 'equal_per_item' | 'pro_rata_by_value';
  ops?: Partial<RecipeOperations>;
} = {}): RecipeCostResult {
  return costRecipeBatch({
    actualYieldCubicYards: d.actualYieldCubicYards.trim() === '' ? null : Number(d.actualYieldCubicYards),
    actualYieldBecause: d.actualYieldBecause.trim() || null,
    measuredBuildMinutes: d.measuredBuildMinutes.trim() === '' ? null : Number(d.measuredBuildMinutes),
    measuredBuildBecause: d.measuredBuildBecause.trim() || null,
    components: d.components.map(c => ({
      name: c.name.trim() || '(unnamed)',
      quantity: Number(c.quantity) || 0,
      unit: c.unit.trim(),
      // A confirmed receipt purchase WINS over a typed price — if both exist, the receipt is the
      // better fact and the typed figure stays on the draft as what it was before the match.
      purchase: c.purchase ?? typedAsPurchase(c),
    })),
    labourRates: opts.labourRates ?? [],
    spread: opts.spread,
    ops: opts.ops,
  });
}

/** A typed price, shaped as a purchase so the cost model has one code path, and FLAGGED as typed. */
function typedAsPurchase(c: ComponentDraft): ComponentPurchase | null {
  const t = c.typedPrice;
  if (!t) return null;
  const cost = Number(t.packCost), size = Number(t.packSize);
  if (!(cost > 0) || !(size > 0) || !t.packUnit.trim()) return null;
  return {
    source: 'typed',
    landedPackCostEqualPerItem: cost, landedPackCostProRataByValue: cost,
    packSize: size, packUnit: t.packUnit.trim(),
    vendor: null, purchasedOn: null, documentKey: null,
  };
}

/**
 * 🔴 NO PRICE IS SUGGESTED WHILE THE COST IS INCOMPLETE (David, 2026-09-22). Suggesting off a
 * partial cost is how a number that excludes three components becomes the basis of a price — the
 * same failure as a partial total presented as a total, one step further downstream.
 */
export function maySuggestPrice(cost: RecipeCostResult): boolean {
  return !cost.incomplete && cost.costPerYieldUnit != null;
}
