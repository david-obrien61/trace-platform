# SCOPING — THE CAMPAIGN LIFECYCLE SURFACE

**Date:** 2026-08-23 · **Branch:** `main` · **HEAD at scoping:** `af07437`
**Type:** RECON + ESTIMATE. No app code, no schema, no migration, no cap. ONE document.
**Gate:** `npm run verify` **exit 0, ZERO NET-NEW** — tsc 5 · eslint 247 · knip 10/12/15 · 27/27 files, 1050 assertions. api/ **12/12**.
**GATE 0:** **NOT APPLICABLE** — no app code ships.
**Predecessor:** [`social-campaign-path-recon-2026-08-22.md`](social-campaign-path-recon-2026-08-22.md), as corrected at `af07437`.

---

## ▶ THE ANSWER TO DAVID'S QUESTION, IN THREE LINES — AND IT IS NOT ONE ANSWER

> *"why can i not edit each campaign this is against the rules i can add but not edit or cancel or delete from the app?"*

| Act | What actually blocks it | Ruling needed |
|---|---|---|
| **EDIT** | 🟢 **NOTHING.** The RLS policy exists (`20260727c:21-23`), the string exists and is `enforced`, the owner policy covers it. **There is no UI. That is the whole gap.** | none |
| **CANCEL** | 🟢 **NOTHING.** `campaigns.status` **already permits `'cancelled'`** (`20260529:15`) and `Campaigns.tsx:103` **already renders it red**. The vocabulary and the display are built; **nothing writes the value.** | none |
| **DELETE** | 🔴 **A STANDING RULING, IN THE OPPOSITE DIRECTION, WITH A CAP BEHIND IT.** | **David reverses R2, or rules cancel is the answer** |

**David is right, and he is right about two of the three for free.** Edit and cancel are pure
build — no string, no migration, no ruling, no model question. **Delete is the one that is not a
build at all until he rules**, because the platform has already decided it, twice, and enforces
the decision in `npm run verify`.

### 🔴 AND THE SHARPEST FACT ON THIS PAGE: THE OWNER CAN ALREADY DELETE A CAMPAIGN. AT THE DATABASE. TODAY.

`campaigns_owner` is **`FOR ALL`** ([`20260529:19-20`](../../supabase/migrations/20260529_campaigns.sql#L19-L20)) — which includes DELETE —
and `campaign_posts.campaign_id` is **`ON DELETE CASCADE`** ([`:24`](../../supabase/migrations/20260529_campaigns.sql#L24)).
`20260727c:14-16` says so in as many words: *"NO DELETE — R2 … **DELETE stays owner-only through
the existing `*_owner` policies.**"*

> **So David in the SQL editor is not reaching past a capability the platform lacks. He is
> reaching past a BUTTON, using a policy that is already his.** The distance between "David
> deletes it in Supabase" and "David deletes it in the app" is **one control and one
> `.delete()` call.**

**What actually stands in the way is neither the database nor the policy. It is that the
permission model has no string to gate the button on, and the obvious substitute was
explicitly retired.** That is the ruling, and it is stated in full in **Q6** below.

---

## 🔴 LIVE DEFECT FOUND OUTSIDE THE NINE QUESTIONS — **L2**

### THE "GENERATE MORE POSTS FOR THIS CAMPAIGN" BUTTON CREATES A SECOND CAMPAIGN AND WALKS YOU ONTO IT

**Unfixed, per the scope bar. This is a third face of the same absence — and it is a silent one.**

[`CampaignDetail.tsx:400-411`](../../packages/cultivar-os/src/pages/CampaignDetail.tsx#L400-L411) renders a button reading, verbatim:

```
✦ Generate more posts for this campaign
```

Its handler [`handleGenerateMore` at `:143-167`](../../packages/cultivar-os/src/pages/CampaignDetail.tsx#L143-L167)
POSTs `action:'generate'` with the current campaign's six fields copied out of state — and
`action:'generate'` is the **CREATE** branch. [`campaigns.ts:103-116`](../../packages/cultivar-os/api/campaigns.ts#L103-L116)
**INSERTs a new `campaigns` row** unconditionally; there is no upsert, no `id` in the body, and
nothing in the endpoint that could target an existing campaign.

Then [`:164`](../../packages/cultivar-os/src/pages/CampaignDetail.tsx#L164) `navigate(\`/campaigns/${data.campaignId}\`)` — **the NEW campaign's id.**

> **The owner presses a button that says "for this campaign", gets a duplicate campaign with the
> same name, type, dates, focus and description, and is silently moved onto it. The campaign he
> was looking at never receives a post, ever.**

🔴 **AND IT IS THE ONLY GENERATE PATH WITH NO ERROR SURFACE AT ALL.** [`:165`](../../packages/cultivar-os/src/pages/CampaignDetail.tsx#L165)
is `catch { /* silent */ }`, and [`:164`](../../packages/cultivar-os/src/pages/CampaignDetail.tsx#L164)
only navigates `if (resp.ok)` — with **no `else`**. A 500 from this button does nothing
observable whatsoever: the spinner stops and the screen is unchanged.

**Therefore it is a SECOND, SILENT ORPHAN FACTORY.** Every failed press leaves a committed
`campaigns` row with zero posts (Q5's mechanism) **and says nothing** — where the `/campaigns`
form at least renders `genError` ([`Campaigns.tsx:170`](../../packages/cultivar-os/src/pages/Campaigns.tsx#L170)).

✏️ **This is not a slip; it is the shape of the gap David is asking about.** There is exactly one
write path into this feature — CREATE — so a build that needed *"add posts to an existing
campaign"* had nowhere to go and rode CREATE instead. **A missing lifecycle does not stay
missing. It gets impersonated by the path that exists.**

⚠️ **NOT DETERMINED:** whether either "arbor day" orphan came from this button rather than from
two presses of the `/campaigns` form. Both routes produce the identical row and neither leaves a
marker. **Distinguishing them needs the Vercel function log, not the repo.**

---

## 🔴 SECOND, SMALLER, AND OFF THIS PATH — noted once, not pursued

[`packages/shared/src/pages/Settings.tsx:415-419`](../../packages/shared/src/pages/Settings.tsx#L415-L419)
`deleteOffering` runs a bare `.delete()` on `service_offerings` — **one of the same five
unmintable-delete tables** — with **no confirm, no client authority gate, and no affected-row
check**, on a route gated only on `settings:read` ([`router.tsx:175`](../../packages/cultivar-os/src/router.tsx#L175)).
`service_offerings_member` is **`FOR SELECT` only** ([`20260727:186-187`](../../supabase/migrations/20260727_rbac_resource_action_flip.sql#L186-L187)),
so a manager's delete matches zero rows and reports success — **E5's shape, already an OPEN
ruling** (`RULINGS.md` OWED). Named because it is direct evidence for **Q5** below: *the
unmintable-delete rule forbids a STRING, and it has never forbidden a delete OPERATION.*
**Not this task's scope; not fixed.**

---

# HAVE — what is there, with `file:line`

## Q1 — EVERY READ AND WRITE ON `campaigns` / `campaign_posts`

**TEN sites, three files, and nothing else in the repo touches either table.** Keyed with the
shared [`scripts/lib/siteKey.mjs`](../../scripts/lib/siteKey.mjs) — computed by running the
module, not hand-derived, and **not re-keyed**.

| # | Site key | Line | Act |
|---|---|---|---|
| 1 | `packages/cultivar-os/api/campaigns.ts::posts#campaigns.insert` | `:104` | 🔴 **THE ONLY WRITE TO `campaigns` ANYWHERE** |
| 2 | `packages/cultivar-os/api/campaigns.ts::postRows#campaign_posts.insert` | `:129` | the atomic post batch |
| 3 | `packages/cultivar-os/api/campaigns.ts::db#campaign_posts.select` | `:160` | copy-post read |
| 4 | `packages/cultivar-os/api/campaigns.ts::wasEdited#campaign_posts.update` | `:169` | `edited_copy` |
| 5 | `packages/cultivar-os/api/campaigns.ts::wasEdited#campaign_posts.update@2` | `:181` | `status='published'` |
| 6 | `packages/cultivar-os/src/pages/Campaigns.tsx::loadCampaigns#campaigns.select` | `:51` | the list |
| 7 | `packages/cultivar-os/src/pages/Campaigns.tsx::counts#campaign_posts.select` | `:62` | draft count (head) |
| 8 | `packages/cultivar-os/src/pages/CampaignDetail.tsx::load#campaigns.select` | `:56` | detail |
| 9 | `packages/cultivar-os/src/pages/CampaignDetail.tsx::load#campaign_posts.select` | `:57` | detail posts |
| 10 | `packages/cultivar-os/src/pages/CampaignDetail.tsx::saveEdit#campaign_posts.update` | `:88` | inline post edit |

**THE SHAPE OF THE ENUMERATION IS ITSELF THE FINDING:**

- 🔴 **ONE write to `campaigns` in the entire repo, and it is an INSERT.** No UPDATE. No DELETE.
  Not in the api, not in a component, not in an RPC, not in a trigger. **David's premise is
  exactly correct and it is provable in one line.**
- **`campaign_posts` has four writes and all four are UPDATEs on an existing row.** The posts
  have more lifecycle than the thing they hang off.
- **Site 10 duplicates site 4.** `CampaignDetail.tsx:88` writes `campaign_posts.edited_copy`
  through the anon client; `campaigns.ts:169` writes the same column through the service key —
  **the same OPERATION in two places, §6 r8's semantic-dup class.** They also disagree: the api
  version writes a `business_voice_samples` tone-learning row beside it, the client version does
  not. **Named, not fixed** — it is a reuse target for PIECE B, not this recon's job.

✏️ **AN HONEST NOTE ON FOUR OF THE KEYS.** Sites 1, 2, 4, 5 and 7 bind to `posts`, `postRows`,
`wasEdited` and `counts` — **locals, not the enclosing function**, because
`bindingAt()` takes the nearest preceding declaration and `api/campaigns.ts` is one long
`export default handler` full of `const`s. The keys are **stable** (that is what #78 asked
for), but `siteKey.mjs`'s own header warns that *"a key a human cannot read is a key that gets
re-baselined without being read."* **Reported as observed. No cap keys on these sites today, so
nothing is broken — but any future ratchet over this file inherits it.**

## Q2 — THE ROW'S LIFECYCLE IN THE DATA

**Four legal values. The app writes ONE. Three of the four are unreachable.**

| Value | Written by | Read by |
|---|---|---|
| `draft` | 🔴 **nothing in the app.** Only the 2026-05-29 seed ([`:157`](../../supabase/migrations/20260529_campaigns.sql#L157)) | [`Campaigns.tsx:251`](../../packages/cultivar-os/src/pages/Campaigns.tsx#L251) — *"No posts yet — open to generate"* |
| `active` | [`campaigns.ts:113`](../../packages/cultivar-os/api/campaigns.ts#L113) — **hardcoded, unconditional, every campaign** | `statusColor` `:101`, badge `:239` |
| `completed` | 🔴 **nothing, anywhere** | `statusColor` `:102` |
| `cancelled` | 🔴 **nothing, anywhere** | `statusColor` **`:103` — already styled red** |

The column CHECK ([`20260529:14-15`](../../supabase/migrations/20260529_campaigns.sql#L14-L15))
permits all four. `CampaignDetail.tsx` **never reads `campaign.status` at all** — its two
`status` reads (`:181`, `:182`, `:248`) are `post.status`, a different column on a different table.

> **Is `active` a state anything acts on, or a default nobody consumes?** **It is a default
> nobody consumes.** It is written as a literal at one line, and every read of it is
> presentational — a colour and a word in a pill. **Nothing branches on it. Nothing filters on
> it. Nothing schedules on it.**

🔴 **AND THAT IS #179's FORM WITH A TWIST THAT MATTERS FOR THE ESTIMATE.** #179 was a field with
a renderer and no writer, wrong for nine weeks. Here the renderer is not merely present — **it is
COMPLETE.** `statusColor` handles all four values including the two nothing writes, with correct
semantic colours. **The display half of CANCEL is already shipped and has been sitting unused
since 2026-05-29.** A cancel build writes a value into a slot that is already painted.

## Q3 — 🔴 IS THERE A PUBLISH PATH, AND WOULD IT PICK UP AN ORPHAN?

# **NO. THE ORPHANS ARE INERT. NOTHING WILL EVER ACT ON THEM.**

**This is at the top because it decides whether the two rows are a hazard or a mess, and they
are a mess.** Four independent checks, all negative:

1. **No scheduler exists.** [`vercel.json`](../../vercel.json) contains **only** a `rewrites`
   array — **no `crons` key** — and `grep` for `cron` across `vercel.json` and `package.json`
   returns nothing. There is no scheduled invocation of anything in this platform.
2. **The publish seam is declared INERT, in writing.** [`campaigns.ts:9-13`](../../packages/cultivar-os/api/campaigns.ts#L9-L13):
   *"auto-publish seam: **inert.** Campaign posts use handoff model (owner copies + posts
   manually). … **Blotato was removed — it misrepresented capability.**"*
3. **The only writer of `status='published'` is keyed on an explicit id.**
   [`campaigns.ts:181-184`](../../packages/cultivar-os/api/campaigns.ts#L181-L184) runs
   `.eq('id', postId)`, where `postId` comes off a request body a human's button filled in
   ([`CampaignDetail.tsx:107`](../../packages/cultivar-os/src/pages/CampaignDetail.tsx#L107)).
   Its own comment at `:180`: *"Mark as reviewed — owner copied it, **not auto-published**."*
4. **Nothing anywhere queries `campaigns` by `status`.** Confirmed for the list (Q7 of the prior
   recon) and, in this pass, across all ten sites in Q1: **no site filters on `campaigns.status`
   in any form.**

**`scheduled_date` is a DATE THE AI WROTE INTO A ROW FOR A HUMAN TO READ**
([`generate.ts:113`](../../packages/shared/src/campaigns/generate.ts#L113) — it is a field in the
JSON schema the model fills). **No code reads it to decide when to do anything**; it is rendered
by [`CampaignDetail.tsx:275`](../../packages/cultivar-os/src/pages/CampaignDetail.tsx#L275) and
sorted on at `:57`. **That is its entire consumer set.**

> **Consequence for the estimate: the orphan cleanup is NOT urgent and is NOT a safety fix. It
> is a correctness-of-display fix.** Nothing is going to send anything. That removes the only
> argument for rushing DELETE ahead of the ruling it needs.

## Q4 — WHAT WOULD EDIT HAVE TO TOUCH?

**The evidence first, because it narrows the three options to a real one.**

Post copy is generated from the campaign's fields **and the campaign's date window**:
[`generate.ts:104`](../../packages/shared/src/campaigns/generate.ts#L104) —
*"Write N posts **spread across the campaign window**"* — with `target_category` and
`description` interpolated at `:100-101`. Each returned post carries its own `scheduled_date`
([`:113`](../../packages/shared/src/campaigns/generate.ts#L113)).

**So editing name/dates/focus after generation genuinely invalidates something:** the posts'
`scheduled_date` values were chosen for the OLD window, and their text was written for the OLD
focus. This is not hypothetical drift — it is a date range the model was told to spread across.

**AND SO DOES REFUSING THE EDIT:** posts also carry **owner-authored `edited_copy`**
([`CampaignDetail.tsx:88`](../../packages/cultivar-os/src/pages/CampaignDetail.tsx#L88)) and have
seeded **`business_voice_samples` tone rows** ([`campaigns.ts:171-177`](../../packages/cultivar-os/api/campaigns.ts#L171-L177)),
which are the platform's accumulating record of how this owner writes. **Regeneration destroys
owner work that the tone engine depends on.**

| Option | Cost | What it breaks |
|---|---|---|
| **(a) Regenerate posts on edit** | an AI call (15–25s) per edit; needs the campaign's posts deleted or superseded | 🔴 **destroys `edited_copy` and orphans the tone samples that reference the old text.** Also: an edit as small as fixing a typo in the name triggers a full regeneration and a bill |
| **(b) Orphan the existing drafts** (edit freely, posts untouched) | ~nothing | 🔴 **silently.** The detail page would show posts scheduled outside the campaign's own window with no explanation — a screen contradicting itself, §6 r18's class |
| **(c) Refuse the edit once posts exist** | ~nothing | 🔴 **the campaign becomes unmaintainable at the moment it becomes useful.** A typo in the name is permanent. **And it does not even answer David's question** — the two orphans have ZERO posts, so (c) would permit editing them and forbid editing every campaign that worked |

### 🔴 RECOMMENDATION — **(b), MADE HONEST. DAVID RULES.**

**Allow the edit unconditionally. Do not touch the posts. And make the divergence ANNOUNCE
ITSELF** — the detail page says *"3 posts were written for May 1–11, before this campaign's dates
changed"* with a **Regenerate** control beside it, which is (a) offered as a choice rather than
imposed as a side effect.

**Three reasons, in order of weight:**

1. **It is the only option that does not destroy information.** (a) destroys owner edits, (c)
   destroys the ability to correct a mistake. (b) destroys nothing, and the divergence it creates
   is a FACT the owner can see and act on. **That is A9 on this surface: absent is not empty, and
   stale is not current.**
2. **It puts the expensive, destructive act behind an explicit choice.** Regeneration costs money
   and time and eats `edited_copy`; the owner should be the one who asks for it, on a screen that
   tells him what it will cost him.
3. **It reuses PIECE D.** Once L2 is fixed, "regenerate for the new window" is the same endpoint
   branch as "generate more posts for THIS campaign" — **one build serving two needs**, which is
   the difference between COHERENT costing five prompts and costing eight.

⚠️ **THE COST OF (b), STATED AND NOT HIDDEN:** it adds a divergence indicator, which is a new
piece of UI with its own six-states obligation. **(b)-without-the-indicator is (b)-silently,
which is the option I am recommending against.** If David wants the cheapest possible edit,
that is (b)-silently and it should be chosen knowing it ships a screen that contradicts itself.

## Q5 — ARE CANCEL AND DELETE THE SAME ACT?

# **NO — AND THE PLATFORM ALREADY RULED THIS, BY NAME, ABOUT THIS TABLE.**

[`permissionManifest.ts:195-202`](../../packages/shared/src/auth/permissionManifest.ts#L195-L202):

> **THE FIVE UNMINTABLE DELETES (R2 + A3, all five tombstone-verified 2026-07-26):**
> customers · service_offerings · deliveries · **campaigns** · assets
> **A `status` column is NOT a tombstone.** customers/deliveries/**campaigns** each HAVE a
> `status` column, and it carries LIFECYCLE meaning (pending/delivered, draft/ended). A tombstone
> is column + writer RPC + ledger row + audit row + read filters — what `soft_delete_inventory`
> is and these have none of. **A future delete build adds a SEPARATE tombstone column;
> overloading lifecycle would be one column carrying two facts, which is the STD-011 defect this
> program exists to end.**

**So Q5's answer is not a preference and it is not new: CANCEL is lifecycle, DELETE is removal,
and `campaigns.status` may NOT carry both.** #71 is not a risk here — it is the defect this
paragraph was written to prevent, and it was written about this exact table.

**Is a tombstone field owed?** **Only if David reverses R2** — and if he does, the spec already
specifies what the build is: *"tombstone column + RPC + read filters"*
([spec:77](../resource-action-permission-spec.md#L77)). **That is a MIGRATION and it is the real
cost of delete**, not the button.

🔴 **BUT THE PRECEDENT CUTS THE OTHER WAY TOO, AND IT MUST BE SAID.** The unmintable-delete rule
forbids a **permission STRING** — `verify-universals.mjs:1712` fails the build when the literal
`campaigns:delete` appears in code — and **it has never forbidden a delete OPERATION.**
`service_offerings` is on the same list and has a live, ungated `.delete()` shipping today
(see the second 🔴 above). **`orders` has a full delete path** with cascade
([`submit.ts:1331-1334`](../../packages/cultivar-os/api/orders/submit.ts#L1331-L1334)).
**A hard delete on `campaigns` would not break any cap** — it would only break the ruling, which
is a different and more serious thing. **Naming this so nobody discovers it later and treats
"the build stays green" as permission.**

### 🔴 RECOMMENDATION — **CANCEL NOW, DELETE ONLY IF DAVID REVERSES R2. DAVID RULES.**

Cancel is free (Q2: the value and its colour already exist), needs no ruling, no string and no
migration, and **it fully solves the operational problem in STEP 1**: a cancelled orphan is off
the active list, correctly coloured, and honestly labelled. **The two "arbor day" rows stop
lying without anyone reversing anything.**

⚠️ **AND THE HONEST LIMIT OF THAT RECOMMENDATION: it is not what David asked for.** He asked to
delete. Cancel leaves the row. **If "I want it gone" is the requirement rather than "I want it to
stop pretending", then R2 is what is in the way and reversing it is the task** — with the
tombstone build the spec already scoped. **That is his call and I am not making it in code.**

## Q6 — WHAT DOES THE MANIFEST SAY?

[`permissionManifest.ts:506-516`](../../packages/shared/src/auth/permissionManifest.ts#L506-L516):

```ts
campaigns: {
  category: 'growth',
  verbs: ['read', 'create', 'update'],
  status: { read: 'enforced', create: 'declared-unwired', update: 'enforced' },
  note: 'R2: no delete verb — no tombstone … and per David's ruling LIKELY NEVER: a deleted
         campaign destroys its own history.'
}
```

| String | Status | Gates today |
|---|---|---|
| `campaigns:read` | **enforced** | `campaigns_member_select`, `campaign_posts_member_select` (`20260727c:17,28`) |
| `campaigns:create` | 🔴 **declared-unwired** | **nothing.** It exists in the model and gates no code |
| `campaigns:update` | **enforced** | the api route (`campaigns.ts:32`) **and all four member write policies** (`20260727c:19-23,30-34`) |
| `campaigns:delete` | 🔴 **DOES NOT EXIST, AND MUST NOT** | `verify-universals.mjs:1705-1712` **fails the build** on the literal; `permissionManifest.test.ts:101` asserts its absence |

**CREATE RIDES `campaigns:update`, AND THAT IS DELIBERATE, NOT DRIFT.**
[`20260727c:25-27`](../../supabase/migrations/20260727c_campaigns_member_and_plant_events_scope.sql#L25-L27):
*"INSERT rides `campaigns:update` because authoring a post IS authoring the campaign;
`campaigns:create` is declared-unwired (R-B2) and **must not appear in a gate.**"*
And `permissionManifest.ts:78` explains why `campaigns:create` is not even `planned`:
*"**the next verb is obvious is not a scoped build.**"*

### DERIVING FROM THE ACT (the 2026-07-31 method rule — never from who needs to pass)

- **"Edit a campaign's name, dates, focus, description"** → *what capability is exercised?*
  **Authoring the campaign.** → **`campaigns:update`. EXISTS. ENFORCED. NO MINT.**
- **"Move a campaign to cancelled"** → *what capability?* **Authoring the campaign's lifecycle —
  a field on the campaign.** Per the 2026-07-31 ruling *a permission gates a capability, not a
  field* → **`campaigns:update`. EXISTS. NO MINT.**
- **"Remove the campaign and its history"** → *what capability?* **Destruction of the record —
  genuinely a different act from authoring it**, which is precisely why R2 treated it separately.
  → **`campaigns:delete`. NAMED, NOT MINTED. It is forbidden by a cap and by a ruling.**

### 🔴 THE RULING THIS ACTUALLY FORCES, AND IT IS NOT THE ONE ANYBODY EXPECTED

**If David permits delete, WHAT GATES THE BUTTON?** There is no string and there may not be one.
And the obvious substitute is disqualified: `isOwner` was ruled **DISPLAY ONLY** on 2026-07-30
(`RULINGS.md:65` — *"`owner_id` is a fact about who owns the business, NOT an authority
mechanism"*), and [`BusinessProvider.tsx:735-736`](../../packages/shared/src/context/BusinessProvider.tsx#L735-L736)
records that `isOwner` survives in exactly **two** places, both display. **Three ways out:**

| | Approach | Cost | Objection |
|---|---|---|---|
| **(a)** | Reverse R2 fully — mint `campaigns:delete` **with the tombstone the spec requires** | **MIGRATION** + cap edit (`verify-universals.mjs:1705`) + test edit (`permissionManifest.test.ts:101`) + read filters on all 4 select sites | the largest, and the only one that leaves the model coherent |
| **(b)** | **Hard delete, gated in the client on `isOwner` as DISPLAY; RLS `campaigns_owner FOR ALL` is the AUTHORITY** | **~1 prompt. No migration. No string. No cap change** | 🔴 **looks exactly like the pattern 2026-07-30 retired** — even though it is structurally different (the gate decides visibility; the policy decides permission, and it already exists) |
| **(c)** | An owner-only RPC on the `set_business_module_state` precedent — audited, returns `applied`/`reason` | **MIGRATION**, ~2 prompts | correct and durable; **buys auditing for a row we just agreed carries history worth keeping** |

**RECOMMENDATION — (b) for now, (c) named as the durable form. DAVID RULES.**
(b) is honest on its own terms: the authority IS `campaigns_owner`, which is server-side, already
applied, and not something a client gate can widen. What the client does is decide whether to
DRAW the control — which is what `isOwner` is *for* under the 2026-07-30 ruling.
⚠️ **The tension is real and I am flagging it rather than reasoning past it:** this is the first
control in the platform whose only client gate would be `isOwner`, and *"it is display, RLS is
the authority"* is exactly the sentence someone will reuse later for a case where it is false.
**If that worries David, (c) is the answer and it costs a migration.**

## Q7 — THE TRANSACTION QUESTION

**The prior recon's Q5 stands, unchanged and confirmed by re-reading:** `campaigns` commits at
[`:103-116`](../../packages/cultivar-os/api/campaigns.ts#L103-L116), `campaign_posts` inserts at
[`:129`](../../packages/cultivar-os/api/campaigns.ts#L129), `db` is a PostgREST client
([`:20-23`](../../packages/cultivar-os/api/campaigns.ts#L20-L23)) so each call autocommits, and
the catch at [`:135-138`](../../packages/cultivar-os/api/campaigns.ts#L135-L138) **does not
delete the row it created twenty lines earlier.** #69's class.

**Four options, and the cheapest honest one is not a transaction at all:**

| | Option | Size | Honest? |
|---|---|---|---|
| **(d)** | 🔴 **VALIDATE THE CHANNELS BEFORE THE AI CALL.** Reconcile `advert_channels` against what `campaign_posts` accepts at [`:74`](../../packages/cultivar-os/api/campaigns.ts#L74), and refuse or filter **with a stated reason**, before spending 15–25s and before inserting anything | **~1 prompt, no migration** | ✅ **YES, and it is strictly better than a rollback** — it removes the dominant CAUSE rather than cleaning up after it. ⚠️ **Honest only if the accepted set is DERIVED** (F2); hardcoding it here mints a TENTH enumeration |
| **(a)** | Compensating delete in the catch — `db.from('campaigns').delete().eq('id', newCampaign.id)` | **~0.5 prompt, rides another** | ✅ **Yes, IF the failed compensation is itself surfaced.** It is a compensating action that can fail; silent failure would make it a guard the write does not depend on (STD-023) |
| **(b)** | One plpgsql RPC taking campaign + posts as `jsonb`, #69's named durable form | **MIGRATION, ~2 prompts + apply** | ✅ the correct end-state |
| **(c)** | Insert posts first | — | ❌ **IMPOSSIBLE.** `campaign_posts.campaign_id` is `NOT NULL REFERENCES campaigns(id)` ([`20260529:24`](../../supabase/migrations/20260529_campaigns.sql#L24)) |

### 🔴 THE ANSWER TO THE QUESTION AS ASKED — **YES, THERE IS AN HONEST CLIENT-SIDE ANSWER, AND IT IS (d) + (a) TOGETHER.**

**(d) stops orphans being created. (a) cleans up the residue when something else fails.**
Neither is a transaction, and together they reduce the orphan window from *"every failed
generation, always"* to *"only when the AI call succeeds, the campaign insert succeeds, the posts
insert fails for a reason other than a channel value, AND the compensating delete also fails."*

**(b) remains the durable form and it should not be built yet** — it would encode the current
channel vocabulary into a stored function, and **F2 is the open question about what that
vocabulary is.** Writing the RPC before the vocabulary is settled means writing it twice.

## Q8 — THE ORPHAN AS A PRODUCT FEATURE

# 🔴 IT IS NOT HIDDEN. IT IS AFFIRMATIVELY MISLABELLED AS A FINISHED CAMPAIGN.

[`Campaigns.tsx:247-257`](../../packages/cultivar-os/src/pages/Campaigns.tsx#L247-L257) is a
three-way branch, and **the fall-through is a green claim:**

```tsx
{c.draft_count > 0 ? ( "{n} posts ready to review →" )
 : c.status === 'draft' ? ( "No posts yet — open to generate" )
 : ( "All posts published ✓" )}          // ← every other case lands here
```

An orphan is `status='active'` with **zero** posts, so `draft_count` is 0 and `status` is not
`'draft'` → **it renders "All posts published ✓".**

**THREE GENUINELY DIFFERENT STATES COLLAPSE ONTO THAT ONE SENTENCE:**

| State | Why it lands there |
|---|---|
| every post copied & posted | ✅ correct — the sentence is true |
| 🔴 **zero posts ever existed** (the orphan) | `draft_count === 0` and `status !== 'draft'` |
| 🔴 **the count query FAILED** | [`:61-66`](../../packages/cultivar-os/src/pages/Campaigns.tsx#L61-L66) binds `{ count }` only, **discards `error`**, and coalesces `count ?? 0` |

**That third row is a THIRD instance of §6/R1's class on a page that already has one** — the
recon found `:50` discarding `error` on the campaign list; **`:62` does the same thing on the
post count, and the two compose: a page whose list read failed shows "No campaigns yet"; a page
whose COUNT read failed shows every campaign as fully published.**

**This is §6 r18 exactly** — *a header/label asserting a state the data contradicts* — and it is
D-9's *absent is not empty* with a check mark on top. **A ✓ is the strongest affirmative signal
in the UI vocabulary, and it is what a failed generation currently earns.**

### 🔴 RECOMMENDATION — **YES, THE SURFACE MUST SHOW IT, AND IT IS SMALL**

Count **total** posts, not draft posts, and branch on the real states:

- `total === 0` and `status !== 'draft'` → **"No posts — generation didn't finish"**, with the
  cancel affordance right there. **That row is the orphan, named.**
- the count read errored → **say so**; never `?? 0`.
- `total > 0 && draft_count === 0` → *"All posts copied ✓"* — **the sentence becomes true.**

**This is the six-states ruling applied to a list row, and it is the piece that makes CANCEL
usable** — a cancel button is worthless on a row the owner has no reason to suspect.

## Q9 — WHAT IS ALREADY BUILT THAT THIS SHOULD REUSE?

**Reuse-don't-recreate, and the largest win is the one nobody would look for: THE EDIT FORM
ALREADY EXISTS AS THE CREATE FORM.**

| Need | Reuse | Where |
|---|---|---|
| 🔴 **The edit form** | **The create form block — SIX FIELDS, IDENTICAL SET.** name · type-select · target_category · start_date · end_date · description, with `inputStyle` already defined | [`Campaigns.tsx:120-198`](../../packages/cultivar-os/src/pages/Campaigns.tsx#L120-L198) |
| Destructive confirm | **`window.confirm` + consequence-naming copy — the platform's incumbent, 17 sites.** The model to copy is the one that names the COUNT and the CONSEQUENCE | [`Discounts.tsx:113`](../../packages/cultivar-os/src/pages/Discounts.tsx#L113), `:138` |
| Delete-a-parent-with-children | **The nearest analogue in the repo** — confirm names the side effect and *"cannot be undone"* | [`OrderDetail.tsx:232`](../../packages/cultivar-os/src/pages/OrderDetail.tsx#L232) |
| Server-side delete shape | children then parent, final delete scoped `.eq('business_id', …)` — **though `campaign_posts` CASCADEs, so the children step is not needed here** | [`submit.ts:1331-1334`](../../packages/cultivar-os/api/orders/submit.ts#L1331-L1334) |
| Dirty-check on cancelling an edit | *"Discard your changes to this customer?"* | [`CustomerPartyEditor.tsx:178`](../../packages/cultivar-os/src/components/customers/CustomerPartyEditor.tsx#L178) |
| Endpoint room | 🔴 **api/ is 12/12 — NO NEW FILE.** Ride `api/campaigns`'s existing `action` switch ([`:45`,`:149`,`:195`](../../packages/cultivar-os/api/campaigns.ts#L45)), which is already the documented consolidation seam shape (§6 r11) | — |

🔴 **THE FORM IS THE FINDING.** `Campaigns.tsx:120-198` is 78 lines of form that a campaign
EDIT needs verbatim. Building an edit modal from scratch would produce a second copy of six
inputs that must stay in step with the create form forever — **§6 r8's semantic-dup class,
authored deliberately.** The edit build's FIRST act should be extracting that block to a
`CampaignForm` component consumed by both.

✏️ **ON MODALS, so it is a decision and not an omission:** `window.confirm` sidesteps
`ui-control-standards` M3/M4/M5 (escape-to-close / backdrop / focus-trap), which are KNOWN
open gaps for **custom** modals. Using `window.confirm` here is **consistent with 17 existing
sites** and adds no new debt to that board. **A custom confirm dialog would.** Recommend
`window.confirm`; if David wants the custom sheet, it is a separate build against M1–M5.

---

# NEED — the irreducible minimum, no preference

1. **A STORY.** `user_stories.md` contains **ZERO campaign entries** — grep for "campaign"
   across all 98KB returns nothing, and none of the eight `## ARC:` sections covers this surface.
   Per the §9 story-reconciliation gate this is **IN CODE BUT NOT ON THE BOARD** → flag + write
   the story **before any build spec.** *(David dictates → Lightning specs.)* **This is a hard
   prerequisite for every piece below and it is not a Thunder prompt.**
2. **The list must stop claiming a failed generation is a published campaign** (Q8). Without
   this, nothing else on the surface is reachable or believable.
3. **One way to take a campaign out of the active set** — cancel (free) or delete (ruled).
4. **A failed generation must not leave a committed campaign row** (Q7 (d)+(a)).
5. **David's ruling on R2.** Everything about delete is downstream of it and nothing else is.

# WANT — the desired end-state, labelled as want

1. **The whole lifecycle through one path** — one `CampaignForm`, one endpoint, one authority
   string, create/edit/cancel all landing on the same surface. **This is what A1 asks for and it
   is achievable without a single migration.**
2. **One derived channel vocabulary** (F2 / the prior recon's Q8 option 4) feeding both CHECKs,
   both generators, the setup page and all six display maps.
3. **The Q7 sequence as one transactional act** — the jsonb RPC, after the vocabulary settles.
4. **A tombstone on `campaigns`**, *if and only if* David reverses R2 — column + RPC + ledger row
   + audit row + read filters, as the spec already scoped it.

---

# THE F1 / F2 / F3 DEPENDENCY ORDER

**The question was "which is a prerequisite of which", and the answer is provable rather than
preferential — the prompt's own hypothesis is correct, and the real dependency runs the other
way from where one would look.**

### 🔴 F1 (lifecycle) DOES **NOT** DEPEND ON F2 (vocabulary). PROVEN, NOT ASSUMED.

**Not one of edit, cancel or delete writes `campaign_posts.platform`.** Edit writes columns on
`campaigns`; cancel writes `campaigns.status`; delete removes rows. **`campaign_posts_platform_check`
is not on any of their code paths** — it is only ever evaluated by the INSERT at
[`campaigns.ts:129`](../../packages/cultivar-os/api/campaigns.ts#L129), which none of them calls.

**The prompt's own instinct is right and this confirms it:** *"a delete path that works on a row
a failed create left behind may not need F2 at all."* **It needs none of it.** The lifecycle
build could ship today against a vocabulary that stays broken, and every one of its acts would
work correctly on every row including the orphans.

### 🔴 F3 (the discarded read error) IS A PREREQUISITE OF F1's VALUE — AND THAT IS THE NON-OBVIOUS ONE.

F3 is not a prerequisite of F1's **code** — a cancel button compiles and runs regardless. It is
a prerequisite of F1 being **reachable and believable**:

- If the list read fails, `Campaigns.tsx:56` renders **"No campaigns yet"** over live rows
  ([`:50`](../../packages/cultivar-os/src/pages/Campaigns.tsx#L50) discards `error`).
  **A lifecycle control on a row that does not render is a control nobody can press.**
- If the count read fails, the row renders **"All posts published ✓"**
  ([`:62`](../../packages/cultivar-os/src/pages/Campaigns.tsx#L62), same class). **A cancel
  button beside a green check is a button nobody has a reason to press.**

> **Ship F1 without F3 and the most likely observed outcome is "the new buttons don't work" —
> when in fact they were never drawn.** That is #60's shape landing on a feature instead of a
> deploy, and it would cost a session to diagnose.

### F2 IS A PREREQUISITE OF NOTHING ON THIS PATH.

It gates **future generation only**, and it is the only one of the three requiring a **MIGRATION**
(widening `campaign_posts_platform_check` — David applies) **and a ruling** (which set wins).
Its cheap stopgap — Q7 option (d), validate before generating — is **independent of F1 and
buildable without the migration**, though honest only as a stopgap.

## **ORDER: F3 → F1 → F2.**

**F3 first because it decides whether F1 is visible. F1 second because it is unblocked, free of
migrations, and answers the question David actually asked. F2 last because it is the only one
that needs the database changed and the only one whose absence breaks nothing that already
exists.**

---

# THE ESTIMATE

**Sizing unit: THUNDER PROMPTS of the size run this week** — one build spec, one commit, `npm run
verify` green, docs closed out. Not hours.

| Piece | What it touches | MIGRATION? | RULING? | Size |
|---|---|---|---|---|
| **⓪ STORY** | `user_stories.md` — a `### ` block under an ARC | no | **DAVID DICTATES** | **not a Thunder prompt** |
| **A — CANCEL** | `CampaignDetail.tsx` (button + confirm) · `Campaigns.tsx:251-256` (the label) | **no** | **no** | **1** |
| **B — EDIT** | extract `CampaignForm` from `Campaigns.tsx:120-198` · `CampaignDetail.tsx` · `api/campaigns.ts` new `action` branch · the Q4 divergence indicator | **no** | **Q4** | **2** |
| **C — THE HONEST READ (F3 + Q8)** | `Campaigns.tsx:50,62,247-257` · `CampaignDetail.tsx:55-61` | **no** | touches the §6/R1 **draft** | **1** |
| **D — L2, "generate more"** | `CampaignDetail.tsx:143-167` · `api/campaigns.ts` action branch | **no** | **append or remove?** | **1** |
| **E — DELETE** | `CampaignDetail.tsx` · ± `verify-universals.mjs:1705` · ± `permissionManifest.test.ts:101` · ± tombstone | **(a) yes · (b) no · (c) yes** | 🔴 **R2 + the gating question** | **1 (b) / 3–4 (a)** |
| **F — DERIVED VOCABULARY (F2)** | 9 enumerations + 2 CHECKs + a new cap | 🔴 **YES — David applies** | **which set wins** | **2–3** |
| **G — VALIDATE-BEFORE-GENERATE (F2 stopgap)** | `api/campaigns.ts:74` | **no** | no *(stopgap only)* | **1** |
| **H — TRANSACTION** | (a) catch-compensate `campaigns.ts:135` · (b) jsonb RPC | **(a) no · (b) YES** | no | **0.5 / 2** |

## THE THREE SCOPES

### ▪ MINIMUM — **C + A + H(a). ~2–3 prompts. ZERO migrations. ZERO rulings.**

**Closes "I cannot undo what I created" without touching R2.** The two "arbor day" rows get
cancelled through the app; the list stops calling them published and says *"No posts — generation
didn't finish"*; the next failed generation cleans up after itself.

🔴 **WHAT IT LEAVES BROKEN, PLAINLY:**
- **The rows still exist.** If David's requirement is *gone*, not *stopped pretending*, **this
  does not meet it** — and that is the ruling, not a build gap.
- **No edit.** A typo in a campaign name is still permanent. **This does not answer the literal
  question David asked.**
- **L2 still mints duplicate campaigns silently.**
- **F2 unfixed** — the next generation with tiktok/twitter enabled still produces an orphan;
  H(a) now removes it, so the owner sees a plain failure instead of a mystery row.

**Before it can start:** the STORY. **To apply:** nothing.

### ▪ COHERENT — **MINIMUM + B + D + G. ~5–7 prompts. ZERO migrations.**

**This is the ruled standard: the whole lifecycle through one path.** One `CampaignForm` serving
create and edit; one endpoint with `generate` / `generate-into` / `update` / `cancel` branches;
one authority string (`campaigns:update`) covering all of it; a list that tells the truth about
every row; and generation that refuses a channel it cannot store instead of failing after paying
for the AI call.

**Delete is the ONLY thing absent, and its absence is a RULING rather than a gap** — which is a
materially different answer to give David than *"we didn't build it."*

**Before it can start:** the STORY · **Q4** (edit vs existing posts) · **the L2 decision**
(does "generate more" append, or go away). **To apply:** nothing.

### ▪ COMPLETE — **COHERENT + E + F + H(b). ~11–14 prompts. TWO migrations. THREE rulings.**

Adds hard delete (with whatever R2's reversal requires), the single derived channel vocabulary
with a cap asserting both directions, and the campaign+posts insert as one transactional RPC.

**Before it can start:** the STORY · **Q4** · the L2 decision · 🔴 **R2** · **the delete-gating
question (a)/(b)/(c)** · **which channel set wins**.
**To apply:** the `campaign_posts_platform_check` widening · the campaign-create RPC · (if E(a) or
E(c)) the tombstone or the delete RPC.

⚠️ **THE HONEST WARNING ON COMPLETE:** F alone touches nine enumerations across five files plus
two CHECK constraints, and it is the piece most likely to overrun its estimate — the prior
recon's Q8 option 4 is a `verify-tile-fields`-shaped build, and that cap took a full prompt of
probes on its own. **If the demo horizon matters, COHERENT is the scope that buys the most per
prompt, and every piece it contains is migration-free.**

---

# EVERY RULING DAVID OWES BEFORE ANY OF THIS STARTS

| # | Ruling | Blocks | Recommendation |
|---|---|---|---|
| **1** | 🔴 **R2 — may a campaign be DELETED?** Ruled *"likely never — a deleted campaign destroys its own history"* (spec:91), enforced by `verify-universals.mjs:1712`. **The owner can already do it in SQL via `campaigns_owner FOR ALL`; only the button is missing.** | **E, COMPLETE** | **cancel is sufficient for the operational problem** — but this is his call and cancel is not what he asked for |
| **2** | 🔴 **If delete is permitted, what gates the button?** No string may exist (cap-enforced); `isOwner` was ruled DISPLAY-only 2026-07-30. | **E** | **(b)** — `isOwner` as DISPLAY, `campaigns_owner` as authority. **(c)** the RPC is the durable form. ⚠️ tension flagged, not reasoned past |
| **3** | **Q4 — what happens to existing posts when a campaign is edited?** | **B, COHERENT** | **(b) made honest** — edit freely, posts untouched, **divergence announced** with a Regenerate control |
| **4** | **Q5 — is CANCEL enough, or is a tombstone owed?** | **E** | **different acts by standing ruling.** `campaigns.status` may not carry both (STD-011) |
| **5** | **L2 — does "Generate more posts for this campaign" APPEND to this campaign, or is the button removed?** | **D** | **append** — it is what the label promises, and it is the same branch Q4's Regenerate needs |
| **6** | **F2 — which channel set wins?** 5 (drop `email`, which nothing can produce) or 6 (the union)? | **F, COMPLETE** | not recommended here — **out of this recon's scope** and already filed as tech-debt #91 |
| **7** | **§6/R1 — the draft read-error rule** (already OWED, `RULINGS.md:120`) | **C**, partially | **C fixes the rule's own two founding instances**, which does not presuppose its general form. C is safe to build before the ruling |
| **8** | 🔴 **THE STORY** — `user_stories.md` has **zero** campaign entries. The §9 gate says a story is CREATED before the build spec. | 🔴 **EVERYTHING** | David dictates → Lightning specs → the board |

---

## ⚠️ WHAT THIS SCOPING CANNOT SEE (STD-021 — required section)

1. **No catalog access.** No `psql`, no `postgres`, no `docker` on this machine — the same
   standing limit as the last three recons. 🔴 **Per the ruling this repo earned yesterday
   (`RULINGS.md:121`): every claim here about the DATABASE is a claim about
   `supabase/migrations/*.sql`, and that is a claim about DOCUMENTS.** Specifically **unverified**:
   that `20260529` and `20260727c` are applied as written, and therefore that `campaigns_owner`
   is `FOR ALL` **in the live database**. **The headline finding — that the owner can already
   delete — rests on it.** One query settles it:
   ```sql
   SELECT policyname, cmd, roles::text, qual
     FROM pg_policies WHERE schemaname='public' AND tablename='campaigns' ORDER BY policyname;
   ```
   **`campaigns_owner` with `cmd='ALL'` ⇒ the finding holds. Anything else ⇒ delete needs a
   policy too, and E grows a migration in every variant.**
2. **A function, policy or constraint created outside the migration path is invisible** (§6 r17).
   The schema-snapshot checker is still OWED (tech-debt #92) and still does not exist.
3. **I did not enumerate readers of `campaign_tone_samples` or `business_voice_samples`.** Q4's
   claim that regeneration *"orphans the tone samples"* is reasoned from
   `campaigns.ts:171-177` writing them keyed on `platform` + `original_text` — **I did not verify
   who consumes them or whether an orphan matters to that consumer.**
4. **L2's provenance is undetermined** — whether either "arbor day" orphan came from
   `handleGenerateMore` or from two presses of the create form. **Needs the Vercel function log.**
5. **No `[TRACE:*]` was read at runtime**, and three of this path's four flags are `false` by
   default (`campaigns.ts:5`, `CampaignDetail.tsx:8`, `generate-posts.ts:5-6`) — ⚠️ **carried
   forward from the prior recon, still worth a look against the STD-003 standing instruction.
   Named, not changed.**
6. **The prompt-unit estimates are calibrated on this week's builds, not measured.** They are an
   ordering and a ratio, not a schedule. **F is the one most likely to overrun and the doc says so
   at the point of the claim.**
7. **I did not read every one of the 17 `window.confirm` sites** — five were read for Q9; the
   count is a `grep`.

---

## CLOSING — the four that decide the shape

- **DAVID IS RIGHT, AND TWO THIRDS OF IT IS FREE.** Edit and cancel need **no string, no
  migration, no ruling** — `campaigns:update` is `enforced`, `campaigns_member_update` exists,
  and `'cancelled'` is already a legal value **already painted red** at `Campaigns.tsx:103`.
  **Only delete is blocked, and it is blocked by a ruling, not by an absence.**
- **THE OWNER CAN ALREADY DELETE A CAMPAIGN AT THE DATABASE** — `campaigns_owner FOR ALL`,
  cascade included. The SQL editor is not a workaround for a missing capability; it is a
  workaround for a missing **button**, and the thing in the way is that the model has no string
  to gate it on and the obvious substitute was retired on 2026-07-30.
- **F1 DOES NOT DEPEND ON F2 — PROVEN:** no lifecycle act writes `campaign_posts.platform`.
  **F3 IS THE REAL PREREQUISITE**, and not of F1's code but of F1's *visibility*: a cancel button
  on a list rendering "No campaigns yet" over live rows is a control nobody can reach.
  **ORDER: F3 → F1 → F2.**
- **L2, UNFIXED AND AT THE TOP:** the button reading *"Generate more posts for this campaign"*
  creates a **second campaign** and navigates onto it, with `catch { /* silent */ }` and no
  `else` on `resp.ok`. **A missing lifecycle does not stay missing — it gets impersonated by the
  path that exists.**
