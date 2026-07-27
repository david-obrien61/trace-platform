# resource:action RBAC — FULL-SURFACE OWNER TEST

> **Rendered board:** open `owner-tests.html` (a PURE renderer — it parses this file live and holds
> no data of its own). Sibling of `stories.html` / `status.html`.
>
> **This file is the ONLY source of truth for the resource:action permission model's owner-tests.**
> It is STANDING, not dated — **run the cards in scope after any phase of the RBAC refit lands.** A
> per-build proof is a FILTER on this board (`COVERS: #NNN`), never a second doc (OP-14 clause 4).

**Purpose:** prove that a permission means one capability, that every layer checks the same string,
and that the model's three structural rules hold — including the one place a rule deliberately does
NOT apply (create never requires read, R1).

**Why this board is a REBUILD and not an edit** (spec §9): the old cards were written against the
coarse model where `view_costs` meant FOR ALL. The string mapping changed enough that editing them
would carry a stale assumption forward, so they are RETIRED, RE-WRITTEN, or SURVIVE — per the
disposition in `docs/decisions/2026-07-26-rbac-build-plan.md` §6.

---

## BOARD ARITHMETIC — it must reconcile in both directions (OP-14)

| | |
|---|---|
| **Disposition of the 20 permission-relevant cards that existed on 2026-07-26** | 6 SURVIVE + 12 RE-WRITTEN + 2 RETIRED = **20** ✅ |
| **Resulting board** | (20 − 2 retired) = 18 carried + 24 NEW = **42** ✅ |
| **On THIS file** | 12 re-written + 24 new = **36** |
| **On `team-permissions-full-surface-test.md`** | the **6 SURVIVORS** (cards 1, 2, 3, 4, 5, 7 — they test the FUNNEL and the audit row, which this refit does not change). They stay where they are, unchanged, and they count toward the 42. |
| **PROVEN COUNT ON DAY ONE** | **0 of 42.** |

> **The 0-of-42 is NOT a regression, and the record should not later read as one.** Measured on
> 2026-07-26 before this rebuild: of the 20 permission-relevant cards, **zero were `covered`** — 19
> were `owed` and one (inventory 18) was `failed` (the #151 defect this program exists to fix). No
> proven count is being destroyed by the rebuild, because there was none. Every card here ships
> `owed`; **Thunder never sets `covered` — only David's live run does** (OP-14).

**RETIRED — 2 cards, and why:**
- `team-permissions` **6** ("the two fake pills no longer render") — the retired set changes shape
  entirely (`view_dashboard` and `view_reports` retire; `manage_orders` is **kept**, corrected).
  Replaced by **N-3**, which asserts the stronger claim.
- `manager-visibility` **9** ("pill count == lit pills") — the Roles page will be re-rendered FROM
  the manifest, so the assertion is replaced by **N-4**.
- ✅ **`manager-visibility` 2 is NOT retired.** Under R1 the create-without-read split survives, so
  the negative card that proves it survives with it — re-written here as **R-2**.

---

## HOW TO READ A CARD

| Tag | Means |
|---|---|
| `STATUS: covered` | 🟢 A test exists AND it passed on `LAST-PROVEN`. Only David sets this. |
| `STATUS: owed` | 🟡 A test is written but has not been run since the surface changed. **Not proven.** |
| `STATUS: needs-test` | 🔴 The surface EXISTS and has NO runnable test — a known hole, recorded with its reason. |
| `PHASE:` | The phase that makes this card runnable. A card cannot pass before its phase lands. |
| `SETUP:` | State this tenant must be put into FIRST. A card with a `SETUP` block asserts a **capability of the platform**, not the current configuration of LAWNS. |
| `DEVICE:` | `phone` · `desktop` · `either`. A `phone` card must be provable WITHOUT a console. |
| `COVERS:` | The ruling / ledger row / defect this check defends. |
| `SIGNAL:` | The `[TRACE:*]` line. **Always secondary** — every PASS must be visible without one. |

---

## ⛔ GATE 0 — CONFIRM YOU ARE TESTING THE DEPLOYED CODE (OP-15 — owner-prove STEP ZERO)

> **STEP ZERO. Before you read any screen as evidence.** A failed Vercel build is SILENT — it keeps
> serving the last-good bundle — and **Vercel deploys the TREE, not the COMMIT**, so a doc push can
> carry unshipped code live and a code push can fail to ship. If the SHA under test is not live,
> every observation below is fiction (#60: `313de44` sat dead ~20h).

- [ ] **① SHA is live** — the footer stamp matches `git log -1 --format=%h` for the commit you are testing.
- [ ] **② The GATED migration for the phase under test is APPLIED and its DAVID-QUERY verifies are green.**
      Phase 0 = `20260726_permission_alias_layer.sql`, verifies **V1–V8**. **V4 (the alias round-trip,
      both directions) and V8 (no inventory-grid regression) are the phase's exit gate** — if either
      is not green, nothing on this board can be read as evidence.
- [ ] **③ You know which PHASE you are proving.** Cards name the phase that makes them runnable. A
      card whose phase has not landed is not a FAIL — it is not yet runnable. Do not mark it either way.

---

# PART A — RE-WRITTEN (12) — the behavior survives, the string changed, `LAST-PROVEN` resets

### R-1 — A MANAGER sees the orders they took
STATUS: owed
PHASE: 1
DEVICE: desktop
COVERS: mgr-vis 1 · `orders:read` (was `view_orders`) · the open-at-the-door-locked-at-the-vault defect
LAST-PROVEN: never
SIGNAL: `[TRACE:ROSTER] list { count }`
- **Do:** sign in as the MANAGER → `/orders`.
- **PASS:** the order roster lists real orders (e.g. CLV-20260723-3077) and the roster count is **non-zero**.
- **FAIL:** "No orders yet" on a tenant that has orders — the route admitted you and the table filtered every row.
- **Why:** the manager could TAKE an order and then read "No orders yet". Open at the door, locked at the vault.

### R-2 — 🔴 (NEG) A STAFF member TAKES an order and still sees NOTHING on `/orders`
STATUS: owed
PHASE: 1
DEVICE: either
COVERS: mgr-vis 2 · **Note A, made PERMANENT under R1** · `orders:create` without `orders:read`
LAST-PROVEN: never
SIGNAL: `[TRACE:PERM] active business permissions { effectivePermissions }`
- 🔴 **SETUP (REQUIRED — read this first):** **the live STAFF member currently HOLDS `view_orders`, so
  the tenant is NOT in the configuration this card describes.** Before running: as the OWNER, revoke
  `orders:read` (`view_orders`) from the test STAFF member through `/team` → Roles, and confirm the save.
  **This card asserts a capability of the PLATFORM — that the split is expressible and enforced — not
  a claim about how LAWNS is configured today.** Restore the grant afterward if you want it back.
- **Do:** as that STAFF member, run a QR checkout end-to-end, then open `/orders`.
- **PASS:** the order **is created and lands**, AND `/orders` renders **empty**. Create-authority ≠ read-authority.
- **FAIL:** either the checkout is refused (Rule 1 over-reached — see N-1b), or the order history is browsable.
- **Why:** a seasonal hire takes an order at the tag and must not browse customer names, totals and discounts.

### R-3 — The committed count a MANAGER sees matches the owner's
STATUS: owed
PHASE: 1
DEVICE: desktop
COVERS: mgr-vis 3 · `order_items:read` (was `view_orders`)
LAST-PROVEN: never
SIGNAL: `[TRACE:INVENTORY] committed { lotId, committed }`
- **Do:** as the MANAGER, open a lot with committed stock (the 132-unit case).
- **PASS:** the units read **COMMITTED**, not AVAILABLE, and the number equals what the owner sees.
- **FAIL:** committed units read as available — `order_items` filtered every row, so nothing looked committed.
- **Why:** a manager who cannot read `order_items` oversells stock that is already spoken for.

### R-4 — A MANAGER sees add-ons, picks transport, and sets a delivery date
STATUS: owed
PHASE: 1
DEVICE: either
COVERS: mgr-vis 4 · `service_offerings:read` · the netting/Regina path
LAST-PROVEN: never
- **Do:** as the MANAGER, run a checkout to the add-ons step.
- **PASS:** the add-on menu renders (netting, transport, delivery), a transport mode is selectable, and a delivery date saves.
- **FAIL:** an empty add-on menu — the sell-side catalog was filtered.
- **Why:** the catalog is printed to the customer and carries no cost column; every active member needs it to run checkout.

### R-5 — A MANAGER's order applies tax at the tenant's real rate
STATUS: owed
PHASE: 1
DEVICE: either
COVERS: mgr-vis 5 · `tax_rate:read` · the untaxed $544 invoice
LAST-PROVEN: never
- **Do:** **READ THE RATE FIRST** — `SELECT config->>'taxRate' FROM business_pricing_config WHERE business_id = :bid;` — then, as the MANAGER, take an order to Cart Review and check the tax against THAT number.
- **PASS:** tax is computed at the rate you just read, and appears on the total.
- **FAIL:** tax reads $0.00 · the copy says "set your tax rate in Settings" when it IS set · **or the rate applied is not the one in `config`**.
- **Why:** a $544 invoice went out UNTAXED because the rate shared the pricing-recipe wall.
- **🔴 DO NOT ASSERT A LITERAL RATE (corrected 2026-07-27).** This card said **8.25% at LAWNS**. The tenant's actual value is **0.076** — David changed it during testing, and **#153's catalog verification is stale on that number**. A hardcoded rate tests the DOC, not the SYSTEM: it would fail a correct system or pass a broken one depending on which way the drift ran.

### R-5b — 🔴 The invoice number and URL appear on the confirmation screen, FROM THE SUBMIT RESPONSE
STATUS: owed
PHASE: 1
DEVICE: either
COVERS: the CHANGED checkout mechanism (ledger #157) · US-008 · D-48's three states
LAST-PROVEN: never
- **Do:** take ONE order all the way through to the confirmation screen — as the MANAGER, and again as an ANONYMOUS QR checkout (`/checkout/*` are public routes; sign out to prove it).
- **PASS:** the QuickBooks invoice NUMBER and LINK are on the confirmation screen, both paths. In the network tab there is **ONE** request — `/api/orders/submit` — carrying `qbInvoiceId`/`qbInvoiceNumber`/`qbInvoiceUrl`/`qbStatus` in its response.
- **FAIL:** a SECOND request to `/api/qbo/invoice/cultivar` (the old two-hop shape is still deployed) · the invoice fields are absent · the anon path shows no invoice.
- **Why:** **this is a DIFFERENT MECHANISM than it was on 2026-07-26 and it is the demo spine**, so it gets its own line rather than being assumed inside "a manager takes a taxed order end-to-end". The browser used to make a second call to an endpoint with NO caller check that took `business_id` from the body — the last of the eight (ledger #157). It was closed by DELETING THE HOP: `submit.ts` already held the order, the business and the service key, so it pushes inline and returns the result.

### R-5c — 🔴 (NEG) A FAILED push renders honestly and the order is WHOLE
STATUS: owed
PHASE: 1
DEVICE: either
COVERS: §6 r6 (integration failure never blocks an order) · D-48's three states · the recovery path
LAST-PROVEN: never
- **Do:** force a failure — easiest is to disconnect QuickBooks in Settings, then take an order to confirmation.
- **PASS:** the order EXISTS, complete, with its own number and total. The QuickBooks line reads honestly — `not_connected` gives the connect prompt, a real failure says so — and **never a fabricated or pending invoice number**. The order appears on `/orders` in full.
- **FAIL:** the order is missing or partial · the screen claims an invoice that does not exist · a hard failure renders as "will sync shortly".
- **Why:** the order writes COMMIT BEFORE the push begins — there is no wrapping transaction — so even a KILLED invocation leaves a whole order with `qbStatus: 'failed'`. **Ordering is the defence, not `try/catch`: a catch never runs on a killed invocation.** That state is exactly what the gated manual re-push endpoint repairs, which is why it was kept rather than deleted.

### N-5 — 🔴 Granting a CONFIDENTIAL permission shows the SPECIFIC exposure, not a bland confirm
STATUS: owed
PHASE: 1
DEVICE: desktop
COVERS: spec §4 · capP P20 · CONFIDENTIAL_EXPOSURE
LAST-PROVEN: never
- **Do:** on `/team → Roles`, tick **Costs Read** for MANAGER and press Save. Read the confirm before accepting. Then repeat with **Orders Read**, an operational permission.
- **PASS:** the confidential save names WHAT IS BEING HANDED OVER — "the COST BASIS — what each item actually cost you…" — plus that it is an owner decision and reversible. The operational save shows the ordinary blast-radius confirm with **no** ⚠️ CONFIDENTIAL block.
- **FAIL:** both look the same · the warning is generic ("this is sensitive") · the block appears on an operational grant · **or it fires again when re-saving a role that ALREADY held the string** (that is not a new grant, and a warning that nags gets clicked through).
- **Why:** eleven confidential permissions showed the same bland confirm as a dashboard toggle, on the exact screen the owner uses to hand a manager the cost basis. §4 says a confidential read is an owner GRANT that shows the hard warning; the warning did not exist.
- **Note:** the copy is DATA (`CONFIDENTIAL_EXPOSURE`, from the manifest), so a twelfth confidential permission inherits this with no UI edit — and capQ (e) fails the build if one ships without its exposure line.

### R-6 — 🔴 (NEG) A non-member gets NO rate from the narrow read
STATUS: owed
PHASE: 1
DEVICE: desktop
COVERS: mgr-vis 6 · `tax_rate:read` · the narrow SECURITY DEFINER read
LAST-PROVEN: never
- **Do:** call `get_business_tax_rate` as a signed-in user who is NOT a member of that business.
- **PASS:** NULL. No rate, no error leaking the config.
- **FAIL:** a rate comes back — the narrow read is not membership-checked.

### R-7 — A MANAGER reaches `/customers` and sees the roster
STATUS: owed
PHASE: 2
DEVICE: desktop
COVERS: mgr-vis 7 · `customers:read` (was `view_customers`) · the locked-at-the-door-vault-open defect
LAST-PROVEN: never
- **Do:** as the MANAGER, open `/customers`.
- **PASS:** the route admits and the roster lists customers.
- **FAIL:** blocked at the route over a table that already grants the read.

### R-8 — 🔴 (NEG) A member WITHOUT `customers:read` cannot reach `/customers`
STATUS: owed
PHASE: 2
DEVICE: desktop
COVERS: mgr-vis 8 · `customers:read`
LAST-PROVEN: never
- **SETUP:** revoke `customers:read` from a test member through `/team` first.
- **PASS:** the route refuses AND, if reached by URL, the roster is empty (both layers hold).
- **FAIL:** either layer admits.

### R-9 — 🔴 (NEG) The pricing RECIPE is still walled from a manager
STATUS: owed
PHASE: 3
DEVICE: desktop
COVERS: mgr-vis 10 · `pricing_recipe:read` · D-009, the moat
LAST-PROVEN: never
- 🔴 **SETUP (REQUIRED):** **the live MANAGER currently HOLDS `view_pricing_config`.** This card
  asserts **the wall holds when the string is ABSENT** — it does NOT assert that this manager is
  currently walled, and running it as-configured would FAIL for the wrong reason. Revoke
  `pricing_recipe:read` from the test manager first.
- **Do:** as that manager, attempt to read baseline margin / reference price / markup — through the UI and by querying `business_pricing_config` directly.
- **PASS:** neither path returns the recipe.
- **FAIL:** the recipe is readable — the confidential wall is cosmetic.

### R-10 — A MANAGER without `inventory:import_price` imports QUANTITIES
STATUS: owed
PHASE: 3a
DEVICE: desktop
COVERS: inventory 16 · `inventory:import_price` (was `import_pricing`)
LAST-PROVEN: never
- **PASS:** quantities land; the price columns are shown as **won't-be-written**, honestly, before the import runs.
- **FAIL:** the whole import is refused (a manager must still be able to import counts), or prices land silently.

### R-11 — 🔴 That manager's price write is refused BY THE SERVER
STATUS: owed
PHASE: 3a
DEVICE: desktop
COVERS: inventory 17 · `inventory:import_price` · "a client-side check alone is render-only"
LAST-PROVEN: never
- **Do:** have the client send price columns anyway (tamper the request).
- **PASS:** the SERVER refuses the price write and says so; quantities still land.
- **FAIL:** prices land — the gate was client-side only.

### R-12 — The owner grants it on `/team` and the same file's prices land
STATUS: owed
PHASE: 3a
DEVICE: desktop
COVERS: inventory 18 (**`failed` on 2026-07-23 — the #151 defect**) · the funnel reaching a gate
LAST-PROVEN: never
- **Do:** OWNER grants `inventory:import_price` to the MANAGER on `/team`; the manager re-runs the identical file.
- **PASS:** the prices land this time.
- **FAIL:** the Roles tab shows the grant and the server still refuses — the template moved and the member row did not.

---

# PART B — NEW (24) — one per structural rule, per confidential grant, per unmintable verb

### N-1 — 🔴 A role holding `orders:update` WITHOUT `orders:read` FAILS THE BUILD
STATUS: owed
PHASE: 0 (verifier) / 1 (live)
DEVICE: desktop
COVERS: Rule 1 — **MODIFY**-requires-read
LAST-PROVEN: never
- **Do:** add `orders:update` to a role definition without `orders:read`; run `npm run verify`.
- **PASS:** the build FAILS and **names the missing string** (`orders:read`).
- **FAIL:** the build passes — an incoherent state (change what you cannot see) is expressible again.
- **Why:** this is the order-visibility bug in its general form.

### N-1b — 🔴 THE INVERSE — `orders:create` WITHOUT `orders:read` BUILDS FINE
STATUS: owed
PHASE: 0
DEVICE: desktop
COVERS: R1 option (c) — **the rule must not over-reach**
LAST-PROVEN: never
- **Do:** define a role with `orders:create` and no `orders:read`; run `npm run verify`.
- **PASS:** **no error and no warning-as-error.** The build is clean.
- **FAIL:** any failure — Rule 1 has over-reached and just retired Note A by accident.
- **Why:** a create acts on nothing; and Postgres already couples update/delete to read via `USING`, while `INSERT` needs only `WITH CHECK`.

### N-1c — A create-without-read grant is SURFACED as a deliberate choice
STATUS: owed
PHASE: 4 (Roles page renders from the manifest)
DEVICE: desktop
COVERS: R1 UI requirement · Surface Honesty applied to the grant itself
LAST-PROVEN: never
- **Do:** on `/team` → Roles, grant STAFF `orders:create` without `orders:read`.
- **PASS:** the role card shows an inline note naming the state — *"takes orders, cannot browse them"*.
- **FAIL:** the asymmetry is silent.
- **Why:** an intentional asymmetry that looks like a mistake will eventually be "fixed" by someone who doesn't know it was on purpose.

### N-2 — 🔴 A role holding `margin:read` WITHOUT `costs:read` FAILS THE BUILD
STATUS: owed
PHASE: 0
DEVICE: desktop
COVERS: Rule 2 — read-the-judgment requires read-the-basis
LAST-PROVEN: never
- **PASS:** the build fails naming `costs:read`.
- **Why:** showing a manager a red tag with the basis redacted makes them a sensor, not a manager.

### N-2b — 🔴 `deliveries.route:update` WITHOUT `deliveries:read` FAILS THE BUILD
STATUS: owed
PHASE: 0
DEVICE: desktop
COVERS: Rule 3 — a sub-resource inherits its parent's read
LAST-PROVEN: never
- **PASS:** the build fails naming `deliveries:read`.
- **Why:** a route is a view onto deliveries — no deliveries, no route.

### N-3 — Only manifest-`enforced` strings render as pills
STATUS: owed
PHASE: 0
DEVICE: desktop
COVERS: spec §7.1 · **replaces retired `team-permissions` card 6**
LAST-PROVEN: never
- **Do:** open `/team` → Roles and compare the rendered pills against the manifest.
- **PASS:** no `declared-unwired` string renders (`maintenance:override`, `order_discount:apply`, `manage_customers`, `view_reports`); `derived` is handled per §7.1; every rendered pill reaches a real gate.
- **FAIL:** a pill that gates nothing is grantable — the fake-pill state, back again.

### N-4 — The Roles page renders FROM the manifest
STATUS: owed
PHASE: 4
DEVICE: desktop
COVERS: spec §7 end-state · **replaces retired `manager-visibility` card 9**
LAST-PROVEN: never
- **Do:** add a string to `permissionManifest.ts` with `status: 'enforced'`; deploy; open `/team`.
- **PASS:** it appears as a pill **with no UI edit**.
- **FAIL:** a second list has to be edited — the drift this program exists to end.

### N-5 — 🔴 Granting a CONFIDENTIAL permission shows the hard, specific warning
STATUS: owed
PHASE: 4
DEVICE: desktop
COVERS: spec §4 · the live defect where `view_pricing_config` was offered as an ordinary pill
LAST-PROVEN: never
- **Do:** grant `costs:read` (or `wages:read`, `margin:read`, `pricing_recipe:read`) to a member.
- **PASS:** a hard, specific warning names what is exposed — *"this exposes your cost data to this person"* — not the generic confirm.
- **FAIL:** the same bland dialog as any other pill.
- **NOTE:** capP flags this today as an EXTRA finding — `MemberConsole.tsx` has no sensitivity-aware branch at all.

### N-6 — 🔴 THE INVENTORY READ SPLIT — sell price yes, unit cost no
STATUS: owed
PHASE: 3b
DEVICE: desktop
COVERS: spec §4 · the field-level split
LAST-PROVEN: never
- **Do:** as a manager with `inventory:read` but NOT `costs:read`, open the inventory grid.
- **PASS:** name, sku, size, qty and **sell price** render; **unit cost does not**.
- **FAIL:** unit cost is visible.

### N-7 — 🔴 …AND cannot be reached by querying the table directly
STATUS: owed
PHASE: 3b
DEVICE: desktop
COVERS: §5 — **the base-table narrowing. Without this, N-6 is cosmetic.**
LAST-PROVEN: never
- **Do:** as that same manager, `select unit_cost from business_inventory` with one supabase-js call.
- **PASS:** no `unit_cost` comes back.
- **FAIL:** it does — the split is decoration, because RLS is row-level and the base table still grants `SELECT *`.
- **Why:** **N-7 alone is the real gate.** N-6 without N-7 proves nothing.

### N-8 — A READ-ONLY INVENTORY VIEWER — the capability that did not exist
STATUS: owed
PHASE: 3a
DEVICE: desktop
COVERS: the point of the whole split (`view_costs` was FOR ALL — read and write could not be separated)
LAST-PROVEN: never
- **Do:** grant a member `inventory:read` and NOT `inventory:update` / `inventory:delete`.
- **PASS:** the grid opens; **no cell edits and no lot deletes** — refused at the SERVER, not merely hidden.
- **FAIL:** they can edit — the verbs are still fused.

### N-9 — 🔴 N5, THE CUSTOMER WRITE — a manager fixes a typo and it saves
STATUS: owed
PHASE: 2
DEVICE: desktop
COVERS: David's open ruling #1 · Lauren's actual job at LAWNS
LAST-PROVEN: never
- **Do:** as a manager holding `customers:update`, correct a customer's name; save. Then revoke it and retry.
- **PASS:** with the string it SAVES; without it the surface is read-only and the server refuses.
- **FAIL:** either direction — a granted write that doesn't land, or a revoked write that does.

### N-10 — 🔴 `tax_rate:update` SAVES, and the recipe is unchanged after
STATUS: owed
PHASE: 1
DEVICE: desktop
COVERS: §5 · demo-critical · the narrow writer `set_business_tax_rate`
LAST-PROVEN: never
- **Do:** as a holder of `tax_rate:update`, change the rate in Settings; save. Then read the pricing recipe.
- **PASS:** the rate persists and takes effect on the next order, AND `baselineMargin` / `referencePrice` / `markup` / `discountTypes` are **byte-identical** to before.
- **FAIL:** the write touches any recipe key — a narrow writer that isn't narrow.

### N-11 — 🔴 `order_discount:apply` gates the override AND writes an audit row
STATUS: owed
PHASE: 5
DEVICE: desktop
COVERS: §7 · R8 · the missing governance-log row
LAST-PROVEN: never
- **PASS:** the price override is gated on `order_discount:apply` (not `manage_orders`), AND an `audit_log` row lands naming the actor, the order, the baseline, the override and the leakage.
- **FAIL:** the override works but nothing reaches the governance log — visible on the order, invisible in the audit.

### N-11b — A STAFF member without it takes the order at the BASELINE price
STATUS: owed
PHASE: 5
DEVICE: either
COVERS: R8 — proves the dependency is `orders:create`, the verb the path actually exercises
LAST-PROVEN: never
- **Do:** as STAFF with `orders:create` but WITHOUT `order_discount:apply`, submit an order carrying a tier/override.
- **PASS:** the override is IGNORED, the baseline price is charged, and the tamper-defence trace fires.
- **FAIL:** the discount applies — the gate is client-side.
- **Why:** refusal must cost the customer MORE, never give money away unrecorded (STD-013).

### N-12 — `maintenance:override` gates its feature and writes an audit row
STATUS: needs-test
PHASE: — (blocked)
DEVICE: desktop
COVERS: R6 — **an honest hole, recorded rather than omitted (OP-14 clause 2)**
LAST-PROVEN: never
- 🔴 **REASON THIS IS `needs-test` AND NOT `owed`:** **nothing in the app blocks on an overdue PMI,
  so there is no feature to override.** `getPMIStatus` computes overdue / due-soon / ok and no
  consumer refuses anything on it. An override permission with nothing to override is not a
  permission — it is a name. **This card becomes writable when the PMI block is built**, which is a
  feature build (block → reason-required override path → audit row), not RBAC wiring.
- **Not a FAIL. Not a pass. A recorded hole**, rendered RED on the board so it cannot be mistaken for coverage.

### N-12b — 🔴 THE UNMINTABLE DELETES EXIST NOWHERE
STATUS: owed
PHASE: 0
DEVICE: desktop
COVERS: R2 + **A3** · verifier assertion 5
LAST-PROVEN: never
- **Do:** search for `customers:delete` — as a pill on `/team`, as a policy in the catalog, as a string any gate accepts. Repeat for `service_offerings:delete`, `deliveries:delete`, `campaigns:delete` and **`assets:delete`**.
- **PASS:** **all five are unfindable.** Not offered, not enforced, not accepted.
- **FAIL:** any one of them exists — a destructive verb the data layer cannot honor.
- **Why:** all five tables were tombstone-checked on 2026-07-26 and none has one. **`customers`,
  `deliveries` and `campaigns` DO each have a `status` column — and a column is not a tombstone.**
  Their `status` carries LIFECYCLE meaning (pending/delivered, draft/ended). A tombstone is column +
  writer RPC + ledger row + audit row + read filters. A future delete build adds a SEPARATE column;
  overloading lifecycle would be one column carrying two facts.

### N-12c — `inventory:delete` DOES exist, and it TOMBSTONES
STATUS: owed
PHASE: 3a
DEVICE: desktop
COVERS: R2 / D-52 — **the contrast that makes N-12b meaningful**
LAST-PROVEN: never
- **Do:** delete a lot as a holder of `inventory:delete`.
- **PASS:** the lot SURVIVES at `status='deleted'` with qty 0, **and both a ledger row and an audit row land**.
- **FAIL:** the row is gone, or either record is missing.

### N-13 — 🔴 THE ALIAS PROOF, BOTH DIRECTIONS
STATUS: owed
PHASE: 0
DEVICE: desktop
COVERS: §8 · **the Phase 0 exit gate**
LAST-PROVEN: never
- **Do:** run DAVID-QUERY **V4a and V4b** in `20260726_permission_alias_layer.sql`.
- **PASS:** a member holding ONLY `view_costs` passes `has_permission('inventory:read')` (forward), AND a member holding ONLY `inventory:read` passes `has_permission('view_costs')` (reverse).
- **FAIL:** either direction returns false — the migration is no longer order-independent and phases cannot be run out of sequence.
- ⚠️ **V4b's grant must be rolled back.** The backfill is Phase 6.

### N-14 — CONTRACT — zero legacy strings, and disagreement fails the build
STATUS: owed
PHASE: 7
DEVICE: desktop
COVERS: the irreversible step · capP WARN → FAIL
LAST-PROVEN: never
- **PASS:** no member holds a legacy string, no gate references one, capP is in FAIL mode and the build is green.
- ⚠️ **The zero-check runs against the CENSUS of strings members ACTUALLY hold (R-C), not against
  build-plan §2's list — §2 missed `process_orders` and `manage_team`.**
- ⚠️ **And it cannot stay green while `SignUp.tsx:34` / `AddBusiness.tsx:23` still MINT legacy strings.**

### N-15 — No surface implies a margin WRITE
STATUS: owed
PHASE: 4
DEVICE: desktop
COVERS: spec §4.1
LAST-PROVEN: never
- **Do:** as a holder of `margin:read` + `costs:read`, find an underpriced item and try to fix it.
- **PASS:** the "fix this price" affordance routes to the **recipe**, and **no `margin:update` pill exists anywhere** on the Roles page.
- **FAIL:** anything implies a margin write verb.
- **Why:** margin is computed, not stored. You do not edit a verdict; you edit the recipe and the signal recomputes.

### N-16 — The flag-but-can't-fix state is real and deliberate
STATUS: owed
PHASE: 4
DEVICE: desktop
COVERS: spec §4.1
LAST-PROVEN: never
- **Do:** grant `margin:read` + `costs:read` and NOT `pricing_recipe:update`.
- **PASS:** they SEE which items are underpriced and **cannot change them**.
- **FAIL:** either they can't see, or they can change — a legitimate reviewer role is inexpressible.

### N-17 — `assets` and `pmi` are reachable on their OWN strings
STATUS: owed
PHASE: 4
DEVICE: desktop
COVERS: R4 · closes disagreement N4
LAST-PROVEN: never
- **Do:** grant `assets:read` / `pmi:read` and NOT `costs:read`; open `/assets` and `/pmi`.
- **PASS:** both surfaces open. Trucks and service schedules are operational, not financial secrets.
- **FAIL:** the route still demands a cost permission — over-tightened, which is N4.

### N-18 — `view_dashboard` is gone and nothing broke
STATUS: owed
PHASE: 6
DEVICE: desktop
COVERS: R3
LAST-PROVEN: never
- **Do:** after the backfill strips it, sign in as each role.
- **PASS:** every tile and IA node that keyed on `view_dashboard` renders for any active member.
- **FAIL:** a surface disappears — it was load-bearing after all, and folding it into `is_active_member` was wrong.

---

## THE SIX SURVIVORS — on `team-permissions-full-surface-test.md`, unchanged

They test the FUNNEL and the audit row, which this refit does not change. They are **not copied
here** — a card in two places is two cards that will disagree (STD-011).

| Card | What it proves |
|---|---|
| team-permissions **1** | a grant on `/team` reaches the MEMBER ROW and the manager's next action succeeds |
| team-permissions **2** | every grant/revoke writes an audit row |
| team-permissions **3** | a removal NAMES who loses what, before the write |
| team-permissions **4** | the owner row renders every-pill-lit-and-locked |
| team-permissions **5** | the count on screen == the member array after a save |
| team-permissions **7** | self-elevation is refused and audited |

**6 survivors + 36 cards here = 42.**

---

*Standing board. Created 2026-07-26 (Phase 0). Sources: `docs/resource-action-permission-spec.md`
(v3) · `docs/decisions/2026-07-26-rbac-build-plan.md` §6 · `docs/standards/permission-enforcement-map.md`
(STD-020). Thunder never marks a card `covered` — only David's live run does (OP-14).*
