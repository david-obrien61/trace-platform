# ONE CHANNEL VOCABULARY — FULL-SURFACE OWNER TEST

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.** If it is
> not the SHA you mean to test, **stop.** Match it to `git log --oneline origin/main -1`, never to a SHA
> written in this file. *(GATE 0 · OP-15.)*
>
> ⚠️ **AND: THE MIGRATION IS NOT APPLIED.** Cards 1–3 run BEFORE it. Card 4 applies it. Everything
> after card 4 requires it. Tech-debt **#280** — "pushed" is not "shipped" — so also confirm the SHA
> you are looking at is a **production** deploy, not a branch preview.

> **Rendered board:** `owner-tests.html` (a PURE renderer — parses this file live, holds no data).
>
> **STANDING** — run after any change to `supabase/migrations/20260912_channels_one_vocabulary.sql`,
> `channelVocabulary.ts`, `SocialSetup.tsx`, `campaigns/generate.ts` or the `generate` branch of
> `api/campaigns.ts`.

**Purpose:** prove that the channel vocabulary is **one list**, that adding a channel is a row, and
that **email is a real channel the owner sends themselves** — not a promise.

**Why this exists.** A channel name was written in **four** places. Two were updated on 8 June 2026
and two were not. The only UI that can enable a channel offered **tiktok** and **twitter**; the table
that stores the generated post **forbade** them; and the insert is one atomic multi-row statement — so
**every post insert died and `campaign_posts` was empty on every tenant for three months**, behind
three committed zero-post campaigns that each looked fine. The campaign row commits separately; only
the posts fail.

🔴 **THE COPY RULE, BECAUSE IT IS THE EASIEST THING HERE TO GET WRONG (R-150).** Email works the way
every channel works: **TRACE drafts, the owner copies, the owner sends.** No screen may hint that
TRACE will one day send for them, or present direct send as forthcoming. That is the design, not an
unfinished version of one — and it is why email needs no consent model: **the owner is the sender.**
**CARD 8 fails on wording alone, even if everything functional passes.**

---

## HOW TO READ A CARD

| Tag | Means |
|---|---|
| `STATUS: covered` | 🟢 A test exists AND it passed on `LAST-PROVEN`. Only David sets this. |
| `STATUS: owed` | 🟡 Written, not run since the surface changed. **Not proven.** |
| `STATUS: needs-test` | 🔴 Surface exists, no test — a known hole. |
| `RUNS: pre-apply` | Runs BEFORE the migration. Reads only. |
| `RUNS: the-apply` | This card IS the apply step. |
| `RUNS: post-apply` | Needs the migration applied and the code deployed. |
| `DEVICE:` | `phone` · `desktop` · `either`. |

**Thunder never sets `covered` (OP-14).**

---

## 🟢 BEFORE THE MIGRATION — read-only, and CARD 3 is a stop-gate

### CARD 1 — the four copies, seen side by side, as they are today
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
RUNS: pre-apply
COVERS: R-150 · tech-debt #91 · ledger #310
WHY: this is the defect, in one result set. Run it first so the after-state means something.

```sql
SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
 WHERE conrelid IN ('public.campaign_posts'::regclass, 'public.social_drafts'::regclass)
   AND contype = 'c' AND conname LIKE '%platform%'
 ORDER BY 1;
```

**EXPECT two rows that disagree:** `campaign_posts` permits `instagram, facebook, sms, email`;
`social_drafts` permits `instagram, facebook, tiktok, twitter, sms`. **`email` is in one and `tiktok`
/ `twitter` in the other.** That is the whole bug.

### CARD 2 — nothing has ever been written
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
RUNS: pre-apply
COVERS: the blast radius

```sql
SELECT 'campaign_posts' AS t, count(*) FROM campaign_posts
UNION ALL SELECT 'social_drafts', count(*) FROM social_drafts
UNION ALL SELECT 'campaigns', count(*) FROM campaigns;
```

**EXPECT:** `campaign_posts` **0** · `social_drafts` **7** · `campaigns` **3**. Three campaigns and
zero posts is the signature — each campaign row committed and its batch of posts died.

### CARD 3 — 🔴 STOP-GATE: every live value survives the new foreign keys
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
RUNS: pre-apply
COVERS: the migration's safety claim
WHY: the FK validates against existing rows. If any live value is outside the seed, the apply fails
partway. **The migration's own PRE-FLIGHT 0 checks this and refuses — this card is you seeing the same
answer first, so a refusal is never a surprise.**

```sql
WITH seeded(name) AS (
  VALUES ('instagram'),('facebook'),('tiktok'),('twitter'),('sms'),('email')
)
SELECT 'campaign_posts' AS site, platform AS stray_value FROM campaign_posts
 WHERE platform NOT IN (SELECT name FROM seeded)
UNION ALL
SELECT 'social_drafts', platform FROM social_drafts
 WHERE platform NOT IN (SELECT name FROM seeded)
UNION ALL
SELECT 'advert_channels config', n FROM (
  SELECT jsonb_array_elements(config->'advert_channels')->>'name' AS n
    FROM business_modules WHERE module_key='social_media' AND config ? 'advert_channels'
) q WHERE n NOT IN (SELECT name FROM seeded);
```

**PASS: ZERO ROWS.** 🔴 **Any row → STOP and tell Thunder. Do not apply.** The seed needs that value
before the FK can hold, and adding it is a one-line change to the migration — not a repair afterwards.

---

## ⚙️ THE APPLY

### CARD 4 — apply the migration, in the SQL editor
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
RUNS: the-apply
COVERS: ledger #310
🔴 **SQL EDITOR, NEVER THE TABLE EDITOR** (§6 r17 — the table editor creates as `supabase_admin`,
whose default ACL grants `anon` TRUNCATE and REFERENCES, and RLS cannot filter TRUNCATE).
⚠️ **You said there is no PITR. Take your manual snapshot before this card.** The migration is
additive — no column dropped, no row rewritten — and `campaign_posts` is empty, but `social_drafts`
has 7 rows and `advert_channels` is live config on both tenants.
STEPS: paste `supabase/migrations/20260912_channels_one_vocabulary.sql` whole and run it.
**PASS:** it completes, and you see the notice **`PRE-FLIGHT 0 PASSED`**.
🔴 **FAIL:** any `PRE-FLIGHT 0 FAILED` message — it names the offending value and **nothing was
applied**. That is the design; report the value.

### CARD 5 — the structure is what the ruling asked for
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
RUNS: post-apply
COVERS: R-150 ②
STEPS: run verification queries ①–⑤ from the foot of the migration file.
**PASS — all five:** six rows in `channels` · **both CHECKs gone and TWO FKs present** · `subject`
exists and `is_nullable = YES` · RLS on with **exactly one policy, SELECT** · the trigger exists and
its definition says **`BEFORE INSERT OR UPDATE`**.

### CARD 6 — 🔴 the trigger actually REFUSES, and still accepts
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
RUNS: post-apply
COVERS: R-150 ② · §6 r19
WHY: **a check nobody has watched refuse is a claim.** And a trigger that refuses *everything* would
pass the first half and be useless — hence both directions. Run verification ⑥ then ⑦; **both are
wrapped in `BEGIN … ROLLBACK` and change nothing.**
**PASS:** ⑥ raises an error naming **`myspace`**; ⑦ reports **`UPDATE 1`**.
🔴 **FAIL:** ⑥ succeeds — the vocabulary is not enforced and `advert_channels` can still drift.

---

## 📱 THE SURFACES — Test Dave's tenant

### CARD 7 — the channel list comes from the table
STATUS: owed
LAST-PROVEN: never
DEVICE: either
RUNS: post-apply
COVERS: R-150 — the third copy
STEPS: open the social channel setup on Test Dave's.
**PASS:** the social channels are listed, **and a section you-send-these-yourself lists SMS *and*
Email.** Email appearing at all is the proof: it was in the database's vocabulary and in no UI, so
nothing could ever produce it.
🔴 **FAIL:** email is absent — the screen is still reading a hardcoded list.

### CARD 8 — 🔴 THE COPY: what the screen promises about sending
STATUS: owed
LAST-PROVEN: never
DEVICE: either
RUNS: post-apply
COVERS: R-150 ① — **this card fails on WORDING ALONE**
STEPS: read the you-send-these-yourself section for both SMS and Email.
**PASS — all three:** it says TRACE **drafts** and **you send**, in the present tense · it gives email
as **a subject line and a body** · and it says **nothing** about sending being added later.
🔴 **FAIL** if any phrasing implies TRACE will send for you, or offers direct send as forthcoming.
**Fail this card even if every functional card passed** — the honesty of the claim is the feature.

### CARD 9 — generate actually produces posts, for the first time ever
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
RUNS: post-apply
COVERS: the whole pass · tech-debt #91
STEPS: on Test Dave's — **leave tiktok and twitter ON, that is the point** — create a campaign and
press Generate.
**PASS:** posts appear, **including tiktok and twitter posts**. Then:

```sql
SELECT platform, count(*), count(subject) AS with_subject
  FROM campaign_posts GROUP BY 1 ORDER BY 1;
```

**EXPECT:** a row per enabled channel, and **`with_subject` = the count only on `email`, 0 elsewhere**
— a caption has no subject and must read NULL, not empty (A9).
🔴 **FAIL:** the old `campaign_posts_platform_check` error. Nothing landed.

### CARD 10 — email's draft is a subject AND a body
STATUS: owed
LAST-PROVEN: never
DEVICE: either
RUNS: post-apply
COVERS: R-150 ①
STEPS: enable Email, generate, open the campaign, find the email post.
**PASS:** it shows a subject line distinct from the body, both copyable. One message, not three — an
email is a single send like SMS, not a feed cadence.
⚠️ `needs-test` is an honest answer here if the detail page does not yet render `subject` separately —
**say so rather than passing it.** The column and the generator carry it; the display is the open half.

### CARD 11 — adding a channel is a row, not a deploy
STATUS: needs-test
LAST-PROVEN: never
DEVICE: desktop
RUNS: post-apply
COVERS: the ruling's actual claim — *"adding a channel becomes a row"*
WHY: **this is the only card that tests the thing the pass is FOR**, and it needs a throwaway channel
inserted and removed, which is a write. Marked `needs-test` with its reason rather than left looking
covered (OP-14 clause 2). When run: insert a `whatsapp` row, reload the setup screen, confirm it is
offered with no deploy, then delete it. **The delete must succeed only while no post references it —
that is `ON DELETE RESTRICT` doing its job.**

---

## WHAT THIS BOARD DOES NOT COVER

- ⚠️ **The `platform` COLUMN is not renamed.** The table is `channels`; the columns stay `platform`
  this pass, flagged in the migration header. A two-column rename across every reader is its own pass.
- ⚠️ **`api/social/generate-posts.ts`** (the `social_drafts` generator) still carries channel names in
  its **prompt prose**. Soft — it shapes wording, validates nothing — but it will not mention a newly
  added channel until someone edits it.
- ⚠️ **`api/social/enable.ts` validates nothing** beyond "non-empty array". The trigger is what stops
  a bad write; the endpoint does not pre-check and does not explain a rejection nicely yet.
- ⚠️ **Display maps** in `CampaignDetail.tsx` and `Dashboard.tsx` (icon, colour, open-URL) are keyed by
  channel name with fallbacks. A new channel renders without an icon until someone adds one.
