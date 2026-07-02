# Routing-seeder seam recon (READ-ONLY) — 2026-06-25

**Type:** Verify-before-build recon. No code, no schema, no build. Sole question: before
scoping a "geo-seeder" (at onboarding, when a prospect selects the routing/delivery
capability, generate 3–4 geocode-VERIFIED nearby stops from the business's OWN address so
the route demo lands in the prospect's own town), confirm the real seams it would ride.

**Throughline lesson that gates this build:** any generated address MUST be geocode-verified,
not merely plausible. Hand-picked plausible-but-unverified addresses are the root cause of the
San Marcos mis-geocode bug — see the sibling recon
[2026-06-25-address-spine-defect-recon.md](2026-06-25-address-spine-defect-recon.md)
(Defect 3: Google snapped an ambiguous valid string to its own lat/long; Defect 2:
`businesses.address` = `"770 Co Rd 284"`, a bare street line with no city/state/zip).

---

## 1. ADDRESS HOLD — does discovery extract/persist a usable business ADDRESS? **NO.**

Discovery holds **identity / catalog / offerings + a coarse city-state string** — NOT a
street address.

- **Extraction is city/state only, by prompt design.** `runIdentity` asks for
  `"location": "city and state if mentioned, or null"`
  ([engine.ts:42](../../packages/shared/src/discovery/engine.ts#L42)); `runAnalysis` repeats
  the same field ([engine.ts:108](../../packages/shared/src/discovery/engine.ts#L108)). There
  is no street-address prompt and no street-address field anywhere in the discovery types:
  `BusinessDiscoveryProfile.location: string | null`
  ([types.ts:18](../../packages/shared/src/discovery/types.ts#L18)) and
  `BusinessIdentity.location: string | null`
  ([types.ts:60-62](../../packages/shared/src/discovery/types.ts#L60-L62)) are the only
  location-shaped fields, both coarse.
- **`business_discovery_profiles` does NOT persist an address.** The table is
  `id · business_id · source_url · raw_extract jsonb · status`
  ([20260621_business_discovery_profiles.sql:26-43](../../supabase/migrations/20260621_business_discovery_profiles.sql#L26-L43));
  no address column. `raw_extract` is written by the catalog-populate flow and holds
  `{ items, counts }` — varieties + extraction stats ONLY, no address
  ([populate.ts:175-186](../../packages/shared/src/discovery/populate.ts#L175-L186)).
- **Where a business street address actually lives:** `businesses.address` — a **single
  free-text column** ([20260529_businesses_a_create_tables.sql:9](../../supabase/migrations/20260529_businesses_a_create_tables.sql#L9))
  (`address text`). It is captured by **onboarding**, not discovery (see §3), and it is the
  incomplete free-text field flagged as the FIX-2 spine defect in the sibling recon.

**Verdict:** discovery holds identity/catalog/offerings + a coarse `location` string; it does
NOT hold a usable street address. The seeder's origin address must come from
`businesses.address` (onboarding-captured), and that field is single free-text / often
incomplete — the geocode-verify gate applies to the origin too.

---

## 2. SEED PATTERN REUSE — `seedServiceOfferings` contract + a sibling routing seeder.

**`seedServiceOfferings` contract**
([seed.ts:47-91](../../packages/shared/src/discovery/seed.ts#L47-L91)):
- **Input:** `(profile: BusinessDiscoveryProfile, businessId: string, supabase: SupabaseClient)`.
- **Writes:** `service_offerings` rows, one per `profile.suggestedOfferings`.
- **`is_active` default:** `false` — owner reviews/activates
  ([seed.ts:78](../../packages/shared/src/discovery/seed.ts#L78)).
- **Idempotency marker:** **name-based** — it SELECTs existing `service_offerings.name` for the
  business and skips any offering whose lowercased name already exists
  ([seed.ts:54-64](../../packages/shared/src/discovery/seed.ts#L54-L64)). It does NOT use a
  SKU/note prefix and has no clear/reset path of its own.

**The marker convention a routing seeder should mirror** comes from the catalog-populate flow,
not `seedServiceOfferings` — populate uses **prefix/tag markers + clear-by-marker**, which is
the re-runnable discipline a demo seeder needs:
- Discovery rows: `business_inventory.sku LIKE 'DISC-%'` + note tag `[DISCOVERY]`
  ([populate.ts:43-44](../../packages/shared/src/discovery/populate.ts#L43-L44)), cleared by
  `clearDiscovery` (`.like('sku', 'DISC-%')`,
  [populate.ts:65-71](../../packages/shared/src/discovery/populate.ts#L65-L71)).
- Sandbox rows: `SMPL-%` / `[SANDBOX]%` and **`customers.source = 'sandbox'`**, cleared by
  `clearSandbox` ([populate.ts:50-61](../../packages/shared/src/discovery/populate.ts#L50-L61)).

**Could a sibling "seed routing stops" adapter follow the same contract → `deliveries` / `customers`? YES.**
The `deliveries` table already carries a `source text` column for exactly this
([20260620_deliveries.sql:35](../../supabase/migrations/20260620_deliveries.sql#L35), e.g.
`'ocr-invoice'`) and structured address fields `address_line1 · city · state · zip`
([20260620_deliveries.sql:30-33](../../supabase/migrations/20260620_deliveries.sql#L30-L33)),
plus `customer_id` FK and `delivery_date`. So a routing seeder mirrors the populate discipline:
write `deliveries` rows with **`source = 'discovery-seed'`** (and any synthetic `customers` with
**`source = 'discovery-seed'`**), and clear by that source value before re-seeding — the same
seed→reset idempotency David owner-proved for sandbox/discovery inventory. Structured columns
exist; no schema change needed to WRITE seeded stops.

---

## 3. WIDGET HOOK — is there a point where (a) the business address is known AND (b) the user selects a capability? **YES, in OnboardingWizard.**

- **(a) Business address is known in wizard state.** `OnboardingWizard` loads
  `businesses.address` into `nurseryInfo.address` on mount
  ([OnboardingWizard.tsx:438-466](../../packages/cultivar-os/src/pages/OnboardingWizard.tsx#L438-L466),
  emits `[TRACE:ONBOARD] address loaded`) and round-trips it back on finalize
  ([OnboardingWizard.tsx:552-560](../../packages/cultivar-os/src/pages/OnboardingWizard.tsx#L552-L560)).
- **(b) Capability selection = the path chooser.** Steps are
  `WELCOME · NURSERY_SETUP · CHOOSE_PATH · PATH_EXPERIENCE · DONE`
  ([OnboardingWizard.tsx:413](../../packages/cultivar-os/src/pages/OnboardingWizard.tsx#L413));
  `Path = 'LEAKAGE' | 'CHECKOUT' | 'SETUP' | 'DELIVERY'`
  ([OnboardingWizard.tsx:411](../../packages/cultivar-os/src/pages/OnboardingWizard.tsx#L411)).
  **A prospect "choosing routing" = selecting the DELIVERY path**, which renders
  `DeliveryWizardPath` ([OnboardingWizard.tsx:309](../../packages/cultivar-os/src/pages/OnboardingWizard.tsx#L309)).
- **The seam to replace.** `DeliveryWizardPath` renders **`DEMO_STOPS`** — hardcoded
  Johnson / Martinez / Williams at Leander / Cedar Park / Round Rock TX addresses
  ([OnboardingWizard.tsx:303-307](../../packages/cultivar-os/src/pages/OnboardingWizard.tsx#L303-L307))
  — and builds a Google Maps URL from those raw strings
  ([OnboardingWizard.tsx:315-316](../../packages/cultivar-os/src/pages/OnboardingWizard.tsx#L315-L316)).
  **These are the hand-picked plausible-but-unverified addresses the throughline lesson
  targets.** The hook exists and the business address sits in wizard state — but
  `DeliveryWizardPath`'s `PathProps` does NOT currently receive the address, so the demo can't
  anchor on it today.
- **DiscoveryGlimpse has NO capability selection.** It is a read-only "Here's what we found"
  analysis glimpse driven off `businesses.website`
  ([DiscoveryGlimpse.tsx:43-60](../../packages/shared/src/discovery/DiscoveryGlimpse.tsx#L43-L60));
  it offers no tile/module/route choice. The selection hook is OnboardingWizard's CHOOSE_PATH,
  not the glimpse.

---

## 4. GEOCODE PRESENCE — is any geocoding present? **NO. Geocode-verify is entirely net-new.**

- **No geocoding call anywhere.** A repo grep for `geocod | maps.googleapis | GOOGLE_MAPS |
  GEOCODING | MAPS_API | lat/lng | latitude/longitude` across `packages/**` returns nothing.
- **No Maps/Geocoding API key in env.** The only Google key is `GEMINI_API_KEY` (Gemini, OCR,
  server-side) ([inventory-env.md:27](inventory-env.md#L27)). No `GOOGLE_MAPS_API_KEY` /
  `GEOCODING_API_KEY` exists in the env inventory or the Vercel env list in CLAUDE.md.
- **DeliveryRoute does NOT geocode — it hands strings to Google's URL.** `buildMapsUrl`
  URL-encodes plain address strings into `https://www.google.com/maps/dir/{stops}/`
  ([DeliveryRoute.tsx:37-40](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L37-L40));
  `fullAddress` joins `address_line1, city, state, zip`
  ([DeliveryRoute.tsx:31-35](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L31-L35)).
  The origin anchor is read raw from `businesses.address`
  ([DeliveryRoute.tsx:80-82](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L80-L82)).
  No lat/lng is ever computed; Google geocodes inside Maps — which is exactly where the San
  Marcos mis-snap happened (sibling recon Defect 3).

**Verdict:** there is zero geocode-verify capability and no key. Building "geocode-verified
stops" requires both a new geocoding capability and a new Maps/Geocoding API key — this is the
net-new, gating piece.

---

## 5. v1 GATE REALITY-CHECK — is the gated prospect-facing surface built? **NO — it's v1/future.**

- **The gated builtwithcai discovery surface is NOT built.** The brief lists
  `packages/discovery-surface/ ← Layer 1: the builtwithcai.com front-end (future package)`
  ([DISCOVERY_MODULE_BRIEF.md:148](../../DISCOVERY_MODULE_BRIEF.md#L148)) and confirms phasing
  `v0 → v1 → v2`, where the gated surface + retained sessions are v1/v2
  ([DISCOVERY_MODULE_BRIEF.md:159,167-173](../../DISCOVERY_MODULE_BRIEF.md#L159-L173)).
- **The only LIVE discovery entry points are two, both non-gated-prospect:**
  1. **DiscoveryInspect** — `/discovery/inspect`, "INTERNAL … no auth — David-only, URL is the
     gate" ([router.tsx:116-117](../../packages/cultivar-os/src/router.tsx#L116-L117)); v0
     SHIPPED ([DISCOVERY_MODULE_BRIEF.md:167](../../DISCOVERY_MODULE_BRIEF.md#L167)). It does
     NOT pass `businessId`, so it never seeds
     ([DISCOVERY_MODULE_BRIEF.md:169](../../DISCOVERY_MODULE_BRIEF.md#L169)).
  2. **DiscoveryGlimpse** — the in-signup `VerticalStep` in the real Cultivar OnboardingWizard
     flow ([DiscoveryGlimpse.tsx](../../packages/shared/src/discovery/DiscoveryGlimpse.tsx)),
     which DOES pass `businessId` so `ingest.ts` seeds offerings
     ([ingest.ts:171-177](../../packages/cultivar-os/api/discovery/ingest.ts#L171-L177)).
- **Note:** `business_discovery_profiles` exists (migration 20260621) but for catalog-populate
  1.3, holding catalog extract — NOT the v2 discovery-session persistence the brief describes.

**Verdict:** the **near-slice** (seed routing from the address captured in the EXISTING Cultivar
signup — `businesses.address` + the OnboardingWizard DELIVERY path) rides live seams. The
**full-arc** (a prospect scrapes their own address through the gated builtwithcai front door)
needs v1, which does not exist.

---

## DELTA SCOPE

**Smallest real build against live seams:** at the moment the prospect selects the **DELIVERY
path** in the live Cultivar `OnboardingWizard` (the existing CHOOSE_PATH → `DeliveryWizardPath`
hook, §3), generate **3–4 geocode-VERIFIED nearby stops from `businesses.address`** (already in
wizard state) and write them to the `deliveries` table (+ any synthetic `customers`) marked
`source = 'discovery-seed'` for idempotent clear — mirroring the populate.ts marker/clear
discipline (§2) — then render those real seeded stops in place of `DEMO_STOPS`. Everything
after "capture the address" rides existing seams: `businesses.address` onboarding round-trip,
the `deliveries` table with structured `address_line1/city/state/zip` + `source`, the path-
selection hook, and `DeliveryRoute`/`buildMapsUrl` rendering. **It does NOT need the v1 gated
discovery surface** — the near-slice runs entirely inside the live Cultivar signup.

**Net-new (and the gating risk):** (1) **a geocoding capability + a Maps/Geocoding API key** —
none exists anywhere in code or env (§4); this is the throughline lesson made concrete, because
"verified" means each generated stop must round-trip through a real geocoder and resolve to the
prospect's actual town, not just look plausible. (2) **Origin-address completeness** —
`businesses.address` is a single free-text field that is frequently incomplete (`"770 Co Rd
284"`, no city/zip — sibling recon Defect 2), so the seeder must geocode-verify its OWN origin
before generating neighbors, or it inherits the San Marcos ambiguity at the root. (3) **The
nearby-stop generation logic itself** — geocode the verified origin → derive 3–4 nearby
addresses → reverse-confirm each geocodes back into the same locality. The build is small in
wiring but **hard-gated on the geocoder**: without a verified geocode loop, this rebuilds the
exact `DEMO_STOPS` failure mode it exists to fix.
