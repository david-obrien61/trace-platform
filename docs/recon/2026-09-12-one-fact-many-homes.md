# RECON — WHERE DOES ONE FACT LIVE IN MORE THAN ONE PLACE?

**Ledger:** #317 · **Branch:** `recon/one-fact-many-homes` · **Date:** 2026-09-12 (unattended run)
**Type:** RECON. **Report only — nothing built, nothing fixed, nothing merged.**

> **SCOPE — BY CONSEQUENCE, NOT COMPLETENESS.** This is not an inventory of duplicated strings.
> It is the set of copies where **one going stale breaks something silently** — the shape that let
> `campaign_posts` reject `tiktok` for three months while three campaigns committed with zero posts
> and nothing complained.
>
> **PROVENANCE MARKS ARE LOAD-BEARING** (R-26): `[MEASURED]` was read from the live catalog or the
> files this session; `[STATED]` is quoted from a document; `[INFERRED]` has not been checked and
> **must not be promoted to fact.**
>
> ⚠️ **NO TECH-DEBT OR RULING ID IS CLAIMED BY THIS PASS.** Findings are numbered **F1…Fn** so that
> nothing dangles on an unattended tree (`verify-id-citations` clause B would be right to flag a
> cited id with no row). David converts the ones he wants into rows.

---

## HOW THE LIVE READ WAS DONE

Every catalog figure below came from `scripts/lib/pgQuery.mjs` against project `bgobkjcopcxusjsetfob`
with the read-only PAT — **not from the migration corpus**, which is the whole point: an inline
`CHECK` is auto-named by Postgres and the name is never typed, so it is unfindable by grep. That is
exactly why `campaign_posts_platform_check` survived while its named sibling on `social_drafts` was
updated (ledger #310).

Queries used, verbatim, so any figure here can be re-derived:

```sql
-- every enumerating CHECK in public
select rel.relname, con.conname, pg_get_constraintdef(con.oid)
from pg_constraint con join pg_class rel on rel.oid = con.conrelid
join pg_namespace ns on ns.oid = rel.relnamespace
where con.contype = 'c' and ns.nspname = 'public'
  and pg_get_constraintdef(con.oid) ~* '= ANY|IN \(';

-- every live policy body (for the permission-string diff)
select tablename, policyname, cmd, coalesce(qual,'') || ' ' || coalesce(with_check,'')
from pg_policies where schemaname = 'public';
```

**[MEASURED] 41 enumerating CHECK constraints live in `public`. 156 live policies.**

---

## ✅ FIRST, THE ONE THAT CLOSED — AND THE RECORD THAT HAS NOT CAUGHT UP

🔴 **`docs/CLOSE-OUT-LEDGER.md` #310 says the channel-vocabulary migration is *"WRITTEN, NOT
APPLIED."* [STATED]. IT IS APPLIED. [MEASURED, 2026-09-12 ~22:05 CDT]**

```
campaign_posts_platform_fkey  FOREIGN KEY (platform) REFERENCES channels(name) ON UPDATE CASCADE ON DELETE RESTRICT
social_drafts_platform_fkey   FOREIGN KEY (platform) REFERENCES channels(name) ON UPDATE CASCADE ON DELETE RESTRICT
channels: email · facebook · instagram · sms · tiktok · twitter   (6 rows, all active)
```

Both `*_platform_check` CHECK constraints are **gone**, replaced by FKs into a six-row `channels`
table. So the exemplar duplication in this whole recon — **one channel name in four homes** — is
structurally closed, and closed the right way: a value in a table, not a string in four files.

**The finding is not that it shipped. It is that three records still say otherwise**, and they are
the records a session reads to decide whether to trust the column:

| Where | What it says | Truth |
|---|---|---|
| `docs/CLOSE-OUT-LEDGER.md` #310 | *"MIGRATION … WRITTEN, NOT APPLIED"* | applied |
| ⚡ ACTIVE STATUS / `built-inventory.md` | see F7 below — not re-checked at read time | — |
| `packages/shared/src/campaigns/types.ts` | still carries a hand-written `platform` union | see **F2** |

This is the same class as ledger #312's finding that `customer_addresses` was recorded WRITTEN-NOT-
APPLIED while being live — **two occurrences in one day of an apply-state claim in prose going stale**,
and `verify-migration-apply-state.mjs --catalog` derives the answer in seconds. The doc is the copy.

⚠️ **[INFERRED] I did not confirm who applied it or when** — no `supabase_migrations.schema_migrations`
exists on this project (recorded in `verify-migration-apply-state.mjs`'s header), so the database
cannot say. Only the shape can be observed, and it is there.

---
