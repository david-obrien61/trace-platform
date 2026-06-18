/**
 * ── SCHEDULE C COST CATEGORIES (shared) · THUNDER · 2026-06-18 ───────────────────
 *
 * PURPOSE
 *   The ONE canonical Schedule C / QBO-mappable cost_category set, shared by every
 *   surface that lets an owner categorize a cost_objects row (recurring rows on
 *   CostToProduceSettings, capital rows on /assets BusinessAssets). De-duped from the
 *   former local copy in CostToProduceSettings so the two surfaces can never drift.
 *
 * RULES (honest data)
 *   - EXACT lowercase values — the cost_objects.cost_category column comment is canonical
 *     and the drill-in's by-category group-by keys on these exact strings.
 *   - '' / null = uncategorized (an honest null, never a fabricated "other"). categoryLabel
 *     surfaces a null as "Uncategorized" — visible, never hidden.
 *   - 'labor' / 'contract-labor' are auto-applied by the LABOR block and intentionally NOT
 *     in this set: a recurring sub or a capital asset is not labor, so the picker must not
 *     offer it (labor categorization happens only through the labor model).
 *
 * OUTPUTS
 *   - CATEGORY_OPTS : the picker option list.
 *   - categoryLabel : null/blank → "Uncategorized", else the stored value.
 *
 * DEPENDENCIES: none (pure constants + one helper).
 */
export const CATEGORY_OPTS: string[] = [
  'software-subscriptions', 'utilities', 'supplies', 'materials', 'rent', 'insurance',
  'taxes-licenses', 'repairs', 'advertising', 'vehicle-fuel', 'professional-fees',
  'bank-fees', 'equipment', 'other',
];

export const UNCATEGORIZED = 'Uncategorized';

/** A blank/null/whitespace cost_category is honestly Uncategorized — never hidden. */
export const categoryLabel = (c?: string | null): string => (c && c.trim() ? c : UNCATEGORIZED);
