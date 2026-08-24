# What Thunder actually uses Ignition for — and what that means for a separate DEV environment

**Date:** 2026-08-24 · **Type:** LOOK ONLY. No code, no schema, no migration, no cap, no deletion.
**Asked because:** David stands up a real tenant Wednesday and wants DEV separated from the database
Lauren will depend on. The obstacle he named was *"the Ignition app is in the current database and I
am using it as a reference, so I cannot wipe and restart."* **This document tests that premise before
anything is designed on top of it.**

> 🔴 **HEADLINE, IN THE WORDS THE PROMPT ASKED FOR: I BARELY TOUCH IT — AND I HAVE NEVER READ A ROW
> FROM IT.** I read Ignition **files**, from the repo, a handful of times, as donor code. **The live
> Ignition Supabase project has been consulted ZERO times.** The one artifact ever written to query
> it was authored 2026-06-08 and, by `PLATFORM_STATE.md:246`'s own record, **has still never been
> run** — 76 days, during which 260 commits landed against `cultivar-os`/`shared`.

---

## Q1 — What I read, and from where

**(a) SOURCE in the repo — yes, and it is all of it.**

| What | Where | How often |
|---|---|---|
| `CoreApp.jsx` — `ShopBanner` mounted in the app shell | read by `scripts/verify-universals.mjs:152` (cap #1) | 🔴 **EVERY `npm run verify`** — the only mechanical, recurring read |
| `MarginEngine.js` — slab logic | cited as source of truth at `packages/shared/src/business-logic/MarginEngine.ts:3` | once, at extraction |
| `PredictiveKey.jsx` — PMI interval logic | `data/grower-scan/pmi-recon-ignition-cultivar.md` | once (donor-completeness check vs `CAI-archive`) |
| `DataBridge.js` (1123 ln) — local-first store-and-forward | recon → `packages/shared/src/sync/` | once; **the file was deliberately NOT moved** (44 Ignition imports) |
| `IgnitionProt.jsx:266` — a *different* vertical's pricing model | cited as a **counter-example** at `pricingRecipeFields.ts:27` | once |
| the whole package as **negative space** | `verify-api-parses.mjs:42-43` · `verify-write-paths.mjs:43` · `verify-zero-row-writes.mjs:236` — each excludes `ignition-os` and says *"frozen donor, not deployed"* | every run |

**(b) LIVE DATABASE ROWS — never. Not once.**
The only artifact ever authored for it is `docs/audits/ignition-db-verification-2026-06-09.sql`
(committed 2026-06-08, READ-ONLY by design, header: *"Run: Dashboard → ufsgqckbxdtwviqjjtos → SQL
Editor… paste the result back to Claude"*). **`PLATFORM_STATE.md:246` still reads `David must run`.**
So does the STD-008 inverse sweep (`:184`). **The one question that needed Ignition rows has been open
since June and has blocked nothing.**

Last commit touching `packages/ignition-os/`: **`c444a90`, 2026-06-09.** 53 commits ever, all before
that date. `build:ignition` is not in the `npm run verify` chain (`package.json:22`).

## Q2 — Is any of it rows at all?

**No. Every single thing I have consulted is source, and all of it is in git.** No seeded catalog, no
config row, no fixture, no reference table from the Ignition project has ever been read by me or by
any cap. **On the evidence, the live Ignition project is not a reference — the repo is.**

## Q3 — Does anything depend on Ignition objects existing in the database?

### 🔴 NO. There is no blocking dependency. Named, both directions:

- **They are two separate Postgres instances** (`bgobkjcopcxusjsetfob` / `ufsgqckbxdtwviqjjtos`).
  A cross-database FK, shared enum or shared sequence is **physically impossible**, not merely absent.
- **Zero root migrations** reference an Ignition table. The four `supabase/migrations/*` files that
  match on Ignition table names match **in comments only** (`20260602_shared_members_a_create_tables.sql:8-9`,
  `20260603_business_members_add_pin_hash.sql:12`, `20260708_service_override_leakage.sql:4`).
- **Zero caps query it.** `verify-universals.mjs` audits the "ignition" vertical by reading **repo
  files** (`CoreApp.jsx`, `packages/ignition-os/supabase/migrations/`), never the catalog. In today's
  run it scored **1 PASS / 17 SKIP** for Ignition — every SKIP saying *"out of scope for Ignition."*
  🔴 **Deleting the Ignition *project* changes nothing in `npm run verify`. Deleting the *directory*
  would fail cap #1.** The dependency is on the folder, not the database.
- **One runtime exception, and it is dead code:** `packages/shared/src/supabase/auth.ts:128` does
  `.from('shop_members')` inside `authenticate()`. **`authenticate()` has ZERO callers anywhere** —
  Ignition calls its own `DataBridge.authenticate` (`CoreApp.jsx:546`, `IgnitionCore.js:61`,
  `App.js:191`). Named not touched: that file is **OFF LIMITS** (CLAUDE.md §7), and knip does not see
  it (`shared` is deep-import scoped out, §6 r9).
- `scripts/apply-migrations.mjs:132-147` is the only script that ever connects to
  `ufsgqckbxdtwviqjjtos`. It is a one-shot 2026-06-02 drop-migration runner, in no gate, requiring a
  PAT that must be supplied by hand.

### 🔴 But there IS a real hazard, and it points the *other* way — at Wednesday, not at Ignition

**Ignition and Cultivar share ONE Supabase client module.** `packages/ignition-os/supabase.js` is a
single line: `export { supabase } from '../shared/src/supabase/client'`, and that client reads
`VITE_SUPABASE_URL` (`client.ts:3`). **Nothing in the code pins Ignition to a project** — which
database it writes to is decided entirely by an env var in whichever Vercel project builds it.

And the shapes collide: `packages/ignition-os/supabase/migrations/20260529_ignition_businesses.sql`
creates a **`businesses` table of its own**, near-identical to Cultivar's, defaulting
`business_type` to `'shop'` — and `packages/ignition-os/modules/OnboardingWizard.jsx:36,136` INSERTs
into `businesses`. `member_devices` and `customers` collide by name too (`DataBridge.js:741-764`,
`IgnitionAdmin.jsx:619-656`, `IgnitionIntake.jsx:149,210`).

> **So the environment risk David should actually be managing is an ENV-VAR risk, not a data-migration
> one: if `VITE_SUPABASE_URL` on the Ignition deployment is ever pointed at the Cultivar project,
> Ignition's onboarding writes tenant rows into the table LAWNS lives in.** ⚠️ **I cannot read a Vercel
> dashboard, so I do not know what it is set to today — and I am not going to guess.** That is one
> glance for David: Vercel → the Ignition project → Settings → Environment Variables.

⚠️ Also worth knowing before treating Ignition as a working reference: it is already partly broken.
`ForgotPinFlow` and `JoinFlow` query `pin_resets` / `shop_invites`, **dropped 2026-06-02 by
`20260602_ignition_drop_team_tables.sql` and never recreated** (`docs/audits/ignition-reality-audit-2026-06-09.md` §CoreApp).

## Q4 — What would a file-on-disk reference contain?

**Almost nothing that is not already on disk. David's suggestion is right, and the file mostly exists.**

| Reference need | Already on disk? |
|---|---|
| App logic / UI patterns (30 modules) | ✅ `packages/ignition-os/` + `~/Desktop/CAI-archive/` (historical original) |
| Schema DDL + policies + function bodies | ⚠️ **PARTIAL** — 17 files in `packages/ignition-os/supabase/migrations/` |
| Seeded reference rows / fixtures / config | ✅ **Not needed — never consulted, by anyone, ever** |

🔴 **The one genuine gap, and it is the only reason to take a dump at all: tech-debt #27.** Ten tables
exist in code and (probably) in that database with **no committed migration** —
`dtc_codes, eval_photos, tools, tool_signout_log, repair_logs, customer_authorizations,
concept_aliases, purchase_orders, pmi_schedules, ai_usage` (`PLATFORM_STATE.md:163`). Their DDL and
RLS live **only in the running project**. Everything else a dump would produce, git already has.

**Would a file serve every use in Q1? YES — and better.** Every use in Q1 is a source read, and a dump
on disk cannot drift, cannot be accidentally written to, and does not need a project to stay alive.

## Q5 — The commands. **ALL READ-ONLY.**

⚠️ **Checked, not assumed: `pg_dump`, `psql`, `supabase` and `docker` are ALL NOT INSTALLED on this
machine**, and there is no `supabase/config.toml` project link. So there are two routes.

**Route A — zero install, and it is what this repo already does.** Open the Supabase SQL editor on
`ufsgqckbxdtwviqjjtos` and run the numbered blocks in `docs/audits/ignition-db-verification-2026-06-09.sql`
(its own header: *"Each query is READ-ONLY — SELECT only"*). That closes TD#27 without a dump.

**Route B — the real dump.** Install first:

```bash
brew install libpq && brew link --force libpq      # pg_dump
# or: brew install supabase/tap/supabase           # supabase CLI
```

Connection string: **Supabase Dashboard → `ufsgqckbxdtwviqjjtos` → Project Settings → Database →
Connection string → URI.** Prefer the **Session pooler** URI (IPv4). 🔴 **The password there is the
DATABASE password — it is NOT the service key and NOT the anon key.**

```bash
# READ-ONLY. pg_dump opens a read transaction and writes nothing to the server.
export IGNITION_DB_URL='postgresql://postgres.ufsgqckbxdtwviqjjtos:<DB-PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres'

mkdir -p docs/reference

# ── THE REFERENCE ARTIFACT: schema only, public only ──────────────────────────
pg_dump "$IGNITION_DB_URL" \
  --schema=public \
  --schema-only \
  --no-owner --no-privileges \
  --no-publications --no-subscriptions \
  -f docs/reference/ignition-schema-20260824.sql
```

```bash
# ── OPTIONAL, AND FOR A DIFFERENT REASON: a backup before touching that project.
#    NOT a reference artifact — nothing has ever consulted an Ignition row.
pg_dump "$IGNITION_DB_URL" \
  --schema=public --data-only --no-owner --no-privileges \
  -f ~/Desktop/ignition-data-20260824.sql        # ⚠️ NOT in the repo — see below
```

**What must NOT be included, and why:**
- 🔴 **`--schema=public` is required.** Never `auth`, `storage`, `vault`, `realtime`, `extensions`,
  `supabase_migrations`. `auth.users` holds email addresses and password hashes; `vault` holds
  secrets. **A bare `pg_dump` with no `--schema` sweeps all of them in**, as does `pg_dumpall`.
- 🔴 **`--no-owner --no-privileges` is required.** A dump carrying `supabase_admin` grants would
  restore a table with the ACL CLAUDE.md §6 r17 exists to prevent — TRUNCATE/REFERENCES for `anon`,
  which RLS cannot filter.
- 🔴 **A DATA dump of `businesses` is a credential file. Do not commit it.**
  `20260529_ignition_businesses.sql:18-19` declares `accounting_token` and `accounting_refresh_token`
  as plain `text` — **QuickBooks OAuth tokens in cleartext.** The schema-only dump is safe to commit;
  the data dump belongs outside the repo, and `docs/reference/*data*.sql` should never be `git add`ed.
- The DB password stays in the shell env. Do not paste it into a file or a commit message.

**Nothing above is destructive. I have no destructive command to hand over, and none is needed.**

## Q6 — What else is in the Cultivar database?

🔴 **Per the 2026-08-22 ruling (*a claim about the database is sourced from the catalog or it is not
made*), what follows is the QUERY and the branch table — not a claim.** I read migrations; migrations
are not the catalog, and this repo has been burned in **both** directions (#22 applied-but-recorded-pending,
`20260802c` the same).

```sql
-- READ-ONLY. Run in Supabase SQL editor → bgobkjcopcxusjsetfob.
-- 1. Every table that actually exists, with its row count and owner.
SELECT c.relname                     AS table_name,
       pg_get_userbyid(c.relowner)   AS owner,
       c.reltuples::bigint           AS approx_rows,
       c.relrowsecurity              AS rls_enabled
FROM   pg_class c
JOIN   pg_namespace n ON n.oid = c.relnamespace
WHERE  n.nspname = 'public' AND c.relkind = 'r'
ORDER  BY c.relname;

-- 2. Anything created OUTSIDE the migration path (CLAUDE.md §6 r17's fingerprint).
SELECT c.relname, pg_get_userbyid(c.relowner) AS owner, a.privilege_type, a.grantee::regrole
FROM   pg_class c
JOIN   pg_namespace n ON n.oid = c.relnamespace,
LATERAL aclexplode(c.relacl) a
WHERE  n.nspname = 'public' AND a.grantee::regrole::text = 'anon'
  AND  a.privilege_type IN ('TRUNCATE','REFERENCES');

-- 3. Who else is a tenant in there besides LAWNS.
SELECT id, name, business_type, owner_id, created_at FROM businesses ORDER BY created_at;
```

**The branch table — what the SOURCE says to expect, so query 1 can be read against something:**

- ✅ **No other vertical has tables here.** `conduit-os`, `pantry-os`, `coolrunnings`, `kinna` exist
  only as string members of `VerticalId` (`packages/shared/src/supabase/types.ts:76-81`) — no
  migration, no code, nothing. **KINNA-OS in particular is unbuilt, not hiding.**
- ⚠️ **A third app already shares this database:** `packages/trace-app` uses the same Supabase session
  (`PLATFORM_STATE.md:138`). That is not new, but it should be on the list when he says "one tenant."
- 🔴 **Four superseded generations still standing, every one of them a table Wednesday's tenant sits
  beside:** `nurseries` · `losses` · `nursery_modules` (all pending DROP; `20260727d` is **GATED and
  unapplied**) · `modules` (the May 22 predecessor of `business_modules`).
- 🔴 **Two orphan pairs found while counting, not previously named anywhere:**
  **`pmi_assets` / `pmi_service_logs`** (`20260529_pmi_shared.sql`, kept alive by RLS edits in
  `20260622` and `20260623`) have **ZERO runtime readers** — the live pair is
  `business_pmi_schedule` / `business_service_log`. And **`campaign_tone_samples`**
  (`20260529_campaigns.sql`) has **zero readers** — `business_voice_samples`
  (`20260613_business_voice_samples.sql`) is what `api/campaigns.ts:81,171` actually uses.
  **Both are dead generations of a live capability, and neither is on the tech-debt log.**
- ⚠️ **A debris tenant row may still be present:**
  `20260611_delete_debris_trace_enterprises_nursery.sql` is recorded `David must run`
  (`PLATFORM_STATE.md:186`) — query 3 settles it.
- ✅ **No Ignition table should appear.** If query 1 returns `shops`, `jobs`, `shop_members`, `tools`
  or `purchase_orders`, **stop** — that means the env-var collision in Q3 has already happened.

---

## Recommendation

🔴 **The obstacle David named does not exist, and that is the finding: I barely touch Ignition, and I
have never once read a row from its database — so it is not holding the environment split hostage.**
Everything I actually consult (`CoreApp.jsx`, `MarginEngine.js`, `PredictiveKey.jsx`, `DataBridge.js`)
is a file in git that a second Supabase project cannot affect, and the two databases are physically
incapable of referencing one another. **So: take a schema-only `pg_dump` of `ufsgqckbxdtwviqjjtos`
for exactly one narrow reason — tech-debt #27's ten tables whose DDL exists nowhere but that running
project — commit it to `docs/reference/`, and after that the Ignition project is free to be paused,
left alone, or eventually deleted without costing a single thing I use.** What is lost under each
option, plainly: **keep it live** costs nothing but leaves ten tables' DDL hostage to a project nobody
maintains and leaves the env-var collision live; **dump and free it** loses the ability to run
Ignition against real data (which nothing needs, and which is already half-broken — `ForgotPinFlow`
and `JoinFlow` have queried dropped tables since June); **dump the data too** loses nothing but costs
a cleartext-QuickBooks-token file that must stay out of the repo. 🔴 **And the thing Lightning could
not see, which matters more than any of it: the real Wednesday hazard is not Ignition's data, it is
that Ignition and Cultivar share ONE Supabase client whose target is an env var — so before a real
tenant goes in, the one action worth taking is a single glance at `VITE_SUPABASE_URL` on the Ignition
Vercel project, because that variable, and nothing in the code, is what keeps Ignition's
`OnboardingWizard` from writing `business_type:'shop'` rows into the table Lauren will be living in.**
