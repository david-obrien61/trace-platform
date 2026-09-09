# The waypoint cap — REPORT, no build. David's decision, not made here.

**Date:** 2026-09-08 · **Filed by:** Thunder (#286) · **Type:** REPORT (deliberately not built)
**Ruling it obeys:** David, 2026-09-08 — *"DO NOT FOLD IT INTO THE BUILD — it is truncation, not
mis-sorting, and it needs its own decision. But it is no longer hypothetical, so REPORT in the same
pass."*

---

## THE QUESTION

> *Does the undocumented path form we use truncate, and at what count? If it does, a driver receives
> a partial route with nothing telling him so, and that is worse than the wrong order.*

---

## WHAT IS MEASURED, WHAT IS DOCUMENTED, AND WHAT IS NEITHER

**Provenance marks are load-bearing here.** The 2026-09-08 ordering defect was reported by two
people watching a real screen; this one is reasoned from documentation about a *different* URL form.
They are not the same grade of evidence and must not be written as though they were.

| Claim | Provenance |
|---|---|
| LAWNS's stops per delivery day run **1–14, mean 3.6**; **69 of 167 days (41%) exceed 3**; **7 of 167 (4%) exceed 9**; busiest day **14** | **[MEASURED]** — Lightning, from LAWNS's own invoice export over the ShipDate year, 2026-09-08 |
| We emit `https://www.google.com/maps/dir/<addr>/<addr>/…/` — the **path form** | **[MEASURED]** — `routeHandoff.ts` `buildMapsUrl`, this build |
| Google's **documented** Maps URLs API caps waypoints at **9**, or **3 on mobile browsers**, and excess *"will be ignored"* | **[DOCUMENTED]** — `developers.google.com/maps/documentation/urls/get-started`, fetched 2026-09-08 |
| That documented cap describes the `?api=1&origin=…&waypoints=…` form — **not the path form we emit** | **[DOCUMENTED]** — same page; the path form appears nowhere in Google's URL documentation at all |
| The path form tops out around **10 total stops** | 🔴 **[STATED]** — community/forum reports only (Google Maps Help threads, dev blogs). **No Google source states it.** Not verified by us. |
| What LAWNS's driver actually receives on a 12-stop day | 🔴 **[UNKNOWN — and this is the honest answer]** |

🔴 **SO THE DIRECT ANSWER TO DAVID'S QUESTION IS: I DO NOT KNOW, AND NOBODY CAN KNOW IT FROM A
DESK.** The form is undocumented; its behaviour is a property of Google's servers and of the
handset's browser, not of our code. **Reading more documentation cannot settle it.** The only thing
that settles it is opening a long link on a real phone — which is why it is written as an owner-test
card (`delivery-route-handoff-full-surface-test.md` CARD 8, `needs-test`) and not as a claim.

⚠️ **I nearly wrote "≈10 total stops" as a finding.** It is a forum number with no primary source,
and stating it with the same confidence as the 41% would be [[R-26]] committed inside the very
document filed to prevent it. **It is marked [STATED] and it should not steer the decision.**

---

## WHY IT MATTERS MORE THAN THE DEFECT JUST FIXED

The ordering bug was **loud once you looked**: the driver got a route in a stupid sequence, drove it,
and somebody eventually noticed the day felt long. Truncation is **silent in a worse way** —

- Google shows a route that looks completely normal. There is no error, no ellipsis, no "3 of 12".
- The driver has no list to check it against; **Lauren's screen is the only place the full stop
  count exists**, and she is not the one holding the phone.
- The stops that vanish are the **last** ones — the end of the day, when nobody is still comparing.
- **Our own text would confirm the wrong thing.** The SMS now honestly reports the number of stops
  *in the link we built*, so it would read *"(12 stops)"* while the phone displays four. Post-fix,
  the message and the map disagree, and the message is right. **That is a good outcome — the
  disagreement is now visible — but only if someone counts.**

⚠️ **AND THIS IS EXACTLY THE SHAPE THAT JUST COST FOURTEEN MONTHS:** an artefact that leaves the
building, is never opened by the person who could tell it was wrong, and looks perfect to the person
who receives it. Same class, different mechanism.

---

## THE OPTIONS — cheapest-meets-need → fullest-meets-want

**NEED** (irreducible): a driver must never receive a route that is missing stops **without being
told**. Note what that does *not* say — it does not require carrying 14 stops in one link.

- **(A) MEASURE FIRST, DECIDE AFTER. ~15 minutes, no code.** Run CARD 8: build a 12-stop route, text
  it, open it on a phone, count what arrives. 🔴 **Recommended as the first move regardless of which
  option follows**, because every option below is priced differently depending on whether the real
  cap is 3, 10, or absent. Choosing a fix before this is choosing in the dark — and the last time we
  reasoned about this handoff from documents rather than the artefact, the answer was wrong for a
  year.
- **(B) WARN ABOVE THE CAP. Small, honest, does not solve it.** When `stopCount` exceeds the
  threshold measured in (A), the route card and the SMS say so — *"12 stops — Google Maps may only
  show the first N. Send in two parts."* Costs nothing structural and satisfies NEED exactly:
  nobody receives a silent partial. ⚠️ It leaves Lauren doing the splitting by hand on 4% of days.
- **(C) SPLIT LONG DAYS INTO TWO LINKS.** *"Route part 1 (stops 1–8) · part 2 (stops 9–14)"*, both
  texted together, the split falling at the cap and the second leg starting where the first ended.
  Fits the derivation cleanly — it is a second `buildRouteHandoff` call over a slice, so nothing
  about the one-array rule changes. ⚠️ Two links is two things a driver can lose track of.
- **(D) MOVE TO THE DOCUMENTED `?api=1` FORM.** Trades an unknown cap for a **known and lower** one
  (9 / 3), so on its own it would make things *worse* on 41% of days — it is only worth doing
  **together with (C)**, where a documented cap is what makes the split arithmetic trustworthy.
  🔴 **Do not take (D) alone.**

**WANT** (labelled as want): the driver receives one artefact per day, in optimised order, complete,
with the count visible on it — and if the platform cannot carry that, the platform says so before
Lauren presses send rather than after.

---

## WHAT I DID NOT DO, AND WHY

**No code changed for this.** Per David's ruling it stays out of #286: folding a URL-form change into
an ordering fix would put two defects in one diff on **the one capability the customer uses daily**,
and would mean the ordering fix could not be owner-proven on its own. The build that just shipped is
provable in four cards; a bundled one would not be.

**No threshold is hardcoded anywhere in the shipped code** — deliberately. A cap written from a forum
post is a hardcoded literal sourced from a guess (§6 r12 / the HARDCODED-REGISTER's whole point), and
it would be read as measured by the next person. `routeHandoff.ts` names the risk in its header and
holds no number.

**Tracked as tech-debt #223.** Story piece: `waypoint_cap_decision`, on *What the driver receives is
what the manager saw* — carried as an explicitly OWED decision so it cannot quietly become the next
fourteen-month silence.
