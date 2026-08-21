# RECON — THE SEVEN WRITE PATHS TO `businesses` (2026-08-21)

**Type:** RECON. Look only. **No code changed** — zero diff under `packages/`, `api/`, `supabase/`.
**Measured at:** `8e0224f`, clean tree.
**Why now:** measurement `8e0224f` (ledger #188) reported `businesses` at **7 undeclared write paths** —
not among `verify-write-paths`' declared failures, so not tracked debt.
**Why it outranks the rest:** `businesses` is the RLS anchor. `business_id` is what AC-2 scopes to and
AC-3 makes absolute. It also holds `address` (the delivery origin) and `business_type` (which drives
`verticalsForBusinessType`, i.e. **which tiles a tenant sees**).
**Precedent honoured:** `customers` had seven for the same reason, and ledger #168's recorded end state
is a floor of **THREE, not one**. This recon does not assume the answer is one.

---

## 🔴 LIVE DEFECTS — top of report, per instruction. NOT FIXED.

### 🔴 D1 — `scripts/test-member-login.mjs:144` WRITES A COLUMN THAT NO LONGER EXISTS

```js
.from('businesses').insert({ owner_id, name, business_type: 'nursery', tax_rate: 0.0825 })
```

`businesses.tax_rate` was **DROPPED** by `20260727e_drop_businesses_tax_rate.sql:45` (David's ruling:
config wins). The ⚡ ACTIVE STATUS front-page records **`27e APPLIED`**. Against an applied 27e this
INSERT fails with `42703 column "tax_rate" does not exist`, and it is **step 5 of 34** — so
every step after it is unreachable.

**Why it survived:** `test-member-login.mjs` is **not in `npm run verify`** (confirmed — no reference in
`package.json` or `scripts/run-tests.mjs`). It is hand-run. Nothing has executed it since 27e.

⚠️ **Honest limit:** I could not query the live catalog from here. The apply-state is read from the
front-page, not from `information_schema`. If 27e is somehow unapplied, this is dormant instead of live.
**That check is one query and it is not mine to run.**

### 🔴 D2 — `BusinessProvider.tsx:124` TYPES THE DROPPED COLUMN, AND TYPES IT NON-NULLABLE

```ts
tax_rate: number;      // on the `Business` interface
```

The provider selects `select('*')` (`BusinessProvider.tsx:440`), so the field simply arrives absent and
every consumer reading `business.tax_rate` gets `undefined` **while TypeScript promises `number`**.
Nothing crashes today because **no select anywhere asks for `tax_rate`** (verified: zero hits across
`packages` for a select naming it) and the one consumer that matters — `Settings.tsx:227` — has a
comment saying it deliberately reads the rate from `config.taxRate` instead. **The type is the last
place the dropped column still lives.**

---

## HAVE

### The seven paths, and they are three disjoint families

`verify-write-paths` counts a path as a **FILE** (ruling 2026-07-29). Seven app files:
**6 direct writers + 1 RPC caller.** Within them, **8 direct write sites** + 1 RPC path.

**Site keys — canonical form, `path::binding#table.verb`.**

⚠️ **Correction recorded, because it changed the keys:** my first pass called `siteKey()` with the index
of `.from(`, and `tableAt()` scans **backward** for the nearest preceding `.from()` — so it returned the
*previous* statement's table and produced `#business_accounting_secrets.update` for a `businesses` write.
The caps call `siteKey()` with the index of the **verb** (`verify-zero-row-writes.mjs:115`). Re-keyed
from the verb index, these now match `zero-row-writes-baseline.json` exactly.

| # | site key | file:line | verb |
|---|---|---|---|
| 1 | `packages/shared/src/auth/OwnerSignup.tsx::guard#businesses.insert` | `OwnerSignup.tsx:304` | insert |
| 2 | `packages/cultivar-os/src/pages/OnboardingWizard.tsx::newBusinessId#businesses.insert` | `OnboardingWizard.tsx:529` | insert |
| 3 | `packages/cultivar-os/src/pages/OnboardingWizard.tsx::trimmedAddr#businesses.update` | `OnboardingWizard.tsx:608` | update |
| 4 | *(RPC)* `packages/shared/src/pages/Settings.tsx::rpc#set_business_profile` | `Settings.tsx:254` | rpc → update |
| 5 | `packages/shared/src/discovery/DiscoveryGlimpse.tsx::col#businesses.update` | `DiscoveryGlimpse.tsx:183` | update |
| 6 | `packages/cultivar-os/api/qbo/router.ts::db#businesses.update` | `qbo/router.ts:261` | update |
| 7 | `packages/shared/src/quickbooks/refresh.ts::resp#businesses.update` | `refresh.ts:50` | update |
| 8 | `packages/shared/src/quickbooks/refresh.ts::newExpiresAt#businesses.update` | `refresh.ts:63` | update |
| 9 | `packages/shared/src/quickbooks/secrets.ts::writeQBSecrets#businesses.update` | `secrets.ts:87` | update |

**Tooling (counted separately by the cap, and it is where D1 lives):**

| # | site key | file:line | verb |
|---|---|---|---|
| T1 | `scripts/test-member-login.mjs::c#businesses.delete` | `:97` | delete |
| T2 | `scripts/test-member-login.mjs::testBusinessId#businesses.insert` | `:144` | insert 🔴 D1 |
| T3 | `scripts/test-member-login.mjs::bizName#businesses.delete` | `:468` | delete |

---

## Q2 — THE COLUMN MATRIX (the deciding artefact)

`✓` = written · `◑` = written conditionally · `∙` = one column at a time, chosen at runtime · blank = unreachable.

| site | id | owner_id | name | address | phone | email | website | business_type | trial_started_at | accounting_type | accounting_company_id | accounting_token_expires_at | accounting_needs_reconnect | accounting_token | accounting_refresh_token | ~~tax_rate~~ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **1** OwnerSignup insert | | ✓ | ✓ | ◑ | ◑ | ✓ | ◑ | ✓ | ◑ | | | | | | | |
| **2** Onboarding insert | ✓ | ✓ | ✓ | ✓ | | | | ✓ | ✓ | | | | | | | |
| **3** Onboarding addr update | | | | ✓ | | | | | | | | | | | | |
| **4** Settings RPC | | | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | | | | | |
| **5** DiscoveryGlimpse | | | ∙ | ∙ | ∙ | ∙ | | | | | | | | | | |
| **6** qbo/router | | | | | | | | | | ✓ | ✓ | ✓ | ✓ | | | |
| **7** refresh.ts:50 | | | | | | | | | | | | | ✓ | | | |
| **8** refresh.ts:63 | | | | | | | | | | | | ✓ | ✓ | | | |
| **9** secrets.ts | | | | | | | | | | | | | | ✓ | ✓ | |
| **T2** test harness | | ✓ | ✓ | | | | | ✓ | | | | | | | | 🔴 ✓ |

**Read the matrix by column block, and the answer is visible without argument — THREE DISJOINT FAMILIES:**

- **CREATION** (`id · owner_id · business_type · trial_started_at`) — sites **1, 2 only**. No other site
  can reach any of these four columns.
- **IDENTITY** (`name · address · phone · email · website`) — sites **1, 2, 3, 4, 5**.
- **ACCOUNTING** (`accounting_*`) — sites **6, 7, 8, 9**. **Zero overlap with identity or creation, in
  either direction.** The QB family is a genuinely separate act on a shared row.

**The overlap is entirely inside IDENTITY, and it is exactly two sites:**
- **Site 3** writes `address` — a strict subset of what **site 4** (the RPC) writes.
- **Site 5** writes `name`/`address`/`phone`/`email` one at a time via `WRITABLE_COLUMN`
  (`DiscoveryGlimpse.tsx:10-15`) — a strict subset of **site 4**.

Sites 1 and 2 write identity columns too, but as part of an INSERT — a create, not an edit.

---

## Q1–Q11 — EXPLICIT ANSWERS

**Q1. ENUMERATE.** Done above. 9 app sites across 7 files; 3 tooling sites in 1 file. Keys re-derived
from the verb index and cross-checked against `zero-row-writes-baseline.json`, where six of them already
appear verbatim.

**Q2. COLUMN SETS.** Matrix above. Three disjoint families; overlap confined to sites 3 and 5, both
strict subsets of the RPC.

**Q3. REACHABILITY — and this is the question David has been asking from the screenshots.**
🟢 **THE SECTION FILTER HAS NOT FRAGMENTED THE WRITER.** `router.tsx:176` declares **ONE** route,
`<Route path="/settings/:section" element={<Settings />} />`, gated `settings:read`. All four views are
the **same component** with a `section` prop (`Settings.tsx:190`) that filters *which card renders*
(`:554` business · `:594` accounting · `:655` services · `full = !section` at `:208`). The Business
Profile card's Save calls **one** function, `saveProfile()` (`Settings.tsx:245`), which calls **one**
RPC. `/settings/all` renders the same card with the same Save.
The Accounting section does not write `businesses` from the form at all — those columns are written by
the **OAuth callback** (site 6), a machine act. The Services section writes `service_offerings`, a
different table. **Nothing here is fragmented; the appearance of four surfaces is one component.**

**Q4. ONBOARDING + DISCOVERY.** Yes — and a creation writer and an edit writer are legitimately
different acts, which is what I found. **Two creation paths exist:** `OwnerSignup.tsx:304` (modern) and
`OnboardingWizard.tsx:529` (legacy, reached by manual `/onboarding` nav — the comment at `:525` says so).
Both set `owner_id` + `business_type`; they are two spellings of ONE act.
`api/discovery/ingest.ts:213` is a **SELECT**, not a write (`select('name, address, phone, email,
website')`) — it reads the row to compare entered-vs-site. The **write-back** is the client-side
`DiscoveryGlimpse.resolveConflict` (site 5) under owner RLS, and it is explicitly owner-chosen, never
auto-corrected (`DiscoveryGlimpse.tsx:178-179`).

**Q5. THE #168 DEFECT — NOT PRESENT. One line: no site performs an unchanged-check at all, so the
compare-against-the-draft defect has nothing to live in.**
`Settings.saveProfile()` sends all five fields to the RPC unconditionally every time — there is no
`coerceField`, no per-field commit, no comparison. Site 3 writes `address` unconditionally. Site 5
writes the value the owner explicitly chose. Sites 6–9 are machine writes with no form.
⚠️ **`Settings.tsx` has NO `saved`-vs-`draft` split** — one `form` state (`:213`), re-seeded from
`business` by a `useEffect` on `[business]` (`:219`). That is the shape #168 was fixed *into*, and its
absence here is benign **only because nothing compares against it**. Named as a latent structural
difference, not as a defect: an in-flight `reload()` would clobber unsaved keystrokes, and I did not
find a trigger for one mid-edit. **Unverified — say so rather than assert it.**

**Q6. ZERO-ROW WRITES (E5) — one line: SIX of the nine app sites are ALREADY LISTED as unchecked in
`zero-row-writes-baseline.json`, and it is LATENT today, not live.**
The six, verbatim from the baseline: `qbo/router.ts::db#businesses.update` ·
`OnboardingWizard.tsx::trimmedAddr#businesses.update` · `DiscoveryGlimpse.tsx::col#businesses.update` ·
`refresh.ts::resp#businesses.update` · `refresh.ts::newExpiresAt#businesses.update` ·
`secrets.ts::writeQBSecrets#businesses.update`. None checks affected rows.
**Why latent rather than live:** `businesses` has **no member UPDATE policy** — only
`businesses_owner_update ... USING (owner_id = auth.uid())`
(`20260529_businesses_a_create_tables.sql:31-32`) and `businesses_member_select`
(`20260622_is_active_member_canonical_rls.sql:114`, SELECT only). So a non-owner UPDATE matches zero
rows and reports success. **But every member-reachable path routes through the RPC**, which returns
`applied boolean, reason text` and surfaces a refusal (`Settings.tsx:263-267`). Sites 3 and 5 are
owner-only onboarding surfaces; 6–9 run under the service key. **The day a manager reaches a direct
update on this table, six sites become live silent no-writes at once.**
✏️ The RPC itself has no `IF NOT FOUND` after its `UPDATE ... WHERE id = p_business_id`, and it writes a
`success` audit row regardless — **but a bogus `p_business_id` is caught upstream** by
`assert_movement_actor` → `is_member_of`, which RAISEs
(`20260720_inventory_movement_ledger.sql:302-306`). Defended indirectly, not by a row-count check.

**Q7. `tax_rate` — one line: NO app site writes `businesses.tax_rate`, because THE COLUMN IS GONE.**
`20260727e:45` drops it; the rate's home is `business_pricing_config.config->'taxRate'`, written by
`set_business_tax_rate` (`20260727_rbac_resource_action_flip.sql:293`, gated `tax_rate:update`) and by
`mergePricingConfig` from `Settings.saveProfile` (`Settings.tsx:274`). Read side is the narrow
`get_business_tax_rate`. **So the answer to "general writer or its own?" is: its own, on a different
table, with its own permission string.** The only remaining `businesses.tax_rate` writer in the repo is
the tooling harness — **D1**.

**Q8. AUTHORITY-ADJACENT COLUMNS — one line: `owner_id` and `business_type` are CREATE-ONLY in code, and
`business_type` is protected by nothing but the absence of code that writes it.**
- **`owner_id`** — written only by sites 1 and 2, both at INSERT, both to the signing-up user.
  `businesses_owner_insert ... WITH CHECK (owner_id = auth.uid())` makes creating a business owned by
  someone else impossible. On UPDATE, `businesses_owner_update` specifies **`USING` with no
  `WITH CHECK`**; for an UPDATE policy Postgres applies the `USING` expression as the check on the new
  row when `WITH CHECK` is omitted, so `owner_id` cannot be reassigned away. **Implicit, not explicit** —
  and the neighbouring `bm_self_update` fix (`20260623`) added an explicit `WITH CHECK` for exactly this
  legibility reason. Not a hole; worth knowing it rests on a default.
- **`business_type`** — written only by sites 1 and 2, at INSERT. 🔴 **But RLS on this table has no
  column-level restriction, so the owner's own UPDATE policy would permit changing it** — the only
  reason nothing does is that no code does. Given it selects the tenant's verticals, that is a fact
  worth stating plainly.
- **Both are UNREACHABLE from the RPC by construction**, and the migration says so at the line:
  *"THE COLUMN LIST IS THE SECURITY BOUNDARY. owner_id, accounting_*, business_type and everything else
  on this table are UNREACHABLE from here BY CONSTRUCTION"* (`20260727_rbac_flip_corrections.sql:53-55`).
  **This is the model working, and it is the strongest thing in this recon.**

**Q9. MACHINE WRITERS — one line: exactly ONE function writes `businesses` (`set_business_profile`), no
triggers found, and SEVEN IS A FLOOR, NOT A TOTAL.**
Scanned `supabase/migrations/*.sql` for `UPDATE|INSERT INTO|DELETE FROM (public.)businesses`. Three hits:
`set_business_profile` (`20260727_rbac_flip_corrections.sql:56`) — the only standing function writer; and
two one-off data/DDL migrations (`20260529_businesses_c_add_business_id.sql:6`,
`20260622_oauth_secrets_relocation_and_cost_wall.sql:94`) which are not standing writers. **No trigger on
`businesses` appears in any migration.** `verify-write-paths`' rpc→table map already folds
`set_business_profile → businesses ← Settings.tsx`, which is why the count is 7 and not 6.
**Per the standing assumption, 7 is a FLOOR.** The three gaps the cap prints on every run apply here: a
function created outside the migration path is invisible (§6 r17's class — and the schema-snapshot
checker that would catch it is OWED and does not exist); dynamic `EXECUTE` inside a body is unresolvable;
and a transitive write two functions deep is not followed. **NOT CHECKED: the live catalog.** I cannot
query it from here, and `pg_proc` is where a dashboard-created function would be.

**Q10. FIELD LIST — one line: there is no canonical list, and `businesses` carries MORE parallel
enumerations than `customers` did (six) before E6 phase A.**
**Seven write/type enumerations, none derived from another:**
1. `BusinessProvider.tsx:118-131` — the `Business` interface (hand-maintained; **holds the dropped
   `tax_rate`** — D2)
2. `Settings.tsx:213` — the `form` state (6 keys, incl. a `tax_rate` that is no longer on this table)
3. `set_business_profile` SET list — 5 columns, and the one that is *deliberately* authoritative
4. `OwnerSignup.tsx:274-283` — `bizInsert` (4 base + 3 conditional)
5. `OnboardingWizard.tsx:529-535` — the legacy insert (6)
6. `DiscoveryGlimpse.tsx:10-15` — `WRITABLE_COLUMN` (4)
7. `businessGuards.ts:129` — `insertPatch` (`trial_started_at`), merged blind via `Object.assign`

**Plus twenty select sites** carrying **fourteen distinct column lists**, all hand-written. Two are the
same three columns in different order in different files: `qbo/invoice/cultivar.ts:346`
(`accounting_token_expires_at, accounting_company_id, name`) and `qbo/router.ts:307`
(`accounting_company_id, name, accounting_token_expires_at`). ✏️ **The specific #168 hazard — "added to
the form, missed in the select, reads back null forever" — is BLUNTED here but not absent**, because the
two general readers use `select('*')` (`BusinessProvider.tsx:440`, `useBusiness.ts:13`). The narrow
selects can still omit; they just are not the path the app renders from.

**Q11. THE DECLARATION QUESTION — answered from git: `businesses` was NEVER declared.**
`ALLOWED_DIVERGENCE` (`verify-write-paths.mjs:61-108`) has exactly **three** entries:
`business_accounting_secrets`, `business_inventory_ledger` (both approved 2026-07-29),
`business_modules` (declared 2026-08-01, ledger #181). `businesses` is not and has never been among
them — `git log -S` over the file's three commits (`f9f0c97` create, `4e78781` ratchet, `13d920d`
rpc-fold) shows no entry added or removed. **It did not acquire paths after a declaration; it was never
declared.** ✏️ And the count moved for a knowable reason: `13d920d` folded RPC callers into their target
tables, which is what pulled `Settings.tsx` in as the seventh path. Before that fold it was six.

---

## NEED — what must change for A2 to hold

A2 is *"one write path per table, machine writers included."* Given what the acts actually **are** —
not what a merge would be convenient — the matrix supports **three acts, not one**:

- **CREATE** — currently **two** files spelling one act (sites 1, 2). These write the same four
  authority columns. Two creation paths is the `seedPricingConfig` shape that CLAUDE.md §9 already
  records: *"one of them silently producing an unconfigured tenant is exactly how the missing row
  survived this long."*
- **EDIT IDENTITY** — currently **three** files (sites 3, 4, 5) where **one already exists and is
  correct**. The RPC is gated, audited, column-bounded and its boundary is documented at the line.
  Sites 3 and 5 write strict subsets of it via direct table UPDATE, which is the same shape the RPC was
  built to replace (`Settings.tsx:247-252` explains why the direct UPDATE was abandoned).
- **ACCOUNTING STATE** — currently **three** files (sites 6, 7, 8, 9) on a column family nothing else
  touches. Note `business_accounting_secrets` is **already declared** with the reason *"two disjoint
  concerns on one table… no column overlap"* — and the `businesses` accounting columns are the same
  concern, one table over.

Plus, independent of any merge: **D1** and **D2** are two stale references to a dropped column, and
neither is a merge question.

**I am not proposing a merge order — that is David's ruling and Step 4 forbids it here.** The matrix is
the input it needs.

## WANT — out of scope, named so it is not smuggled in

- A derived field registry for `businesses`, the way `customerFieldRegistry.ts` did for `customers`
  (E6 phase A). Would kill D2 by construction.
- An explicit `WITH CHECK` on `businesses_owner_update`, so `owner_id`'s protection stops resting on a
  Postgres default.
- A column-level answer for `business_type` — today only the absence of code protects it.
- `businesses` in `zero-row-writes` **checked** rather than baselined-unchecked.
- A schema-snapshot checker (already OWED, §6 r17) — the only thing that would close Q9's floor.

---

## STD-021 — CORPUS AND METHOD

**Corpus.** `packages/**` and `scripts/**` (`*.ts`, `*.tsx`, `*.mjs`) for `.from('businesses')` and
`.rpc(...)`; `supabase/migrations/*.sql` for SQL writers, policies and triggers;
`write-paths-baseline.json`, `zero-row-writes-baseline.json`, `field-lists-baseline.json`;
`scripts/verify-write-paths.mjs` and `scripts/verify-zero-row-writes.mjs` read as text.

**Method.** Site enumeration reuses **`scripts/lib/siteKey.mjs`** unmodified, called with the verb index
(matching `verify-zero-row-writes.mjs:115`); comment-stripping mirrors `verify-write-paths.mjs`'s
newline-preserving stripper so reported line numbers stay true. Column sets were read from source by
hand, site by site — not inferred. `verify-write-paths.mjs` was **not** imported: like
`verify-tile-fields.mjs`, it has no `import.meta.main` guard, so importing it would run its probes and
its `process.exit`.

**WHAT THIS RECON CANNOT SEE**

1. **The live catalog.** No `psql` on this machine. Everything about applied state (27e), actual
   policies, actual `pg_proc` contents is read from **repo migrations and the ⚡ front-page**. D1's
   liveness depends on 27e actually being applied.
2. **A function created outside the migration path** — §6 r17's class. Q9's floor rests on this.
3. **Runtime reachability.** I read routes and gates; I did not drive a session. "Member-reachable"
   in Q6 is a reading of `router.tsx` + policies, not an observation.
4. **Whether the two creation paths actually diverge in effect** — I compared their column lists, not
   their outcomes on a real tenant.
5. **Q5's clobber hazard is unproven** — I did not find a mid-edit `reload()` trigger, and I did not
   prove there is none.

---

*RECON ONLY. No merge order, no declaration, no cap, no fix. David rules.*
