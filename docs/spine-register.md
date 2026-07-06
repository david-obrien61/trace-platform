# TRACE — Spine-Capability Register
# The living inventory of AGNOSTIC platform capabilities and their spine-vs-vertical status
# Last updated: 2026-07-06 (created — initial inventory from known context under D-31)

**Purpose:** built-inventory answers *"was X ever built?"* (built/unbuilt, per-capability). This register answers a
**different axis** — *"is this agnostic capability correctly on the SHARED SPINE, or is it at risk of being rebuilt
per-vertical?"* It is the "don't rebuild instance #2" artifact for [[D-31]] (platform DB + spine-first). Every build
gets evaluated against it: a capability that BELONGS on the spine but is trapped in a vertical folder is drift to fix,
not a fact to accept.

**This is a LIVING register — updated as builds land, like built-inventory.** When a capability moves from
vertical-trapped → shared, or a net-new spine capability ships, update its row here.

**The spine-first test (from [[D-31]], the rule this register scores against):** *"would every vertical need this, AND
is it free of vertical-specific meaning?"* → yes = build it in the shared spine, agnostic (flag-gated for opt-in),
never in a vertical folder. Bias toward spine.

**Status legend:**
- **shipped-shared** — lives in `packages/shared` (or the platform DB spine), consumed agnostically by verticals. Correct.
- **partial** — spine foundation exists but is incomplete, or one piece is still net-new / vertical-local.
- **vertical-trapped** — an agnostic capability currently living in a vertical folder / vertical auth / vertical table; AT RISK of per-vertical rebuild → drift to correct.
- **net-new** — identified as spine-worthy, not yet built.

> ⚠️ **Statuses below are the INITIAL inventory from known context (handoff ledger + DECISIONS + CLAUDE.md), NOT a fresh
> code audit.** Rows marked *(status unverified — recon owed)* need a grep/read pass to confirm. This is the starting
> map; deep per-capability audit is future recon.

---

## The register

| # | Capability | Current state (one line) | Spine-vs-vertical status |
|---|---|---|---|
| 1 | **Robust device-auth** (enrollment, `is_active` lockout, multi-device) | `member_devices` shipped; the device-auth build in flight lands in shared `BusinessProvider`, flag-gated ([[D-30]], [[D-31]] worked example). | **partial** — shared + flag-gated by design; `is_active` lockout enforcement unverified — recon owed. |
| 2 | **Person ↔ membership ↔ device model + PIN-hash + WebAuthn credential** | Schema shipped (person/membership/device); PIN-hash present; WebAuthn credential persistence is net-new (D-30 flavor 2). | **partial** — model on spine; credential-persistence piece net-new. |
| 3 | **Roles / permissions (OWNER/MANAGER/STAFF) + auth session** | `can()` chokepoint in shared `BusinessProvider`; `role_definitions` 3-tier store (floor/override/custom); RoleConfig console. | **shipped-shared.** |
| 4 | **Multi-tenancy: `business_id` scoping + RLS (universal)** | `is_active_member()` canonical primitive; owner/member RLS standardized across member-scoped tables ([[AC-2]]/[[AC-3]]). | **shipped-shared** (platform DB spine). |
| 5 | **Cost/margin engine** (`MarginEngine` + cost-to-produce + leakage/actor) | `MarginEngine.ts` stateless shared calculator both verticals feed; cost-object spine + count-once seam shipped. Margin STORAGE fragmented ([[D-13]] deferred). | **partial** — engine shared; storage consolidation deferred. |
| 6 | **Capture / OCR pipeline** (ReceiptKeeper + invoice OCR→infer→route) | `api/receipts/ocr.ts` shape-param multiplexer (receipt/invoice/asset); ReceiptKeeper live; capture-invoice launcher owner-proven (ledger #85). | **partial** — engine agnostic; the ReceiptKeeper PAGE + launcher live in cultivar-os (would move/skin when a 2nd vertical captures). *(status unverified — recon owed on the page's vertical-coupling.)* |
| 7 | **Offerings / commerce engine** (`service_offerings` + cart; TRACE-as-merchant) | Cart/checkout + QBO invoice path live in cultivar-os; `service_offerings` seed path exists. | **vertical-trapped** — commerce logic sits in cultivar-os today; spine-worthy. *(status unverified — recon owed.)* |
| 8 | **Sync / offline** (`packages/shared/src/sync`) | `SyncEngine` / `OfflineQueue` / `NamespacedStore` built NEW in shared 2026-06-26 (ledger #54); walk-and-count consumer live ([[D-29]]). DataBridge stays donor-reference. | **shipped-shared** (platform-wide adoption ongoing). |
| 9 | **Connector framework** (`platform_config` swappable) | OCR provider chain + connectors swappable via `platform_config` (MB_D-009); API-neutrality classing ([[D-28]]). | **shipped-shared.** |
| 10 | **Tile / entitlement registry** (`tileRegistry` + `business_modules`) | Vertical-aware code registry; `useModules` scopes by vertical; `business_modules` per-tenant enablement. | **shipped-shared** — registry HOME is cultivar-os code today; agnostic by design. *(status unverified — confirm the registry module's package home; recon owed.)* |
| 11 | **Notifications** | `packages/shared/src/notifications` (send/queue + templates). | **shipped-shared** (templates are per-vertical data, correctly). |
| 12 | **QR** (generate + print) | `packages/shared/src/qr`. | **shipped-shared.** |
| 13 | **Formatters / utils** (currency, dates, `normalizePhone`, statusColors) | Shared utils barrel; `normalizePhone` consolidated (rule-of-three, 2026-06-24). | **shipped-shared.** |
| 14 | **DataSheet engine** (generic `DataSheet<T>` grid) | `packages/cultivar-os/src/components/datasheet/DataSheet.tsx` — presentation-only, table-agnostic; 3 consumers (inventory, assets, customers). | **vertical-trapped** — genuinely generic but lives in cultivar-os; spine-worthy (3rd consumer proves it). *(status unverified — recon owed on move to shared.)* |

---

## How to read the drift signal

The **vertical-trapped** rows (7 offerings/commerce, 14 DataSheet engine) and the *(status unverified)* flags are the
watch-list: agnostic capabilities that a future build could accidentally re-implement per-vertical instead of promoting
to shared. Under [[D-31]] the correct move for each is **promote to `packages/shared`, flag-gated**, not rebuild. Do NOT
deep-audit each here — that is future recon; this register is the initial map that makes the drift visible.

**Companion:** [[D-31]] (platform DB + spine-first — the decision this register serves) · `docs/built-inventory.md`
(the built/unbuilt axis this complements) · `docs/DECISIONS.md` [[AC-1]]/[[AC-2]]/[[AC-3]] (the schema + isolation floor).
