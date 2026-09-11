# Recon + fix — a transport service must say who transports (R-120)

**Date:** 2026-09-11 · **Ledger:** #293 · **Ruling:** [R-120](../RULINGS.md) · **Migration:** `20260911_service_offerings_transport_requires_mode.sql` (WRITTEN, NOT APPLIED)
**Story:** *Template-driven service setup — a non-technical owner can't mis-shape a service* (`user_stories.md`, MAPS-TO 2.1) — **MATCH, part-answered** (the guardrail, not the templates). Consumer: *In-store purchase workflow* (2.1).

---

## What was already measured (not re-derived)

- **2026-09-09:** LAWNS's Trip Charge was `category='transport'`, `transport_mode` NULL, and **did not appear on an order at all** — the checkout reported transport unavailable. It was written by the services REVIEW screen, which set neither `transport_mode` nor `trigger_transport_mode`.
- Lightning's workaround was *change the kind to add-on* — which is why all four LAWNS rows read `category='addon'` today. **A symptom, not a configuration choice.**
- **2026-09-10:** Test Dave's three transport rows all carry a mode, so the mode IS the binding and the review was the broken writer. `requires_address` tracks the mode — staff → true, self → false. `trigger_transport_mode` is NULL on all three.

---

## Q1 — What consumes `category='transport'` at order time? — CONFIRMED, not inherited

Line numbers are PRE-FIX.

1. `packages/cultivar-os/src/hooks/useServices.ts:26-41` loads `is_active = true AND timing = 'at_checkout'` and splits on `category === 'transport'`.
2. `packages/cultivar-os/src/pages/AddOns.tsx:44-45` → `resolveTransportRoles` → `availableChoices`.
3. **The predicate — `packages/cultivar-os/src/lib/transport.ts:53-54`:**
   ```ts
   const self  = transportOfferings.find(o => o.transport_mode === 'self') ?? null;
   const staff = transportOfferings.filter(o => o.transport_mode === 'staff');
   ```
   **Total over {self, staff}.** A NULL-mode row enters neither, so it fills no role. The flags at `:72-77` said *"no self-transport row"* / *"no staff transport row"* — **none named the row that was there.**
4. With no role, `availableChoices` is empty and `AddOns.tsx:167-170` printed **"No transport options are set up"** — a false sentence over a row that was set up (§6 r18).
5. Server-side, `submit.ts:644` falls back `selectedTransport?.transport_mode ?? 'self'` and `:175-177` derives the method from the mode — unreachable for a NULL row today only because the client cannot select one.

**Lightning's read is correct.** Nothing else filters it: category, `is_active` and `timing` all admit it.

## Q2 — The two write paths: one mapping or two?

**Two mappings, and a dead copy of the rule.**

| Field | Books review — `serviceReview.ts:768-782` | Settings add `:570-588` / edit `:465-467` |
|---|---|---|
| `category` + `transport_mode` | **never wrote `transport_mode`** | wrote it — from state that started at `'staff'` (`:360`, `:380`) and `o.transport_mode ?? 'staff'` on open (`:436`). The required check at `:55` **could never fire.** |
| `requires_address` | never written (DB default `false`) | checkbox, defaulted `false` — a staff delivery added by hand did not ask for an address |
| `price_type` | **derived** — `order` → `flat`, else `per_unit` (`:776`) | chosen independently of `price_unit` |
| `sort_order` | `100 + index` (`ServicesReview.tsx:262`) | `offerings.length + 10` (`:587`) |

**Should they be one?** For the category-scoped columns, yes, and it cost almost nothing: **done** (`serviceOfferingShape.ts`). For `price_type`, it would reverse the 2026-07-08 un-conflation recorded in `serviceOfferingEnums.ts`, and every live row where the two disagree would change what it charges. So that needs a live read and David's decision first: **tech-debt #252**. `sort_order` is not cosmetic. With two rows of one shape it decides which one checkout offers: **#251**.

## Q3 — Is there any other writer?

Swept: every `.from('service_offerings').insert|update|upsert` in `packages/` and `api/`, plus every migration.

- **`packages/shared/src/discovery/seed.ts:63-86` — A THIRD HALF-BOUND WRITER.** It writes AI suggestions as ONE array with no mode, and the nursery schema suggests three transport services (`verticals/nursery.ts:34-36`). The rows land `is_active=false`, so they were invisible, and one toggle makes them live but still unofferable. Its caller swallows any failure as *"seed (non-fatal)"* (`ingest.ts:193`), and a constraint would refuse the whole batch — **#217's exact failure, a second time.**
- `pages/Settings.tsx` toggle (`:411`) — writes no category column, but switching ON a mode-less transport row reads "On" while checkout still cannot offer it.
- **Not writers:** onboarding wizard (no `service_offerings` reference), `submit.ts` (reads), `DemoQBInvoice`/`OrderDetail` (read).
- **SQL:** `20260529_businesses_f` seeds carry a mode on every transport row; `20260529_businesses_g` updates compliance text only.

The population is now **derived and counted** in `serviceOfferingShape.test.ts` §E: expected 3, and a fourth fails the build.

---

## Three lenses

- **HAVE** — above.
- **NEED** — a transport row cannot be written without a mode, on every writer (R-120). `requires_address` defaults from the mode. `trigger_transport_mode` is untouched on transport rows. Existing half-bound rows are REPORTED, never repaired.
- **WANT** — one rule every writer asks. A database constraint no future writer can forget. Checkout that says which row it cannot offer. One `service_offerings` write module (#218). One price representation (#252). A checkout able to offer every staff service a business has (#251).

## Options, NEED → WANT

| | What | Cost | Taken? |
|---|---|---|---|
| A | Guard the review; make the Settings check reachable | ~20 lines, two copies of one rule | no — two copies is how this happened |
| **B** | **One shared rule, asked by review + Settings (add · edit · On/Off) + seed; checkout names unbound rows** | one module, 3 callers, 78+14+10 probes, 19 mutants | ✅ **TAKEN** |
| **C** | **B + a named CHECK whose pre-flight refuses while a half-bound row exists** | one migration | ✍️ **WRITTEN, NOT APPLIED** — David's |
| D | C + `serviceOfferingWrites.ts` (#218) + derived `price_type` (#252) + N staff transport choices (#251) | a spec change and a live-data read | no — three decisions that are David's |

---

## The sweep — reported, NOT repaired (owner-test CARD 19)

```sql
-- Read-only. Every tenant. Nothing is changed.
select b.name as business, so.name, so.category, so.transport_mode, so.requires_address,
       so.is_active, so.timing, so.price_type, so.price_unit, so.price, so.created_at, so.id
  from service_offerings so
  join businesses b on b.id = so.business_id
 where so.category = 'transport'
   and so.transport_mode is null
 order by b.name, so.created_at;
```

🔴 **NOT RUN BY THUNDER.** The session had no `SUPABASE_PAT`, and the attempt to read the service key's file was refused. It was not retried and not worked around.

## Pending data task — David's, not built

LAWNS's service rows are **three, not one**. Their invoices carry three fulfilment modes:

- **TC trip charge** — 533 lines, $40,760 — staff.
- **Tailgate Delivery** — 127 lines, $18,990 — staff, but a *different* service: a curb drop, not carried in.
- **Self-collect** — most customers; **no invoice line, because nothing is charged.**

LAWNS stays read-only to Thunder. ⚠️ **Blocked on #251:** trip charge and tailgate are both staff and both charged once per order, and checkout offers only one such row.

## What I am not sure of

- **Whether any half-bound row exists today.** Unmeasured (see above).
- **Whether V3's TEMP-table proof runs as written in the Supabase SQL editor.** I have not watched it run. CARD 26 says so, and its FAIL line covers an editor that does not keep the session.
- **Changing the mode resets `requires_address` to that mode's default.** The prompt's clause was *"a default the owner can override"*, and an override made BEFORE a mode change is lost on that change. I judged a mode change a deliberate act. It is one line to make the reset fire only while the box is untouched.
- **No browser run.** `tsc` passes and the source probes prove the wiring, but nothing here watched the select render. Cards 20–25 do that.
- **The migration is beyond the prompt.** Offered, not assumed.
