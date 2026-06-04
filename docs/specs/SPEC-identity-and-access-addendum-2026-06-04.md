# ADDENDUM to SPEC — Identity & Access: Roles, Tiles, and Local-First Sync

**Date:** 2026-06-04 (late session — design capture, NOT a build order)
**Status:** DESIGN CAPTURE. To be folded into `SPEC-identity-and-access-2026-06-04.md` next session, rested. Nothing here is built tonight.
**Why separate file:** captured at end of a long session while the thinking was crystallized. Integrate next session.

---

## A. RBAC — People → Roles → Tiles

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

### Where this lives
RBAC belongs IN the Identity & Access spec — roles ARE part of access. Fold Section A into the spec (likely a new Section between current §4 reconciliation and §5 recovery, or as §4b).

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
Roles, tiles, devices, and offline-sync are all the same architectural move seen all session: **shared structure, vertical variation lives in data (config), never in divergent code.** RBAC role→tile mapping is per-vertical *config*; the role vocabulary is shared. Offline-sync is a shared capability promoted out of one vertical. Every one of these is "build/own it once in shared, verticals consume via `business_modules` + config, stop copying."

---

*Capture complete. Integrate into the I&A spec next session, rested. Build nothing tonight.*
