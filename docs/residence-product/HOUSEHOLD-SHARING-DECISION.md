# Decision Record — Household Sharing Model (Kitchen Loop tile)

> We don't replace your systems. We connect them, surface what matters, and fill the gaps you couldn't fill yourself.

**Status:** Proposed (prototype-stage; not yet a Thunder build)
**Scope:** The household inventory/menu/cost tile, working name "Kitchen Loop."
**Author seat:** Lightning (strategy/prompt). Execution belongs to Thunder against the monorepo.

---

## 1. The problem

The tile must be usable by multiple people with different relationships to different
physical households, with different edit rights, and with some items visible to
everyone and some not.

Concrete cast (real):
- **David** — owner, Liberty Hill house.
- **Regina** — member, Liberty Hill. Should *view* the menu, not edit it.
- **Erin** — member of Liberty Hill **and** owner of her own travel-nursing household;
  needs to see home inventory while away and run her own kit on the road.
- **Connor** — owner of a separate Colorado household; his **renter** is a member there.
  Connor and the renter split some groceries (shared) and keep some personal.

## 2. Decision

Reuse the existing multi-tenant auth pattern already shipped in
`packages/shared/src/auth/` (BusinessProvider: owner path + member fallback;
membership-scoped RLS; verified cross-tenant isolation). Point it at a **residence**
instead of a business. This is consistent with the residence-rooted node model
(small businesses are emergent children of the residence — a household is just the
smallest business, with suppliers and a menu instead of customers).

Three-table shape (mirrors the business layer):

- **household** — the unit inventory belongs to. (Liberty Hill; Connor-CO; Erin-travel.)
- **membership** — links a person to a household with a **role**. One person can hold
  several memberships (Erin: member of Liberty Hill + owner of Erin-travel).
- **role** — drives permissions:
  - `owner` — edits the menu, confirms the week, manages members.
  - `member` — views the menu (read-only until owner confirms), updates inventory
    levels, adds to the shopping list.
  - `viewer` — read-only.

The menu-permission requirement ("Regina looks at the menu; David changes it; once
confirmed we execute off it") is a **role** distinction enforced by RLS, with the UI
hiding controls a role cannot use. Menu stays owner-controlled through a
draft → **confirmed** state; execution (cook-the-week, deplete, generate orders)
runs off the confirmed menu.

## 3. New wrinkle vs. the business model: shared vs. personal items

Within one household, an item is either:
- `shared` — split among members (Connor + renter groceries; all house consumables).
- `personal` — belongs to one member; not surfaced to other members/viewers.

This is the same shared/personal distinction already present in the persistent-storage
layer, applied to an inventory row. **One flag on the item.** Do not build the
grocery-split math now (Connor owns that math); just don't make a schema choice that
blocks it.

Alcohol (wine/spirits) is the clearest reason this matters beyond convenience:
it should default to `personal` / not-visible-to-viewers, and must never surface to a
viewer who is a minor. Designing scope + role in from the start avoids a retrofit.

## 4. Explicitly NOT in scope now

- Multi-user is **not** prototyped in the single-session React tile. Mocking it would be
  fake and teach nothing real. It lands in the Thunder build on the shared auth spine.
- Grocery-cost-splitting math (Connor's household) — supported by the `shared` flag,
  not implemented.
- Login UX (same PIN, stay-logged-in, Face ID) is a standard mobile-auth build detail,
  not an architecture question.

## 5. Login experience (build detail, captured for completeness)

Same credential across people on a shared device path; persistent session; biometric
unlock (Face ID / fingerprint). Identity still resolves to a specific membership so
role + scope apply correctly per person.

## 6. Why this fits the platform

- Reuses shipped auth — promote + consolidate, not rebuild (same posture as Ignition).
- Residence-rooted, on-prem-friendly, no new tenancy concept.
- Loose coupling: the tile is a capability that *optionally* connects to CoolRunnings
  (e.g., a freezer-temp sensor flagging "eat the lamb first"), never depends on it.
