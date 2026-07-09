// ============================================================
// systemManagedFields — the canonical SYSTEM-MANAGED field registry (Cultivar OS)
// PURPOSE:      The SINGLE SOURCE for the DataSheet "locked field" rule. A field listed here is
//               SYSTEM-WRITE-ONLY — the platform sets it, the user NEVER edits it (timestamps,
//               provenance links, identity/scope). Its DataSheet column renders a clickable LOCK
//               affordance explaining WHAT sets it, so a non-editable field reads as
//               "system-managed, with a reason" — never as a hidden/broken edit function.
//               This is Surface Honesty (D-9) applied to EDITABILITY: locked-with-explanation,
//               not silently greyed or absent.
// DEPENDENCIES: none (pure data + one lookup helper). Read by DataSheet.tsx.
// OUTPUTS:      SYSTEM_MANAGED_FIELDS (the registry) + lockInfoFor(column) (the resolver the grid
//               calls per column). Keyed by field/column key — column keys match DB field names
//               across the inventory / assets / customers configs, so ONE flat registry covers all
//               three grids (add a field once → every grid that shows it locks it).
// PLACEMENT:    beside DataSheet.tsx (cultivar components/) — promote to @trace/shared with the
//               engine when a second-vertical consumer appears (standard-by-value, §6 r10).
// ============================================================

export interface SystemFieldInfo {
  /** Human label for what the field IS (e.g. "Added", "Last touched"). */
  label: string;
  /** One-line explanation of WHAT sets it / WHY it is not editable — shown in the lock popover. */
  reason: string;
}

// The registry. Field key → what it is + why it's system-managed. This is the ONLY place the
// "which fields get the lock" decision lives — the single source. Consumed via lockInfoFor()
// (the DataSheet's read API), so the raw map stays module-internal. cost_confidence /
// estimated_value_confidence are DELIBERATELY ABSENT — see the note below.
const SYSTEM_MANAGED_FIELDS: Record<string, SystemFieldInfo> = {
  // ── Timestamps (set by the platform on write) ──
  created_at: {
    label: 'Added',
    reason: 'Set automatically when this row is first created. It records when the item appeared and is never edited by hand.',
  },
  updated_at: {
    label: 'Last touched',
    reason: 'Updated automatically every time this row changes. It tracks the most recent edit and cannot be set by hand.',
  },

  // ── Provenance (linked by a system flow, not typed) ──
  receipt_id: {
    label: 'Receipt',
    reason: 'Linked automatically by the receipt / invoice-scan flow. It ties this row to its source receipt and is not edited directly.',
  },
  source: {
    label: 'Source',
    reason: 'Set automatically from where this record came in — checkout, invoice scan, or added by hand. It records origin and is not editable.',
  },
  qb_customer_id: {
    label: 'QuickBooks',
    reason: 'Set automatically when this record syncs to QuickBooks. It holds the QuickBooks id and is managed by the sync, not edited here.',
  },

  // ── Identity / tenant scope (assigned by the platform) ──
  id: {
    label: 'ID',
    reason: 'The system identifier for this row. Assigned automatically and never editable.',
  },
  business_id: {
    label: 'Business',
    reason: 'The owning business, set automatically for tenant scoping. Never editable.',
  },
};

// DERIVED-WITH-OVERRIDE — intentionally NOT in the registry (documented so the exclusion is a
// decision, not an oversight): `cost_confidence` and `estimated_value_confidence` are DERIVED by
// default from a sibling field's presence (unit_cost / estimated_value), BUT the reconcile grids
// expose a deliberate manual OVERRIDE on them (an owner can correct the machine's guess). Because
// they are genuinely editable on those surfaces, they must NOT be auto-locked — the derivation is
// the default, the owner has the final say. If a future grid shows them read-only, that grid can
// force the lock per-column via `systemManaged: true`.

// A generic reason for a column that force-declares itself system-managed but has no registry entry.
const GENERIC_SYSTEM_REASON =
  'Managed automatically by the system — this field is set for you and is not editable here.';

/**
 * Resolve the lock treatment for a column. Registry membership (by column key) is the default
 * driver — the SINGLE source. A column may narrowly override: `systemManaged: false` force-unlocks
 * a registry field on a surface that genuinely edits it; `systemManaged: true` force-locks a field
 * absent from the registry. `lockReason` supplies custom popover text. Returns null when the column
 * is a normal editable field.
 */
export function lockInfoFor(col: {
  key: string;
  header: string;
  systemManaged?: boolean;
  lockReason?: string;
}): SystemFieldInfo | null {
  if (col.systemManaged === false) return null; // explicit opt-out (editable here)
  const reg = SYSTEM_MANAGED_FIELDS[col.key];
  if (reg) return col.lockReason ? { ...reg, reason: col.lockReason } : reg;
  if (col.systemManaged === true) return { label: col.header || col.key, reason: col.lockReason ?? GENERIC_SYSTEM_REASON };
  return null;
}
