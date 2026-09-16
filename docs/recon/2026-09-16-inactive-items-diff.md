# RECON — what Lauren retired in QuickBooks, and whether it fixed what we found

**Date:** 2026-09-16 · **Ledger:** #341 · **Type:** recon, a **PROJECTION from saved files, not a live pull.**
**Source:** the LAWNS capture files in `~/Downloads` (realm `9341455222430707`), read through the platform's own gate (`readCaptureFile`), parser (`parseItemList`) and collision rule (`adaptQboItems` → `findShapeCollisions`). Script: session scratchpad, not committed.
**Code:** `fix/preview-query-completeness` at `1502e6f`.

## 0. Why this is a projection

Step ② (a new pull through the fixed preview) **did not run.** The root `.env.local` holds the QuickBooks and Supabase values as empty strings (`""`, which is how Vercel CLI writes sensitive variables). The one file with real values, `packages/cultivar-os/.env.local`, is **refused by a tool deny rule.** Separately, LAWNS's access token had expired 5 minutes earlier (14:36 UTC), so any pull would have had to refresh it, and the platform's refresh **writes** the rotated token to `business_accounting_secrets`. **The capture that answers this properly comes from pressing Preview your books on the deployed fix.**

## 1. 🔴 The "before" picture is 09-04, not 09-10

The prompt took the 09-10 export as the one behind the report Lauren acted on. **The data says her clean-up was already in it:**

| Capture | Items | Collisions (platform rule) | …with different prices | Price spread |
|---|---|---|---|---|
| 08-29 · 09-03 · 09-04 (identical ids) | 685 | **11** | **6** | **$2,780** |
| 09-10 | 673 | **0** | 0 | $0 |

**12 item ids are in 09-04 and absent from 09-10. None were added.** The old query never returned inactive items, so absent means "made inactive" (the invoices label them `(deleted)`). A report built from 09-10 would have shown no collisions at all. So the report she acted on came from the 09-04 read or earlier, and **09-04 is the complete before-picture: all 12 were active in it.**

## 2. What she retired, and what it was duplicating

Survivor = the other member of the same 09-04 collision, still active on 09-10.

| Retired (09-04 price) | Survivor (price, unchanged) | Invoice lines on the retired id (09-10) |
|---|---|---|
| `76` Oak:Lacey Oak 45G · Service · **$375** | `756` Oak:LAO45 · NonInventory · **$1,250** | 10 · $12,900.00 |
| `75` Oak:Lacey Oak 30G · Service · **$350** | `753` Oak:LAO30 · NonInventory · **$900** | 4 · $2,230.00 |
| `150` NZCM30 · Service · **$350** | `859` Crape Myrtle:NZCM30 · NonInventory · **$900** | 3 · $1,575.00 |
| `836` Holly:NFYH45 · **$0** | `834` Holly:NFeYH45 · **$650** | — |
| `1128` Juniper:BuJ45 · Service · **$1,250** | `631` Juniper:BJ45 · **$1,400** | — |
| `1104` Nectar Plants:HSKWRD5 · **$60** | `1087` Holly:SH5 · **$65** | — |
| `85` Pistache:CP95-1 · Service · $1,000 | `689` Pistache:CP95 · $1,000 | 2 · $5,000.00 |
| `138` JBP · Service · $1,250 | `746` Pine:JBP45 · $1,250 | — |
| `9` Military Discount 5 · −5% | `8` Military Discount · −5% | 7 · −$682.50 |
| `110` Buckeye,M **and** `111` Buckeye,M 7g · $90 each | **none — both halves retired** | — |
| `84` Oak:Texas Lacey Oak 45g · Service · $450 | none by our rule (the name differs); by eye, the Lacey Oak 45 above | — |

**The pattern is consistent:** in every priced pair she kept the `NonInventory` item under a category and retired the `Service` item, and **in every pair whose prices differed, the survivor is the HIGHER price.**
The eleventh collision (`196` Tree Replacement vs `207` WARRANTY, both $0) was resolved by **renaming** `207` to `TWR` / *Tree Warranty Replacement*, not by retiring it.

## 3. Did the price spread close?

**Yes, by removal, not repricing.** 6 priced collisions ($2,780 spread) → 0. No survivor's price changed. The only price change between the two captures is `1112` American Sycamore, $0 → $48 (also renamed `Sycamore:AS7`, which fills a missing description).

## 4. What is still colliding

**Nothing, by the platform's rule.** Two things the rule cannot see:
- `196` *Tree Replacement* and `207` *Tree Warranty Replacement* are both active $0 services. The rename took them out of the rule's reach. Whether they are one service is her call.
- `84` *Texas Lacey Oak 45* was never a match (different name) and she retired it anyway, so her judgement is already ahead of the rule there.

## 5. Does the $25,022.50 attribute to a surviving item?

**$21,022.50 of it does, by shape. $4,000 cannot be placed from any file we hold.**

- **26 lines, $21,022.50, sit on five of her retirements** (`76`, `75`, `150`, `85`, `9`). All five have a survivor (table above). ⚠️ **QuickBooks does not move history:** those lines still point at the retired ids. "Attributes to a survivor" is our shape match, not a fact in her books. With #341 the retired items come back in the read (`Active: false`), so each line prices against its own retired item.
  - The same five ids carried **25 lines, $21,147.50** on 09-04. One line was added and the total fell $125 after 09-04. **Observed, not explained.**
- **4 lines, $4,000, sit on items retired BEFORE 08-29** (`154` Osmo B $150 · `149` Mulch/bag $700 · `688` CP65, 1 $3,150 · `425` Oak:LO30-Closed $0). They are in **no** saved item capture, including the earliest. They were already orphaned on 09-04 (7 `(deleted)` lines then). They reach us only through the fixed query. `CP65, 1 (deleted-1)` reads like an item QuickBooks renamed on deletion, so it may not come back even then.

## 6. Customers

**No customer id disappeared between 09-04 and 09-10**, and 13 were added. Every `CustomerRef` on the 09-10 invoices is in the 09-10 customer file. **This proves only that she retired no customer who had an invoice in that window.** An inactive customer with no recent invoice is invisible to every saved file.

## 7. ⚠️ The limit, stated plainly

- **Every saved capture came from the broken query**, so every one is complete about **active** records only (`askedForInactive: false` on all 17 readable files).
- **This comparison works by luck:** the 12 retirements happened after 09-04, so 09-04 still holds them as active. The 4 older retirements are in no file.
- **Anything she makes inactive from now on is visible only in a capture taken with the fixed query.** An old file cannot show it, and the reader now says so when one is loaded.
- **The next capture will also look bigger than 09-10:** item and customer totals will include inactive records. The narration line says *"including N you have made inactive"* so that growth does not read as new records.
