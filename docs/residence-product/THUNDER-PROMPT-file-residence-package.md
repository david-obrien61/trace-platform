THUNDER — file the Residence Product design package into the repo. DOC SETUP + reconciliation.
No app code, no schema migration yet (this stands up docs + logs decisions only).

STEP 0 GATE first: read CLAUDE.md in full; echo the three Session Starter checks (last
session's handoff; which shared modules this touches + that packages/shared/src/ was checked;
current Off Limits / Part 7). Confirm before proceeding.

CONTEXT: A long Lightning design session produced the "Residence Product" (household
operations — the residence as the smallest business, residence-scoped view of the one shared
engine). The design files exist as scratch (Lightning output) and need to become canonical
repo docs. CRITICAL: this package must RIDE ON existing locked doctrine, not restate or
redecide it. Reconcile against the repo as you file — the audit/live code wins on any conflict.

=== PART 1 — VERIFY existing doctrine before filing (don't trust the summary; check the repo) ===
Confirm these in the actual repo and note exact names/locations so the residence docs point at
them correctly:
1. Schema naming convention (expected: ~80% shared tables NO vertical noun e.g. `receipts`;
   ~20% vertical-specific carry a prefix growers_/shop_/trades_). Confirm the real convention
   + the real residence/household layer prefix if any.
2. Receipt Keeper — confirm it exists and WORKS (David confirms it works; mobile-device OCR
   needs work). Note the real table name(s) and component path. Residence product WIRES to it,
   does NOT rebuild it.
3. Shared multi-tenant auth + RLS — confirm built/deployed; residence inherits it.
4. PIN gesture standard — confirm it's the platform-wide auth gesture; residence references it.
5. "One source, many views" — confirm the locked architecture (one DB, one engine, one app
   skinned at runtime; .app domains = entry-point pointers, not separate apps).
6. The local-first logic in DataBridge — confirm where it lives. NOTE: the plan is to PULL THE
   LOGIC/PATTERN into a shared offline capability, NOT extract the DataBridge module wholesale.
   (David's wording: "pulling logic out, not extraction of a module.")
7. Apple value anchor + Surface Honesty — confirm these are logged design principles.
Report what you found vs. what the package assumed; flag any mismatch BEFORE writing.

=== PART 2 — Create the residence docs home + file the package ===
Create a residence-product docs home (match existing doc structure — likely under docs/ or a
RESIDENCE-PRODUCT/ folder; you decide per repo convention). File these (provided by Lightning;
adjust only to match verified names from Part 1):
- RESIDENCE-PRODUCT-MASTER-BRIEF.md  (the front door — put the platform philosophy paragraph
  at top like the other canonical docs)
- DESIGN-FOR-THE-MESS.md
- DESIGN-AND-TRUST-STANDARD.md
- RESIDENCE-PRODUCT-BUILD-PLAN.md
- ACQUISITION-INTELLIGENCE-SPEC.md
- REPURCHASE-CHOICE-SPEC.md
- INGREDIENT-FORM-AND-CONVERSION-SPEC.md
- INVENTORY-INPUT-AND-HEALTH-CARD-SPEC.md
- HOUSEHOLD-SHARING-DECISION.md  (note inside: multi-tenancy is inherited from existing shared
  auth, treated at P0, not a late build)
As you file, FIX any naming that conflicts with Part 1 findings (esp. table names: use the real
`receipts` etc., NOT a `business_` prefix Lightning may have used). The master brief already
contains a reconciliation note pointing at locked doctrine — keep it accurate to what you found.

=== PART 3 — Log the platform decisions from this session into the GENERAL decision log ===
Verify current highest D-number; assign next ones in sequence (don't hardcode). Add to
MASTER_BRIEF.md decision log (cross-ref PLATFORM_STRATEGY.md where architectural):
1. API NEUTRALITY — use any API that makes the answer more honest/effortless; refuse any whose
   price of admission is bias. Green (neutral utilities) / Red (single-retailer data buying
   loyalty) / Amber (retailer featuring later, from strength). Receipts are the neutral price
   spine; deal-finders are optional enrichment, never load-bearing.
2. RESIDENCE PRODUCT PLACEMENT — residence-scoped VIEW of the one shared engine (one source,
   many views); home.builtwithcai.app = entry-point pointer (not a separate app); .com explains
   / .app entry-points; wiring deferred until builtwithcai.app core is stood up; sibling to
   CoolRunnings (loosely coupled, standalone-capable).
3. OFFLINE / LOCAL-FIRST CAPTURE (platform-wide) — the app works when the connection doesn't.
   Honest gradient: CAPTURE works offline unconditionally (snap receipt → save local → confirm
   "Captured ✓" → queue); OWN DATA (list/inventory) works offline; OCR/parsing populates ON
   SYNC ("Captured ✓ — will read items when back online," never fake "done"); live external
   data degrades gracefully. Apply the local-first LOGIC proven in DataBridge (pull the
   pattern, make it shared — not a module extraction). Real engineering investment; verticals
   build toward it.

=== PART 4 — handoff ===
Per Part 9, write the CLAUDE.md handoff: docs filed + where, D-numbers assigned, any Part-1
mismatches found, and the open items (Andrew: SKU/size in receipt payload + Spoonacular quota/
key; Connor: which deal-finder category; mobile-OCR-needs-work as a known Receipt Keeper gap).
Report back: the D-numbers, the docs home path, and the reconciliation findings.
