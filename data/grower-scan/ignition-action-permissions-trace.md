# Ignition action-permissions trace — 8 strings, code evidence + inferred workflow

**Date:** 2026-06-21 · **Type:** READ-ONLY recon (verify-first) · **Author:** Thunder (Claude Code)
**Scope:** `packages/ignition-os/` only. Repo is authority; David supplies intent ONLY where code shows nothing.
**Companion to:** `data/grower-scan/ignition-rbac-ground-truth.md`, `role-enforcement-ground-truth.md`, `role-and-discovery-recon.md`
**Corrects:** the prior recon's flat "DECORATIVE" label, which could not distinguish *named-only* (dead) from *stubbed/in-progress* (workflow exists, permission not wired).

---

## 0. The gate mechanism (read this first — it explains every verdict)

There is exactly **ONE runtime permission gate** in Ignition, plus **ONE ad-hoc role-badge check**. Neither consults any of the 8 action strings.

**(a) `AccessGatekeeper`** — `CoreApp.jsx:459-509` (defined inline; there is no standalone class/file despite the TRACE comments naming it).
- `CoreApp.jsx:466-468`:
  ```
  const rolesRegistry    = DataBridge.getSystemRoles();
  const userCapabilities = currentUser.permissions.flatMap(role => rolesRegistry[role] || []);
  const hasAccess        = requiredPermissions.some(rp => userCapabilities.includes(rp)) || overrideActive;
  ```
- **Every** `<AccessGatekeeper requiredPermissions={...}>` call site (`CoreApp.jsx:1028, 1041, 1046, 1051, 1056, 1061, 1066, 1071, 1078, 1123, 1130, 1137, 1144, 1151, 1158, 1163, 1168, 1173, 1178`) passes ONLY `view_*` strings, `manage_users`, or `[]`. **None of the 8 action strings is ever passed as `requiredPermissions` anywhere in the codebase.**

**(b) ADMIN role-badge check** — the only other runtime permission test:
- `PriceField.jsx:33` / `PriceField.native.js:18`: `isAdmin = currentUser?.permissions?.includes('ADMIN')` → gates the price-override unlock toggle.
- `CoreApp.jsx:867` (ADMIN bypass: returns children) and `CoreApp.jsx:1096` (`isAdmin` UI branch).
- These check the **role-badge `'ADMIN'`**, NOT `PRICING_AUTHORITY` / `edit_margins` / any of the 8.

**Where the 8 strings DO live** — all *definition / assignment* surfaces, never *consumption / gate* surfaces:
- **Catalog:** `IgnitionAdmin.jsx:39-46` (`ALL_PERMISSIONS`, the role-editor UI list).
- **Role presets:** `IgnitionAdmin.jsx:52-55` (`ROLE_PRESETS`), `DataBridge.js:1114-1116` (`getSystemRoles()` fallback expansion map), `CoreApp.jsx:253-256` (`defaultPerms` written to `shop_members` on enrollment).
- **Seed profiles:** `DataBridge.js:830, 833` + `OnboardingWizard.jsx:173` (`PRICING_AUTHORITY` as a seed-profile badge).

**TD#28 format-collision (documented, relevant):** `getSystemRoles()` is keyed by role-badge (`ADMIN`/`TECH`/`CUSTOMER`), but `IgnitionAdmin` writes `shop_members` with capability-strings (`view_flux`…). So `userCapabilities.flatMap` returns `[]` for real members → even the wired `view_*` gates fail-closed for shop_members (`CoreApp.jsx:469-474` TRACE detector). Context: the gate plumbing itself is half-broken, independent of the 8 strings.

**Bottom line:** at the gate level, **all 8 strings gate nothing today.** But 6 of 8 have real, reachable workflow modules — gated by a *different* mechanism (a `view_*` module gate, the ADMIN badge, or prop-based routing). That is why "stubbed / in-progress" — not "dead/decorative" — is the accurate label for most.

---

## 1. PRICING_AUTHORITY

1. **References:** catalog `IgnitionAdmin.jsx:39` (label "Edit Pricing Slabs", group Financial) · preset `IgnitionAdmin.jsx:52` (ADMIN) · seed-profile badge `DataBridge.js:830, 833` + `OnboardingWizard.jsx:173`. **Not passed to any gate; no `.includes('PRICING_AUTHORITY')` anywhere.**
2. **Wiring state:** **STUBBED / IN-PROGRESS.** The pricing-edit workflow it names is REAL and working — `PriceField.jsx` (margin matrix + override unlock + leakage "Relationship Tax" calc via `MarginEngine.calculateRetail`) — but that field is gated by `permissions.includes('ADMIN')` (`PriceField.jsx:33`), **not** by `PRICING_AUTHORITY`. So: workflow exists, permission string unwired.
3. **Associated workflow (INFERRED):** the Financial-group label "Edit Pricing Slabs" + the `view_prot` PROT module ("Margins") + `PriceField`/`MarginEngine` strongly suggest this is the intended *granular* gate for who may override retail pricing — a capability-string meant to replace the blunt ADMIN-badge check. **Inference, not fact.**
4. **Customer-facing:** No — internal (technician/advisor price entry).

## 2. edit_margins

1. **References:** catalog `IgnitionAdmin.jsx:40` (label "Edit Margins (Legacy)", group Financial) · preset `IgnitionAdmin.jsx:52` (ADMIN) · expansion map `DataBridge.js:1114` (ADMIN). **Not passed to any gate.**
2. **Wiring state:** **STUBBED / IN-PROGRESS (legacy sibling of #1).** Same backing workflow as `PRICING_AUTHORITY` (`PriceField` + `MarginEngine`), label literally tagged "(Legacy)". Unwired to any check.
3. **Associated workflow (INFERRED):** the "(Legacy)" tag + co-location with `PRICING_AUTHORITY` in the Financial group suggests `edit_margins` is the OLD name and `PRICING_AUTHORITY` the intended replacement — two strings for one capability mid-rename. **Inference.**
4. **Customer-facing:** No — internal.

## 3. approve_payroll

1. **References:** catalog `IgnitionAdmin.jsx:41` (label "Approve Payroll", group Financial) · preset `IgnitionAdmin.jsx:52` (ADMIN) · expansion map `DataBridge.js:1114` (ADMIN). **Nothing else — no workflow, no handler, no table, no component.**
2. **Wiring state:** **NAMED-ONLY.** Catalog + assignment maps only; zero implementation. `grep -i payroll` across all ignition source returns ONLY these definition lines.
3. **Associated workflow (INFERRED):** intent not recoverable from code — there is no payroll/timesheet/wage module anywhere in `ignition-os`. (Matches David's note that payroll was deliberately not pursued; code corroborates by absence.)
4. **Customer-facing:** No — internal (financial admin).

## 4. scan_parts

1. **References:** catalog `IgnitionAdmin.jsx:43` (label "Scan Parts", group Tech Ops) · presets `IgnitionAdmin.jsx:52-53` (ADMIN, TECH) · expansion map `DataBridge.js:1115` (TECH) · `defaultPerms` `CoreApp.jsx:253` (assigned to new TECH members). **Not passed to any gate; no `.includes('scan_parts')`.**
2. **Wiring state:** **STUBBED / IN-PROGRESS.** No handler references the string, but the parts-with-cost workflow it implies EXISTS and works: `IgnitionProcure.jsx` ("Procurement UI for inputting parts, vendors, wholesale costs, core charges"; `:56-100` cost entry → `MarginEngine.calculateRetail`) and `IgnitionStok.jsx` (inventory: `qty`, `unit_cost`, `:50-52, :144`). Both are gated by `view_proc` / `view_stok`, not by `scan_parts`.
3. **Associated workflow (INFERRED):** the label "Scan Parts" + the existing Procure (parts/vendor/wholesale-cost entry) and Stok (inventory qty/cost) modules suggest `scan_parts` is the intended *action* gate for a tech receiving/adding parts (with cost) on the floor. NOTE: the modules are **manual text entry** — no barcode/camera scanner found (`grep -i 'barcode|scan'` in Procure/Stok empty); "scan" is aspirational naming. **Inference.**
4. **Customer-facing:** No — internal (Tech Ops).

## 5. update_flux

1. **References:** catalog `IgnitionAdmin.jsx:44` (label "Update Job Status", group Tech Ops) · presets `IgnitionAdmin.jsx:52-53` (ADMIN, TECH) · expansion map `DataBridge.js:1115` (TECH) · `defaultPerms` `CoreApp.jsx:253`. **Not passed to any gate.**
2. **Wiring state:** **STUBBED / IN-PROGRESS.** The job-status workflow is REAL: `IgnitionFlux.jsx` is the workflow board with a full status state machine (`STATUS_META` `:24-32`: `authorized`, `in_repair`, …; `FILTER_STATUSES` `:41-44`; status-based routing `:95-113`) and `IgnitionKosk.jsx` performs `authorized→in_repair` transitions (`:18` TRACE comment). FLUX/KOSK are gated by `view_flux` / prop routing, not by `update_flux`.
3. **Associated workflow (INFERRED):** label "Update Job Status" + the FLUX status machine make this the intended gate for *who may advance a job's status*. David floated "logistics/PMI scheduling" — code does NOT support that reading: `update_flux` maps to FLUX **job status**, and the PMI subsystem (`DataBridge.js:308-310` `pmi_schedules`, `:1047-1076` `getPMIAssets`/`savePMIAsset`) is a **separate** tool-maintenance feature with no link to this string. ("FLUX" = the workflow board, per `view_flux` = "View FLUX (Workflow)".) **Inference.**
4. **Customer-facing:** No — internal (Tech Ops).

## 6. sign_estimates

1. **References:** catalog `IgnitionAdmin.jsx:45` (label "Sign Estimates", group **Customer**) · presets `IgnitionAdmin.jsx:54-55` (SERVICE, CUSTOMER) · expansion map `DataBridge.js:1116` (CUSTOMER) · `defaultPerms` `CoreApp.jsx:255` (assigned to new SERVICE members). **Not passed to any gate; no `.includes('sign_estimates')`.**
2. **Wiring state:** **STUBBED / IN-PROGRESS — substantial scaffolding.** The estimate-approval-with-signature workflow EXISTS and is the most built-out of the customer strings: `CustomerApprovalPortal.jsx` ("Customer-facing line-item estimate approval with digital signature … reads `estimate_line_items`, writes `customer_authorizations`"), `IgnitionPort.jsx` (customer portal presenting estimates + collecting signatures; imports `CustomerApprovalPortal`), plus `CustomerApproval.jsx`, `CustomerEstimate.native.js`, `IgnitionPort.native.js`. None references the `sign_estimates` string — the surface is reached via the PORT module (`view_port`), not gated by `sign_estimates`.
3. **Associated workflow (INFERRED):** named tables `customer_authorizations` + `estimate_line_items` and the signature components make `sign_estimates` the intended gate for *customer approves/signs an estimate*. Matches David's "customer text/email approval" intent — the in-person tablet flow is built; text/email delivery not confirmed in this trace. **Inference (workflow), confirmed customer-facing (below).**
4. **Customer-facing:** **YES.** `CustomerApprovalPortal.jsx` header: "Presented in-person on a tablet turned toward the customer." Group "Customer"; assigned to the `CUSTOMER` role. This is exactly why the prior recon (scanning internal role gates) read it as orphaned — it gates a **customer surface**, not a staff tile.

## 7. pay_invoice

1. **References:** catalog `IgnitionAdmin.jsx:46` (label "Pay Invoice", group **Customer**) · presets `IgnitionAdmin.jsx:55` (CUSTOMER) · expansion map `DataBridge.js:1116` (CUSTOMER). **Not passed to any gate.**
2. **Wiring state:** **STUBBED / IN-PROGRESS.** The invoice/payment workflow EXISTS: `IgnitionInvoice.jsx` ("Invoice generation and payment processing for authorized repair orders"; imports `CreditCard, Banknote, Building2` payment icons). Does not reference the `pay_invoice` string.
3. **Associated workflow (INFERRED):** label "Pay Invoice" + `IgnitionInvoice` payment-processing module make this the intended gate for *customer pays an invoice*. **Inference.**
4. **Customer-facing:** **YES.** Group "Customer"; assigned to `CUSTOMER` role; the module processes customer payment. Same blind-spot as #6 for the prior internal-gate recon.

## 8. view_kosk

1. **References:** expansion map `DataBridge.js:1115` (TECH) **only**. **NOT in the catalog `ALL_PERMISSIONS`** (`IgnitionAdmin.jsx:27-47` lists `view_*` modules but no `view_kosk`), and never passed to any gate.
2. **Wiring state:** **NAMED-ONLY as a permission** (orphan entry in one expansion map, not even in the role-editor catalog) — **BUT the KOSK module itself is real and reachable.** `IgnitionKosk.jsx` (technician kiosk / toolbox mode; `:41` component) is entered via the `onEnterKiosk` prop → `setIsKioskMode(true)` (`CoreApp.jsx:716, 897-903, 1057, 1125`), and rendered directly in `IgnitionCore.js:149`. Entry is **not gated by `view_kosk`** — it is prop/state routing.
3. **Associated workflow (INFERRED):** `view_kosk` looks like a leftover from when the technician kiosk was meant to be a module gated like the others; the module shipped but reachability moved to prop routing, leaving the string stranded. NOTE: `IgnitionKosk` = **technician** kiosk (toolbox mode, job-status transitions), distinct from `CustomerKiosk.native.js` (App.js:27/117-119, native customer kiosk). **Inference.**
4. **Customer-facing:** No — `IgnitionKosk` is the **technician** kiosk. (A separate `CustomerKiosk` exists on the native path but is unrelated to this string.)

---

## 9. Summary

| String | Wiring state | Workflow scaffolding | Customer-facing | Worth finishing? |
|---|---|---|---|---|
| PRICING_AUTHORITY | STUBBED | `PriceField` + `MarginEngine` (gated by ADMIN badge) | No | Yes — real workflow, just needs the string wired in place of the ADMIN badge |
| edit_margins | STUBBED (legacy) | same as above, "(Legacy)" | No | No — looks like the superseded name for PRICING_AUTHORITY |
| approve_payroll | **NAMED-ONLY** | none | No | No — no module exists; intent not in code |
| scan_parts | STUBBED | `IgnitionProcure` + `IgnitionStok` (gated by view_proc/view_stok) | No | Yes — parts-cost workflow exists (manual entry, no scanner) |
| update_flux | STUBBED | `IgnitionFlux` status machine + `IgnitionKosk` (gated by view_flux) | No | Yes — job-status workflow exists |
| sign_estimates | STUBBED (most built) | `CustomerApprovalPortal` + `IgnitionPort` (+ `customer_authorizations`/`estimate_line_items` tables) | **Yes** | Yes — substantial; in-person tablet signature flow built |
| pay_invoice | STUBBED | `IgnitionInvoice` (payment processing) | **Yes** | Yes — invoice/payment module exists |
| view_kosk | **NAMED-ONLY** (string) | KOSK module exists but reached by prop routing, not this string | No (tech kiosk) | Marginal — module already reachable; string is a stranded leftover |

**Counts:** WIRED **0** · STUBBED / IN-PROGRESS **6** (PRICING_AUTHORITY, edit_margins, scan_parts, update_flux, sign_estimates, pay_invoice) · NAMED-ONLY **2** (approve_payroll, view_kosk).

**Correction to the prior recon:** "decorative / gates nothing" is true at the *gate* level for all 8 — none is consulted by `AccessGatekeeper` or any `.includes()` check. But it conflated two very different states. Only **approve_payroll** (no workflow at all) and **view_kosk** (stranded string; module reachable elsewhere) are genuinely dead. The other **6 back real, working workflow modules** that are simply gated by a different mechanism (`view_*` module gate, the ADMIN role-badge, or prop routing) rather than by their own capability-string. The two customer strings (`sign_estimates`, `pay_invoice`) read as orphaned to an internal-role-gate scan precisely because they gate **customer-facing** surfaces (`CustomerApprovalPortal`, `IgnitionInvoice`), assigned to the `CUSTOMER` role.

**Structural note (not a recommendation):** wiring any of the 6 stubs would also require resolving TD#28 — the `shop_members` capability-string ⟷ `getSystemRoles` role-badge format collision (`CoreApp.jsx:469-474`, `DataBridge.js:1118`) — since even the existing `view_*` gates fail-closed for real members today.

---

*READ-ONLY recon. No code/schema/build/design changed. Code-evidence and inference kept separate; all inference labeled. No built-inventory change.*
