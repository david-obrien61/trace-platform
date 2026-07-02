// ============================================================
// CustomerEditModal — in-context customer edit (Cultivar OS)
// PURPOSE:      Edit a customer's 8 fields IN CONTEXT — over the current page (a delivery
//               route/day), without navigating away to the /customers roster. Resolves the
//               nav finding: tapping "Edit customer →" on a delivery card opens this over the
//               page, small change → close, you stay on the same route. Uses the SAME shared
//               <CustomerFields> body + coercion/write helpers the roster uses → identical
//               rules, zero drift.
// WRITE MODEL:  per-field-on-blur (mirrors the roster inline edit; no Save button). Each field
//               commits via persistCustomerField (owner-only RLS UPDATE, .eq id .eq business).
// DEPENDENCIES: useBusinessContext (businessId → RLS scope), sheetStyles (SS) modal/sheet
//               container, CustomerFields, coerceCustomerField/persistCustomerField.
// GATE:         OWNER-ONLY — mounted only when isOwner && the delivery has a customer (see
//               DeliverySchedule). customers RLS is owner-only (FOR ALL) → staff never open it.
// FORWARD FIT:  Enhancement 2's map-pin "Edit customer" popup opens THIS SAME component, so a
//               pin edit won't yank the user off the map either.
// INSTRUMENTATION (STD-003): `[TRACE:customers] edit` via persistCustomerField (ON by default).
// ============================================================
import { useState } from 'react';
import { X } from 'lucide-react';
import { useBusinessContext } from '@trace/shared/context';
import { sheetStyles as SS } from '../datasheet/DataSheet';
import { CustomerFields, customerToForm, type CustomerFormState } from './CustomerFields';
import { coerceCustomerField, persistCustomerField, type CustomerTextField } from './customerEdit';

export interface EditableCustomer {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

interface Props {
  customer: EditableCustomer;
  onClose: () => void;
  /** Notified after each successful field write so the parent can reflect it (e.g. the card). */
  onEdited?: (updated: EditableCustomer) => void;
}

export function CustomerEditModal({ customer, onClose, onEdited }: Props) {
  const { businessId } = useBusinessContext();
  const [draft, setDraft] = useState<EditableCustomer>(customer);
  const [form, setForm] = useState<CustomerFormState>(customerToForm(customer));
  const [error, setError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);

  function onChange(field: keyof CustomerFormState, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function commitField(field: keyof CustomerFormState, raw: string) {
    if (!businessId) return;
    const f = field as CustomerTextField;
    const r = coerceCustomerField(draft as unknown as Record<string, unknown>, f, raw);
    if (r.skip) {
      // e.g. first_name blanked, or unchanged → snap the input back to the persisted value.
      setForm(prev => ({ ...prev, [field]: (draft[f] ?? '') as string }));
      return;
    }
    setSavingField(field);
    const res = await persistCustomerField({ id: draft.id, businessId, field: f, from: draft[f], value: r.value });
    setSavingField(null);
    if (res.error) { setError(res.error); return; }
    const updated = { ...draft, [f]: r.value };
    setDraft(updated);
    setForm(prev => ({ ...prev, [field]: (r.value ?? '') as string }));
    setError(null);
    onEdited?.(updated);
  }

  return (
    <div style={SS.modal} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={SS.sheet}>
        <div style={SS.sheetHeader}>
          <h2 style={{ ...SS.sectionTitle, margin: 0 }}>Edit customer</h2>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} onClick={onClose}>
            <X size={20} color="#6b7280" />
          </button>
        </div>
        {error && <div style={SS.error}>{error}</div>}
        <CustomerFields
          values={form}
          onChange={onChange}
          onCommit={(f, v) => { void commitField(f, v); }}
          savingField={savingField}
        />
        <p style={SS.hint}>Changes save automatically as you edit. Close when you're done.</p>
      </div>
    </div>
  );
}
