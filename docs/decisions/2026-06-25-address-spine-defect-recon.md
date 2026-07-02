# Address-spine defect recon (READ-ONLY) — 2026-06-25

**Bar:** RECON / read-only. No code touched, no fix. `[TRACE:*]` untouched. TRACE tenant untouched.
**Symptom under test:** delivery "Open in Google Maps" → single-waypoint URL, no farm origin/dest anchor;
customer address mis-geocoded to "San Marcos, TX 78666" though stored/displayed as Wimberley 78676.
**Deploy under test:** `cultivar-os.vercel.app` live bundle `index-C55yx9Ct.js` — confirmed to contain FIX 4
(`anchor injected`, `endpointMode`, scheduled-deliveries `route mode` markers all present). **Stale-deploy ruled out.**

---

## Live values (service-key SELECT, RLS-bypass — proves stored data)

| Surface | Stored value | Verdict |
|---|---|---|
| `businesses.address` (Test Lawns Tree Farm, `ed2e5933…`) | **`"770 Co Rd 284"`** | **NON-EMPTY but INCOMPLETE** — street fragment only, NO city/state/zip |
| `deliveries` row (date 2026-06-25, Marcus Webb) | line1 `"1208 Ranch Road 12"` · city `"Wimberley"` · state `"TX"` · zip `"78676"` | **FULL + CORRECT** |
| `customers` (Marcus Webb, `71bc710d…`) | line1 `"1208 Ranch Road 12"` · city `"Wimberley"` · state `"TX"` · zip `"78676"` | **FULL + CORRECT** |

Only one business, one delivery, one customer exist — all under Test Lawns. Clean test set.

---

## The exact defect chain — THREE distinct issues, not one

### Defect 1 — single-waypoint / no anchor → `businesses.address` was EMPTY at observation (FIX 2 spine)
`buildRoute()` ([DeliveryRoute.tsx:166-192](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L166-L192)) injects the
origin **only when `originAddress.trim()` is non-empty** (line 184). `originAddress` is loaded from
`businesses.address` ([:80-82](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L80-L82)). When it's blank it hits the
`else` warn-branch ([:188-190](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L188-L190)) → `ordered = [stop]` →
`buildMapsUrl([stop])` = `/dir/{stop}/` — **exactly the single-waypoint URL David saw.**
⇒ At observation, `businesses.address` was **empty**. The FIX 4 anchor code is correct; it had nothing to inject.
This is the **FIX 2 surface**: the test business had no saved address (onboarding address round-trip hadn't run, or
predates FIX 2). It has since been partially filled (`"770 Co Rd 284"`).

### Defect 2 — anchor will STILL mis-geocode even now that it's present → address INCOMPLETE (FIX 2 spine, data quality)
`businesses.address = "770 Co Rd 284"` is a bare street line with **no city / state / zip**. County Road 284 exists in
many TX counties → Google cannot resolve it reliably. So even though FIX 4 will now inject it as origin/dest, the anchor
points at an ambiguous address. Root: the onboarding address is a **single free-text field**
([OnboardingWizard.tsx:647-648](../../packages/cultivar-os/src/pages/OnboardingWizard.tsx#L647-L648), placeholder
"123 Garden Rd, Austin, TX") with **no completeness requirement**. FIX 2 stores verbatim whatever is typed —
it does NOT drop city/zip in code; the user simply typed only a street fragment.

### Defect 3 — customer "San Marcos 78666" mis-geocode → GOOGLE-SIDE, NOT our data or our string
The customer/delivery address is **stored complete and correct** (Wimberley, TX, 78676).
`fullAddress()` ([:31-35](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L31-L35)) builds
`"1208 Ranch Road 12, Wimberley, TX 78676"` — the full string, with city+zip. Our code cannot have emitted
"San Marcos, TX 78666" (it would emit Wimberley 78676). The "Rd"-abbreviation + city/zip swap in David's URL is
**Google's canonicalized rewrite** after it geocoded a valid-but-ambiguous address (RR 12 spans San Marcos↔Wimberley;
Google snapped 1208 RR 12 to its own lat/long). **This is a geocoding-precision issue, not a stored-data or passed-string bug.**

---

## Answers to the recon questions

1. **Confirm/refute "FIX 2 and FIX 4 are the same root cause":** **PARTIALLY CONFIRMED.** The *no-anchor* symptom
   (Defect 1) is a `businesses.address` problem = the FIX 2 spine, NOT a FIX 4 code bug. FIX 4's code is correct and live;
   it depends on FIX 2 having saved a *complete* address. They are one spine for the anchor. **But the San Marcos
   mis-geocode (Defect 3) is a separate, third issue** unrelated to either — it's the customer address, stored correctly,
   mis-resolved by Google.

2. **Is `businesses.address` empty / incomplete / full-but-not-injected?** **It was EMPTY at observation
   (→ Defect 1), and is now INCOMPLETE (`"770 Co Rd 284"`, no city/zip → Defect 2).** Not a FIX 4 injection bug.

3. **Customer mis-geocode — stored-data or passed-string problem?** **NEITHER.** Stored data is full + correct; the
   passed string is full + correct. The mis-geocode is Google-side resolution of a valid ambiguous address.

4. **FIX 2 loads AND writes the full address?** **Yes, mechanically correct.** Loads on mount
   ([:446](../../packages/cultivar-os/src/pages/OnboardingWizard.tsx#L446) /
   [:465](../../packages/cultivar-os/src/pages/OnboardingWizard.tsx#L465)), writes on finalize
   ([:552-556](../../packages/cultivar-os/src/pages/OnboardingWizard.tsx#L552-L556)). It is a single free-text field —
   it round-trips whatever is typed and drops nothing in code. The gap is **no structured fields / no completeness check**,
   so a street-only entry persists as-is.

---

## Fix scope by layer (sized — David sequences)

- **Layer A — onboarding address completeness (FIX 2 spine, Defect 1+2).** *Small–Medium.* The mechanical round-trip works;
  the gap is address quality. Options span: (cheap) require non-empty + a soft "looks like it's missing a city/zip" nudge on
  the single field; (medium) split into structured line1 / city / state / zip fields (matches how `customers`/`deliveries`
  already store address) so the anchor always has city+zip. Backfill the existing Test Lawns row to a complete address.
- **Layer B — route anchor robustness (FIX 4, optional hardening).** *Small.* Already correct. Optional: when
  `businesses.address` is blank, surface a visible "no farm address set → route has no start/end; set it in Settings"
  message instead of only a console warn ([:188-190](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L188-L190)).
- **Layer C — customer geocode precision (Defect 3, Google-side).** *Small but external.* Our data is correct; we can only
  improve Google's odds — e.g. ensure zip is always present (it is here), or (larger) geocode to lat/long at capture and pass
  coordinates instead of a text string. Likely **accept-as-is for the demo** — a valid complete address is the most we control.

---

## TEST-DATA decision flagged for David (not decided here)

- **What should Test Lawns Tree Farm's canonical `businesses.address` be?** Candidates:
  - `400 Honeycomb Mesa, Leander, TX 78641` (real LAWNS / demo meeting address per CLAUDE.md), or
  - `770 CR 284, Liberty Hill, TX 78642` (the current partial `"770 Co Rd 284"` completed).
  Either way it needs **full city+state+zip** to anchor cleanly.
- **Do test customer addresses need city+zip backfilled?** **No** — Marcus Webb already has full Wimberley/TX/78676.
  The mis-geocode there is Google's, not missing data.

**Build/fix NOTHING this pass. Awaiting David's scope approval.**
