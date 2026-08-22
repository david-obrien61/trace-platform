# RECON — THE SOCIAL / CAMPAIGN PLATFORM PATH

**Date:** 2026-08-22 · **Branch:** `main` · **HEAD at recon:** `4b3b346`
**Type:** LOOK-ONLY. No app code, no schema, no migration, no policy, no cap.
**Gate:** `npm run verify` exit 0 — tsc 5 · eslint 247 · knip 10/12/15 · 27/27 files, 1050 assertions. api/ **12/12**.
**GATE 0:** NOT APPLICABLE — no app code ships.

---

## 🔴 READ THIS FIRST — TWO STEP-1 PREMISES ARE WRONG, AND BOTH CHANGE WHAT GETS BUILT

Step 1 said to treat its findings as given. Two of them do not survive contact with the
repo, and saying so is the point of a recon. **Neither correction makes the situation
better** — one of them makes it considerably worse.

### 🔴 C-1 — `campaign_posts_platform_check` **IS** IN VERSION CONTROL

[`20260529_campaigns.sql:26-27`](../../supabase/migrations/20260529_campaigns.sql#L26-L27):

```sql
  platform            text NOT NULL
    CHECK (platform IN ('instagram','facebook','sms','email')),
```

It is declared **INLINE on the `CREATE TABLE`**. Postgres then auto-generates the name
`<table>_<column>_check` → `campaign_posts_platform_check`. **The name is never typed
anywhere**, which is exactly why a grep for the constraint *name* across all 105
migrations returns nothing. The constraint is committed, reviewable, and has been in the
repo since 2026-05-29.

**This is not a new STD-008 inverse instance**, and filing it as one would have recorded a
class this instance is not in. Step 5 files the real finding instead (tech-debt **#91**).

🔴 **THE METHOD FINDING IS THE DURABLE HALF, AND IT IS BIGGER THAN THIS ONE CONSTRAINT.**
The corpus contains **129 inline `CHECK (` declarations**. Every one of them is invisible
to a constraint-name grep and every one of them will read as "live object in no migration"
to a sweep that searches by name. **The Step 6 sweep must match on the constraint
DEFINITION (`pg_get_constraintdef`) against the parsed migration text, never on
`conname`** — otherwise it will report ~129 false positives and be discarded wholesale on
its first run, which is how a correct check gets thrown away.

### 🔴 C-2 — THERE IS NO CHANNEL-CONFIG *TABLE*, BUT THE CONFIG STORE EXISTS AND IS ALREADY WIRED

The `information_schema` sweep was correct: no table matches `%channel%`. But the config
is not missing — it lives in **`business_modules.config` → key `advert_channels`**, shape
`[{ type: 'social'|'sms', name: string, enabled: boolean }]`, established by
[`20260608_advert_channels_config.sql`](../../supabase/migrations/20260608_advert_channels_config.sql).

| Role | Site |
|---|---|
| WRITER (one) | [`api/social/enable.ts:53`](../../packages/cultivar-os/api/social/enable.ts#L53) → `set_business_module_state` |
| READER — social generator | [`api/social/generate-posts.ts:61-67`](../../packages/cultivar-os/api/social/generate-posts.ts#L61-L67) |
| READER — campaign generator | [`api/campaigns.ts:74-76`](../../packages/cultivar-os/api/campaigns.ts#L74-L76) |
| READER — setup page | [`SocialSetup.tsx:68-71`](../../packages/cultivar-os/src/pages/SocialSetup.tsx#L68-L71) |

The jsonb sweep did not find it because it searched `business_pricing_config.config`. The
social block is on a different row of a different table. **Q8's option (c) — "the
`business_modules.config` pattern" — is not a proposal. It is the status quo.**

---

## 🔴 LIVE DEFECT FOUND OUTSIDE THE EIGHT QUESTIONS — NOT FIXED, PER STEP 3

### L1 — THE ONE WRITER OF `business_modules` CANNOT REACH THE DATABASE

**This is not a social-media defect. It is a platform-wide write outage on a table three
features depend on, and it answers Q2, Q3 and Q4 simultaneously.**

The client sends **seven** named arguments
([`moduleState.ts:93-101`](../../packages/shared/src/business-logic/moduleState.ts#L93-L101)):

```ts
  const { data, error } = await supabase.rpc('set_business_module_state', {
    p_business_id, p_module_key, p_enabled, p_configured,
    p_config_patch, p_trial_days, p_actor_user_id,   // ← p_trial_days
  });
```

The **only** migration creating a 7-argument `set_business_module_state` is
[`20260802c_enable_starts_the_clock.sql:58-67`](../../supabase/migrations/20260802c_enable_starts_the_clock.sql#L58-L67),
and it is recorded **GATED AND UNAPPLIED** in
[`CLOSE-OUT-LEDGER.md:22`](../CLOSE-OUT-LEDGER.md#L22) — *"`20260802c` IS GATED AND
UNAPPLIED — the money path is code-complete and the database has not been told."*
The applied function is the 6-argument form created by `20260801` and replaced by
`20260801b:85`, which `20260802c:56` will `DROP`.

**PostgREST resolves an RPC by its ARGUMENT-NAME SET.** An argument that no candidate
function declares does not fall back to a default — it means *no function matches*, and
the call returns **PGRST202** (`Could not find the function … in the schema cache`).

So on today's database **every call through the one writer fails**:

| Caller | Consequence |
|---|---|
| [`SocialSetup.tsx:97`](../../packages/cultivar-os/src/pages/SocialSetup.tsx#L97) → [`enable.ts:50`](../../packages/cultivar-os/api/social/enable.ts#L50) | Save cannot persist. `enable.ts:56-59` returns 500; `SocialSetup.tsx:103-106` renders it and does **not** navigate. |
| [`Subscription.tsx:192`](../../packages/cultivar-os/src/pages/Subscription.tsx#L192) | The marketplace `Enable` button cannot enable anything. |
| [`financialDataAccess.ts:244,251`](../../packages/shared/src/business-logic/financialDataAccess.ts#L244) | Both `cost_to_produce` module writes fail. |

⚠️ **THE ONE THING I COULD NOT VERIFY, STATED PLAINLY:** the applied state of `20260802c`
is read from `CLOSE-OUT-LEDGER.md`, **not from the catalog**. There is no `psql` on this
machine — the same recorded limit as the `businesses` recon and the 2026-08-02 ruling on
`npm run verify` and migrations. **One query settles it and it is not mine to run:**

```sql
SELECT p.oid::regprocedure AS signature
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'set_business_module_state';
```

Six arguments → L1 is live. Seven → `20260802c` was applied and never recorded, which is
**the #22 class again, on the same evening, one table over.**

✏️ **A NOTE ON DIRECTION, BECAUSE THE LEDGER ROW READS THE OTHER WAY.** #187 records
*"old bundles keep working because PostgREST binds by NAME and `p_trial_days` DEFAULTs to
NULL."* That is true and it describes **old bundle → new function**. The live pairing is
the **inverse** — new bundle → old function — and it has no such protection. The migration
being gated was a deliberate, correct choice; **shipping the client that requires it was
not gated with it.** That asymmetry is the finding, not the gating.

---

## HAVE — what is there, with `file:line`

### The two generation paths are SEPARATE endpoints with SEPARATE tables

| | Weekly social | Campaign |
|---|---|---|
| Entry | [`Dashboard.tsx:291-300`](../../packages/cultivar-os/src/pages/Dashboard.tsx#L291-L300) | [`Campaigns.tsx:73-90`](../../packages/cultivar-os/src/pages/Campaigns.tsx#L73-L90) |
| Endpoint | `api/social/generate-posts` | `api/campaigns` (`action=generate`) |
| Authority | `campaigns:update` ([`generate-posts.ts:34`](../../packages/cultivar-os/api/social/generate-posts.ts#L34)) | `campaigns:update` ([`campaigns.ts:32`](../../packages/cultivar-os/api/campaigns.ts#L32)) |
| Writes | `social_drafts` ([`:171`](../../packages/cultivar-os/api/social/generate-posts.ts#L171)) | `campaigns` + `campaign_posts` ([`:103`,`:129`](../../packages/cultivar-os/api/campaigns.ts#L103)) |
| Channel CHECK | 5 values (`20260609:33`) | 4 values (`20260529:27`) |
| Config default when absent | `[]` → refuses ([`:61-74`](../../packages/cultivar-os/api/social/generate-posts.ts#L61-L74)) | instagram-only ([`:76`](../../packages/cultivar-os/api/campaigns.ts#L76)) |

**Both read the same config key. Neither hardcodes its channel selection.** That matters
for Q1 and it is the opposite of what the five-platform batch suggests.

### The RLS shape

| Table | Member SELECT | Member WRITE |
|---|---|---|
| `business_modules` | [`20260801:278-280`](../../supabase/migrations/20260801_business_modules_write_narrowing.sql#L278-L280) `is_active_member` | **NONE — deliberate.** All writes via RPC |
| `campaigns` | [`20260727c:17`](../../supabase/migrations/20260727c_campaigns_member_and_plant_events_scope.sql#L17) + `campaigns:read` | insert/update, `campaigns:update` |
| `campaign_posts` | [`20260727c:28`](../../supabase/migrations/20260727c_campaigns_member_and_plant_events_scope.sql#L28) + `campaigns:read` | insert/update, `campaigns:update` |
| `social_drafts` | [`20260727g:25`](../../supabase/migrations/20260727g_social_drafts_member.sql#L25) + `campaigns:update` | UPDATE only, `campaigns:update` |

🔴 **`is_active_member` is NOT owner-inclusive.**
[`20260622:96-101`](../../supabase/migrations/20260622_is_active_member_canonical_rls.sql#L96-L101) requires
an `active = true` row in `business_members`. `campaigns_owner`
([`20260529:19-20`](../../supabase/migrations/20260529_campaigns.sql#L19-L20)) **is**
owner-inclusive. **The two tables answer "is this the owner?" differently**, and that
difference is load-bearing for Q3 and Q7 below.

---

## THE EIGHT QUESTIONS

### Q1 — WHERE IS THE PLATFORM LIST HARDCODED?

**Nine literal enumerations, THREE mutually incompatible sets. Neither generator hardcodes
its selection — every one of the nine is a TYPE, a CONSTRAINT, or a DISPLAY map.**

| # | Site | Values | Set |
|---|---|---|---|
| 1 | [`SocialSetup.tsx:12-17`](../../packages/cultivar-os/src/pages/SocialSetup.tsx#L12-L17) + `:36` | ig, fb, tiktok, twitter, sms | **A (5)** |
| 2 | [`shared/social/generate.ts:55-59`](../../packages/shared/src/social/generate.ts#L55-L59) | ig, fb, tiktok, twitter, sms | **A (5)** |
| 3 | [`shared/campaigns/generate.ts:24-30`](../../packages/shared/src/campaigns/generate.ts#L24-L30) | ig, fb, tiktok, twitter, sms | **A (5)** |
| 4 | [`20260609:33`](../../supabase/migrations/20260609_social_drafts_platform_check.sql#L33) `social_drafts` CHECK | ig, fb, tiktok, twitter, sms | **A (5)** |
| 5 | [`shared/campaigns/types.ts:18`](../../packages/shared/src/campaigns/types.ts#L18) TS union | ig, fb, sms, **email** | **B (4)** |
| 6 | [`20260529:27`](../../supabase/migrations/20260529_campaigns.sql#L27) `campaign_posts` CHECK | ig, fb, sms, **email** | **B (4)** |
| 7 | [`CampaignDetail.tsx:16,19`](../../packages/cultivar-os/src/pages/CampaignDetail.tsx#L16) icons/colors | A ∪ B = 6 | **C (6)** |
| 8 | [`CampaignDetail.tsx:25-30`](../../packages/cultivar-os/src/pages/CampaignDetail.tsx#L25-L30) open-URLs | 4 social, no sms/email | **D (4)** |
| 9 | [`Dashboard.tsx:68,75`](../../packages/cultivar-os/src/pages/Dashboard.tsx#L68) labels/URLs | 4 social, no sms | **D (4)** |

Plus one runtime fallback literal: [`campaigns/generate.ts:129`](../../packages/shared/src/campaigns/generate.ts#L129) `?? 'instagram'`.

🔴 **SET A AND SET B ARE NOT IN A SUBSET RELATIONSHIP IN EITHER DIRECTION.** B has `email`,
which **no channel list, no setup checkbox and no generator prompt anywhere offers**; A has
`tiktok` and `twitter`, which `campaign_posts` rejects. So the campaign path can be
configured — through the only UI that exists — into a state its own table refuses, **and
it can never produce the one value its table reserves a slot for.**

**Are they the same list, two copies, or two different lists?** *Two different lists, and
seven copies spread across them.* This is tech-debt **#20 "platform union"**, now measured
rather than named.

### Q2 — WHAT DOES THE SAVE HANDLER DO?

**Traced end to end. It calls something, it writes to a column that exists, it does not
no-op by design — and on today's database it fails.**

1. [`SocialSetup.tsx:86-115`](../../packages/cultivar-os/src/pages/SocialSetup.tsx#L86-L115) `handleSave` — validates ≥1 channel (`:87-91`), `POST /api/social/enable` (`:97`) with the **full channel array**, not a delta.
2. [`enable.ts:16`](../../packages/cultivar-os/api/social/enable.ts#L16) rejects a non-array or empty array.
3. [`enable.ts:27`](../../packages/cultivar-os/api/social/enable.ts#L27) `callerCan(… 'settings:update')` — deliberately **not** `campaigns:update`; the reason is recorded at `:23-26`.
4. [`enable.ts:50-54`](../../packages/cultivar-os/api/social/enable.ts#L50-L54) `setBusinessModuleState(… { enabled:true, configured:true, config:{ advert_channels, cadence } })`.
5. [`moduleState.ts:93`](../../packages/shared/src/business-logic/moduleState.ts#L93) → `rpc('set_business_module_state')`.
6. [`20260801:241`](../../supabase/migrations/20260801_business_modules_write_narrowing.sql#L241) `config = COALESCE(config,'{}') || COALESCE(p_config_patch,'{}')`.

✅ **The jsonb `||` merge is TOP-LEVEL, so `advert_channels` — an array at a top-level key —
is replaced WHOLESALE, not deep-merged.** An unticked channel really does become
`enabled:false`. **The persistence semantics are correct.** The target column exists and
[`20260801:185-189`](../../supabase/migrations/20260801_business_modules_write_narrowing.sql#L185-L189)
documents `p_config_patch` as existing to carry *"the two config shapes that already exist
(`advert_channels`/`cadence`; the pricing keys)"*.

🔴 **AND IT STILL CANNOT SAVE, FOR THE REASON IN L1** — step 5 cannot resolve. The handler
is not broken; the call it makes has no function to land on.

### Q3 — WHERE DOES THE SETUP PAGE READ ITS INITIAL STATE?

**It reads. [`SocialSetup.tsx:59-75`](../../packages/cultivar-os/src/pages/SocialSetup.tsx#L59-L75)** — anon client,
`business_modules.config`, scoped `business_id` + `module_key='social_media'`,
`.maybeSingle()`. It is not component-local defaults *by design*.

**But the fallback is [`defaultChannels()` at `:33-38`](../../packages/cultivar-os/src/pages/SocialSetup.tsx#L33-L38) — `enabled: c.name === 'instagram'`. Instagram ticked, everything else clear. That is the 14:15 screenshot, exactly.**

🔴 **THREE DIFFERENT CAUSES LAND ON THAT IDENTICAL SCREEN AND THE CODE CANNOT TELL THEM APART:**

| Cause | Why it is invisible |
|---|---|
| (a) genuinely no row | correct behaviour |
| (b) **RLS returned zero rows** | `business_modules_member_select` is `is_active_member(business_id)` ([`20260801:278-280`](../../supabase/migrations/20260801_business_modules_write_narrowing.sql#L278-L280)), and `is_active_member` needs an active `business_members` row — **it does not accept `owner_id`** |
| (c) **a PostgREST error** | `.then(({ data }))` at `:67` **never destructures `error`**, and `.catch()` at `:74` only fires on a thrown exception — a PostgREST error is a resolved promise, so it is silently discarded |

**A real instagram-only selection, a denied read, and a failed read render the same pixels.**
That is D-9 / A9 (*absent is not empty*) and the 2026-07-30 six-state ruling
(*withheld data ANNOUNCES its redaction; never an empty list*) — a **default presented as
a selection**. The owner has no way to know the difference, and neither did this recon
without reading the RLS predicate.

**Does the selection persist?** The write is correct (Q2) and the read is correct (above),
so the answer is *yes in design, no today* — L1 blocks the write, and (b)/(c) can
independently blank the read.

### Q4 — DOES ANY WRITE ON THIS PATH CHECK AFFECTED ROWS?

**Split answer, and the split is the useful part.**

✅ **The config write is E5-CLEAN BY CONSTRUCTION, and it is the only one on the path that
is.** It is an **RPC, not a PostgREST table write**. `set_business_module_state`
`RETURNS TABLE(applied, reason, …)`; [`moduleState.ts:110-111`](../../packages/shared/src/business-logic/moduleState.ts#L110-L111)
reads both; [`enable.ts:60-63`](../../packages/cultivar-os/api/social/enable.ts#L60-L63)
surfaces `applied:false` as a **403 with the reason**, explicitly *"an authority answer,
not a failure."* **A zero-row outcome cannot be reported as success here.** This is what
the answer to E5 looks like when it is built, and it already exists on this path.

🔴 **THREE SIBLING WRITES ON THE SAME FEATURE ARE THE E5 SHAPE, LIVE:**

| Site | What it checks |
|---|---|
| [`Dashboard.tsx:256-262`](../../packages/cultivar-os/src/pages/Dashboard.tsx#L256-L262) `handleSaveEdit` — `social_drafts.edited_text` on blur | **nothing.** No `error`, no count, no `.select()`. `await` and discard |
| [`Dashboard.tsx:270-278`](../../packages/cultivar-os/src/pages/Dashboard.tsx#L270-L278) `status='copied'` | `error` only. On error it warns to console and **leaves the row in the list**; on zero rows it removes it |
| [`campaigns.ts:169`, `:181-184`](../../packages/cultivar-os/api/campaigns.ts#L169) `campaign_posts` updates | **nothing** — service key, `.eq('id', postId)`, no error check, no count |

`social_drafts` **does** carry a member UPDATE policy
([`20260727g:27-30`](../../supabase/migrations/20260727g_social_drafts_member.sql#L27-L30),
gated `campaigns:update`) — so this is not latent the way `businesses` was. **A member
without `campaigns:update` who reaches the dashboard queue edits a draft, sees the edit in
the textarea, and the write matches zero rows in silence.** The rendered state and the
stored state diverge with nothing said.

**Answer for this path: the config write already answers E5 correctly; the draft-review
writes do not.**

### Q5 — WHAT IS THE CAMPAIGN CREATE SEQUENCE?

**The two-orphan reading is CONFIRMED, and there is a second failure mode in the same
sequence that has not been named.**

| Step | Site | Transaction |
|---|---|---|
| 1 | `businesses` read [`:58-63`](../../packages/cultivar-os/api/campaigns.ts#L58-L63) | own |
| 2 | `business_modules.config` read [`:67-72`](../../packages/cultivar-os/api/campaigns.ts#L67-L72) | own |
| 3 | `business_voice_samples` read [`:80-85`](../../packages/cultivar-os/api/campaigns.ts#L80-L85) | own |
| 4 | AI generation [`:87-101`](../../packages/cultivar-os/api/campaigns.ts#L87-L101) | — |
| 5 | 🔴 **`campaigns` INSERT — COMMITS HERE** [`:103-116`](../../packages/cultivar-os/api/campaigns.ts#L103-L116) | own |
| 6 | 🔴 **`campaign_posts` INSERT** [`:119-130`](../../packages/cultivar-os/api/campaigns.ts#L119-L130) | own |

**There is no transaction around 5 and 6.** `db` is a PostgREST client
([`:20-23`](../../packages/cultivar-os/api/campaigns.ts#L20-L23)); each call is its own
autocommitted statement. Step 6 throwing leaves step 5's row permanently committed.
**#69's class exactly — each step atomic, the sequence not — and the reading in Step 1 is
correct.**

🔴 **THE SECOND FAILURE MODE, AND IT IS WHY THE ORPHANS HAVE *ZERO* POSTS RATHER THAN
SOME:** step 6 is a **single multi-row `.insert(postRows)`**, so it is atomic *among the
posts*. **One rejected platform rolls back every post in the batch.** With `tiktok` or
`twitter` in the array, `campaign_posts` refuses the row and the whole batch dies — the
campaign commits, zero posts land.

✏️ **THIS EXACT SENTENCE IS ALREADY WRITTEN IN THIS REPO, ABOUT THE OTHER TABLE.**
[`20260609:10`](../../supabase/migrations/20260609_social_drafts_platform_check.sql#L10):
*"the insert is atomic, one sms row rolls back all rows."* **That was diagnosed on
2026-06-09 for `social_drafts`, fixed for `social_drafts`, and never carried across to
`campaign_posts` — which had the narrower constraint the whole time.** #22's fix and #91's
defect are the same defect on two tables, and only one was fixed.

🔴 **AND NOTHING CLEANS UP.** The catch at
[`:135-138`](../../packages/cultivar-os/api/campaigns.ts#L135-L138) logs and returns 500.
It does **not** delete the campaign row it created 20 lines earlier. Every failed
generation leaves a permanent orphan; **two attempts, two orphans**, which is precisely
what the database shows.

### Q6 — WHY DID THE TWO FAILURES SURFACE DIFFERENTLY?

**Which layer swallows which: the APP layer surfaces the database's message faithfully;
the PLATFORM layer's failures are swallowed by an unguarded `.json()`.**

**Surface 1 — the raw Postgres string. Fully traced, no inference:**
[`campaigns.ts:130`](../../packages/cultivar-os/api/campaigns.ts#L130) `throw new Error(`Posts: ${postsErr.message}`)`
→ [`:137`](../../packages/cultivar-os/api/campaigns.ts#L137) `res.status(500).json({ error: err.message })`
→ [`Campaigns.tsx:84`](../../packages/cultivar-os/src/pages/Campaigns.tsx#L84) `throw new Error(data.error …)`
→ [`:87`](../../packages/cultivar-os/src/pages/Campaigns.tsx#L87) `setGenError(e.message)`
→ [`:170`](../../packages/cultivar-os/src/pages/Campaigns.tsx#L170) rendered verbatim.
**Nothing sanitizes, maps, or wraps it.** The constraint name reached the owner's screen
because every layer passed it through intact — which is, ironically, the honest path
working.

**Surface 2 — the bare 500. The mechanism is identified; which trigger fired is NOT.**
🔴 [`Campaigns.tsx:83`](../../packages/cultivar-os/src/pages/Campaigns.tsx#L83) calls
`await resp.json()` **BEFORE** the `resp.ok` check on `:84`. If the body is not JSON —
a Vercel *platform* error page (`FUNCTION_INVOCATION_TIMEOUT` / `FUNCTION_INVOCATION_FAILED`)
rather than the handler's own response — **`.json()` throws a SyntaxError and the catch at
`:86` puts the PARSER's message in `genError`.** The handler never ran, so there is no
`error` field to show. The 500 in the network tab is real; the text beside it is about
JSON parsing.

Supporting evidence for a **timeout** as the likely trigger, offered as evidence and not
as a conclusion: **no `maxDuration` is configured anywhere** (`vercel.json` holds only
rewrites; grep across the repo returns zero hits), while the page's own copy at
[`Campaigns.tsx:195`](../../packages/cultivar-os/src/pages/Campaigns.tsx#L195) says
generation *"usually takes 15–25 seconds."* **A surface that tells the user to expect 15–25
seconds while the function's duration is left at the platform default is a live risk
regardless of what happened on the second attempt.**

⚠️ **NOT DETERMINED:** which of timeout / invocation-failure / non-JSON body actually
fired. **That needs the Vercel function log for that invocation and cannot be read from
the repo.** Naming the swallowing mechanism is what the code supports; naming the trigger
is not.

### Q7 — DOES THE CAMPAIGN LIST FILTER ON `status`?

**NO. Proven, not inferred.**
[`Campaigns.tsx:48-54`](../../packages/cultivar-os/src/pages/Campaigns.tsx#L48-L54):

```ts
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .eq('business_id', businessId)
      .order('start_date', { ascending: true, nullsFirst: false });
```

No `.eq('status', …)`, no `.in(…)`, no `.neq(…)`. `status` is read **only** for the badge
([`:238-240`](../../packages/cultivar-os/src/pages/Campaigns.tsx#L238-L240)) and
`statusColor` ([`:100-105`](../../packages/cultivar-os/src/pages/Campaigns.tsx#L100-L105)),
which handles `'active'` explicitly. **A filter mismatch is ruled out.**

"No campaigns yet" renders at [`:215-219`](../../packages/cultivar-os/src/pages/Campaigns.tsx#L215-L219)
on `campaigns.length === 0`. **So the SELECT returned zero rows.** And the code cannot say
why:

🔴 [`:50`](../../packages/cultivar-os/src/pages/Campaigns.tsx#L50) destructures `{ data }`
and **discards `error`**; [`:56`](../../packages/cultivar-os/src/pages/Campaigns.tsx#L56)
`if (!data) { setLoading(false); return; }` treats an error **identically** to an empty
tenant. **Empty, denied, and errored are one screen.** Q3's defect, on a different page,
in the same feature — which is what makes it a class rather than a slip.

**Two RLS routes could admit the read and both would have to fail:**
`campaigns_owner` ([`20260529:19-20`](../../supabase/migrations/20260529_campaigns.sql#L19-L20), `owner_id = auth.uid()`, **owner-inclusive**)
**OR** `campaigns_member_select` ([`20260727c:17-18`](../../supabase/migrations/20260727c_campaigns_member_and_plant_events_scope.sql#L17-L18), `is_active_member AND has_permission('campaigns:read')`).
Policies are permissive and OR'd. **If the session is `businesses.owner_id` for that
business, the rows are visible.** They are not, so one of those premises is false.

⚠️ **NOT CHECKED — no catalog access. The discriminating query is David's:**

```sql
SELECT owner_id FROM businesses WHERE id = '<business_id>';
SELECT role, active FROM business_members WHERE business_id = '<business_id>' AND user_id = '<auth.uid()>';
```

✏️ **On `campaigns.status` and #179:** the value is **not** the cause here — but note the
two orphans are `status='active'` with zero posts, and
[`:251-257`](../../packages/cultivar-os/src/pages/Campaigns.tsx#L251-L257) renders a
zero-count **`active`** campaign as **"All posts published ✓"**. **Had the rows been
visible, the page would have claimed two failed generations were fully published
campaigns.** That is §6 r18's class — a label asserting a state the data contradicts —
sitting one RLS predicate away from being on screen.

### Q8 — WHERE SHOULD THE CONFIG LIVE?

**It already lives somewhere (see C-2), so the question is "does it stay", and the honest
answer is that STORAGE IS NOT THE DEFECT.** Options with the precedent each follows:

**Option 1 — KEEP `business_modules.config.advert_channels`.** *Precedent: it IS the
`business_modules.config` pattern.* It is also where the trial pair lives
([`moduleState.ts:50`](../../packages/shared/src/business-logic/moduleState.ts#L50)), and
`20260801:185-189` says the merge exists to carry exactly this shape. One writer, audited,
authority-gated. **Cost, stated:** jsonb has no CHECK, no TS type, no runtime validation —
the 2026-08-01 ruling says of this exact column that *"a key typo fails OPEN."*

**Option 2 — a dedicated table.** *Precedent: none for per-module settings.* It fights
`20260801`'s one-writer narrowing: a new table needs its own policy, its own writer, and a
`verify-write-paths` declaration. Buys a CHECK constraint; costs the audited single door.

**Option 3 — a `business_pricing_config` sibling.** *Precedent: `seedPricingConfig`.* But
that table is money-classified (`verify-universals` `#c` asserts every pricing-config field
is classified confidential-or-not) and channels are not money. **Would import a
classification obligation that does not apply.**

**Option 4 — 🔴 THE ONE I THINK IS ACTUALLY OWED, AND IT IS NOT A STORAGE CHANGE.** The
values store fine and read fine. **What does not exist is a single channel vocabulary.**
Q1 found nine enumerations across three incompatible sets, and **nothing reconciles a
stored `advert_channels` name against either CHECK constraint** — which is how a config the
UI wrote produced an insert its own table refused. The shape that already works here is
`verify-tile-fields`: **one declared vocabulary, DERIVED, feeding both CHECKs and every
display map, with a cap asserting both directions.** Moving the jsonb to a table without
this changes where the wrong value is stored, not whether it is wrong.

**David rules. Nothing built.**

---

## NEED — the irreducible minimum, no preference

1. **Run the `pg_proc` query in L1.** Everything about Save is downstream of it.
2. **`campaign_posts` must accept the channels the only UI can produce, or the UI must stop producing them.** One migration or one array edit. Today the path is unusable end to end.
3. **A failed generation must not leave a committed campaign row** — either wrap 5+6, or delete on catch.
4. **Run the two Q7 queries.** They separate a permissions problem from a data problem.

## WANT — the desired end-state, labelled as want

1. **One derived channel vocabulary** (Q8 option 4) feeding both CHECKs, both generators, the setup page, and all six display maps.
2. **A zero-row / denied / errored read never renders as an empty state** — Q3 and Q7 are one defect on two pages, and the six-state ruling already governs it.
3. **The Q5 sequence as one transactional act** — the durable form is an RPC taking the campaign and its posts as `jsonb`, the shape named for tech-debt #69.
4. **Deploy-order coupling for gated migrations** — L1 exists because client code requiring an unapplied migration shipped without it. Nothing checks that.

---

## ⚠️ WHAT THIS RECON CANNOT SEE (STD-021 — required section)

1. **No catalog access.** No `psql`, no `postgres`, no `docker` on this machine. **Every claim about the LIVE database is read from repo files or from `CLOSE-OUT-LEDGER.md`.** This includes L1's central premise.
2. **A function or constraint created outside the migration path is invisible** (§6 r17). Same standing limit as the `businesses` recon; the schema-snapshot checker is still OWED and still does not exist.
3. **Applied-state of every migration is a DOC read, not a fact.** `20260802c`, `20260727c`, `20260727g` and `20260801b` are all assumed-as-recorded.
4. **The Q6 second-surface trigger needs a Vercel function log.** Not in the repo.
5. **Q7's zero-row cause needs a live session.** Owner-vs-member cannot be resolved statically.
6. **I did not enumerate every `campaign_posts` / `social_drafts` reader** — only the write paths and the generation path the prompt scoped.
7. **The 129 inline-CHECK count is a `grep` of `CHECK (` minus `ADD CONSTRAINT`**; it is an order-of-magnitude figure for sizing Step 6's blind spot, **not a verified constraint inventory.**
8. **No `[TRACE:*]` was read at runtime.** `ADVERT_DEBUG` and `SOCIALDRAFT_DEBUG` are `false` at [`campaigns.ts:5`](../../packages/cultivar-os/api/campaigns.ts#L5), [`generate-posts.ts:5-6`](../../packages/cultivar-os/api/social/generate-posts.ts#L5-L6) and [`SocialSetup.tsx:7`](../../packages/cultivar-os/src/pages/SocialSetup.tsx#L7) — ⚠️ **three of this path's four instrumentation flags are OFF by default, which is worth a look against the STD-003 standing instruction; the emits exist but are silent.** Named, not changed.

---

## CLOSING — the four that decide the fix's shape

- **Q1:** *Two different lists and seven copies across them* — `social_drafts` accepts 5, `campaign_posts` accepts a **non-overlapping** 4 with an `email` nothing produces; neither generator hardcodes its selection, so every one of the nine literals is a type, a constraint, or a display map.
- **Q2:** *It calls `/api/social/enable` → the one-writer RPC → a top-level jsonb merge that correctly replaces the whole array — and on today's database the call cannot resolve at all, because the client sends `p_trial_days` and `20260802c` is unapplied.*
- **Q4:** *The config write is E5-clean by construction — the RPC returns `applied`/`reason` and `enable.ts:60-63` surfaces it as a 403 — while three draft-review writes on the same feature check nothing at all.*
- **Q5:** *Confirmed, not corrected — `campaigns` commits at `:103`, `campaign_posts` inserts at `:129`, no transaction spans them, the posts insert is a single atomic batch so one bad channel kills all of them, and the catch never deletes the row it just created.*
