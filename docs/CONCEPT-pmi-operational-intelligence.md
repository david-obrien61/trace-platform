# CONCEPT — PMI Operational Intelligence (the surfacing engine, pointed at equipment)

**Captured:** 2026-06-23
**Status:** NORTH-STAR design family CAPTURED. Doc-only, no code/schema. On the bench — built only
when one of its consumers is built for real (see Build Path).
**Type:** Design capture (CONCEPT-* convention).
**Family:** same surfacing family as the **Regina Principle** (MASTER_BRIEF PART 4 / DECISIONS OP-9),
the **Delivery route-opportunity** surface, and the **social-intelligence** surface
(`docs/CONCEPT-social-scheduling-and-measurement.md`). Same DNA, pointed at **equipment** instead of
customers. This doc cites that doctrine — it does not re-derive it.
**Rides on / completes:** the PMI deep recon (CLOSE-OUT-LEDGER #20,
`data/grower-scan/pmi-recon-ignition-cultivar.md`) — that recon found the dependency seams; this doc
names the feature family they unlock and where the deferred `override_maintenance` mechanism lives.

---

## The thesis — Regina, applied to equipment

The Regina Principle surfaces an **owner-known business principle against existing data** so the
action becomes visible at the right moment and place — moving the labor of *noticing what to do* off
the owner's overloaded head and onto the tool. (Full doctrine: MASTER_BRIEF PART 4; DECISIONS OP-9.
Not re-argued here.)

**PMI Operational Intelligence is that same engine pointed at equipment.** The platform knows a
physical-world maintenance fact and surfaces its **operational consequence**:

- Regina: *customer near today's route → an almost-free touch worth three services.*
- Delivery: *a delivery run → three sales you'd otherwise have missed.*
- **PMI: *the tractor's maintenance is overdue and Tuesday's planting needs it → your Tuesday job is
  at risk.***

Same spine in all three: the owner **has the data** (service log, schedule, intervals) and **knows
the consequences** (a down machine stalls the work), but cannot **visualize them in time to act**.
The system does the noticing. This is the anti-Nelson flip (DECISIONS OP-5/OP-7) applied to
operations, not just cost or customers.

---

## The feature family — three cross-links, ONE idea

All three are net-new capability. Captured here as one family; not built in this pass.

### 1. PMI → Receipts (cost attribution)
A maintenance event **costs money via parts**. Buy an oil filter → it belongs to *which vehicle*; a
water filter → *which timer*. The receipt line attributes to the **asset it services**, so the asset
(and its PMI history) carries its **real maintenance cost**.

- **Seam EXISTS:** `business_service_log.receipt_id` (count-once design, currently always null).
- **Net-new:** the attribution LOGIC — turning a receipt line into a cost on a specific asset.
- **Honest caveat:** the same receipt is **not inherently one category**. Tractor fuel vs truck gas
  are *different assets' costs* on one trip to the station. This is a categorization/derivation
  problem → **derive-or-owner-identifies** (the D-9 confidence discipline: derive when we can, ask
  the owner when we can't, never fabricate the attribution).

### 2. PMI → Assets ("what's down")
An asset gains a **DOWN / out-of-service state**.

- **PROVEN today:** "what's maintained" — PMI already reads `cost_objects` ASSET nodes and the
  service log.
- **Net-new:** "what's **down**" — no downtime/out-of-service state exists on an asset today. Small
  schema add (asset status), but the unlock for cross-link #3.

### 3. PMI ↔ Delivery (the operational coupling — the powerful one)
**Asset downtime → schedule impact.** This is where the surfacing pays off:

- *"Your Tuesday planting is at risk — the tractor's PMI is overdue and it's the only one that
  fits."*
- *"The delivery truck's oil change can wait — you have a run scheduled; here's the override."*

The engine warns about a **schedule consequence the owner would otherwise hit blind**, and offers the
**override** when the run outranks the maintenance window.

- **Requires:** the downtime state (#2) **AND** the override mechanism + `override_maintenance`
  permission (below).
- **This is the demo payoff** — the same showstopper shape as Regina's map and Delivery's route:
  the data knew not to let the owner walk into a stalled Tuesday.

---

## The override mechanism (deferred to THIS feature — its natural home)

The `override_maintenance` permission is **DECLARED in the minimal PMI build** (OWNER + MANAGER
default). Its **mechanism belongs here**, because its entire value is the Delivery coupling (#3) —
overriding a maintenance window to make a scheduled run.

**Donor pattern (Ignition — PORT the shape, not the code).** Manager-override authority in Ignition is
**reason-required + authorizer-logged + single-session**:
- `IgnitionTools.jsx` bypassLog shape — *what · who · who-authorized · why · when.*
- `AccessGatekeeper` — single-session grant (the authority does not persist past the session).

**Cultivar home (already anticipated).** `business_pmi_schedule.overrides jsonb` (DEFAULT `'[]'`,
currently unused — the schema reserved this seat). An override is:
1. a **logged record** appended to `overrides`: asset, who, who-authorized, reason, when; plus
2. an **audit_log row** (`action: maintenance.overridden`) **once the audit spine exists**
   (CLOSE-OUT-LEDGER #19 — `audit_log` PART A written/gated).

Net: using a machine **against its maintenance schedule** is a **permission-gated, reason-required,
audited** action — never a silent click.

---

## Shared `<Calendar>` component (a component note, not a feature)

A maintenance calendar (M–F / due-by-day) exists on **neither** side today. But **three** consumers
already want a day-grid, and all three are currently **bespoke**:

| Consumer | What it shows | State today |
|---|---|---|
| **PMI** | assets due by day/week | net-new |
| **Delivery** | `DeliverySchedule.tsx` groups deliveries by day | bespoke, built |
| **Campaigns / Social** | `campaign_posts.scheduled_date` | bespoke |

**Recommendation (capture, not build): ONE shared `<Calendar>`** — a day-grid + "items
due/scheduled on day N" — fed three data sources. Same single-source discipline as the
breadcrumb/tile-registry: build once, three consumers, no drift. **Flag for a shared-component build
when one of the three is built for real** — do not pre-build it ahead of a real consumer.

---

## Honest dependency ledger

| Dependency | State |
|---|---|
| Customer / asset entity, service log, schedule | **EXIST** ✓ |
| `override_maintenance` permission | **DECLARED** (minimal PMI build) ✓ · mechanism owed (here) |
| `business_pmi_schedule.overrides jsonb` store | **EXISTS, unused** — ready home ✓ |
| audit_log (override writes an audit row) | depends on the **audit spine** (LEDGER #19, gated) |
| Asset downtime state | **net-new** ⚠️ |
| Receipt → asset attribution logic | **net-new** (seam `business_service_log.receipt_id` exists) ⚠️ |
| Shared `<Calendar>` | **net-new** component ⚠️ |

---

## Build path (when this comes off the bench)

1. **Downtime state** (asset status) — small schema add.
2. **Override mechanism** (reason-required, audited; writes the `overrides` record + an audit row) —
   uses the already-declared `override_maintenance` permission.
3. **Receipt → asset attribution** (the cost-categorization; derive-or-owner-identifies).
4. **PMI ↔ Delivery surfacing** (downtime → schedule-at-risk warnings; override-to-run) — **the
   payoff.**
5. **Shared `<Calendar>`** when PMI / Delivery / Social calendars get built for real.

---

*Captured by Thunder for David, 2026-06-23. Doctrine: MASTER_BRIEF PART 4 (Regina Principle) /
DECISIONS OP-9. Recon basis: CLOSE-OUT-LEDGER #20. Capture, don't build — David holds final
authority on what graduates off the bench.*
