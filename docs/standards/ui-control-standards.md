# UI Control Standards — the bar every platform control meets

**Last updated: 2026-07-09**
**Status: BINDING (CLAUDE.md §6 rules 13–15). Rendered board: [/ui-standards.html](../../ui-standards.html) (pure renderer of the compliance manifest).**

This is the **bar**, not a found-issue log. Each entry states the industry-standard behavior a
platform control MUST implement and the common pattern it descends from. Every control we build is
**measured against this spec** — the rendered compliance board shows control × standard as
✅ meets / 🟡 partial / 🔴 missing, so where a control falls short it is a KNOWN gap on the board,
never a silent one.

These are patterns users already expect from any competent data app (a spreadsheet, an admin
console, a CRM grid). We are not inventing them — we are holding our controls to them. Divergence
in either direction (below the bar, or gold-plating above our scope) requires an explicit recorded
decision per the standard-by-value rule (CLAUDE.md §6 r10).

The shared controls that carry these standards:
- **`packages/cultivar-os/src/components/datasheet/DataSheet.tsx`** — the ONE grid engine (inventory / assets / customers inherit).
- **`packages/cultivar-os/src/components/datasheet/systemManagedFields.ts`** — the field-display lock registry.
- **`DataSheet.tsx → sheetStyles.modal`** — the shared modal/sheet convention.

---

## 1. DATA GRID (the DataSheet)

Every grid rendering business rows MUST have:

| # | Standard | Descends from | Why |
|---|----------|---------------|-----|
| G1 | **Sticky header row** — column headers stay visible while the body scrolls vertically. | Every spreadsheet / data grid (Excel freeze-header, AG-Grid, Google Sheets). | You lose track of which column is which the moment the header scrolls off. |
| G2 | **Reachable horizontal scrollbar** — the h-scrollbar lives on a viewport-bounded box, reachable WITHOUT scrolling past every row. | Bounded scroll container (all grid libraries scroll the grid, not the page). | The defect that started this: a wide 111-row grid forced a scroll to the very bottom to find the h-scrollbar. |
| G3 | **Frozen identifier column** — the leading name/id column pins on horizontal scroll. | Excel "Freeze first column", AG-Grid pinned columns. | Scroll right on a wide grid and you no longer know which row you're editing. |
| G4 | **Sortable columns** — click a header to sort asc/desc, with a visible sort indicator. | Every list/table UI. | Finding a row in 100+ without sort is a linear scan. |
| G5 | **Column show/hide** — a menu to toggle non-essential columns off. | Admin consoles, AG-Grid column tool panel. | A wide grid on a laptop needs the operator to trim to what they care about. |
| G6 | **Search / filter** — a global text search + (where a status field exists) a quick status filter. | Every CRM/inventory list. | Scanning by eye doesn't scale past a screenful. |
| G7 | **Density for 100+ rows** — compact rows + a bounded scroll box that handles hundreds of rows without paginating away context. | Data-grid density modes. | The real inventory is 111 rows today and grows. |
| G8 | **Per-cell inline edit with a clear editable-vs-readonly affordance** — editable cells look editable (input chrome); non-editable cells are visibly distinguished (see §3). | Spreadsheet in-cell editing. | An edit surface must not make you guess which cells accept input. |

**Current implementation:** `DataSheet.tsx` implements G1–G8. G1 (sticky `<thead>` + box-shadow underline that survives `border-collapse`), G2 (bounded `overflow:auto` + `maxHeight:calc(100vh-280px)` scroll box), G3 (leading `frozen:true` run pinned `position:sticky;left:…` with cumulative offsets + right-edge shadow), G4 (`sortable`/`sortVal` + arrow), G5 (`Columns` menu over `hideable` cols), G6 (global search + optional `statusFilter`), G7 (compact rows in the bounded box), G8 (inline `TextCell`/`NumberCell`/`AmountCell`/`SelectCell` + the §3 lock affordance).

**Known gap (on the board):** G7 is met by a bounded scroll box, NOT row virtualization — fine at 111 rows and into the low thousands; if a grid ever holds tens of thousands, virtualization becomes the next rung (deferred, standard-by-value — not worth it at current scale).

---

## 2. MODAL / DIALOG

Every modal/dialog/sheet MUST have:

| # | Standard | Descends from | Why |
|---|----------|---------------|-----|
| M1 | **Centered** — floats centered on every viewport (not a bottom-anchored sheet, unless a deliberate documented mobile-list-add exception). | Standard modal dialog (every design system). | David flagged off-center checkout/add modals; convention **A "always center"** was adopted for the platform. |
| M2 | **Required-field validation, surfaced** — a blank required field BLOCKS save with a visible inline message + red border; NEVER a silently-greyed button and NEVER a silent save. | Form validation UX (the FIX 5 pattern). | Surface Honesty (D-9): a save that does nothing with no explanation is a lie. |
| M3 | **Escape-to-close** — `Esc` dismisses the modal. | Standard dialog affordance (WAI-ARIA dialog). | A trapped user with no keyboard exit is a dead end. |
| M4 | **Backdrop-click behavior defined** — clicking the backdrop either dismisses or is explicitly inert; not accidental. | Modal convention. | Ambiguous backdrop behavior loses in-progress input or traps the user. |
| M5 | **Focus management** — focus moves into the dialog on open and is restored on close (ideally trapped within). | WAI-ARIA dialog pattern. | Keyboard/AT users otherwise stay stranded behind the modal. |

**Current implementation:** M1 met — the shared `sheetStyles.modal` is centered (the 3 datasheet add-sheets: Add Inventory / Add Customer / Add Asset) AND the four former own-copy bottom-sheets are now centered too (OperatingCosts, ProjectsManager, InventoryCount, ConflictDialog — this pass). M2 met on the reference surfaces (Settings service editor, Add Inventory — the FIX 5 `validateXForm` + red-border + inline-message shape) and is the pattern other forms copy.

**Known gaps (on the board):** M3 (escape-to-close), M4 (defined backdrop behavior — inconsistent: some sheets dismiss on backdrop, some don't), and M5 (focus management / focus-trap) are NOT yet implemented platform-wide. They are honest amber/red on the compliance board — the next modal rung — not silently assumed done.

---

## 3. FIELD DISPLAY (editable vs system-managed)

Every field a grid or form displays MUST declare its editability honestly:

| # | Standard | Descends from | Why |
|---|----------|---------------|-----|
| F1 | **Editable fields show an edit affordance** — an input/control the user can obviously act on. | Direct-manipulation UI. | A field that IS editable must look it. |
| F2 | **System-managed / computed fields show a LOCKED affordance WITH explanation** — a clickable lock whose popover says WHAT sets the field and WHY it isn't editable. NEVER silently greyed, absent, or dead. | Read-only field affordances + Surface Honesty (D-9). | A non-editable field must read as "system-managed, with a reason," never as a broken/hidden edit. |
| F3 | **The locked set is a single canonical registry** — one source decides which fields lock, so every grid that shows a system field locks it identically. | Single-source-of-truth config. | Prevents the same field being editable on one grid and locked on another (drift). |

**Current implementation:** F1 met (inline cell inputs). F2 met — `DataSheet.tsx` renders a clickable 🔒 in the header of any system-managed column with a `position:fixed` explanation popover. F3 met — `systemManagedFields.ts` (`SYSTEM_MANAGED_FIELDS` + `lockInfoFor()`) is the SOLE source; keys match DB field names across the three configs, so one flat registry covers all grids.

**Deliberate exclusion (documented, not an oversight):** `cost_confidence` / `estimated_value_confidence` are derived-by-default BUT manually overridable on the reconcile grids → genuinely editable there → NOT auto-locked. A read-only surface can still force the lock per-column via `systemManaged: true`.

---

## System-managed field registry (the F2/F3 set — David to confirm)

The canonical locked set in `systemManagedFields.ts`, keyed by DB field name (a grid locks the field wherever it shows it):

| Field key | Label | What sets it / why locked |
|-----------|-------|---------------------------|
| `created_at` | Added | Set on row creation; records when the item appeared. |
| `updated_at` | Last touched | Bumped on every write; tracks the most recent edit. |
| `receipt_id` | Receipt | Linked by the receipt/invoice-scan flow; ties the row to its source receipt. |
| `source` | Source | Set from where the record entered — checkout, invoice scan, or by hand. |
| `qb_customer_id` | QuickBooks | Set by the QuickBooks sync; holds the QB id. |
| `id` | ID | System row identifier, assigned automatically. |
| `business_id` | Business | Owning business, set for tenant scoping. |

Per-grid coverage (locks the field only where that grid shows it as a column):
- **business_inventory** (`/inventory`): `created_at`, `updated_at`, `receipt_id`.
- **cost_objects / assets** (`/assets`): `created_at`, `updated_at` (shown), `id`/`business_id` (registry, not shown as columns).
- **customers** (`/customers`): `source`, `qb_customer_id`, `created_at`.

**Flagged for David (NOT locked — a decision, not an omission):** `customers.price_tier` is display-only in the grid today but is BUSINESS data (not system-written) → a candidate for future inline-edit, NOT a system lock. Left unlocked deliberately.

---

## How this is enforced

1. **Fix in the shared control → all consumers inherit.** A grid standard lands in `DataSheet.tsx`; a field-lock lands in `systemManagedFields.ts`; a modal convention lands in `sheetStyles.modal`. No per-consumer copies to keep in sync.
2. **The compliance board is glanceable.** [/ui-standards.html](../../ui-standards.html) renders control × standard from a manifest, so remaining gaps (escape/focus-trap/backdrop) are visible, not buried.
3. **New controls are measured here.** A new grid, modal, or form is checked against §1/§2/§3 in its build (CLAUDE.md §1.6 gate item 5 — UI/modals). A control below the bar is a KNOWN amber/red row, reconciled or explicitly deferred — never a silent gap.
