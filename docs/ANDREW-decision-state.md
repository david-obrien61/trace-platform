# ANDREW BUILD — Decision State (settled vs. open)
**Captured:** 2026-06-16 09:21
**Purpose:** Preserve the context for Andrew's asset/inventory scan-capture build — what is SETTLED,
what still NEEDS A DECISION from David — so nothing is lost before the onboarding package is assembled.
**Status:** Pre-package. The Andrew onboarding package should be assembled AFTER the open items below
are resolved and AFTER schema activation lands (see Blockers).

---

## What Andrew is building (one line)
A **scan-capture input layer** — clone Receipt Keeper's gesture (photo/scan → Gemini reads → confirm
→ write) for product labels / SKUs and assets, instead of receipts. NOT a new product; an input layer
on entry surfaces that **already exist**. His existing desktop tool is the starting *concept*, not
code to port.

His current tool (from Thunder recon): `~/Desktop/current inventory code/Local website library/` —
Python 3.14 Tkinter GUI + FastAPI local server (:8000) + Gemini 2.5 Flash vision + qrcode/PIL, packaged
as a Windows .exe. Phone hits `upload.html` over LAN, photo/upload, optional barcode scan (html5-qrcode
prefills name), server runs Gemini → `Brand/Model/Device_Type/Estimated_Value/Specs/Summary`. No DB, no
auth, no RLS — writes image to disk + a sidecar `{base}_info.txt` JSON.

---

## SETTLED (do not re-litigate)

1. **Destination tables exist and are designed.** Assets → `cost_objects` (node_type='ASSET', post
   Core-1 rename). SKU/stock → `business_inventory`. The proven write-pattern to mirror is
   `BusinessAssets.tsx` (`.from('cost_objects')`, `business_id`, `node_type`, RLS scoping).

2. **Reuse the Receipt Keeper pipeline, don't rebuild it.** `api/receipts/ocr.ts` (Gemini→Claude
   provider chain, config-driven models, cost telemetry), the image capture + compression pipeline,
   and the confirm-before-write UX all exist and are proven. Andrew clones/extends; he does not
   rebuild the OCR endpoint or the capture affordance.

3. **The new work is narrow** (Thunder-confirmed): (a) a sibling OCR prompt + output schema tuned for
   a product label / SKU (not receipt); (b) product identify (Gemini-from-photo first; lookup-table
   deferred — none exists); (c) wire the EXISTING `inventory_intake` (Camera-icon) tile, which today
   dead-ends at `showComingSoon`; (d) pre-fill the SAME insert payload the manual forms already
   construct. Manual = fallback, scan = primary, same write, same confirm.

4. **Andrew's feature is unstarted in the codebase** (grep-confirmed zero) → no collision, no port of
   his desktop code; he builds fresh against the spec using Receipt Keeper as template.

5. **Core-1 invalidations to honor** (so he doesn't build the old way then refactor): write to
   `cost_objects` not `business_assets`; `node_type='ASSET'` mandatory on read+write; do NOT offer
   IDLE/UNASSIGNED in capture; leave `parent_id`/`domain` null; no client-side AI keys.

6. **QR decode path = PATH A (own-QR-labels) — DECIDED.** The platform GENERATES a QR encoding a
   unique item/lot id (reuse Cultivar's existing `qr/generate.ts`); scanning resolves the id,
   tenant-scoped under existing RLS; operator adds qty/cost → confirm → write.
   - **Path B (read manufacturer labels via Gemini vision)** is DEFERRED — a later increment for
     hardware with real UPCs. Andrew does NOT build it now and does NOT pause to ask.
   - Reasons: fits LAWNS (plants have no manufacturer barcode; you tag lots); resolves to a stable id
     we control; reuses proven Cultivar QR-gen.

7. **Inventory-capture QR is SEPARATE from the customer-facing plant-tag QR.** The existing
   `/plant/:tagId` customer buy-page QR (already live) is a different system, different user, different
   purpose. Andrew's capture QR is operator-facing, internal, tenant-scoped. Build capture with its own
   QR now. (Whether they ever share a physical tag is deferred — see Open item below.)

8. **Substantiation column = Option 2 (confirmed this session).** `cost_objects` gets, via the
   activation migration: `substantiation text NOT NULL DEFAULT 'OWNER_ASSERTED' CHECK (IN
   'SUBSTANTIATED','OWNER_ASSERTED')` + `receipt_id uuid REFERENCES receipts(id) ON DELETE SET NULL`.
   This is the second D-5 axis the capture widget SETS: scanned-with-receipt-link → SUBSTANTIATED +
   receipt_id; typed → OWNER_ASSERTED. (Pending: the migration applying — see Blockers.)

---

## OPEN — still needs David's decision (do NOT hand Andrew a package with these unresolved)

1. **Same-tag vs. separate-tag (deferred, not blocking the build).** Should the operator-capture QR
   and the customer-facing plant-tag QR ever be the **same physical tag** (customer scan = buy-page,
   operator scan = capture mode), or stay **separate codes**? Decided to BUILD capture with its own QR
   now (so it does not block Andrew), and treat same-tag-or-not as a **later, informed UX decision**
   David makes after using the capture flow. → *Open, but explicitly does NOT gate Andrew's build.*

2. **Catalog import on autopopulate — does the AI read their existing site to pull the catalog in, or
   do they start fresh?** (Raised re: the autopopulate/one-click vision.) → *This is the
   customer-acquisition layer, NOT Andrew's build. Belongs to the CONCEPT doc, not the Andrew package.
   Noted here only so it is not confused into Andrew's scope.*

3. **The general "kill all hanging chaff" rule for the package.** When the onboarding package is
   assembled, scan it for ANY remaining "pending / TBD / ask David" and resolve them ALL in one pass
   before it reaches Andrew. A handoff doc must be buildable end-to-end without David in the loop;
   every "decide later" is a future interruption. → *Process instruction for package assembly.*

---

## BLOCKERS (must clear before the package is assembled)

1. **Schema activation must land green.** The Option-2 ALTER + the held Core-1 migration `20260615`
   must be applied to the live DB (`bgobkjcopcxusjsetfob`) and verified (catalog gate +
   `verify-cost-objects.mjs`). Andrew's package describes a schema contract — it must describe the
   REAL, live, two-axis `cost_objects` table, not a pending one. **Chosen apply path: Option 2 — David
   runs the ALTER in the Supabase SQL editor, then gives Thunder a PAT scoped only for the STEP-3
   verify (independent catalog proof; builder doesn't grade own homework).** *Status as of capture:
   the apply was in flight / not yet confirmed green — VERIFY THIS before assembling the package.*

2. (After activation) optional: seed a little real data (CoolRunnings hardware) so Andrew can test
   end-to-end. Separate step, not part of the migration.

---

## How Andrew works with the repo (to spell out in the package)
Branch/PR flow — Andrew commits to git, David/Thunder review. Define his lane (what he touches vs.
off-limits — Ignition is off-limits; the shared spine needs care). The two-bar rule in human terms:
BUILDER-COMPLETE vs OWNER-PROVEN; and **nav-reachable, not URL-only** (wire the tile — don't repeat
the /assets/pmi/inventory nav-dead pattern). This is the engineering-yourself-out motion: Andrew gets
a contract to build against, not prompts to carry.

## Docs Andrew gets (curate, don't dump)
Required (with a one-line "why it matters to your build"): STANDARDS.md; Architecture Constants
AC-1..AC-4; operating principles that touch his build (Honest Debt, Verify-Before-Build, Surface
Honesty); the governing decisions (D-5 two axes; D-9 KNOW/THINK/REASON/NEED-CLARIFICATION honesty
contract; D-7 classify-by-event). Reference-only (where to find, not required upfront): full
DECISIONS.md, tech-debt-log.md, built-inventory.md, PLATFORM_STRATEGY.md. Do NOT hand him CLAUDE.md
(Thunder's operating doctrine, not a human dev's).
