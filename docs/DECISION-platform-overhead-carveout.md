# DECISION — Platform Overhead Carve-Out (hand-allocation, suggested defaults, 100% guard)
Status: ACCEPTED · Date: 2026-06-19 · Decider: David (owner) · Amends: D-14
Builds on: D-16 (Model B pricing), recovery_basis derived/explicit pattern (2a/2b).

## Scope
This governs how TRACE's PLATFORM overhead (the shared spine — founder/platform labor $11,200/mo, shared domains/APIs, etc.) is allocated across TRACE's own VERTICALS (Farm, Real Estate, BuiltWithCAI, Cultivar, Ignition, …). This is about TRACE's OWN books. It is NOT how a customer (e.g. LAWNS) allocates ITS overhead — see "Out of scope" below.

## The rule
1. HAND-ALLOCATION. Each active vertical carries an overhead share that the OWNER sets explicitly. Verticals are few and unequal (Farm uses almost nothing; BuiltWithCAI is heavy), so shares are owner judgment, NOT an automatic even split.
2. PLATFORM = COMPUTED REMAINDER. Platform's share is never typed. Platform share = 100% − sum(vertical shares). A large remainder is legitimate — it is overhead the owner has consciously chosen NOT to push onto a vertical yet (e.g. Farm 5%, Real Estate 5%, BuiltWithCAI 20% → platform carries the rest).
3. OVER-ALLOCATION GUARD (structural). If sum(vertical shares) > 100%, the platform remainder computes NEGATIVE → RED, cannot save, until shares are brought back under 100%. The guard is structural: because platform = remainder, claiming >100% is arithmetically visible as a negative remainder. We can NEVER claim over 100% of overhead.
4. SUGGEST ON NEW ENTRANT. When a new vertical comes online, the system SUGGESTS a default starting share (configurable, default 20%) and shows the impact ("would bring allocated to X%, platform remainder Y%", RED if it would exceed 100%) — but does NOT apply it. Owner confirms or overrides.
5. NEVER SILENTLY CHANGE A CONFIRMED SHARE. The system suggests ONLY for the new entrant. It does NOT propose rebalancing existing shares (Option A, chosen over a rebalance-suggesting Option B). If a new entrant would bust 100%, the owner does the rebalancing BY HAND. Rationale: hand-allocation exists precisely because the owner knows the right unequal weights; auto-rebalancing would creep back toward the auto-split that was rejected.
6. SUGGESTED vs CONFIRMED provenance. Mirror the recovery_basis derived/explicit pattern: a suggested share is visually distinct (un-vetted); when the owner accepts/edits, it becomes CONFIRMED (owner-set) and the system won't re-suggest over it. The owner can see at a glance which shares are still the system's guess vs vetted.
7. SOLE VERTICAL = up to 100%. If only one vertical is active, the owner may hand-set it to 100% (platform remainder 0) — a sole deployed product can carry all overhead. Or leave it lower and carry the rest on the platform deliberately.

## Why hand-allocation (not auto-split)
TRACE's verticals are lopsided in platform usage. An even or usage-auto split would mis-charge (Farm carrying BuiltWithCAI's weight). Hand-set shares with a computed remainder are MORE honest for an unequal portfolio, and preserve the deliberate-underallocation lever (consciously leaving overhead on the platform).

## Cost attribution vs overhead allocation — keep distinct
A specific cost object that belongs to a vertical (e.g. meat-bird costing compute currently running under BuiltWithCAI but really Farm's activity) is a COST ATTRIBUTION question — that row should eventually carry the right vertical's parent_id. That is SEPARATE from overhead allocation (what % of the SHARED spine each vertical carries). Do not conflate the two seams.

## Out of scope (different shape, same engine)
A customer like LAWNS allocates ITS overhead across UNITS SOLD (trees) by per-item absorption (overhead ÷ units), NOT by hand-weighted vertical shares. The only shared property is the universal "never allocate >100% of any overhead pool" guard. LAWNS's per-item overhead allocation rides with the deferred D-16 LAWNS per-item pricing feed, not this hand-allocation UI.

## Sequencing
Build the carve-out engine (this rule) BEFORE the per-vertical drill-in price, because the per-vertical price = vertical's own cost-to-serve ÷ N + its carved fair-share of platform overhead. Until carve-out exists, the drill-in correctly notes "fair-share platform cost added next" (its current footnote).
