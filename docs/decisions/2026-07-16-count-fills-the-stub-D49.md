# D-49 — A scraped stub is a VARIETY PLACEHOLDER, not a stock line; the first count FILLS it

**Status:** proposed
**Date:** 2026-07-16
**Refines:** D-45 (count-promote) · **Enforces:** D-34 (the lot IS the SKU) · **Generalizes:** D-46's auto-group rule (#126)
**Closes:** tech-debt #57 · **Records:** tech-debt #56 (size vocabulary)
**Ledger:** #133

---

## The decision

**A `business_inventory` row with qty 0, no size, and no `variant_group` is a VARIETY PLACEHOLDER — not a stock line. The first count FILLS it in place rather than minting a sibling beside it.**

And the rule that governs every branch, stated once:

> **THE INVARIANT — any path that mints a size-sibling must leave the family in a state where the size-picker fires BY CONSTRUCTION:** a non-blank `variant_group` on **every** row of the family, a distinct non-empty size on **every** row, and SKU lineage from the family's base SKU.

That is not a style preference. It is exactly `detectSizeCollision`'s contract. A mint that leaves the family half-grouped or size-less means the next scan of that variety returns >1 token-equal rows, `detectSizeCollision` correctly refuses to guess, and the variety resolves **UNKNOWN**.

---

## The scar (live, proven — not theorized)

Owner-proving the #55 apostrophe fix on 2026-07-16, David counted the four possessive varieties. The trail:

```
[TRACE:RESOLVE] L4 name-token — bashams-party-pink-crape-myrtle → Basham's Party Pink
                Crape Myrtle ... siblings: 1
[TRACE:INVENTORY] promote — created {variety: "Basham's...", size: '30 gal', qty: 25,
                rowId: e92aedb2-...}
```

It **resolved to the existing row and then created a second one.** Inventory climbed **114 → 118** on four scans. The re-scan of the same slug then returned **UNKNOWN** — "Didn't recognize this."

**Net effect: counting a variety made it permanently unscannable.** Self-inflicting, once per variety, on the walk-and-count loop the whole capability exists for.

### Why it fired now and not before

#55 made this branch **reachable for the first time**. Before the apostrophe elide, those four varieties never resolved at L4 at all — they went straight to UNKNOWN and never reached `commitCount`'s promote. Fixing the resolver handed a working scan to a promote that had never been exercised on a size-less parent. **A fix that unblocks a path is a fix that exposes that path's first real test.**

### The root

`populate.ts` mints the scraped catalog under the D-9 honesty contract — `qty: 0` (never fabricate stock), `unit_cost: null` (the site has no prices), and **no size at all** (`row.size` is only attached for a size-variant row) — because scrape-reads-variations was never built. **103 of 112 scraped rows are stubs** (measured live, 2026-07-16).

D-45's promote matches on `(variety × size)`. `(Basham's, "30 gal")` against `(Basham's, NULL)` → `sameSize('', '30 gal')` → false → no match → **CREATE**. The spec never anticipated a size-*less* parent, because at the time nothing could resolve to one.

### Why nothing caught it

The suite was green. `catalog-variants` 31/31, `populate` 9/9, `canonicalName` 34/34. **The promote decision lived inline inside a React component's async handler** ([`InventoryCount.commitCount`](../../packages/cultivar-os/src/pages/InventoryCount.tsx)) — unreachable by any test. And the grid's own dup detector (`findDuplicateSizeGroups`) is **blind to this class**: it skips any row with a blank size, and the parent's size is blank. So the one surface built to surface this kind of damage could not see it.

---

## Against D-34 — this enforces it, it does not bend it

D-34 says *the LOT is the SKU, and qty is the COUNT*. A row with **no size, no stock, and no size-family cannot be a lot** — there is nothing for it to be the lot *of*. The stub is a variety list wearing a stock-line's clothes, minted by a scrape that couldn't read variations.

**D-34 is precisely why filling is correct:** if the stub cannot be a lot, then the first real lot has to *become* it. Siblings-ing it would leave a permanent non-lot squatting in the lot table — which is what happened, four times.

## Against D-45 — a refinement, not a reversal

D-45's `(variety × size)` match is right. It assumed both operands exist. D-49 says what happens when the catalog side has no size yet: that is not "a different size," it is **"no size recorded yet."** Absence is not a distinguishing value (the same D-9 shape as STD-019's *"absence is never agreement"* — two blanks are not a match, and a blank is not a distinct alternative either).

## Against D-46 — the same rule, applied to the path that skipped it

D-46 (#126) already ruled: *"+ Add size auto-groups the parent when its variant_group was null, so parent + sibling share ONE group and the size-picker fires by construction."* The **manual** editor honors this. The **count** path never did — `commitCount` backfilled `variant_group` on the MATCH branch only, never on CREATE. **D-49 is not a new rule; it is D-46's rule finally reaching the second path that mints siblings** (STD-011: two paths, one convention).

---

## Two branches, one invariant

| Live shape | Decision | Why |
|---|---|---|
| **STUB** — qty 0, size null, group null (103 rows) | **FILL in place** | Not a lot (D-34). The first count fills it; the row keeps its SKU + scrape lineage. |
| **UNGROUPED NON-STUB** — group null, size present (5 rows, e.g. Flip Side Vitex DISC-1104 qty 10 size 45) | **CREATE + auto-group the parent** | It *is* a real lot, so a second size is a real sibling. But the parent must be regrouped in the same pass or the family is left mixed-group → UNKNOWN. |

**CREATE is not the defect — CREATE-while-leaving-the-parent-ungrouped is.** The live data proves it: `'Sierra' Mexican Red Oak` and `Arizona Cypress Blue Ice` were both minted by this same count-promote CREATE (their siblings' `sku NULL` is that path's fingerprint) and **both work today** — because their parents already carried a group. Grouped parent + distinct sizes → the gate passes.

---

## What was built

- **`packages/shared/src/inventory/countPromote.ts`** — the decision, extracted **pure** (D-47's proven shape: the decision lives in shared and is testable without a database; the IO stays in the caller). Exports `isVarietyStub` (the ONE canonical stub predicate — STD-011, never re-spelled inline), `sameSizeLabel`, `baseSkuOf`, `resolveCountTarget`.
- **`countPromote.test.ts`** — 40 assertions, every fixture real live data. The re-scan assertions call the **real shipped `detectSizeCollision`**, not a re-implementation (the #55 lesson).
- **`InventoryCount.tsx`** — performs only the IO the decision returns; `[TRACE:INVENTORY] promote — filled | created | auto-grouped parent`.
- **`2026-07-16-d49-stub-fold-remediation.sql`** — gated repair of the four already-broken rows.

**`detectSizeCollision` was NOT touched.** Refusing to guess between two same-name rows is *correct* and is what stopped a bad merge. The fix stops manufacturing the ambiguous pair; it does not loosen the gate that catches it.

---

## Decisions inside the decision

- **SKU collision → omit, don't block.** A derived SKU that collides is dropped (blank, logged loudly) rather than refusing the count. The SKU is a convenience; the count is the point; refusing a save mid-lot-walk is disproportionate. Never a silent duplicate (D-9 omit-not-fake) — the owner assigns it in the editor.
- **`baseSkuOf` = shortest non-blank SKU.** Within one variety's family a derived sibling SKU is always its base plus a suffix, so the base is always shortest. Null when no sibling has one (never fabricate a base).
- **Status untouched on fill.** The SQL fold mirrors the code's `fill` branch exactly (qty/size/variant_group). A scrape-flagged `'review'` parent stays `'review'` — a separate pre-existing condition, surfaced in the pre-flight, not silently "fixed" by a remediation script.

## Standards

STD-002 (RED 24/16-fail → GREEN 40/0, no existing assertion adjusted) · STD-011 (ONE stub predicate, ONE SKU-derivation helper, ONE size comparison — the local `sameSize` retired) · STD-017 (every surface enumerated; the fix is in the shared decision so all inherit) · STD-018 (the count is an entry path; its Create/Update semantics are now stated, not discovered) · D-9 (no fabricated SKU, no fabricated price) · AC-1 (stub-ness derived from data — no CHECK, no enum) · AC-3 (tenant-scoped throughout) · §6 r11 (12/12 api-fn, none minted) · **zero schema migration** (size/variant_group/sku all exist).

## Named, not built

- **tech-debt #56 — size vocabulary.** `sameSizeLabel` is exact string equality. The catalog already carries mixed vocabulary (`'Sierra'` is live with `["15", "30 gal"]`), so "15 gal" against a "15" row mints a third row: two spellings of one physical size. D-45 built resolve-before-create for varied NAME spellings; nobody did it for SIZES. `normalizeSize` exists in the scrape parser, not on the count path. **This is the next defect in this family.**
- **`findDuplicateSizeGroups` is blind to the mixed-group/missing-size class** — it skips blank-size rows, so the grid's amber flag could not surface this. Widening it would make landmines visible *before* they blow.
- **`populate.ts` still mints size-less stubs.** The durable fix is scrape-reads-variations. It is a WRITE path over the whole catalog — its own build, its own blast radius.
