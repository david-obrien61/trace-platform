# CLOSE-OUT LEDGER

**Last updated:** 2026-06-23 · **Author:** Thunder (read-only reconciliation from repo truth)

> **STANDING RULE (binding):** This file is the SINGLE close-out record for the platform. Every future build/recon prompt ends by **updating its row here** (bar + SHA + owner-proof status) — not just its own `built-inventory.md` line. `built-inventory.md` answers "was X built?"; THIS ledger answers "is X closed, and if not, what exact live test closes it?" A deliverable whose ledger row is missing or stale is an incomplete task. This is the process fix that stops the tab-pile from re-accumulating.

> **Method:** reconciled against REPO truth — `git log`, `built-inventory.md`, the `verify-universals.mjs` matrix (exit 0, full Cultivar column green), and migration apply-state — NOT editor tabs or memory. Where the handoff text and the code disagreed, the code won (see Fabrication check).

> **The two bars:** **BUILDER-COMPLETE** = committed (SHA), compiles, structural/unit test passes — NOT proven live. **OWNER-PROVEN** = David confirmed live under a real session with a proof artifact (HAR / screenshot / live test). Only OWNER-PROVEN (or doc-only/superseded) closes a tab. **OPEN** = not built, not run, or half-done.

---

## The table

| # | Work item | Deliverable (one line) | Commit / SHA | Bar | Owner-proof owed (exact live test) | Blocker |
|---|---|---|---|---|---|---|
| 1 | Verify / deprecate AIEngine | AIEngine deprecated IN PLACE (BACKEND-DEAD / MODULE-STRANDED, removal blocked); 3 live Ignition callers documented | `db23ee6` | BUILDER-COMPLETE (doc/ledger decision) | None — ledger decision, not a live feature | Removal blocked: port 9 Ignition tasks + tier-gating to Vercel fns, repoint 3 modules |
| 2 | Role-based financial permissions | Chokepoint + backfill (Gate-1 25/0) + hard wall Phase 1/2; Gate-2 data-layer proof 6/0 | `00dc641`, `3ef3101` | READ-side **OWNER-PROVEN** (Staff HAR); render-layer **owed** | Part A render-layer: Staff session shows no cost requests on dashboard, gated routes redirect (folds into #4) | none (code in dist; needs live deploy) |
| 3 | RLS migrations | `is_active_member()` canonical primitive + standardize 14 member policies + `md_self` leak fix; oauth-secret relocation + `has_permission()` cost wall | `07dc88a`, `e81ba6e` | **OWNER-PROVEN** (applied as postgres; read-wall HAR; matrix #3/#4/#6 PASS) | None for read-wall (proven). Write-wall live proof rides #5 | none |
| 4 | Gate 3 close-out | Read-wall + OAuth secrets relocation APPLIED + owner-proven; Part A render layer committed | `ee2edcb`, `d7ee20f`, `b1b4ed3`, `8918fe8` | Read-wall **OWNER-PROVEN**; Part A render layer **owed-after-deploy** | Deploy to Vercel → fresh Staff HAR: cost requests absent from dashboard, inventory query qty-only, direct nav to gated routes redirects | Vercel deploy |
| 5 | Gate-3b write-wall | `cost-apply` endpoint permission-gated (caller must hold `view_costs`); write-tamper proof; matrix cap #7 live | `6259f43`, `5e075e3` | BUILDER-COMPLETE (cap #7 PASS; `verify-write-wall.ts` 7/7 deterministic) | Live role-driven HAR, two real JWTs: no-`view_costs` session → 403 on cost-apply; owner → succeeds | Vercel deploy |
| 6 | costDiscovery (banked) | Cost-to-produce reasoning engine, 6 paths, 26 unit tests | `219e264` | BUILDER-COMPLETE (26 unit tests) | `verify-cost-discovery.ts` (live service-key) **UNRUN**; then owner-prove cost-apply under Role Machine | cost-apply now gated (#5); live proof still owed |
| 7 | Citation convention (MB_D- / D_D-) | Source-prefix decision citations to disambiguate the two D-number namespaces | `9add1c3` | BUILDER-COMPLETE (convention/doc) | None — doc convention | none |
| 8 | Audit Ignition RBAC enforcement | Ground-truth recon: identity/invites shared, enforcement render-only & Ignition-side; action-permission trace | `ignition-rbac-ground-truth.md`, `ignition-action-permissions-trace.md`, `role-enforcement-ground-truth.md` (untracked, by design) | Recon COMPLETE (doc-only) | None — read-only recon | Docs intentionally untracked in `data/grower-scan/` (David's call) |
| 9 | Tile registry (single source, MB_D-012) | ONE `tileRegistry.ts`; MODULE_META/MODULE_ORDER/Dashboard switches killed; every surface reads it; caps #a + #e live | `c36e562` | BUILDER-COMPLETE (caps #a + #e PASS; build clean) | Registry-driven grid live: owner sees all live tiles incl. 6 financial surfaces; Staff (no `view_costs`) sees neither cost tiles nor today's-sales/inventory-value readouts | Vercel deploy |
| 10 | Vertical field (registry) | Additive `vertical` field on every entry; vertical-aware enablement (general + business_type's vertical); Ignition-reconnection bridge | `c7cc410` | BUILDER-COMPLETE (cap #a extended PASS; no-migration) | Live grid unchanged for nursery/generalist today (no regression); split proves when first `cultivar`/`ignition` tile registered | Vercel deploy |
| 11 | Persistent identity header (cap #1) | Shared `<AppHeader>` mounted once in `AppLayout` inside PrivateRoute; business name + email + role badge; cap #1 FAIL→PASS | `e590621` | BUILDER-COMPLETE (cap #1 PASS; build clean) | Header live on multiple pages under a real session; role badge correct owner vs Staff | Vercel deploy |
| 12 | Role-config recon | Verify-first recon: role→FIELD visibility (config absent, needs owner UI + role-aware RLS) + cost-discovery-on-Opus sizing | `role-and-discovery-recon.md` (untracked, 2026-06-21) | Recon COMPLETE (doc-only) | None — read-only recon | Doc intentionally untracked (David's call) |
| 13 | Campaign double-representation diagnostic | — | **NOT RUN** (no doc exists) | OPEN | n/a until run | Not started |
| 14 | Doctrine commits (Role Machine, MASTER_BRIEF D-010..D-015) | Role architecture doctrine + write-wall invariant + acceptance tests (SKIP-until-green) | `789568d` | BUILDER-COMPLETE (doc/doctrine) | None — doctrine; acceptance tests flip live when each piece is built | none |
| 15 | Design captures (Regina Principle · Delivery · social-intelligence) | Regina Principle thesis (MASTER_BRIEF PART 4); social-scheduling/measurement concept; delivery loop (built + deploy-verified live) | `54f7511`, `0d1293a`; delivery `253cf49`/`a6cb831`/`af3b16c` | Doctrine doc-only = BUILDER-COMPLETE; **Delivery loop = OWNER-PROVEN deploy-verified live** (phone owner-prove of full snap→schedule→route still owed) | Delivery: snap Marcus Webb invoice → schedule → lands under day → "Route this day" plots (phone) | none |
| 16 | Role-config console (visibility axis) — PART A | `bm_self_update` self-grant hole closed (authority-immutability trigger + tightened WITH CHECK) + `role_definitions` three-tier store (floor/override/custom) + 3-role floor seed | `20260623_role_definitions_and_self_grant_fix.sql` | **APPLIED + catalog-verified 8/8** (A)-(H) by David (no PAT minted) | OWNER-PROVEN owed: live self-elevation-refused test (bundles with deploy pass) | none |
| 16B | Role-config console (visibility axis) — PART B | Cultivar-native RolesTab console at `/roles` (registry-fed chips, clone-not-mutate, locked system roles, factory-reset) wired to single `can()` + existing `updateMemberRole()`; verify-universals #s/#f/#g live + #e exercised | `__PENDING__` (this commit) | BUILDER-COMPLETE (build clean 2211 modules; changed files tsc-clean; matrix exit 0) | OWNER-PROVEN owed = David configures a STAFF role live, switches to it, confirms cost tiles + today's-sales/inventory-value readouts vanish, cost writes refuse, self-elevation refuses | Vercel deploy |

---

## CLOSE THESE TABS NOW
*OWNER-PROVEN, or BUILDER-COMPLETE doc-only / recon / superseded with no live dependency. Close these editors.*

1. **#1 AIEngine deprecation** — ledger decision, no live feature.
2. **#3 RLS migrations (read-wall)** — applied as postgres, read-wall HAR-proven, matrix green. (Write-wall live proof rides #5.)
3. **#7 Citation convention** — doc convention.
4. **#8 Ignition RBAC audit** — recon complete (docs untracked by design).
5. **#12 Role-config recon** — recon complete (doc untracked by design).
6. **#14 Doctrine commits (D-010..D-015)** — doctrine captured.
7. **#15 Design captures (Regina + social-intelligence)** — doc-only doctrine. (Delivery code is deploy-verified live; only the optional phone owner-prove of the full chain remains — not blocking.)

→ **7 tabs closeable now.**

## OWNER-PROOF OWED — ONE DEPLOY CLEARS THESE
*All of these close in a SINGLE owner + staff live session after one Vercel deploy. Deploy `main`, then run one owner JWT + one no-`view_costs` Staff JWT through the app:*

- **#2 / #4 Part A render layer** — Staff session: cost requests absent from dashboard, inventory query qty-only, direct nav to gated routes redirects.
- **#5 Gate-3b write-wall** — no-`view_costs` JWT → 403 on cost-apply; owner JWT → succeeds.
- **#9 Tile registry grid** — owner sees all live tiles incl. 6 financial surfaces; Staff sees neither cost tiles nor cost readouts.
- **#10 Vertical field** — live grid unchanged for nursery/generalist (no regression).
- **#11 Identity header** — header on multiple pages; role badge correct owner vs Staff.

→ **5 items, 1 deploy + 1 two-JWT live session.**

## GENUINELY OPEN
*Not built / not run / half-done — each with its next action.*

- **#13 Campaign double-representation diagnostic** — not run; no doc exists. **Next:** run the diagnostic (queued).
- **#6 costDiscovery live proof** — `verify-cost-discovery.ts` (live service-key) UNRUN; then owner-prove cost-apply under Role Machine. **Next:** run the service-key proof, then live owner-prove the gated endpoint.
- *(Forward, not this session)* **#1 AIEngine removal** — blocked until 9 Ignition tasks + tier-gating port to Vercel fns and 3 modules repoint.

---

## Fabrication check — half-done items surfaced
*For each BUILDER-COMPLETE claim, verified code/commit/migration backs the ledger line.*

1. **Registry handoff said `__PENDING__`; code says COMMITTED.** Handoff entries for the tile registry (#9) and vertical field (#10) both carry `Commit __PENDING__`. Repo truth: `c36e562` and `c7cc410` are landed and pushed. **Ledger corrected to the real SHAs** — not a fabrication of completion, a stale commit placeholder.
2. **#6 costDiscovery — genuinely half-done (flagged, not hidden).** Built-inventory/handoff correctly label it BUILDER-COMPLETE on 26 unit tests but NOT owner-proven, with `verify-cost-discovery.ts` UNRUN. Confirmed: the script exists (`scripts/verify-cost-discovery.ts`) but there is no live-proof artifact. The earlier write-wall gap it carried is now closed by #5 (cap #7 PASS). **Stays OPEN until the live proof runs.**
3. **#13 campaign diagnostic — claimed "queued," confirmed NOT RUN.** No `*campaign*` diagnostic doc exists under `data/grower-scan/` or `docs/`. Correctly OPEN.
4. **Migrations: no written-not-applied half-done found.** All cost/RLS migrations through `20260622` (`is_active_member_canonical_rls`, `oauth_secrets_relocation_and_cost_wall`, `financial_wall_phase2`, `business_discovery_profiles`, `recovery_basis`, `deliveries*`) are applied per the ledger's owner-confirmed-as-postgres state, and the matrix that depends on them (cap #3/#4/#6/#7) exits 0. No staged-but-unapplied migration is sitting in the tree.
5. **verify-universals matrix is real and green** — ran `node scripts/verify-universals.mjs` → exit 0; Cultivar column #1–#7 + #a + #e all PASS; Ignition #1 PASS, rest documented SKIP. The caps backing #2/#4/#5/#9/#10/#11 are live assertions, not stubs.

**No item claimed done that the code contradicts** (the one mismatch — `__PENDING__` SHAs — was the handoff lagging the commits, corrected above).
