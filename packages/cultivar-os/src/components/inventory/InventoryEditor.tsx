// ============================================================
// InventoryEditor — the ONE grouped inventory item editor (Cultivar OS)
// PURPOSE:      The SINGLE business_inventory form (STD-011, mirroring the #119 CustomerPartyEditor)
//               — BOTH "Add Item" (create), per-row "Edit", and "+ Add size" (create seeded from a
//               parent row) render THIS component, so a field can never drift between two forms. The
//               old flat Add-Item sheet on BusinessInventory is retired. Sections: Identity ·
//               Size & Grouping · Pricing · Stock · Notes.
// MODES:        The ONLY differences between create and edit are (a) title, (b) empty-vs-populated
//               initial values, (c) insert-vs-per-field-save. Everything else is identical.
//               CREATE: buffer all fields locally, ONE insert on "Save item" (name + sell_price>0
//               required — D-35, nothing born unsellable). EDIT: per-field auto-save (text on blur,
//               numbers/selects on change) — each an owner/member RLS write via the shared helpers.
// ADD-SIZE:     `addSizeParent` seeds a CREATE with the parent's name (inherited, read-only) and its
//               variant_group. If the parent's variant_group is NULL, a group slug is derived from
//               the name (variantGroupSlug — SHARED with D-45's count-promote) and the PARENT is
//               backfilled to that group on save, so parent + new sibling share ONE group and the
//               size-picker fires by construction (never half-grouped).
// DEPENDENCIES: useBusinessContext (businessId → RLS scope), sheetStyles (SS), the shared
//               inventoryEdit helpers (insert/patch/rename), variantGroupSlug (@trace/shared).
//               NO migration, NO new dep, NO endpoint.
// INSTRUMENTATION (STD-003): `[TRACE:INVENTORY]` via the shared helpers, ON by default.
// ============================================================
import { useState } from 'react';
import { X } from 'lucide-react';
import { useBusinessContext } from '@trace/shared/context';
import { variantGroupSlug, deriveSiblingSku } from '@trace/shared/inventory';
import { sheetStyles as SS } from '../datasheet/DataSheet';
import { insertInventory, persistInventoryPatch, renameVariety } from './inventoryEdit';

export type CostConfidence = 'CONFIRMED' | 'DERIVED' | 'ESTIMATED' | 'UNKNOWN';

/** The item the editor reads/writes — the owner-editable subset of an inventory row. */
export interface EditorInventoryItem {
  id: string;
  name: string;
  sku: string | null;
  qty: number;
  size: string | null;
  variant_group: string | null;
  sell_price: number | null;
  unit_cost: number | null;
  cost_confidence: CostConfidence | null;
  reorder_point: number | null;
  location: string | null;
  status: string;
  notes: string | null;
}

/** A blank item for CREATE mode (the retired flat Add form's replacement start-state). */
export const BLANK_INVENTORY_ITEM: EditorInventoryItem = {
  id: '', name: '', sku: null, qty: 0, size: null, variant_group: null,
  sell_price: null, unit_cost: null, cost_confidence: null, reorder_point: null,
  location: null, status: 'available', notes: null,
};

interface Props {
  item: EditorInventoryItem;
  mode: 'create' | 'edit';
  statusOptions: string[];
  /** When set, this CREATE is a "+ Add size" seeded from a parent row: name + variant_group are
   *  inherited (name read-only), and the parent is auto-grouped on save if it had no group. The
   *  sibling's SKU pre-fills as parent-SKU + size-suffix (deriveSiblingSku) — editable, and blank
   *  when the parent has no SKU (D-9, never fabricate a base). */
  addSizeParent?: { id: string; name: string; variant_group: string | null; sku: string | null };
  /** Every OTHER row's SKU (lowercased) — a SKU identifies ONE sellable unit, so two rows may never
   *  share one; a create/edit that would collide is blocked (never a silent duplicate). */
  existingSkus?: Set<string>;
  onClose: () => void;
  onSaved: () => void;
}

const groupTitle: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase',
  letterSpacing: '0.06em', margin: '18px 0 8px', paddingBottom: 4, borderBottom: '1px solid #f0f0f0',
};
const RED = '#A32D2D';
function errBorder(hasErr: boolean): React.CSSProperties {
  return hasErr ? { borderColor: RED, boxShadow: `0 0 0 1px ${RED}` } : {};
}

// Resolve the group a "+ Add size" sibling (and its backfilled parent) share: the parent's existing
// non-null group, else a slug derived from the parent's name (SHARED with D-45's promote — STD-011).
function addSizeGroup(parent: { name: string; variant_group: string | null }): string {
  return parent.variant_group?.trim() || variantGroupSlug(parent.name);
}

export function InventoryEditor({ item, mode, statusOptions, addSizeParent, existingSkus, onClose, onSaved }: Props) {
  const { businessId } = useBusinessContext();
  const creating = mode === 'create';
  const isAddSize = creating && !!addSizeParent;
  const knownSkus = existingSkus ?? new Set<string>();

  // Seed: an add-size create inherits the parent name + resolved group. The SKU is left blank at
  // seed (no size yet); it auto-derives to parent-SKU + suffix as the owner types the size below.
  const seed: EditorInventoryItem = isAddSize
    ? { ...item, name: addSizeParent!.name, variant_group: addSizeGroup(addSizeParent!) }
    : item;

  const [draft, setDraft] = useState<EditorInventoryItem>(seed);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  // Once the owner edits the SKU by hand, stop auto-deriving it from the size (add-size mode).
  const [skuTouched, setSkuTouched] = useState(false);

  // A SKU collision check (case-insensitive) — the typed SKU may not match any OTHER row's SKU.
  const skuCollides = (sku: string) => knownSkus.has(sku.trim().toLowerCase());

  const set = (patch: Partial<EditorInventoryItem>) => {
    setDraft(d => ({ ...d, ...patch }));
    setErrors(e => {
      const k = Object.keys(patch)[0];
      return e[k] ? { ...e, [k]: '' } : e;
    });
  };

  // ── numeric parse helpers ──
  const numOrNull = (raw: string): number | null => {
    const t = raw.trim();
    if (t === '') return null;
    const n = Number(t.replace(/[$,]/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  // ── EDIT-mode per-field savers (auto-save; each an owner/member RLS write via the shared helper) ──
  async function saveText(field: 'sku' | 'size' | 'variant_group' | 'location' | 'notes', raw: string) {
    const value = raw.trim() === '' ? null : raw.trim();
    if (value === (draft[field] ?? null)) return;
    // SKU uniqueness — refuse a value that collides with another row (never a silent duplicate).
    if (field === 'sku' && value && skuCollides(value)) {
      setErrors(e => ({ ...e, sku: `SKU "${value}" is already used by another item — SKUs must be unique.` }));
      return;
    }
    setSavingField(field);
    const res = await persistInventoryPatch({ id: draft.id, businessId: businessId!, patch: { [field]: value } });
    setSavingField(null);
    if (res.error) { setError(res.error); return; }
    set({ [field]: value } as Partial<EditorInventoryItem>); setError(null); onSaved();
  }
  async function saveName(raw: string) {
    const name = raw.trim();
    if (name === '' || name === draft.name) return; // NOT NULL — never blank
    setSavingField('name');
    const res = await renameVariety({ businessId: businessId!, rowId: draft.id, variantGroup: draft.variant_group, newName: name });
    setSavingField(null);
    if (res.error) { setError(res.error); return; }
    set({ name }); setError(null); onSaved();
  }
  async function saveNumber(field: 'qty' | 'reorder_point', raw: string) {
    const v = numOrNull(raw);
    // qty is NOT NULL (blank/invalid → keep current); reorder_point is nullable.
    if (field === 'qty' && (v == null || v < 0)) return;
    if (v != null && v < 0) return;
    if (v === (draft[field] ?? null)) return;
    setSavingField(field);
    const res = await persistInventoryPatch({ id: draft.id, businessId: businessId!, patch: { [field]: v } });
    setSavingField(null);
    if (res.error) { setError(res.error); return; }
    set({ [field]: v } as Partial<EditorInventoryItem>); setError(null); onSaved();
  }
  async function saveSellPrice(raw: string) {
    const v = numOrNull(raw); // nullable on edit (the grid allows clearing; the cart refuses $0/null — D-9)
    if (v === (draft.sell_price ?? null)) return;
    setSavingField('sell_price');
    const res = await persistInventoryPatch({ id: draft.id, businessId: businessId!, patch: { sell_price: v } });
    setSavingField(null);
    if (res.error) { setError(res.error); return; }
    set({ sell_price: v }); setError(null); onSaved();
  }
  async function saveUnitCost(raw: string) {
    const v = numOrNull(raw);
    if (v === (draft.unit_cost ?? null)) return;
    // Coherence (mirrors the grid): typed cost → CONFIRMED; cleared → UNKNOWN.
    const conf: CostConfidence = v == null ? 'UNKNOWN' : 'CONFIRMED';
    setSavingField('unit_cost');
    const res = await persistInventoryPatch({ id: draft.id, businessId: businessId!, patch: { unit_cost: v, cost_confidence: conf } });
    setSavingField(null);
    if (res.error) { setError(res.error); return; }
    set({ unit_cost: v, cost_confidence: conf }); setError(null); onSaved();
  }
  async function saveStatus(value: string) {
    if (value === draft.status) return;
    setSavingField('status');
    const res = await persistInventoryPatch({ id: draft.id, businessId: businessId!, patch: { status: value } });
    setSavingField(null);
    if (res.error) { setError(res.error); return; }
    set({ status: value }); setError(null); onSaved();
  }

  // ── CREATE — validate (name required; sell_price required & > 0 — D-35) then ONE insert.
  //    Add-size backfills the parent's group first so parent + sibling share ONE group. ──
  async function saveCreate() {
    if (!businessId) return;
    const errs: Record<string, string> = {};
    if (!draft.name.trim()) errs.name = 'Name is required.';
    if (draft.qty == null || draft.qty < 0) errs.qty = 'Quantity must be 0 or greater.';
    if (draft.sell_price == null) errs.sell_price = 'Sell price is required — enter what the customer pays.';
    else if (draft.sell_price <= 0) errs.sell_price = 'Sell price must be greater than $0 so the item can be sold.';
    // SKU uniqueness — a derived-or-typed SKU may never collide with an existing row (D-9: flag, never
    // silently duplicate; two rows sharing a SKU are indistinguishable in QBO/stock lookups).
    const skuVal = draft.sku?.trim();
    if (skuVal && skuCollides(skuVal)) errs.sku = `SKU "${skuVal}" is already used by another item — change it so it's unique.`;
    if (Object.keys(errs).length) { setErrors(errs); setError(null); return; }
    setErrors({});

    const unitCost = draft.unit_cost;
    const values: Record<string, unknown> = {
      name: draft.name.trim(),
      qty: draft.qty,
      status: draft.status,
      sell_price: draft.sell_price,
      cost_confidence: unitCost != null ? 'CONFIRMED' : 'UNKNOWN',
    };
    if (unitCost != null) values.unit_cost = unitCost;
    if (draft.sku?.trim()) values.sku = draft.sku.trim();
    if (draft.size?.trim()) values.size = draft.size.trim();
    if (draft.variant_group?.trim()) values.variant_group = draft.variant_group.trim();
    if (draft.location?.trim()) values.location = draft.location.trim();
    if (draft.notes?.trim()) values.notes = draft.notes.trim();
    if (draft.reorder_point != null) values.reorder_point = draft.reorder_point;

    setSaving(true); setError(null);
    // Add-size: if the parent had no group, backfill it to the shared group FIRST (never half-grouped).
    if (isAddSize && addSizeParent && (addSizeParent.variant_group?.trim() ?? '') === '') {
      const grp = addSizeGroup(addSizeParent);
      const pr = await persistInventoryPatch({ id: addSizeParent.id, businessId, patch: { variant_group: grp } });
      if (pr.error) { setSaving(false); setError(`Could not group the parent row: ${pr.error}`); return; }
    }
    const res = await insertInventory({ businessId, values });
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    onSaved(); onClose();
  }

  const title = isAddSize ? `Add size — ${addSizeParent!.name}` : creating ? 'Add Inventory Item' : 'Edit Inventory Item';

  // Field wiring. THE PERSIST-BUG FIX (ISSUE 1): in EDIT mode the input is UNCONTROLLED
  // (defaultValue + onBlur, no onChange) — mirroring the name/price/qty fields — so `draft` still
  // holds the SAVED value when saveText's equality guard runs. Previously it was controlled in BOTH
  // modes (value + onChange updated draft on every keystroke), so by blur time draft already held the
  // typed value → the `value === draft[field]` guard short-circuited → the typed SKU/size/etc. never
  // persisted. CREATE mode stays controlled (value + onChange) so the buffered insert sees every key.
  const textInput = (
    field: 'sku' | 'size' | 'variant_group' | 'location',
    onCreateChange?: (v: string) => void,
    extra?: React.CSSProperties,
  ): React.InputHTMLAttributes<HTMLInputElement> =>
    creating
      ? {
          style: { ...SS.input, ...extra },
          value: (draft[field] as string) ?? '',
          onChange: e => (onCreateChange ? onCreateChange(e.target.value) : set({ [field]: e.target.value } as Partial<EditorInventoryItem>)),
        }
      : {
          style: { ...SS.input, ...extra },
          defaultValue: (draft[field] as string) ?? '',
          disabled: savingField === field,
          onBlur: (e: React.FocusEvent<HTMLInputElement>) => { void saveText(field, e.target.value); },
        };

  // "+ Add size" size change: auto-derive the sibling SKU (parent SKU + size suffix — SHARED helper,
  // STD-011) until the owner edits the SKU by hand. ONE setDraft so size + derived SKU move together.
  const onSizeCreateChange = (size: string) => {
    if (isAddSize && !skuTouched) {
      const derived = deriveSiblingSku(addSizeParent!.sku, size);
      setDraft(d => ({ ...d, size, sku: derived ?? '' }));
      setErrors(e => (e.sku ? { ...e, sku: '' } : e));
    } else {
      set({ size });
    }
  };
  // Hand-editing the SKU marks it touched (stops auto-derive) and buffers the value.
  const onSkuCreateChange = (v: string) => { setSkuTouched(true); set({ sku: v }); };

  return (
    <div style={SS.modal} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={SS.sheet}>
        <div style={SS.sheetHeader}>
          <h2 style={{ ...SS.sectionTitle, margin: 0 }}>{title}</h2>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} onClick={onClose}>
            <X size={20} color="#6b7280" />
          </button>
        </div>
        {error && <div style={SS.error}>{error}</div>}

        {/* ── IDENTITY ── */}
        <div style={groupTitle}>Identity</div>
        <div style={SS.field}>
          <label style={SS.label}>Name *</label>
          {isAddSize ? (
            <>
              <input style={{ ...SS.input, background: '#f3f4f6', color: '#374151' }} value={draft.name} readOnly />
              <p style={SS.hint}>Inherited from the variety you're adding a size to — keeps the sizes grouped.</p>
            </>
          ) : creating ? (
            <input style={{ ...SS.input, ...errBorder(!!errors.name) }} value={draft.name}
              onChange={e => set({ name: e.target.value })} placeholder="e.g. Shoal Creek Vitex, Netting 6×12" />
          ) : (
            <input style={{ ...SS.input, ...errBorder(!!errors.name) }} defaultValue={draft.name} disabled={savingField === 'name'}
              onBlur={e => { void saveName(e.target.value); }} placeholder="Variety / item name" />
          )}
          {errors.name && <p style={{ margin: '3px 0 0', fontSize: '0.75rem', fontWeight: 600, color: RED }}>{errors.name}</p>}
          {!creating && draft.variant_group?.trim() && (
            <p style={SS.hint}>This variety has size-siblings — renaming updates the whole group so the sizes stay linked.</p>
          )}
        </div>
        <div style={SS.field}>
          <label style={SS.label}>SKU</label>
          <input {...textInput('sku', onSkuCreateChange, errBorder(!!errors.sku))}
            placeholder={isAddSize ? 'Auto-fills from the size — editable' : 'Optional'} />
          {errors.sku && <p style={{ margin: '3px 0 0', fontSize: '0.75rem', fontWeight: 600, color: RED }}>{errors.sku}</p>}
          {isAddSize && addSizeParent!.sku && (
            <p style={SS.hint}>Suggested from the parent SKU <b>{addSizeParent!.sku}</b> + the size — edit if yours differs. The parent's SKU is left unchanged.</p>
          )}
        </div>

        {/* ── SIZE & GROUPING ── */}
        <div style={groupTitle}>Size &amp; grouping</div>
        <div style={{ ...SS.row2, ...SS.field }}>
          <div>
            <label style={SS.label}>Size</label>
            <input {...textInput('size', onSizeCreateChange)} placeholder="e.g. 30 gal, 45 gal" />
          </div>
          <div>
            <label style={SS.label}>Variant group</label>
            {isAddSize ? (
              <input style={{ ...SS.input, background: '#f3f4f6', color: '#374151' }} value={draft.variant_group ?? ''} readOnly />
            ) : (
              <input {...textInput('variant_group')} placeholder="Groups sizes of one variety" />
            )}
          </div>
        </div>
        <p style={SS.hint}>
          Two rows that share a variant group and have distinct sizes become selectable sizes of one variety at checkout.
          {isAddSize && ' The group is set on this size and the parent so the size-picker fires.'}
        </p>

        {/* ── PRICING ── */}
        <div style={groupTitle}>Pricing</div>
        <div style={{ ...SS.row2, ...SS.field }}>
          <div>
            <label style={SS.label}>Sell price *</label>
            <input style={{ ...SS.input, ...errBorder(!!errors.sell_price) }} type="number" step="0.01" min="0"
              defaultValue={creating ? undefined : (draft.sell_price ?? '')}
              value={creating ? (draft.sell_price ?? '') : undefined}
              disabled={savingField === 'sell_price'}
              onChange={creating ? e => set({ sell_price: numOrNull(e.target.value) }) : undefined}
              onBlur={creating ? undefined : e => { void saveSellPrice(e.target.value); }}
              placeholder="What the customer pays" />
            {errors.sell_price && <p style={{ margin: '3px 0 0', fontSize: '0.75rem', fontWeight: 600, color: RED }}>{errors.sell_price}</p>}
          </div>
          <div>
            <label style={SS.label}>Unit cost</label>
            <input style={SS.input} type="number" step="0.01" min="0"
              defaultValue={creating ? undefined : (draft.unit_cost ?? '')}
              value={creating ? (draft.unit_cost ?? '') : undefined}
              disabled={savingField === 'unit_cost'}
              onChange={creating ? e => set({ unit_cost: numOrNull(e.target.value) }) : undefined}
              onBlur={creating ? undefined : e => { void saveUnitCost(e.target.value); }}
              placeholder="Optional — what you paid" />
          </div>
        </div>
        <p style={SS.hint}>Sell price is the retail price at checkout. Unit cost is what you paid — a typed cost is marked Confirmed, blank stays Unknown.</p>

        {/* ── STOCK ── */}
        <div style={groupTitle}>Stock</div>
        <div style={{ ...SS.row3, ...SS.field }}>
          <div>
            <label style={SS.label}>Quantity *</label>
            <input style={{ ...SS.input, ...errBorder(!!errors.qty) }} type="number" min="0"
              defaultValue={creating ? undefined : draft.qty}
              value={creating ? draft.qty : undefined}
              disabled={savingField === 'qty'}
              onChange={creating ? e => set({ qty: numOrNull(e.target.value) ?? 0 }) : undefined}
              onBlur={creating ? undefined : e => { void saveNumber('qty', e.target.value); }} />
            {errors.qty && <p style={{ margin: '3px 0 0', fontSize: '0.75rem', fontWeight: 600, color: RED }}>{errors.qty}</p>}
          </div>
          <div>
            <label style={SS.label}>Reorder point</label>
            <input style={SS.input} type="number" min="0"
              defaultValue={creating ? undefined : (draft.reorder_point ?? '')}
              value={creating ? (draft.reorder_point ?? '') : undefined}
              disabled={savingField === 'reorder_point'}
              onChange={creating ? e => set({ reorder_point: numOrNull(e.target.value) }) : undefined}
              onBlur={creating ? undefined : e => { void saveNumber('reorder_point', e.target.value); }}
              placeholder="Optional" />
          </div>
          <div>
            <label style={SS.label}>Status</label>
            <select style={SS.select} value={draft.status} disabled={savingField === 'status'}
              onChange={e => { if (creating) set({ status: e.target.value }); else void saveStatus(e.target.value); }}>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* ── NOTES ── */}
        <div style={groupTitle}>Notes</div>
        <div style={{ ...SS.field, marginBottom: 8 }}>
          <div>
            <label style={SS.label}>Location</label>
            <input {...textInput('location')} placeholder="e.g. Shed A, Greenhouse 2" />
          </div>
        </div>
        <div style={SS.field}>
          <label style={SS.label}>Notes (internal)</label>
          {/* Same persist-bug fix as textInput: EDIT is uncontrolled (defaultValue + onBlur) so the
              equality guard sees the saved value; CREATE is controlled so the insert buffers keystrokes. */}
          <textarea style={{ ...SS.input, minHeight: 64, resize: 'vertical' }}
            disabled={savingField === 'notes'}
            {...(creating
              ? { value: draft.notes ?? '', onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => set({ notes: e.target.value }) }
              : { defaultValue: draft.notes ?? '', onBlur: (e: React.FocusEvent<HTMLTextAreaElement>) => { void saveText('notes', e.target.value); } })}
            placeholder="Supplier, purchase context, storage notes…" />
        </div>

        {creating ? (
          <button type="button" onClick={() => { void saveCreate(); }} disabled={saving}
            style={saving ? SS.submitBtnDisabled : { ...SS.submitBtn, marginTop: 6 }}>
            {saving ? 'Saving…' : isAddSize ? 'Save size' : 'Save item'}
          </button>
        ) : (
          <p style={SS.hint}>Changes save automatically as you edit. Close when you're done.</p>
        )}
      </div>
    </div>
  );
}
