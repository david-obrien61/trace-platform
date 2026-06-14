# MARGIN-LEAKAGE-RESEARCH-LOG.md

> **LIVING RESEARCH LOG — margin / leakage / override / actor system.** Captures the
> investigation: knowns, unknowns, guesses, and decisions WITH reasoning. Append/adjust as we
> learn; buckets migrate (guess→known, unknown→known). Companion to the facts-only recon
> artifacts. Started 2026-06-14.

**Confidence tags used throughout:** `[KNOWN]` verified with evidence · `[UNKNOWN]` open, with what
resolves it · `[GUESS]` working hypothesis, not proven · `[DECISION]` settled with reasoning.

**Companion artifacts (facts / file:line live there, not here):**
- [LOT-POPULATION-PRECONDITIONS.md](LOT-POPULATION-PRECONDITIONS.md) — sizes the lot/inventory build
- [MARGIN-LEAKAGE-PRECONDITIONS.md](MARGIN-LEAKAGE-PRECONDITIONS.md) — facts/preconditions for the leakage build
- [MARGIN-SYSTEM-INVENTORY.md](MARGIN-SYSTEM-INVENTORY.md) — file:line inventory of the margin/capture system
- [COST-TO-PRODUCE-DESIGN.md](COST-TO-PRODUCE-DESIGN.md) — the original design doc (has the gaps noted below)

This doc holds the **investigation narrative + reasoning + confidence**. The recon artifacts hold
the **facts**. When they disagree, the recon artifacts win on facts; this doc wins on *why we
decided what we decided*.

---

## 1. THE QUESTION

What does it cost to produce, **loaded** — and what's the real **margin** after the owner/staff
actually price the thing?

**Leakage** = the gap between the *suggested* (margin-correct) price and what was *actually*
charged. This is the differentiator — the **Tier 2 / Pro** capability. Receipt capture by itself
is table stakes; everyone can photograph a receipt. The margin-aware layer on top is the product.

The sophisticated part David remembers building for Ignition: capture **WHO** modified the
price/invoice, so an *unauthorized* discount (a clerk quietly knocking 15% off) is flagged
**differently** from a *deliberate* one (an owner or manager making a judgment call). Same dollar
gap, completely different finding. Attribution is what turns "you lost margin" into "this person
gave away margin without authority."

---

## 2. KNOWNS (verified — with how we know)

- **[KNOWN] The leakage MATH is built and real.** `SavingsReport.jsx:52-64` recomputes leakage from
  stored data rather than trusting a cached number; the formula uses `actualPrice` and
  `market − actual` (see `COST-TO-PRODUCE-DESIGN.md:399-407`). The arithmetic is not the gap.

- **[KNOWN] Capture EXISTS but is localStorage-only / single-device in Ignition.** Three sites:
  `transaction_history` (`DataBridge.js:960-971`), `margin_change_log` (`DataBridge.js:908-920`),
  and `first_margin_check` (`OnboardingWizard.jsx:451`). All client-local — they cannot aggregate
  across devices and cannot feed a server-side per-business report.

- **[KNOWN] The engine ports cleanly.** `MarginEngine.ts` is pure, config-injected, and AC-1-clean
  (no vertical nouns). The **cost input for Cultivar is already solved**: `business_inventory.unit_cost`
  (post-UNTANGLE).

- **[KNOWN] It is NOT a flat 40% engine.** It is a **4-slab system** (4× / 2× / 1.5× / 1.25×). The
  flat `0.40` is a **display-only orphan** at `IgnitionOmni.jsx:671-676` — not the pricing logic.

- **[KNOWN] The design doc has a real GAP.** Per-business config, override-anytime, and
  capture-persistence are hand-waved as "already in the system conceptually"
  (`COST-TO-PRODUCE-DESIGN.md:406`). The full model is **not** documented and should be.

- **[KNOWN] The design doc is stale on cost source.** It says "Step 1 = `plants.cost_price`"
  (`COST-TO-PRODUCE-DESIGN.md:539-542`), but cost now lives on `business_inventory.unit_cost`
  post-UNTANGLE. Anyone reading the design doc cold will reach for the wrong column.

- **[KNOWN] Cultivar has ZERO MarginEngine callers today.** Nothing in the nursery vertical invokes
  the engine yet — this is a first-caller build, not a wiring tweak.

- **[KNOWN] `DEFAULT_MARGIN_CONFIG` is Ignition-flavored.** Its slabs (Consumables / Mid / Heavy /
  Major) and tiers (STANDARD / FLEET / LEGACY / FF) are auto-shop concepts. A Cultivar caller that
  falls back to the default silently inherits **auto-shop config** — wrong numbers that still
  compute.

- **[KNOWN] ACTOR attribution IS built — but only for POLICY changes, NOT per-sale overrides** (the
  answer is a *nuance*, not a binary — resolved by the `MARGIN-SYSTEM-INVENTORY.md` recon, 2026-06-14):
  - Actor IS recorded for **system-wide config changes**: `margin_change_log.changed_by`
    (`DataBridge.js:137`; written at `:623`/`:646`/`:866`/`:941` as `changed_by: userId || 'SYSTEM'`).
    This captures who changed slab multipliers / tier discounts / labor rate / overhead — i.e. *who
    changed the pricing **policy***.
  - Actor is **NOT** recorded for the **per-sale price override** — the leakage-enabling piece David
    remembers. The override write (`IgnitionEstimate.jsx:233`) stores `is_manual_override`,
    `original_calculated_price`, `price_leakage` — but **no person**. `transaction_history`
    (`DataBridge.js:67-73`, enriched at `:960`) likewise has **no actor field**.
  - The actor data is **IN SCOPE but unwired**: `current_user {id,name,pin,permissions}` is loaded two
    lines from the override write (`IgnitionEstimate.jsx:104`) and used only to resolve `shop_id`.
    `isAdmin` (`PriceField.jsx:32`) gates the UI lock button **only** — a clerk override and a manager
    override produce **identical records**. So authorized-vs-unauthorized discount **does not exist** in
    stored data or in any report.

- **[KNOWN] Cultivar's leakage today is a binary flag with NO margin math, NO actor.** `submit.ts:127`
  sets `leakage_flag = isLargeContainer && add-ons === 0`. The Cultivar order spine
  (`order_items` / `orders` / `service_offerings`) carries **selling prices only** — zero cost, margin,
  suggested, actual, or actor fields. So for Cultivar this is **not "port the actor capture"** — the
  whole margin-and-actor layer is **net-new** (the shared `MarginEngine` excepted; it's already
  importable).

- **[KNOWN] The "$3,115" leak figure is NOT in the codebase.** No `3115` / `revenueLeak` constant
  exists — it's a verbal/demo figure. Live leak numbers are computed; the demo fallbacks are $450
  (Ignition) / $28 (Cultivar). **No magic constant to preserve** when sizing the build.

---

## 3. UNKNOWNS (open — and what resolves each)

- **[UNKNOWN] Cultivar leakage STORE shape.** Columns on `order_items` vs. a dedicated leakage
  table? Design decision, **open.**

- **[UNKNOWN] Per-business CONFIG home, server-side.** `business_modules.config` vs. a new table vs.
  a constants file? **Open.**

---

## 4. GUESSES / WORKING HYPOTHESES (leaning on, not proven — re-test before relying)

- **[CONFIRMED → see §2] Actor-capture is a BUILD for Cultivar, not a port — and the build is small.**
  The guess held, and the recon (2026-06-14) **sharpened** it: this is NOT a from-scratch attribution
  system. The per-sale override path already exists (`IgnitionEstimate.jsx:233`) and `current_user` is
  already in scope two lines away (`:104`); the gap is a **one-field addition** — carry the
  already-loaded `current_user` into the override record. Migrated to KNOWNS; kept here only as a
  pointer so the guess reads as *confirmed-and-refined*, not still-speculative. (For Cultivar
  specifically, the order spine carries no cost/margin/actor at all, so the actor field rides in on the
  broader net-new margin layer — see §2.)

- **[GUESS]** Likely Cultivar shape: **suggested-vs-actual-vs-actor on `order_items`**, since
  Cultivar already has the orders spine to hang it on.

- **[GUESS]** The 40% baseline is **per-business CONFIG**, not engine logic. (Consistent with the
  4-slab `[KNOWN]`, but stated separately because it governs where config lives.)

---

## 5. DECISIONS + REASONING (the WHY — so each can be re-tested against new cases)

- **[DECISION] Config is PER-BUSINESS** — not per-vertical, not on the inventory row. *Why:* the
  product's job is per-business margin visibility; one nursery and another nursery price
  differently. A vertical-noun on config would be an **AC-1 mistake** (vertical identity is a value,
  never a structural identifier).

- **[DECISION] Capture must be SERVER-PERSISTED and `business_id`-scoped.** *Why:* localStorage
  cannot aggregate across devices or feed a per-business report. The whole value of the report is
  cross-session, cross-device rollup; client-local storage structurally cannot deliver it.

- **[DECISION] The ACTOR is load-bearing.** *Why:* an unauthorized discount by a clerk is a
  **different finding** than an owner's deliberate one. The report's job is to surface **WHO**, not
  just how much. Leakage without attribution is a weaker product — it tells you that you bled
  margin but not whether anyone needs a conversation.

- **[DECISION] DO NOT fall back to `DEFAULT_MARGIN_CONFIG` for Cultivar.** *Why:* it's auto-shop
  slabs/tiers. A wrong-but-working number is **worse than a missing one** — it lies silently and
  looks authoritative. Fail loud (no config) over compute-wrong (auto-shop config).

- **[DECISION] The capture distinction that governs the build:** **APPLIED** (used in the calc) ≠
  **CAPTURED** (stored) ≠ **ATTRIBUTED** (stored *with who*). Leakage needs **ATTRIBUTED**. *Why:*
  it's easy to conflate these; Ignition has APPLIED + a transient CAPTURED, but ATTRIBUTED is the
  bar the product actually has to clear.

---

## 6. OPEN NEXT STEPS (not decisions — just what's queued)

- ✅ **DONE (2026-06-14)** — `MARGIN-SYSTEM-INVENTORY.md` recon answered the **actor** question;
  migrated §3 UNKNOWN → §2 KNOWN with the policy-vs-per-sale nuance, logged in §7.
- **[OPEN]** Write the real baseline / tier / override / leakage / **ACTOR** model into the design doc
  — close the `COST-TO-PRODUCE-DESIGN.md:406` gap.
- **[OPEN]** Then **size the Cultivar build** — the port/build decision: engine port + server-side
  capture store + first caller + the one-field actor add. (Separately gated — do not resolve here.)

---

## 7. LOG OF CHANGES (append-only)

- **2026-06-14** — Doc created, seeded from the investigation thread. Actor-capture question logged
  **OPEN** pending the `MARGIN-SYSTEM-INVENTORY.md` recon. All buckets reflect state as of this date;
  no open items resolved in this pass (capture-only session).
- **2026-06-14** — Actor question **RESOLVED** via the `MARGIN-SYSTEM-INVENTORY.md` recon. Migrated
  UNKNOWN → KNOWN. Finding: actor attribution **is** built for **policy** changes (`changed_by`), but
  **NOT** for per-sale overrides; `current_user` is in scope but unwired (`IgnitionEstimate.jsx:104`);
  Cultivar leakage is net-new (binary flag today). Also removed the companion §3 UNKNOWN "where the
  logged-in user/role comes from" — same recon answered it (resolved by the new KNOWN). Guess
  "actor = build-not-port" **confirmed** and **refined** to "one-field addition." "$3,115" confirmed
  as a demo/verbal figure, not a wired constant. Capture/migration only — no port, no build, no
  design-doc model rewrite.
