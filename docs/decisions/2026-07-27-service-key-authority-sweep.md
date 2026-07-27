# 🔴 SERVICE-KEY AUTHORITY SWEEP — an unauthenticated cross-tenant write CLASS

**Status:** ⛔ **REPORT ONLY. NO FIX WRITTEN. RBAC work HALTED pending David's ruling on scope.**
**Date:** 2026-07-27 · **Found by:** rider A on the `deliveries:create` status question.
**Doctrine violated:** MB_D-015, stated verbatim in `packages/shared/src/auth/callerPermission.ts`
lines 2-9 — *"a handler writes with the SERVICE KEY (which bypasses RLS), so it must independently
prove the CALLER's authority for the TARGET business before writing… Authority is resolved from the
request AUTH CONTEXT (the Bearer token), **NEVER the request body** — a forged businessId the
caller doesn't belong to returns false."*

---

## 1. IS IT LIVE? YES.

`api/customers/create.ts` is one of the **12 deployed Vercel slots** (repo-root `api/`, the
function-ceiling inventory of §6 r11). It is a root shim re-exporting
`packages/cultivar-os/api/customers/create`. **`/api/customers/create` is reachable on
cultivar-os.vercel.app right now.** Stated, not inferred: the slot list is enumerated below.

```
api/campaigns.ts · api/customers/create.ts · api/dashboard.ts · api/discovery/ingest.ts
api/members/invite.ts · api/orders/submit.ts · api/pmi/suggest.ts · api/qbo-connector.ts
api/qbo/invoice/cultivar.ts · api/receipts/ocr.ts · api/social/enable.ts
api/social/generate-posts.ts                                              (12/12)
```

---

## 2. THE SWEEP

**CORPUS (STD-021):** every `.ts` file under `packages/cultivar-os/api/` — 14 files, all read.
`packages/cultivar-os/api` is the **only** `packages/*/api` directory in the repo (verified by
`ls -d packages/*/api`). Detection per file: service key = `SUPABASE_SERVICE_KEY|adminDb()`;
tenant source = a tenant id read on a `req.body`/`req.query` line; caller check =
`callerHoldsPermission|callerIsBusinessOwner|resolveCallerUid|headers.authorization|auth.getUser`;
write target = `.from('x').insert|update|upsert|delete`.

| endpoint | key | tenant id from | caller check | writes |
|---|---|---|---|---|
| **`customers/create.ts`** | service | **BODY** `businessId` | **NO** | `customers` (via `findOrCreateCustomer`), `deliveries` insert |
| **`campaigns.ts`** | service | **BODY** `businessId` :32 | **NO** | `campaigns`, `campaign_posts` ins/upd, `business_voice_samples` insert |
| **`social/enable.ts`** | service | **BODY** `business_id` :12 | **NO** | `business_modules` upsert |
| **`social/generate-posts.ts`** | service | **BODY** `business_id` :24 | **NO** | `social_drafts` insert |
| **`qbo/invoice/cultivar.ts`** | service | **BODY** `business_id` :324 | **NO** | `customers` update, `orders` update |
| **`qbo/router.ts`** | service | **QUERY** `business_id` :55 | **NO** | `businesses` update |
| `dashboard.ts` | service | **QUERY** `business_id` :11 | **NO** | *(read-only)* |
| `receipts/ocr.ts` | service | **BODY** `businessId` :313 | **NO** | *(reads `platform_config`)* |
| `members/invite.ts` · `accept-invite.ts` · `preview-invite.ts` | service | invite **TOKEN** | n/a | token-authorised by design |
| `pmi/suggest.ts` | **anon** | body | n/a | *(no write)* |
| ✅ `orders/submit.ts` | service | body + **token** | **YES** (15 sites) | the order family |
| ✅ `discovery/ingest.ts` | service | body + **token** | **YES** (2 sites) | cost-apply |

---

## 3. WHAT THIS IS

**It is a CLASS, not one endpoint. Six endpoints perform service-key WRITES with the target tenant
taken from the request and no proof of who is calling.** Two more do the same for READS.

Because the service key bypasses RLS, **every policy in the platform is irrelevant on these
paths** — the whole 15-site flip, the owner_all policies, `is_active_member`, `has_permission`.
AC-3 (tenant isolation absolute) fails here with **no layer beneath it**.

**Two endpoints prove it is a doctrine failure and not a design constraint:** `orders/submit.ts`
and `discovery/ingest.ts` sit in the same directory, use the same service key, and DO prove the
caller first — `callerIsBusinessOwner` / `callerHoldsPermission` resolved from the Bearer token.
The pattern exists, is documented, and was simply not applied to the other six.

**The caller side confirms it:** `ReceiptKeeper.tsx:524` posts to `/api/customers/create` with
`headers: { 'Content-Type': 'application/json' }` — no `Authorization`. So the fix is two-sided:
attach the token at the callers, gate at the endpoints.

### Severity notes, stated without inflation
- `qbo/router.ts` writes **`businesses`** (the OAuth token columns) keyed on a **query-string**
  business_id. Its OAuth *callback* is necessarily unauthenticated — Intuit redirects to it — so
  that branch needs a different treatment (the `state` parameter) than the `status`/`auth-url`
  branches. **Flagged for review, not asserted as identical to the others.**
- `dashboard.ts` and `receipts/ocr.ts` are reads, not writes. A cross-tenant READ of dashboard
  figures is a smaller hole than a write, but it is the same missing check.
- The three `members/*` endpoints authorise on an **invite token**, which IS a credential. Not in
  the class.

---

## 4. WHY THE RBAC WORK IS HALTED

The migration, the funnel calls, the six holes and confidential-warning all assume the data layer
is the wall. On these six paths there is no wall. Finishing a permission model on top of an
unauthenticated write class would produce a demo that *demonstrates* enforcement that does not
hold — the exact "surface honesty" failure the whole programme exists to end.

**Nothing is fixed here. Scope is David's call:** one endpoint, the six writers, or all eight
including the reads — and whether the two-sided token attachment lands in the same pass.
