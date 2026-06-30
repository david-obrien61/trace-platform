# Schema stress battery — production findings (`business_inventory` identity model)

**Date:** 2026-06-30
**Source:** Adversarial schema stress battery on `business_inventory` (identity model = name + `variant_group` + `size`), run live against the demo DB with reload-to-clean-111 between cases. CLOSE-OUT-LEDGER #73 (battery) / #74 (CASE 5 fix).
**Status of this doc:** findings banked — **OWED, NOT blocking. Do NOT build from this doc without an explicit go.** Each finding carries its own status below.

The model HELD on all 6 cases. These are the three findings worth keeping so they don't slip — two latent production risks (CASE 3, CASE 1) and the resolution record for CASE 5.

---

## Finding 1 — CASE 3: resolve-path tenant isolation is an app-level filter, not RLS

**Status: 🟡 OPEN — AC-3 decision owed (holds today; do not build yet).**

**What the battery showed.** Same-name rows in two different businesses do NOT leak across tenants on the count/resolve path. But the fence that stops the leak is the explicit `.eq('business_id', businessId)` filter in `handleScan` (`InventoryCount.tsx` L4 resolve query) — **not RLS alone.** The battery confirmed this with a service-key client (which bypasses RLS): the leak was still prevented, because the query filter is the actual boundary. Real anon-client users get RLS (member-scoped) as a *second* layer, but any service-key / admin / server path relies **solely** on the application filter.

**Why it matters.** "RLS protects us" is a narrower truth than it reads. If a future resolve path is written without the `.eq('business_id')` filter — or runs under the service key (as `populate`, `ingest`, and the seed scripts already do) — the only thing standing between tenants is that the developer remembered the filter. That's a correctness-by-vigilance posture, not a structural guarantee.

**Decision owed (AC-3).** Does the resolve path need an **RLS-backed** tenant guarantee, not just a query filter? Options to weigh when revisited:
- Accept the app-filter fence and add a lint/review checklist item ("every `business_inventory` resolve query is `business_id`-scoped").
- Require resolve to run under the anon/member client (RLS-enforced), reserving the service key for writes only.
- Add an RLS policy that makes a missing `business_id` filter fail-closed rather than fall back to a cross-tenant scan.

**Do NOT build.** Banked for an AC-3 review. It holds today.

---

## Finding 2 — CASE 1: populate is full-REPLACE and the DISC- SKU is positional → never key identity on the SKU

**Status: 🟢 LESSON RECORDED — guardrail, no build owed (revisit only if a writer keys on SKU).**

**What the battery showed.** A re-populate is a **full per-business REPLACE**: `clearDiscovery` deletes **every** `DISC-%` row for the business, then rebuilds from the fresh extract. It is idempotent by construction (4 size rows → re-run → still 4, never doubled), and manually-added non-`DISC` rows survive. But the SKU is **positional** — `DISC-${1001 + index}`, where `index` increments per emitted row. So **which SKU maps to which (variety, size) is NOT stable across re-populates** if the extraction order shifts (a site reorders products, a category is added, the AI returns items in a different order).

**Why it matters.** The stable identity of a catalog row is its **slug-derived `variant_group`** (e.g. `shoal-creek-vitex`), plus `name` + `size`. The `DISC-####` SKU is a positional, regenerated-on-every-populate label — it carries no durable meaning across runs.

**Lesson (the guardrail).** **Never key anything on the `DISC-` SKU** — not a QR encoding, not a foreign reference, not a join, not a count record, not a print label. If something needs to point at a catalog row durably, key it on the slug/`variant_group` (+ `size`) or a real stable PK (`business_inventory.id`), never the `DISC-` SKU. Re-populate will reshuffle SKUs; it will not reshuffle slugs.

**Do NOT build.** No change owed today. This is a standing constraint to enforce in review whenever a new writer/reader touches `DISC-` SKUs.

---

## Finding 3 — CASE 5: dup-size silent dead-end (RESOLVED via Option A; B/C decided)

**Status: 🟢 HARDENED (Option A shipped, ledger #74) — owner-prove owed; B = fast-follow; C = decided-against-for-now.**

**What the battery showed.** Two rows sharing one `variant_group` + the **same** `size` make a variety silently uncountable-by-scan: `detectSizeCollision`'s all-distinct check fails → the resolve falls to UNKNOWN, **indistinguishable in the UI from a never-scanned item.** Real imports will produce this.

**Resolution — Option A (shipped, ledger #74).** Detect the `(variant_group, size)` collision at populate **WRITE time** and **surface** it (`findDuplicateSizeGroups` → `[TRACE:POPULATE] data-quality:dup-size` + `PopulateResult.dataQuality.dupSizeGroups` + `raw_extract.counts` + the ingest `action=populate` response). `detectSizeCollision`'s refuse-to-guess is UNCHANGED — we detect + surface, never dedupe or auto-pick; both rows are still written. The owner sees it in the populate report before it ever reaches a count.
  - **Owner-prove still OWED:** a real populate showing `dupSizeGroups` behavior — which will happen when we populate Lauren's catalog for the demo.

**Option B — count-time distinction (deferred, fast-follow).** At resolve/count time, distinguish a "dup data-quality" UNKNOWN from a "never-seen" UNKNOWN so the unknown sheet can say "this variety has a data issue (duplicate sizes)" instead of a generic UNKNOWN. App-code only, but it touches the **demo-critical count path** and the clean demo catalog won't trigger it → **fast-follow, not pre-demo.** Build when dups are observed in the field or when the count UX gets a hardening pass.

**Option C — DB unique constraint on `(business_id, variant_group, size)` (decided AGAINST for now).** A unique constraint would **hard-reject** the write — for a messy real import, a single dup row would fail the whole batch insert unless the writer handles partial failure. That's too hard a stop for the "ingest a grower's imperfect catalog" path we're optimizing for. **Decision: not now.** Revisit if dups become common in practice (then pair it with partial-insert / upsert-and-flag handling so one dup doesn't sink the batch).

---

## Cases that HELD (no action) — for the record

- **CASE 2** — populate idempotency: `clearDiscovery`-first makes re-runs stable (4 → 4, never 8).
- **CASE 4** — same name, NULL `variant_group`: collision rule requires a shared non-null group → picker correctly does NOT fire → UNKNOWN (surface-don't-presume).
- **CASE 6** — vocabulary clash (`7 Gallon` vs `2" cal` in one group): free-text `size` column holds both; picker fires offering both. No enum/ontology choke — the open size vocabulary is the right call.
