# DECISION — Cost Object: Model of Record (vs Industry Standard)
Status: ACCEPTED · Date: 2026-06-18 · Decider: David (owner)

## Principle
Start from the industry-standard small-business cost record; deviate deliberately to solve OUR problem; document every deviation. Build the 20% a two-person small business needs — NOT full GAAP. Mission frame: give a small business the cost capacity a large company's accounting department provides, at a scaled price, by replacing the department with AI (precision) + owner (KM) + builder. The cost object is the COMPRESSED standard — the 20% that delivers the 80% — not a reinvention and not the full leviathan.

## The standard cost record (reference)
A general-ledger cost entry's spine: amount, account/category, description, source-document reference, entry type/classification. Standard guidance for small business: keep categories few, limit GL accounts, use a small set of custom fields for who/what/where/why. The heavy mechanism (double-entry debits/credits, trial balance, posting groups) is the bookkeeping ENGINE, separable from the cost record itself.

## Model of record — every field tagged ADOPTED / DEVIATED / ADDED / SKIPPED
1. Cost record spine (amount, name/description, type via node_type ASSET/PROJECT/PRODUCT) — ADOPTED. Standard fields, present.
2. Source-document reference = receipt_id (FK→receipts) — ADOPTED. The standard's source-doc ref; the single most important provenance field. Dedup uses receipt_id + line identity (NOT receipt_id alone) — DEVIATED: good-enough dedup for a two-person shop; proven correct (the 264f9e5f Amazon pair stays DISTINCT — same receipt, different line amounts = two real line items, not a double-count).
3. Category = cost_category, IRS Schedule C narrowed to ~15-20 verticals, QBO-aligned — DEVIATED (already D-11): standard says keep categories few; maps cleanly to QuickBooks when the connector lands.
4. Context tags — parent_id (FK, what it BELONGS TO: project or company-overhead), resource_id (FK→labor_resources, what it's FOR; labor-only by convention today, may extend to any cost driver), nature (CapEx/COGS/OpEx), shape (recurring/one-time) — ADOPTED: these are the standard's "custom fields for who/what/where/why."
5. Confidence ladder — cost_confidence (CONFIRMED/DERIVED/ESTIMATED/UNKNOWN; CONFIRMED requires a receipt link, never user-selectable) — ADDED (not in standard accounting): our value-add so a small operator records an HONEST estimate instead of fake-precise zero; AI closes the precision gap over time (good-enough + AI-as-equalizer).
6. Double-entry debits/credits, trial balance, posting groups — SKIPPED: the leviathan mechanism. QuickBooks runs double-entry when connected; TRACE records the cost honestly and maps to QBO. Deliberately out of the 20%. (Recorded so its absence is a logged decision, never rediscovered as an oversight.)

## Consequence
Future builds CONFORM to this model; they do not rediscover it. The cost object is settled. Open items that were recurring questions are now decided: dedup = receipt_id+line (DEVIATED); resource_id = labor-only today, extensible (ADOPTED); double-entry = SKIPPED.
