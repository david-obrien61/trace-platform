# CAMPAIGN LIFECYCLE — FULL-SURFACE OWNER TEST

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> One glance. Match it to `git log --oneline origin/main -1` — **not to a SHA written in this
> file**, because Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> *(GATE 0 · OP-15.)*
>
> ⚠️ **AND FOR THIS BOARD SPECIFICALLY: the build lives on `feat/campaign-lifecycle` and is NOT
> merged.** Tech-debt **#280** is exactly this trap — the close-out gates accept "pushed" as
> "shipped" and name neither a branch nor an environment. **Confirm the SHA you are looking at is a
> PRODUCTION deploy of the code you mean**, not a Preview of a branch, before CARDS 4–12.

> **Rendered board:** open `owner-tests.html` (a PURE renderer — it parses this file live and holds
> no data of its own). Sibling of `stories.html` / `status.html`.
>
> **This file is the ONLY source of truth for the campaign LIFECYCLE owner-tests.** It is STANDING —
> run it after any change to `packages/shared/src/business-logic/campaignLifecycle.ts`,
> `packages/cultivar-os/src/pages/Campaigns.tsx`, `packages/cultivar-os/src/pages/CampaignDetail.tsx`
> or the `generate` branch of `api/campaigns.ts`.
> A per-build proof is a FILTER (`COVERS: #NNN`), never a second doc.
>
> 🔴 **IT IS A DIFFERENT BOARD FROM `social-campaign-full-surface-test.md`, DELIBERATELY.** That one
> defends what the generator WRITES (fabricated facts under the owner's name). This one defends what
> the lifecycle DOES — edit, cancel, append, and what a row truthfully says about itself. Two
> capabilities, two boards; the social board's 2 cards are untouched by this build.

**Purpose:** three rulings David made on 2026-09-12, and the claim that hid one of them for weeks.

**Why this exists — the defect is the reason, and it is worth stating in full:**

🔴 **A MISSING LIFECYCLE DOES NOT STAY MISSING. IT GETS IMPERSONATED BY THE PATH THAT EXISTS.** The
button on a campaign's own page read *"✦ Generate more posts for this campaign"* and took the CREATE
branch — minting a **second** campaign and navigating onto it, with no error surface at all. David
produced **two identical "arbor day" rows three hours apart** this way. **Neither appeared in the
list** — because the list rendered a zero-post campaign as *"All posts published ✓"*, a claim that
is true of a finished campaign and false of an empty one. The lie covered the duplicate.

**And edit and cancel were blocked by nothing.** The 2026-08-23 scoping measured it: the RLS policy
existed, the permission string existed and was `enforced`, and `'cancelled'` was already in the CHECK
constraint and already rendered red. **There was no UI. That was the whole gap.**

⚠️ **THE HONESTY CONSTRAINT ON CARD 7, BECAUSE IT IS THE EASIEST THING ON THIS BOARD TO GET WRONG:**
`campaign_posts.status = 'published'` is set by the `copy-post` action, whose own comment reads
*"Mark as reviewed — owner copied it, **NOT auto-published**"*. So "published" means **she copied it
out of TRACE.** It does NOT mean it reached a feed, and it does not mean the text on the feed is the
text we hold. *Truth in advertising* states the limit in its own words (`user_stories.md:1250-1252`):
*"the record captures what LEFT TRACE, not what was published … This is not a record of publication
and must never be labelled as one."* **CARD 7 checks the refusal honours that. If the screen claims
your customers have seen something, it is wrong even if everything else passes.**

---

## HOW TO READ A CARD

| Tag | Means |
|---|---|
| `STATUS: covered` | 🟢 A test exists AND it passed on `LAST-PROVEN`. Only David sets this. |
| `STATUS: owed` | 🟡 Written but not run since the surface changed. **Not proven.** |
| `STATUS: needs-test` | 🔴 Surface exists, no test — a known hole. |
| `LAST-PROVEN: never` | Nobody has ever run this against the real UI. |
| `DEVICE:` | `phone` · `desktop` · `either`. |
| `COVERS:` | The ledger row / ruling / story this check defends. |
| `SIGNAL:` | The `[TRACE:*]` line. **Always secondary** — every PASS must be visible without a console. |

**PASS = every card in scope is `covered` with today's date.** Thunder never sets `covered` (OP-14).

---

## 🟢 DAVID CAN RUN CARDS 1–3 RIGHT NOW — READ-ONLY, BEFORE THE BUILD IS ANYWHERE NEAR PRODUCTION

These three are SQL you paste into the Supabase SQL editor. They write nothing. **CARD 1 is a
stop-gate: if it fails, R-146 becomes a migration and the cancel half of this build must not ship.**

### CARD 1 — the live CHECK constraint actually permits `'cancelled'`
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: R-146 · ledger #306 · the stop-gate
WHY: `20260529_campaigns.sql:15` declares `CHECK (status IN ('draft','active','completed','cancelled'))`
**INLINE**, so Postgres auto-names it and the name is never typed. Tech-debt **#91** is precisely a
campaign-table inline CHECK whose live definition was the open question — and it found two platform
CHECKs that **disagreed with each other**. This build writes `'cancelled'` on the strength of a repo
file. **Confirm the database agrees before trusting it.**

```sql
SELECT conname, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
 WHERE conrelid = 'public.campaigns'::regclass
   AND contype  = 'c';
```

**PASS:** a row whose `definition` contains **`'cancelled'`**.
🔴 **FAIL → STOP AND TELL THUNDER.** R-146 then needs a migration and that is a different
conversation. Do not run CARD 8.

### CARD 2 — the three member policies are LIVE, and they name `campaigns:update`
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: R-145 · R-146 · R-147 · ledger #306
WHY: this build mints **no permission string** — edit, cancel and append all reuse `campaigns:update`,
which the repo says is carried by `campaigns_member_update` and `campaign_posts_member_insert`. But
tech-debt **#241** is a cap that passed by reading `CREATE POLICY` statements an applied migration had
**removed** — a corpus grep is not an applied policy. This is the catalog answering.

```sql
SELECT tablename, policyname, cmd,
       qual       IS NOT NULL AS has_using,
       with_check IS NOT NULL AS has_check
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('campaigns', 'campaign_posts')
 ORDER BY tablename, cmd, policyname;
```

**PASS:** `campaigns_member_update` (UPDATE) and `campaign_posts_member_insert` (INSERT) both present.
⚠️ If either is missing, Lauren's edit/cancel/append will fail under her own session even though the
owner's works — that is CARD 12's failure mode arriving early.

### CARD 3 — the baseline: the real survivor, untouched
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: R-147 · the `arbor day` orphan David is deciding about
WHY: there is exactly ONE campaign row platform-wide and it is a survivor of the R-147 defect — zero
posts, `status='active'`, `end_date 2026-10-30`. **This card records it before the build touches
anything, so CARD 4 can be proven against the real thing rather than a fixture.** Nothing in this
build writes to it.

```sql
SELECT c.name, b.name AS tenant, c.status, c.start_date, c.end_date,
       count(p.id) AS posts
  FROM campaigns c
  JOIN businesses b ON b.id = c.business_id
  LEFT JOIN campaign_posts p ON p.campaign_id = c.id
 GROUP BY 1,2,3,4,5
 ORDER BY c.created_at;
```

**PASS:** `arbor day · Test Dave's Tree Nest · active · 2026-08-24 · 2026-10-30 · 0`.
⚠️ If LAWNS now appears, a campaign was created since 2026-09-12 and CARD 4's expected reading changes.

---

## AFTER THE BUILD IS DEPLOYED — David, **Test Dave's tenant** unless a card says otherwise

### CARD 4 — a campaign with no posts SAYS it has no posts
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: the claim that hid R-147 · `user_stories.md:1151-1152` · §6 r18
STEPS: open `/campaigns` on Test Dave's. Find the `arbor day` row (0 posts, status **active**).
**PASS:** it reads **"No posts yet — open to generate"**.
🔴 **FAIL:** it reads anything containing the word *published*. That is the original lie.
⚠️ **Look, do not click through and generate** — CARD 3's row is the evidence and David is still
deciding what happens to it.

### CARD 5 — 🟢 THE NEGATIVE CONTROL: a genuinely finished campaign still says so
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: the claim fix's negative direction · ledger #306
WHY: **a fix that makes the true claim disappear is not a fix.** CARD 4 on its own would pass if the
row simply stopped saying anything. This card is the other direction and it is **not implied by CARD
4 — it must be run.**
STEPS: on Test Dave's, create a campaign, let it generate, then **Copy** every post on its detail
page until the "To review" tile reads 0. Return to `/campaigns`.
**PASS:** that row reads **"All N posts published ✓"** with N = the real number of posts.
🔴 **FAIL:** it reads "No posts yet", or it reads a count that is not N.

### CARD 6 — edit dates and focus, and it persists
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: R-145
STEPS: on a campaign with **no copied posts**, press **Edit dates & focus**. Change the end date and
the focus. **Save changes.** Then **reload the page.**
**PASS:** the card closes, the header's date range shows the new dates, and **both survive the
reload**. SIGNAL (secondary): `[TRACE:CAMPAIGN] edit saved { fields: [...] }`.
⚠️ Also press **Save changes** having altered nothing: it must say **"Nothing changed."** and not
claim a save. *(A save that reports success having written nothing is R-110's defect.)*

### CARD 7 — 🔴 edit is REFUSED once a post is copied, **in words that do not overclaim**
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: R-145's before-publication limit · `user_stories.md:1250-1252`
STEPS: on a campaign with drafts, **Copy** one post. Return to the campaign.
**PASS — all four, and the wording half matters as much as the lock:**
1. The **Edit dates & focus** button is **gone**.
2. An amber block reads **"The dates and focus are locked"** and states **how many posts you copied**.
3. 🔴 **It does NOT say your customers have seen them, does NOT say "published to", and does NOT call
   them "live".** It says TRACE cannot see where a copied post went or whether you changed it after
   pasting. **If it claims more than that, FAIL the card even though the lock worked.**
4. It names **cancel and start a new one** as the route.
🔴 **FAIL:** the button is simply missing with no explanation — a control that vanishes silently is
the defect this platform has ruled against repeatedly.

### CARD 8 — cancel writes, and the row STAYS on the list
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: R-146 · `user_stories.md:1160-1163` · the scoped-out delete story
🔴 **DO NOT RUN UNTIL CARD 1 HAS PASSED.**
STEPS: open a campaign on Test Dave's → **Cancel campaign** → read the confirm → **Yes, cancel it**.
**PASS — all four:**
1. The confirm says cancelling **shelves** it and that it **stays on your list**. It must not say or
   imply *delete*.
2. After confirming, return to `/campaigns`: **the row is still there**, with a **red CANCELLED** chip.
3. Its posts are still on its detail page.
4. 🔴 **If that campaign had zero posts, its row must read "No posts yet" — NOT a published claim
   under a red cancelled chip.** *(This is why the claim fix had to land before cancel: one card
   saying two things is §6 r18's defect, and cancel is what would have exposed it.)*
SIGNAL (secondary): `[TRACE:CAMPAIGN] cancelled { status: 'cancelled' }`.

### CARD 9 — 🔴 generate-more APPENDS: more posts, same campaign, same URL
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: R-147 · ledger #306 · `user_stories.md:1141-1153`
STEPS: open a campaign that already has posts. **Note the URL and the post count.** Press
**✦ Generate more posts for this campaign** and wait.
**PASS — all four:**
1. The **post count rises**.
2. 🔴 **The URL does not change.** You are still on the same campaign.
3. The campaign **name and dates are unchanged**.
4. Going back to `/campaigns` shows **no new campaign row**.
🔴 **FAIL — and this is the original defect returning:** the URL changes, or a second row with the
same name appears in the list.
SIGNAL (secondary): `[TRACE:CAMPAIGN] generate { mode: 'append' }` — **`mode` must read `append`.**

### CARD 10 — generate-more FAILS OUT LOUD
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: R-147 · *"with no error surface at all"* (`user_stories.md:1149-1150`)
WHY: the old handler's catch block was literally `catch { /* silent */ }`. A failure looked identical
to a success that produced nothing — which is the other half of why the duplicates went unnoticed.
STEPS: easiest honest trigger — turn off wifi, press **Generate more posts for this campaign**, wait.
**PASS:** a **red message appears on the page** saying it could not generate. The button returns to
its normal label.
🔴 **FAIL:** the button spins and returns to normal with no message, or the page navigates anywhere.

### CARD 11 — 🔴 the arithmetic proof: no campaign row was minted
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: R-147 — **this is the card that would have caught the original defect**
WHY: CARD 9 is an observation and observations are how this defect survived three hours. This is the
count, before and after, and it cannot be misread.
STEPS: run the query, then do CARD 9, then run it again.

```sql
SELECT count(*) AS campaigns, count(DISTINCT name) AS distinct_names
  FROM campaigns
 WHERE business_id = (SELECT id FROM businesses WHERE name = 'Test Dave''s Tree Nest');
```

**PASS:** `campaigns` is **identical** before and after. Only the post count moved.
🔴 **FAIL:** it went up by one. The append minted a row and R-147 is not satisfied.

---

## NEEDS SOMEONE ELSE'S LOGIN

### CARD 12 — a MANAGER can edit, cancel and append
STATUS: needs-test
LAST-PROVEN: never
DEVICE: desktop
COVERS: R-145 · R-146 · R-147 under real RLS
WHY: `campaigns:update` is in the aligned MANAGER floor (`20260727b:40`) — **that is a corpus read,
not a session.** Every write in this build goes through the client under the caller's own RLS, so a
manager whose permission array disagrees with the floor would see the button work and the save fail.
**`needs-test` with its reason, per OP-14 clause 2: Thunder cannot run this and says so rather than
leaving it looking covered.**
STEPS: as **Lauren** (MANAGER) on Test Dave's: edit dates, cancel a campaign, append posts.
**PASS:** all three land and survive a reload.
**BLOCKER:** needs Lauren's login. David holds `owner_id`; an owner session proves nothing here.

---

## WHAT THIS BOARD DOES NOT COVER — stated so the gaps are not mistaken for passes

- 🔴 **The ASK field** (`campaign_call_to_action`), the **sales grounding** (*"written off her real
  sales"*) and the **sellability guard** (*"under production is not for sale"*) are **not in this
  build** — David scoped them to a separate pass. The Arbor Day story's three bolded assertions are
  still unmet and its `STATUS` reflects only the edit clause this build answers.
- ⚠️ **The word "published"** in the done claim and on the per-post chip still means **copied**. That
  overclaim is named in `campaignLifecycle.ts` and flagged to David; renaming it is a vocabulary
  change across the detail page and was not one of the three rulings.
- ⚠️ **Channel codes / attribution** (`user_stories.md:1167`) — untouched, nothing exists.
- ⚠️ **Whether `'cancelled'` campaigns should drop out of any read.** Nothing filters on
  `campaigns.status` anywhere today, which is what makes "the row stays on the list" true for free.
  If a future read starts filtering, CARD 8 clause 2 is the card that breaks.
