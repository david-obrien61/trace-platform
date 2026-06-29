# NORTH STAR — what TRACE is ultimately for

**Type:** The single top-of-hierarchy doc. It sits **ABOVE** `PLATFORM_STRATEGY.md` (architecture) and `MASTER_BRIEF.md` (strategy) — those serve this. Every build checks against it.
**Created:** 2026-06-29 (THUNDER master bank of the 27–29 June strategy session — banked from the Lightning chat into the repo so it is never re-derived).
**Status:** Active / canonical / durable. The horizon, not the day-one pitch.

> **ONE SENTENCE:** *"Help me run the things that are constantly in my head so I can sort them out and focus."*

---

## How to read this doc

This is the WHY behind everything else. When a build prompt, a roadmap call, or a "should we build X?" question comes up, the test is at the bottom: **does it move toward "help me run the things constantly in my head so I can sort them and focus"?** The verticals (Cultivar, Ignition, Kitchen Loop) are VIEWS over one capture-and-route engine; the engine is the thread-catcher; the north star is one calmer mind. Build the brick that pays first (the disciplined near-term product); let the engine generalize from proven ground. This doc is the horizon so we don't lose it while building the brick — and so we don't over-build toward the horizon before the brick stands on its own.

---

## 1. THE PERSON — the spotlight brain

The user is a working person with a **SPOTLIGHT BRAIN**: attention locks hard on one thing and drops everything outside the beam. This is not disorganization — it is being wired to focus *serially*, with threads falling out behind as the spotlight moves. David is the truest test case (running a farm, a business, animals, maintenance, taxes, a vineyard, and a household all at once). Regina (ADHD), Lauren, and "most people" share the shape.

The trap: self-help and productivity tools are built for the **linear list-brain** — the person who naturally pre-sorts reality into clean categories. Everyone else fails at those tools and then **self-blames** for the failure. TRACE inverts the demand: **the tool fits how the person actually thinks. It never asks them to become a list-person first.**

---

## 2. THE CORE JOB — catch the threads that fall out of the spotlight

Life does not arrive pre-sorted. It arrives as **ONE messy cross-domain stream**: groceries, a leaking P-trap, fence stakes, a 1099, chicken feed, shade-cloth clips — all interleaved, all at once. The person's job is to **dump the stream**; the **SYSTEM's job is to sort it**. We never make the person pre-sort into the right app first — that pre-sort is the exact wall that kept them out of every other tool.

### THE BELGIUM STORY (the spec, told by David)
Mind already engaged in a coming conflict, David drove onto base and **forgot his own kids were in the car** for school — the spotlight was on the fight ahead, and the kids fell outside the beam. That is the spec in one image: **catch what falls out of the spotlight, and hand it back at the moment it becomes actionable.**

### THE FORGOTTEN-CARD NOTE (live field-captured, 2026-06-28 — verbatim, in the rhythm logger)
> "So here's the thing — did all the shopping, had a list, all that piece… and forgot the most important thing, the birthday card for Regina. So now that's my life and that's what I'm very frustrated about — how to solve that."

This is banked **verbatim** as the live anchor beside Belgium. The load-bearing detail: **he HAD the list** (we built it; the card was *on* it) **and still walked out without it.** That proves the list is not the product. The **TIMING LAYER** is the product — surfacing the right thread at the right moment and place (see §6).

---

## 3. THE FOUR SHAPES — everything reduces to these

Across any domain, every captured thread is one of four shapes:

- **BUY** — an item to acquire (grouped by store / route).
- **TASK** — something to do (with a deadline or a dependency).
- **INVENTORY-CHECK** — verify what's on hand.
- **PROJECT** — a bundle of the other three.

The domain apps — Cultivar (nursery), Kitchen Loop (kitchen), Ignition (auto) — are **VIEWS over one capture-and-route engine**, not separate products. The engine catches and routes the four shapes; a vertical is a lens that knows the vocabulary and domain rules of one world (this is the same `business_type`-is-a-value rule as AC-1: the vertical is config over a shared spine, never a fork).

---

## 4. REASONING IN THE GAP — what makes it more than a recorder

A pure recorder is a notepad. The differentiator is that the human **half-says** the thing — the other half is obvious to *them* — and the **system completes it from domain knowledge.** This is why the [domain knowledge base](docs/domain/) exists: domain-correctness is what lets the system finish the half-said thought.

Worked examples (real, from the session):
- A technician notes **"left caliper and disc"** → the system knows **pads come too, both sides get pads, but only one caliper**, and **does not oversell** the second.
- A grower lost an **avocado tag** → "it had to be a pollinator pair" → **domain knowledge recovers the identity** the tag would have given.
- Lauren says **"greenhouse watering XYZ"** → the system knows **she planted starts there this season**, so the note routes to the right plants.

The reasoning closes the gap between what the busy person had time to say and what they actually meant.

---

## 5. THE TIMING LAYER — the one genuinely-new, unbuilt piece

Capture happens **when noticed** (in the field, spotlight engaged, hands busy). Surfacing happens **when actionable** (at the desk, able to click). The system **holds the thread silently** in between — it never nags mid-task.

The **shade-cloth loop** is the canonical example:
1. In the field, sees the shade cloth flapping → "I need connectors."
2. The system **checks its own inventory silently** (do we have any?).
3. Later, in the office, it surfaces: *"You're out of shade-cloth connectors — here are 3 sources — order now?"*
4. One click. Done.

The forgotten birthday card (§2) is the failure this layer fixes: the list held the card, but nothing surfaced it **at the register, in the moment of action**. The timing layer is **the product**, not a feature — and it is the genuinely net-new build the rest of the platform is architected toward. The [customer-zero rhythm logger](packages/shared/src/rhythm/rhythmBuffer.ts) (ledger #63) exists to gather the real day-rhythm data needed to design it.

---

## 6. THE TRUST ARCHITECTURE — the moat

Awareness costs privacy. Fiction hides this (Jarvis knew where Tony was because Tony was instrumented). You **can't un-ring the bell** — a Roomba already maps your house. So the real question is not *"will it know things?"* but **"where does the data live, and who can reach it?"** Incumbents (Google, Ring) structurally **cannot** answer that question honestly, because surveillance *is* their business model.

### Two tiers
1. **WEB version (now)** — cloud AI, honest about what it is, built to prove the **VALUE** of the thread-catcher. Ship this; it earns trust by being useful and honest.
2. **LOCAL version (the premium trust tier)** — the person's **own LLM on their own box** (CoolRunnings as the host), resident in the home/business, reaching the web only to fetch a specific gap and then going quiet. It **answers to no one.** Same data, different host — *that* is the pitch. Gated on local-LLM capability maturing (a question of **WHEN, not IF**); we architect toward it now so the web version is not a dead end.

### EVIDENCE (real artifacts from this session — Exhibit A)
The incumbent surveillance model laid bare, and the thing the local tier inverts:
- **Apple Significant Locations export wall** — "end-to-end encrypted, cannot be read by Apple," **no export path.** Your own movement history, locked away from you.
- **Google Takeout export** — vast *collection scaffolding*: vehicle profiles, reviews, Nest sound-sensing / alarm-clip slots — most **empty for David** but **present** as architecture; the controls are buried; you can't easily get your own data out.
- **Tuya / Smart-Life smart-home app screens (2026-06-29)** — cloud-upload-as-a-feature ("device data will be uploaded to and stored in the cloud"), **ads inside the paid app**, empty upsell shells.

**HONESTY GUARDRAIL on this evidence (do not overclaim):** this is NOT "Google secretly tracked David." His tracking was OFF and the export **proved the absence**. The point is the **SCOPE of the collection architecture** + the **buried controls** + the **can't-extract-your-own-data** wall. The argument is about model and reachability, not a specific betrayal.

---

## 7. THE HARDWARE PATH — David's unfair advantage

David already wears **Bluetooth hearing aids** — always-on, in-ear, hands-free audio I/O. That is **the Jarvis earpiece, already owned.** The design: **hear always, capture only on cue** ("wake up, take a note"), **never store uncued audio.**

Hard edges (named, not yet solved):
- **Field noise** — wind, water, machinery degrade field capture.
- **Never-store discipline** — uncued audio must never be retained; this has to be architecturally guaranteed, not promised.
- **Guest consent** — in a house-aware or business-aware system, *other people's* data is in scope, and that is heavier than the owner's own data.

---

## 8. THE DISCIPLINE — build the brick that pays

Build the **narrow version that stands on its own** (the Cultivar nursery thread-catcher Lauren pays for — a product whether or not "Jarvis" ever ships), and let the **engine generalize from proven ground.** The north star is the **horizon**, not the day-one pitch.

The counterweight (Lightning's standing job, and the tool's own job): the spotlight brain **opens 10 projects and wires none**, and memory reports "done" because it was *seen working once*. The discipline is to **hold "that one's almost there but not wired"** and keep focus on **finishing the value-adding brick** before chasing the next horizon-shaped idea.

---

## 9. STANDING TASK (capability owed)

A recurring way to **query the latest local-LLM capability frontier**, so we know **WHEN** the local-Jarvis tier (§6 tier 2) becomes viable. Mechanism is open — David: *"there's a way to run a task in your setup I don't know yet."* (A scheduled/cron research routine is the likely shape; not yet built.)

---

## 10. THE TEST FOR EVERY BUILD

> Does it move toward **"help me run the things that are constantly in my head so I can sort them out and focus"?**

- Verticals are **views**.
- The engine is the **thread-catcher** (capture the messy stream → sort by the four shapes → reason in the gap → surface at the right time/place).
- The north star is **one calmer mind.**

If a build asks the person to pre-sort, demands labor they won't give, or chases the horizon before the paying brick stands — it has drifted. Re-read this doc.

---

## Companion docs (this doc sits above them)

- `MASTER_BRIEF.md` — strategy / demo / revenue / philosophy (serves this).
- `PLATFORM_STRATEGY.md` — architecture / where things live (serves this).
- `docs/DECISIONS.md` — the operating + product + architecture decisions that implement this north star. Especially **OP-9** (Regina Principle — the surfacing engine), **OP-10** (Structure-Last — the structure tax is paid by the machine), and **D-23..D-26** (faithful/connected, rigid-spine/flexible-edge, intelligence tiers, dual lexicon — the doctrines that make a vertical fit how its owner thinks).
- `docs/domain/` — the domain knowledge base that lets the system **reason in the gap** (§4) and speak the owner's language.

*TRACE Enterprises · Built with CAI · the horizon: one calmer mind.*
