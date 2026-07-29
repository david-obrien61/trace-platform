# Platform Architecture Standard — how this platform BUILDS a surface

**Last updated: 2026-07-29**
**Status: BINDING.** Companion to [`ui-control-standards.md`](./ui-control-standards.md) (which is the
bar for CONTROLS) and to `STANDARDS.md` (STD-001…024, which are checks). This doc is the missing third:
**the shape of a CRUD surface before anyone writes one.**

---

## Why this exists

`STANDARDS.md` has 24 entries and **every one is reactive** — STD-021 came from a wrong corpus, 022 from
a detector that could never fail, 023 from a bypassed guard, 024 from a cap that had never run red. They
are scars. **Not one of them says how to build a surface.**

That gap has a cause. A framework normally supplies this discipline structurally: Rails, Django and
Spring each hand you one form object and one data-access layer, and going around them is work.
**Supabase supplies none of it.** `supabase.from('x').update()` compiles from any component, with no
wiring, no registration, and no layer to route through. Nothing resists a second write path.

And the failure mode is specific: **a session that cannot see the other sessions.** Every duplicate
below was built correctly in isolation, against no rule saying what the shape should be. Seven write
paths to `customers`; six field lists; two commit models on one component; `cost_objects` read through
four different hand-written column lists. Nobody was careless. There was no rule.

**The unit this standard defends is the ENTITY.** An entity is not a table — it is a table plus the one
module that owns writing to it, the one declaration of its fields, the one place its rules live, and the
one component that edits it. When those four drift apart, everything above happens.

---

## The rules

Each rule states its **CHECK**. Where there is no mechanical check, it says so plainly — an unenforced
rule is still a rule, but pretending it is enforced is how a standard rots.

### A1 · ONE SURFACE PER ENTITY

A record has **one form component**. A different context (a modal over a delivery card, a detail page, a
grid row action) **mounts that component**; it never reimplements it. Contexts vary *presentation* —
title, which groups are visible, where it floats — never the *component*.

- **CHECK:** none mechanical. **UNENFORCED TODAY.** Caught only by review, or by A4's registry when a
  second surface needs its own field list.
- **Counter-example, ours:** `customers` has three edit surfaces — `CustomerPartyEditor`,
  `CustomerEditModal`, `CustomerCapture`. The first two are the same record with the same rules;
  the second exists because "small change, close, stay on the route" felt like a different need.
- Restates `ui-control-standards` **E1**. Read it there for the full statement.

### A2 · ONE WRITE PATH PER TABLE — MACHINE WRITERS INCLUDED

Every write to a table goes through **one module**. A path is a *file*, not a call site. **Server-side
resolvers, upsert helpers and ingest paths are not exempt** — they are the ones nobody watches, so they
get the same field list (A4) and the same validation (A6) as a human-facing form, not their own.

- **CHECK: ✅ ENFORCED — `npm run verify:write-paths`, chained into `npm run verify`.** 37 planted
  probes; GOAL reports one-path-per-table, RATCHET fails the build on any NEW undeclared path. An
  intentional second path is DECLARED with its reason in `ALLOWED_DIVERGENCE`.
- **Known limit, printed every run:** the cap reads source, so RPC targets are resolved from migration
  bodies **one hop deep**; two hops, `EXECUTE` bodies, and functions created outside the migration path
  are named as gaps, not silently absorbed. Counts are a **floor**.
- **Counter-example, ours:** `customerUpsert` wrote the legacy address columns while the form wrote the
  canonical ones — two writers, one fact, no precedence rule, so the invoice printed one address and the
  delivery route showed another.

### A3 · ONE COMMIT MODEL PER SURFACE — THE SHAPE DECIDES

A **datasheet cell** commits immediately (the cell is the unit of work). A **panel where the whole record
is the unit of work is a FORM** — it buffers and commits on one explicit Save. A surface applies its
model to **every field group AND every mode**: create and edit are the same record shape and must not
differ.

- **CHECK:** none mechanical. **UNENFORCED TODAY.**
- **Counter-example, ours:** `CustomerPartyEditor` — one component, same 18 fields, same dialog, whose
  commit model changed with a prop: create buffered to a Save button, edit auto-saved per field.
- Restates `ui-control-standards` **E2**, which carries the worked example (Tier/Status live on both the
  grid and the form and commit differently — correct, because the unit of work differs).

### A4 · ONE FIELD LIST PER ENTITY, DERIVED

The select columns, the editable set, the form's groups, and the create payload all derive from **one
declaration**. Reads included — a hand-written `.select('a,b,c…')` is a field list.

- **CHECK:** none mechanical. **UNENFORCED TODAY.** A cap is buildable (compare `.select()` column
  strings against the entity's registry) and is not built.
- **Counter-example, ours:** `customers` had six parallel lists; `cost_objects` is read today through
  **four different hand-written column strings** in four files.
- **Why it bites silently:** a field added to the form but missed in the select reads back `null`
  forever, and nothing in the codebase can notice.
- Restates `ui-control-standards` **E6**, including its clause binding non-panel writers.

### A5 · ONE DESIGN SYSTEM

Controls, spacing, dialogs, empty states and error states come from **shared components**. A screen that
looks different from its neighbours is a **defect, not a style**. Fix the shared control so every
consumer inherits; never copy it into a consumer.

- **CHECK:** none mechanical. **UNENFORCED TODAY.** The rendered board `/ui-standards.html` shows
  control × standard but does not fail a build.
- **Counter-example, ours:** two components carry their own `const overlay` / `const dialog` style
  objects instead of the shared modal; **10 of 99 `.tsx` files import `sheetStyles`**, which is the
  honest measure of how far the shared vocabulary actually reaches.

### A6 · VALIDATION LIVES WITH THE ENTITY, NOT THE SURFACE

A rule about what a *customer* is belongs to the customer module, where every writer — human or machine
— gets it. A rule about what *this screen* needs (a field is required to proceed here) belongs to the
surface. Do not confuse them.

- **CHECK:** none mechanical. **UNENFORCED TODAY.**
- **Counter-example, ours, and it is the clean one:** `CustomerCapture.tsx:102` owns a private
  "phone must be exactly 10 digits" rule. It is an *entity* rule living on a *surface*, so no other
  writer honours it — and at `:166` the same file silently drops a phone that fails it. A rule enforced
  in one of five places is not enforced.

### A7 · A GATE NAMES A STRING THAT EXISTS

A route gate, a tile's `required_permission`, or an RLS policy names a permission string that the
manifest still declares. A gate on a retired or never-existent string is not a gate — it is either
always-open or always-shut, and both look like working code.

- **CHECK: ✅ PARTIALLY ENFORCED — `verify-universals` capP/capQ** assert the `resource:action` model
  and the declared-unwired invariant from source. **The gap #164 named is still open:** every negative
  assertion scans for what the model USED TO declare; none scans for what it NO LONGER declares.
- **Counter-example, ours:** a nav entry gated on a string that had not existed for four days; and three
  `assets:*` strings minted into a live tenant for a resource whose table was renamed six weeks earlier.

---

## How this is enforced

1. **A2 fails the build today.** A1/A3/A4/A5/A6 do not. That asymmetry is stated, not hidden — three of
   the six are review-only, and the honest consequence is that they will drift between reviews.
2. **A build spec names the entity it touches** and confirms the entity already has its surface (A1),
   its write module (A2), and its field list (A4) before adding any of them. *"Does this record already
   have one?"* is the question that was never asked.
3. **A new rule here needs a counter-example from our own code.** This doc is not aspirational; every
   rule above is a shape we already broke at least once.
4. **The measurement lives beside it** — [`platform-architecture-audit-2026-07-29.md`](./platform-architecture-audit-2026-07-29.md)
   scores every entity against A1–A7 and carries the ordered backlog.
