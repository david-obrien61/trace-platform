# WATER MONITOR KIT — the manufacturing spec, recorded against the item

> **Filed 2026-09-18 (ledger #352) on David's instruction: _"record it against the item for the parked
> recipe-builder work; build nothing now."_ NOTHING READS THIS FILE. It is a record, not a recipe.**

## The item

| | |
|---|---|
| Name | **Augur Holes, and install water monitor pipe** |
| `business_inventory.id` | `1aa81ec5-12b1-44f9-bc56-4b519d2247b6` (LAWNS) |
| QuickBooks item | **102** |
| Price | **$5.00** · qty on hand 10 · not retired |
| Measured | 2026-09-18, live, read-only. **No order line has ever used it.** |

## The spec (David, 2026-09-18)

Manufactured in-house, **prebuilt and kept on the shelf**. One kit is:

- **24 inches of 1" PVC pipe, with holes drilled** — ✏️ **corrected from 23 inches**, which was
  Lightning's figure in the prompt that asked the question. 24 is David's.
- **one 3 ft bamboo stick.**

## What the load list does with it — and deliberately does NOT

**Does:** prints a **COUNT** in hardware, beside the T-posts and rope — one kit for every tree LAWNS
installs, plus any billed on the order (a customer may buy them for trees they plant themselves).
David: *"The crew count trees, count monitors, load them."*

🔴 **Does NOT: print the PVC, the bamboo, or the drilling.** They are prebuilt; a parts list on a load
sheet would send somebody to build what is already on the shelf. `loadList.test.ts` §Q6 asserts the
sheet never says *PVC*, *bamboo* or *drill*, and that the model holds no parts figures.

⚠️ **An earlier proposal — two Operations config keys for the PVC inches and bamboo feet — was
SUPERSEDED by David's model.** It would have printed manufacturing detail on a loading sheet.

## What is still owed (NOT started)

The **recipe builder** is parked. When it is built, this spec is one of its inputs: a manufactured item
with a parts list, a cut length and an operation (drilling). Until then the parts live here and nowhere
else, and nothing computes them.
