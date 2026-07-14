// ============================================================
// CustomerFields — the ONE 8-field customer form body (Cultivar OS)
// PURPOSE:      The shared visual layout for the 8 editable customer fields (first*/last,
//               phone/email, address, city/state/zip), consumed by BOTH the /customers
//               Add-Customer sheet (insert, controlled + submit) AND the CustomerEditModal
//               (update, per-field-on-blur). One form body → the two surfaces can't drift.
// DEPENDENCIES: DataSheet sheetStyles (SS) for the shared field/label/input tokens. Pure
//               presentation — the parent owns state (values) + behavior (onChange/onCommit).
// OUTPUTS:      onChange(field, value) on every keystroke (parent state / working copy).
//               onCommit(field, value) on blur when provided (edit modal → per-field persist;
//               the Add form omits it and persists once on submit instead).
// ============================================================
import { sheetStyles as SS } from '../datasheet/DataSheet';

export interface CustomerFormState {
  first_name: string; last_name: string; phone: string; email: string;
  address_line1: string; city: string; state: string; zip: string;
}

/** Build a form-state from an existing customer row (nulls → '' for controlled inputs). */
export function customerToForm(c: {
  first_name?: string | null; last_name?: string | null; phone?: string | null; email?: string | null;
  address_line1?: string | null; city?: string | null; state?: string | null; zip?: string | null;
}): CustomerFormState {
  return {
    first_name: c.first_name ?? '', last_name: c.last_name ?? '',
    phone: c.phone ?? '', email: c.email ?? '',
    address_line1: c.address_line1 ?? '', city: c.city ?? '',
    state: c.state ?? '', zip: c.zip ?? '',
  };
}

interface CustomerFieldsProps {
  values: CustomerFormState;
  onChange: (field: keyof CustomerFormState, value: string) => void;
  /** When present, fields commit on blur (per-field-on-blur — the edit modal). */
  onCommit?: (field: keyof CustomerFormState, value: string) => void;
  /** Add the `required` HTML attr on first_name (the Add form, where a submit exists). */
  requireFirstName?: boolean;
  /** Field currently mid-save (edit modal) — disables that input while writing. */
  savingField?: string | null;
}

export function CustomerFields({ values, onChange, onCommit, requireFirstName, savingField }: CustomerFieldsProps) {
  const blur = (field: keyof CustomerFormState) =>
    onCommit ? () => { onCommit(field, values[field]); } : undefined;
  const disabled = (field: keyof CustomerFormState) => savingField === field;

  return (
    <>
      <div style={{ ...SS.row2, ...SS.field }}>
        <div>
          <label style={SS.label}>First name *</label>
          <input style={SS.input} value={values.first_name} onChange={e => onChange('first_name', e.target.value)}
            onBlur={blur('first_name')} disabled={disabled('first_name')} placeholder="e.g. Marcus" required={requireFirstName} />
        </div>
        <div>
          <label style={SS.label}>Last name</label>
          <input style={SS.input} value={values.last_name} onChange={e => onChange('last_name', e.target.value)}
            onBlur={blur('last_name')} disabled={disabled('last_name')} placeholder="e.g. Webb" />
        </div>
      </div>
      <div style={{ ...SS.row2, ...SS.field }}>
        <div>
          <label style={SS.label}>Phone</label>
          <input style={SS.input} value={values.phone} onChange={e => onChange('phone', e.target.value)}
            onBlur={blur('phone')} disabled={disabled('phone')} placeholder="Optional" />
        </div>
        <div>
          <label style={SS.label}>Email</label>
          <input style={SS.input} type="email" value={values.email} onChange={e => onChange('email', e.target.value)}
            onBlur={blur('email')} disabled={disabled('email')} placeholder="Optional" />
        </div>
      </div>
      <div style={SS.field}>
        <label style={SS.label}>Address</label>
        <input style={SS.input} value={values.address_line1} onChange={e => onChange('address_line1', e.target.value)}
          onBlur={blur('address_line1')} disabled={disabled('address_line1')} placeholder="Street address" />
      </div>
      <div style={{ ...SS.row3, ...SS.field }}>
        <div>
          <label style={SS.label}>City</label>
          <input style={SS.input} value={values.city} onChange={e => onChange('city', e.target.value)}
            onBlur={blur('city')} disabled={disabled('city')} placeholder="City" />
        </div>
        <div>
          <label style={SS.label}>State</label>
          <input style={SS.input} value={values.state} onChange={e => onChange('state', e.target.value)}
            onBlur={blur('state')} disabled={disabled('state')} placeholder="TX" />
        </div>
        <div>
          <label style={SS.label}>ZIP</label>
          <input style={SS.input} value={values.zip} onChange={e => onChange('zip', e.target.value)}
            onBlur={blur('zip')} disabled={disabled('zip')} placeholder="ZIP" />
        </div>
      </div>
    </>
  );
}
