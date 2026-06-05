# SPEC — AI Gateway (unified model routing, cost control, insight capture)

**Date:** 2026-06-05
**Status:** SPEC (post-demo build). Grounded in the 2026-06-05 read-only audit of all Anthropic API call sites + the security-posture audit. Nothing here is greenfield — it consolidates what exists.
**Origin:** David — "as we build capabilities I want to embed insight to their business; we need a way to identify which capabilities call which models, how and where stored." Audit revealed two disconnected AI systems + hardcoded models + missing caching.

---

## 0. What the audit found (the reason this spec exists)

Two disconnected AI systems today:

- **System A — `packages/shared/src/ai/AIEngine.ts`** (Ignition-first). The RIGHT shape: single `call(task, payload, options)` interface, `TASK_ROUTING` table mapping task→provider+model, tier gates, Haiku fallback. BUT routes through Railway (`VITE_API_URL`) and is dormant for web (Tech Debt #12 — `VITE_API_URL` unset, calls fail gracefully). **Good brain, dead plumbing.**
- **System B — four direct `new Anthropic()` call sites** (Cultivar/shared), each instantiating its own client, **model hardcoded inline**, no shared wrapper:
  - `shared/src/discovery/engine.ts:65` → `claude-sonnet-4-6` (website crawl — HIGH token, NO caching)
  - `shared/src/discovery/synthesis.ts:75` → `claude-sonnet-4-6` (pain-point synthesis — HIGH token, NO caching)
  - `shared/src/campaigns/generate.ts:68` → `claude-sonnet-4-6` (campaign gen — NO caching)
  - `cultivar-os/api/social/generate-posts.ts:145` → `claude-sonnet-4-6` (social gen — HAS caching: `cache_control: ephemeral`)
  - (plus a legacy `cultivar-os/api/campaigns/generate.ts` superseded by the shared one; and `services/customer-match.ts` undeployed)

**The gap, in cost terms:** all four hardcoded to Sonnet (discovery/social are Haiku candidates per cost framework — paying up to 3x too much); 3 of 4 uncached (the two highest-token calls — discovery/synthesis — uncached); none batched. No single place to fix any of it.

**Security verdict (audit):** both patterns are key-safe. Railway proxy was correct for Ignition's original React Native context (no server side; key must live off-device). For the Vercel web build, `process.env.ANTHROPIC_API_KEY` in a serverless handler is fully server-side (no `VITE_` prefix — never bundled to client). The Vercel serverless pattern gives the same security with one fewer infra layer. → Tech Debt #12 conclusion stands: port to Vercel functions, decommission Railway.

---

## 1. The decision

**Build ONE shared AI Gateway. Keep AIEngine's brain, drop its Railway plumbing.**
- **Transport:** Vercel serverless pattern — `ANTHROPIC_API_KEY` read in the handler (server-side), passed as a parameter into key-agnostic shared modules. (Already proven in production by all four Cultivar calls.)
- **Brain:** AIEngine's routing intelligence — model-per-task/capability, Haiku fallback — lifted out of the Railway-bound version and generalized.
- **Retires:** Railway (Tech Debt #12).
- **Absorbs:** the four direct call sites — all route through the gateway.

This is the same move as everything this session: a real working capability (AIEngine's routing) trapped in one context, promoted to shared; scattered divergent calls (the four) consolidated to one. Not greenfield — promote + consolidate.

---

## 2. What the gateway is

A single shared module — `callClaude(capability, prompt, options)` (or extend AIEngine's `call()` interface) in `packages/shared`. EVERY capability that needs Claude calls THIS, never the SDK directly. The gateway:
1. Looks up the calling capability's **model config** (which model, cache on/off, batch on/off, max output).
2. Reads `ANTHROPIC_API_KEY` server-side (Vercel handler), constructs the request.
3. Applies caching (cache_control on the stable prompt prefix) and batching per config.
4. Calls Anthropic; on failure, Haiku fallback (AIEngine's existing pattern).
5. **Logs every call** at this choke point: capability, business_id, model, tokens in/out, computed cost, latency, success/fail.

**Triple duty (why the gateway is high-leverage):**
- **Cost control** — model/cache/batch decided in ONE place from config; no hardcoded models scattered across call sites.
- **Architecture/security** — one API choke point; key server-side; one place to instrument (Doug: a few lines, big value), one place that can fail in isolation (Alan: API trouble degrades gracefully, doesn't cascade).
- **Insight capture (David's goal)** — every call flows through here, so this is where you capture: per-business usage (which capabilities, how often — THEIR insight to surface back), input/output pairs (the voice-learning / smarter-over-time loop), and cost-to-serve per business (margin data + value-shown-to-customer).

---

## 3. Where model choice is stored (the answer to "how and where")

**Model config is a property of the capability, stored as config DATA, not hardcoded in the call.** (AC-4: settle once, encode as variable.)

Two levels, with override (same pattern as RBAC role→tile and the Lexicon):
- **Platform default per capability** — the baseline model/cache/batch for a capability, set once. Lives in a capability-definition (the platform template) — e.g. a routing table generalized from AIEngine's `TASK_ROUTING`, or a `capability_ai_config`.
- **Per-business override** — optional, rare. "LAWNS's social capability uses Sonnet because they pay for premium." Lives in that business's `business_modules.config` jsonb (the column already exists).

Gateway resolution: business override? → use it. Else → platform default.

Conceptual shape of a capability's AI config:
```
capability: "social_post_generation"
ai_config: {
  model: "haiku-4-5",        // platform default; cheapest that meets quality bar
  cache_prompt: true,         // cache the stable instruction prefix
  batch: true,                // non-real-time — 50% off
  max_output_tokens: 400      // output is 5x input — keep tight
}
```
Change Haiku→Sonnet in config, no code change. One place per capability; can't drift.

---

## 4. Apply the cost framework as the gateway is built (per-capability targets)

> Model choices below are CANDIDATES from the cost framework. Final model = cheapest that meets David's quality bar (his domain call). Usage volumes = David's domain truth to populate.

| Capability | Current | Target model | Cache | Batch | Why |
|---|---|---|---|---|---|
| Discovery — crawl/engine | Sonnet, NO cache | Haiku candidate (extraction) | YES (high token!) | YES (not real-time) | Highest-token, currently uncached — biggest bleed |
| Discovery — synthesis | Sonnet, NO cache | Sonnet (reasoning) or Haiku | YES | YES | High token, uncached |
| Campaign generation | Sonnet, NO cache | Haiku/Sonnet | YES | YES (overnight) | Drafting — Haiku candidate |
| Social post generation | Sonnet, HAS cache | Haiku candidate | YES (already) | YES (overnight) | Already cached — just right-size model + batch |
| Cross-tile "surface between" | (future) | Sonnet | YES | maybe | Customer-quality reasoning |
| AIEngine Ignition tasks (11) | via Railway | per TASK_ROUTING | per task | per task | Migrate transport to Vercel |

---

## 5. PRE-GATEWAY QUICK WIN (do BEFORE the full build — cheap, cuts cost today)

The full gateway is post-demo. But the audit found cost bleeding RIGHT NOW that's a few lines to stop (Doug: couple lines, big value):
- **Add prompt caching to `discovery/engine.ts` and `discovery/synthesis.ts`** — the two highest-token calls, currently uncached. Cache the stable system-prompt prefix (same `cache_control: ephemeral` pattern already working in `social/generate-posts.ts`). 90% off the cached input on your most expensive calls.
- **Evaluate Haiku for discovery extraction + social drafting** — test quality; if it holds, change the hardcoded `claude-sonnet-4-6` → Haiku at those sites. 3x cheaper. (Even as 4 separate edits today, it's worth it; the gateway later makes it 1 edit.)
- These are reversible code changes (git-snapshotted → throttle, per the commit-as-snapshot bright line). Safe to do pre-demo if there's time; otherwise first thing post-demo.

---

## 6. Build sequencing (post-demo, rested — foundational, grandfather-rules)

1. **Quick win first** (§5) — caching on discovery calls, Haiku eval. Cheap, immediate.
2. Generalize AIEngine's routing brain out of the Railway-bound file into a Vercel-serverless shared gateway.
3. Define capability AI-config (platform default + per-business override in `business_modules.config`).
4. Route the four direct calls through the gateway; delete inline model strings + legacy `campaigns/generate.ts`.
5. Add the logging/insight-capture layer (usage, I/O pairs, cost per business).
6. Migrate Ignition's 11 AIEngine tasks onto the Vercel gateway; decommission Railway (Tech Debt #12).
7. Acceptance (STD-002): every AI call flows through the gateway; no hardcoded models; cost logged per call; tenant-isolated; David's result-quality check per capability ("does Haiku's output meet the bar," not just "does it run").

---

## 7. Out of scope / parked
- Multi-provider (AIEngine's TASK_ROUTING has a provider field — gateway could later route to non-Anthropic models; not now).
- The insight-surfacing UI (showing a business their own usage/value) — separate capability; the gateway just CAPTURES the data that feeds it.

---

*Spec as of 2026-06-05. Promote AIEngine's brain onto the Vercel serverless transport; consolidate the four direct calls; model/cache/batch as per-capability config; gateway doubles as cost-control and insight-capture choke point. Quick win (cache the discovery calls) is pre-gateway and cuts cost today. Build post-demo, rested.*
