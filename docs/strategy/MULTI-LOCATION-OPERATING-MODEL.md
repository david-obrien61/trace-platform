<!-- STRATEGY CAPTURE — decided model, not a build session. No schema, no code.
     Source: TRACE_PLATFORM_VISION_CAPTURE_v7.md §8f (downloaded, NOT in repo — captured here
     2026-06-14 to stop evaporation). Audit wins on any conflict about what is currently built. -->

# Multi-Location Operating Model — David + John

**Status:** STRATEGY CAPTURE. Decided. Do NOT re-derive.
**Captured:** 2026-06-14 (THUNDER VERIFY+CAPTURE)
**Source:** `TRACE_PLATFORM_VISION_CAPTURE_v7.md` §8f — generated to `/mnt/user-data/outputs`,
downloaded to David's disk, never committed to the repo. This file is the canonical repo home.
**Build-gating for:** Cost-to-Produce (`docs/cost-to-produce/COST-TO-PRODUCE-DESIGN.md`) — see §Design Consequence.

---

## 1. The model (decided)

The owner-operator does not run from one fixed place. The platform must capture cost and
location across a moving operating footprint.

- **Recurring cycle, not one-off travel.** A 3-on / 3-off rhythm (~3 months present, ~9 months
  absent), repeating — not a single trip.
- **Transition phase (now → visa/residency): ROAMING.** No fixed second base. The cycle runs
  against a *stream* of monthly rentals in different locations while scouting where to establish
  residency. Structure: one fixed base (Liberty Hill) **+ a rotating series of TRANSIENT operating
  locations**, month-to-month.
- **End-state (post-residency): two PERMANENT bases.** The European house is **DUAL-USE** —
  a residence when present, an Airbnb revenue-producing asset when absent. The platform captures
  both its costs and its rental income; the owner tags the use-split.
- **Multi-member (David, Regina, Erin, Connor — sometimes working for TRACE, sometimes for
  themselves): NEEDS NO NEW ARCHITECTURE.** Flat independent-tenant model + inter-tenant invoicing
  (one business bills another = the existing AR/AP path). The platform never models "the family
  works together"; it models independent tenants that sometimes invoice each other. The
  relationships are real in life and **deliberately absent from the schema** — which is exactly why
  it works.

---

## 2. Two proof cases (why the model is general, not David-specific)

The model was designed against **two different real people** so it covers the general
multi-location owner-operator, not one person's travel plan.

- **DAVID:** roaming → two-base dual-use Europe operation (the cycle above).
- **JOHN** (brother-in-law, NC, PM consulting): the **second independent test case** — an
  *unplanned* multi-location stretch (an estate month): a US consultant operating from another
  location for a while, partly work. This is neither roaming-Europe nor 3-on/3-off.

**Why two cases matter:** if anyone later proposes simplifying `cost_profile` to "two fixed bases,"
the **John case is the counterexample that says no** — his is an unplanned, irregular, single-
stretch multi-location situation that a two-fixed-base model cannot represent.

---

## 3. Design consequence (grandfather-firm, build-gating)

`cost_profile` is designed for **N LOCATIONS OF VARYING DURATION** — a base **+ a stream of
operating locations, permanent AND transient**.

- Transient is the **general** case. Permanent = "a transient location that doesn't end."
- One structure covers: the transition phase, the end-state, John's estate month, and any other
  multi-location owner-operator.
- **Do NOT design single-location. Do NOT design two-fixed-base.** Multi-location from the start —
  cheap to build now, painful to retrofit later.

---

## 4. The lane (boundary — defer HARD)

Pre-residency roaming while running a US business remotely is genuinely complex: tax-home,
residency, foreign-day-counting. **That is accountant + immigration/tax-attorney territory, NOT
platform.**

- The platform's job: **capture costs, locations, and business-use tags AS YOU GO**, and show the
  picture with assumptions visible.
- The platform **defers hard** on treatment. It never opines on residency or deductibility.
- Documentation value is **highest in the transition phase** — the records are messiest, the
  visa/residency stakes are real, and after-the-fact reconstruction is a nightmare. **Capturing
  live IS the feature.**

Same DNA as the Cost-to-Produce core boundary: capture and surface owner-driven scenarios; never
take a tax or legal position.
