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
// THE INVARIANT (D-49, and this editor is the OTHER path that must honour it — ledger #135):
//               any path that mints a row in a variety family leaves that family PICKER-READY BY
//               CONSTRUCTION — every row grouped, every size NON-EMPTY and DISTINCT, SKU derived
//               from the family's BASE. The count path proved this live on 2026-07-16; this editor
//               violated it three ways and each one was minted through the UI the same afternoon:
//                 • no SIZE-uniqueness guard → "+ Add size" on Acoma Crape Myrtle with size "15"
//                   minted DISC-1002-15G beside DISC-1002 (same group, same size) — CASE 5, live.
//                   SKU-unique PASSED, because a SKU and a variant are TWO DIFFERENT FACTS.
//                 • no size-REQUIRED rule for a row joining a group (the blank-size landmine).
//                 • the CLICKED row was handed to deriveSiblingSku as the SKU base → the live
//                   DISC-1003-30G-45G; the next would have been DISC-1003-30G-45G-15G.
//               All three now route through the SHARED rules the count path already uses, so the
//               two minting paths cannot drift (STD-011): findSizeTwin (the guard whose detector
//               sibling puts the amber flag on the grid) + suggestSiblingSku (base + suffix).
// DEPENDENCIES: useBusinessContext (businessId → RLS scope), sheetStyles (SS), the shared
//               inventoryEdit helpers (insert/patch/rename), variantGroupSlug + suggestSiblingSku
//               (@trace/shared/inventory), findSizeTwin (@trace/shared/discovery/dupSize), the
//               shared FIX 5 errBorder/FieldError. NO migration, NO new dep, NO endpoint.
// INSTRUMENTATION (STD-003): `[TRACE:INVENTORY]` via the shared helpers, ON by default.
// ============================================================
import { useState } from 'react';
import { X } from 'lucide-react';
import { useBusinessContext } from '@trace/shared/context';
import { variantGroupSlug, suggestSiblingSku, baseSkuOf } from '@trace/shared/inventory';
import { findSizeTwin } from '@trace/shared/discovery/dupSize';
import { errBorder, FieldError } from '@trace/shared/components/FieldError';
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

/** A peer inventory row, as the editor's guards need to see it. The editor is handed the tenant's
 *  rows (business_id-scoped by the caller's query — AC-3) so it can answer two questions the shipped
 *  version could not: is this SKU taken, and is this (variant_group, size) taken? */
export interface InventoryPeer {
  id: string;
  size: string | null;
  variant_group: string | null;
  sku: string | null;
  name: string;
}

interface Props {
  item: EditorInventoryItem;
  mode: 'create' | 'edit';
  statusOptions: string[];
  /** When set, this CREATE is a "+ Add size" seeded from a parent row: name + variant_group are
   *  inherited (name read-only), and the parent is auto-grouped on save if it had no group. The
   *  sibling's SKU pre-fills from the FAMILY's base SKU + the size suffix (suggestSiblingSku) —
   *  editable, and blank when no row in the family has a SKU (D-9, never fabricate a base). */
  addSizeParent?: { id: string; name: string; variant_group: string | null; sku: string | null };
  /** EVERY inventory row of this tenant. The editor derives its own guards from these — the SKU
   *  set AND the (variant_group, size) uniqueness check — so a caller cannot supply one and forget
   *  the other (which is exactly how the size guard came to be missing while the SKU guard shipped). */
  peers?: InventoryPeer[];
  onClose: () => void;
  onSaved: () => void;
}

const groupTitle: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase',
  letterSpacing: '0.06em', margin: '18px 0 8px', paddingBottom: 4, borderBottom: '1px solid #f0f0f0',
};

// Resolve the group a "+ Add size" sibling (and its backfilled parent) share: the parent's existing
// non-null group, else a slug derived from the parent's name (SHARED with D-45's promote — STD-011).
function addSizeGroup(parent: { name: string; variant_group: string | null }): string {
  return parent.variant_group?.trim() || variantGroupSlug(parent.name);
}

export function InventoryEditor({ item, mode, statusOptions, addSizeParent, peers, onClose, onSaved }: Props) {
  const { businessId } = useBusinessContext();
  const creating = mode === 'create';
  const isAddSize = creating && !!addSizeParent;
  const allPeers = peers ?? [];
  // Every OTHER row (never this one) — the basis of both uniqueness guards. Excluding self here,
  // once, is why re-saving a row its own SKU or its own size can never false-collide.
  const otherRows = allPeers.filter(r => r.id !== item.id);
  const knownSkus = new Set(otherRows.map(r => (r.sku ?? '').trim().toLowerCase()).filter(Boolean));

  // The family this row belongs to: the rows sharing its group. Used for the SKU BASE — the live
  // DISC-1003-30G-45G exists because the editor took the CLICKED row's SKU instead of the family's.
  const addSizeFamily = isAddSize
    ? allPeers.filter(r => (r.variant_group ?? '').trim() === addSizeGroup(addSizeParent!)
                        || r.id === addSizeParent!.id)
    : [];
  // Shown in the hint so the owner can SEE which SKU the suggestion descends from — the whole
  // defect was an invisible wrong base, and a hint naming the clicked row would have looked right.
  const baseSku = isAddSize ? baseSkuOf(addSizeFamily) : null;

  // Seed: an add-size create inherits the parent name + resolved group. The SKU is left blank at
  // seed (no size yet); it auto-derives from the FAMILY's base SKU + suffix as the owner types
  // the size below.
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

  // ── THE SIZE RULE — ONE spelling, serving BOTH the create validation and the per-field edit save
  //    (STD-011; §1.6 item 3). Returns the message to show, or null when the size is fine.
  //
  //    A row that is IN a variety family (it carries a variant_group) must have a NON-EMPTY size
  //    that is DISTINCT within that family — that is `detectSizeCollision`'s contract, which is what
  //    decides whether a scan resolves or goes UNKNOWN. A row with NO group is a standalone item
  //    (netting, a tool) and needs no size: the condition is the invariant stated exactly, NOT a
  //    convenience conditional. "+ Add size" always joins a family, so it is always covered.
  //
  //    Both halves are enforced because both were minted live on 2026-07-16 — a same-size twin
  //    (Acoma) and a blank size (Alley Cat, via the count's sheet). Neither is cosmetic: each one
  //    makes the whole variety unscannable.
  function sizeError(group: string | null | undefined, size: string | null | undefined, selfId: string): string | null {
    const grp = (group ?? '').trim();
    if (!grp) return null;                        // standalone item — a size is genuinely optional
    const sz = (size ?? '').trim();
    if (!sz) return 'Size is required for a size of a variety — the scanner tells the sizes apart by this, and a blank one makes the whole variety unscannable.';
    const twin = findSizeTwin(otherRows, { variantGroup: grp, size: sz, excludeId: selfId });
    if (twin) {
      // Never a bare refusal — name the row and point at the fix (it is almost always what they meant).
      return `"${sz}" already exists in this variety${twin.sku ? ` (SKU ${twin.sku})` : ''} — edit that row's quantity instead of adding a second one.`;
    }
    return null;
  }

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
    // The EDIT path can break the family exactly as the CREATE path can — by blanking the size of a
    // grouped row, by editing a size onto its twin, or by moving a size-less row INTO a group. Same
    // rule, same moment (before the write), so the two paths cannot disagree (STD-017: the fix is
    // true on every surface the capability touches, and edit is a surface).
    if (field === 'size' || field === 'variant_group') {
      const group = field === 'variant_group' ? value : draft.variant_group;
      const size  = field === 'size'          ? value : draft.size;
      const msg = sizeError(group, size, draft.id);
      if (msg) { setErrors(e => ({ ...e, [field]: msg })); return; }
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
    // SIZE uniqueness + size-required-when-grouped. A SKU identifies one sellable UNIT; a
    // (variant_group, size) pair identifies one VARIANT — two different facts, and guarding the SKU
    // was never guarding the variant. This is the guard whose absence let DISC-1002-15G be minted
    // beside DISC-1002 at the same size, live, in under a minute (CASE 5, ledger #73/#74).
    const sizeMsg = sizeError(draft.variant_group, draft.size, draft.id);
    if (sizeMsg) errs.size = sizeMsg;
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

  // "+ Add size" size change: auto-derive the sibling SKU until the owner edits the SKU by hand.
  // ONE setDraft so size + derived SKU move together.
  //
  // THE FIX (defect 3): the base is resolved from the whole FAMILY (suggestSiblingSku → baseSkuOf),
  // not taken from the row that happened to be clicked. Passing `addSizeParent.sku` is what minted
  // the live DISC-1003-30G-45G — David clicked "+ Add size" on the DISC-1003-30G row and its SKU
  // became the base. deriveSiblingSku cannot detect that; it suffixes whatever it is given, and its
  // idempotence guard only catches re-appending the SAME suffix. The count path called that same
  // helper minutes later on this same family and got DISC-1003-60G right — because it resolved the
  // base first. Now both callers make the identical call (STD-011).
  const onSizeCreateChange = (size: string) => {
    if (isAddSize && !skuTouched) {
      const derived = suggestSiblingSku(addSizeFamily, size);
      setDraft(d => ({ ...d, size, sku: derived ?? '' }));
      setErrors(e => (e.sku || e.size ? { ...e, sku: '', size: '' } : e));
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
          <FieldError msg={errors.name} />
          {!creating && draft.variant_group?.trim() && (
            <p style={SS.hint}>This variety has size-siblings — renaming updates the whole group so the sizes stay linked.</p>
          )}
        </div>
        <div style={SS.field}>
          <label style={SS.label}>SKU</label>
          <input {...textInput('sku', onSkuCreateChange, errBorder(!!errors.sku))}
            placeholder={isAddSize ? 'Auto-fills from the size — editable' : 'Optional'} />
          <FieldError msg={errors.sku} />
          {isAddSize && baseSku && (
            <p style={SS.hint}>Suggested from this variety's base SKU <b>{baseSku}</b> + the size — edit if yours differs. No existing row's SKU is changed.</p>
          )}
        </div>

        {/* ── SIZE & GROUPING ── */}
        <div style={groupTitle}>Size &amp; grouping</div>
        <div style={{ ...SS.row2, ...SS.field }}>
          <div>
            {/* Required whenever the row is in a variety group — the label says so rather than
                letting the owner discover it at the save (§1.6 item 5: no dead affordance). */}
            <label style={SS.label}>Size {(isAddSize || draft.variant_group?.trim()) ? '*' : ''}</label>
            <input {...textInput('size', onSizeCreateChange, errBorder(!!errors.size))} placeholder="e.g. 30 gal, 45 gal" />
            <FieldError msg={errors.size} />
          </div>
          <div>
            <label style={SS.label}>Variant group</label>
            {isAddSize ? (
              <input style={{ ...SS.input, background: '#f3f4f6', color: '#374151' }} value={draft.variant_group ?? ''} readOnly />
            ) : (
              <input {...textInput('variant_group', undefined, errBorder(!!errors.variant_group))} placeholder="Groups sizes of one variety" />
            )}
            <FieldError msg={errors.variant_group} />
          </div>
        </div>
        <p style={SS.hint}>
          Two rows that share a variant group and have distinct sizes become selectable sizes of one variety at checkout.
          {isAddSize
            ? ' The group is set on this size and the parent so the size-picker fires. Each size can appear only once — the scanner tells them apart by it.'
            : draft.variant_group?.trim()
              ? ' Each size can appear only once in a group, and none can be blank — that is how the scanner tells them apart.'
              : ' Leave the group empty for a standalone item (netting, a tool) — those need no size.'}
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
            <FieldError msg={errors.sell_price} />
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
            <FieldError msg={errors.qty} />
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
