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

---

## 3. UNKNOWNS (open — and what resolves each)

- **[UNKNOWN] ACTOR CAPTURE — does Ignition record WHO modified the price?** This is the actor-leak
  David remembers. **OPEN.** → Resolved by the `MARGIN-SYSTEM-INVENTORY.md` recon. Update this
  bucket — and migrate to `[KNOWN]` — when that recon reports the answer. *(Do not resolve here.)*

- **[UNKNOWN] Cultivar leakage STORE shape.** Columns on `order_items` vs. a dedicated leakage
  table? Design decision, **open.**

- **[UNKNOWN] Per-business CONFIG home, server-side.** `business_modules.config` vs. a new table vs.
  a constants file? **Open.**

- **[UNKNOWN] Where the logged-in user/role comes from in Ignition** — i.e. what would populate an
  actor field if we built one. **Open.**

---

## 4. GUESSES / WORKING HYPOTHESES (leaning on, not proven — re-test before relying)

- **[GUESS]** Actor-capture is the sophisticated differentiator and is likely a **BUILD** for
  Cultivar, not a port — Ignition's capture is transient/localStorage and would not survive the
  jump to a multi-device, server-aggregated report.

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

- `MARGIN-SYSTEM-INVENTORY.md` recon answers the **actor** question → when it reports, migrate that
  item from §3 UNKNOWN to §2 KNOWN and note it in §7.
- Write the real baseline / tier / override / leakage / **ACTOR** model into the design doc — close
  the `COST-TO-PRODUCE-DESIGN.md:406` gap.
- Then **size the Cultivar build**: engine port + server-side capture store + first caller.

---

## 7. LOG OF CHANGES (append-only)

- **2026-06-14** — Doc created, seeded from the investigation thread. Actor-capture question logged
  **OPEN** pending the `MARGIN-SYSTEM-INVENTORY.md` recon. All buckets reflect state as of this date;
  no open items resolved in this pass (capture-only session).
