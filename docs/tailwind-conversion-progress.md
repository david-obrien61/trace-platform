# Tailwind to Inline Styles Conversion

This document tracks the conversion of Ignition OS and affected shared components from Tailwind CSS to inline styles. The conversion is scheduled for post-August 2026.

## Policy

See Tech Debt #14 in CLAUDE.md. Tailwind is deprecated platform-wide as of 2026-05-31.

**No new Tailwind anywhere. Any new file in any package uses inline styles.**

## Scope — className= counts per package

| Package | Files with className= | Tailwind lines | Status |
|---|---|---|---|
| ignition-os | 32 files | 2,334 | DEFERRED — post-August 2026 |
| shared | 2 files (SavingsReport.jsx, QuickBooksConnector.jsx) | 140 | DEFERRED — post-August 2026 |
| cultivar-os | 11 files | 45 | CLEAN — all custom CSS class names (page, section, btn, badge, skeleton), not Tailwind utilities |
| shared (other) | 6 files (configureAuth, Card, Button, Badge, LockedOverlay, TileGrid) | ~21 | CLEAN — custom CSS class names, not Tailwind utilities |

**Total Tailwind debt: 34 files, ~2,474 lines**

## Conversion approach

For each file:
1. Read the file and list all Tailwind utility classes used
2. Map each utility to its inline-style equivalent (e.g., `text-slate-500` → `color: '#6b7280'`, `p-6` → `padding: 24`)
3. Reference shared design tokens where applicable (once `packages/shared/src/design-system/tokens.ts` exists)
4. Run the converted module in the browser and verify no visual regression
5. Commit with message: `"Convert <module> from Tailwind to inline styles"`
6. Update this doc — change status from PENDING to DONE

## Design token reference (for conversion use)

| Token | Value | Tailwind equivalents |
|---|---|---|
| Primary green | `#27500A` | `text-green-900`, `bg-green-900` (approximate) |
| Sage background | `#EAF3DE` | no direct Tailwind equivalent |
| Error red | `#A32D2D` | `text-red-800`, `bg-red-800` (approximate) |
| Gray text | `#6b7280` | `text-gray-500`, `text-slate-500` |
| Dark text | `#111827` | `text-gray-900` |

Note: Tailwind's slate/gray palettes don't match TRACE tokens exactly. Convert to the nearest TRACE token, not the nearest Tailwind equivalent.

## Per-module conversion status

### packages/shared/src/components/

| File | className= lines | Status |
|---|---|---|
| SavingsReport.jsx | 86 | PENDING |
| QuickBooksConnector.jsx | 54 | PENDING |

### packages/ignition-os/ (root files)

| File | className= lines | Status |
|---|---|---|
| CoreApp.jsx | 196 | PENDING |
| OnboardingWizard.jsx | 187 | PENDING |
| EnrollmentCatch.jsx | 12 | PENDING |
| ErrorBoundary.jsx | 7 | PENDING |
| PriceField.jsx | 9 | PENDING |

### packages/ignition-os/modules/

| File | className= lines | Status |
|---|---|---|
| IgnitionAdmin.jsx | 333 | PENDING |
| IgnitionPort.jsx | 154 | PENDING |
| IgnitionEstimate.jsx | 148 | PENDING |
| IgnitionOmni.jsx | 124 | PENDING |
| IgnitionAudit.jsx | 113 | PENDING |
| PredictiveKey.jsx | 99 | PENDING |
| IgnitionIntake.jsx | 90 | PENDING |
| IgnitionEval.jsx | 89 | PENDING |
| CustomerApprovalPortal.jsx | 71 | PENDING |
| IgnitionKosk.jsx | 68 | PENDING |
| IgnitionInvoice.jsx | 62 | PENDING |
| CSVImporter.jsx | 60 | PENDING |
| IgnitionHub.jsx | 57 | PENDING |
| IgnitionCRM.jsx | 52 | PENDING |
| IgnitionProt.jsx | 49 | PENDING |
| IgnitionTools.jsx | 48 | PENDING |
| IgnitionOmniDashboard.jsx | 41 | PENDING |
| IgnitionProc.jsx | 40 | PENDING |
| AdminSubscription.jsx | 39 | PENDING |
| IgnitionProcure.jsx | 38 | PENDING |
| IgnitionFlux.jsx | 31 | PENDING |
| IgnitionCompliance.jsx | 31 | PENDING |
| IgnitionCipher.jsx | 31 | PENDING |
| IgnitionStok.jsx | 30 | PENDING |
| IgnitionHandover.jsx | 16 | PENDING |
| SlideToComplete.jsx | 8 | PENDING |
| IgnitionVIN.jsx | 1 | PENDING |

---

*Counts verified by grep on 2026-05-31. Re-run `grep -rn "className=" packages/ --include="*.tsx" --include="*.jsx" -l` to refresh.*
