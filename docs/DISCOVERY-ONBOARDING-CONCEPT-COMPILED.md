# DISCOVERY / ONBOARDING / "DASHBOARD-CANNOT-BE-EMPTY" / builtwithCAI FRONT-DOOR — COMPILED

**Compiled:** 2026-06-19
**Type:** RECON / doc-compile. READ-ONLY on existing docs. This doc gathers what is **actually written** across the repo about the AI-onboarding / discovery / prepopulate / builtwithCAI-front-door concept, so David can correct it against the source of truth and we can update the canonical docs from his edits.
**NOT a decision, NOT a design, NOT a build instruction.** No concept here is re-decided or invented. Every passage is quoted **verbatim** with `file:line`. Where the compiler adds anything, it is in a *GAP/CONFLICT NOTE* and labeled as such.

> **How to read this:** Each of the 10 threads below has (a) every verbatim quote found, with source `file:line`, and (b) a one-line GAP/CONFLICT NOTE stating whether the thread is **fully written / partially written / conversation-only**, plus any contradictions between docs. A summary table and a contradictions list are at the end.

---

## THREAD 1 — builtwithCAI as a TIER / front door / brand stack

**DISCOVERY_MODULE_BRIEF.md:28-37**
> **builtwithcai.com is TRACE's no-pressure front door.**
>
> A prospect arrives with a pain point — "I have an HVAC business and accounting is killing me." The discovery tool has a conversation with them about that specific pain. It listens. It asks follow-up questions. At the end, it sends them a genuine analysis of their own business — what they are doing well, what could be amplified — framed as a silent partner looking at their operation with fresh eyes, not a vendor telling them what's broken.
>
> They leave with something real, regardless of whether they ever sign up for anything.
>
> TRACE keeps a copy of every session internally. That copy is product intelligence — it tells us what verticals are underserved, what pain points recur, what questions reveal the most signal. Every conversation makes the tool smarter.
>
> **builtwithcai.com is a demonstration of capability, not a sales pitch.** The prospect experiences composable AI working on their actual business before they are ever asked to pay for anything. That is the hook. That is what no competitor does.

**MASTER_BRIEF.md:189-192** (Domain & Infrastructure)
> ```
> builtwithcai.com                    ← Platform home. Investor story.
> ├── cultivar-os.vercel.app          ← Nursery vertical (active)
> ├── ignition-os.builtwithcai.com    ← Auto shop vertical (dry run)
> └── conduit-os.builtwithcai.com     ← HVAC vertical (next)
> ```

**PLATFORM_STRATEGY.md:184-196** (Entry Points vs Apps)
> ### Entry Points vs Apps
>
> The `.app` domains (cultivar-os.app, ignition-os.app, conduit-os.app, kinna-os.app, builtwithcai.app) are **entry points** — pointers that load the platform pre-configured for that vertical's view. They are not separate applications. One app. Many entry doors.
>
> `builtwithcai.app` is the **general view** — the same platform, unfiltered. David is customer-zero for the general view. The general entry is the platform experiencing itself, not a separate product.
>
> The `.com` domains serve a distinct purpose: **marketing and positioning** (who this view is for). `trace-enterprises.com` is the who-we-are / purpose page. `builtwithcai.com` is discovery. Vertical `.com` domains describe the market segment.

**PLATFORM_STRATEGY.md:198-204** (Hand Diagram 2026-06-11)
> David sketched this by hand: a single circle (the platform database) with five arrows pointing outward to labeled entry points. Each arrow is labeled with a domain name and a brief description of who walks through that door. The circle doesn't change. The arrows are views. This diagram is the correct mental model for the platform. Every architectural decision should be legible from it. "Does this require a new circle?" — if yes, reconsider.

**DECISIONS.md:186-203** (OP-7 — title names the principle)
> ### OP-7 · AI infers → proposes → owner confirms (BuiltwithCAI earning its keep) — `[CAPTURED]`
> **Decision:** AI reads the cheap signals the owner ALREADY generates (receipts, activity shifts, feed purchases) and **PROPOSES** the expensive records they'd never hand-keep … AI does the bookkeeping labor; the owner does one tap. AI **NEVER auto-commits a structural change** …

> **GAP/CONFLICT NOTE — Thread 1: PARTIALLY WRITTEN, with a possible terminology drift.**
> The "front door / demonstration of capability not a sales pitch / earn-its-keep" framing IS written (DISCOVERY_MODULE_BRIEF:28-37, OP-7 title). The three-tier brand stack (`trace.enterprises → builtwithcai.com/.app → verticals`) is written, but **split and not fully consistent**: PLATFORM_STRATEGY:194-196 gives the cleanest statement (trace-enterprises.com = who-we-are, builtwithcai.com = discovery, vertical .com = market segment; .app = entry points; builtwithcai.app = general view). MASTER_BRIEF:189-192 shows a DIFFERENT stack (builtwithcai.com = "Platform home / Investor story" with verticals hung as `*.builtwithcai.com` subdomains — e.g. `ignition-os.builtwithcai.com`), which conflicts with both the registered-domain table in CLAUDE.md (verticals at their own `.com`/`.app`) and PLATFORM_STRATEGY's "vertical .com describes the market segment." The phrase **"never be smoke" / "smoke and mirrors" was NOT found verbatim anywhere** — the anti-smoke *idea* exists only as "demonstration of capability, not a sales pitch" (above) and the hollow-shell honesty label (Thread 6). If "never be smoke" is meant to be a stated principle, it is **conversation-only**.

---

## THREAD 2 — Discovery module: the 5-layer architecture, lives in shared, used cross-platform

**DISCOVERY_MODULE_BRIEF.md:131-159** (Architecture)
> ## Architecture
>
> ```
> packages/shared/src/discovery/
>   adapters/
>     website.ts          ← v0: fetch URL → structured business profile
>     voice.ts            ← v1: voice transcription → same output (Whisper or Otter API)
>     text.ts             ← v0 fallback: text conversation → same output
>   verticals/
>     nursery.ts          ← extraction schema: what signals to look for
>     ignition.ts         ← auto shop signals
>     hvac.ts             ← HVAC signals
>     kinna.ts            ← nonprofit signals
>   engine.ts             ← adapter output + vertical schema → BusinessDiscoveryProfile
>   synthesis.ts          ← BusinessDiscoveryProfile → SilentPartnerAnalysis (the email)
>   seed.ts               ← BusinessDiscoveryProfile → service_offerings rows on account creation
>
> packages/discovery-surface/     ← Layer 1: the builtwithcai.com front-end (future package)
> packages/discovery-config/      ← Layer 2: question banks, vertical schemas (future)
> packages/discovery-engine/      ← Layer 3: conversation orchestrator (future — wraps engine.ts)
> packages/discovery-voice/       ← Layer 4: voice pipeline (v1)
>
> Supabase tables:
>   discovery_sessions              ← session record, linked to auth.uid
>   business_discovery_profiles     ← structured output, used to seed businesses table
>   discovery_session_transcripts   ← full transcript copy (internal only)
> ```
>
> The five-layer naming from the prior brief is preserved. The website adapter and synthesis email are the v0-buildable pieces. The voice pipeline is v1.

**THOUGHTS.md:255** (Discovery engine — major architectural conversation)
> **The engine sits at builtwithcai.com as the unified centerpiece.** Vertical-agnostic at the door. Each vertical OS (Cultivar, Ignition, Conduit, KINNA, CoolRunnings) hosts a focused widget — same engine, pre-filtered for that vertical's vocabulary and pain points. Same code in packages/shared/src/discovery/, different consent contexts and front-ends.

**built-inventory.md:887-892** (current build state)
> ## Discovery Module (Cultivar OS — v0)
>
> **What:** Silent partner analysis engine. Fetches a prospect's website, runs a two-pass AI analysis (fast identity extraction + deep profile), and generates a "silent partner" email …
> **Status:** ✅ v0 built — TypeScript (2026-06-05). See DISCOVERY_MODULE_BRIEF.md for full spec.
> **Location:** `packages/shared/src/discovery/` + `packages/cultivar-os/api/discovery/ingest.ts` + `packages/cultivar-os/src/pages/DiscoveryInspect.tsx`

> **GAP/CONFLICT NOTE — Thread 2: FULLY WRITTEN (architecture) but the "5-layer" naming is referenced, not enumerated in place.** DISCOVERY_MODULE_BRIEF:148-159 names four future `discovery-*` packages (surface/config/engine/voice) layered over the in-`shared` v0 files, and says "The five-layer naming from the prior brief is preserved" — but the **fifth layer is not explicitly listed** in the current brief; it points back to a "prior brief" (line 3 notes "Prior version was a placeholder"), so the original five-layer enumeration may be lost. The shared-package home (`packages/shared/src/discovery/`) and cross-vertical reuse (same engine, per-vertical widgets) are written and consistent across DISCOVERY_MODULE_BRIEF, THOUGHTS:255, and built-inventory.

---

## THREAD 3 — "Dashboard cannot be empty" / prepopulate-from-website / alive-on-arrival

**DISCOVERY_MODULE_BRIEF.md:117-127** (One Auth, Two Products — the wow moment)
> The account created at `discovery.builtwithcai.com` is the same Supabase auth account as their vertical OS login.
>
> Flow:
> 1. Prospect creates account at discovery.builtwithcai.com → `auth.users` row created
> 2. Discovery session runs → `business_discovery_profiles` row created (linked to auth.uid)
> 3. They pick a vertical (Cultivar OS, Ignition OS, etc.) → `businesses` row created from discovery profile
> 4. `service_offerings` seeded from discovery profile → they log in and it is already about them
>
> The "wow moment" is that first login. They didn't fill out a setup wizard. The system already knew — because they told it, in their own words, in a conversation.

**DISCOVERY_MODULE_BRIEF.md:111-113** (what happens with extracted data)
> It feeds the silent partner analysis (specific observations grounded in what their actual website says) and it pre-populates their `service_offerings` when they create a TRACE platform account. If the website says "we offer delivery, fertilizer service, and tree warranty" — those appear as service offerings in their account, ready to configure.

**self-serve-readiness-plan-2026-05-31.md:236-243** (O-5 — Empty state)
> **O-5 — Empty state in dashboard ("add your first plant")**
> - **What it is:** When `api/dashboard.ts` returns metrics that are all zero, Dashboard.tsx renders a guided "Getting started" card …
> - **Why it's necessary:** An empty dashboard is demoralizing and confusing. New users need to know what to do next. Without guidance, churn in the first 48 hours is near-certain.
> …
> - **Risk if skipped:** Trial-to-day-7 churn rate is high. Customers who don't get value in the first week don't convert. This is the primary retention lever in the first 7 days.

**self-serve-readiness-plan-2026-05-31.md:247-254** (O-6 — Sensible defaults seeded)
> **O-6 — Sensible defaults seeded at wizard completion**
> - **What it is:** When `finalize()` creates the businesses row, also seed one default `service_offerings` row (transport_method: 'self', price: 0) and one `opportunity_items` row (netting, $10 default price) so the checkout flow has something to show before the owner has customized anything.
> …
> - **Risk if skipped:** New customers' first checkout shows no add-ons and no compliance prompt. The most valuable demo mechanic is invisible.

**THOUGHTS.md:1204** (Apple moment)
> **Onboarding should be the Apple moment.** When a customer signs up, they should have a working system within minutes, not hours. The progressive scraping and discovery engine becomes the equivalent of "set up your new iPhone" — guided, automated, oriented toward delight. Not "fill out 47 forms and call us if you have questions."

**built-inventory.md:534** (DiscoveryGlimpse — built)
> `discovery/DiscoveryGlimpse.tsx` — Client-only React component (VerticalStep). Loads website from businesses table, fires /api/discovery/ingest, shows seed insights while live analysis runs. Import directly (not from barrel) to avoid bundling server-side SDK deps. Added 2026-06-04.

> **GAP/CONFLICT NOTE — Thread 3: WRITTEN but SPLIT across two different mechanisms that are not reconciled.** Two distinct "not-empty" ideas exist and are NOT explicitly connected: (1) the **prepopulate-from-website / alive-on-arrival** wow (`seed.ts` → `service_offerings`, DISCOVERY_MODULE_BRIEF:111-127), and (2) the **empty-state fallback** for owners who arrived WITHOUT a discovery session (O-5 "Getting started" card + O-6 default seeds, self-serve:236-254). The exact phrasing "dashboard cannot be empty" was NOT found verbatim; the documented phrase is "An empty dashboard is demoralizing and confusing" (self-serve:239). The "alive on arrival" idea is captured as "it is already about them" (DISCOVERY_MODULE_BRIEF:127) and "Apple moment / working system within minutes" (THOUGHTS:1204). No single doc states the unifying rule "a new owner must never see a blank dashboard, populated from their site if available, sensible defaults if not."

---

## THREAD 4 — The recognition / correction moment ("you said X, your site says Y" / proof we looked)

**CONCEPT-customer-url-integration-and-autopopulate.md:108-113** (Recognition moment — in the arc)
> 2. **Recognition moment** — discovery catches the gap between what they told us and their public footprint, and hands it back as proof we actually looked. (e.g. they enter "Steve Jobs" but the site lists "David O'Brien" → *"Good day — we noticed the owner is listed as David O'Brien; has this changed recently? You may have outdated info on your site. We also noticed your phone number is XXX…"* That's the *quick* look. Then a button: "Would you like us to look deeper?")

**THOUGHTS.md:15** (the explicit status caveat)
> Explored (2026-06-05, not committed as spec): real-time URL discrepancy-surfacing at vertical entry ("your site lists owner X, changed recently?"). This was a possibility-exploration, not an approved build. The committed mechanism is the brief's presence-signal gate + website adapter extraction feeding seed.ts. Revisit discrepancy-surfacing as a potential v1/v2 enhancement; do not build from the exploration.

**THOUGHTS.md:137** (the glimpse mechanic — "prove TRACE is paying attention")
> **The glimpse mechanic.** If user volunteers URL after declining at the gate, run a quick light pass (~30 sec). Output two specific observations that prove TRACE is paying attention. Offer the deeper look as a continuation. The glimpse establishes value before asking for full inspection consent.

**THOUGHTS.md:364** (the recognition moment, named)
> The Jarvis moment for a TRACE prospect can't be pre-decided. It emerges from iteration — running real prospects through, watching where they lean in. The pattern is probably the recognition moment ("they restated my pain exactly right, they understood me").

**DISCOVERY_MODULE_BRIEF.md:48** (silent-partner tone — adjacent)
> **Silent partner tone.** … The tone is: "Here is what we see in your business. Here is what is already working. Here is what could amplify it." …

> **GAP/CONFLICT NOTE — Thread 4: DIRECT CONTRADICTION between two docs.** CONCEPT-customer-url:108-113 (captured 2026-06-16) presents the "you said X / your site says Y" recognition-and-correction moment as **step 2 of the discovery arc** ("the recognition moment"). THOUGHTS:15 (2026-06-05) explicitly says real-time URL **discrepancy-surfacing** was "a possibility-exploration, **not an approved build**" and "do not build from the exploration." These two passages describe the same mechanism with **opposite status** (committed-arc-step vs. explicitly-not-approved). The softer "prove we looked / two specific observations" glimpse (THOUGHTS:137) and "they restated my pain exactly right" recognition (THOUGHTS:364) ARE captured without the contradiction. **David must reconcile:** is the discrepancy-correction moment in-scope (per the 2026-06-16 concept doc) or held as exploration (per the 2026-06-05 THOUGHTS caveat)?

---

## THREAD 5 — The TWO-POPULATE design: (a) sandbox/sample seed for play, then (b) clear → real data

**THOUGHTS.md:149** (the clean button as covenant)
> **The clean button as covenant.** If user accepted operational pre-populate and then changed their mind, one click wipes operational data. TRACE retains the analysis (anonymized for product intelligence) but the user is out. Reversibility is what makes the pre-populate pattern non-invasive. Asks user what didn't fit on exit — inline-but-skippable, three or four words from a leaving customer is more valuable than ten cold follow-up emails.

**THOUGHTS.md:288** (clean button — inside-vertical widget)
> **For inside-vertical-OS users running discovery (the "want to see us use your data?" widget):** Already authenticated. Discovery results populate or update existing business row with consent. Clean button reverses if they change their mind.

**self-serve-readiness-plan-2026-05-31.md:249** (O-6 — the only "sample/default seed" written)
> … also seed one default `service_offerings` row (transport_method: 'self', price: 0) and one `opportunity_items` row (netting, $10 default price) so the checkout flow has something to show before the owner has customized anything.

**CONCEPT-customer-url-integration-and-autopopulate.md:121-128** (the autopopulate wow + near slice)
> **The autopopulate / "first login already full" wow is `seed.ts`:** `BusinessDiscoveryProfile → service_offerings` rows on account creation. The brief names the moment: *"that first login. They didn't fill out a setup wizard. The system already knew."*
>
> **NEAR SLICE (smaller than full v2):** per prior recon, `seed.ts` is **v0-adjacent — it does NOT require the full v2 surface.** You can build `seed.ts` and wire it into the **existing Cultivar signup** to get the prepopulate-on-first-login wow *without* the gated builtwithCAI front-end, the SMS gate, or voice.

> **GAP/CONFLICT NOTE — Thread 5: LARGELY CONVERSATION-ONLY / THIN.** The deliberate **two-stage** design David described in conversation — (a) seed a *sandbox / sample* dataset to play with, then (b) a "do you really want to see what we can do?" prompt that **CLEARS the sandbox and repopulates with their REAL data** — is **NOT written as a two-step sequence anywhere.** What IS documented: the **clean button** (reversibility of an accepted real-data pre-populate, THOUGHTS:149, 288) and a single layer of **default/sample seeds** for an empty checkout (O-6, self-serve:249). The "play with samples → then swap to real" handshake, the "really want to see what we can do" gating line, and the explicit CLEAR-then-real-populate step are **not in the docs** — they live in conversation only. (Note: a *different* "load-then-purge" idea was explicitly RETIRED for financial data — tech-debt #38 now says "store INSIGHTS, not INPUTS … RETIRES the purge-button framing" — which is about cost capture, not the sample-vs-real onboarding populate; do not conflate.)

---

## THREAD 6 — AI-assisted onboarding / "exploit AI for small business" / asking-questions-as-demo

**DISCOVERY_MODULE_BRIEF.md:42** (Pain-point-first)
> **Pain-point-first.** The conversation starts with the prospect's stated problem, not a generic intake sequence. "I have an HVAC business and accounting is killing me" drives the entire rest of the session — questions, synthesis, suggested services, the analysis email all reflect that specific pain. The system never pivots to a product walkthrough.

**CONCEPT-customer-url-integration-and-autopopulate.md:76-85** ("slick part" — AI does the wiring)
> **The AI role (this is the Built-with-CAI thesis):** the AI does the configuration the owner would otherwise have to understand — subdomain path wiring, QR target, content/catalog import, field mapping — from "here's your URL, click yes." The owner never learns what a CNAME record is. **They confirm; the AI configures.** This is the labor-flip applied to *adoption itself* (companion to D-9: AI proposes, owner accepts).
>
> **Why it's a wedge:** the hardest part of selling a small-business owner (Lauren/Terry) is the dread of "this means a project — set it up, learn it, migrate." One-click-and-watch-it-populate kills that dread before it forms. They don't imagine the integrated future — they *see* it, live, with their own data, having done nothing.

**THOUGHTS.md:126** (the Regina principle, generalized)
> **The Regina principle, generalized.** Don't make people work to give you information you could have gathered yourself. The traditional SaaS wizard is the Regina-with-pen-and-paper failure mode. Pre-population from website inspection is the inverse.

**THOUGHTS.md:257** (Pain-first discovery)
> **Pain-first discovery instead of website-first.** The current /discovery/inspect takes a URL and produces analysis. The new design starts with the prospect's pain in their own words. Engine listens, restates, iterates until confirmed. Website becomes secondary or optional.

**DISCOVERY_MODULE_BRIEF.md:8-22** (founding story — Regina, voice, "the AI consumed in seconds")
> The discovery tool was born in a real session with Regina O'Brien … Regina hand-wrote her answers. David took a photo of the handwritten notes and uploaded them to Claude.ai. The AI processed them immediately. Regina's response was instant regret — she had spent 20 minutes writing answers that the AI consumed in seconds. … This tool exists to make sure no one else hand-writes those answers.

> **GAP/CONFLICT NOTE — Thread 6: FULLY WRITTEN and internally consistent.** The "AI does the labor the owner would otherwise do / asking-questions-as-the-demo / they confirm, AI configures" thesis is captured in DISCOVERY_MODULE_BRIEF (pain-point-first, founding story), CONCEPT-customer-url:76-85 (Built-with-CAI thesis, labor-flip applied to adoption), and DECISIONS OP-7 (infer→propose→confirm). No contradiction found. The phrase "exploit AI for small business" was not found verbatim; the documented framing is "the Built-with-CAI thesis" and "the labor-flip."

---

## THREAD 7 — Validation handshake / "one auth, two products" / creds pass builtwithCAI → vertical

**DISCOVERY_MODULE_BRIEF.md:117-127** (One Auth, Two Products — full section; also quoted in Thread 3)
> ## One Auth, Two Products
>
> The account created at `discovery.builtwithcai.com` is the same Supabase auth account as their vertical OS login.
>
> Flow:
> 1. Prospect creates account at discovery.builtwithcai.com → `auth.users` row created
> 2. Discovery session runs → `business_discovery_profiles` row created (linked to auth.uid)
> 3. They pick a vertical (Cultivar OS, Ignition OS, etc.) → `businesses` row created from discovery profile
> 4. `service_offerings` seeded from discovery profile → they log in and it is already about them

**THOUGHTS.md:286** (Login transition — the bridge)
> **Login transition from builtwithcai.com to vertical.** When a user completes discovery and continues to a vertical, the discovery session is the bridge. System creates Supabase auth account using email, creates businesses row from session data, seeds service_offerings rows from Pass 2 suggestions (in "suggested but not active" state), creates business_member row as ADMIN. User lands in vertical OS that already knows them. No wizard. Setup happened during discovery.

**CONCEPT-customer-url-integration-and-autopopulate.md:130-132** ("one auth, two products")
> **"One auth, two products"** (from the brief): the discovery account at builtwithCAI = the same Supabase auth as the vertical login. Account → `business_discovery_profiles` → `businesses` row → `service_offerings` seeded.

**SPEC-identity-and-access-2026-06-04.md:25** (the auth mechanism it rides on)
> - **Mechanism:** Supabase Auth, email + password. One identity per human, platform-wide (one auth user per email per project — this is fixed by Supabase, do not fight it).

> **GAP/CONFLICT NOTE — Thread 7: FULLY WRITTEN and consistent.** "One auth, two products" / creds-pass-through from builtwithCAI to vertical is documented identically across DISCOVERY_MODULE_BRIEF:117-127, THOUGHTS:286, and CONCEPT-customer-url:130-132, and is consistent with the platform auth mechanism (SPEC-identity:25, "one auth user per email per project"). The word "handshake" was NOT found verbatim — the documented term is "the discovery session is the bridge" / "login transition." The `business_discovery_profiles` table is named in all three but is a **v2 GAP, not built** (built-inventory:922: "Discovery persistence — NOT built … DB persistence (`discovery_sessions`, `business_discovery_profiles`) … = v2").

---

## THREAD 8 — The cart path (no money) for LAWNS

**PLATFORM_AUDIT.md:560** (both payment paths exist)
> … Both payment paths (online invoice, pay at office) work. The QB invoice creation is non-blocking: if it succeeds, the confirmation screen shows a real "View invoice in QuickBooks" link; if it fails (token issue, network), the order still completes …

**runbooks/cultivar-user-stories-capture-2026-06-03.md:22** (in-person LAWNS flow)
> 5. **In-person customer flow (LAWNS experience)** — QR scan, geolocation pricing, multi-tree cart build, pay-in-office sync

**user-stories/cultivar-flows-and-contractor-program-2026-06-03.md:309** (open question)
> 6. **Multi-tree cart limits:** For the in-person walk-through at LAWNS, should there be quantity limits per cart to prevent abuse?

**CONCEPT-customer-url-integration-and-autopopulate.md:23-26** (scan-to-cart as a connected capability)
> Their website is theirs. We connect to it and supply the live / transactional / intelligent capabilities it can't do on its own (live per-item availability, scan-to-cart, the missed-upsell capture — the Regina/netting moment). **Their URL is the surface; we are the engine behind chosen parts of it.**

> **GAP/CONFLICT NOTE — Thread 8: THIN / CONVERSATION-ONLY for the "no money" framing.** The cart/checkout flow itself is built and documented (PLATFORM_AUDIT:560 — "pay at office" + "online invoice" paths; cultivar-user-stories:22 — "multi-tree cart build, pay-in-office sync"). But the **specific "cart path with no money" concept for LAWNS** (i.e. a cart that produces a quote/request/hold rather than taking payment) was **NOT found written as such.** What exists is "pay at office" (deferred payment, not no-money) and "scan-to-cart" as a connected capability (CONCEPT-customer-url:23-26). The "no money / quote / request" cart variant is conversation-only — David should confirm whether "pay at office" IS the intended "no money" path or whether a distinct quote/request path is meant.

---

## THREAD 9 — Domain architecture: builtwithcai.com = discovery/selector; builtwithcai.app = generalists; verticals at own domains

**PLATFORM_STRATEGY.md:184-196** (Entry Points vs Apps — full text in Thread 1)
> The `.app` domains … are **entry points** … `builtwithcai.app` is the **general view** — the same platform, unfiltered. David is customer-zero for the general view. … `trace-enterprises.com` is the who-we-are / purpose page. `builtwithcai.com` is discovery. Vertical `.com` domains describe the market segment.

**THOUGHTS.md:151** (discovery surface architecture — two front-ends)
> **The discovery surface architecture.** Public discovery at builtwithcai.com (vertical-agnostic, no account, immediate email). Vertical-specific widget inside each vertical OS (Cultivar, Ignition, Conduit, KINNA, CoolRunnings) tuned for that vertical's language. Same engine, two front-ends, different consent contexts.

**THOUGHTS.md:255** (engine at builtwithcai.com, vertical-agnostic at the door — also in Thread 2)
> **The engine sits at builtwithcai.com as the unified centerpiece.** Vertical-agnostic at the door. …

**CLAUDE.md (Registered Domains table)** — vertical .com/.app ownership (compiler reference, see CLAUDE.md §2 "Registered Domains")
> cultivar-os.com / cultivar-os.app / ignition-os.com / ignition-os.app / conduit-os.com / conduit-os.app / kinna-os.com / kinna-os.app — each registered to its vertical; builtwithcai.com hosts `discovery.builtwithcai.com` (planned subdomain).

> **GAP/CONFLICT NOTE — Thread 9: WRITTEN but with the SAME .com-stack conflict flagged in Thread 1.** The clean model (builtwithcai.com = discovery/selector at the door; builtwithcai.app = general/unfiltered view; verticals at their own domains) is well-stated in PLATFORM_STRATEGY:184-196 and THOUGHTS:151,255, and matches the CLAUDE.md registered-domains table (verticals own their `.com`/`.app`). **The contradiction:** MASTER_BRIEF:189-192 hangs verticals as subdomains of builtwithcai.com (`ignition-os.builtwithcai.com`, `conduit-os.builtwithcai.com`), which conflicts with "verticals at their own domains." Also note `discovery.builtwithcai.com` (a planned subdomain, DISCOVERY_MODULE_BRIEF:119) vs. "builtwithcai.com is discovery" (the apex itself, PLATFORM_STRATEGY:195) — minor, but the discovery surface's exact host (apex vs. `discovery.` subdomain) is stated both ways.

---

## THREAD 10 — D-9 honesty applied to populate/mapping (flag uncertain, never silently mis-map)

**CONCEPT-customer-url-integration-and-autopopulate.md:87-97** (Honest engineering — so the magic holds)
> ### Honest engineering (so the magic holds, not half-holds)
> The one-click experience is the *front* of a real orchestration. Its entire value is seamlessness; a janky version destroys the wow it exists to create. Knowing what's behind it:
> - **DNS / subdomain touches THEIR registrar** … do NOT imply fully-automatic and then surprise them with a step.
> - **Catalog / content import is AI-assisted** (read their site, extract, map) with D-9 honesty — flag uncertain mappings, never silently mis-map their inventory.
> - **Auth / login integration** varies by what they run.
> Build this to get RIGHT. A click-and-it-mostly-populates demo (catalog half-mapped, QR pointing wrong) in front of Lauren is worse than not demoing it.

**DECISIONS.md:371-391** (D-9 — the honesty contract, canonical)
> ### D-9 · The honesty contract: KNOW / THINK / REASON / NEED-CLARIFICATION, and acceptance is the pivot
> **Decision:** Every output the cost engine surfaces is **labeled by epistemic state** — **KNOW** … **THINK** … **REASON** … **NEED-CLARIFICATION** … The platform **NEVER** auto-categorizes ambiguous costs as if certain. A cost moves **SUGGESTED → owner disposes (ACCEPTED / REJECTED / EDITED) → counted.** **NOTHING counts as business cost until ACCEPTED.**
> **Reasoning:** Auto-categorizing wrong is worse than asking — one confident error poisons trust in every number … credibility is fragile, not additive …

**DISCOVERY_MODULE_BRIEF.md:80-85** (what the email does NOT contain — honesty at the output)
> **What the email does not contain:** A score or grade · A list of problems · Generic advice that could apply to any business · A hard sales pitch

**THOUGHTS.md:263** (hollow shell — honest about state)
> *No match in library — hollow shell with visual.* Engine generates a mockup of how TRACE WOULD address the pain … Honest about state (labeled "Proposed Feature — Not Yet Built"), ambitious about design.

> **GAP/CONFLICT NOTE — Thread 10: WRITTEN and consistent.** D-9 is the canonical honesty contract (DECISIONS.md:371-391) and is **explicitly applied to populate/mapping** in CONCEPT-customer-url:87-97 ("with D-9 honesty — flag uncertain mappings, never silently mis-map their inventory"). The same honesty posture appears at the discovery-email output (DISCOVERY_MODULE_BRIEF:80-85) and the hollow-shell label (THOUGHTS:263). No contradiction. **Note:** D-9 is written canonically about the **cost engine**; its application to **discovery/catalog mapping** is asserted in CONCEPT-customer-url (a CONCEPT doc, "NOT a build instruction") but not yet folded into the D-9 decision text itself or DISCOVERY_MODULE_BRIEF — so the cross-application is captured but lives in only one place.

---

## WHAT'S DOCUMENTED vs WHAT'S MISSING — summary table

| # | Thread | Status | Primary homes | Thin / missing / conversation-only |
|---|---|---|---|---|
| 1 | builtwithCAI as tier / front door / brand stack | **PARTIAL** | DISCOVERY_MODULE_BRIEF:28-37; PLATFORM_STRATEGY:184-204; MASTER_BRIEF:189-192; OP-7 | "never be smoke" phrasing absent (conversation-only); .com-stack conflict (see contradictions) |
| 2 | Discovery 5-layer architecture, shared, cross-platform | **WRITTEN** (5th layer not enumerated) | DISCOVERY_MODULE_BRIEF:131-159; THOUGHTS:255; built-inventory:887 | "Five-layer naming … preserved" but only 4 future packages listed; original 5-layer enumeration may be in a lost prior brief |
| 3 | Dashboard cannot be empty / prepopulate / alive-on-arrival | **WRITTEN but SPLIT** | DISCOVERY_MODULE_BRIEF:111-127; self-serve O-5/O-6:236-254; THOUGHTS:1204; built-inventory:534 | Exact phrase "cannot be empty" absent; two un-reconciled mechanisms (seed-from-site vs. empty-state defaults); no unifying rule |
| 4 | Recognition / correction moment ("you said X, site says Y") | **CONTRADICTION** | CONCEPT-customer-url:108-113; THOUGHTS:15, 137, 364 | Status conflict: committed-arc-step (2026-06-16) vs. not-approved-exploration (2026-06-05) |
| 5 | Two-populate: sandbox/sample → clear → real data | **CONVERSATION-ONLY / THIN** | THOUGHTS:149, 288 (clean button); self-serve O-6:249 (default seed) | The two-stage "play with sample → 'really want to see?' → CLEAR → real" sequence is NOT written; only the clean button + single default seed exist |
| 6 | AI-assisted onboarding / labor-flip / questions-as-demo | **WRITTEN** | DISCOVERY_MODULE_BRIEF:8-22,42; CONCEPT-customer-url:76-85; OP-7; THOUGHTS:126,257 | "exploit AI for small business" phrasing absent; idea fully present as "Built-with-CAI thesis / labor-flip" |
| 7 | Validation handshake / one auth, two products / creds pass | **WRITTEN** | DISCOVERY_MODULE_BRIEF:117-127; THOUGHTS:286; CONCEPT-customer-url:130-132; SPEC-identity:25 | "handshake" term absent (called "the bridge"); `business_discovery_profiles` is v2, NOT built |
| 8 | Cart path (no money) for LAWNS | **THIN / CONVERSATION-ONLY** | PLATFORM_AUDIT:560; cultivar-user-stories:22; CONCEPT-customer-url:23-26 | "no money / quote / request" cart not written; only "pay at office" (deferred payment) + scan-to-cart exist |
| 9 | Domain architecture (com=discovery, .app=general, verticals own) | **WRITTEN** (with conflict) | PLATFORM_STRATEGY:184-196; THOUGHTS:151,255; CLAUDE.md domains table | Same .com-stack conflict as Thread 1; apex-vs-`discovery.` subdomain stated both ways |
| 10 | D-9 honesty applied to populate/mapping | **WRITTEN** | DECISIONS.md:371-391; CONCEPT-customer-url:87-97; DISCOVERY_MODULE_BRIEF:80-85; THOUGHTS:263 | D-9 canon is about the cost engine; its application to catalog mapping lives only in the CONCEPT doc, not folded into D-9 or the brief |

**Tally:** Fully/consistently written = **5** (threads 2, 6, 7, 9*, 10). Written-but-split/incomplete = **2** (threads 1*, 3). Contradiction = **1** (thread 4). Conversation-only / thin = **2** (threads 5, 8). (* threads 1 and 9 share one .com-stack contradiction.)

---

## CONTRADICTIONS FOUND (for David to resolve — NOT resolved here)

1. **Brand/domain stack (Threads 1 & 9).** MASTER_BRIEF:189-192 hangs verticals as **subdomains of builtwithcai.com** (`ignition-os.builtwithcai.com`, `conduit-os.builtwithcai.com`), while PLATFORM_STRATEGY:194-196 and the CLAUDE.md registered-domains table say **verticals own their own `.com`/`.app`** and "vertical `.com` domains describe the market segment." These cannot both be the live model.

2. **Discovery surface host (Thread 9).** "builtwithcai.com **is** discovery" (PLATFORM_STRATEGY:195, apex) vs. account/sessions at "**discovery.builtwithcai.com**" (DISCOVERY_MODULE_BRIEF:119, 122, a planned subdomain). Apex vs. subdomain stated both ways.

3. **Recognition/correction moment status (Thread 4).** CONCEPT-customer-url:108-113 (2026-06-16) treats "you said X / your site says Y" as a **committed step of the discovery arc**; THOUGHTS:15 (2026-06-05) says discrepancy-surfacing is "**not an approved build** … do not build from the exploration." Same mechanism, opposite status; the concept doc is newer.

4. **"first login already full" vs. "empty-state Getting Started card" (Thread 3).** DISCOVERY_MODULE_BRIEF:127 promises "they log in and it is already about them" (seeded from discovery); self-serve O-5:236-243 designs a guided **empty** "Getting started" card for an all-zeros dashboard. Both are valid for *different* arrival paths (with-discovery vs. without), but no doc states the branching rule, so they read as competing intentions for "the first screen."

---

## THREADS THAT ARE CONVERSATION-ONLY (believed discussed, not in docs)

- **"never be smoke" / "smoke and mirrors" as a stated front-door principle** (Thread 1) — the anti-smoke *idea* exists only as "demonstration of capability, not a sales pitch" and the hollow-shell honesty label.
- **The two-stage sample→clear→real populate** (Thread 5) — only the clean button (reversal) and a single default seed are written.
- **A distinct "no money" / quote / request cart for LAWNS** (Thread 8) — only "pay at office" and "scan-to-cart" are written.
- **"exploit AI for small business" as a phrase** (Thread 6) — the idea is documented as "the Built-with-CAI thesis / labor-flip."

---

*Compiled read-only on 2026-06-19 from the repo as of branch `main`. Verbatim quotes preserved; do not treat compiler GAP/CONFLICT NOTES as decisions. David corrects this; canonical docs are updated from his edits.*
