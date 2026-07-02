# Story-Coverage Gap — capabilities with NO user story (the inverse of MAPS-TO)

**Date:** 2026-06-26 · **Type:** RECON ONLY (read-only; no build, no schema, no code). · **Author:** Thunder
**Sources:** `TRACE-SESSION-BOOTSTRAP.md` (24-CAPABILITY BOARD + ARC MAP) · `user_stories.md` (commit `29487f1`).

> **The question:** the Story Board maps each story → a status-board capability via `MAPS-TO`.
> The inverse — every capability with NO story pointing at it — is now computable and is the
> worklist of "a user story I don't have." This recon surfaces them so David can narrate the
> ones that warrant it, bank the infra ones as no-story-needed, and fix any dangling refs.
> **Recommendation: build nothing.** Narrate / decide.

---

## HEADLINE

- **Coverage is 2 of 24 capabilities** (≈8%). Only **2.3** (walk-and-count) and **4.2** (reconciliation) have a story.
- **6 of the 8 arcs have ZERO stories** — including arcs that are **fully built and owner-proven** (cost-to-produce), the **product north star** (suggestion / Regina Principle), the **demo-critical** front-door, the **live** delivery loop, the discovery substrate, and the security wall. The two arcs with any story are `asset-inventory-pmi` (3 stories) and `ocr-doc-routing` (1, and it has no capability yet).
- **No dangling MAPS-TO** (both referenced ids exist). One story (`Snap a document…`) maps to `—` (no capability yet) — already badge-flagged by design.
- The 24-board is **mostly user-facing by construction**, so the "doesn't need a story" bucket is genuinely small (only **0.1**). The pure-infra capabilities (RLS wall, audit spine, auth chokepoint, the sync slice) live in the **ARC MAP, not the 24-board**, so they don't even show up as gaps — correctly story-less.

---

## STEP 1 — every capability on the STATUS board (the canonical id set)

The 24-CAPABILITY BOARD is the id-bearing source (the ARC MAP pieces are flow-stages — register, invite, reveal, … — that reference these ids, they carry no ids of their own). 25 entries: L0 `0.1` + the 24 (`1.1`–`5.7`).

| id | label |
|---|---|
| 0.1 | Vertical-as-pointer |
| 1.1 | Recognition + discrepancy |
| 1.2 | Sandbox (alive dashboard) |
| 1.3 | Clear→real catalog-populate (D-9) |
| 1.4 | AI-assisted questions→config |
| 1.5 | Handshake (one auth, two products) |
| 2.1 | Cart / QR checkout (no money) |
| 2.2 | Compliance / netting (TX Ch.725) |
| 2.3 | Walk-and-count inventory |
| 3.1 | Leakage / missed-upsell visibility |
| 3.2 | Suggestion engine (at-sale upsell) |
| 3.3 | Post-sale service engine |
| 3.4 | Scheduling (self-book + calendar) |
| 3.5 | Routing / delivery |
| 3.6 | Insights / analytics dashboard |
| 4.1 | QuickBooks (invoice/refresh/source) |
| 4.2 | Reconciliation double-whammy |
| 4.3 | Social media (gen + publish) |
| 5.1 | Inventory management |
| 5.2 | Equipment PMI |
| 5.3 | Water system |
| 5.4 | Greenhouse |
| 5.5 | Seasonal |
| 5.6 | Online shop |
| 5.7 | Contractors portal |

## STEP 2 — every MAPS-TO referenced in `user_stories.md`

Four stories total:

| story | STATUS | ARC | MAPS-TO |
|---|---|---|---|
| Snap a document, let TRACE route it | active | ocr-doc-routing | `—` |
| Count the lot without paper | in-build | asset-inventory-pmi | `2.3` |
| Receive the truck | active | asset-inventory-pmi | `2.3` |
| Reconcile counted vs expected | active | asset-inventory-pmi | `4.2` |

Referenced capability set = **{ 2.3, 4.2 }** (+ one `—`).

---

## STEP 3 — THE DIFF

### A. Capabilities WITH a story (covered) — 2 of 24
| id | label | story/stories |
|---|---|---|
| 2.3 | Walk-and-count inventory | "Count the lot without paper", "Receive the truck" |
| 4.2 | Reconciliation double-whammy | "Reconcile counted vs expected" |

### B. Capabilities with NO story — the GAP — 23 of 24
*(bucketed below — this is the answer to "stories I don't have")*

### C. Dangling MAPS-TO (story → nonexistent capability)
**NONE.** Both `2.3` and `4.2` exist on the board. No typos, no stories-ahead-of-capability.

### D. Stories with MAPS-TO `—` (a need with no capability yet)
| story | note |
|---|---|
| Snap a document, let TRACE route it | The inverse gap (need exists, capability doesn't). Already badge-flagged red in `stories.html` by design. The OCR engine exists (receipt-shaped); **type-inference + fan-out routing is the unbuilt capability** this story names. Candidate to become a new board capability id, OR to map to an existing OCR cap if one is added. David's call. |

---

## CLASSIFYING THE GAP (bucket B) — a recommendation for David, not a ruling

Honest read. The board is mostly features, so most gaps genuinely warrant a story. I have **not** padded the "needs a story" list — the one true infra entry (0.1) is called out, and the borderline ones are marked UNCLEAR rather than forced into "needs."

### B1 — LIKELY NEEDS A STORY (user-facing; a day-in-the-life would add real context)

| id | label | one-line why | arc home |
|---|---|---|---|
| 1.1 | Recognition + discrepancy | Owner enters their business; TRACE recognizes it from the website + surfaces conflicts — the front-door "we already know you" moment. | front-door (EMPTY) |
| 1.2 | Sandbox (alive dashboard) | The "dashboard is alive on arrival, not an empty shell" experience. | front-door (EMPTY) |
| 1.3 | Clear→real catalog-populate | "TRACE read my site and filled my catalog with my actual plants" — a literal wow moment. | discovery (EMPTY) |
| 1.4 | AI-assisted questions→config | "It asked me a few questions and set itself up." | front-door / discovery |
| 2.1 | Cart / QR checkout | The core sale flow (scan → cart → checkout, no money) — the demo spine. **No home arc** (see flag below). | — (no arc) |
| 2.2 | Compliance / netting | The Regina netting prompt at checkout — *the* emotional anchor of the whole product. | suggestion (EMPTY) / checkout |
| 3.1 | Leakage / missed-upsell | Owner sees the upsells that walked out the door. | suggestion (EMPTY) |
| 3.2 | Suggestion engine (at-sale) | The Regina Principle / product north star. Highest-value missing story. | suggestion (EMPTY) |
| 3.3 | Post-sale service engine | The warranty / follow-up touch after the sale. | suggestion (EMPTY) |
| 3.4 | Scheduling (self-book) | Customer books a slot themselves. | suggestion / delivery |
| 3.5 | Routing / delivery | Owner routes the day's deliveries (live capability, no story). | delivery (EMPTY) |
| 3.6 | Insights / analytics | Owner sees what the data is telling them. | suggestion-adjacent |
| 4.3 | Social media (gen) | Owner generates social posts from their own data. | suggestion-adjacent |
| 5.2 | Equipment PMI | Owner gets "this machine is due" before it breaks. | asset-inventory-pmi |
| 5.6 | Online shop | Customers buy online (may reuse 2.1). | — / checkout |
| 5.7 | Contractors portal | The contractor-tier buyer's view. | — |

**Future-vertical needs (genuine, but aspirational — nothing built; a story would define the need, not narrate a built thing):**

| id | label | note |
|---|---|---|
| 5.3 | Water system | net-new vertical capability — story = define the future need |
| 5.4 | Greenhouse | net-new — same |
| 5.5 | Seasonal | net-new (tile stub) — same |

### B2 — LIKELY DOESN'T NEED A STORY (infra / plumbing — "as a user I want…" is forced)

| id | label | why no story | recommended disposition |
|---|---|---|---|
| 0.1 | Vertical-as-pointer | The `business_type` + registry mechanism that makes one codebase serve many verticals. Architecture, not a lived owner moment. | Bank as a DECISIONS / arc-map infra note ("infra, no story needed") rather than authoring a forced story. |

*(Also worth recording: the genuinely infra capabilities — RLS wall, audit spine, auth chokepoint, the offline-sync slice — live in the **ARC MAP**, not the 24-board, so they never appear as story gaps. That's correct: they should stay story-less.)*

### B3 — UNCLEAR (David decides)

| id | label | the tension |
|---|---|---|
| 1.5 | Handshake (one auth, two products) | Identity plumbing with a thin but real user moment ("I didn't have to sign up twice"). Story or infra-note — David's call. |
| 5.1 | Inventory management | The broad inventory CRUD. Partly shadowed by the 2.3 stories (which are inventory-flavored). Could fold into the existing `asset-inventory-pmi` arc stories rather than get its own. |

---

## TWO STRUCTURAL FLAGS (surfaced, not for me to fix)

1. **No arc home for the checkout/sale flow.** `2.1` (QR checkout), `2.2` (netting), and arguably `5.6` (online shop) have no matching arc among the canonical 8 (front-door · ocr-doc-routing · cost-to-produce · suggestion · delivery · discovery · identity-roles-sec · asset-inventory-pmi). When David narrates these, they need either a 9th arc (e.g. `checkout-sale`) or an explicit assignment to an existing one. Recording so it's a deliberate choice, not a parse failure.

2. **Six empty arcs, several over built capability.** `cost-to-produce` is owner-proven end-to-end yet has no story; `suggestion` is the north star yet has no story; `delivery` is live yet has no story; `front-door` is the demo-critical promotion yet has no story. The Story Board's value (the "building toward" lens) is currently blind to the parts of the platform that are most built and most strategic. The biggest narration ROI is here, not in the future-vertical stubs.

---

## THE WORKLIST (what David does with this — nothing gets built)

1. **Narrate** the B1 stories that matter most first — the empty high-value arcs: `suggestion` (3.2/3.1/3.3), `front-door` (1.1/1.2/1.4), `discovery` (1.3), `delivery` (3.5), `cost-to-produce` (currently 0 stories), plus `2.2` netting (the Regina anchor) and `5.2` PMI.
2. **Bank** `0.1` as an infra "no story needed" note (and leave the ARC-MAP infra correctly story-less).
3. **Decide** the B3 two (`1.5`, `5.1`) and the two structural flags (checkout arc; future-vertical stubs — narrate-the-need vs defer).
4. **Fix nothing dangling** — there are no dangling MAPS-TO.

**Build recommendation: NONE.** This is a narration/decision worklist, not an engineering task.
