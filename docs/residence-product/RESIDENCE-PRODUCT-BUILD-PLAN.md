# Residence Product — Phased Build Plan (dependency-ordered)

> We don't replace your systems. We connect them, surface what matters, and fill the gaps you couldn't fill yourself.

**For:** David (strategy) + Thunder (build). **Method:** identify the core, prove it
OWNER-PROVEN, then bolt on each capability only once its dependency is solid.
**Customer-zero:** David, running his own house. These are real problems, not hypotheticals.

**Read first:** `DESIGN-FOR-THE-MESS.md` — the philosophy every phase is built through.
Households are messy and each runs a different OS; the app starts from the mess and nudges,
never demands organization. Receipt is the only required input. Lead with VISIBILITY/BUDGET.
Two constraints bind every phase below: **depletion must be effortless/invisible** (the
competitors' two-week-abandonment graveyard) and **never scold**.

---

## The ordering principle
Almost every "smart" feature is **downstream of structured, persistent receipt data**.
Variant memory, cost comparison, consumption-rate alerts, delivery-vs-drive, pantry
depletion — none are real until receipts are captured → parsed into lines → stored on the
spine. So the core is NOT the calendar or recipes. **The core is: receipt → structured
inventory + price record, persisted on the business_ spine.** Build that first; everything
bolts onto it.

```
                    ┌─────────────────────────────────┐
   PHASE 0  ───────►│  SCHEMA + SPINE (the foundation) │
                    └─────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
   PHASE 1  ───────►│  CORE LOOP: receipt → lines  │  ◄── the heartbeat
                    │  → inventory + price record  │
                    └──────────────┬──────────────┘
                                   │
         ┌─────────────────┬───────┴────────┬──────────────────┐
   P2    │ PANTRY +        │ P3 COST/PRICE  │ P4 PLANNING      │  (parallel-ish,
         │ DEPLETION       │ INTELLIGENCE   │ (calendar/recipes)│   all need P1)
         └─────────────────┴───────┬────────┴──────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
   P5    ───────────► SMART LAYER (needs history)  │
                    │ variant memory · consumption │
                    │ rate · delivery-vs-drive     │
                    └──────────────┬──────────────┘
                                   │
   P6    ───────────► CONNECTORS (recipes/health/maps) + MULTI-USER sharing
                                   │
   P7    ───────────► FRONT DOOR (home.builtwithcai.app) — gated on core .app
```

---

## PHASE 0 — Schema + spine foundation  *(nothing works without this)*
Get the data model right ONCE. This is the highest-leverage, hardest-to-change phase —
schema mistakes here cost 10× later.
- Confirm residence-rooted node model in tables (household = business_id at the residence).
- Core tables (⚠️ RECONCILED to live schema 2026-07-03 — do NOT use a `business_` prefix on the
  receipt tables; the master brief's own convention forbids it):
  - Receipt header = the **existing `receipts`** table (Receipt Keeper already writes it; line
    items live TODAY as its `line_items` JSON column). If P0 needs a normalized line table for
    the SKU/size join-key, it is shared-core → **`receipt_lines`** (NO vertical noun), never
    `business_receipt_line`.
  - Inventory = the **existing `business_inventory`** table (`business_` here is the shared
    business-scope prefix already live, NOT a vertical noun — this one is real, keep it).
  - Residence settings (home_zip, time_value_per_hr, per_mile_cost, week_start_day) = a
    residence-layer table, working name `household_settings`. ⚠️ The residence/household layer
    PREFIX is **not yet locked** in the live schema (no residence table exists today) — treat
    it as PROPOSED, same status as the `growers_`/`shop_`/`trades_` vertical prefixes, pending
    David's lock.
- `cost_confidence` as a CHECK constraint; `receipt_id` FK as the count-once dedup seam — the
  seam already exists on `receipts`/`cost_objects` (D-5); inherit it, don't reinvent.
- **MULTI-TENANT + MEMBERSHIP-AWARE FROM BIRTH (not a later phase).** The shared spine is
  already multi-tenant (shipped: packages/shared/src/auth, BusinessProvider, RLS scoped to
  business_id, cross-tenant verified, membership/role tables). AC-2 *requires* RLS
  membership-scoped to business_id by default. So residence tables are tenant-scoped and
  membership-aware from the first table — a household having an owner + members is how the
  table already behaves, NOT a bolt-on. Building single-user first and retrofitting tenancy
  later is the exact painful late-change to avoid, and it would mean ignoring infra we own.
  Test multi-user early (David, Regina, the boys are real members of a real household).
- **Depends on:** nothing. **Blocks:** everything.
- **Done when:** tables exist, RLS verified cross-tenant, a receipt row + lines round-trip
  DB→app→DB with count held, and two members of one household see shared data correctly.

## PHASE 1 — Core loop: receipt → structured inventory + price  *(the heartbeat)*
The one loop the whole product orbits. Capture is dumb-fast; the structuring is the value.
- Receipt Keeper already WORKS (Gemini/Claude OCR) — wire it to write receipt_lines to P0
  tables, not memory.
- Each line resolves to an inventory item (tracked) or a one-off (disappears) — nothing
  silently vanishes (Surface Honesty).
- Price-of-record captured per line, stamped CONFIRMED.
- **Depends on:** P0. **Blocks:** P2, P3, P5.
- **Done when:** David snaps a real receipt, lines persist, inventory reflects it, prices
  stored — OWNER-PROVEN on his own groceries.

## PHASE 1.5 — VISIBILITY / BUDGET  *(the lead win — what the app wins FIRST)*
Per DESIGN-FOR-THE-MESS: the real job is the number nobody has, with zero discipline
required. The moment receipts persist (P1), this is buildable and it's the first thing that
earns trust — reward before the app asks for anything.
- "This is our number" — total + monthly average from receipts alone.
- The rhythm and legible deviations: guests (+), seasonal garden/orchard/vineyard (−),
  Erin's 90-day stock-then-deplete shape.
- Spend-over-time trends by category/store (the thing people actually feel).
- NEVER scold — surface cost as information that helps incrementally, never judgment.
- **Depends on:** P1 (persisted receipts/prices). **Blocks:** nothing — ship it early.
- **Done when:** David opens it and sees his real grocery number without having entered
  anything but receipts.

## PHASE 2 — Pantry + depletion  *(effortless or it dies)*
What's on hand, and what cooking/using draws down.
- Inventory levels, reorder lines, the visual fill bars (prototype has the UI).
- **Depletion hooks MUST be effortless/invisible** — cooking a planned meal draws stock down
  automatically; NEVER require a manual "scan-out" of a half-used item (the competitors'
  death). An honestly-approximate pantry (UNKNOWN, not zeroed) beats a precise one nobody
  maintains.
- "Self" channel (garden/home-raised, never ordered); UNKNOWN never zeroed.
- **Depends on:** P1 (inventory exists). **Blocks:** P4 depletion, P5 consumption rate.

## PHASE 3 — Cost / price intelligence
The moat, pointed at the house. Mostly already built in the Cost-to-Produce engine.
- Remembered prices per item/store, cheapest flagged, per-unit comparison.
- Make-vs-buy (already built) wired to real inventory + prices.
- **Depends on:** P1 (price records). **Blocks:** P5 delivery-vs-drive (needs price basis).

## PHASE 4 — Planning (calendar + recipes)
The forward-looking layer. Prototype has the calendar + recipes + Regina's notes built.
- Persist plans keyed by week-start date; week-start = household setting (P0).
- Recipes link ingredients to inventory → cooking depletes (P2).
- Persistent week history (enables P5 repeat-detection).
- **Depends on:** P0 (settings), P2 (depletion). **Blocks:** P5 consumption insights.

## PHASE 5 — Smart layer  *(needs accumulated history — can't fake it early)*
The features that make people pull themselves in. ALL require data history from P1–P4.
- Variant/size memory (honey, ketchup) — needs price + SKU history (P1).
- Consumption-rate alerts ("a bag a week") — needs repeat history (P1/P4).
- Delivery-vs-drive — needs price basis (P3) + settings (P0) + maps (P6).
- **Bought-but-never-made (the waste insight)** — Regina's tikka-masala-cod pattern: bought,
  never depleted, likely wasted. Surface as KINDNESS ("bought 3×, never made — plan it or
  skip it?"), never scold. Needs purchase history (P1) + depletion signal (P2).
- **Modes** — serve each person's habit: list (David) / inspiration (Regina) / heat-and-eat
  raid (Andrew) / countdown-to-empty (Erin). Same engine, different surface.
- **Depends on:** P1, P3, P4. This is why it's late: it's downstream of everything.

## PHASE 6 — Connectors
- Recipe/ontology (Spoonacular + MealDB), health (Open Food Facts), maps/distance — each a
  swappable platform_config connector. *Gated on Andrew's API answers (keys/quota).*
- **Note:** multi-user/household sharing is NOT here — it's a Phase 0 property (the spine is
  already multi-tenant). The household-UX semantics (owner edits / member views, draft→
  confirmed menu, shared-vs-personal item flags) ride along with P2/P4, since the foundation
  already supports them. Only connector-dependent niceties (e.g. push a member's phone when
  an item's added) live this late.
- **Depends on:** P1–P5 working first.

## PHASE 7 — Front door
- Stand up `home.builtwithcai.app`. **DEFERRED / GATED:** it's a scope of the general core,
  so `builtwithcai.app` core must be wired FIRST (logged decision). Capabilities P0–P6 can
  all be built and proven before this; the public door comes last.

---

## What's the core, in one line
**Phase 0 + Phase 1** = the core. Schema right, then receipt→inventory→price persisting on
the spine. Everything else is a bolt-on that expands when its dependency is proven. Build
P0–P1 to OWNER-PROVEN before touching anything downstream.

## Honest notes
- Estimates deliberately omitted — they've run optimistic historically (one receipt bug ate
  a session). Sequence is reliable; durations aren't. Prove each phase before sizing the next.
- David is customer-zero throughout — each phase is "done" only when it solves a real problem
  in his own house, not when Thunder says tests pass (BUILDER-COMPLETE ≠ OWNER-PROVEN).
- tsc/parse-gate every artifact before "it runs" (the lesson from this session's three
  syntax-error rounds).
