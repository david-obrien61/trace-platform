# RECON — where does the inventory decrement fire, and is the sale event dated there?

**Date:** 2026-07-21 · **Type:** RECON ONLY — zero code, zero schema, zero migration written.
**Question:** is the stock decrement (and its `sale` ledger event) wired to the point where stock
actually leaves under David's settled fulfilment model, or somewhere else?

**David's model (settled, D-record):** `pending` = no delivery date · `confirmed` = delivery date set
(NO stock moves) · `fulfilled` = delivered / driven away (**STOCK LEAVES HERE**) · `cancelled`.

**Grounding rule:** every claim below carries a `file:line` quote or is flagged **DAVID-QUERY**.
Nothing is stated from memory.

---

## R1 — WHERE THE DECREMENT ACTUALLY FIRES

### Verdict: **(a) order SUBMIT / checkout.** Not a status transition. Not `fulfilled`.

The decrement is in `handleCreate` — the checkout write — at
[`submit.ts:842-846`](../../packages/cultivar-os/api/orders/submit.ts#L842-L846):

```ts
const soldAt = new Date().toISOString();
for (const rl of resolvedLines) {
  const lotId = rl.stockLineId ?? rl.plant.inventory_id ?? null;
  await adjustLotQty(db, businessId, lotId, -rl.quantity, 'checkout sale decrement',
    { actorUserId: checkoutActor, kind: 'sale', orderId, occurredAt: soldAt });
}
```

**The code path that reaches it:** `handler` → `action` absent or `'create'` →
`handleCreate` ([`submit.ts:184`](../../packages/cultivar-os/api/orders/submit.ts#L184)) → §11 at
line 842. This is the anon-createable checkout branch — the dispatch comment at
[`submit.ts:176-178`](../../packages/cultivar-os/api/orders/submit.ts#L176-L178) states it:
*"action absent/'create' = the ORIGINAL checkout write (unchanged, anon-createable)."*

**The order is born `pending` in the same request** —
[`submit.ts:634`](../../packages/cultivar-os/api/orders/submit.ts#L634): `status: 'pending',`.
So the decrement fires **while the order is `pending`**, before any delivery date exists and
before anything has left the property.

**No status transition decrements anything.** `handleStatus`
([`submit.ts:1186-1250`](../../packages/cultivar-os/api/orders/submit.ts#L1186-L1250)) contains
exactly one `adjustLotQty` call, and it is a **restore**, not a decrement —
[`submit.ts:1226-1227`](../../packages/cultivar-os/api/orders/submit.ts#L1226-L1227), guarded to
`status === 'cancelled'`. There is **no `fulfilled` branch** in `handleStatus` at all.

The complete inventory of the four `adjustLotQty` call sites confirms it — one decrement, three
restores, zero on `confirmed`/`fulfilled`:

| # | Site | Trigger | `kind` | Direction |
|---|---|---|---|---|
| 1 | `submit.ts:844` | **checkout / order creation** | `sale` | **−qty (DECREMENT)** |
| 2 | `submit.ts:1052` | order edit (`handleUpdate`) | `sale` / `sale_reversal` | ± delta |
| 3 | `submit.ts:1161` | order delete | `sale_reversal` | +qty |
| 4 | `submit.ts:1226` | status → `cancelled` | `sale_reversal` | +qty |

**This build already knows it disagrees with the model.** The §11 header comment was corrected on
2026-07-20 and says so plainly
([`submit.ts:820-832`](../../packages/cultivar-os/api/orders/submit.ts#L820-L832)):

> *"Stock leaves at CHECKOUT — here — where the order is born 'pending'. … Delivery is a LATER
> event that does NOT touch qty."*

So the current wiring is **the Amazon decrement-on-paid model** (D-42, ledger #120: *"decrement
`qty` PER-UNIT at ORDER-PAID/CONFIRMED (checkout complete + invoice generated — the §11 point),
NOT at delivery"*). **That is a different model from the fulfilment one David has since settled.**
The gap is not a bug in the code; it is the code faithfully implementing a superseded decision.

---

## R2 — DOES THE SALE EVENT FIRE AT THAT SAME POINT?

### Verdict: **Yes — same call, same transaction, and dated at CHECKOUT.**

The event is emitted **inside** the RPC, not by a second call. `adjustLotQty` passes `occurredAt`
through as `p_occurred_at` ([`submit.ts:107-111`](../../packages/cultivar-os/api/orders/submit.ts#L107-L111)):

```ts
const { data, error } = await db.rpc('adjust_inventory_qty', {
  p_lot_id: lotId, p_business_id: businessId, p_delta: delta,
  p_actor_user_id: mv.actorUserId, p_kind: mv.kind,
  p_source_type: 'order', p_source_id: mv.orderId, p_occurred_at: mv.occurredAt,
});
```

and the RPC emits in the same plpgsql transaction as the qty UPDATE —
[`20260720_inventory_movement_ledger.sql:434-439`](../../supabase/migrations/20260720_inventory_movement_ledger.sql#L434-L439):

```sql
IF FOUND THEN
  -- SAME TRANSACTION as the UPDATE above. This is the whole decision.
  PERFORM public.emit_inventory_movement(
    p_business_id, p_lot_id, p_delta, COALESCE(p_kind, 'sale'),
    p_reason, p_source_type, p_source_id, p_actor_user_id, p_occurred_at);
```

**What `occurred_at` gets stamped with:** `soldAt`, captured at
[`submit.ts:841`](../../packages/cultivar-os/api/orders/submit.ts#L841) — `new Date().toISOString()`,
evaluated **at checkout**, immediately before the decrement loop.

`occurred_at` is a deliberate **parameter**, not a DB default — the migration flags this explicitly
([`20260720_inventory_movement_ledger.sql:68-71`](../../supabase/migrations/20260720_inventory_movement_ledger.sql#L68-L71)):

> *"⚠️ BUILD-TIME FLAG #2 — occurred_at is a PARAMETER, not just a DB default … would be wrong by
> the length of the lot walk."*

**So the answer to the question behind the question: the sale is dated at CHECKOUT, not at
fulfilled.** Every unit of every order is recorded as having left the property at the moment the
customer placed the order. Under David's model that timestamp is wrong by the entire
pending→confirmed→fulfilled interval — which for a delivery order is days, and is exactly the
window a reconcile is trying to reason about.

Two related properties worth having on the record, both grounded:

- **A refusal writes no event.**
  [`20260720_inventory_movement_ledger.sql:443-444`](../../supabase/migrations/20260720_inventory_movement_ledger.sql#L443-L444):
  *"NO ledger row: nothing moved, so there is nothing to record. A refusal is not a movement."*
  So an oversell-refused line leaves no `sale` row — correct, and it means ledger `sale` rows are a
  true record of movement, not of intent.
- **The order-lifecycle event is a separate stream.** `record_order_event` writes
  `aggregate_type='ORDER'` with `delta` hard-coded 0 inside the RPC
  ([`submit.ts:130-133`](../../packages/cultivar-os/api/orders/submit.ts#L130-L133)), so
  `order_confirmed` / `order_fulfilled` **cannot move on-hand**. This is why `order_confirmed` can
  fire correctly (David proved it live) while zero `sale` events exist — **they are wired to
  different triggers, and only one of those triggers has been pulled since the ledger existed.**

---

## R3 — THE EXISTING 16 PENDING ORDERS: DID THEY ALREADY DECREMENT?

### Verdict: **Yes — the ones created since 2026-07-13 decremented at creation, and did so BEFORE the ledger existed. On-hand already reflects sales the ledger has no `sale` row for.**

**⚠️ DAVID-QUERY on the exact split.** No `SUPABASE_SERVICE_KEY` is present in the local
environment (probe returned `NO_CREDS`), so I could not read `orders.created_at` live. The
timeline below is grounded in git history and the close-out ledger; **the per-order split needs one
live query, given at the end of this section.** I have not guessed at it.

**The timeline, all dated from git and the ledger:**

| Date | Event | Evidence |
|---|---|---|
| **2026-07-13** | D-42 decrement code lands — §11 begins decrementing at checkout | `3de3b84`, `git log` date |
| by **2026-07-15** | `20260713` migration APPLIED — the RPC is live and moving qty | ledger #129: *"Cancelled restores stock (D-42)"* proven live by David 2026-07-15 |
| **2026-07-15** | Order census: **16 pending, 1 cancelled, 0 invoiced, 0 paid** | ledger #129, verbatim |
| **2026-07-20** | D-50 Layer 1 — `business_inventory_ledger` **table created**, genesis backfill run | `2caeac7`, `git log` date |
| **2026-07-20** | D-50 Layer 2A-2 — order path wired to the ledger | `34c3bf9` |

**The consequence, in three steps:**

1. **Orders created before 2026-07-13 never decremented.** The decrement did not exist. Ledger #120
   is explicit that *"a qty decrement NEVER existed — the order path only flipped a whole lot's
   status to `'reserved'`"*. Their stock was never taken off on-hand.

2. **Orders created between 2026-07-13 and 2026-07-20 DID decrement — silently, with no ledger
   row.** The decrement was live; the ledger table did not exist until `2caeac7` on 07-20. There is
   no `sale` row for these, and there **cannot** be one — the ledger is append-only and
   `business_inventory_ledger` rejects UPDATE/DELETE *even for `postgres`* (owner-proven V2,
   ledger #140). Their history is unrecoverable, not merely missing.

3. **The genesis backfill absorbed those sales into the opening balance.** This is the part that
   matters for reconcile.
   [`20260720_inventory_movement_ledger.sql:350-360`](../../supabase/migrations/20260720_inventory_movement_ledger.sql#L350-L360)
   inserts one `opening_balance` row per lot with `delta = bi.qty` — **the lot's CURRENT qty at
   07-20**, which was already net of every 07-13→07-20 sale. So the ledger's opening position
   silently includes those sales as if the stock had never been there.

**This is why `qty == SUM(delta)` passes with zero drift and still tells you nothing about the
sales.** Ledger #140's V3(b) proved *"126 lots / 126 genesis rows … `qty == SUM(delta)`, **ZERO
drift**"* — and that proof is real, but it is a proof of **arithmetic consistency**, not of
**historical completeness**. The genesis row is a plug that makes the books balance by construction.
Any sale before 07-20 is inside that plug, indistinguishable from stock that was never received.

**Why no `sale` event has fired since:** the decrement is reachable **only** through
`handleCreate`. `order_confirmed` fired because David moved an *existing* order's status — a
`handleStatus` path that touches no stock. **A `sale` event requires a NEW checkout, and no new
order has been placed since the 2A-2 migration landed on 07-20.** The sale wiring is not broken; it
has not yet been exercised. *(Corollary, since it is load-bearing: the 2A-2 migration **is**
applied — `record_order_event` no-ops loudly when absent
([`submit.ts:148-150`](../../packages/cultivar-os/api/orders/submit.ts#L148-L150)), and David saw a
real `order_confirmed` row.)*

**The reconcile-relevant gap, stated plainly:** on-hand is (probably) correct. The ledger balances.
But for the 16 pending orders, **the ledger cannot tell you whether their stock is still on the
property or already sold** — and under David's model, stock on a `pending` order *should* still be
on the property, while the decrement says it left. Those two claims are in direct conflict today.

**DAVID-QUERY — the one live read that settles the split** (read-only, safe to run as postgres):

```sql
-- How many of the pending orders decremented, and is any of it in the ledger?
SELECT o.status,
       COUNT(DISTINCT o.id)                                    AS orders,
       MIN(o.created_at)::date                                 AS earliest,
       MAX(o.created_at)::date                                 AS latest,
       COUNT(*) FILTER (WHERE o.created_at >= '2026-07-13')    AS items_after_decrement_landed,
       COUNT(*) FILTER (WHERE o.created_at >= '2026-07-20')    AS items_after_ledger_existed
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
 WHERE oi.business_inventory_id IS NOT NULL   -- unanchored lines no-op (submit.ts:105)
 GROUP BY o.status;

-- Confirm the expected zero: no sale row has ever been written from an order.
SELECT kind, source_type, COUNT(*)
  FROM business_inventory_ledger
 GROUP BY kind, source_type ORDER BY 3 DESC;
```

Expected, if the reasoning above holds: `items_after_ledger_existed = 0`, and the second query
returns `opening_balance/migration` plus whatever the count path wrote — **and no `sale/order` row
at all.** If a `sale/order` row *does* appear, my step-2 dating is wrong and this section needs
revisiting.

---

## R4 — WHAT MOVING THE DECREMENT TO `fulfilled` WOULD TOUCH

**Scope only — no build, no recommendation on whether to move it. Surfaces, in dependency order.**

**1. The checkout path — `handleCreate` §11**
([`submit.ts:840-846`](../../packages/cultivar-os/api/orders/submit.ts#L840-L846)). The decrement
loop moves out. `soldAt` (line 841) and `checkoutActor` (line 840) stop being the sale's timestamp
and actor — note `checkoutActor` is legitimately `NULL` for anon QR checkout, whereas a `fulfilled`
transition is manager-gated and **always** has a real actor. Moving the decrement therefore also
changes the actor story, in the direction of *more* attribution.

**2. The status handler — `handleStatus`**
([`submit.ts:1186-1250`](../../packages/cultivar-os/api/orders/submit.ts#L1186-L1250)) gains a
`fulfilled` branch mirroring the existing `cancelled` branch at lines 1220-1229 (re-read
`order_items`, loop `adjustLotQty` with `kind:'sale'`, negative delta). The `prevStatus !== status`
no-op guard at line 1208 already prevents a double-decrement on a re-submitted `fulfilled`.
`orderStatus.ts` itself needs no change — `ORDER_STATUSES` already contains `fulfilled`
([`orderStatus.ts:13`](../../packages/cultivar-os/src/lib/orderStatus.ts#L13)) and the event type is
**derived** (`order_${status}`, [`submit.ts:1241`](../../packages/cultivar-os/api/orders/submit.ts#L1241)),
so `order_fulfilled` already emits correctly today.

**3. Oversell timing — the sharpest structural consequence.** Today the pre-flight refuses at
submit ([`submit.ts:415-422`](../../packages/cultivar-os/api/orders/submit.ts#L415-L422)):

```ts
if (availableQty != null && quantity > availableQty) { … code: 'INSUFFICIENT_STOCK' … }
```

with the RPC's `qty + p_delta >= 0` guard
([`migration:431`](../../supabase/migrations/20260720_inventory_movement_ledger.sql#L431)) as the
concurrency backstop. If stock does not leave until `fulfilled`, **on-hand no longer reflects
committed stock**, and the pre-flight becomes advisory: two pending orders can each pass it against
the same 45 units, and the second one fails at *fulfilment* — in the lot, with the customer
present. **This is the real cost of the move, and it is not a code detail: it is the reason
"reserved" exists as a concept in inventory systems.** Either the refusal moves to fulfilment
(worse place to discover it), or a reservation/committed-qty notion is introduced so the pre-flight
can check `on_hand − reserved`. Flagging, not solving.

**4. The three restore sites must be re-guarded** — each currently assumes the stock *was* taken:
edit ([`:1052`](../../packages/cultivar-os/api/orders/submit.ts#L1052)), delete
([`:1161`](../../packages/cultivar-os/api/orders/submit.ts#L1161)), cancel
([`:1226`](../../packages/cultivar-os/api/orders/submit.ts#L1226)). Under a fulfil-time decrement,
restoring a `pending` order's stock would **credit units that never left** — inventing inventory.
Each needs a "was this order ever fulfilled?" condition. Note the cancel path already carries a
comment acknowledging this class of guard
([`:1218-1219`](../../packages/cultivar-os/api/orders/submit.ts#L1218-L1219)).

**5. The QR self-serve flow — the gap that would be introduced.** Checkout is
[`useSubmitOrder.ts:108`](../../packages/cultivar-os/src/hooks/useSubmitOrder.ts#L108), which
creates the order `pending`. **The only UI that transitions status is
[`OrderDetail.tsx:404`](../../packages/cultivar-os/src/pages/OrderDetail.tsx#L404) → `:220`
(`action: 'status'`)** — a manager-gated desktop roster page, server-enforced by
`callerCanManageOrders` ([`submit.ts:1193`](../../packages/cultivar-os/api/orders/submit.ts#L1193)).
**There is no path by which a walk-in customer's order reaches `fulfilled`.** So a customer who
scans a tag, pays, loads the tree and drives away would leave the order at `pending` forever — and
under a fulfil-time decrement, **that stock would never come off the books.** The walk-in is
precisely the case where stock leaves *at checkout*, which is the case the current wiring gets
right. Any move to `fulfilled` needs an answer for it — either the QR path auto-fulfils
(self-transport is knowable: `transport_mode === 'self'`, see
[`submit.ts:163`](../../packages/cultivar-os/api/orders/submit.ts#L163)), or walk-ins keep
decrementing at checkout and only delivery orders defer. **This is a fork in the model, not an
implementation detail — it is David's call.**

**6. R-STATUS entanglement — yes, directly, and the doc says so itself.**
[`orderStatus.ts:7-8`](../../packages/cultivar-os/src/lib/orderStatus.ts#L7-L8):

> *"⚠️ R-STATUS (open decision): the enum below is a minimal proposal — David ratifies the set
> **(and whether 'cancelled' should auto-release inventory, which the server currently does)**."*

That parenthetical **is** item 4 above. R-STATUS is not merely adjacent to this decision — the
question it reserves (when does inventory release?) is the same question as *when does inventory
leave?*, seen from the other side. The reserved `'paid'` / `'delivered'` values matter too: if
`'delivered'` is later ratified as distinct from `'fulfilled'`, whichever one is chosen as the
decrement point must be settled in the same ruling, or the decrement lands on a status that then
gets redefined underneath it. **Recommend the two be ruled together.** They are one decision wearing
two names.

---

## SUMMARY

**The decrement fires at CHECKOUT** (`submit.ts:844`, inside `handleCreate` §11, while the order is
still born `pending`) — **not at any status transition, and specifically not at `fulfilled`**; the
`sale` event fires in that same RPC call and is therefore **dated at checkout** (`soldAt`,
`submit.ts:841`), which is wrong by the whole pending→fulfilled interval under David's model; and
the existing pending orders created since 2026-07-13 **have already decremented** — silently, before
the ledger existed, with the genesis backfill having absorbed those sales into the opening balance,
so on-hand reflects sales the ledger holds **no `sale` row for and structurally never can**
(exact split pending the one DAVID-QUERY in R3).

**No build performed. The fulfilled-vs-checkout decision is David's — and per R4 item 6 it should be
ruled together with R-STATUS, not before it.**
