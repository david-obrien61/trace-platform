# OWNER TEST — LAUREN SAVES HER PROFILE, THE TRIP CHARGE BILLS ONCE, AND THE PERMISSION TEST REFUSES

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**, because
> Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> *(GATE 0 · OP-15.)*

**Capability:** 2.6 settings/profile · 3.2 checkout services · identity/permissions (no board id).
**Story:** ⚠️ **NO STORY COVERS THE PROFILE SAVE and one is OWED** — the nearest is the
`settings:update` clause in the authority work. Flagged, not invented (§9 story gate).
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 12 covered** (11 `owed` · 1 `needs-test`). ⚠️ **Card 8 was RE-AIMED 2026-09-10 19:10** — it proved a defect that `20260910b` has since fixed; it now proves the fix, from both sides.

> 🔴 **EVERY CARD NAMES WHO CAN RUN IT AND ON WHICH TENANT, AND THE BOARD IS SPLIT BY THAT.**
> David holds `businesses.owner_id`. **Lauren has her own login he does not have; Joel has his own
> login he does not have.** A card naming an actor David has no login for is a card that WAITS, and
> it says so on its face.
>
> The line is not "how hard" — it is **what the card proves**, and `scripts/lib/memberSession.mjs`
> states it exactly: *"a machine proves the POLICY is correct; a human proves a REAL MEMBER is
> configured correctly."* So the refusal cards sit in Section A **as SQL-editor queries** — the
> policy half is catalog-readable and needs nobody's password. ⚠️ **The behavioural half runs on a
> harness THUNDER operates, never David** (corrected 2026-09-10 — see the Section A note): a write
> under a member's own JWT cannot be done from the SQL editor, which runs as `postgres` and so
> cannot test RLS on itself. **That harness marks nothing `covered`.**
>
> **🔴 RUN THIS FIRST: CARD 1.** Acceptance clause, no migration, your own login only.
> *(The previous draft said "run CARD 1 first" when CARD 1 named Lauren. That was the mistake this
> split exists to stop.)*

> ✅ **MIGRATION GATE — LIFTED 2026-09-10. `20260910_permission_literal_merge.sql` IS APPLIED.**
> David applied it in the SQL editor and measured `is_literal = true`, `still_expands = false`,
> `search_path` pinned, 59 policies. **Independently re-measured off the catalog the same day:**
> `has_permission` body is `bm.permissions ? p_perm` with no `permission_aliases` reference,
> `proconfig = search_path=""`, and **`has_permission_exact` returns 0 rows — it is gone.**
> **CARDS 5, 6 AND 7 ARE UNBLOCKED.** ⚠️ `has_permission_for` still expands aliases — deliberate
> and narrow, filed as tech-debt **#233**, not a gate.
>
> 🔴 **AND A SECOND MIGRATION NOW EXISTS AND IS *NOT* APPLIED:**
> `20260910b_owner_id_policies_become_permissions.sql` (#289) — the 49 raw-`owner_id` policies,
> triaged. **It changes nothing this board tests** (nothing here reads `nursery_profiles`,
> `member_devices` or the ten dropped policies), so no card here is blocked by it and none flips.
> Its own board is **`docs/owner-tests/owner-id-policy-repoint-full-surface-test.md`**, and
> `20260910b` §0 **refuses to apply** unless the literal merge above is already in — the two are
> ordered, not independent.

> ⚠️ **THE CONSOLE BLOCK — USE THIS ONE.** `window.supabase` **does not exist** and it is what broke
> the last two attempts:
> ```js
> const { supabase } = await import('/src/lib/supabase.ts');
> const { data: { user } } = await supabase.auth.getUser();
> console.log('signed in as', user.email, user.id);
> ```

---

# ═══ SECTION A — DAVID CAN RUN THESE NOW ═══
*Your own login, or the SQL editor. Nobody else required, and **no terminal**.*

> 🔴 **CORRECTED 2026-09-10 — CARDS 5, 6 AND 8 SAID `DEVICE: desktop (terminal)` AND THAT WAS THE
> SAME MISTAKE AS A CARD NAMING LAUREN.** David has not run terminal commands since July; all data
> interaction is the Supabase SQL editor or the UI. A card David cannot run does not belong in a
> David-can-run-now section, whoever it names. **Those three are now SQL-editor form**, and the
> behavioural halves that genuinely cannot be done from the SQL editor — a write under a member's
> own JWT — were **RUN BY THUNDER** and are recorded as builder verification on each card.
> `scripts/rls/permission-literal-and-owner-id-cards.rls.mjs`, against **Test Dave's only**,
> ephemeral principals, minted and deleted, teardown clean. **Per OP-14 that run marks NOTHING
> `covered`** — `memberSession.mjs`'s own header says so: *"a machine proves the POLICY is correct;
> a human proves a REAL MEMBER is configured correctly."* The human half of Card 6 is **CARD 11**.

### CARD 1 — 🔴 THE ACCEPTANCE CLAUSE: a profile edit that does not touch tax writes NOTHING to `business_pricing_config`
**STATUS:** owed · **DEVICE:** desktop · **WHO:** **David, your own login** · **TENANT:** Test Dave's
1. Settings → Business profile. Change **the phone number only.** Do not touch the tax rate. Save.
2. Read the console line `[TRACE:TAX] business profile save — per-table outcome`.
- ✅ **PASS:** `taxRate: "not written — unchanged (…)"` and `profile: "written"`.
- 🔴 **FAIL:** `taxRate: "written (…)"` — the coupling is still live.

### CARD 2 — the tax rate still saves when you actually edit it
**STATUS:** owed · **DEVICE:** desktop · **WHO:** **David, your own login** · **TENANT:** Test Dave's
Change the tax rate to a different value. Save. **Reload.**
- ✅ **PASS:** the new rate persists; `[TRACE:TAX]` says `taxRate: "written (…)"`.
- 🔴 **FAIL:** it reverts — the conditional guard is too aggressive and has broken the real edit.
> ⚠️ **Test Dave's, not LAWNS.** LAWNS is read-only except what you run, and its 8.25% prints on invoices.

### CARD 3 — a two-plant delivery bills ONE trip charge
**STATUS:** owed · **DEVICE:** desktop or phone · **WHO:** **David, your own login** · **TENANT:** Test Dave's
Cart with **2 plants** → Services & add-ons → select **Trip Charge**.
- ✅ **PASS:** the card reads **`$50.00 per order`**, contributes **`+$50.00`**, and agrees with the order summary.
- 🔴 **FAIL:** `$50.00 × 2 plants`, or `+$100.00`.

### CARD 4 — the per-plant add-ons still scale (the fix did not overcorrect)
**STATUS:** owed · **DEVICE:** desktop or phone · **WHO:** **David, your own login** · **TENANT:** Test Dave's
Same cart: **tree placement** ($125 `per_unit`) and **Tree Bubbler** ($65 `per_unit`).
- ✅ **PASS:** `$125.00 × 2 plants` = **+$250.00**; `$65.00 × 2 plants` = **+$130.00**.
- 🔴 **FAIL:** either shows ×1.
> ⚠️ **`Tree Tarp` is `price_type: per_unit` with `price_unit: order`** — a contradictory pair in the DATA (tech-debt #235). It will read `× 2 orders`. That is the data, not this fix.

### CARD 5 — 🔴 PROVE THE REFUSAL: `has_permission` IS LITERAL
**STATUS:** owed · **DEVICE:** desktop · **WHO:** **David, SQL editor** · **TENANT:** all
Two queries. No terminal, no `EXECUTE` grant needed, no password.

```sql
-- (a) THE FUNCTION BODY — containment, not expansion.
SELECT prosrc LIKE '%permissions ? p_perm%'        AS is_literal,      -- EXPECT true
       prosrc LIKE '%permission_aliases%'          AS still_expands,   -- EXPECT false
       proconfig::text                             AS search_path      -- EXPECT {"search_path=\"\""}
  FROM pg_proc WHERE proname = 'has_permission';

-- (b) NOBODY HOLDS THE LEGACY STRING, so literal semantics cannot lock anyone out by surprise.
SELECT bm.name, b.name AS tenant, bm.role,
       bm.permissions ? 'view_costs'      AS holds_legacy,   -- EXPECT false on EVERY row
       bm.permissions ? 'costs:read'      AS holds_modern
  FROM business_members bm JOIN businesses b ON b.id = bm.business_id
 ORDER BY b.name, bm.name;
```
- ✅ **PASS:** `is_literal = true`, `still_expands = false`, and **`holds_legacy = false` on all 8 rows.**
- 🔴 **FAIL:** `still_expands = true` → the migration did not take. A `holds_legacy = true` row → that person just lost an access they had.

> ✅ **BUILDER-VERIFIED BEHAVIOURALLY, 2026-09-10 — and this is the half the SQL above cannot reach.**
> An ephemeral STAFF principal holding **only `inventory:read`**, signed in with the ANON key
> (a real JWT, real `auth.uid()`, exactly what the browser holds), called `has_permission` five times:
> `inventory:read → true` · `costs:read → false` · `pricing_recipe:update → false` ·
> **`view_costs → false`** · `manage_settings → false`. **The legacy alias is refused by the live
> function, measured, not reasoned.** ⚠️ *An SQL-editor version of this call was attempted first and
> could not run from here: the read-only PAT is `supabase_read_only_user`, which is not granted
> `EXECUTE` on `has_permission`. David's editor runs as `postgres`, which is — but I will not put a
> block on this board that I have not watched run (§6 r19), so the SQL above proves it from the
> catalog instead and the harness proves the call.*

### CARD 6 — THE POLICY ADMITS THE STRING (the member-write path)
**STATUS:** owed · **DEVICE:** desktop · **WHO:** **David, SQL editor** · **TENANT:** all
```sql
SELECT policyname, cmd, qual, with_check
  FROM pg_policies WHERE tablename = 'business_pricing_config' ORDER BY policyname;
```
- ✅ **PASS:** `bpc_member_update` exists, `cmd = UPDATE`, and BOTH `qual` and `with_check` read
  `is_active_member(business_id) AND has_permission(business_id, 'pricing_recipe:update')`.
- 🔴 **FAIL:** the policy is absent, or names a legacy string.
- ⚠️ **EXPECT `bpc_member_insert` TO BE ABSENT — that is deliberate** (#232). It is why an upsert
  refuses a member, and why `writePricingConfig` had to stop upserting.

> ✅ **BUILDER-VERIFIED, 2026-09-10 — the write, under a member's own JWT.** The SQL editor runs as
> `postgres` and therefore cannot test RLS on itself, so this half is not SQL-editor-provable at all.
> An ephemeral STAFF principal holding `pricing_recipe:read` + `pricing_recipe:update`, ANON session:
> **read returned 1 row** (`bpc_member_select`), **UPDATE returned 1 row** (`bpc_member_update`
> admits the string), and the original config was restored with the service key — **no residue,
> verified by re-read.** *This is Lauren's case, proven without Lauren.*
> 🔴 **THE OWNER PROOF OF THIS CARD IS CARD 11 — Lauren saving on LAWNS.** A harness proves the
> policy; only she proves her own row is configured to reach it.

### CARD 7 — the second authority site is gone
**STATUS:** owed · **DEVICE:** desktop · **WHO:** **David, SQL editor**
```sql
SELECT proname FROM pg_proc WHERE proname = 'has_permission_exact';   -- EXPECT 0 rows
SELECT prosrc LIKE '%permission_aliases%' AS still_expands FROM pg_proc WHERE proname='has_permission';  -- EXPECT false
```
> ✅ **RE-MEASURED OFF THE CATALOG 2026-09-10 (Thunder, read-only):** `has_permission_exact`
> returns **0 rows**; `has_permission` → `still_expands = false`. Both as expected. **Still `owed`,
> because a builder read is not your run** — but if it disagrees when you run it, something changed
> after the migration and that is the finding.

### CARD 8 — ✅ `nursery_profiles` IS FIXED BY `20260910b` — THIS CARD NOW PROVES THE FIX, NOT THE DEFECT
**STATUS:** owed · **DEVICE:** desktop · **WHO:** **David, SQL editor** · **TENANT:** all
🔴 **RE-AIMED 2026-09-10 19:10 — READ THIS BEFORE THE QUERY.** This card was written to prove
tech-debt **#236** (a `nursery_profiles` save refused to an OWNER-ROLE member who is not the account
holder). **`20260910b_owner_id_policies_become_permissions.sql` fixed it, and the card's earlier
`42501` PREDATES that apply.** Left as written it would have asserted a defect against a database
where the defect is gone — and David would have read the new, correct policy set as a regression.
**#236 is RESOLVED.** What is worth proving now is the inverse.

```sql
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'nursery_profiles' ORDER BY policyname;
```
- ✅ **PASS — TWO rows, both permission-keyed, no raw `owner_id` anywhere:**
  `nursery_profiles_member_select` `[SELECT]` → `is_active_member(business_id) AND has_permission(business_id,'settings:read')`
  `nursery_profiles_owner` `[ALL]` → `is_active_member(business_id) AND has_permission(business_id,'settings:update')`
- 🔴 **FAIL — one row keyed on `business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())`:**
  `20260910b` is not applied on the database you are reading, and **#236 is live again** there.

> ⚠️ **AND THE POLICY TEXT IS NOT THE PROOF — YOUR OWN POINT, AND IT IS WHY THE CARD KEPT ITS
> BEHAVIOURAL HALF.** The query above reads policy TEXT and never attempts the write, so it cannot
> tell a policy that *names* `settings:update` from one that actually *admits* it.
>
> ✅ **BUILDER-VERIFIED BEHAVIOURALLY, RE-RUN 19:10 AFTER THE APPLY — and the result FLIPPED, which
> is the evidence:**
> **A.** OWNER-ROLE principal holding `settings:read` + `settings:update`, **not** `businesses.owner_id`
> (`95c1b2e9…`) → install-price upsert **SUCCEEDED, 1 row.** *The same principal, on the same tenant,
> was refused `42501` two hours earlier. That is the fix, measured from both sides of it.*
> **B.** OWNER-ROLE principal holding **neither** settings string → **REFUSED,
> `42501 new row violates row-level security policy`.** *So the fix did not open the table to
> everyone — the string admits, its absence refuses.* **B is the half that makes A mean something.**

> ⚠️ **RESIDUE, REPORTED LOUDLY (test tenant only).** Run A's upsert **wrote
> `nursery_profiles.default_install_price = 225.00` on Test Dave's** and the harness tears down its
> principal, not that row. The row pre-existed (`created_at 2026-06-26`) so this is an UPDATE, and
> `225` is the documented seed value — **but I did not capture the prior value and will not claim it
> was already 225.** If it was something else, say so and it goes back. **LAWNS was not touched:
> its `default_install_price` is `NULL`, as it was.**

---

# ═══ SECTION B — THESE NEED A DESK VISIT ═══
*Each one waits on a login David does not have, or on a person seeing their own screen.*

### CARD 9 — Lauren saves her business profile with NO error
**STATUS:** owed · **DEVICE:** desktop · **WHO:** 🔴 **LAUREN** (`lauren@lawnstrees.com`) · **TENANT:** LAWNS
**WAITS ON:** Lauren's login. CARD 6 proves the *policy* admits the string; only this proves *her account* is configured to hold it.
Sign in as Lauren → Settings → change the phone only → Save.
- ✅ **PASS:** the message reads **`Saved`**. No mention of row-level security.
- 🔴 **FAIL:** *"new row violates row-level security policy"* — the defect is unfixed for the real person.

### CARD 10 — Joel is refused in words, not silently
**STATUS:** owed · **DEVICE:** desktop · **WHO:** 🔴 **JOEL** (`joel@lawnstrees.com`) · **TENANT:** LAWNS
**WAITS ON:** Joel's login. Joel is MANAGER, holds `inventory:*` and `settings:update`, **not** `pricing_recipe:update` (measured 2026-09-10).
If a tax-rate field is reachable for him, change it and Save.
- ✅ **PASS:** *"The TAX RATE was not saved — …"*, with the profile half reporting separately.
- 🔴 **FAIL (worst outcome):** it says `Saved` and nothing changed — silent success, the whole reason `.select()` was added.

### CARD 11 — Lauren still saves after the migration
**STATUS:** owed · **DEVICE:** desktop · **WHO:** 🔴 **LAUREN** · **TENANT:** LAWNS
**WAITS ON:** Lauren's login **and** the migration being applied.
- ✅ **PASS:** still `Saved` — the merge changed no access decision for her.
- 🔴 **FAIL:** something she could do before, she now cannot. **Report immediately** — the alias removal revoked something the catalog said nobody held.

### CARD 12 — ⚠️ NOT REPRODUCIBLE, INSTRUMENTED INSTEAD: the header names the signed-in person
**STATUS:** needs-test · **DEVICE:** desktop · **WHO:** 🔴 **LAUREN** · **TENANT:** LAWNS
**WAITS ON:** Lauren's login — and it is **irreducibly** a desk visit, because the claim is about what
*she* sees on *her* screen. No harness can stand in for that.
**Why `needs-test` and not a fix:** the header renders `userName`, sourced from the SESSION's own auth
metadata. **No code path anywhere resolves a name from `businesses.owner_id`** (grepped), and both
candidate fields were MEASURED correct on 2026-09-10 — her `auth.users.raw_user_meta_data.full_name`
**and** her `business_members.name` are both *"Lauren Bishop"*. Nothing was changed on a guess.
1. Sign in as Lauren. Read the header, then the console line `[TRACE:IDENTITY]`.
- ✅ **PASS:** header says **Lauren Bishop**, badge **OWNER** (her role genuinely is OWNER), `renders: "Lauren Bishop"`.
- 🔴 **FAIL:** header says *David OBrien*. **The trace then tells you which source is wrong** — if every source says Lauren and the screen says David, the bundle is stale (GATE 0). Report the whole line.
