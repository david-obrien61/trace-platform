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
**Board: 0 of 10 covered** (9 `owed` · 1 `needs-test`).

> 🔴 **MIGRATION GATE — CARDS 7–9 ARE BLOCKED UNTIL DAVID APPLIES IT.**
> `supabase/migrations/20260910_permission_literal_merge.sql` is **WRITTEN, NOT APPLIED.**
> Cards 1–6 do **not** depend on it — they are client fixes and run on the deploy alone.
> Apply in the **SQL editor, never the table editor** (§6 r17), then run V1–V5 at the foot of the file.

> ⚠️ **THE CONSOLE BLOCK — USE THIS ONE.** `window.supabase` **does not exist** and it is what broke
> the last two attempts. Paste this instead; it uses the app's own client and your own session:
> ```js
> const { supabase } = await import('/src/lib/supabase.ts');
> const { data: { user } } = await supabase.auth.getUser();
> console.log('signed in as', user.email, user.id);
> ```

---

### CARD 1 — Lauren saves her business profile with NO error
**STATUS:** owed · **DEVICE:** desktop · **WHO:** Lauren (`lauren@lawnstrees.com`) on **LAWNS**
1. Sign in as Lauren. Settings → Business profile.
2. Change **the phone number only**. Do not touch the tax rate.
3. Save.
- ✅ **PASS:** the message reads **`Saved`**. No red. No mention of row-level security.
- 🔴 **FAIL:** any message containing *"new row violates row-level security policy"* — the defect is unfixed.

### CARD 2 — 🔴 THE ACCEPTANCE CLAUSE: a profile edit that does not touch tax writes NOTHING to `business_pricing_config`
**STATUS:** owed · **DEVICE:** desktop · **WHO:** Lauren on **LAWNS**
1. Before saving, run in the console: `[TRACE:TAX]` is what you are looking for.
2. Do CARD 1's edit again (change the phone, leave tax alone) and Save.
3. Read the console line `[TRACE:TAX] business profile save — per-table outcome`.
- ✅ **PASS:** `taxRate: "not written — unchanged (0.0825)"` and `profile: "written"`.
- 🔴 **FAIL:** `taxRate: "written (…)"` — the coupling is still live and Card 1 passed for the wrong reason.

### CARD 3 — the tax rate still saves when she actually edits it
**STATUS:** owed · **DEVICE:** desktop · **WHO:** David (account holder) on **Test Dave's**, NOT LAWNS
1. Settings → change the tax rate to a different value. Save. **Reload.**
- ✅ **PASS:** the new rate persists, and `[TRACE:TAX]` says `taxRate: "written (…)"`.
- 🔴 **FAIL:** the rate reverts — the conditional guard is too aggressive and has broken the real edit.
> ⚠️ **Run this on Test Dave's.** LAWNS is read-only except what David runs, and its 8.25% is live on invoices.

### CARD 4 — 🔴 PROVE THE REFUSAL, NOT THE SUCCESS
**STATUS:** owed · **DEVICE:** desktop · **WHO:** **Joel** (`joel@lawnstrees.com`) on **LAWNS**
Joel is a MANAGER holding `inventory:*`, `settings:update` — and **NOT** `pricing_recipe:update` (measured 2026-09-10).
1. Sign in as Joel. Open Settings.
2. If a tax-rate field is reachable, change it and Save.
- ✅ **PASS:** he is refused **in words** — *"The TAX RATE was not saved — …"* — and the profile half still reports its own outcome separately.
- 🔴 **FAIL (the worst outcome):** it says `Saved` and the rate did not change. That is the silent-success defect returning, and it is the whole reason `.select()` was added.

### CARD 5 — a two-plant delivery bills ONE trip charge
**STATUS:** owed · **DEVICE:** desktop or phone · **WHO:** any signed-in member on **Test Dave's**
1. Build a cart with **2 plants**. Go to Services & add-ons.
2. Select **Trip Charge**.
- ✅ **PASS:** the card reads **`$50.00 per order`** and the line contributes **`+$50.00`**. The order summary total agrees with the card.
- 🔴 **FAIL:** `$50.00 × 2 plants` or `+$100.00`.

### CARD 6 — the per-plant add-ons still scale (the fix did not overcorrect)
**STATUS:** owed · **DEVICE:** desktop or phone · **WHO:** as CARD 5
Same 2-plant cart. Select **tree placement** ($125, `per_unit`) and **Tree Bubbler** ($65, `per_unit`).
- ✅ **PASS:** placement reads `$125.00 × 2 plants` = **+$250.00**; bubbler `$65.00 × 2 plants` = **+$130.00**.
- 🔴 **FAIL:** either shows ×1 — the netting rule has been applied where it should not be.
> ⚠️ **Tree Tarp is `price_type: per_unit` with `price_unit: order`** — a contradictory pair in the DATA (tech-debt #235). It will read `× 2 orders`. That is the data being odd, not this fix; note it and move on.

### CARD 7 — 🔴 THE LITERAL TEST ADMITS THE RIGHT PERSON *(blocked on the migration)*
**STATUS:** owed · **DEVICE:** desktop · **WHO:** Lauren on **LAWNS**
After David applies `20260910_permission_literal_merge.sql`:
1. Sign in as Lauren, repeat CARD 1.
- ✅ **PASS:** still `Saved`. The merge changed no access decision for her.
- 🔴 **FAIL:** anything she could do before, she now cannot — report immediately; the alias removal revoked something the catalog said nobody held.

### CARD 8 — 🔴 THE LITERAL TEST REFUSES *(blocked on the migration)*
**STATUS:** owed · **DEVICE:** desktop · **WHO:** **Joel** on **LAWNS**
1. Sign in as Joel. In the console:
```js
const { supabase } = await import('/src/lib/supabase.ts');
const B = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
for (const p of ['inventory:read','costs:read','pricing_recipe:update','view_costs']) {
  const { data } = await supabase.rpc('has_permission', { p_business_id: B, p_perm: p });
  console.log(p, '→', data);
}
```
- ✅ **PASS:** `inventory:read → true`, and **`costs:read → false`, `pricing_recipe:update → false`, `view_costs → false`.**
- 🔴 **FAIL:** `view_costs → true` — the alias expansion is still live and the migration did not take.
> **This is the card that proves the gate. A permission function that has only ever admitted is not a proven gate.**

### CARD 9 — the second authority site is gone *(blocked on the migration)*
**STATUS:** owed · **DEVICE:** desktop · **WHO:** David, SQL editor
```sql
SELECT proname FROM pg_proc WHERE proname = 'has_permission_exact';   -- EXPECT 0 rows
SELECT prosrc LIKE '%permission_aliases%' AS still_expands FROM pg_proc WHERE proname='has_permission';  -- EXPECT false
```
- ✅ **PASS:** 0 rows, and `still_expands = false`.

---

### CARD 10 — ⚠️ NOT REPRODUCIBLE, INSTRUMENTED INSTEAD: the header names the signed-in person
**STATUS:** needs-test · **DEVICE:** desktop · **WHO:** Lauren on **LAWNS**
**Why `needs-test` and not a fix:** the header renders `userName`, sourced from the SESSION's own
auth metadata. **There is no code path anywhere that resolves a name from `businesses.owner_id`**
(grepped), and both candidate fields were MEASURED correct on 2026-09-10 — Lauren's
`auth.users.raw_user_meta_data.full_name` **and** her `business_members.name` are both
*"Lauren Bishop"*. Nothing was changed on a guess. A `[TRACE:IDENTITY]` line now prints every
candidate source so the next occurrence is answerable in one glance.
1. Sign in as Lauren. Read the header, then read the console line `[TRACE:IDENTITY]`.
- ✅ **PASS:** header says **Lauren Bishop**, badge **OWNER** (her role genuinely is OWNER), and `renders: "Lauren Bishop"`.
- 🔴 **FAIL:** header says *David OBrien*. **Then the trace tells you which source is wrong** — if every source says "Lauren Bishop" and the screen says David, the bundle is stale (GATE 0). Report the whole trace line.
