# RECON — THE TILE ROUND TRIP: can a tile be turned off, and back on, with the data intact?

**Date:** 2026-08-23 (10) · **Type:** RECON — LOOK ONLY · **HEAD:** `90ff6a5` (clean, re-verified at write-up)
**Scope bar honoured:** no app code, no schema, no migration, no policy, no cap. ONE document.
`git diff --stat` clean · zero diff under `packages/` `api/` `supabase/`.
**Gate:** `npm run verify` exit 0, ZERO NET-NEW (tsc 5 / eslint 247 / knip 10 / 12 / 15) · api/ **12/12**.
**GATE 0:** NOT APPLICABLE — nothing ships.

---

## 🔴 FINDINGS OUTSIDE THE TWELVE — recorded UNFIXED, at the top per STEP 4

### 1. 🔴 THE STORY GATE FIRES **CONFLICT**, AND IT IS THE FIRST THING DAVID MUST RULE ON

`user_stories.md:1052` — **"Connector-management CONSOLE — full UI (SCOPED-OUT)"**, `STATUS: scoped-out`,
`MAPS-TO: —`. Its stated reason:

> *"The connector / gap-filler tile + integration-registry model is DECIDED (2026-05-23); `business_modules`
> is the partial impl and QBO-connect works — that's enough for the demo. A full connector-management
> console is **post-demo**, not a gap."*

David's requirement in this prompt — *select tiles, add to a business, have them display, deselect them and
have them disappear, then re-enable them* — **is that console.** The board says it is deliberately not being
built. Per §9's story-reconciliation gate this is **CONFLICT → STOP and surface**, not NO-MATCH → write a
story. Nobody may flip a `scoped-out` row to active except David.

### 2. 🔴 A SURFACE WAS BUILT WHILE THE BOARD SAID SCOPED-OUT — `IN CODE BUT NOT ON THE BOARD`

`packages/cultivar-os/src/pages/Subscription.tsx` (527 lines, shipped 2026-08-02) **is** a partial
connector-management console: four sections, per-module enablement, trial clocks, an authority gate. It has
no story, and the only board row that covers its subject says the thing is scoped out. Flagged, not fixed —
writing the story is David's dictation, not Thunder's.

### 3. ⚠️ THE VERTICAL FENCE IN `BusinessProvider` IS COMMENTED OUT

`packages/shared/src/context/BusinessProvider.tsx:440-448` and `:484-517` — `[TEMP — OPEN ACCESS]`, with the
`.eq('business_type', businessType)` filter and the `if (memberBiz.business_type !== businessType) continue;`
fence both commented out, citing audit #13. Named here because it is load-bearing for Q10: it is the reason a
rehome cannot strand David out of his own business list. **That is a good outcome produced by a control that
is currently switched off, which is luck rather than design.**

### 4. ⚠️ `business_type` HAS NO CHECK CONSTRAINT — the businesses recon's Q8, confirmed from the migration

`supabase/migrations/20260529_businesses_a_create_tables.sql:14` — `business_type text NOT NULL DEFAULT 'nursery'`.
No `CHECK`, no enum, no FK. A grep for `CHECK.*business_type` across every migration returns nothing.
The mitigation is downstream and it is real: `verticalsForBusinessType` (`tileRegistry.ts:614-617`) fails
**SAFE** to `['general']` on any unrecognised value, so a typo degrades to the shared spine rather than to a
blank grid.

---

## THE TWELVE

### THE ROUND TRIP

### Q1. 🔴 IS THERE AN OFF PATH AT ALL? — **NO. NOT ANYWHERE.**

**The server has an off switch. Nothing in the product calls it.** This is precisely the campaign-lifecycle
finding arriving on modules, as the prompt anticipated.

| Evidence | Where |
|---|---|
| The marketplace has exactly ONE mutation function, `enable(m)` | `Subscription.tsx:181` |
| It hardcodes the value | `Subscription.tsx:192-195` — `{ enabled: true, trialDays: m.trial_days }` |
| The **Active** section renders a Card with an icon, label, price and trial line — **and no button of any kind** | `Subscription.tsx:346-402` |
| Every other call site passes `true` or omits enablement | `api/social/enable.ts:50` (`enabled:true`) · `financialDataAccess.ts:244,251` (`configured` only) |
| **Total callers passing `enabled:false`, platform-wide** | **ZERO** |

⚠️ **And the server's own copy already describes the missing capability.** The refusal string at
`20260802c_enable_starts_the_clock.sql:127` reads *"subscription:update permission required — enabling **or
disabling** a module changes what this business pays."* The database is documenting a product feature that
does not exist.

### Q2. WHAT DOES DISABLE ACTUALLY DO? — **✅ IT FLIPS A FLAG. NOTHING ELSE. QUOTED IN FULL.**

`supabase/migrations/20260802c_enable_starts_the_clock.sql:133-140`:

```sql
IF v_existed THEN
  UPDATE public.business_modules
     SET enabled    = COALESCE(p_enabled,    enabled),
         configured = COALESCE(p_configured, configured),
         config     = COALESCE(config, '{}'::jsonb) || COALESCE(p_config_patch, '{}'::jsonb)
   WHERE business_id = p_business_id AND module_key = p_module_key;
```

With `p_enabled=false, p_configured=NULL, p_config_patch=NULL`:
- `enabled := false`
- `configured` — **unchanged** (`COALESCE(NULL, configured)`)
- `config := config || '{}'::jsonb` — **unchanged**, a merge with the empty object

**No `DELETE` exists anywhere in the function.** Its complete write set is three statements against two
tables: `business_modules` (UPDATE `:134`, INSERT `:141`) and `audit_log` (`:111`, `:123`, `:170`).
Corroborated independently by `write-paths-baseline.json:75-78`, which records `business_modules` as having
exactly two writer FILES — `moduleState.ts` and `seedBusinessModules.ts`.

**Authority is correct:** a disable IS an enablement change, so `v_touches_enablement` is true and `:121-129`
demands `subscription:update` — owner-only, and the denial is audited.

### Q3. 🔴 DOES THE TILE DISAPPEAR? — **NO. AND IT DOES NOT EVEN GO DIM.**

`packages/cultivar-os/src/hooks/useModules.ts:122-125`:

```ts
} else if (t.module_key) {
  const nm = nmByKey[t.module_key] ?? null;
  state = nm?.enabled && nm?.configured ? 'active' : 'available';
}
```

A disabled module falls to **`'available'`** — the *same* state as a module nobody ever turned on. Per the
six-state ruling, `absent` is the correct rendering for DOES NOT EXIST; this is neither absent nor honest.

What `available` looks like, from `packages/shared/src/components/tiles/Tile.tsx`:

| Property | `available` (disabled module) | `active` (enabled module) |
|---|---|---|
| Background | full colour `bg` (`:93`) | full colour `bg` |
| Greyscale / opacity | none / 1.0 (`:94-95`) | none / 1.0 |
| `role="button"`, `tabIndex=0` | **yes** (`:71-73`) | yes |
| Badge | **none** | green 11px dot (`:129-141`) |

`planned` gets an amber **SOON** badge (`:143-150`); `locked` gets a red lock (`:153-171`); **`available` gets
nothing at all.** So the entire visible consequence of turning a module off is **an 11-pixel green dot
disappearing.**

### Q4. 🔴 IS THE ROUTE STILL REACHABLE? — **YES, BY TWO DOORS, AND THE TILE ITSELF IS ONE OF THEM.**

**Door 1 — the tile.** `Dashboard.tsx:344-350`:

```ts
// Fires for both 'available' (onEnable) and 'active' (onNavigate) …
function openTile(tile: { key: string; label: string; route?: string }) {
  if (tile.route) return navigate(tile.route);
  return showComingSoon(tile.label);
}
```

`Tile.tsx:61-64` wires `isAvailable && onEnable` to the same handler as `isActive && onNavigate`, and
`openTile` does not distinguish them. **Tapping a disabled module's tile navigates straight into the feature.**

**Door 2 — the URL.** `packages/cultivar-os/src/router.tsx` declares **48 routes**, and a grep for
`business_modules|module_key|useModules|enabled` across it returns **ZERO**. `/delivery-schedule` is gated at
`router.tsx:149` on `deliveries:read` — a **permission**. Module enablement is not in the routing layer at all.

**So, naming the behaviour as asked: `/delivery-schedule` for a business with Delivery DISABLED renders
normally and works fully.** No redirect, no 404, no notice.

**Is that the right behaviour? No — and the platform already knows the right one.** The 2026-07-30 six-state
ruling says a surface a session cannot have **renders and says so**, and `SurfaceState.tsx` + `PermissionRoute`
already implement that shape for permissions. Enablement never got the same treatment. ⚠️ But this is not a
one-line fix: `router.tsx` has no access to the enablement overlay — `useModules` fetches it, the router does
not — so an honest route gate needs the row available at the routing layer. That is why it sits in COHERENT,
not MINIMUM.

### Q5. ✅ DOES THE DATA SURVIVE? — **YES, AND IT IS PROVEN STRUCTURALLY RATHER THAN BY ENUMERATION.**

The disable path is **one `UPDATE` against one table**. The RPC's entire write set is `business_modules` +
`audit_log` (Q2). It cannot touch a module's data because **it names no other table.** That is a stronger
proof than checking each table in turn, because it holds for tables nobody thought to list.

The tables are named anyway, so the claim is concrete:

| Module | Its data lives in |
|---|---|
| `delivery_routing` | `deliveries` (`DeliverySchedule.tsx:120,150`), `customers` (`:168`) |
| `social_media` | `social_drafts`, `campaigns`, `campaign_posts`, **and `business_modules.config` itself** |
| `cost_to_produce` | `cost_objects` (`Costs.tsx`), `business_pricing_config`, `labor_resource_wages` |
| `inventory_intake` | `business_inventory`, `cultivar_plants`, `inventory_counts`, `inventory_count_sessions`, `business_inventory_ledger` |
| `qr_checkout` | `orders`, `order_items` |
| `qb_invoicing` | `business_accounting_secrets` |
| `contractor_tiers` | `customers.price_tier`, `business_pricing_config` |

🔴 **ONE DESERVES A FLAG, AND IT IS THE ONE THE TABLE MAKES VISIBLE: `social_media`'s own configuration lives
INSIDE `business_modules.config` — the same jsonb column the disable path writes to.** `SocialSetup.tsx:61-66`
reads `config.advert_channels` and `config.cadence` from it, and the trial pair
`(trial_started_at, trial_days)` lives in the same object. It survives today only because `config || '{}'` is
a no-op. **A future disable that "cleans up" its config would destroy the channel selection and the trial
terms in one statement** — and the trial half is protected by a ruling (2026-08-01), so that would be a
ruling violation arriving through a tidy-up.

### Q6. ✅ DOES RE-ENABLE RESTORE IT INTACT? — **YES. IDEMPOTENCY DOES *NOT* MEAN "RESETS CONFIG".**

`20260801c_module_seed_and_trial_clock.sql:424-429` — the seeder is
`INSERT … ON CONFLICT (business_id, module_key) DO NOTHING`, and its own comment states the contract:

> *"`ON CONFLICT DO NOTHING` is what makes the whole thing re-runnable: an existing tenant's
> enabled/configured/config are **NEVER clobbered** by a re-seed."*

✅ **And the marketplace's own repair path was checked rather than assumed.** `Subscription.tsx:132` fires
seed-if-absent on `Object.keys(byKey).length < MODULE_CATALOG.length`. **A disabled module still HAS a row,
so a disable does not trip the repair.** Confirmed at the line.

🔴 **THIS IS ALSO THE TRAP THE BUILD MUST NOT WALK INTO, AND IT IS WHY THE FLAG SHAPE IS THE ONLY WORKABLE
ONE.** If disable were implemented as a **DELETE of the row** — the naive shape, and the one a "clean up after
yourself" instinct produces — then:

1. the row vanishes, taking `trial_started_at` with it;
2. the **next marketplace page load** sees `keys < MODULE_CATALOG.length` and re-seeds;
3. `start_module_trial` finds `v_before IS NULL` and starts a **FRESH 30-day clock**.

**Delete-as-disable is self-reversing AND re-clocking**, against a machine already shipped. The flag is not
merely tidier; it is the only shape compatible with the repair path that exists.

### Q7. 🔴 THE CLOCK — **NONE OF DAVID'S THREE OPTIONS. IT NEVER PAUSED.**

`20260801c_module_seed_and_trial_clock.sql:275-283`:

```sql
IF v_existed AND v_before IS NOT NULL THEN
  INSERT INTO public.audit_log (…) VALUES (…, 'restart_refused', true), 'no_change');
  RETURN QUERY SELECT true, NULL::text, v_before, v_before_days, true;   -- was_already_running
  RETURN;
END IF;
```

Disable does not clear `trial_started_at` (Q2), so on re-enable `v_before IS NOT NULL` and the clock reports
`was_already_running:true, restart_refused:true`. Against David's two stated requirements:

- *"must not lose the term"* — ✅ **satisfied.** The stored pair is untouched; `term_rewrite_refused` also
  guards the `trial_days` half.
- *"must not get a fresh one"* — ✅ **satisfied.** Restart is refused even for a caller holding
  `subscription:update`.

**But there is a third outcome nobody specified: the clock kept running the whole time it was off.**
`trialDaysRemaining` computes from `(trial_started_at, trial_days)` — wall-clock, with no notion of enabled
time. A module switched off for a month burns a month of its trial.

⚠️ **Genuinely arguable, which is why it is filed as a ruling and not a defect.** A trial is a window to
evaluate, and you were not evaluating while it was off — that argues for pausing. Against: pausing means the
pair is no longer the whole truth (you need accumulated-enabled-days, a third field), and the 2026-08-01
ruling says the terms are that pair and nothing else.

✅ **RECOMMENDATION — leave the mechanism, fix the SURFACE.** The Active card already renders *"N days left in
trial"*; the disabled card should read *"Turned off — its trial still ends [date]."* That is Surface Honesty
at the cost of one string, versus a schema change that reopens a settled ruling.

### THE EXTRA-TILES HALF

### Q8. 🔴 IS THE CATALOG VERTICAL-SCOPED? — **SPLIT: THE DASHBOARD YES, THE MARKETPLACE NO — AND THE MARKETPLACE STRUCTURALLY CANNOT BE.**

**Dashboard: scoped, and it works.** `useModules.ts:88-89` → `verticalsForBusinessType(businessType)` →
`dashboardTilesForVerticals()` (`tileRegistry.ts:645-647`), filtering `TILE_REGISTRY` on `tile.vertical`.

**Marketplace: not scoped, and could not be.** `Subscription.tsx:166` — `for (const m of MODULE_CATALOG)`,
with no vertical filter. 🔴 **`MODULE_CATALOG` (`tileRegistry.ts:384-400`) has NO `vertical` field at all.**
The vertical axis lives on `TILE_REGISTRY`; the marketplace reads `MODULE_CATALOG`. Two lists, one axis, and
it is on the other one. `allTiles()`'s own comment (`:631`) states it: *"role-config + marketplace read this —
ALL entries, all verticals."*

🔴 **THE PRACTICAL ANSWER, WHICH IS THE ONE THAT DECIDES DAVID'S PRINCIPLE — the vertical partition is
almost empty. Counted: 32 of 33 registry tiles are `vertical:'general'`.** The single exception is
`seasonal_module` (`tileRegistry.ts:239`), which is `status:'planned'` **and** `placement:'settings'` — and
per RULINGS #138/#139 `tilesForPlacement()` has **ZERO CALLERS**, so it draws nothing anywhere regardless.

**So: can a consulting business add Delivery? ✅ YES.** `delivery` is `vertical:'general'`
(`tileRegistry.ts:143`). **The guiding principle is implemented — but not because the vertical machinery is
doing work; because there is almost nothing for it to do.** Those are different situations, and the
difference surfaces the first time a genuinely vertical-specific tile ships.

### Q9. 🔴 WHAT DOES `general` ACTUALLY RENDER? — **THE SAME GRID AS `nursery`. EXACTLY THE SAME.**

`dashboardTiles()` (`tileRegistry.ts:640-642`) filters `placement === 'dashboard'` **before** the vertical
filter runs, and the only cultivar tile is `placement:'settings'`. Therefore
`dashboardTilesForVerticals(['general'])` and `dashboardTilesForVerticals(['general','cultivar'])` return
**identical sets**.

**Which of them read Cultivar-shaped data? ✅ Checked, and the answer is better than expected — almost none.**

- `Dashboard.tsx:174-182` — the **"Plants tracked"** metric reads **`business_inventory`**, a generic table.
- Sales/installs read `orders`; costs read `cost_objects`; receipts read `receipts`.
- The one genuinely cultivar-named table still on a `general` path is **`cultivar_plants`**, read by the
  inventory pages — an AC-1 leak already tracked on the §4 Noun Purge.

**So MASTER_BRIEF's claim — a general business "will work for Lauren's nursery with only vocabulary
differences" — is TRUE IN CODE**, with one qualifier that matters for Jon: **the vocabulary is hardcoded in
the registry LABELS** ("Plants tracked", "Orders", "Inventory Intake"), not read from a vertical config.
`VerticalConfig.ts` is still an unbuilt §4 item. It is true *and* the layer that would let a consultant see
his own words does not exist.

### Q10. THE REHOME — **BLAST RADIUS SMALLER THAN FEARED, AND FULLY REVERSIBLE.**

Setting `businesses.business_type` `'nursery'` → `'general'` on a tenant holding 907 plants and 129 inventory
rows:

| Layer | Effect |
|---|---|
| **Tiles** | 🟢 **ZERO CHANGE** — identical grid in both directions (Q9) |
| **Data** | 🟢 **ZERO** — every tenant table keys on `business_id`, never `business_type` |
| **RLS** | 🟢 **ZERO** — **no policy anywhere references `business_type`.** Every migration hit is a one-shot seed/backfill, all long applied: `20260529_businesses_c:25,31` · `20260529_businesses_f:97-131` · `20260611_delete_debris:21` · `20260614_cost_to_produce_trace_seed:75` |
| **Discounts chips** | 🟡 `Discounts.tsx:75` — `TYPE_SUGGESTIONS[business_type] ?? DEFAULT_PALETTE`. The **suggestion chips** change to the default palette. **Existing discount types are untouched** — this only seeds new-type suggestions |
| **Onboarding** | 🟡 `OnboardingWizard.tsx:478,516` — two `.eq('business_type','nursery')` queries, reachable only on the legacy onboarding path, not on any surface an existing tenant visits |

**REVERSIBLE? ✅ COMPLETELY.** One free-text column, no CHECK constraint (finding 4), nothing derived from
it, nothing cached, and `verticalsForBusinessType` fails safe. Set it back and the previous state returns
exactly.

⚠️ **One safety worth naming as luck rather than design:** the vertical fence in `BusinessProvider` is
commented out (finding 3), which is why a rehome cannot strand David out of his own business list.

### Q11. ✅ THE GROWTH LADDER ACROSS TYPES — **CLEAN. NO VERTICAL GATE ANYWHERE IN THE PATH.**

A grep for `business_type` across `packages/shared/src/inventory/` and
`packages/shared/src/business-logic/` returns **exactly one hit, and it is a comment** —
`taxExemption.ts:6`, saying the module is deliberately *"Generic across every business_type."*

`countPromote.ts` · `variantGroup.ts` · `sizeLabel.ts` · `inventoryEdit.ts` · `reconcileMath.ts` ·
`InventoryEditor.tsx` — all `business_id`-scoped, zero vertical gates.

**So David's own farm works on `general` today.** The only vertical residue in the growth path is **naming,
not gating**: the `cultivar_plants` table and the tile labels — both AC-1 leaks already on the Noun Purge.

### Q12. ✅ WHAT WOULD PROVE THE ROUND TRIP MECHANICALLY? — **BUILDABLE, AND IT IS AN ASSERTION ON A MAP WE ALREADY BUILD.**

`scripts/verify-write-paths.mjs` **already parses `CREATE FUNCTION` bodies and extracts their write targets**
into `RPCMAP`, proven by its own probes at `:424-447`:

- `M1` — CREATE FUNCTION body parsed, UPDATE target found
- `M4` — a body with INSERT + DELETE yields **BOTH** tables
- `M4b` — an UPDATE with a table alias is still a write
- `M4c` — `SELECT … FOR UPDATE` is a lock, not a write
- `M4d` — an UPDATE inside a string literal is not a write

It already reads `business_modules` into the baseline (`write-paths-baseline.json:75-78`).

**The cap is therefore a NEW ASSERTION, not a new script:**

> `RPCMAP.get('set_business_module_state').writes` must equal exactly `{business_modules, audit_log}`,
> and must contain **no DELETE target at all.**

It fails the day someone adds a cleanup `DELETE FROM social_drafts` to the disable branch. It is **derived
from the migration corpus**, so it cannot rot into a hardcoded list (#73's lesson), and it needs no catalog
access — so it runs in `npm run verify` like everything else.

⚠️ **What it CANNOT prove, said plainly rather than left implied:** it cannot prove the round trip *works* —
that the tile changes, the route is honest, the data reads back. **That half is owner-test only.** It is a
`DEVICE: desktop` card (the marketplace is a desk surface) and it is provable **without a console**:
turn Delivery off → read the tile → open `/delivery-schedule` → turn it back on → the deliveries are still
there and the trial still names the same end date.

---

## STEP 3 — THE ESTIMATE

### MINIMUM — *David can turn a tile off and back on and see his data*

**Pieces:** a `Turn off` button in the Active section of `Subscription.tsx` calling
`setBusinessModuleState({enabled:false})`, with a confirm and an honest notice. Nothing else.
**MIGRATION: NO** — the RPC already accepts and correctly handles `p_enabled=false`, with its authority gate
and audit row intact.
**RULING: ONE** — Q7's clock question.
**SIZE: ~2 prompts.**

🔴 **WHAT BREAKS, STATED RATHER THAN BURIED:** the tile stays on the grid looking nearly identical, and it
still navigates into the feature. **MINIMUM proves the DATA promise and leaves the DISPLAY promise unmet** —
and David asked for both (*"have them display… have them disappear"*).

### COHERENT — *the full round trip, with the clock handled and the route honest*

**+ Pieces:** a fifth `TileState` (`'off'`) in `useModules`/`Tile` so a disabled tile reads visibly off; a
module sibling to `PermissionRoute` so a disabled module's route renders `SurfaceState` and links back to the
marketplace — the six-state ruling applied to enablement instead of permission; the honest trial line on the
disabled card.
**MIGRATION: NO.**
**RULING: +2** — (a) does a disabled tile go **absent** or render **off**? The six-state ruling says absent is
right for DOES NOT EXIST, but a module you turned off *does* exist, and a vanished tile leaves the owner no
way back except the marketplace. (b) does the route gate read the enablement row — and what does it cost,
given `router.tsx` has no access to the overlay today?
**SIZE: ~5–6 prompts all-in.**

### COMPLETE — *+ free composition across verticals (Q8) and the general-tier rehome (Q10)*

**+ Pieces:** move the vertical axis onto `MODULE_CATALOG` (or join it to `TILE_REGISTRY`) so the marketplace
can scope at all; the rehome itself — which per Q10 is **one UPDATE and needs no code**; and
`VerticalConfig.ts`, the still-open §4 item, so "Plants tracked" reads from config on Jon's tenant.
**MIGRATION: NO for the tiles. The rehome is a data UPDATE, not a schema change.**
**RULING: +1** — *should the marketplace be vertical-scoped at all?* ⚠️ **There is a real case for NO, and it
is David's own thesis:** *"a business might need extra tiles due to some extra functions."* A nursery that
wants Delivery Routing should not be told it is the wrong vertical. Scoping the marketplace may be the wrong
direction entirely, and that should be decided before it is built.
**SIZE: ~9–10 prompts all-in**, of which `VerticalConfig.ts` is the largest single piece.

---

## STEP 5 — HAVE / NEED / WANT (OP-8)

**HAVE.** A correct, audited, authority-gated **ON** path, proven live on a real tenant. A server-side
enablement flag that already handles `false` correctly (`20260802c:133-140`). A trial clock that refuses to
restart or re-term (`20260801c:275-283`). An idempotent seeder that never clobbers (`20260801c:424-429`).
A vertical-scoping mechanism on the dashboard that works (`tileRegistry.ts:645-647`). **No off button, no
off state, and no route that knows a module exists.**

**NEED** (irreducible, no preference): one button calling the RPC that already exists, and a ruling on the
clock. That is the whole of the minimum.

**WANT** (labelled as want): enablement treated as a first-class surface state everywhere the platform
already treats permission that way — a fifth tile state, an honest route, and the vertical axis living on the
list the marketplace actually reads.

---

## THE CLOSERS

**1. Can a tile be turned off and back on today, with the data intact?**

> 🔴 **NO — and the reason is the narrow one, which is the good news.** There is **no off path anywhere in
> the product** (Q1). But *everything behind* the button is already built and correct: the RPC flips a flag
> and touches nothing else (Q2), the data cannot be reached by the disable path (Q5), the seeder will not
> clobber a returning module (Q6), and the trial neither restarts nor loses its term (Q7).
> **The round trip is one button away from working. What is missing is the button — and the honesty of the
> two surfaces that would then be wrong** (the tile still renders and still navigates, Q3/Q4).

**2. Q8 — is the catalog vertical-scoped?**

> **The dashboard is; the marketplace is not, and structurally cannot be — `MODULE_CATALOG` has no `vertical`
> field.** In practice it does not bite, because **32 of 33 tiles are `general`** and the one exception draws
> nothing anywhere. **A consulting business CAN add Delivery today.** David's guiding principle holds —
> by the emptiness of the partition rather than by the machinery.

**3. Q10 — the rehome blast radius.**

> **Tiles: zero change. Data: zero. RLS: zero — no policy reads `business_type`.** Two cosmetic effects:
> the Discounts suggestion chips fall back to the default palette, and two legacy onboarding queries stop
> matching. **Fully reversible** — one free-text column with no constraint, nothing derived, and a
> fail-safe resolver. **The 907 plants and 129 inventory rows are not at risk from the rehome.**

**4. Every ruling owed** — five, filed as `RULINGS.md` OWED rows **M-A … M-E**:

| # | Question | Blocks |
|---|---|---|
| **M-A** 🔴 | **Does a disabled module's trial keep counting?** Today it does — the clock never pauses (Q7). Recommendation: **leave the mechanism, fix the copy.** | MINIMUM |
| **M-B** 🔴 | **`user_stories.md:1052` says the connector console is `scoped-out`. Does this requirement reopen it?** Per §9 this is CONFLICT, and only David may flip the row. | **every scope** |
| **M-C** 🔴 | **Does a disabled tile go ABSENT or render OFF?** Six-state says absent for DOES-NOT-EXIST; a module you can turn back on does exist, and a vanished tile leaves no way back. | COHERENT |
| **M-D** | **Does the route layer read enablement, and at what cost?** `router.tsx` has no access to the overlay today. | COHERENT |
| **M-E** | **Should the marketplace be vertical-scoped AT ALL?** David's own thesis argues no. Decide before building the axis. | COMPLETE |

---

*Recon only. Nothing was disabled, no `business_type` was changed, the catalog was not touched, and no cap
was built. `npm run verify` exit 0, zero net-new. api/ 12/12. `git diff --stat` clean.*
