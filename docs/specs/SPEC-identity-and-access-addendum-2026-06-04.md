# ADDENDUM to SPEC — Identity & Access: Roles, Tiles, and Local-First Sync

**Date:** 2026-06-04 (late session — design capture, NOT a build order)
**Status:** DESIGN CAPTURE. To be folded into `SPEC-identity-and-access-2026-06-04.md` next session, rested. Nothing here is built tonight.
**Why separate file:** captured at end of a long session while the thinking was crystallized. Integrate next session.

---

## A. RBAC — People → Roles → Tiles

### STATUS CORRECTION — this capability ALREADY EXISTS in Ignition
**RBAC role→tile assignment is already built and working in Ignition** (not a from-scratch design). Confirmed by David this session: Ignition can create a role (e.g. `front_office`), assign it its own set of ~4 tiles; create `tech` with a *different* 4 tiles; create `sr_tech` with 5 tiles. People are assigned roles; roles drive which tiles they see. The core People→Roles→Tiles model below is **implemented**, not proposed.

Therefore this is the SAME story as DataBridge / auth / SM: a real working capability trapped in one vertical that must be **audited for completeness, then PROMOTED to shared** so Cultivar/KINNA consume it — NOT rebuilt. The "extent not yet identified" gaps (David's words) are the *extensions* on top: the Lexicon layer (§A.1) and formalized role-levels (§A "role levels"). The base mechanism exists.

**Two things to VERIFY first (read-only audit, next session — do not assume, we were burned twice this session asserting un-checked schema):**
1. **What backs Ignition's role→tile assignment?** Is it the per-member `permissions` jsonb (the `["ADMIN","TECH","VIEW_ALL"]` array seen on `shop_members`/`business_members`), OR a dedicated roles table + role-tiles mapping table? — If per-member jsonb arrays: that's the drift-prone version; promotion must ALSO refactor to role-derived (a member has a role; the role implies tiles — not per-member arrays). If a real roles/role-tiles table exists: closer to correct, promote the mechanism.
2. **Is the role→tile mapping per-business or global?** When `sr_tech` got 5 tiles, was that config for JB Auto specifically, or a platform-level role definition? — Determines whether promotion is "lift the mechanism" vs. "lift the mechanism AND make it per-business configurable." (Likely want: platform default role→tile sets, per-business override.)

This audit folds into the existing blast-radius map (the same Ignition-only surface).

### The three things (kept separate on purpose)
These are commonly conflated; keeping them distinct is what makes access work identically across all verticals.

1. **People** — humans. Exist as `business_members` rows. (David, Lauren, Erin, a tech.)
2. **Roles** — named buckets of permissions. **Shared/platform-level vocabulary, same across ALL apps:** Owner / Manager / Tech / Staff.
3. **Tiles** — the capability surfaces (NEW RO, ESTIMATES, INVENTORY, ADMIN, …). What a person can see and do.

### The relationship (the whole point)
**People are assigned Roles → Roles are granted Tiles.** NOT people-assigned-tiles directly.

The indirection is the value:
- Hire a tech → assign role "Tech" → they automatically get the right tiles. No hand-picking per person.
- Decide techs should see a 4th tile → change the *role's* mapping once → every tech gets it.
- This is AC-4 (settle once, encode as variable) applied to permissions.

### Single source of truth: role implies permissions — do NOT store per-member permission arrays
- Tonight's `business_members.permissions` jsonb held a hand-entered array (`["ADMIN","TECH","VIEW_ALL"]`). Per-member arrays are how permissions DRIFT (every member hand-maintained = duplication-with-divergence, the disease fought all session).
- **Target:** a member has a `role`; the role implies the tile/permission set. Derive permissions from role, don't store them per member.
- Decision to confirm at build: keep `permissions` jsonb as an optional *override* slot (rare exceptions, documented), or drop it entirely in favor of pure role-derivation. Lean: pure role-derivation; add override only if a real case demands it.

### What's shared vs. what's per-vertical config (AC-1)
- **SHARED:** the role enum (Owner/Manager/Tech/Staff), `business_members.role`, the permission structure, and the *mechanism* of role → tiles.
- **PER-VERTICAL CONFIG (data, not code):** *which* tiles each role maps to in *this* vertical. "Tech" in Ignition (works ROs in the bay) ≠ "Tech" in Cultivar (works nursery houses) — same role name, different tile set. Encode the role→tile mapping as data (e.g. in `business_modules` / a role-tiles config table), never hardcoded per app.

### Role → Tile sketch (starting point — NOT final)
| Role | Sees |
|---|---|
| **Owner** | All tiles, including ADMIN |
| **Manager** | All tiles EXCEPT ADMIN |
| **Tech** | ~3 tiles (job-execution: e.g. NEW RO, TECH EVAL, WORKFLOW — confirm per vertical) |
| **Staff** | **TBD — do not guess.** Decide deliberately next session. |

> Staff's tile set is explicitly undecided. Flag, don't fill.

### Role levels / hierarchy (sub-roles carry more capability)
Roles are not necessarily flat. Some roles have **levels** where a higher level carries MORE tiles/capabilities — higher pay grade = more responsibility = more access. Example:
- `tech` may split into `jr_tech` → `tech` → `sr_tech`, each a DISTINCT canonical role with a progressively larger tile/permission set.
- `sr_tech` genuinely sees more than `jr_tech` — this is a real permission difference, NOT just a label.

Design implication: the canonical role set is not 4 flat roles; it's a set that can include leveled sub-roles. Each level is its own canonical `db_name` (`jr_tech`, `sr_tech`) with its own role→tile mapping. The owner/manager assigns the level; the level implies the capability set (still role-derived, single source of truth — §A "role implies permissions").

Note the interaction with the Lexicon layer (§A.1 below): `jr_tech` and `sr_tech` are distinct canonical roles, but a business may *display* both as just "Tech," or as "Apprentice" / "Lead Technician" — display is skinned, permissions are not. Two systems, both apply.

### A.1 — The Lexicon Layer (`db_name` vs. what the user sees)
The principle David has long described as **`db_name` vs. what a user sees.** Generalize it into a platform layer:

**Every stable internal identifier (`db_name`) can be skinned with a business- or vertical-specific DISPLAY word, configurable by the customer, with zero effect on logic.**

- Roles are the FIRST instance: `front_office` (db_name) → presented as "Concierge" at LAWNS, "Front Desk" at Dave's Auto, "Greeter" elsewhere. Same role, same permissions, same tiles — only the displayed word changes.
- But it applies platform-wide: entities (`customer` → "client" / "grower"), statuses, tiles, work units (`job` → "work order" / "ticket"). Each vertical or business can fit the platform to their own language.

**The inviolable rule:** the system keys off `db_name`, ALWAYS. The display string is config, NEVER load-bearing. Rename "Concierge" → "Front Desk" and nothing breaks, because no code ever matched the display word. The moment a displayed label becomes the thing code checks, you get drift and divergence (rename a role at one business → permission checks break). Never let the label become the key.

**Shape:**
- Stable: `db_name` / canonical key (e.g. `front_office`, `sr_tech`, `customer`, `job`).
- Skin: a per-business (and/or per-vertical default) `display_label` in config.
- Logic (permissions, tiles, queries, RLS): keys off the canonical `db_name` only.

**Role storage implication:** `business_members.role` stores the canonical key (`front_office`, `sr_tech`). A separate lexicon/config holds `display_label` per business. The role model needs canonical-key + configurable-display-label, not a single freetext `role` string.

**Why this is worth extracting:** it lets customers tailor the platform's language to their world without touching code — more flexible, more "fits their needs," on-brand for "make the operator successful." Likely its own small capability (a `lexicon` / `display_labels` config table keyed by `(business_id, db_name) → display_label`, with vertical-level defaults).

### Where this lives
RBAC + Lexicon belong IN the Identity & Access spec — roles ARE part of access, and the lexicon's first instance is role display. Fold Section A (incl. A.1 + role levels) into the spec (likely a new Section between current §4 reconciliation and §5 recovery, or as §4b). The Lexicon layer may also warrant its own short spec since it applies platform-wide beyond roles — reference it from I&A, expand separately if it grows.

---

## B. Local-First / Sometimes-Connected Sync — PROMOTE, do not deprecate

### The requirement (hard, not nice-to-have)
A user must be able to work **offline** and have the app **sync when connectivity returns**, on ALL verticals.
- **Driving case:** the LAWNS manager is away from wifi in the back, working in a nursery house. The app must keep operating offline and sync when she's back in range.
- This is the same shape as Ignition's mobile/bay use. It is NOT Ignition-specific — every vertical has back-of-house / low-signal / mobile operators.

### The realization
**Ignition's `DataBridge.js` ALREADY IS this capability.** The local-first, localStorage-then-sync model (`[DataBridge] SYNC SUCCESS …`) is exactly the sometimes-connected engine. It's just currently:
- trapped inside Ignition (`packages/ignition-os/DataBridge.js`), and
- flagged in CLAUDE.md as "monolith, too coupled to Ignition mobile/local-first."

### The decision — PROMOTE, NOT DEPRECATE
**Do NOT deprecate or delete DataBridge.** It is a working, needed capability in the wrong location. The move is to **promote the local-storage / offline-sync capability bus to `packages/shared`**, because all verticals need it, and **keep only the genuinely-shared bits at the shared level** — leaving behind any truly Ignition-specific scraps.

- ⚠️ Explicit guard for future sessions / Thunder: the CLAUDE.md note "DataBridge — monolith, too coupled, extract pieces as needed" must NOT be read as "delete DataBridge." Read it as "extract and PROMOTE the shared capability; refactor the coupling." The capability survives; its location and coupling change.

### What to promote vs. leave behind (to be audited at build time)
- **Promote to shared (the capability bus):** the local-first store interface (save/get/sync), the offline queue, the sync-on-reconnect loop, the generic state layer. This becomes the shared "sometimes-connected" capability every vertical consumes.
- **Keep/leave Ignition-specific:** anything genuinely Ignition-only (e.g. Ignition's particular `IGNITION_OS_DATA` shape, shop-specific seeds) stays local OR is reshaped to the vertical-agnostic pattern.
- **Known leak to fix during this work:** `IGNITION_OS_DATA` storage key is hardcoded in `packages/shared/src/quickbooks/oauth.ts` (Tech Debt #2, currently OFF LIMITS until post-demo). This is an Ignition-specific key sitting in SHARED QuickBooks code — an AC-1 leak. NOTE (corrected this session): this serves **Ignition's QB stub**, NOT Cultivar's working QuickBooks — Cultivar's QB is not entangled with DataBridge. The leak is real but was mis-attributed earlier; fix it as part of promoting DataBridge, post-demo.

### Scope note
"Sometimes-connected / local-first sync" is big enough to likely warrant **its own spec**, but it is **intertwined with Identity & Access** and must be referenced from it: a *device* (member_devices) operates offline and syncs *identity, role, and state* when reconnected. Device-session + offline-sync are two halves of how a real operator works in the field. Spec them aware of each other.

---

## C. How this connects to the rest of the platform thesis
Roles, tiles, devices, and offline-sync are all the same architectural move seen all session: **shared structure, vertical variation lives in data (config), never in divergent code.** And notably — RBAC, DataBridge/offline-sync are BOTH **already built in Ignition** and need PROMOTING to shared, not building from scratch. The pattern is consistent: real working capabilities trapped in one vertical (built first, because Ignition was the mature reference vertical), now needing extraction to shared so all verticals consume them. The work is audit → promote → make per-business-configurable → wire verticals to consume → stop copying. Lexicon and role-levels are the *extensions* added during promotion.

---

*Capture complete. Integrate into the I&A spec next session, rested. Build nothing tonight. KEY REFRAME this session: RBAC is ALREADY BUILT in Ignition — audit & promote, do not rebuild.*
