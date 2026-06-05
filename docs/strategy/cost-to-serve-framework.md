# FRAMEWORK — Cost-to-Serve Codification & Defensible Pricing

**Date:** 2026-06-05
**Status:** Framework + populated with researched API costs (verified ~April–May 2026). Numbers will drift — re-verify against platform.claude.com/docs/en/about-claude/pricing before committing to customer prices.
**Origin:** David — "if we know a cost is coming, bake it into the equation so margin doesn't get bitten. Costs must be identified and codified so we have a defensible position on pricing."

---

## The principle

Every capability has a **true cost-to-serve**, and price must be derived from that cost — including costs not billing yet but coming at scale. A defensible price is one where you can point to the cost stack underneath and show **margin holds at realistic scale**, not just at free-tier. Pricing on free-tier cost is a margin trap: the customer locks into a price (founding rates — structurally permanent for TRACE), your cost rises as they use the capability more, and margin thins exactly as you succeed. Grandfather principle: do the cost engineering right the first time; re-pricing locked-in customers later is brutal and you've committed not to.

---

## The cost stack — every capability is priced on ALL of these

1. **Infrastructure-fixed** — tier costs spread across all customers/capabilities. Vercel Pro (~$20/seat/mo, required once commercial — Hobby is non-commercial-use-only), Supabase Pro (when free tier outgrown). Low per-unit; real.
2. **Infrastructure-usage-scaled** — DB rows/storage/bandwidth (Supabase), serverless invocations/bandwidth (Vercel). Grows with how much a customer uses the capability.
3. **AI / inference (THE DANGEROUS ONE — see below)** — per-call Claude API cost, scales directly with usage. Invisible in dev (pennies), material at customer scale.
4. **Third-party adapter** — Ayrshare ($599/mo type). Customer-borne via adapter slot, but MUST be in the equation so the customer sees the true cost of that capability.
5. **Human/support** — onboarding time, support. Not zero, especially early.

---

## AI inference costs — REAL NUMBERS (the lever that decides margin)

### Base rates (per million tokens, MTok), verified ~April–May 2026
| Model | Input | Output | Use for |
|---|---|---|---|
| **Haiku 4.5** | $1.00 | $5.00 | High-volume: classification, routing, extraction, summarization, moderation. 5x cheaper than Sonnet, 25x cheaper than Opus. |
| **Sonnet 4.6** | $3.00 | $15.00 | Default for most production workloads. Best price/quality. |
| **Opus 4.7** | $5.00 | $25.00 | Reserve for requests that justify the premium (complex reasoning). |

- Output is **5x input** across all models — output length is a real cost driver, keep generations tight.
- Opus 4.7 new tokenizer: up to **35% more tokens** for same text vs 4.6 — benchmark before assuming Opus-4.6 costs.

### The two levers that cut cost up to ~95% (ARCHITECT FOR THESE)
- **Prompt caching: cached input = 0.1x base** ($0.10 Haiku / $0.30 Sonnet / $0.50 Opus per MTok). Cache reusable content — system prompts, capability instructions, few-shot examples, shared context. 5-min TTL resets on each hit. Cache write costs 1.25x (5-min) or 2x (1-hr) base input once. → **Any capability with a stable instruction prefix should cache it.**
- **Batch API: flat 50% off all tokens**, results within 24hr. → **Any non-real-time capability (overnight social-post generation, bulk analysis, discovery runs that can wait) should batch.** Real-time customer-facing (live checkout) cannot.

### Metered costs BEYOND tokens (don't miss these)
- **Web search: $10 per 1,000 searches** (does NOT include tokens to process results). → Discovery engine crawling sites: if it web-searches, that's on top of tokens.
- **Code execution: 50 free hours/day per org, then $0.05/hr per container.**

### Real-world anchor (workload shape close to TRACE capabilities)
A support-style workload of **10,000 responses/month at ~2K input + 500 output tokens each**, with **70% cached input**, runs **~$76/mo on Sonnet** (per claudeapipricing.com). Without caching it's multiples higher. → caching is the difference between thin and healthy margin.

### Model-selection = your biggest cost lever, mapped to capability type
- **Haiku** for: discovery extraction, classification, social-post drafting, routing, summarization. (Most "routine" capability AI.)
- **Sonnet** for: default capability reasoning, cross-tile "surface the between," anything customer-quality-facing.
- **Opus** for: only the genuinely hard reasoning that justifies 5x Sonnet. Probably rare in TRACE per-customer ops.
- **Do NOT pay flagship prices for routine capability work.** Pick the cheapest model that meets the quality bar per capability.

---

## How this attaches to the architecture (clean — capability IS the cost unit)

The `business_modules` / capability model is already the right place to hang cost. The capability is the unit of value, composition, AND cost. Each capability record should carry a **cost-to-serve profile**:
- which model it calls (Haiku/Sonnet/Opus) and whether it caches / batches
- estimated tokens per invocation (input + output)
- estimated invocations per customer per month (USAGE — David's domain estimate)
- any web-search / adapter / metered cost
- → computed monthly cost-to-serve per customer
- → set price; margin = price − cost-to-serve; check margin holds.

---

## Per-capability cost worksheet (POPULATE with real usage estimates — David's domain)

> Lightning supplied the rate structure. **The usage volumes (invocations/customer/month, tokens/call) are David's domain truth — Lightning will pattern-match them wrong. Fill from real/expected customer behavior.**

| Capability | Model | Cache? | Batch? | ~Tokens in/out per call | Calls/cust/mo | Web search? | Est. $/cust/mo | Price | Margin |
|---|---|---|---|---|---|---|---|---|---|
| Discovery engine | Haiku/Sonnet? | prefix yes | yes (not real-time) | ? | ~1 per onboard | maybe ($10/1k) | TBD | | |
| Social post generation | Haiku? | yes | yes (overnight) | ? | ? /wk | no | TBD | | |
| Cross-tile "surface the between" | Sonnet? | yes | maybe | ? | continuous? | no | TBD | | |
| Campaign generation | Haiku/Sonnet? | yes | yes | ? | ? | no | TBD | | |
| QR checkout / QB invoice | none (no AI) | — | — | — | — | — | infra only | | |
| AIEngine device ID | Haiku? vision | ? | ? | ? | ? | no | TBD | | |

(Capabilities with no AI call — checkout, QB, tiles — carry only infra cost, near-zero per-unit.)

---

## The defensible-pricing rule

1. For each capability, fill the cost stack at **realistic customer-scale usage** (not dev/free-tier).
2. Choose the **cheapest model + caching + batching** that meets the quality bar — that's the cost-engineering.
3. Price = cost-to-serve + target margin. **Verify margin holds at the HIGH end of expected usage**, not the average (the heavy user is who thins your margin).
4. Codify the cost profile IN the capability record so the price is **defensible** — you can show the stack.
5. Adapter-borne costs (Ayrshare) shown to customer as the true cost of that capability; not absorbed into base.
6. Re-verify API rates before committing customer prices (rates drift; this doc dated 2026-06-05).

---

## The one urgent action (demo-relevant)

Before pricing ANY capability that calls Claude, get a **realistic per-customer monthly token estimate** for it at production usage. The AI-inference line is the cost most likely to silently turn a healthy-looking margin negative at scale, because it's pennies in dev. Discovery, social generation, cross-tile AI = the metered-cost capabilities. They need a usage estimate before they get a price. Caching + batching + right-sized model (Haiku where it suffices) is what keeps them cheap — architect for those from the first build (instrument-first / Doug: a few lines, big value).

---

*Framework as of 2026-06-05. Rates researched, verified ~April–May 2026 — re-verify before customer commitments. Usage volumes are David's domain truth to populate. Lightning supplies structure + rates; David supplies the reality of how much customers actually use each capability.*
