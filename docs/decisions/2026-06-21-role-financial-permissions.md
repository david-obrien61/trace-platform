# Decision: Role-Based Financial Permissions (v1)

**Date:** 2026-06-21
**Source:** Recon — [data/grower-scan/role-enforcement-ground-truth.md](../../data/grower-scan/role-enforcement-ground-truth.md)
**Status:** Locked decision. Docs-only sign-off artifact — no code, no schema, no canonical-doc edits. This record is the SIGN-OFF for the hardening build that follows; the reasoning is the point.
**Gates:** Two-bar / RLS gates N/A (no build this pass). The build that follows owes both bars.

> **Why this file exists:** Recon found that role enforcement on financial data is render-only — the permission strings exist and are read into context but gate nothing at the data layer. This record fixes the v1 permission model, the enforcement mechanism per data class, the binding doctrine, and the items that must not be lost when the hardening build happens. Written faithfully; the WHY is the point.

---

## Problem (verified, not assumed)

Recon ([data/grower-scan/role-enforcement-ground-truth.md](../../data/grower-scan/role-enforcement-ground-truth.md)) found role enforcement is
RENDER-ONLY. RLS is uniformly tenant-scoped; zero policies reference role/permissions.
The `business_members.permissions` JSONB is written + read into context but consulted
by NO policy or API. Exactly ONE render gate fires (manage_settings → /settings); the
other seven Cultivar permission strings are placeholders that gate nothing. ~26
sensitive columns across 6 tables sit owner_all+member_all only — several ungated.
Tenant isolation (AC-2/AC-3) is intact and SEPARATE from this gap. This is a within-
tenant, between-role gap: today only render-deep, real the moment a grower has
employees on different roles.

## Decision — four permissions, default-deny, finer-grained on purpose

- view_wages          → labor_resources.base_wage/burden/cost_rate/bill_rate (HR pay)
- view_pricing_config → business_modules.config pricing blob (margin floors, c2p
                        params, markup logic — the pricing recipe / moat)
- view_costs          → operational unit_cost (/costs,/inventory,/assets,/operating-costs)
- view_margin         → the margin verdict (cost-vs-sell-price). Requires view_costs:
                        never show the verdict to someone denied its inputs.

## Role defaults

- Owner   → all four
- Manager → view_costs + view_margin (operations must see what's selling short).
            NOT view_pricing_config (pricing recipe stays owner's moat).
            NOT view_wages (payroll isn't ops).
- Tech    → none, unless explicitly granted.

## Enforcement mechanism — by data class (hybrid, deliberate)

- HARD DATA-LAYER WALL (RLS + column masking via security-barrier view or child-table
  split) for view_wages + view_pricing_config — the crown jewels.
- ROLE-AWARE RESPONSE SHAPING for view_costs + view_margin — the system itself
  consumes unit_cost server-side (checkout subtotal math #11/#12, dashboard rollups,
  /api/dashboard), so it must keep computing while WITHHOLDING the value from the
  response for roles lacking the permission. Flat RLS-deny would NULL checkout totals
  and break dashboards — confirmed in blast radius (14 unfiltered multi-role SELECT
  sites).
- RENDER GATES are the top convenience layer ONLY, never the sole control.

## Doctrine (binding going forward)

- DEFAULT-DENY: a sensitive column with no declared permission gate is INVISIBLE, not
  accidentally visible. New sensitive columns must declare their gate or stay hidden.
- SINGLE CHOKEPOINT: all permission checks route through the existing-but-unwired
  can()/checkPermission() helpers. No scattered inline .includes(). The reason seven
  strings rotted into placeholders is there was no chokepoint to enforce them.
- RESTRICTIVE-FIRST, EXPAND-ONLY: v1 is deliberately maximally restrictive.
  Permissions are LOOSENED later only by deliberate grant if management overhead
  justifies it. Grants expand; they do NOT retroactively narrow. Walking back access
  is harder and riskier than granting it, so we start tight. (Owner's stated principle:
  "more is better right now on security.")
- PROOF BAR: a wall is proven only by a low-role session issuing a DIRECT query for a
  gated value (base_wage, unit_cost, margin) and being refused at the NETWORK RESPONSE
  — not by a cost-free rendered page. Render-absence is not a wall.

## Carry-forward / resolve-at-build (do not lose)

- Mint + seed the four permission strings; backfill all CURRENT members (owner) with
  full grants BEFORE enforcement flips on, so no existing user loses access.
- Wire the dormant can()/checkPermission() chokepoint.
- Column-masking approach (view vs child-table) for the hard wall — chosen at build
  against live schema, choice reported.
- The 14 SELECT sites need per-site hand-verification at build (recon line numbers
  cross-corroborated but not all hand-opened).
- CHECKOUT (#11/#12) is public/possibly-unauth and consumes unit_cost — exact shaping
  on that surface is an OPEN build-time question: confirm what it currently returns to
  the client and ensure unit_cost never leaves the server for the public path.
