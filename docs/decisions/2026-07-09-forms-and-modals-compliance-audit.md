# Forms & Modals Compliance Audit — two axes: required-field VALIDATION + modal CENTERING

**Date:** 2026-07-09 · **Type:** read-only inventory (no fixes to other surfaces this pass — each row is a board item David can prove or fail)
**Owner:** David · **Author:** Thunder (FIX 5 build-pass)

## Why this exists

Two standing rules are applied only to *touched* surfaces, never swept platform-wide — the same class of gap:

- **Validation rule** (§1.6 pre-flight item 3 · `user_stories.md` ## NEEDED, SCOPE platform): every required input is validated before write — block + highlight the field + say why. Never fail silently. Surfaced today: saving a service with a blank Price failed **silently** (a disabled button with no explanation). FIX 5 (Settings service editor) is now the **reference implementation** — this audit is its retrofit backlog.
- **Modal-centering rule** (§1.6 pre-flight item 5 · standing UI convention): modals/sheets centered, ≥48px targets, no off-center dialogs. Surfaced today: David flagged the **Add Inventory modal off-center** and asked *"why isn't the modal-centering standard applied always?"* This audit gives that rule a compliance backlog too.

**How to read a row.** Each surface gets a state on BOTH axes:
- **VALIDATION:** ✅ block + highlight + message · ⚠️ blocks silently (disabled button / snap-back, **no message**) · ❌ allows blank through to DB · N/A (no required fields)
- **CENTERING:** ✅ centered (`alignItems:'center'`) · ⚠️ bottom-sheet (`alignItems:'flex-end'`) — *needs David's call: is bottom-sheet an accepted mobile pattern here, or retrofit to center?* · N/A (full-page surface, not an overlay)

A ⚠️ is a **backlog item**, not necessarily a bug — bottom-sheets are a legitimate mobile pattern; David decides whether the convention is "always center" or "center for decisions, bottom-sheet for list-adds." The audit surfaces the split; it does not decide it.

---

## The checklist

| # | Surface | File · line (form / save) | Required fields | VALIDATION | CENTERING |
|---|---------|---------------------------|-----------------|------------|-----------|
| 1 | **Settings — service editor** (New + Edit) | `packages/shared/src/pages/Settings.tsx` · `addOffering` ~355, `saveEdit` ~300 | name, price (0 valid; blank rejected), category, transport_mode (if transport) | ✅ **REFERENCE** — FIX 5: blocks + red border + inline message on both forms; button clickable so a click surfaces the reason | N/A — inline form on the Settings page (not an overlay) |
| 2 | **CustomerCapture** (checkout) | `packages/cultivar-os/src/pages/CustomerCapture.tsx` · `handleSubmit` ~113 | first/last name, email (always); phone + address (if delivery) | ✅ block + red field + message; conditional-required honored | N/A — full-page |
| 3 | **Add Customer** (roster) | `packages/cultivar-os/src/pages/Customers.tsx` · ~158 | first_name | ✅ `setSaveError('First name is required.')` shown (line 214) | ✅ **CENTERED 2026-07-09** — shared `sheetStyles.modal` flipped to `alignItems:'center'` (convention A; DataSheet.tsx) |
| 4 | **Customer Edit** (modal) | `packages/cultivar-os/src/components/customers/CustomerEditModal.tsx` · `commitField` ~74 | first_name | ⚠️ **silent** — blank first_name snaps back to persisted value with **no message** (line 78-81); per-field-on-blur model | ✅ centered (`alignItems:'center', justifyContent:'center'` ~52-56) |
| 5 | **Add Inventory** (datasheet) | `packages/cultivar-os/src/pages/BusinessInventory.tsx` · modal ~314 | name, qty (≥0), **sell_price (D-35)** | ✅ **FIX-5 pattern 2026-07-09** — name + qty + **required sell_price** block + red border + inline message (`validateInventoryForm`/`errBorder`/`FieldError`) | ✅ **CENTERED 2026-07-09** — shared `sheetStyles.modal` (was David-flagged off-center) |
| 6 | **Add Business Asset** (datasheet) | `packages/cultivar-os/src/pages/BusinessAssets.tsx` · ~260, modal ~314 | name | ✅ `setSaveError('Name is required.')` (line 322) | ✅ **CENTERED 2026-07-09** — shared `sheetStyles.modal` flipped (convention A) |
| 7 | **Operating Costs — Add cost** | `packages/cultivar-os/src/pages/OperatingCosts.tsx` · ~276, modal `S.modal` 111 | name | ✅ name message shown | ⚠️ bottom-sheet — own `modal` `flex-end` (line 111) |
| 8 | **Projects Manager** (add/rename project) | `packages/cultivar-os/src/components/ProjectsManager.tsx` · modal `S.modal` 181 | project name | 🔍 review — trace the add-project guard for a message | ⚠️ bottom-sheet — own `modal` `flex-end` (line 181) |
| 9 | **Inventory Count** (review / picker / unknown sheets) | `packages/cultivar-os/src/pages/InventoryCount.tsx` · modal 659 | qty (defaulted), unknown-entry | N/A / 🔍 — qty stepper, no blank-required save | ⚠️ bottom-sheet — `modal` `flex-end` (line 659) |
| 10 | **ScanOrder** (review / picker / unknown sheets) | `packages/cultivar-os/src/pages/ScanOrder.tsx` · modal 283 | qty (stepper) | N/A — qty stepper | ✅ centered (`alignItems:'center'` line 283) — *fixed in the #97 checkout pass ("standing modal convention")* |
| 11 | **Project Cost Tree — resolve** | `packages/cultivar-os/src/components/ProjectCostTree.tsx` · `modalBackdrop` | confidence↔amount coherence (own D-9 rule) | ✅ coherence-gated (own) | ✅ centered (`alignItems:'center'`) |
| 12 | **OnboardingWizard** (Nursery setup step) | `packages/cultivar-os/src/pages/OnboardingWizard.tsx` · Continue ~668 | nursery name (>1 char) | ⚠️ **silent** — Continue `disabled={!canContinue}` with **no message** (line 668) — *same defect class FIX 5 just fixed* | N/A — full-page wizard |
| 13 | **Member / Invite** | `packages/shared/src/components/team/MemberConsole.tsx` · invite ~244 | name | ✅ `setInviteError('Name is required.')` (line 244) | N/A — inline console tab (not an overlay) |
| 14 | **CartReview** (checkout) | `packages/cultivar-os/src/pages/CartReview.tsx` · ~91-95 | every line has `sell_price > 0` | ✅ red banner + disabled pay buttons on $0/unpriced (D-9) | N/A — full-page |
| 15 | **ReceiptKeeper** (confirm) | `packages/cultivar-os/src/pages/ReceiptKeeper.tsx` · confirm phase | customer name (OCR-inferred) + optional | 🔍 review — confirm-screen guard on an empty inferred name | N/A — full-page phased flow |
| 16 | **Asset Capture** | `packages/cultivar-os/src/pages/AssetCapture.tsx` · handleFiles ~145 | none (upload → auto-process) | ✅ file size/type error shown (line 155) | N/A — full-page capture |

---

## Summary of the backlog (what a retrofit pass would fix)

### Validation rule — 3 items to retrofit to the FIX-5 pattern
- **#12 OnboardingWizard** (nursery step) — disabled Continue, no message. Highest priority: it's the exact defect FIX 5 just fixed (a disabled button that never says why), on the first-run path.
- **#4 CustomerEditModal** — blank first_name snaps back silently. Add a message ("First name is required — an existing customer can't be left nameless") on the snap-back.
- **#8, #15** (ProjectsManager add, ReceiptKeeper confirm) — 🔍 unconfirmed; trace their save guards and confirm a message shows.
- Everything else (11 surfaces) is already ✅ (block + message) — the platform is mostly compliant; these three are the gaps.

### Centering rule — convention A adopted for the datasheet-add modals (2026-07-09)
- **The single lever, now flipped:** rows #3/#5/#6 all bottom-sheet through ONE shared style — `DataSheet.tsx sheetStyles.modal`. On 2026-07-09 that one line was flipped `alignItems:'flex-end'` → `'center'` (+ padding, sheet radius `16px16px00`→`16`, maxHeight `92vh`→`85vh`), centering **all three datasheet-add modals at once** (Add Customer / Add Inventory / Add Asset). This is **convention A ("always center") adopted for the datasheet-add camp.**
- **Remaining bottom-sheets (own `flex-end` copies, NOT touched this pass):** rows #7 OperatingCosts, #8 ProjectsManager, #9 InventoryCount each carry their own `S.modal flex-end` — the residual retrofit backlog for full convention-A adoption. (ScanOrder #10 + cost-resolve #11 + customer-edit #4 were already centered.)

### Flagged aside — RESOLVED 2026-07-09
- **#5 Add Inventory — unit cost editability.** The old Add form disabled the Unit Cost input when `cost_confidence === 'UNKNOWN'` (a dead affordance, no entry path). **Fixed:** the Add form now makes unit_cost freely editable (optional) and DERIVES `cost_confidence` from its presence (typed → CONFIRMED, blank → UNKNOWN) — the manual confidence picker was removed from the create form. `sell_price` (D-35) is now a required create field so nothing is born unsellable.

---

*Retrofit backlog for the platform validation rule (`user_stories.md` ## NEEDED) AND the modal-centering rule (§1.6 item 5). Read-only inventory — no other surface changed this pass. Row 1 (Settings service editor) is the validation reference implementation, shipped in the FIX 5 build.*
