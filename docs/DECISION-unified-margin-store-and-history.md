# DECISION (D-13) — Unified margin store + cost/margin history (DEFERRED — future arc, not now)
**Captured:** 2026-06-18
**Status:** Captured from a read-only verify-first of how margin is handled across Ignition + the
shared engine. NOT a near-term build. The margin ENGINE is already shared and correct; the divergence
is in STORAGE. Consolidation is real debt but breaks nothing today → deferred to a deliberate
cross-vertical arc, sequenced with/after the BI what-if layer.

---

## THE FINDING (what the code actually shows — reframes the original question)
David asked "how did Ignition handle margin, let's align to that." Verify-first answer: **there is no
clean Ignition pattern to align to — Ignition's margin is itself fragmented across THREE stores**
(the Alan-effect fragmentation, flagged as honest-debt in Ignition's own code). "Aligning to Ignition"
would mean aligning to a mess. What's worth promoting is the CONCEPT (slab config + a change-log), not
Ignition's implementation.

### The shared MarginEngine is already RIGHT (the good news)
`packages/shared/src/business-logic/MarginEngine.ts` is a STATELESS pure calculator — owns no storage.
Takes a config {slabs, pricingTiers, overheadPerUnit}, computes price (slab → multiplier →
charm-rounded). Both verticals already use it:
- Ignition feeds it slab config.
- Cultivar feeds it a ONE-slab config built from config.margin.baseline → calculateRetail = cost ×
  1/(1−margin). Same engine, one-slab config.
So the COMPUTATION is shared and consistent (AC-4 holds for the engine). The divergence is purely in
WHERE each vertical STORES the margin value it feeds in.

### The storage IS the mess (3 Ignition stores + Cultivar's blob)
| Vertical | Store | Shape | Wired to pricing? |
|---|---|---|---|
| Ignition (legacy) | prot_matrix (localStorage) | anchor/offsets, %-of-cost | Yes — teardown target |
| Ignition (new) | margin_config (localStorage) | slabs + tierDiscounts | Yes — engine reads this; logs to margin_change_log |
| Ignition (DB) | shops.margin_config (Supabase jsonb) | {labor_rate, parts_markup} | **NO — orphaned, DISPLAY-ONLY, not wired** |
| Cultivar | config.margin.baseline (config blob) | a fraction | Yes — fed to engine |
The richest Ignition store (slab + change-log) is **localStorage-only** — single-device, not synced,
not RLS-scoped. The one in the DB is the orphaned display-only one. All per-business (per-shop), not
per-project/per-job.

### HISTORY: essentially NONE at the DB level (confirmed — David's instinct was right)
No DB table keeps cost/margin/pricing change history. cost_objects + config blob are last-write-wins
(updated_at = latest edit timestamp only; config fully overwritten). The ONLY margin-history mechanism
is Ignition's `margin_change_log` (append {field, category, old/new, changed_by, changed_at, reason}) —
but it's a **localStorage blob, not a DB table** (single-device, not synced, not RLS). The other *_log
tables are operational/compliance logs, not pricing history.
**Implication:** you currently CANNOT answer "what was my cost-to-produce / margin in March vs June"
durably, for any vertical. For a tool whose value is seeing money OVER TIME — and for the BI what-if/
sensitivity layer that reasons over trends — this is a real gap. Confirmed, not assumed.

---

## THE TARGET (when this arc is taken up)
NEED (stop divergence): ONE canonical, DB-backed, RLS-scoped margin config per business that the
shared engine reads — replacing Cultivar's blob fraction AND Ignition's three paths. Hang it on
cost_objects' DB/RLS spine (the spine already exists). Adopt Ignition's slab + change-log CONCEPTS into
this new unified store — do NOT copy Ignition's localStorage/shops.margin_config implementation (that
IS the fragmentation you'd be removing).
WANT (with BI): + a DB cost/margin change-HISTORY table (port margin_change_log properly — audited,
RLS-scoped, versioned across both verticals) → enables BI what-if/sensitivity-over-time.

Options (from the recon): (1) leave+document; (2) shape-align only (still blob, no history);
(3 RECOMMENDED) promote one DB-backed margin store the shared engine reads, both verticals;
(4) #3 + DB change-history table. Read: #3 when this arc is taken up, #4 with the BI layer.

---

## WHY DEFERRED (not now)
- The margin ENGINE is already shared + working; the number is correct today. This is a STORAGE
  consolidation (debt), not a fix — nothing is broken.
- It's a CROSS-VERTICAL migration touching Ignition (promote-don't-rebuild, has been off-limits) —
  bigger than the labor migration; deserves its own verify-first, staged arc.
- History (#4) is explicitly tied to the deferred BI what-if layer → sequence with/after BI, per the
  spine-must-be-rich-first principle (D-nested/BI doc).
- Closer-to-"presentable" work is queued (assets editing, per-project cost-to-produce drill-in, number
  labels, save-button consistency) — those come first.

## SEQUENCING
Future arc, in this order when taken up: D-13 #3 (unify margin storage, DB-backed RLS, both verticals,
shared engine reads it) → then D-13 #4 (cost/margin change-history table) WITH the BI what-if layer.
Not before the near-term presentable work and not before the spine is rich enough for BI.
