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
**Board: 0 of 12 covered** (11 `owed` · 1 `needs-test`).

> 🔴 **EVERY CARD NAMES WHO CAN RUN IT AND ON WHICH TENANT, AND THE BOARD IS SPLIT BY THAT.**
> David holds `businesses.owner_id`. **Lauren has her own login he does not have; Joel has his own
> login he does not have.** A card naming an actor David has no login for is a card that WAITS, and
> it says so on its face.
>
> The line is not "how hard" — it is **what the card proves**, and `scripts/lib/memberSession.mjs`
> states it exactly: *"a machine proves the POLICY is correct; a human proves a REAL MEMBER is
> configured correctly."* **`withMemberSession` mints an EPHEMERAL member with any permission set
> and asserts under real RLS on the anon key — no real person's password is needed**, which is why
> the refusal cards (the ones carrying the proof value) sit in Section A.
>
> **🔴 RUN THIS FIRST: CARD 1.** Acceptance clause, no migration, your own login only.
> *(The previous draft said "run CARD 1 first" when CARD 1 named Lauren. That was the mistake this
> split exists to stop.)*

> 🔴 **MIGRATION GATE — CARDS 5–7 ARE BLOCKED UNTIL DAVID APPLIES IT.**
> `supabase/migrations/20260910_permission_literal_merge.sql` is **WRITTEN, NOT APPLIED.**
> Everything else runs on the deploy alone. Apply in the **SQL editor, never the table editor**
> (§6 r17), then run V1–V5 at the foot of the file.

> ⚠️ **THE CONSOLE BLOCK — USE THIS ONE.** `window.supabase` **does not exist** and it is what broke
> the last two attempts:
> ```js
> const { supabase } = await import('/src/lib/supabase.ts');
> const { data: { user } } = await supabase.auth.getUser();
> console.log('signed in as', user.email, user.id);
> ```

---

# ═══ SECTION A — DAVID CAN RUN THESE NOW ═══
*Your own login, or an ephemeral principal via `withMemberSession`. Nobody else required.*

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

### CARD 5 — 🔴 PROVE THE REFUSAL AGAINST AN EPHEMERAL PRINCIPAL *(blocked on the migration)*
**STATUS:** owed · **DEVICE:** desktop (terminal) · **WHO:** **David, service key** · **TENANT:** Test Dave's
**This is the card that proves the gate, and it needs nobody's password.** Write a short probe under
`scripts/rls/` using `withMemberSession` — mint a member holding `inventory:read` **and not**
`costs:read` or `pricing_recipe:update` — then call `has_permission` for each.
- ✅ **PASS:** `inventory:read → true`; **`costs:read → false`, `pricing_recipe:update → false`, `view_costs → false`.**
- 🔴 **FAIL:** `view_costs → true` — the alias expansion is still live and the migration did not take.
> **A permission function that has only ever admitted is not a proven gate.**

### CARD 6 — the ephemeral principal WITH the string can save the pricing config *(blocked on the migration)*
**STATUS:** owed · **DEVICE:** desktop (terminal) · **WHO:** **David, service key** · **TENANT:** Test Dave's
Same harness: mint a member holding `pricing_recipe:update`, call `writePricingConfig`'s UPDATE path.
- ✅ **PASS:** the write lands and `.select()` returns one row. **This is Lauren's case, proven without Lauren.**
- 🔴 **FAIL:** zero rows — `bpc_member_update` is not admitting the string, and B.1's fix is incomplete.

### CARD 7 — the second authority site is gone *(blocked on the migration)*
**STATUS:** owed · **DEVICE:** desktop · **WHO:** **David, SQL editor**
```sql
SELECT proname FROM pg_proc WHERE proname = 'has_permission_exact';   -- EXPECT 0 rows
SELECT prosrc LIKE '%permission_aliases%' AS still_expands FROM pg_proc WHERE proname='has_permission';  -- EXPECT false
```

### CARD 8 — 🔴 THE OTHER `nursery_profiles` SAVE IS THE SAME DEFECT, UNFIXED
**STATUS:** owed · **DEVICE:** desktop (terminal) · **WHO:** **David, service key** · **TENANT:** Test Dave's
`Settings.tsx:83` upserts `nursery_profiles` (the default install price). That table has **exactly one
policy, keyed on raw `owner_id`** — so an OWNER-ROLE member who is not the account holder is refused.
Mint an ephemeral OWNER-role member and attempt the install-price save.
- ✅ **PASS (expected, and it is a FAILING surface):** the write is refused. **That confirms tech-debt #236** — B.1's defect at a second address on the same page, filed and NOT fixed this pass.
- 🔴 If it succeeds, my reading of the policy is wrong and #236 should be withdrawn.

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
