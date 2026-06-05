# DISCOVERY_MODULE_BRIEF.md

> Status: Living document. Updated 2026-05-29 with founding story, design decisions, and architecture. Prior version was a placeholder.
> When this doc conflicts with another: see CLAUDE.md Scope & Hierarchy.

---

## Why This Exists — The Founding Story

The discovery tool was born in a real session with Regina O'Brien, Program Director at Operation Liberty Hill and the anchor pilot user for KINNA-OS. David was walking her through a discovery conversation — the questions that would shape what KINNA-OS needed to do for her organization.

Regina hand-wrote her answers.

David took a photo of the handwritten notes and uploaded them to Claude.ai. The AI processed them immediately. Regina's response was instant regret — she had spent 20 minutes writing answers that the AI consumed in seconds. David had offered Otter (voice transcription) before they started. She had declined.

That moment is the design specification for this tool:

- Voice is not a feature preference. It is the correct input method. Written intake creates friction that feels like work, not collaboration.
- The AI response is fast enough that the bottleneck is always the input method, never the processing.
- The friction was visible, real, and personal — and it happened to the person the tool was built for.

This tool exists to make sure no one else hand-writes those answers.

---

## What This Tool Is

**builtwithcai.com is TRACE's no-pressure front door.**

A prospect arrives with a pain point — "I have an HVAC business and accounting is killing me." The discovery tool has a conversation with them about that specific pain. It listens. It asks follow-up questions. At the end, it sends them a genuine analysis of their own business — what they are doing well, what could be amplified — framed as a silent partner looking at their operation with fresh eyes, not a vendor telling them what's broken.

They leave with something real, regardless of whether they ever sign up for anything.

TRACE keeps a copy of every session internally. That copy is product intelligence — it tells us what verticals are underserved, what pain points recur, what questions reveal the most signal. Every conversation makes the tool smarter.

**builtwithcai.com is a demonstration of capability, not a sales pitch.** The prospect experiences composable AI working on their actual business before they are ever asked to pay for anything. That is the hook. That is what no competitor does.

---

## Core Design Principles

**Pain-point-first.** The conversation starts with the prospect's stated problem, not a generic intake sequence. "I have an HVAC business and accounting is killing me" drives the entire rest of the session — questions, synthesis, suggested services, the analysis email all reflect that specific pain. The system never pivots to a product walkthrough.

**Voice primary, text fallback.** Regina's story is the proof. Voice is the default. Text is available via toggle for situations where voice isn't practical (open office, commute, preference). Written forms are not offered.

**Reciprocity.** The prospect leaves with a concrete, personalized analysis of their own business regardless of whether they engage further with TRACE. The value exchange is unconditional.

**Silent partner tone.** The analysis is not a grading rubric. It does not score, rank, or identify failures. The tone is: "Here is what we see in your business. Here is what is already working. Here is what could amplify it." Established businesses — someone who has run a nursery for 15 years — do not need to be told what is wrong. They need a partner who notices what they've built.

**Honest friction at the gate.** The tool is gated behind account creation. This is intentional friction — it filters out non-serious browsers, gives TRACE a verified contact for every session, and the account created becomes their TRACE platform account if they convert. The gate is minimal; the hook is immediate. The first thing they experience after creating an account is the AI responding to their stated pain — not a product tour.

---

## Account Creation Requirements

A prospect cannot reach the discovery conversation until they have:

1. **Valid email** — confirmed via Supabase email verification
2. **Valid phone number** — confirmed via SMS code
3. **Business presence signal** — at least one of:
   - Valid website URL (system attempts fetch — rejected if unreachable or returns no content)
   - Geocodable business address (street + city + state — P.O. boxes rejected)
   - Active social media URL (Facebook Business, Google My Business, Instagram Business)

Businesses without a website are common and valid — a sole-proprietor HVAC tech, a food truck, a small nonprofit. The presence signal requirement exists to confirm they are operating a real business, not to exclude them for lacking a website. Two presence signals without a website are accepted.

---

## The Output: Silent Partner Analysis

At the end of every discovery session, the prospect receives an email. TRACE retains a copy.

**What the email contains:**
- A brief acknowledgment of the pain point they started with
- Two or three specific things the business is already doing well (drawn from the conversation and, if provided, website/social analysis)
- Two or three opportunities — specific, actionable, framed as amplifiers not corrections
- Each opportunity attached to a business outcome (more time, more revenue, more repeat customers) — not a technical fix
- A note that TRACE can help with some or all of this, with a soft CTA to explore what that looks like

**What the email does not contain:**
- A score or grade
- A list of problems
- Generic advice that could apply to any business
- A hard sales pitch

**What TRACE retains internally:**
- Full session transcript
- The structured business profile extracted from the session
- The analysis output
- Vertical classification, pain points identified, services suggested
- Used for: product roadmap decisions, vertical schema improvement, identifying underserved markets

---

## Website and Business Inspection

When a prospect provides a website URL, the system fetches and analyzes it automatically. This is an input to the discovery engine — it contributes to the analysis alongside the conversation, it does not replace it.

**What the engine extracts, vertical-aware:**

For a nursery: plant types mentioned, container sizes, delivery/installation offerings, warranty language, seasonal events, price signals, staff references.

For an auto shop: service types listed, fleet account language, oil change intervals, tire brands carried, warranty terms, emergency/after-hours availability.

For HVAC: service contract language, emergency service, seasonal maintenance offers, equipment brands, residential vs. commercial focus.

For a nonprofit: programs offered, population served, intake language, volunteer mentions, donor-facing copy, compliance references (TEFAP, SNAP, etc.).

The vertical schema is a configuration — adding a new vertical means writing a new extraction schema, not modifying the engine.

**What happens with the extracted data:**

It feeds the silent partner analysis (specific observations grounded in what their actual website says) and it pre-populates their `service_offerings` when they create a TRACE platform account. If the website says "we offer delivery, fertilizer service, and tree warranty" — those appear as service offerings in their account, ready to configure.

---

## One Auth, Two Products

The account created at `discovery.builtwithcai.com` is the same Supabase auth account as their vertical OS login.

Flow:
1. Prospect creates account at discovery.builtwithcai.com → `auth.users` row created
2. Discovery session runs → `business_discovery_profiles` row created (linked to auth.uid)
3. They pick a vertical (Cultivar OS, Ignition OS, etc.) → `businesses` row created from discovery profile
4. `service_offerings` seeded from discovery profile → they log in and it is already about them

The "wow moment" is that first login. They didn't fill out a setup wizard. The system already knew — because they told it, in their own words, in a conversation.

---

## Architecture

```
packages/shared/src/discovery/
  adapters/
    website.ts          ← v0: fetch URL → structured business profile
    voice.ts            ← v1: voice transcription → same output (Whisper or Otter API)
    text.ts             ← v0 fallback: text conversation → same output
  verticals/
    nursery.ts          ← extraction schema: what signals to look for
    ignition.ts         ← auto shop signals
    hvac.ts             ← HVAC signals
    kinna.ts            ← nonprofit signals
  engine.ts             ← adapter output + vertical schema → BusinessDiscoveryProfile
  synthesis.ts          ← BusinessDiscoveryProfile → SilentPartnerAnalysis (the email)
  seed.ts               ← BusinessDiscoveryProfile → service_offerings rows on account creation

packages/discovery-surface/     ← Layer 1: the builtwithcai.com front-end (future package)
packages/discovery-config/      ← Layer 2: question banks, vertical schemas (future)
packages/discovery-engine/      ← Layer 3: conversation orchestrator (future — wraps engine.ts)
packages/discovery-voice/       ← Layer 4: voice pipeline (v1)

Supabase tables:
  discovery_sessions              ← session record, linked to auth.uid
  business_discovery_profiles     ← structured output, used to seed businesses table
  discovery_session_transcripts   ← full transcript copy (internal only)
```

The five-layer naming from the prior brief is preserved. The website adapter and synthesis email are the v0-buildable pieces. The voice pipeline is v1.

---

## Build Phases

**Status (2026-06-05):**

- **v0 engine is BUILT** and routed through the shared AI gateway (`packages/shared/src/ai/`). The two-pass split is live: `discovery_identity` (Haiku, fast extraction) runs first, then `discovery_analysis` (Sonnet, deep profile) uses the identity result as context, then `synthesis.ts` produces the silent partner email. Remaining for v0 to be complete: website adapter wiring into the discovery surface front-end, the silent-partner email send mechanism, and the internal admin view. LAWNS Tree Farm and Backbone Valley Nursery are still the planned first trial runs.

- **`seed.ts` (profile → `service_offerings`) is NOT built.** It is the buildable-now piece of the v2 wow-moment — the "first login already knows you" pre-population. Critically: `seed.ts` does NOT require the v2 gated discovery surface to be in place first. It can wire directly to the current Cultivar OS signup flow independently of the gate. This makes it pullable forward into an earlier build window without breaking the v2 sequencing.

- **Phasing confirmed: v0 → v1 → v2.** The v2 wow-moment (first login already pre-populated) depends on v1's discovery surface existing — a user must have gone through a discovery session for their account to be seeded. v0+v2 without v1 is incoherent: there is no session to seed from. The only piece of v2 pullable forward independently is `seed.ts`, for reasons above.

**v0 — Website inspection + silent partner analysis email (build now)**
- Website adapter: fetch URL, extract profile, vertical-aware
- Synthesis: produce silent partner analysis email
- LAWNS and Backbone Valley Nursery as the first two trial runs
- Internal admin view: David can see the analysis output before sending
- The email goes to the prospect; TRACE keeps the copy

**v1 — Voice intake (after v0 validated)**
- Voice pipeline: Whisper or Otter API → transcript → same engine.ts input
- Question bank for at least one vertical (nursery or KINNA-OS)
- discovery.builtwithcai.com front-end with voice UI
- The full session replaces or supplements the website-only analysis

**v2 — Gated discovery surface + one-auth account creation**
- Login gate at discovery.builtwithcai.com
- Account creation with verification (email + SMS + presence signal)
- Pre-populated account on first vertical OS login
- /admin/sessions review surface for David

---

## Origin Context

The first discovery sessions were for KINNA-OS — Regina O'Brien's nonprofit vertical. The written-answer friction story (above) happened in that context. The tool is named and shaped by that experience.

The commercial verticals (Cultivar OS, Ignition OS) were built first because the demo timeline required it. The discovery tool predates them conceptually — it was the original question-and-answer intake that revealed what each vertical needed. It will now be built as a product that does for every prospect what those early conversations did for TRACE.

---

## What Is Still Deferred

- Question bank content for KINNA-OS (the ~30 questions, YAML schema)
- Detailed UX specifications for the discovery surface front-end
- The Otter vs. Whisper decision for voice transcription
- Magic-link auth vs. email/password for discovery sessions
- How question banks coordinate across verticals (shared vs. vertical-specific questions)
- Success criteria for v0 and v1
- The /admin/sessions full review surface (beyond a simple list view)
- Connector demonstration during session (show them their QuickBooks data or Neon One data in real time)

---

*TRACE Enterprises · Built with CAI*
*Update this file when decisions are made. Never let it fall back to a placeholder.*
