# Runbook: Cultivar User Stories Capture
**Date:** 2026-06-03  
**Type:** Process notes for user stories document creation  
**Status:** Complete ✅

---

## What this runbook is

Process notes for the creation of `docs/user-stories/cultivar-flows-and-contractor-program-2026-06-03.md`. That file is the primary artifact. This runbook captures why the document was created, how to maintain it, and how future product development sessions should reference it.

---

## What the user stories document captures

Working specifications for five Cultivar OS areas:

1. **Delivery module configuration** — owner-configured delivery schedule, customer-facing slot selection, geolocation-aware routing
2. **Contractor onboarding and verification** — registration form, owner review, tier assignment, notification
3. **Contractor program monetization** — three options (free, paid, tiered), recommendation to ship free first
4. **Online customer purchase flow** — inventory browse, pricing gate, cart creation, just-in-time offerings, payment
5. **In-person customer flow (LAWNS experience)** — QR scan, geolocation pricing, multi-tree cart build, pay-in-office sync

Each section includes implementation notes pointing to the current gap in built-inventory.md and/or the relevant existing code.

---

## docs/user-stories/ directory

This document created the `docs/user-stories/` directory. Future files of this type — product specifications that describe intended behavior before implementation — belong here.

**Not for:**
- Discovery evidence with receipts or market data (→ `docs/discovery/`)
- Audit findings about current codebase state (→ `docs/audits/`)
- Runbooks for setup operations (→ `docs/runbooks/`)
- Strategy or operating philosophy (→ `PLATFORM_STRATEGY.md` or `THOUGHTS.md`)

**For:**
- User stories with specific flows describing intended UX
- Configuration specifications
- Feature design intent that will guide implementation
- Anything that answers "what should this do?" rather than "what does this do?"

---

## How to maintain the user stories document

**Update in place.** Do not create a replacement document when product thinking evolves. Revise the sections directly. Add a note at the top of any revised section indicating the revision date and what changed.

**When a section is implemented:**
1. Add an implementation note to the relevant section: "Implemented 2026-XX-XX — see [file path]"
2. Update `docs/built-inventory.md` to mark the feature as built and reference this document
3. Do NOT remove the user story from this document — it serves as the spec that implementation was verified against

**When an open question (Section 9) is resolved:**
1. Update Section 9 to show the resolved question and the decision
2. Update the relevant flow section with the resolved design decision

---

## How product development sessions should reference this document

When a Claude Code session is implementing a feature described in this document:
1. Read the relevant section before writing code
2. Note any spec gaps or ambiguities and surface them in the session summary
3. After implementation, update the section with implementation notes
4. Update built-inventory.md

When PLATFORM_STRATEGY.md or PLATFORM_AUDIT.md reference these features, they should cite this document rather than re-describing the flows. Cross-reference format: "See docs/user-stories/cultivar-flows-and-contractor-program-2026-06-03.md Section N."

---

## Conflicts identified during document creation

A conflict search ran across PLATFORM_STRATEGY.md, PLATFORM_AUDIT.md, and docs/built-inventory.md before creating this document. Findings:

- **No contradictions found.** The new user stories specify intended behavior; existing docs describe current state.
- **Touch points documented** in the "Conflicts and reconciliation needed" section at the bottom of the user stories document: PLATFORM_STRATEGY.md Phase 3 mention, PLATFORM_AUDIT.md contractor_tiers entry, built-inventory.md Online Shop stub and delivery gaps.
- **No edits made** to existing documents — conflicts were flagged for David's review per task instructions.

The PLATFORM_STRATEGY.md Phase 3 mention will need a cross-reference added when contractor portal enters active development. That update belongs in the implementation session, not here.

---

## What's not yet specified

These areas are adjacent to the user stories document and will need specification eventually:

- **Pay-in-office sync mechanism** — how the customer's mobile cart reaches Lauren's screen (Section 9, open question 4)
- **Contractor program pricing model selection** — Section 4 gives three options; Option A is recommended to ship first, but the decision to move to B or C needs a volume trigger defined
- **Annual contractor loyalty bonuses** — Section 9, open question 1
- **Multi-tree cart limits** — Section 9, open question 6

---

*Per CLAUDE.md Part 9, Step 12 (runbook capture).*
