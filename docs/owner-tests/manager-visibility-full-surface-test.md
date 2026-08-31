# MANAGER VISIBILITY — FULL-SURFACE OWNER TEST

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> One glance. Match it to `git log --oneline origin/main -1` — **not to a SHA written in this
> file**, because Vercel deploys the TREE and *any* push to `main`, docs included, moves the
> stamp. *(GATE 0 · OP-15 · paid for twice on 2026-08-31: once hunting a defect in code that
> was never deployed, once by a pinned SHA going stale on the very next commit.)*

> **Rendered board:** open `owner-tests.html` (a PURE renderer — it parses this file live and holds
> no data of its own). Sibling of `stories.html` / `status.html`.
>
> **This file is the ONLY source of truth for the manager-visibility owner-tests.** It is STANDING —
> run it after any change to the order-read RLS family, `service_offerings` RLS, the tax-rate read,
> the `/customers` route gate, or the role-card pill catalog. A per-build proof is a FILTER
> (`COVERS: #NNN`), never a second doc.

**Purpose:** prove the six gaps David found live on 2026-07-24 (signed in as a MANAGER, tenant
f7ec5d67, member df7723be) are closed — and, because every fix EXPANDS access, prove the wall still
holds with a NEGATIVE twin for each. STD-020: one permission = one capability, checked at every layer.

**Why this exists (the defect these cards defend against):** a manager could TAKE an order and then
read "No orders yet" (route open on `view_orders`, `orders` RLS owner-only — open at the door, locked
at the vault); `/customers` was unreachable at any permission over a table that already granted the
read (locked at the door, vault open); a $544 invoice went out UNTAXED because the tax rate shared the
pricing-recipe wall. Cards 1/5/7 are the live proofs; cards 2/6/8/10 prove the wall.


> ## ⛔ SUPERSEDED BY THE resource:action REBUILD (2026-07-26, Phase 0)
>
> **ALL 10 CARDS ON THIS BOARD ARE SUPERSEDED** — see `docs/owner-tests/rbac-resource-action-full-surface-test.md`.
> Per spec §9 the old cards are **not edited into the new model**: the string mapping changed
> enough that editing would carry a stale assumption forward. Cards **1–8 and 10** are RE-WRITTEN as **R-1 … R-9** against the new strings (`orders:read`, `order_items:read`, `service_offerings:read`, `tax_rate:read`, `customers:read`, `pricing_recipe:read`). Card **9** (pill count == lit pills) is **RETIRED** — the Roles page will render FROM the manifest, so N-4 asserts the stronger claim.
>
> 🔴 **Two of the re-written cards ship with a REQUIRED `SETUP` block, because the live tenant contradicts their as-shipped premise:** card 2 (the live STAFF member HOLDS `view_orders`, so the Note A split is not the shipped configuration) and card 10 (the live MANAGER HOLDS `view_pricing_config`, so the card asserts the wall holds when the string is ABSENT — not that this manager is currently walled). Running either as-configured fails for the wrong reason.
> **Do not run a superseded card as evidence** — it asserts a string that is being retired.

---

## HOW TO READ A CARD

| Tag | Means |
|---|---|
| `STATUS: covered` | 🟢 A test exists AND it passed on `LAST-PROVEN`. Only David sets this. |
| `STATUS: owed` | 🟡 Written but not run since the surface changed. **Not proven.** |
| `STATUS: needs-test` | 🔴 Surface exists, no test — a known hole. |
| `LAST-PROVEN: never` | Nobody has ever run this against the real UI. |
| `DEVICE:` | `phone` (capture) · `desktop` (reconcile/admin) · `either`. |
| `COVERS:` | The ledger row / gap / card this check defends. |
| `SIGNAL:` | The `[TRACE:*]` line. **Always secondary** — every PASS must be visible without a console. |

**PASS = every card in scope is `covered` with today's date.** Thunder never sets `covered` (OP-14).

---

## ⛔ GATE 0 — CONFIRM YOU ARE TESTING THE DEPLOYED CODE (OP-15 — owner-prove STEP ZERO)

> **STEP ZERO. Before you read any screen as evidence: confirm the deploy for the SHA under test is
> live AND the GATED migration `20260724_manager_visibility_gaps.sql` is applied with V1–V12 green.**
> The member RLS policies and `get_business_tax_rate` do not exist until the migration is applied —
> until then a manager still sees "No orders yet" and every observation below is fiction.

- [ ] **① SHA is live** — the bottom-of-screen stamp `built <date> · <sha>` matches `git log -1 --format=%h`.
- [ ] **② migration applied** — run V1 (the five `*_member` policies + the owner policies both present) and V2 (`get_business_tax_rate` is DEFINER, `search_path=''`, authenticated-only). If a member policy is missing, STOP — the gap is not closed.
- [ ] **③ the actor holds the permission** — the MANAGER's `business_members.permissions` contains `view_orders` and `view_customers` (grant via the funnel on /team first if not).

---

### 1. A MANAGER sees the orders they took — roster count is non-zero
STATUS: owed
DEVICE: desktop
COVERS: gap #2/#3, ledger #153, STD-020, the live defect (CLV-20260723-3077)
LAST-PROVEN: never
SIGNAL: `[TRACE:INVENTORY]`/order-detail render; server proof = `orders_member_select` returns rows
- **Do:** sign in as the MANAGER (holds `view_orders`). Open `/orders`.
- **PASS:** the orders the manager created appear — **including CLV-20260723-3077** — and opening one shows a non-zero plant-line roster count (the plant lines render, not "PLANTS (0)").
- **FAIL:** "No orders yet · 0 recent checkouts" (the exact live defect) OR the order opens with roster count 0.
- **Why:** before this build `orders`/`order_items` were owner-only; the manager passed the route and read zero rows.

### 2. (NEGATIVE) A STAFF member WITHOUT `view_orders` still sees nothing on `/orders`
STATUS: owed
DEVICE: desktop
COVERS: STD-020 default-deny; migration V7
LAST-PROVEN: never
- **Do:** sign in as a STAFF member who does NOT hold `view_orders`. Open `/orders`.
- **PASS:** no orders render (the page is empty — the member policy's `has_permission('view_orders')` denies). The expansion did not leak to a member who lacks the permission.
- **FAIL:** any order row appears.
- **Why:** an access expansion is an unproven claim about who can see what until the negative holds.

### 3. A MANAGER's committed count matches the owner's — 132 units read as COMMITTED, not available
STATUS: owed
DEVICE: desktop
COVERS: gap #3, tech-debt #66 (re-scoped), STD-020
LAST-PROVEN: never
SIGNAL: committed-stock derivation reads `order_items`
- **Do:** as the MANAGER, open a lot with committed stock (the owner reads e.g. `{lots:4, committed:132}`).
- **PASS:** the manager reads the SAME committed count the owner does — 132 spoken-for units show as COMMITTED, not AVAILABLE.
- **FAIL:** the manager reads `lotsCommitted: 0` and 132 committed units render as available (the pre-build state).
- **Why:** `order_items` was owner-only, so the derivation silently returned 0 for a manager.

### 4. A MANAGER sees add-ons, can pick a transport service, and can set a delivery date
STATUS: owed
DEVICE: phone
COVERS: gap #1 (`service_offerings` member SELECT), ledger #153
LAST-PROVEN: never
- **Do:** as the MANAGER, run a checkout on a phone. Reach the review/service step.
- **PASS:** the add-ons appear, a transport/delivery service can be selected, netting shows for self-transport, and choosing delivery lets a delivery date be set. (Provable without a console — this is a `phone` card.)
- **FAIL:** no add-ons, no transport option, no netting — the empty catalog the manager saw before.
- **Why:** `service_offerings` was owner-only; a manager read no offerings.

### 5. 🔴 A MANAGER's order applies TAX at the tenant's real rate
STATUS: owed
DEVICE: phone
COVERS: gap #4 (`get_business_tax_rate`), STD-020, the untaxed $544 invoice, D-9 copy fix
LAST-PROVEN: never
- **Do:** **FIRST read the tenant's CURRENT rate** — `SELECT config->>'taxRate' FROM business_pricing_config WHERE business_id = :bid;` — and use THAT number for the arithmetic below. Then, as the MANAGER, build the SAME kind of order that went out at $544.00 untaxed. Reach review.
- **PASS:** the tax line shows **the rate you just read**, applied (amount non-zero, no ⚠ redline), and the total includes it. The order that went out untaxed now carries tax.
- **FAIL:** "⚠ Tax: not identified", tax $0, total excludes tax — over a rate that IS set. Also FAIL if the rate shown is not the one in `config`.
- **Why:** the rate lives behind the `view_pricing_config` wall; the manager read null. The narrow `get_business_tax_rate` RPC returns the rate to any member.
- **🔴 DO NOT ASSERT A LITERAL RATE (corrected 2026-07-27).** Earlier docs carry **0.0825**; the tenant's actual value is **0.076**, changed by David during testing, and **#153's catalog verification is STALE on that number**. A card that hardcodes a rate tests the DOC, not the SYSTEM — and it would fail a correct system or pass a broken one depending on which way the drift ran. **Read it at run time, every time.** This is the same class as spec §5 naming three protected fields that were not there: an assertion written from a document rather than from the data.

### 6. (NEGATIVE) A non-member gets NO tax rate from the narrow read
STATUS: owed
DEVICE: desktop
COVERS: STD-020 narrow-read scope; migration V9
LAST-PROVEN: never
- **Do:** (server/console proof) call `get_business_tax_rate(:bid)` as a user who is NOT an active member of that business (V9), or observe that a public/anon checkout does not receive the rate.
- **PASS:** returns NULL — the narrow read is membership-gated, not a blanket grant.
- **FAIL:** a non-member reads the rate.
- **Why:** the narrow read must be exactly as scoped as the wall it replaces for members — no wider.

### 7. A MANAGER can reach `/customers` and see the roster
STATUS: owed
DEVICE: desktop
COVERS: gap #5 (route `owner-only` → `view_customers`), STD-020
LAST-PROVEN: never
SIGNAL: no `[TRACE:PERMGATE] route entry refused` for `/customers` when the manager holds `view_customers`
- **Do:** as the MANAGER (holds `view_customers`), navigate to `/customers` (nav or typed URL).
- **PASS:** the page opens and the customer roster renders.
- **FAIL:** redirect to `/dashboard` (the old literal `owner-only` gate refusing everyone) — check the console shows NO refusal when the manager holds the permission.
- **Why:** the route was gated on an unholdable literal while the table already granted the read.

### 8. (NEGATIVE) A STAFF member without `view_customers` cannot reach `/customers`
STATUS: owed
DEVICE: desktop
COVERS: STD-020 default-deny at the route + table; migration V-customers (20260710 E)
LAST-PROVEN: never
SIGNAL: `[TRACE:PERMGATE] route entry refused { cap:'view_customers' }`
- **Do:** sign in as a STAFF member without `view_customers`. Attempt `/customers` by typed URL.
- **PASS:** refused at route entry (redirect to `/dashboard`); even if reached, `customers_member` RLS returns zero rows.
- **FAIL:** the roster renders.
- **Why:** route and table now agree — a member lacking the permission is denied at both.

### 9. The MANAGER role card's pill count equals the number of lit pills
STATUS: owed
DEVICE: desktop
COVERS: gap #6 (pill count), STD-020, the two dead pills
LAST-PROVEN: never
- **Do:** as the OWNER, /team → Roles → MANAGER card.
- **PASS:** the "N permissions" number equals the count of pills actually rendered and lit. No pill reads as grantable-but-dead: `manage_customers` and `view_reports` do NOT appear; `apply_discount`/`override_maintenance` still do not appear.
- **FAIL:** "12 permissions" over 11 lit pills, or a `manage_customers`/`view_reports` chip is present.
- **Why:** the count included a hidden entry (`override_maintenance`, retained in the array); a hidden permission gates nothing renderable, so it is not counted (and not stripped — that would be a silent revocation).

### 10. 🔴 (NEGATIVE) The PRICING RECIPE is still walled from a manager
STATUS: owed
DEVICE: desktop
COVERS: gap #4 the whole justification, STD-020, migration V8; owner-test the moat
LAST-PROVEN: never
- **Do:** as the MANAGER (who can now read the tax rate), attempt to reach any cost/margin/markup surface: `/costs` (route `owner-only`) and confirm `business_pricing_config` returns no recipe rows (V8).
- **PASS:** `/costs` refuses at route entry; the manager reads the tax RATE but NOT margin, markup, or cost basis. The narrow read did not crack the wall.
- **FAIL:** the manager can see any pricing-recipe value (cost basis / markup / margin floor).
- **Why:** this is the entire reason gap #4 is a narrow function and not a `view_pricing_config` grant — the tax number is readable, the recipe is not.

---

## PROVEN COUNT

**0 / 10 covered** (all `owed`, `LAST-PROVEN: never`) as of 2026-07-24 — BUILDER-COMPLETE, migration
GATED, owner-prove OWED. Thunder writes the cards and sets `owed`; only David's live run flips a card
to `covered` (OP-14).
