# GENERATORS-COMPARE.md
# RECON ARTIFACT — not a design doc
# Read-only comparison: social/generate.ts vs. campaigns/generate.ts
# Produced: 2026-06-13 · Purpose: decide what `source` actually distinguishes before adding the column

---

## Side-by-side comparison

| Dimension | **Social generator** | **Campaign generator** |
|---|---|---|
| **Core file** | `packages/shared/src/social/generate.ts` | `packages/shared/src/campaigns/generate.ts` |
| **Handler file** | `packages/cultivar-os/api/social/generate-posts.ts` | `packages/cultivar-os/api/campaigns.ts` (action: `generate`) |
| **TRIGGER** | Manual owner button (POST to `/api/social/generate-posts`). No scheduler found in handler. | Owner creates a campaign (POST to `/api/campaigns`, `action: 'generate'`). |
| **TEMPORAL ORIENTATION** | **Retrospective.** Looks back at a rolling window (7 days weekly / 3 days `few_times`) of *actual sales that already happened*. | **Prospective.** Uses a campaign brief with `start_date`/`end_date` — posts are planned *ahead of* the campaign window. |
| **INPUT: business identity** | `businesses.name`, `businesses.business_type` (handler lines 73–79) | `businesses.name`, `businesses.business_type` (campaigns.ts lines 43–48) |
| **INPUT: channel config** | `business_modules.config.advert_channels` — social + SMS (handler lines 33–55) | `business_modules.config.advert_channels` — same shape (campaigns.ts lines 54–61) |
| **INPUT: context data** | `orders` (count, customer names) + `order_items JOIN plants` (plant names sold) — handler lines 83–115. Real transaction data. | `campaign.name`, `campaign_type`, `start_date`, `end_date`, `target_category`, `description` — passed by caller. No transaction data. |
| **INPUT: voice / tone** | **None.** No tone table read. No voice-learning block injected into prompt. | `campaign_tone_samples` table — up to 5 most recent per business (campaigns.ts lines 65–70). Injected as `toneBlock` into user prompt (generate.ts lines 78–84). |
| **OUTPUT SHAPE** | `Record<string, string>` — **one caption per channel**, JSON object `{"instagram": "...", "sms": "..."}`. 800 maxTokens. | `PostDraft[]` — **dated array of 1–3 posts per channel**, JSON array `[{channel, scheduled_date, copy_text, image_prompt}]`. 3000 maxTokens. |
| **IMAGE PROMPT** | Not present. Posts are text only. | `image_prompt` per post — photography direction included in every item (generate.ts line 16). |
| **POST COUNT** | Always 1 per channel. | 1–3 per channel, derived from campaign duration: `Math.min(Math.ceil(campaignDays/7), 3)` (generate.ts lines 34–39). |
| **DB WRITE: tables** | `social_drafts` — one row per channel (handler lines 138–159). | `campaigns` (one row) + `campaign_posts` (N rows, one per generated post) — campaigns.ts lines 88–115. |
| **DB WRITE: key fields** | `subject_type: 'inventory'`, `subject_id: null`, `cadence`, `period_start`, `period_end` | `campaign_id` (FK), `scheduled_date`, `copy_text`, `image_prompt`, `status: 'draft'` |
| **VOICE FEEDBACK LOOP** | **None.** No mechanism to save edits and learn from them. | `copy-post` action (campaigns.ts lines 134–175): if owner edits text before copying, inserts `{original_text, edited_text}` into `campaign_tone_samples` for future generation. |
| **GENERATION CALL** | `executeCapability('social_generate', {system, user, apiKey})` (generate.ts line 89) | `executeCapability('campaign_generate', {system, user, apiKey})` (generate.ts line 122) |
| **CAPABILITY CONFIG** | `social_generate`: Sonnet 4.6, maxTokens 800, responseFormat json (capabilities.ts line 16) | `campaign_generate`: Sonnet 4.6, maxTokens 3000, responseFormat json (capabilities.ts line 15) |
| **MODEL OVERRIDE** | Neither caller passes `businessId` or `supabase` to `executeCapability` — per-business model override lookup is skipped for both. |
| **SYSTEM PROMPT SHAPE** | "You are a social media writer for a `${descriptor}`. Your job is to write ONE post per channel that celebrates the week's business activity." + per-channel character limits and hashtag rules. Requests JSON object keyed by channel. (generate.ts lines 47–63) | "You write content for owner-operated small businesses. Posts are warm, local, specific, and authentic — never corporate, never generic." Shorter; no in-system formatting rules (those live in the user prompt via `CHANNEL_GUIDANCE`). Requests JSON array. (generate.ts line 19) |
| **USER PROMPT SHAPE** | Business name + date window + order count + "What was sold: {plant names}" + customer first names + channel list + no-sales fallback. | Campaign name/type/dates/focus/description + `toneBlock` (voice samples or empty) + channel instructions with counts + total post count. |

---

## The question answered: one core, two callers — or two distinct engines?

**Read: one gateway (`executeCapability`), two distinct wrappers. The wrappers are not interchangeable.**

Evidence for "one gateway":
- Both call `executeCapability` at `packages/shared/src/ai/execute.ts:26`.
- Both use `claude-sonnet-4-6` (capabilities.ts lines 15–16).
- Both pass `{system, user, apiKey}` — same signature.
- The underlying `anthropic.messages.create()` call is identical for both.

Evidence that the wrappers are **distinct, not just different triggers**:

1. **Temporal contract is opposite.** Social assembles what *happened* (transaction data from the DB). Campaign assembles what *is planned* (a creative brief). These are not the same operation called at different times — they answer different questions.

2. **Voice-learning is present in one, absent in the other.** Campaigns accumulates owner edits as tone samples (`campaign_tone_samples`) and feeds them back into future generation. Social has no equivalent. This is a structural difference in the generation loop, not just the prompt.

3. **Output schema is different in kind, not just size.** Social returns a flat map of channel → single caption. Campaign returns a dated array where each item has `scheduled_date` and `image_prompt` — neither field exists in the social path. Parsing logic, DB schema, and the generated JSON shape are all different.

4. **maxTokens gap (800 vs 3000) is load-bearing.** Social must fit one compact caption per channel. Campaign must generate a full multi-post schedule across days. The token budget is sized differently on purpose.

**What `source` would actually distinguish:** If a shared voice-samples table were introduced, `source` would tag *which generation context produced the sample being learned from* — a retrospective weekly recap vs. a prospective campaign brief. These are different editorial contexts: an owner editing a recap post may be correcting warmth/specificity; an owner editing a campaign post may be correcting persuasion or offer clarity. A model learning from mixed samples without `source` would blend two different editorial intents. So `source` is a meaningful signal, not just a routing label.

**What `source` does NOT distinguish:** The underlying Anthropic call itself. Both paths use the same gateway, same model family. `source` is a property of the sample's editorial context, not of the generation mechanism.

---

## Evidence anchors (file:line)

| Claim | Evidence |
|---|---|
| Both call `executeCapability` | social/generate.ts:89 · campaigns/generate.ts:122 |
| Different capability keys | capabilities.ts:15–16 |
| Different maxTokens | capabilities.ts:15 (3000) vs :16 (800) |
| Social reads orders/plants | generate-posts.ts:83–109 |
| Campaign reads tone samples | campaigns.ts:65–70 |
| Tone block injected | campaigns/generate.ts:78–84 |
| Social has no tone read | social/generate.ts — no `toneSamples` param, no toneBlock, no DB read |
| Social writes social_drafts | generate-posts.ts:159 |
| Campaign writes campaigns + campaign_posts | campaigns.ts:88–114 |
| image_prompt: campaigns only | campaigns/generate.ts:16 (`PostDraft.image_prompt`) · social: absent |
| Voice feedback loop | campaigns.ts:134–175 (`copy-post` action → `campaign_tone_samples` insert) |
| Social has no edit→learn path | generate-posts.ts — no `copy-post` equivalent |
