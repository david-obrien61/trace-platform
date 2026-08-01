# D-54 · GATED PRICE — the AC-4 KEY. Location on the lot, registration on the web.

**Type:** ARCHITECTURE-DECISION (with a BUSINESS-DOCTRINE face — it is a pricing-exposure policy)
**Decided:** 2026-06-03, in the flow spec
[`docs/user-stories/cultivar-flows-and-contractor-program-2026-06-03.md`](../user-stories/cultivar-flows-and-contractor-program-2026-06-03.md)
§5 + §6, and restated in the two `user_stories.md` board stories that cite the KEY by name.
**Captured as a decision doc:** 2026-08-01 — the model was written into a *flow spec* and two
*stories*, and never into a *decision*. It therefore had no status, no guard, and no drift row, and
resurfaced on 2026-08-01 as an open question.
**Status:** DECIDED (the model) · 🔴 **DRIFTED (the build — the platform honours NEITHER key today)** ·
**ONE ITEM OPEN** (geofence radius/accuracy — David's).

---

## THE DECISION

**A price is unlocked by a KEY. The key differs by context, and the two contexts are SIBLINGS, not
rivals.**

| Context | KEY | What unlocks the price |
|---|---|---|
| **On the lot** | **LOCATION** | Physical presence substitutes for contact details. The customer is standing in the yard; that is the qualification. |
| **On the web** | **REGISTRATION** | Name, address, ZIP — supplied *before* any price renders. |

This is **AC-4 applied to price visibility**: one structural mechanism (a gate with a key), one
implementation, and the KEY is the per-context *value*. It is not two features. A third context
later (e.g. a verified contractor — KEY = TIER, named in the contractor story) plugs into the same
mechanism rather than forking it.

**Source text, verbatim.**

Flow spec §6 (on the lot):

> 6. **Geolocation-aware pricing (configuration option):**
>    - If customer is detected at LAWNS location (geofence), price is automatically visible
>    - If not at location (browsing remotely), price requires cart creation as in online flow

Flow spec §5 (on the web):

> 5. **Pricing gate:** Customer cannot see price until they create a cart with basic info
> 6. Cart creation requires:
>    - Name
>    - Address
>    - Zip code

Board story, on the lot: *"Shares the AC-4 gated-price KEY (here = LOCATION) with its siblings
below."* Board story, on the web: *"Shares the AC-4 gated-price KEY (here = REGISTRATION)."*

---

## WHY A KEY AND NOT A SETTING

The two contexts want opposite defaults, and a single boolean ("show prices: yes/no") cannot express
either without being wrong in the other. What is actually invariant is the *shape*: **a price is
withheld until something qualifies the viewer.** Naming that something the KEY makes the difference
between contexts a value, not a branch — and makes the third context cheap.

The business reason the web key is REGISTRATION rather than nothing: a public catalogue with every
price legible is the exposure the owner does not want. The business reason the lot key is LOCATION
rather than REGISTRATION: a customer standing among the trees who must fill in a form to learn a
price will find a staff member instead, which is the exact interruption the QR flow exists to
remove (flow spec §6: *"Reduces 'what's this tree?' interruptions to LAWNS staff"*).

---

## 🔴 KNOWN GAP — the platform currently honours NEITHER key

This is recorded as **DIVERGENCE FROM A DECIDED MODEL**, not as an open question. Verified against
the tree on 2026-08-01:

1. **Price renders on screen 1 of 5, before contact details are gathered on screen 3.** The guest
   route order is `/plant/:tagId` → `/plant/:tagId/addons` → `/checkout/customer` → `/checkout/review`
   → `/checkout/confirm` ([`router.tsx:91-97`](../../packages/cultivar-os/src/router.tsx#L91-L97)).
   Price is rendered on the plant page at
   [`PlantHero.tsx:88`](../../packages/cultivar-os/src/components/plant/PlantHero.tsx#L88)
   (`<PriceLine label="Price" …>`) and
   [`PlantProfile.tsx:145`](../../packages/cultivar-os/src/pages/PlantProfile.tsx#L145)
   (`Add to cart — $X`). **`CustomerCapture` is two screens later.** So the REGISTRATION key is not
   merely unbuilt — the current order is its inverse.
2. **No geofence exists anywhere in the platform.** The only `navigator.geolocation` in the repo is
   [`RhythmLogger.tsx`](../../packages/cultivar-os/src/components/RhythmLogger.tsx), which is the
   north-star timing instrument and unrelated. So the LOCATION key has no implementation either.
3. **US-001's acceptance criteria contradict both keys.** The legacy demo script
   [`CULTIVAR_OS_USER_STORIES_AND_DEMO.md:29-46`](../../CULTIVAR_OS_USER_STORIES_AND_DEMO.md) requires
   *"✅ Shows: price (plant only) and price with installation"* unconditionally on the scan page.
   **US-001 is the spec the current code was built to, and it predates this decision.** That is the
   mechanism of the drift: an older, narrower story stayed authoritative because the newer, broader
   decision never became a decision.
4. The flow spec said so about itself at the time: *"The pricing gate (cart required before prices
   show) is new behavior not yet implemented."* It has stayed not-implemented for two months because
   nothing tracked it as owed.

**Consequence today:** a guest who reaches a plant page sees every price before giving a name. Since
the anon entry point is currently broken for an unrelated reason (see below), no guest has actually
done this — but the exposure is one working entry point away.

---

## OPEN — David's to rule

**The geofence radius and accuracy policy.** Specifically: the radius that counts as "at LAWNS," and
what horizontal accuracy is required before a position is trusted to unlock a price. A phone that
reports ±2km is not evidence of presence, and the failure mode matters — an accuracy-unknown read
must not silently unlock (fail-closed), which is tech-debt #75's class.

**Everything else in this decision is settled.** Do not treat the KEY model, the two key values, or
the sibling relationship as open.

Adjacent, already recorded as open in the flow spec §9 and NOT re-opened here:
§9.2 (opt-out for owners who want prices always visible) and §9.3 (is the threshold per-customer,
per-business, or fully configurable). Those are configuration questions layered on top of a decided
mechanism.

---

## RELATION TO OTHER DECISIONS

- **AC-4** — this IS AC-4 applied to price visibility: one mechanism, per-context value.
- **[D-35]** — the customer-facing price is the stored `sell_price`, never `unit_cost`. D-54 governs
  *when* that number is shown; D-35 governs *which* number it is. Both are honoured by the same
  render site, which is why the gate belongs at that site.
- **[D-9] Surface Honesty** — a withheld price must ANNOUNCE that it is withheld (the six-surface-states
  ruling, 2026-07-30: withheld data announces its redaction; never an empty space, never a `$0`).
  A gated price is a *redaction*, and D-9 already says how a redaction renders.
- **[D-53]** — the sibling capture from the same 2026-08-01 sweep. D-53 is how a scan resolves;
  D-54 is what the resolved page is allowed to show.
- **Contractor / tier story** — *"Ordering rides the same gated-cart mechanism as the on-lot/web
  stories (KEY = TIER)"*. The third sibling, already written in those terms.

---

## GUARD

**None.** Nothing fails the build if a price renders ungated. Recorded as `—` and it renders as debt.

The honest note: a cap here is buildable and cheap — *a price render site outside a gated context
fails the build* — and it is the kind of thing that would have caught drift #1 above on the day it
appeared. Named, not taken, because this session is a capture pass and building a cap inside a
capture pass is the drift the gate exists to catch.
