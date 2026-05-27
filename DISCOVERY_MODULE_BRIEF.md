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

## TRACE — Who We Are

TRACE is a family. Terrence, Regina, Andrew, Connor, Erin. We named the company after ourselves around a kitchen table, because what we are building is meant to last longer than any one of us and meant to belong to all of us.

Who builds it today. David O'Brien — Terrence — is the builder today. 23 years 9 months military service, 30 years federal service in knowledge management, a lifetime as an electrician, mechanic, and builder. He writes the platform working with Claude and Claude Code as engineering partners. Andrew lives in the house and builds his own products alongside David. He established TRACE's foundation — set up Git, GitHub, Supabase, and Railway, and the working stack TRACE runs on. Before that setup, code was being lost. After it, every commit was preserved. The velocity that followed is built on the substrate Andrew laid down. Erin also lives in the house when she's not on travel nursing assignments; she's currently on an ER rotation in California. Connor visits regularly from out of state and is on call by video any time the work needs him. Regina is the program director at Operation Liberty Hill, the anchor pilot customer for KINNA-OS, and the voice the platform answers to on what it means to treat people as kin.

The five of us are not yet all on payroll. We are a family company in formation. The founder builds; the family is within reach; the runway to bring everyone in is what we are building toward.

The craft. Every TRACE product is Built with CAI — our signature on the work. The signature is literal: this software is built with composable AI as the engineering partner, used carefully, used well, used by people who know what good work looks like because they've done it with their hands for forty years.

The product line. We don't sell platforms. We sell the operating system for your kind of business: Cultivar OS for nurseries and garden centers, Ignition OS for diesel and auto repair shops, Conduit OS for HVAC, plumbing, and electrical, KINNA-OS for community nonprofits, CoolRunnings for homes. Each is its own product. Each is also part of the same family of software underneath — the way a small dedicated family ships fast and stays consistent.

The silent partner. We are not here to replace what you have. You already have QuickBooks, or Square, or Neon One, or a notebook full of phone numbers. You already have a business that works. What you don't have is enough hours in the day, and the gaps between your tools are where your time and your money are leaking out.

We come alongside, quietly. We connect what you already use. We fill the gaps no one else fills. We give you back your evenings. Your customers see you — not us. We are the silent partner that powers you to soar. For nonprofits, that partnership often shows up as "Powered by KINNA" — a quiet credential visible to funders and peers. For commercial businesses, it usually doesn't need a label at all. The OS is just the tool you use to run your day, made by a family who built it because they needed it themselves.

The one-sentence version: We don't replace your systems. We connect them, surface what matters, and fill the gaps you couldn't fill yourself.

*The discovery surface exists in service of this philosophy.*

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
