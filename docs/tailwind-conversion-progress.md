# Tailwind to Inline Styles Conversion

This document tracks the conversion of Ignition OS and affected shared components from Tailwind CSS to inline styles.

## Status: COMPLETE ✅ — 2026-06-10 (THUNDER · Tailwind pass)

Tailwind CDN removed from `packages/ignition-os/index.html`. All 34 files converted.
Both builds verified: ignition 1838 ✅ · cultivar 2176 ✅ · zero errors.

## Policy

See Tech Debt #14 in CLAUDE.md. Tailwind is deprecated platform-wide as of 2026-05-31.

**No new Tailwind anywhere. Any new file in any package uses inline styles.**

## Scope — className= counts per package

| Package | Files with className= | Tailwind lines | Status |
|---|---|---|---|
| ignition-os | 32 files | 2,334 | ✅ DONE — 2026-06-10 |
| shared | 2 files (SavingsReport.jsx, QuickBooksConnector.jsx) | 140 | ✅ DONE — 2026-06-10 |
| cultivar-os | 11 files | 45 | CLEAN — all custom CSS class names (page, section, btn, badge, skeleton), not Tailwind utilities |
| shared (other) | 6 files (configureAuth, Card, Button, Badge, LockedOverlay, TileGrid) | ~21 | CLEAN — custom CSS class names, not Tailwind utilities |

## Approach used

- Inline `style={{ ... }}` for all base styles
- `className="ign-*"` CSS classes for pseudo-states that cannot be expressed inline (hover/focus/active/disabled/animations)
- CSS classes defined in `packages/ignition-os/ignition-theme.css` (imported via `main.jsx`)
- `const STYLE_DEBUG = false; // [TRACE:STYLE] STD-003` added to every converted file
- Non-1:1 mappings documented below

## Non-1:1 report (approximations and dropped states)

| Pattern | Treatment | Affected files |
|---|---|---|
| `hover:bg-*` on arbitrary elements | Dropped — use `ign-btn-*` or `ign-card-hover` for interactive elements | All 34 files |
| `hover:border-*`, `hover:text-*` on arbitrary elements | Dropped — static color only | All 34 files |
| `group-hover:*` | Dropped — static equivalent applied to the child element | Multiple |
| `transition-colors`, `transition-all` | Dropped inline; preserved via `ign-btn-*` and `ign-card-hover` CSS transitions | All 34 files |
| `animate-pulse` | `className="ign-pulse"` (keyframe in ignition-theme.css) | IgnitionOmni, AdminSubscription, others |
| `animate-spin` | `className="ign-spin"` (keyframe) | QuickBooksConnector, others |
| `animate-bounce` | `className="ign-bounce"` (keyframe) | Rare |
| `active:scale-95` / `active:scale-[0.98]` | `className="ign-btn-primary"` / `ign-card-hover` | All button-heavy files |
| `disabled:bg-slate-800 disabled:text-slate-600` | `ign-btn-primary:disabled` CSS rule | All primary buttons |
| `focus:border-blue-500 focus:outline-none` | `className="ign-input"` | All input elements |
| `grid-cols-*` responsive breakpoints | Always-on equivalent (largest breakpoint) — non-responsive | IgnitionAdmin, multiple |
| `overflow-y-auto` / `overflow-x-auto` | `className="ign-scroll"` / `ign-scroll-x"` | Scroll containers |
| `flex-wrap` | `className="ign-wrap"` | Wrapped flex rows |
| `line-clamp-3` | `className="ign-clamp-3"` | Text truncation |
| `backdrop-blur-sm` | `className="ign-backdrop"` | Modal overlays |
| Dynamic Tailwind classes (`bg-${color}-*`, `text-${color}-400`) | `CHOICE_COLORS` / `BADGE_COLORS` lookup maps keyed by color string | IgnitionAdmin, OnboardingWizard, MigratePath |
| `bg-gradient-to-br from-* to-*` | `background: 'linear-gradient(135deg, #hex1, #hex2)'` | Welcome screens, QR headers |
| `text-[Npx]` arbitrary font sizes | Nearest integer px value inline | All files |
| `rounded-[Nrem]` arbitrary radius | Nearest pixel value inline | Welcome icon boxes |
| `shadow-*` box shadows | Nearest hex `boxShadow` inline | Primary buttons, cards |

## Per-module conversion status

### packages/shared/src/components/

| File | className= lines | Commit | Status |
|---|---|---|---|
| SavingsReport.jsx | 86 | a7dd73d | ✅ DONE |
| QuickBooksConnector.jsx | 54 | 9be5211 | ✅ DONE |

### packages/ignition-os/ (root files)

| File | className= lines | Commit | Status |
|---|---|---|---|
| CoreApp.jsx | 196 | dd84850 | ✅ DONE |
| OnboardingWizard.jsx | 187 | dfb5e35 | ✅ DONE |
| EnrollmentCatch.jsx | 12 | e5fa82e | ✅ DONE |
| ErrorBoundary.jsx | 7 | 6e4276b | ✅ DONE |
| PriceField.jsx | 9 | 6e4276b | ✅ DONE |

### packages/ignition-os/modules/

| File | className= lines | Commit | Status |
|---|---|---|---|
| IgnitionAdmin.jsx | 333 | f342693 | ✅ DONE |
| IgnitionPort.jsx | 154 | d41ef1b | ✅ DONE |
| IgnitionEstimate.jsx | 148 | c3889f6 | ✅ DONE |
| IgnitionOmni.jsx | 124 | 417a25e | ✅ DONE |
| IgnitionAudit.jsx | 113 | 2a0b345 | ✅ DONE |
| PredictiveKey.jsx | 99 | fdd013f | ✅ DONE |
| IgnitionIntake.jsx | 90 | ce7794d | ✅ DONE |
| IgnitionEval.jsx | 89 | ebcbf14 | ✅ DONE |
| CustomerApprovalPortal.jsx | 71 | 8afb568 | ✅ DONE |
| IgnitionKosk.jsx | 68 | e07c410 | ✅ DONE |
| IgnitionInvoice.jsx | 62 | 243313a | ✅ DONE |
| CSVImporter.jsx | 60 | cd017d8 | ✅ DONE |
| IgnitionHub.jsx | 57 | 8981cd0 | ✅ DONE |
| IgnitionCRM.jsx | 52 | f3c89e2 | ✅ DONE |
| IgnitionProt.jsx | 49 | 2925048 | ✅ DONE |
| IgnitionTools.jsx | 48 | 71fc305 | ✅ DONE |
| IgnitionOmniDashboard.jsx | 41 | db97302 | ✅ DONE |
| IgnitionProc.jsx | 40 | e48dba8 | ✅ DONE |
| AdminSubscription.jsx | 39 | df7b7b1 | ✅ DONE |
| IgnitionProcure.jsx | 38 | 7fb3963 | ✅ DONE |
| IgnitionFlux.jsx | 31 | aa2038e | ✅ DONE |
| IgnitionCompliance.jsx | 31 | 4db38c8 | ✅ DONE |
| IgnitionCipher.jsx | 31 | f2a6cad | ✅ DONE |
| IgnitionStok.jsx | 30 | 860a2a5 | ✅ DONE |
| IgnitionHandover.jsx | 16 | e5fa82e | ✅ DONE |
| SlideToComplete.jsx | 8 | fd91e5b | ✅ DONE |
| IgnitionVIN.jsx | 1 | 0588532 | ✅ DONE |

---

*Conversion complete 2026-06-10. Re-run `grep -rn "className=" packages/ignition-os/ --include="*.jsx" | grep -v 'ign-'` to verify zero remaining Tailwind utilities.*
