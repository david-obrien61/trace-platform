# RECON — A CAMPAIGN AT LAWNS FOR TEXAS ARBOR DAY, FRIDAY 6 NOVEMBER 2026

**Date:** 2026-09-12 · **Branch:** `recon/campaigns-2026-09-12`, cut from `origin/main` · **HEAD at recon:** `fe24e68`
**Type:** LOOK-ONLY. No app code, no schema, no migration, no policy, no cap, no test. ONE document, ONE ledger row (**#304**).
**GATE 0:** **NOT APPLICABLE** — no app code ships, so there is no SHA to confirm live.
**Live access:** read-only SQL via the Management API (`scripts/lib/pgQuery.mjs`, `SUPABASE_PAT` present this session — it was absent for #300 and #301, which is why numbers they had to defer are measured here).
**Provenance marks are load-bearing.** `[MEASURED]` was run against the live database or read out of the file named. `[STATED]` is what a document asserts. `[INFERRED]` has not been checked and must not be promoted to fact.

---

## ▶ THE ANSWER, IN THREE LINES — AND THE QUESTION SPLITS IN TWO BEFORE IT CAN BE ANSWERED

**"A campaign is a targeted message to a list"** is the prompt's own definition, and it is **not the
thing this platform built, and not the thing the filed story describes.** Those are two different
products with two different answers, and collapsing them is what makes 6 November look like one
question.

| Which campaign | Can it run 6 Nov? | Why |
|---|---|---|
| **① A SOCIAL CAMPAIGN** — posts Lauren copies and posts herself, carrying one ask | 🟢 **COMFORTABLE. Eight weeks is far more than this needs — it could run this afternoon.** | `/campaigns` is live and reachable, `social_media` is **enabled** on LAWNS `[MEASURED]`, the generator works, the anti-fabrication line ships, and **648 available lots / 6,469 units** are there to promote `[MEASURED]`. Two sharp edges, both small, both named in §4. |
| **② A TARGETED MESSAGE TO A LIST** — segment the 1,973 customers, send them something | 🔴 **NOT TIGHT — UNSTARTED, AND IT CROSSES A STANDING RULING.** | **There is no audience model anywhere in the campaign path** — zero occurrences of `audience`, `recipient`, `segment`, `mailing`, `subscriber` across every campaign file `[MEASURED]`. The one list-sender that exists has **zero callers** and **no API keys**. And a ruled row says *TRACE never initiates an outbound action.* |

> **The recommendation, stated plainly so it is not buried: run ① for 6 November.** It is the
> campaign the story describes, the code supports, and Lauren's forty minutes can actually produce.
> **② is not an eight-week problem; it is a product decision with a ruling in front of it**, and
> nothing about Arbor Day requires deciding it now.

🔴 **AND THE SINGLE MOST IMPORTANT NUMBER IN THIS DOCUMENT, because it decides ② on its own:**
**of the 37 LAWNS customers who have ever bought anything, SEVEN have a usable email address**
`[MEASURED]`. Not 1,720 — seven. The 1,720 emails belong to QuickBooks contact records with no
purchase history in the platform. **Any segment built on "who bought a tree" is a list of 37 people
you can email 7 of.**

---

# ① PRIOR WORK — IT EXISTS, IT IS THOROUGH, AND I DID NOT START OVER

**Two prior documents, both found, both read.** This recon is built on them and corrects them where
the live database disagrees.

| Document | Date | Committed | What it concluded |
|---|---|---|---|
| [`docs/audits/social-campaign-path-recon-2026-08-22.md`](audits/social-campaign-path-recon-2026-08-22.md) (734 lines) | 2026-08-22, corrected same day, re-corrected 2026-08-30 | `c791dee` | The social/campaign platform path. Two of three commissioned premises did not survive. Its own headline finding (a platform-wide write outage) was **WRONG and is kept, not deleted** — the catalog said seven arguments, not six. |
| [`docs/audits/campaign-lifecycle-scoping-2026-08-23.md`](audits/campaign-lifecycle-scoping-2026-08-23.md) (674 lines) | 2026-08-23 | `41df499` | The campaign lifecycle surface. **EDIT and CANCEL are blocked by nothing but a missing UI; DELETE needs David to reverse a ruling.** Three scopes estimated (MINIMUM ~2–3 prompts / COHERENT ~5–7 / COMPLETE ~11–14). |

**Also found, and directly on target:** `docs/owner-tests/social-campaign-full-surface-test.md` (2
cards, **0 covered** — one `owed`, one `needs-test`, both `LAST-PROVEN: never`) `[MEASURED]`, ledger
rows **#191, #191b, #192, #192b, #193, #194, #195, #196, #197, #179**, and **three campaign stories
in `user_stories.md`** including the Arbor Day one quoted in §3.

### WHAT HAS CHANGED SINCE 2026-08-23 — ALMOST NOTHING IN CODE, AND THAT IS THE FINDING

`git log` over every campaign file since that date returns **one commit**, `ec7fc74` *"wip: exclusion
primitive + test-order guard"*, which touched `CampaignDetail.tsx` by **5 lines** and
`api/social/generate-posts.ts` by 8 — test-order exclusion, not campaign work `[MEASURED]`.

**So every conclusion in the 08-23 scoping still holds, and I re-verified the three that matter:**

1. ✅ **The generate-more duplicate defect is STILL LIVE.** `CampaignDetail.tsx:148-169` —
   `handleGenerateMore` POSTs `action: 'generate'` with a fresh campaign payload and then
   `navigate(`/campaigns/${data.campaignId}`)`. The button beneath it reads
   **`✦ Generate more posts for this campaign`** (`:405`). It mints a second campaign and walks you
   onto it `[MEASURED]`.
2. ✅ **Nothing sends.** Re-read at `packages/cultivar-os/api/campaigns.ts:9-20`, both seams still
   declared inert — quoted in full in §2.
3. ✅ **No scheduler.** `vercel.json` still has no `crons` key `[MEASURED]`.

⚠️ **THE 08-23 SCOPING SAID THE TWO ORPHAN CAMPAIGNS WERE "A MESS, NOT A HAZARD." THE MESS IS NOW
ONE ROW, AND IT IS AN ARBOR DAY ROW — see §2.**

---

# ② WHAT EXISTS IN CODE TODAY

## THERE IS A CAMPAIGN FEATURE. IT IS LIVE, IT IS REACHABLE, AND IT GENERATES COPY.

| Piece | Where | State |
|---|---|---|
| **Tables** | `supabase/migrations/20260529_campaigns.sql` | `campaigns` · `campaign_posts` · `campaign_tone_samples`. All three live `[MEASURED]`. |
| **Routes** | `packages/cultivar-os/src/router.tsx:169-172` | `/campaigns` and `/campaigns/:id`, behind `<PermissionRoute permission="campaigns:read" />`. |
| **Tile** | `packages/cultivar-os/src/registry/tileRegistry.ts:174` | key `social_media`, label **Social**, `status: 'live'`, `required_permission: 'campaigns:read'`. **Campaigns has no tile of its own — it rides the Social tile.** |
| **Endpoint** | `api/campaigns.ts` → `packages/cultivar-os/api/campaigns.ts` | One of the 12 slots. Gated by `requireCampaignAuthority` on `campaigns:update`. |
| **Generator** | `packages/shared/src/campaigns/generate.ts` | Claude call, per-channel guidance, tone learning, anti-fabrication system prompt. |
| **Permissions** | `permissionManifest.ts:1391-1392`, `20260727c` | `campaigns:read` + `campaigns:update`, both `enforced`, both held by **OWNER and MANAGER** `[MEASURED]` — so **Lauren can use this today**. `campaigns:create` is deliberately `declared-unwired`. |

**LAWNS state, measured live:** `social_media` is `enabled: true, configured: true`, channels
**instagram ON, sms ON**, facebook/tiktok/twitter off, cadence weekly `[MEASURED]`.

🔴 **AND THERE IS ALREADY AN ARBOR DAY CAMPAIGN ROW. IT IS ON THE WRONG TENANT, IT HAS NO POSTS, AND
ITS WINDOW CLOSES BEFORE ARBOR DAY** `[MEASURED]`:

```
name: "arbor day" · business: Test Dave's Tree Nest (f7ec5d67…) · status: active
start_date: 2026-08-24 · end_date: 2026-10-30 · posts: 0
```

**That is the entire `campaigns` table — one row, platform-wide. `campaign_posts` is EMPTY, zero rows
on every tenant** `[MEASURED]`. Three consequences worth stating separately:

- **`end_date` 2026-10-30 is seven days BEFORE 6 November.** A campaign whose window closes in
  October cannot carry Arbor Day copy — and `generate.ts:104` instructs the model to write posts
  *"spread across the campaign window"*, so it would spread them across the wrong days.
- **It is on Test Dave's, not LAWNS.** Nothing Lauren opens will show it.
- **The Mother's Day seed rows from `20260529_campaigns.sql` are NOT in the live database.** Their
  `business_id` is `a1b2c3d4-0000-0000-0000-000000000001`, and **no such business exists** — the
  three live businesses are LAWNS, Test Dave's Tree Nest, and Test David's new Business `[MEASURED]`.
  So the seeded example campaign nobody could find was never there to find.

## `followup_engine` — #270 IS CONFIRMED EXACTLY AS WRITTEN, AND THE FIX IS SMALLER THAN IT READS

**CONFIRMED.** `tileRegistry.ts:261` declares `followup_engine` with `status: 'planned'`.
`Subscription.tsx:186-196` sorts by `isLiveSurface`, which requires `t.status === 'live'`, so the
module lands in **COMING**, whose only control is an `<a href={interestMailto(m)}>` reading
**`I want this`** (`:627-635`). **There is no Turn on button.** `[MEASURED]`

⚠️ **CORRECTION — THE DATABASE IS FURTHER ALONG THAN #270 IMPLIES. The row exists and is already
configured** `[MEASURED]`:

```
module_key: followup_engine · enabled: FALSE · configured: TRUE
config: { "review_url": "https://g.page/r/CejbBv9WurwKEBE/review" }
```

**So #300's review link is saved and live on LAWNS.** The only thing false is `enabled`. **Turning it
on requires no build:** either one `UPDATE` through `set_business_module_state`, or flipping the tile
from `planned` to `live` so the existing Turn on button appears. **Which one is David's call** — and
it is the call #270 is waiting on, unchanged by this recon.

🔴 **BUT FOR ARBOR DAY, `followup_engine` IS A RED HERRING AND SHOULD BE SET ASIDE.** Campaigns hang
off **`social_media`**, which is **already enabled**. `followup_engine` gates the post-delivery
*review ask* (`reviewLink.ts:25` — `REVIEW_LINK_MODULE_KEY = 'followup_engine'`), a different
feature. **Nothing about a 6 November campaign is blocked by #270.**

## WHAT THE PLATFORM CAN SEND — THE HONEST ANSWER IS "NOTHING, AND THAT IS DELIBERATE"

**There is a real sender and it is fully written.** `packages/shared/src/notifications/send.ts`
contains working Resend (email) and Twilio (SMS) REST clients, a template registry, and per-recipient
TCPA gates. `notifications/campaigns/index.ts` wraps it as `sendCampaign` — *"Sends one template to a
list of recipients with optional throttle"* — **which is exactly the shape ② needs.**

**Four measured facts that together mean it cannot send:**

1. 🔴 **`sendCampaign` HAS ZERO CALLERS.** Grepped across `packages`, `api`, `scripts`: the only hits
   are its own definition, its re-export, and a usage example **inside a comment**
   (`notifications/index.ts:19`) `[MEASURED]`. It is a complete, unwired module — **#157's shape**.
2. 🔴 **NO API KEYS.** `.env.local`, pulled from Vercel on 2026-09-10, contains **no
   `RESEND_API_KEY`, no `TWILIO_ACCOUNT_SID`, no `TWILIO_AUTH_TOKEN`, no `TWILIO_FROM_NUMBER`, no
   `FROM_EMAIL`** `[MEASURED]` — and the canonical `docs/inventory-env.md:88-92` lists all five as
   **Optional**, never provisioned. ⚠️ **Scope of that measurement, stated because it matters:** a
   `vercel env pull` writes the **development** environment. **Production is not proven from the
   repo** — same blind spot as tech-debt #280's clause ②. Treat "production has no keys" as
   `[INFERRED]` until David reads the dashboard.
3. 🔴 **THE CAMPAIGN ENDPOINT NEVER CALLS IT.** `api/campaigns.ts:9-20` declares both seams inert,
   in writing:
   > *"auto-publish seam: **inert.** Campaign posts use handoff model (owner copies + posts
   > manually). When activated: integrate a VETTED publisher adapter (**Blotato was removed — it
   > misrepresented capability**)."*
   > *"sms-auto-send seam: **inert.** SMS posts are draft text the owner copies to send. … opt-out/
   > STOP/consent FOLLOWS the SMS provider's standard TCPA model — ADOPT, do not rebuild. Compliance
   > footer (10DLC/STOP/consent ledger) is real work at activation time, NOT now."*
4. ⚠️ **AND WHEN IT RUNS WITH NO KEYS IT REPORTS SUCCESS.** `send.ts:132` —
   `const isDemo = config.demoMode || (!resendKey && !twilioSid)` — and `:160-166` returns
   `{ success: true, channel, demo: true }` having sent nothing. **The `demo: true` flag is the only
   thing distinguishing a delivered message from a logged one**, and `sendCampaign` does not read it:
   it counts a demo result as `sent++` (`campaigns/index.ts:38-40`) `[MEASURED]`. **A campaign run
   today with no keys would report "1,720 sent" and deliver zero.** That is a D-9 surface-honesty
   defect sitting directly under ②'s only send path, and it is not in the tech-debt log.

**So: the platform can COMPOSE, and it cannot SEND. The two existing outbound integrations** —
QuickBooks invoices and the order-confirmation SMS leakage alert to the business — **are the only
things that leave the building, and neither is a campaign.**

---

# ③ THE AUDIENCE QUESTION — THE ONE THAT MATTERS

## 🔴 FIRST, THE STRUCTURAL ANSWER: THERE IS NOTHING TO SEGMENT *WITH*

**`campaigns` has no audience column. `campaign_posts` has no recipient.** The live columns are
`id, business_id, name, campaign_type, start_date, end_date, target_category, description, status,
created_at` `[MEASURED]` — a content brief, not a distribution list.

**A whole-path grep for `audience|recipient|segment|mailing|list_id|subscriber` across
`packages/shared/src/campaigns/`, `api/campaigns.ts`, `Campaigns.tsx` and `CampaignDetail.tsx`
returns ZERO HITS** `[MEASURED]`. The create form collects six fields — name, type, product focus,
start date, end date, description (`Campaigns.tsx:39-40`) — and **not one of them is about who.**

**And the generator is not given the data either.** `generateCampaignPosts` takes
`businessName, businessType, advertChannels, campaign{…}, toneSamples` (`generate.ts:51-65`) —
**no customer data, no sales data, no inventory** `[MEASURED]`. ⚠️ **Which means the Arbor Day story's
own words *"written off her real sales"* describe something NOT BUILT**, and so does its constraint
*"A campaign never features stock that cannot leave"* — the generator cannot know what is sellable
because it is never told. Flagged for David in §5; it is the gap most likely to be assumed done.

## SECOND, THE DATA — LAWNS, MEASURED LIVE, 2026-09-12

**1,973 customers** `[MEASURED]`, and the three numbers that size everything:

| Channel | Count | Share |
|---|---|---|
| **Usable email** (contains `@` and a dot) | **1,720** | 87% |
| **Usable phone** (10 or 11 digits after stripping punctuation) | **1,490** | 76% |
| **Genuinely routable postal address** | **678** | **34%** |
| Both email and phone | 1,368 | 69% |
| At least one of email or phone | 1,842 | 93% |
| **Neither — unreachable by any channel** | **131** | 7% |

### 🔴 THE ADDRESS NUMBER NEEDS ITS OWN PARAGRAPH, BECAUSE MY FIRST MEASUREMENT OF IT WAS WRONG

My first pass counted **1,117** usable addresses by requiring `address_line1` + `city` + `zip` to be
non-empty. **That number is wrong and I am correcting it rather than reporting it**, because 468 of
those rows have a **phone number sitting in the street-address field**. They pass a non-empty test
and cannot receive mail.

| Bucket | Count |
|---|---|
| `address_line1` blank | 517 |
| **`address_line1` is a phone number** (matches `^[0-9()+\-. ]+$`) | **468** |
| **Street + city + zip — actually mailable** | **678** |
| Street but no city or no zip | 309 |
| *(one row matches none of the four — a value neither blank, purely numeric, nor containing a letter)* | 1 |

Five samples, verbatim `[MEASURED]` — note `address_line1` and `phone` are **the same string**:

```
address_line1      | city       | zip   | phone
(253) 951-6519     | Georgetown | 78628 | (253) 951-6519
(512) 743-4523     | Austin     | 78731 | (512) 743-4523
817-690-6792       | Bertram    | 78605 | (817) 690-6792
(510) 681-6609     | Leander    | 78641 | (510) 681-6609
(512) 461-9920     | Austin     | 78731 | (512) 461-9920
```

✏️ **THE PROMPT'S PREMISE IS CORRECTED, AND THE DIRECTION IS THE OPPOSITE OF WHAT IT SAYS.** The
prompt states *"451 routable addresses sit in the record as phone numbers."* **It is 468, and nothing
routable is sitting anywhere — a phone number is sitting where the street address should be.** The
street address was never captured. **`billing_line2` is populated on 0 of 1,973 rows** `[MEASURED]`,
which confirms tech-debt #254's mechanism exactly: `BillAddr.Line2` is never read. **But reading
Line2 will not recover these 468** — there is no evidence the street line was ever imported for them.
**Fixing #254 and recovering these addresses are two different jobs**, and only the first is in the
tech-debt log.

### WHO BOUGHT A TREE, AND WHEN — 38 CUSTOMERS, NOT 1,973

| | |
|---|---|
| Orders on LAWNS | **40** (38 `order_kind='history'`, 2 `test`) `[MEASURED]` |
| Distinct customers who have ordered | **38** |
| Earliest | 2025-07-17 · Latest 2026-09-10 |
| By month | **2026-09: 9 · 2026-08: 26 · 2026-07: 4 · 2025-07: 1** |

**35 of the 40 orders were written in the last six weeks.** This is not LAWNS's sales history — it is
the platform's adoption curve. The real history is in QuickBooks (19 of the 38 carry a
`qb_doc_number`); **1,936 of the 1,973 customers arrived via the `quickbooks-customers` contact
import and brought no orders with them** `[MEASURED]`.

**And the buyer list's contactability is the number that decides ②** `[MEASURED]`:

| Of the 37 buyers with a customer row | Count |
|---|---|
| **With a usable email** | **7** |
| With a usable phone | 31 |

### INSIDE THE 6-MONTH WARRANTY WINDOW — **NOT COMPUTABLE. ZERO ROWS, AND NO COLUMN TO FIX.**

- **`orders.install_date` is NULL on all 40 orders** `[MEASURED]` — confirming tech-debt #267, which
  measured 0 of 76 and found no writer and no reader in any commit.
- **`warranty_months` exists on exactly two tables — `cultivar_plants` and `cost_objects`**
  `[MEASURED]`. Both are catalogue/asset defaults. **No per-purchase, per-customer warranty record
  exists anywhere in the schema.**
- Tech-debt #269 records that `cultivar_plants.warranty_months` defaults to **12** while LAWNS warrant
  **six**, so even the catalogue default is the wrong number.
- R-143 (the done-tap warranty ruling) is **filed on its words and not built** — #299's finding.

> **This segment cannot be built for 6 November and should not be attempted.** It needs a warranty
> start date the platform has never recorded. It is a schema question behind a ruling, not a query.

### WHICH DELIVERY RING — NO RING EXISTS; ZIP IS THE ONLY GEOGRAPHY

**There is no ring, zone, or radius field.** Tech-debt #266 already records that
`business_inventory.zone` does not exist, and #299 found three empty free-text place columns and no
zone table. `deliveries` carries `address_line1, city, state, zip` and nothing else spatial
`[MEASURED]`.

**39 stops, 37 customers, 38 linked to an order — and `completed` is 0** `[MEASURED]`, which is why
#301's fulfilment work matters. **Stop cities are dirty**: `Leander` (5), `LEANDER` (2), `leander`
(2), and a `Georgeown` typo — **four spellings across two towns, so any city-based segment must
normalise first.**

**Zip IS a usable proxy, for the 678 routable rows only** `[MEASURED]`:

| zip | city | customers |
|---|---|---|
| 78641 | Leander | **156** |
| 78642 | Liberty Hill | 90 |
| 78628 | Georgetown | 63 |
| 78633 | Georgetown | 48 |
| 78613 | Cedar Park | 31 |
| 78681 | Round Rock | 24 |
| 78626 | Georgetown | 18 |
| 78717 | Austin | 14 |
| 78645 | Lago Vista | 13 |

**A 15-mile ring around Leander is roughly 78641 + 78642 + 78613 = ~277 customers, of which a
mailable subset is the 678's share.** That is a real, defensible segment — **and it is the only one of
the four the prompt asks for that the data can actually produce today.**

### 🔴 AND THE FINDING NOBODY ASKED FOR, WHICH WOULD HAVE BITTEN HARDEST: THE OPT-IN IS A DEFAULT, NOT A CONSENT

```
marketing_opt_in:  TRUE on 1,973 · FALSE on 0 · NULL on 0
column_default:    true        is_nullable: NO
```
`[MEASURED]`

**Every single LAWNS customer reads "opted in", and not one of them opted in.** The column's default
is `true` and it is `NOT NULL`, so 1,936 QuickBooks contact imports were stamped consenting on
arrival. **Nobody was asked.**

**Why this is not a philosophical point.** `send.ts:33-41` gates promotional email on exactly this
field:

> `if (type === 'promotional' && !emailOptIn) return { allowed: false, reason: 'email_not_opted_in' };`

**So the TCPA gate — the one real compliance control in the sending path — would pass all 1,973
people on a value nobody gave.** The check cannot disagree with itself: it is **§6 r19's shape
exactly** (*"a check that cannot disagree is not a check"*), arriving in data rather than in a test
double. **A promotional SMS blast on this basis is a 10DLC/TCPA exposure, not a product risk**, and
the `sendCampaign` wrapper would report every one of them as `sent`.

> **This is the one ③ finding I would act on regardless of what happens with Arbor Day**, because it
> is latent under any future send and invisible until the first complaint.

---

# ④ WHAT WOULD BLOCK A 6 NOVEMBER SEND — ORDERED BY WHAT HAS TO HAPPEN FIRST

## FOR ② (a targeted message to a list) — FIVE BLOCKERS, AND THE FIRST IS NOT TECHNICAL

| # | Blocker | Who clears it | Size |
|---|---|---|---|
| **1** | 🔴 **A STANDING RULING SAYS NO.** `RULINGS.md`: ***"TRACE NEVER INITIATES AN OUTBOUND ACTION"*** — ✅ ruled 2026-08-23, *"platform-wide and wider than purchase orders"*, with the story's words *"TRACE prepares; Lauren sends. Nothing leaves the building on its own."* **Per §10 item 10 a build that contradicts an IMPLEMENTED ruling STOPS and surfaces. This is that stop.** | **David only.** A ruling reversal, not a build. | — |
| **2** | 🔴 **CONSENT.** `marketing_opt_in` is a default on all 1,973 rows. A real opt-in basis must exist before a promotional send, and the TCPA gate currently validates against the default. | David rules; then a build | schema + capture surface |
| **3** | 🔴 **NO AUDIENCE MODEL.** Nothing in the campaign path expresses who a campaign is for. | build | the real work — new columns or table, a segment builder, a preview |
| **4** | 🔴 **NOTHING IS WIRED TO SEND.** `sendCampaign` has zero callers; no keys in development; and `demo: true` is counted as `sent`. | build + provisioning | adapter + the honesty fix |
| **5** | ⚠️ **10DLC / STOP / consent ledger** — the endpoint's own seam comment calls this *"real work at activation time"* for SMS. | build | not small |

**Ordered honestly: items 1 and 2 are decisions, and items 3–5 cannot start until they are made.**
Eight weeks is not the constraint; the ruling is.

## FOR ① (the social campaign) — THREE THINGS, ALL SMALL, NONE BLOCKING

| # | Item | Why it matters for 6 Nov | Fix |
|---|---|---|---|
| **1** | 🔴 **The existing `arbor day` row is on Test Dave's and ends 2026-10-30.** | Copy would be spread across the wrong window, on a tenant Lauren never opens. | **Create a fresh campaign on LAWNS** with a window that contains 6 November. No code. |
| **2** | 🔴 **`✦ Generate more posts for this campaign` mints a duplicate campaign.** Still live at `CampaignDetail.tsx:148-169`. | Lauren will press it — the story says she wants more posts mid-campaign. She will silently get a second campaign. | A known defect with a filed story and an owed ruling. **Workaround for 6 Nov: don't press it.** |
| **3** | ⚠️ **There is no field for the ASK.** The story's PIECES name `campaign_call_to_action`; **no such column exists** `[MEASURED]`, and the story is emphatic: *"A campaign is not a run of posts. It is an ASK, and the posts carry it. … Without the ask it is decoration."* | The central element of the story has no home. | **Workaround that works today: put the ask in `description`**, which is interpolated into the prompt as `Context:` (`generate.ts:113`). Not a build. |

## THE STORY GATE (§10 item 8) — **MATCH, AND IT IS `needs-input`**

`user_stories.md:1100` — **`### Arbor Day — plan the season once, change it when Terry changes his
mind`**. `STATUS: needs-input` · `SCOPE: platform, vertical:cultivar, vertical:kinna` ·
`MAPS-TO: —` · `PIECES: campaign_create, campaign_call_to_action, campaign_edit, campaign_cancel,
campaign_generate_more, campaign_list_honest_read`.

**The story names this exact date**, at `:1108-1111`:

> *"**Texas Arbor Day is the first Friday in November** (Nov 6 in 2026), and it exists on that date
> precisely because a tree planted in April has no chance against a Texas summer. For a nursery it is
> not a symbolic holiday. **It is the opening of the selling season.**"*

**And it describes ①, not ②** (`:1113-1116`):

> *"TRACE drafts posts for the channels she's enabled, written off her real sales, and **she edits
> them to sound like her before she copies and posts.**"*

🔴 **Its `NEEDS:` is unmet and it is David's, not Thunder's:**

> *"David to rule EDIT is limited to dates and focus BEFORE publication, and that a published
> campaign which lands badly is ANSWERED AND RESTARTED rather than silently rewritten (Regina's
> bad-press scenario). **Lauren to confirm the scene and the ask Wednesday.**"*

**So the gate's verdict: a BUILD of the campaign lifecycle is blocked on David's edit ruling.
RUNNING a campaign on the surface as it stands is not** — that needs no story change and no build.

---

# THE THREE LENSES (§9 gate 10)

**HAVE** — `/campaigns` live and permissioned for OWNER and MANAGER (`router.tsx:169`); a working
generator with anti-fabrication (`generate.ts:29`); `social_media` enabled on LAWNS with instagram +
sms; 648 available lots / 6,469 units / 603 priced; 1,973 contacts; a complete unwired list-sender
(`notifications/campaigns/index.ts`); a filed story naming 6 November; **one campaign row, on the
wrong tenant, with no posts**.

**NEED** — *irreducible minimum to run a campaign on 6 November, no preference:* **create a campaign
on LAWNS with a window containing 6 Nov, put the ask in `description`, generate, edit, copy, post.**
**Zero code. Zero migrations. Zero rulings.** Every piece is built and reachable today.

**WANT** — the story's end state: an `ask` field of its own; edit and cancel from the UI; a
generate-more that appends; inventory-aware copy that never promotes what cannot leave; a campaign
list that honestly shows a zero-post campaign; and — **if and only if David reverses the outbound
ruling** — a consent-based audience model with a real sender.

**OPTIONS, cheapest-meets-need → fullest-meets-want:**

| | Scope | Cost | Gets you |
|---|---|---|---|
| **A** | **Run it on what exists.** Create the LAWNS campaign, ask in `description`, avoid the generate-more button. | **0 prompts.** David/Lauren, ~40 minutes. | Arbor Day on 6 Nov, exactly as the story's scene describes. |
| **B** | A + the three small fixes: an `ask` field, generate-more appends, honest zero-post read. | ~2–3 prompts, 1 migration | The story's ① without workarounds. **Needs David's edit ruling for the edit half only.** |
| **C** | B + edit/cancel UI (the 08-23 scoping's COHERENT) | ~5–7 prompts | The lifecycle David asked for on 2026-08-23. |
| **D** | C + audience model + consent + sender | **Not an eight-week item.** 2 rulings, ≥2 migrations, a provider, 10DLC | ②. **Blocked at item 1 above.** |

> **I recommend A for 6 November, and B started in parallel if David wants the sharp edges gone
> before Lauren touches it.** A is comfortable with seven weeks of slack; D is not a November
> conversation.

---

# ⚠️ WHAT THIS RECON CANNOT SEE (STD-021 — required section)

1. 🔴 **PRODUCTION env vars.** `.env.local` is a **development** pull (2026-09-10). That five sending
   keys are absent in production is `[INFERRED]`, not measured — **nothing we own reads Vercel**
   (tech-debt #280 clause ②). **David must read the dashboard to confirm.**
2. 🔴 **Whether the 468 phone-in-street rows have a recoverable street address in QuickBooks.** I
   measured our copy, not theirs. Whether #254's fix recovers them is unknown and I did not assume it.
3. ⚠️ **Whether Lauren has confirmed the scene and the ask.** The story says *"Wednesday"*; no record
   exists in the repo either way.
4. ⚠️ **The live RLS path.** Every number here was read via the Management API, which bypasses RLS.
   **Whether Lauren's MANAGER session sees these rows is not proven** — `campaigns:read` is in her
   floor `[MEASURED]`, but a service-key read is not an owner-proof (the Cost-to-Produce lesson).
5. ⚠️ **No `npm run verify` run.** Nothing compiled or changed; no gate applies. Stated so its
   absence is not read as a pass.
6. ⚠️ **The generator's real output.** No Claude call was made. That `generate.ts` produces good Arbor
   Day copy is `[INFERRED]` from its prompt, and **`campaign_posts` is empty, so nothing has ever been
   generated and kept on any tenant.** CARD 1 of the social-campaign board is the proof, and it has
   never been run.

---

# 📋 CARDS — SPLIT BY WHO CAN RUN THEM

## DAVID CAN RUN THESE NOW

**CARD A — confirm the sending keys (the one thing only the dashboard knows).**
Vercel → cultivar-os → Settings → Environment Variables, **Production**. Look for
`RESEND_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `FROM_EMAIL`.
**Expected: none present.** If any IS present, item 4 of ②'s blockers changes and tell me.

**CARD B — see the audience yourself, read-only. Supabase SQL editor, paste whole:**

```sql
SELECT count(*) AS customers,
       count(*) FILTER (WHERE coalesce(email,'') LIKE '%@%.%')                               AS usable_email,
       count(*) FILTER (WHERE length(regexp_replace(coalesce(phone,''),'\D','','g')) IN (10,11)) AS usable_phone,
       count(*) FILTER (WHERE address_line1 ~ '[A-Za-z]'
                          AND coalesce(city,'') <> '' AND coalesce(zip,'') <> '')            AS mailable,
       count(*) FILTER (WHERE address_line1 ~ '^[0-9()+\-. ]+$'
                          AND coalesce(address_line1,'') <> '')                              AS phone_in_street_field,
       count(*) FILTER (WHERE marketing_opt_in IS TRUE)                                      AS reads_opted_in,
       count(*) FILTER (WHERE marketing_opt_in IS FALSE)                                     AS actually_declined
  FROM customers
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
```

**Expect: 1973 · 1720 · 1490 · 678 · 468 · 1973 · 0.** The last two columns are the consent finding:
**1,973 read as opted in and 0 ever declined, because the column's default is `true`.**

**CARD C — the buyer list, and why ② is small. Read-only:**

```sql
SELECT count(DISTINCT o.customer_id) AS buyers,
       count(DISTINCT o.customer_id) FILTER (WHERE coalesce(c.email,'') LIKE '%@%.%') AS buyers_with_email,
       count(DISTINCT o.customer_id) FILTER (WHERE length(regexp_replace(coalesce(c.phone,''),'\D','','g')) IN (10,11)) AS buyers_with_phone
  FROM orders o JOIN customers c ON c.id = o.customer_id
 WHERE o.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND o.order_kind = 'history';
```

**Expect: 37 · 7 · 31.**

**CARD D — the stray Arbor Day row. Read-only:**

```sql
SELECT c.name, b.name AS tenant, c.status, c.start_date, c.end_date, count(p.id) AS posts
  FROM campaigns c
  JOIN businesses b ON b.id = c.business_id
  LEFT JOIN campaign_posts p ON p.campaign_id = c.id
 GROUP BY 1,2,3,4,5;
```

**Expect ONE row: `arbor day` · Test Dave's Tree Nest · active · 2026-08-24 → 2026-10-30 · 0 posts.**
**If LAWNS appears here, a campaign was created since this recon and the §2 finding is stale.**

**CARD E — run the campaign (this is option A, and it is the deliverable).** On LAWNS, as owner:
`/campaigns` → **New campaign** → name *Arbor Day 2026* → type **seasonal** → **start 2026-10-26,
end 2026-11-08** (the window must contain 6 Nov) → product focus: the shade varieties actually
sellable → **description carries THE ASK** (the west wall cooking the house, the fast-growing shade
trees in sellable sizes, the percentage off until Arbor Day). Generate → read every post → edit →
copy → post. 🔴 **Do NOT press `✦ Generate more posts for this campaign` — it creates a second
campaign (§4 item 2).**

## NEEDS A DESK VISIT / SOMEONE ELSE'S LOGIN

**CARD F — does Lauren actually see it?** `campaigns:read` is in the MANAGER floor, but that is
a corpus read, not a session. **Needs Lauren's login**: can she open `/campaigns`, create one, and
generate? Until then the claim *"Lauren can use this today"* is `[MEASURED]` about the permission and
`[INFERRED]` about the screen.

## DECISIONS — NOT RUNNABLE, OWED TO DAVID

See §5 below. None of them block CARD E.

---

# 🔴 FLAGGED FOR DAVID — THE DECISIONS THIS RECON SURFACED AND DID NOT TAKE

1. 🔴 **Does a campaign mean ① or ②?** Everything else follows. The story says ①; the prompt's
   definition says ②. **Nothing is built for ② and a ruling stands against it.**
2. 🔴 **`marketing_opt_in` is a default on 1,973 rows and the TCPA gate validates against it.** Even
   if ② never ships: **should this column be reset to NULL/false and consent captured honestly?**
   A column that says "yes" for everyone is worse than no column. **This is my strongest
   recommendation in the document.**
3. 🔴 **Does the outbound ruling get reversed for marketing?** *"TRACE never initiates an outbound
   action"* was ruled about purchase orders and stated platform-wide. **A campaign send is squarely
   inside it.**
4. ⚠️ **`sendCampaign` counts a demo result as `sent`.** A real D-9 defect under ②'s only send path,
   **not in the tech-debt log.** Want it filed as a numbered row? I did not claim an id.
5. ⚠️ **The Arbor Day story asserts two things the generator cannot do** — *"written off her real
   sales"* and *"never features stock that cannot leave."* **Neither is built** (the generator gets no
   sales and no inventory). Correct the story, or build it?
6. ⚠️ **Follow-Up: one `UPDATE` or a tile flip?** #270's open question, unchanged — **and it does not
   block Arbor Day.**
7. ⚠️ **The stray `arbor day` row on Test Dave's** — leave, retitle, or cancel? Cancel is the ruled
   answer for an unwanted campaign (R2), and **nothing writes `cancelled` today**.

---

# CLOSING — THE FOUR FACTS THAT DECIDE THIS

1. **For a social campaign, 6 November is comfortable — seven weeks of slack, and it needs no code.**
2. **For a targeted send, 6 November is not tight, it is unstarted, and a standing ruling is in front
   of it.**
3. **The audience exists but the segments mostly do not:** 1,720 emails and 678 mailable addresses
   are real; **"bought a tree" is 37 people, 7 of them emailable**; the warranty window is not
   computable; a delivery ring exists only as zip codes.
4. **Nobody at LAWNS has ever consented to marketing, and the database says all 1,973 of them did.**

*Recon only. No app code, no schema, no migration, no cap. Nothing was applied and nothing was sent.*
