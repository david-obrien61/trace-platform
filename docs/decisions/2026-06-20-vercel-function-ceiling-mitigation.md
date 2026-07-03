# Vercel function-ceiling mitigation — the 12-of-12 constraint

**Event date:** 2026-06-20 (the ceiling first bit — silent deploy failure). **Doc written:** 2026-07-03.
**Ties to:** capability 3.5 (delivery loop — the build that hit #13) · tech-debt #41 · CLAUDE.md §6 rule 11 (FUNCTION THRIFT).
**Standing rule home:** CLAUDE.md §6 rule 11. This doc is the evidence it points at.

---

## The constraint

Vercel **Hobby** caps a single deployment at **12 serverless functions**. The deployed backend for Cultivar OS is the **repo-root `api/` directory** (per CLAUDE.md §2 "Backend: Vercel serverless functions — api/ at repo root"; the root `vercel.json` rewrites confirm it, e.g. `/api/qbo/status → /api/qbo-connector`). Each file in root `api/` is one function.

**Current count: 12 of 12 — ZERO headroom.**

A 13th function does **not** fail loudly. The whole deploy fails silently and Vercel keeps serving the **last-good bundle**, so production silently serves stale code. This is exactly what happened on 2026-06-20: `api/deliveries/create.ts` was function #13 → every deploy from that commit silently failed → prod served the pre-delivery bundle until the endpoint was folded into `api/customers/create.ts` (verified by fetching the live bundle and grepping for the new copy — the DEPLOYED bar, before it was named). Root cause + fix: CLOSE-OUT / handoff 2026-06-20.

## The 12 deployed slots (root `api/` shims → `packages/cultivar-os/api/*` impls)

| # | Root `api/` function | Consumes it | Consolidation seam it already carries |
|---|---|---|---|
| 1 | `campaigns.ts` | Social campaigns CRUD | — |
| 2 | `customers/create.ts` | Resolve-or-create customer at checkout/receipt | **+ optional `delivery` block** (folded `deliveries/create` in, 2026-06-20 — the fix that got us back to 12) |
| 3 | `dashboard.ts` | Owner-dashboard aggregate reads | — |
| 4 | `discovery/ingest.ts` | Discovery engine | **`action=` branches**: identity / analysis / compare / **populate** / cost-apply / seed (many logical endpoints, one function) |
| 5 | `members/invite.ts` | Team invite send | — |
| 6 | `orders/submit.ts` | QR-checkout order submit (+ authoritative tax) | — |
| 7 | `pmi/suggest.ts` | PMI schedule AI suggest | — |
| 8 | `qbo-connector.ts` | QBO OAuth | **`?_route=`** auth-url / callback / status (3 routes → 1 function, via `vercel.json` rewrites) |
| 9 | `qbo/invoice/cultivar.ts` | QB invoice creation | — |
| 10 | `receipts/ocr.ts` | Receipt/invoice OCR (Gemini→Claude fallback) | **`shape` param** — the seam for ANY image→AI operation |
| 11 | `social/enable.ts` | Enable social module | — |
| 12 | `social/generate-posts.ts` | AI post generation | — |

## The reuse-before-mint seams (use these instead of a 13th file)

- **Any image → AI operation** → `receipts/ocr.ts` `shape` param.
- **Any discovery / catalog / cost-reasoning server op** → `discovery/ingest.ts` `action=` branch.
- **Anything customer-adjacent at write time** (e.g. a delivery, a follow-up) → `customers/create.ts` optional block.
- **Multi-route OAuth / status** → the `qbo-connector.ts` `?_route=` + `vercel.json` rewrite pattern.

## Rule (banked, CLAUDE.md §6 rule 11)

1. New keyed/server-side work MUST ride an existing endpoint before a new `api/` function is created.
2. Minting function #13 is a **STOP-AND-SURFACE** event — Thunder halts and gives David an explicit choice: **reuse / consolidate an existing pair / upgrade to Vercel Pro**. Never silently create file #13.

## Notes / open reconciliation

- `packages/cultivar-os/api/` holds **14** implementation files, but only **12** are exposed via root-`api/` shims. The two impls with **no shim** — `members/accept-invite.ts`, `members/preview-invite.ts` — are therefore **not deployed as functions** today. This is itself evidence the ceiling is already forcing hard choices; whether those two member flows are reached another way (or are dead) is a separate reconciliation, flagged here, not resolved by this doc.
- **Upgrade trigger:** the next module wave that genuinely needs a new endpoint (Online Shop, Follow-Up Engine) should carry the **Vercel Pro** upgrade decision — Pro lifts the per-deployment function cap well past 12. Until then, consolidate.
