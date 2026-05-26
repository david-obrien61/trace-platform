# DISCOVERY_MODULE_BRIEF.md

> *Placeholder document. The discovery surface needs dedicated thinking that hasn't happened yet. This file captures what's settled as of 2026-05-26 and explicitly lists what's not.*

## Scope & Hierarchy

This document is the canonical home for the discovery module — TRACE's customer-acquisition front door. Right now it is intentionally a placeholder: enough to anchor the file in the repo, name what's settled, and flag what isn't.

When this doc conflicts with another:
- For platform architecture, see PLATFORM_STRATEGY.md
- For strategy, philosophy, revenue, see MASTER_BRIEF.md
- For current code state, see TRACE_PLATFORM_AUDIT.md
- For session handoff and infrastructure, see CLAUDE.md

The dedicated discovery session — whenever it happens — opens with this file, confirms the settled items still hold (or makes small modifications), and then builds out the deferred items.

## TRACE Philosophy

*Inherited from MASTER_BRIEF.md / PLATFORM_STRATEGY.md / TRACE_PLATFORM_AUDIT.md. The discovery surface exists in service of this philosophy.*

## What's Settled (as of 2026-05-26)

These items are settled enough to commit to writing. They are open to small modifications in the dedicated discovery session but the structure is intentional.

**Thesis.** Discovery is TRACE's front door. The hook is composable AI; if the first thing a prospect experiences is a static intake form, the hook fails on contact. The discovery surface must demonstrate composable AI on contact, not describe it.

**Reciprocity.** Most B2B SaaS discovery experiences are extractive — they take information and disappear. This one is reciprocal: the customer leaves with concrete insight about their own operation, regardless of whether they engage further with TRACE.

**Five-layer architecture (named, not specified).**
1. Customer Surface — `packages/discovery-surface/`
2. Question Bank — `packages/discovery-config/`
3. Conversation Orchestrator — `packages/discovery-engine/`
4. Voice Pipeline — `packages/discovery-voice/`
5. Synthesis — within the orchestrator package

Detailed layer specifications, package contents, and inter-layer contracts are deferred to the dedicated discovery session.

**Deployment.** discovery.builtwithcai.com (subdomain of existing domain, no new purchase needed).

**v0 scope and timing.** Three weeks from 2026-05-26. Layers 1 and 4 only, plus a basic founder review surface at /admin where David can see transcripts. No question bank, no orchestrator beyond a hardcoded flow, no synthesis. The point of v0 is to prove the voice-record-transcribe-and-review loop works end-to-end before investing in the more sophisticated layers.

**v0 user.** Regina O'Brien is the intended v0 user *if her exit timeline at OLH and the v0's quality align*. If either condition isn't met, v0 is internal testing only and Regina sees a later version.

**Voice primary, text fallback.** Voice is the default input mode. Text input is available via a toggle for situations where voice isn't practical.

## What's Deferred to the Dedicated Discovery Session

Everything below needs deep thinking that hasn't happened yet. Listing it here so it doesn't get lost.

- Question bank content for KINNA-OS (the ~30 questions for community-nonprofit vertical)
- Question schema (YAML structure: id, intent, naturalLanguagePrompt, followUpHeuristics, contributesTo, skipIf, etc.)
- Detailed UX specifications (screen layouts, interaction patterns, exact copy)
- Output artifact format (the "what we learned" customer summary)
- Founder review surface beyond v0 (the full /admin/sessions/[session-id] view)
- The Neon One connector demonstration moment ("show them their own data" inside the session)
- Synthesis prompt patterns (how Claude turns session state into the customer summary and founder config)
- Build plan beyond v0 (when Layers 2, 3, 5 come online; what triggers each)
- Success criteria for v0, v1, and beyond
- How v1 question banks coordinate across verticals (shared questions vs vertical-specific)
- Connector pluggability architecture (the interface that lets Neon One be swapped for QuickBooks or another platform in future verticals)
- v1 stack choices that go beyond v0 (whether Whisper API stays primary, Claude synthesis details, Supabase schema for sessions, magic-link auth flow)

## Cross-References

The discovery surface fits into the broader TRACE platform. Decisions affecting it should be made with awareness of:

- **MASTER_BRIEF.md** — for the strategic role of discovery as a customer-acquisition surface and the relationship to the customer roster
- **PLATFORM_STRATEGY.md** — for how the discovery packages fit into the broader monorepo architecture and the Surface Honesty and Honest Friction design principles that apply to its UI and development workflow
- **TRACE_PLATFORM_AUDIT.md** — for current code state of any discovery-related work
- **CLAUDE.md** — for current infrastructure (Supabase project, env vars, domains) and open architecture decisions affecting discovery
