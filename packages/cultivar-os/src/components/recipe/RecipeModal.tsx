// ============================================================
// RecipeModal — WHAT GOES INTO A MADE ITEM, AND WHAT IT COSTS (ledger #370)
//
// PURPOSE:      The one surface where a person writes a recipe: what a batch makes, what goes into
//               it, and — for each component — which purchase on which receipt it costs from. The
//               cost panel under the form recomputes on every keystroke, so the person sees the
//               consequence of what they are typing rather than after a save.
//
// 🔴 PROPOSE AND CONFIRM, NEVER DERIVE. A component's purchase is OFFERED — *"We found Osmocote
//   Blend 21-4-8 (12-14M) - 50 lb, bwi, 50 lb @ $68.24, 2 Sep — correct?"* — and a person says yes.
//   Nothing here matches silently, and a proposal that is never confirmed prices nothing. David,
//   killing derivation outright: *"how do you propose a bubbler with no context"*.
//
// 🔴 NO PRICE IS SUGGESTED WHILE THE COST IS INCOMPLETE (David, 2026-09-22). The markup line is not
//   greyed out, it is ABSENT, and the panel says which components are missing instead. A suggestion
//   off a partial cost is a partial total presented as a total, one step further downstream.
//
// 🔴 BOTH FREIGHT SPREADS ARE SHOWN, EQUAL-PER-ITEM FIRST AND DEFAULT (David, 2026-09-21): *"show
//   the working, suggest, Lauren decides"*. The toggle changes which one the recipe SAVES against;
//   the other is always printed beside it, never hidden behind the toggle.
//
// STANDARD (§6 r16): this is the INGREDIENTS pattern every recipe editor uses — a line per
//   component, quantity + unit on the line, a running total beneath. Where it deviates is the
//   purchase link, which a domestic recipe app has no equivalent for; that is stated, not silent.
//
// DEPENDENCIES: ../../lib/recipeDraft · ../../lib/recipeWrite · @trace/shared/costing · sheetStyles.
// OUTPUTS:      <RecipeModal> — writes item_recipes, recipe_components, component_purchase_links.
// INSTRUMENTATION (STD-003): [TRACE:RECIPE] via recipeWrite — ON.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, Link2, Check, Package, Search } from 'lucide-react';
import { useBusinessContext } from '@trace/shared/context';
import { sheetStyles as SS } from '@trace/shared/components/datasheet/DataSheet';
import { proposeMatches, proposalSentence, type CapturedReceipt, type MatchProposal } from '@trace/shared/costing/receiptMatch';
import { approx, suggestedPrice } from '@trace/shared/costing/recipeCost';
import { resolveConfig, type OperationsConfig } from '@trace/shared/production';
import {
  draftCost, emptyComponentDraft, emptyRecipeDraft, maySuggestPrice, recipeDraftProblems,
  type ComponentDraft, type RecipeDraft,
} from '../../lib/recipeDraft';
import {
  componentIdsByPosition, confirmComponentPurchase, loadRecipe, readReceiptsForMatching, saveRecipe,
  searchProducts, type PickableProduct,
} from '../../lib/recipeWrite';
import { supabase } from '../../lib/supabase';

interface Props {
  item: { id: string; name: string; qbItemId: string | null };
  /** The word this business uses for a made item — "homemade" at LAWNS. Never hardcoded (AC-1). */
  madeItemLabel: string;
  onClose: () => void;
  onSaved: () => void;
}

type Spread = 'equal_per_item' | 'pro_rata_by_value';

const money = (n: number | null): string => (n == null ? '—' : `$${n.toFixed(2)}`);

const panel: React.CSSProperties = {
  background: '#f8faf5', border: '1px solid #dbe5d0', borderRadius: 10, padding: '0.875rem 1rem', marginTop: 14,
};
const lineRow: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 90px 90px 32px', gap: 8, alignItems: 'start', marginBottom: 8,
};
const groupTitle: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase',
  letterSpacing: '0.06em', margin: '18px 0 8px', paddingBottom: 4, borderBottom: '1px solid #f0f0f0',
};

export function RecipeModal({ item, madeItemLabel, onClose, onSaved }: Props) {
  const { businessId } = useBusinessContext();
  const [draft, setDraft] = useState<RecipeDraft>(() => emptyRecipeDraft({ qbItemId: item.qbItemId, inventoryId: item.id }));
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showProblems, setShowProblems] = useState(false);
  const [spread, setSpread] = useState<Spread>('equal_per_item');
  /**
   * 🔴 THE OPERATIONS FIGURES DRIVE THE BATCH SIZE AND THE BUILD TIME (David, 2026-09-22).
   * `mixShrinkPct` turns loose mix into settled; `mixerCubicYardsPerHour` × `peopleMakingMix` give
   * the minutes. Read through `resolveConfig` so a missing or unusable stored key shows its DEFAULT
   * rather than a 0 that would silently mean "no labour" (ledger #343's lesson).
   */
  const [ops, setOps] = useState<OperationsConfig>(() => resolveConfig(null, null, false).ops);
  /** The item picker: which component is picking, what was typed, and what came back. */
  const [picking, setPicking] = useState<{ index: number; term: string; results: PickableProduct[]; searching: boolean } | null>(null);

  // The receipts the matcher reads. Read ONCE when the modal opens — a proposal is not worth a
  // round trip per keystroke, and the set does not change while a person types a recipe.
  const [receipts, setReceipts] = useState<CapturedReceipt[]>([]);
  const [receiptsProblem, setReceiptsProblem] = useState<string | null>(null);
  /** Which component's proposals are open, and what was proposed for it. */
  const [matching, setMatching] = useState<{ index: number; proposals: MatchProposal[]; collapsed: number } | null>(null);

  useEffect(() => {
    if (!businessId) return;
    let live = true;
    void (async () => {
      const [got, rec, opsRow] = await Promise.all([
        loadRecipe(businessId, { qbItemId: item.qbItemId, inventoryId: item.id }),
        readReceiptsForMatching(businessId),
        supabase.from('business_operations_config').select('config').eq('business_id', businessId).maybeSingle(),
      ]);
      if (!live) return;
      setOps(resolveConfig((opsRow.data?.config ?? null) as Partial<OperationsConfig> | null, null, false).ops);
      if (!got.ok) setError(got.message);
      else if (got.recipe) { setRecipeId(got.recipe.recipeId); setDraft(got.recipe.draft); }
      if (!rec.ok) setReceiptsProblem(rec.message);
      else setReceipts(rec.receipts);
      setLoading(false);
    })();
    return () => { live = false; };
  }, [businessId, item.id, item.qbItemId]);

  const cost = useMemo(() => draftCost(draft, { spread, ops }), [draft, spread, ops]);
  const problems = useMemo(() => recipeDraftProblems(draft), [draft]);

  const setComponent = (i: number, patch: Partial<ComponentDraft>) =>
    setDraft(d => ({ ...d, components: d.components.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  async function runSearch() {
    if (!businessId || !picking) return;
    setPicking(p => p && ({ ...p, searching: true }));
    const res = await searchProducts(businessId, picking.term);
    if (!res.ok) { setPicking(null); setError(res.message); return; }
    setPicking(p => p && ({ ...p, results: res.products, searching: false }));
  }

  function openProposals(i: number) {
    const c = draft.components[i];
    if (!c.name.trim()) { setNotice('Name the component first — the proposal is made from its name.'); return; }
    const { proposals, collapsed } = proposeMatches(
      { name: c.name, qbItemId: c.componentQbItemId, qbItemName: c.componentQbItemId },
      receipts,
    );
    setMatching({ index: i, proposals, collapsed: collapsed.reduce((n, g) => n + g.captures - 1, 0) });
  }

  /**
   * Say yes to a proposal. The landed figures go onto the DRAFT so the cost panel moves immediately;
   * the LINK is written only once the recipe has a row to hang off — so on a recipe that has never
   * been saved, the confirmation is held in the draft and written by the save below. That is said
   * out loud on the button rather than discovered when nothing persists.
   */
  function confirm(p: MatchProposal) {
    if (!matching) return;
    const i = matching.index;
    setComponent(i, {
      purchase: {
        landedPackCostEqualPerItem: p.landedPackCostEqualPerItem,
        landedPackCostProRataByValue: p.landedPackCostProRataByValue,
        packSize: p.packSize, packUnit: p.packUnit,
        vendor: p.vendor, purchasedOn: p.purchasedOn, documentKey: p.documentKey,
      },
      confirmed: { receiptId: p.receiptId, lineIndex: p.lineIndex, documentKey: p.documentKey, spread },
    });
    setMatching(null);
    setNotice(p.landedRefusal
      ? `Linked — but that receipt's lines do not add up, so it gives no cost: ${p.landedRefusal}`
      : 'Linked. Save the recipe to keep it.');
  }

  async function save() {
    if (!businessId) return;
    setShowProblems(true);
    if (problems.length > 0) { setError('This recipe is not ready to save — see below.'); return; }
    setError(null);
    setSaving(true);
    const res = await saveRecipe(businessId, draft, recipeId, cost.yieldCubicYards);
    if (!res.ok || !res.recipeId) { setSaving(false); setError(res.message); return; }
    setRecipeId(res.recipeId);

    // The components were just re-created, so the confirmations are re-attached against the new
    // component ids. A link that fails is REPORTED — the recipe is saved either way, and a silent
    // half-save is what the header of recipeWrite warns about (tech-debt #69's shape).
    const ids = await componentIdsByPosition(res.recipeId);
    let linkFailures = 0;
    for (const [i, c] of draft.components.entries()) {
      if (!c.confirmed) continue;
      const componentId = ids.get(i + 1);
      if (!componentId) { linkFailures++; continue; }
      const out = await confirmComponentPurchase(businessId, componentId, {
        receiptId: c.confirmed.receiptId, lineIndex: c.confirmed.lineIndex,
        documentKey: c.confirmed.documentKey, matchedDescription: c.name,
        packSize: c.purchase?.packSize ?? null, packUnit: c.purchase?.packUnit ?? null,
        lineUnitPrice: null, purchasedOn: c.purchase?.purchasedOn ?? null, spread: c.confirmed.spread,
      });
      if (!out.ok) linkFailures++;
    }
    setSaving(false);
    if (linkFailures > 0) { setError(`Saved, but ${linkFailures} purchase link${linkFailures === 1 ? '' : 's'} did not record. Re-link ${linkFailures === 1 ? 'it' : 'them'} and save again.`); return; }
    onSaved();
    onClose();
  }

  const suggestion = maySuggestPrice(cost) ? suggestedPrice(cost.costPerYieldUnit, 40) : null;

  return (
    <div style={SS.modal} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={SS.sheet}>
        <div style={SS.sheetHeader}>
          <div>
            <h2 style={{ ...SS.sectionTitle, margin: 0 }}>What goes into {item.name}</h2>
            <p style={{ ...SS.muted, margin: '2px 0 0' }}>A {madeItemLabel} item — a build takes these out of stock and puts the finished units in.</p>
          </div>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} onClick={onClose} aria-label="Close">
            <X size={20} color="#6b7280" />
          </button>
        </div>

        <div style={SS.sheetBody}>
          {error && <div style={SS.error}>{error}</div>}
          {notice && <div style={SS.success}>{notice}</div>}
          {loading && <p style={SS.muted}>Reading this item's recipe…</p>}

          {!loading && (
            <>
              {/* ── ONE BATCH — DERIVED, NOT TYPED (David, 2026-09-22, ruling ①) ── */}
              <div style={groupTitle}>One batch makes</div>
              <div style={panel}>
                <p style={{ margin: 0, fontSize: '1rem', color: '#111827' }}>
                  <b>{cost.yieldCubicYards == null ? 'Not worked out yet' : `About ${approx(cost.yieldCubicYards)} yards`}</b>
                </p>
                <p style={{ ...SS.muted, margin: '4px 0 0' }}>{cost.yieldNote}</p>
                {cost.weightComponents.length > 0 && (
                  <p style={{ ...SS.muted, margin: '4px 0 0' }}>
                    {cost.weightComponents.join(', ')} add cost and no volume.
                  </p>
                )}
              </div>
              <details style={{ marginTop: 10 }}>
                <summary style={{ ...SS.muted, cursor: 'pointer' }}>Measured a real batch? Type what it actually made</summary>
                <div style={{ ...SS.row2, ...SS.field, marginTop: 8 }}>
                  <div>
                    <label style={SS.label}>It actually made (yards)</label>
                    <input style={SS.input} value={draft.actualYieldCubicYards} inputMode="decimal"
                      onChange={e => setDraft(d => ({ ...d, actualYieldCubicYards: e.target.value }))}
                      placeholder="Leave blank to use the figure above" />
                  </div>
                  <div>
                    <label style={SS.label}>Who measured it</label>
                    <input style={SS.input} value={draft.actualYieldBecause}
                      onChange={e => setDraft(d => ({ ...d, actualYieldBecause: e.target.value }))}
                      placeholder="e.g. Lauren, 22 Sep" />
                  </div>
                </div>
                <div style={{ ...SS.row2, ...SS.field }}>
                  <div>
                    <label style={SS.label}>Timed build (minutes)</label>
                    <input style={SS.input} value={draft.measuredBuildMinutes} inputMode="numeric"
                      onChange={e => setDraft(d => ({ ...d, measuredBuildMinutes: e.target.value }))}
                      placeholder="Blank = worked out from the mixer" />
                  </div>
                  <div>
                    <label style={SS.label}>Who timed it</label>
                    <input style={SS.input} value={draft.measuredBuildBecause}
                      onChange={e => setDraft(d => ({ ...d, measuredBuildBecause: e.target.value }))} />
                  </div>
                </div>
                <p style={SS.hint}>
                  A measurement REPLACES the figure above — it is not averaged with it. Both are
                  normally blank, and that is not a gap: the batch size comes from what goes in, and
                  the minutes from your mixer's output in Settings → Operations.
                </p>
              </details>

              {/* ── WHAT GOES IN ── */}
              <div style={groupTitle}>What goes in</div>
              {draft.components.length === 0 && (
                <p style={SS.hint}>Nothing yet. Add the first thing that goes into a batch.</p>
              )}
              {draft.components.map((c, i) => {
                const costed = cost.components[i];
                return (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={lineRow}>
                      <input style={SS.input} value={c.name} placeholder="e.g. Osmocote 21-4-8"
                        onChange={e => setComponent(i, { name: e.target.value })} />
                      <input style={SS.input} value={c.quantity} inputMode="decimal" placeholder="Qty"
                        onChange={e => setComponent(i, { quantity: e.target.value })} />
                      <input style={SS.input} value={c.unit} placeholder="lb, yd, in"
                        onChange={e => setComponent(i, { unit: e.target.value })} />
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}
                        aria-label={`Remove ${c.name || 'this component'}`}
                        onClick={() => setDraft(d => ({ ...d, components: d.components.filter((_, j) => j !== i) }))}>
                        <Trash2 size={16} color="#b91c1c" />
                      </button>
                    </div>
                    {/* The purchase behind it — proposed, confirmed, or honestly absent. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.78rem' }}>
                      {c.purchase ? (
                        <span style={{ color: '#166534', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Check size={13} />
                          {c.purchase.packSize != null && c.purchase.packUnit
                            ? `${money(c.purchase.landedPackCostEqualPerItem)} per ${c.purchase.packSize} ${c.purchase.packUnit}`
                            : 'linked — no pack size on that line'}
                          {c.purchase.vendor ? `, ${c.purchase.vendor}` : ''}
                          {c.purchase.purchasedOn ? `, ${c.purchase.purchasedOn}` : ''}
                        </span>
                      ) : (
                        <span style={{ color: '#92400e' }}>On no purchase we hold — it will not be costed, and the batch will say so.</span>
                      )}
                      <button style={{ ...SS.addBtn, padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                        onClick={() => openProposals(i)} disabled={!!receiptsProblem}>
                        <Link2 size={13} /> {c.purchase ? 'Change the purchase' : 'Find the purchase'}
                      </button>
                      {/* 🔴 ④ THE PRODUCT LINK. Without it a build run consumes NOTHING: the
                          function resolves shelf stock by `component_qb_item_id`, and a component
                          that is only a name has none. */}
                      <button style={{ ...SS.addBtn, padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                        onClick={() => setPicking({ index: i, term: c.name, results: [], searching: false })}>
                        <Package size={13} /> {c.componentQbItemId ? 'Linked to a product' : 'Link a product'}
                      </button>
                      {/* A refusal is shown only when a purchase IS linked — an UNLINKED component
                          already says so on the amber line above, and printing both would be one
                          fact in two places (STD-011), the second of which is the one that drifts. */}
                      {costed?.refusal && c.purchase && (
                        <span style={{ color: '#b91c1c' }}>{costed.refusal}</span>
                      )}
                      {costed?.cost != null && (
                        <span style={SS.muted}>{money(costed.cost)} a batch</span>
                      )}
                      {costed?.priceFlag && (
                        <span style={{ color: '#92400e' }}>⚠ {costed.priceFlag}</span>
                      )}
                    </div>
                    {/* 🔴 NOT LINKED TO A PRODUCT = NOT CONSUMED. Said on the line, not discovered
                        after a build run moved no stock. */}
                    {!c.componentQbItemId && (
                      <p style={{ ...SS.hint, color: '#92400e', marginTop: 2 }}>
                        Not linked to a product — a build will not take this off the shelf.
                      </p>
                    )}
                    {/* ⑤ No receipt → a typed price, flagged. Offered only when nothing is matched. */}
                    {!c.purchase && (
                      <details style={{ marginTop: 4 }}>
                        <summary style={{ ...SS.muted, cursor: 'pointer', fontSize: '0.78rem' }}>
                          No receipt for it? Type what a pack costs
                        </summary>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: 6, marginTop: 6 }}>
                          <input style={{ ...SS.input, fontSize: '0.82rem' }} inputMode="decimal"
                            placeholder="Pack cost" value={c.typedPrice?.packCost ?? ''}
                            onChange={e => setComponent(i, { typedPrice: { packCost: e.target.value, packSize: c.typedPrice?.packSize ?? '', packUnit: c.typedPrice?.packUnit ?? '', because: c.typedPrice?.because ?? '' } })} />
                          <input style={{ ...SS.input, fontSize: '0.82rem' }} inputMode="decimal"
                            placeholder="Pack size" value={c.typedPrice?.packSize ?? ''}
                            onChange={e => setComponent(i, { typedPrice: { packCost: c.typedPrice?.packCost ?? '', packSize: e.target.value, packUnit: c.typedPrice?.packUnit ?? '', because: c.typedPrice?.because ?? '' } })} />
                          <input style={{ ...SS.input, fontSize: '0.82rem' }}
                            placeholder="lb, yd" value={c.typedPrice?.packUnit ?? ''}
                            onChange={e => setComponent(i, { typedPrice: { packCost: c.typedPrice?.packCost ?? '', packSize: c.typedPrice?.packSize ?? '', packUnit: e.target.value, because: c.typedPrice?.because ?? '' } })} />
                          <input style={{ ...SS.input, fontSize: '0.82rem' }}
                            placeholder="Where the price came from" value={c.typedPrice?.because ?? ''}
                            onChange={e => setComponent(i, { typedPrice: { packCost: c.typedPrice?.packCost ?? '', packSize: c.typedPrice?.packSize ?? '', packUnit: c.typedPrice?.packUnit ?? '', because: e.target.value } })} />
                        </div>
                        <p style={SS.hint}>
                          It will be costed and shown flagged &ldquo;no receipt&rdquo;. Capture the invoice later and
                          the figure corrects itself.
                        </p>
                      </details>
                    )}
                    <div style={{ display: 'none' }}>
                    </div>
                  </div>
                );
              })}
              <button style={SS.addBtn} onClick={() => setDraft(d => ({ ...d, components: [...d.components, emptyComponentDraft()] }))}>
                <Plus size={15} /> Add a component
              </button>
              {receiptsProblem && <p style={{ ...SS.hint, color: '#b91c1c' }}>{receiptsProblem}</p>}

              {/* ── WHAT IT COSTS ── */}
              <div style={groupTitle}>What a batch costs</div>
              <div style={panel}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  {/* Equal-per-item FIRST and default (David, 2026-09-21). */}
                  {(['equal_per_item', 'pro_rata_by_value'] as Spread[]).map(s => (
                    <button key={s} onClick={() => setSpread(s)}
                      style={{ ...(spread === s ? SS.primaryBtn : SS.addBtn), padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>
                      {s === 'equal_per_item' ? 'Freight split evenly' : 'Freight split by value'}
                    </button>
                  ))}
                </div>
                <p style={{ margin: '0 0 6px', fontSize: '0.95rem', color: '#111827' }}>
                  <b>Materials {money(cost.materials)}</b>
                  <span style={SS.muted}> · {money(cost.materialsOtherSpread)} on the other split</span>
                </p>
                <p style={{ margin: '0 0 6px', fontSize: '0.88rem', color: '#374151' }}>Labour — {cost.labourNote}</p>
                {cost.costPerYieldUnit != null && (
                  <p style={{ margin: '0 0 6px', fontSize: '0.95rem', color: '#111827' }}>
                    <b>{money(cost.costPerYieldUnit)} a yard</b>
                    {/* ⑥ per gallon, four decimals: a gallon of mix is cents. */}
                    {cost.costPerGallon != null && (
                      <span style={SS.muted}> · ${cost.costPerGallon.toFixed(4)} a gallon</span>
                    )}
                    {cost.incomplete && <span style={SS.muted}> — so far</span>}
                  </p>
                )}
                {/* ⑤ Typed prices are named here, where the total is — not only on their own line. */}
                {cost.typedPricesNote && (
                  <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: '#92400e' }}>{cost.typedPricesNote}</p>
                )}
                {cost.incomplete && <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: '#92400e' }}>{cost.incompleteNote}</p>}
                {/* 🔴 The suggestion is ABSENT while incomplete, not greyed — David, 2026-09-22. */}
                {suggestion?.price != null ? (
                  <p style={{ margin: '8px 0 0', fontSize: '0.88rem', color: '#374151' }}>
                    A 40% markup would be <b>{money(suggestion.price)}</b> a yard. {suggestion.how}
                  </p>
                ) : (
                  <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: '#6b7280' }}>
                    No price is suggested while the cost is incomplete — a markup on a partial cost reads as a real one.
                  </p>
                )}
              </div>

              <div style={SS.field}>
                <label style={{ ...SS.label, marginTop: 14 }}>Notes</label>
                <textarea style={SS.textarea} value={draft.notes}
                  onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                  placeholder="Anything the person building it needs to know" />
              </div>

              {showProblems && problems.length > 0 && (
                <div style={SS.error}>
                  <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
                </div>
              )}
            </>
          )}
        </div>

        <div style={SS.sheetActions}>
          <button style={{ ...SS.addBtn, flex: 1, justifyContent: 'center', minHeight: 48 }} onClick={onClose}>Cancel</button>
          <button style={{ ...(saving ? SS.submitBtnDisabled : SS.submitBtn), flex: 2 }} onClick={() => { void save(); }} disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save recipe'}
          </button>
        </div>
      </div>

      {/* ── ④ THE ITEM PICKER — WHICH PRODUCT THIS COMPONENT IS ── */}
      {picking && (
        <div style={SS.modal} onClick={e => { if (e.target === e.currentTarget) setPicking(null); }}>
          <div style={SS.sheet}>
            <div style={SS.sheetHeader}>
              <div>
                <h2 style={{ ...SS.sectionTitle, margin: 0 }}>Which product is {draft.components[picking.index]?.name || 'this'}?</h2>
                <p style={{ ...SS.muted, margin: '2px 0 0' }}>A build takes it off this product&rsquo;s shelf stock.</p>
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} onClick={() => setPicking(null)} aria-label="Close">
                <X size={20} color="#6b7280" />
              </button>
            </div>
            <div style={SS.sheetBody}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={SS.input} value={picking.term} autoFocus
                  placeholder="Name, SKU or QuickBooks code"
                  onChange={e => setPicking(p => p && ({ ...p, term: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') void runSearch(); }} />
                <button style={SS.primaryBtn} onClick={() => { void runSearch(); }}>
                  <Search size={15} /> Search
                </button>
              </div>
              {picking.searching && <p style={SS.hint}>Looking…</p>}
              {!picking.searching && picking.results.length === 0 && picking.term.trim().length >= 2 && (
                <p style={SS.hint}>
                  Nothing matches. Leave it unlinked — the recipe still costs, and a build will say it
                  could not take this one off the shelf rather than pretending it did.
                </p>
              )}
              {picking.results.map(pr => (
                <div key={pr.inventoryId} style={{ ...panel, marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.92rem', color: '#111827' }}>
                      <b>{pr.name}</b>{pr.size ? ` · ${pr.size}` : ''}
                    </p>
                    <p style={{ ...SS.muted, margin: '2px 0 0' }}>
                      {pr.sku ? `SKU ${pr.sku}` : 'no SKU'} · {pr.qty} on hand
                      {pr.qbItemId ? '' : ' · ⚠ no QuickBooks id'}
                    </p>
                  </div>
                  <button style={SS.primaryBtn} disabled={!pr.qbItemId}
                    onClick={() => { setComponent(picking.index, { componentQbItemId: pr.qbItemId }); setPicking(null); setNotice(`Linked to ${pr.name}. A build will take it off that product's stock.`); }}>
                    {pr.qbItemId ? 'This one' : 'Cannot link'}
                  </button>
                </div>
              ))}
              {/* 🔴 A ROW WITH NO QUICKBOOKS ID CANNOT BE LINKED, AND SAYS WHY RATHER THAN BEING
                  HIDDEN. A recipe keyed on a row id does not survive the next catalogue reload —
                  the database refuses it outright. Showing the row greyed tells a person the
                  product exists and what to fix; hiding it would read as "we do not stock that". */}
              {picking.results.some(r => !r.qbItemId) && (
                <p style={{ ...SS.hint, color: '#92400e' }}>
                  A product with no QuickBooks id cannot be linked — a recipe keyed on a row id would
                  not survive the next catalogue reload.
                </p>
              )}
            </div>
            <div style={SS.sheetActions}>
              <button style={{ ...SS.addBtn, flex: 1, justifyContent: 'center', minHeight: 48 }}
                onClick={() => { setComponent(picking.index, { componentQbItemId: null }); setPicking(null); }}>
                Leave it unlinked
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── THE PROPOSAL SHEET — one question per line, answered yes or no ── */}
      {matching && (
        <div style={SS.modal} onClick={e => { if (e.target === e.currentTarget) setMatching(null); }}>
          <div style={SS.sheet}>
            <div style={SS.sheetHeader}>
              <h2 style={{ ...SS.sectionTitle, margin: 0 }}>Which purchase is {draft.components[matching.index]?.name}?</h2>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} onClick={() => setMatching(null)} aria-label="Close">
                <X size={20} color="#6b7280" />
              </button>
            </div>
            <div style={SS.sheetBody}>
              {matching.proposals.length === 0 && (
                <p style={SS.hint}>
                  Nothing on your captured receipts resembles that name. It stays uncosted, and the batch will say so —
                  which is the honest answer, not a failure.
                </p>
              )}
              {matching.collapsed > 0 && (
                <p style={SS.hint}>
                  {matching.collapsed} repeat capture{matching.collapsed === 1 ? '' : 's'} of a receipt you already have
                  {matching.collapsed === 1 ? ' was' : ' were'} set aside, so one invoice is offered once.
                </p>
              )}
              {matching.proposals.map((p, i) => (
                <div key={i} style={{ ...panel, marginTop: 10,
                  // ⑤ The NEWEST purchase of a product is the default and LOOKS like it; the older
                  // ones are one tap away, dimmed, never hidden.
                  opacity: p.isNewestForProduct === false ? 0.72 : 1,
                  borderColor: p.isNewestForProduct ? '#27500A' : '#dbe5d0' }}>
                  {p.isNewestForProduct && (p.otherPurchasesOfThisProduct ?? 0) > 0 && (
                    <p style={{ ...SS.muted, margin: '0 0 4px' }}>
                      Most recent purchase · {p.otherPurchasesOfThisProduct} older one
                      {p.otherPurchasesOfThisProduct === 1 ? '' : 's'} below
                    </p>
                  )}
                  <p style={{ margin: '0 0 4px', fontSize: '0.92rem', color: '#111827' }}>{proposalSentence(p)}</p>
                  {/* 🔴 A PRICE CHANGE IS CALLED OUT — a rise nobody noticed is how a recipe drifts. */}
                  {p.priceChange && (
                    <p style={{ margin: '0 0 4px', fontSize: '0.82rem', fontWeight: 700,
                                color: p.priceChange.direction === 'up' ? '#b91c1c' : '#166534' }}>
                      {p.priceChange.note}
                    </p>
                  )}
                  <p style={{ ...SS.muted, margin: '0 0 8px' }}>{p.because}</p>
                  {p.landedRefusal
                    ? <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: '#b91c1c' }}>That receipt does not add up, so it can give no landed cost: {p.landedRefusal}</p>
                    : <p style={{ ...SS.muted, margin: '0 0 8px' }}>
                        Landed {money(p.landedPackCostEqualPerItem)} split evenly · {money(p.landedPackCostProRataByValue)} split by value
                      </p>}
                  <button style={SS.primaryBtn} onClick={() => confirm(p)}>Yes, that is it</button>
                </div>
              ))}
            </div>
            <div style={SS.sheetActions}>
              <button style={{ ...SS.addBtn, flex: 1, justifyContent: 'center', minHeight: 48 }} onClick={() => setMatching(null)}>
                None of these
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
