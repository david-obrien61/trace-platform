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
import { X, Plus, Trash2, Link2, Check } from 'lucide-react';
import { useBusinessContext } from '@trace/shared/context';
import { sheetStyles as SS } from '@trace/shared/components/datasheet/DataSheet';
import { proposeMatches, proposalSentence, type CapturedReceipt, type MatchProposal } from '@trace/shared/costing/receiptMatch';
import { suggestedPrice } from '@trace/shared/costing/recipeCost';
import {
  draftCost, emptyComponentDraft, emptyRecipeDraft, maySuggestPrice, recipeDraftProblems,
  type ComponentDraft, type RecipeDraft,
} from '../../lib/recipeDraft';
import {
  componentIdsByPosition, confirmComponentPurchase, loadRecipe, readReceiptsForMatching, saveRecipe,
} from '../../lib/recipeWrite';

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
      const [got, rec] = await Promise.all([
        loadRecipe(businessId, { qbItemId: item.qbItemId, inventoryId: item.id }),
        readReceiptsForMatching(businessId),
      ]);
      if (!live) return;
      if (!got.ok) setError(got.message);
      else if (got.recipe) { setRecipeId(got.recipe.recipeId); setDraft(got.recipe.draft); }
      if (!rec.ok) setReceiptsProblem(rec.message);
      else setReceipts(rec.receipts);
      setLoading(false);
    })();
    return () => { live = false; };
  }, [businessId, item.id, item.qbItemId]);

  const cost = useMemo(() => draftCost(draft, { spread }), [draft, spread]);
  const problems = useMemo(() => recipeDraftProblems(draft), [draft]);

  const setComponent = (i: number, patch: Partial<ComponentDraft>) =>
    setDraft(d => ({ ...d, components: d.components.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

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
  async function confirm(p: MatchProposal) {
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
    const res = await saveRecipe(businessId, draft, recipeId);
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
              {/* ── ONE BATCH ── */}
              <div style={groupTitle}>One batch</div>
              <div style={{ ...SS.row2, ...SS.field }}>
                <div>
                  <label style={SS.label}>Makes *</label>
                  <input style={SS.input} value={draft.yieldQuantity} inputMode="decimal"
                    onChange={e => setDraft(d => ({ ...d, yieldQuantity: e.target.value }))}
                    placeholder="e.g. 2.5" />
                </div>
                <div>
                  <label style={SS.label}>Of *</label>
                  <input style={SS.input} value={draft.yieldUnit}
                    onChange={e => setDraft(d => ({ ...d, yieldUnit: e.target.value }))}
                    placeholder="yd, each, lb" />
                </div>
              </div>
              <div style={{ ...SS.row2, ...SS.field }}>
                <div>
                  <label style={SS.label}>Build time (minutes)</label>
                  <input style={SS.input} value={draft.buildMinutes} inputMode="numeric"
                    onChange={e => setDraft(d => ({ ...d, buildMinutes: e.target.value }))}
                    placeholder="Leave blank if nobody has timed it" />
                </div>
                <div>
                  <label style={SS.label}>Where that came from</label>
                  <input style={SS.input} value={draft.buildMinutesBecause}
                    onChange={e => setDraft(d => ({ ...d, buildMinutesBecause: e.target.value }))} />
                </div>
              </div>

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
                      {costed?.refusal && !c.purchase && null}
                      {costed?.refusal && c.purchase && (
                        <span style={{ color: '#b91c1c' }}>{costed.refusal}</span>
                      )}
                      {costed?.cost != null && (
                        <span style={SS.muted}>{money(costed.cost)} a batch</span>
                      )}
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
                    <b>{money(cost.costPerYieldUnit)} per {draft.yieldUnit || 'unit'}</b>
                    {cost.incomplete && <span style={SS.muted}> — so far</span>}
                  </p>
                )}
                {cost.incomplete && <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: '#92400e' }}>{cost.incompleteNote}</p>}
                {/* 🔴 The suggestion is ABSENT while incomplete, not greyed — David, 2026-09-22. */}
                {suggestion?.price != null ? (
                  <p style={{ margin: '8px 0 0', fontSize: '0.88rem', color: '#374151' }}>
                    A 40% markup would be <b>{money(suggestion.price)}</b> per {draft.yieldUnit || 'unit'}. {suggestion.how}
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
                <div key={i} style={{ ...panel, marginTop: 10 }}>
                  <p style={{ margin: '0 0 4px', fontSize: '0.92rem', color: '#111827' }}>{proposalSentence(p)}</p>
                  <p style={{ ...SS.muted, margin: '0 0 8px' }}>{p.because}</p>
                  {p.landedRefusal
                    ? <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: '#b91c1c' }}>That receipt does not add up, so it can give no landed cost: {p.landedRefusal}</p>
                    : <p style={{ ...SS.muted, margin: '0 0 8px' }}>
                        Landed {money(p.landedPackCostEqualPerItem)} split evenly · {money(p.landedPackCostProRataByValue)} split by value
                      </p>}
                  <button style={SS.primaryBtn} onClick={() => { void confirm(p); }}>Yes, that is it</button>
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
