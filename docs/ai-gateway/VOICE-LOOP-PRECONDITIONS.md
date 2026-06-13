# RECON ARTIFACT — not a design doc
# Voice-Learning Loop: Phase 2 Preconditions
# Date: 2026-06-13
# Session: THUNDER VERIFY-DON'T-ASSUME (read-only recon)
# Purpose: session-continuity insurance before the design session

---

## What this answers

Phase 2 of the social voice-learning loop feeds the owner's in-app edits back through
the model so generated posts drift toward the customer's real voice. These six sweeps
confirm (or deny) each precondition that phase 2 depends on — before designing anything.

---

## SWEEP 1 — VOICE EDIT-CAPTURE (v1 state) · FOUND

**v1 capture is complete for social_drafts.**

### a. Is the generated post rendered in an EDITABLE field?

**YES.** `packages/cultivar-os/src/pages/Dashboard.tsx:830`

```tsx
<textarea
  value={displayText}
  onChange={e => setDraftEdits(prev => ({ ...prev, [draft.id]: e.target.value }))}
  onBlur={e => handleSaveEdit(draft.id, e.target.value)}
  rows={5}
/>
```

The textarea renders `draftEdits[draft.id] ?? draft.edited_text ?? draft.original_text ?? ''`
(local edit state → stored edited version → original generated text). Not locked, not
copy-only. Prompt text above it: "Here's our best shot at your voice — edit it to sound like you."
(`Dashboard.tsx:828`)

### b. Are BOTH versions STORED?

**YES.** Two separate columns:

| Column | Source | Behavior |
|---|---|---|
| `original_text` | `generate-posts.ts:141` | Written at creation; immutable. Never overwritten. |
| `edited_text` | `Dashboard.tsx:216–217` | Saved on textarea `onBlur` via `handleSaveEdit()`. `UPDATE social_drafts SET edited_text = text, status = 'edited'` |

Migration `supabase/migrations/20260604_social_drafts_voice_learning.sql` (lines 3–4)
documents the intent explicitly:
> `original_text`: immutable Claude output — never overwritten after creation
> `edited_text`: what the owner saves — the voice-learning signal (v1: capture only)

### c. Gating gap assessment

**No gating gap — v1 capture works.** The signal exists. One practical note: `edited_text`
is NULL for rows the owner copies without editing. Phase 2 must filter to rows where
`original_text IS NOT NULL AND edited_text IS NOT NULL AND edited_text != original_text`
to exclude passthroughs from the learning corpus.

---

## SWEEP 2 — BRAND-VOICE CONFIG · PARTIAL

**Campaigns has a working loop. Social does not. No persistent structured voice profile exists.**

### Campaigns flow (FOUND)

`campaign_tone_samples` table (`supabase/migrations/20260529_campaigns.sql:43–53`):
```sql
CREATE TABLE campaign_tone_samples (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  platform      text NOT NULL,
  original_text text NOT NULL,
  edited_text   text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

This table IS populated when an owner edits a campaign post:
`packages/cultivar-os/api/campaigns.ts:150–160` (action: `copy-post`, `wasEdited` branch)
→ INSERTs `{business_id, platform, original_text, edited_text}`.

And the samples ARE fed back into future generations:
`packages/shared/src/campaigns/generate.ts:78–84` — `toneBlock`:
```typescript
const toneBlock = params.toneSamples.length > 0
  ? `Learn from this business's editing style — original AI draft vs. what they actually posted:\n${
      params.toneSamples.slice(0, 3).map((s, i) =>
        `Example ${i+1} (${s.platform}):\nAI wrote: "${s.original_text}"\nThey changed it to: "${s.edited_text}"`
      ).join('\n\n')
    }\n\nMatch this tone and style in every post you write.`
  : '';
```

**The campaigns loop is closed: edit → sample stored → injected into next generation.**

### Social generate flow (NOT FOUND for configured voice)

`packages/shared/src/social/generate.ts` system prompt is entirely hardcoded:
```typescript
const systemPrompt = `You are a social media writer for a ${descriptor}. Your job is to write ONE post per channel...`
```

No per-business tone data is injected. No equivalent of `toneBlock` exists.
`social_drafts.original_text`/`edited_text` pairs ARE being captured (Sweep 1 — FOUND)
but are **not yet fed back** into future `generateSocialDrafts()` calls.

### No structured brand_voice config anywhere (NOT FOUND)

No `brand_voice` column in `businesses`. No `voice_profile` table. No structured
vocabulary, signature close, or example-post config. The closest analog is
`campaign_tone_samples` — but it's few-shot edit pairs, not a structured profile.

### Phase 2 target

The raw signal (`social_drafts` `original_text`/`edited_text` pairs) IS captured.
The loop is **not yet closed** for social. Closing it means:
- Reading recent edit pairs from `social_drafts` for the business (analogous to `campaign_tone_samples` query)
- Injecting them as few-shot examples in `generateSocialDrafts()` (analogous to `toneBlock`)
- Decision: use `social_drafts` directly, or build a `social_tone_samples` table mirroring
  `campaign_tone_samples` (cleaner separation; `edited_text NOT NULL` constraint enforces
  only true edits make it in)

---

## SWEEP 3 — AI GATEWAY · PARTIAL

**The gateway is substantially built. All 5 capability call sites originally targeted by the
spec now route through `executeCapability`. Two newer endpoints (OCR, PMI suggest) do not.**

### Built (deployed, in shared module)

`packages/shared/src/ai/execute.ts` + `packages/shared/src/ai/capabilities.ts`

`execute.ts` is the actual gateway:
1. Looks up config from `CAPABILITIES[capabilityKey]` — throws on unknown key
2. Per-business model override: queries `business_modules.config.model` for the capability key
   (falls through cleanly to `cfg.model` on any miss)
3. Constructs Anthropic client with caller-supplied `apiKey` (server-side only)
4. Applies `cache_control: ephemeral` on system block when `cfg.cache === 'ephemeral'`
5. Logs request/response/error to console when `AI_DEBUG=true` (not to a table — see Sweep 5)

`CAPABILITIES` config (5 entries):
```
discovery_identity:  haiku-4-5-20251001  cache:none
discovery_analysis:  sonnet-4-6          cache:none
discovery_synthesis: sonnet-4-6          cache:none
campaign_generate:   sonnet-4-6          cache:none
social_generate:     sonnet-4-6          cache:none
```

All 5 capabilities routed through gateway — confirmed by grep:
- `shared/src/discovery/engine.ts:48,132` → `executeCapability('discovery_identity')`, `executeCapability('discovery_analysis')`
- `shared/src/discovery/synthesis.ts:73` → `executeCapability('discovery_synthesis')`
- `shared/src/campaigns/generate.ts:122` → `executeCapability('campaign_generate')`
- `shared/src/social/generate.ts:89` → `executeCapability('social_generate')`

### NOT routed through executeCapability

`packages/cultivar-os/api/receipts/ocr.ts` — uses its own `getOcrModels()` function with
a 3-layer config resolution: `platform_config` table → env var → named constants.
Model is configurable without code changes (a DB row edit swaps the model).
This is a DIFFERENT but valid config-driven pattern — not a violation per se, but a
parallel system outside the gateway.

`packages/cultivar-os/api/pmi/suggest.ts:44` — inline hardcode `model: 'claude-sonnet-4-6'`.
TRUE STD-002 violation — see Sweep 4.

### What the spec said vs. what exists

**Spec said (2026-06-05 status):** 4 direct `new Anthropic()` call sites, all hardcoded models.

**Current state:** Those 4 original call sites are now gateway-routed — the migration task
from the spec was completed. Two newer endpoints (OCR, PMI) were built after the spec
and use different patterns.

**Spec step 5 ("logs every call"):** Partially. Console logging only when `AI_DEBUG=true`.
No table INSERT anywhere in `execute.ts`. See Sweep 5.

**`AIEngine.ts`:** Exists in `packages/shared/src/ai/AIEngine.ts` (Railway-bound routing brain).
Has its own `CAPABILITY_MAP` with model-per-task config. NOT the web gateway — it calls
Railway via `VITE_API_URL` which is unset for web (Tech Debt #12). Dormant for web. The
spec correctly identified this as "good brain, dead plumbing" — the brain was promoted to
`execute.ts`/`capabilities.ts`, the plumbing (Railway) was not.

---

## SWEEP 4 — HARDCODED MODEL CALL SITES · 1 TRUE STD-002 VIOLATION

Full grep output for `claude-sonnet-4-6`, `claude-haiku`, `new Anthropic(`, `"model":`:

```
packages/shared/src/ai/AIEngine.ts:41:   model: 'claude-haiku-4-5-20251001'   ← CAPABILITY_MAP config (Railway/dormant)
packages/shared/src/ai/AIEngine.ts:44:   model: 'claude-haiku-4-5-20251001'   ← CAPABILITY_MAP config (Railway/dormant)
packages/shared/src/ai/AIEngine.ts:45:   model: 'claude-haiku-4-5-20251001'   ← CAPABILITY_MAP config (Railway/dormant)
packages/shared/src/ai/AIEngine.ts:46:   model: 'claude-haiku-4-5-20251001'   ← CAPABILITY_MAP config (Railway/dormant)
packages/shared/src/ai/AIEngine.ts:47:   model: 'claude-haiku-4-5-20251001'   ← CAPABILITY_MAP config (Railway/dormant)
packages/shared/src/ai/AIEngine.ts:48:   model: 'claude-haiku-4-5-20251001'   ← CAPABILITY_MAP config (Railway/dormant)
packages/shared/src/ai/AIEngine.ts:51:   model: 'claude-sonnet-4-6'           ← CAPABILITY_MAP config (Railway/dormant)
packages/shared/src/ai/AIEngine.ts:52:   model: 'claude-sonnet-4-6'           ← CAPABILITY_MAP config (Railway/dormant)
packages/shared/src/ai/AIEngine.ts:151:  'claude-haiku-4-5-20251001'          ← fallback hardcode inside call() method (Railway/dormant)
packages/shared/src/ai/AIEngine.ts:154:  '_override_model': 'claude-haiku-4-5-20251001' ← same fallback (Railway/dormant)
packages/shared/src/ai/execute.ts:70:    new Anthropic(...)                   ← no model hardcode; model resolved from CAPABILITIES ✅
packages/shared/src/ai/capabilities.ts:12: model: 'claude-haiku-4-5-20251001' ← CAPABILITIES registry ✅ correct pattern
packages/shared/src/ai/capabilities.ts:13: model: 'claude-sonnet-4-6'         ← CAPABILITIES registry ✅ correct pattern
packages/shared/src/ai/capabilities.ts:14: model: 'claude-sonnet-4-6'         ← CAPABILITIES registry ✅ correct pattern
packages/shared/src/ai/capabilities.ts:15: model: 'claude-sonnet-4-6'         ← CAPABILITIES registry ✅ correct pattern
packages/shared/src/ai/capabilities.ts:16: model: 'claude-sonnet-4-6'         ← CAPABILITIES registry ✅ correct pattern
packages/cultivar-os/api/receipts/ocr.ts:41: DEFAULT_PRIMARY_MODEL = 'gemini-2.5-flash'      ← named constant, last-resort fallback only
packages/cultivar-os/api/receipts/ocr.ts:42: DEFAULT_FALLBACK_MODEL = 'claude-haiku-4-5-20251001' ← named constant, last-resort fallback only
packages/cultivar-os/api/pmi/suggest.ts:44:  model: 'claude-sonnet-4-6'       ← ⚠️ INLINE HARDCODE in messages.create() — STD-002 VIOLATION
```

**Count of true inline model strings in deployed web handler API calls: 1**

`pmi/suggest.ts:44` — `model: 'claude-sonnet-4-6'` is passed directly to `messages.create()`,
not resolved from `CAPABILITIES` or any config. Caching: NO (`cache_control` absent).
Deployed: YES (but blocked by 13th-function Hobby limit — see 2026-06-13 PMI handoff).

**Not violations:**
- `capabilities.ts` strings: gateway config — the correct pattern ✅
- `ocr.ts` constants: fallback defaults under a 3-layer config resolution; model is
  configurable via `platform_config` table row without code changes
- `AIEngine.ts` strings: dormant Railway file, not live web gateway

---

## SWEEP 5 — COST-LOGGING / API-MONITOR LAYER · NOT FOUND (web platform)

### What exists

**`AIUsageLog` TypeScript interface** — `packages/shared/src/supabase/types.ts:58–69`:
```typescript
export interface AIUsageLog {
  id:            string;
  tenant_id:     string;
  vertical:      string;
  task_type:     string;
  provider:      'claude' | 'gemini' | 'whisper' | 'openai';
  input_tokens:  number;
  output_tokens: number;
  cost_usd:      number;
  latency_ms:    number | null;
  created_at:    string;
}
```

**`execute.ts:81–82`** captures `inTok`/`outTok` from `response.usage`. Emits them in a
structured console log when `AI_DEBUG=true`. **Not persisted to any table.**

**`ocr.ts:212`** computes a `costEstimate` per call (Claude Haiku 4.5 pricing: $0.80/1M in,
$4.00/1M out). Includes it in the API response body (`ocr_cost_estimate` field). **Not
persisted to any table.**

**`ai_usage` table** — `packages/ignition-os/DataBridge.js:316,322` references a `ai_usage`
table, but DataBridge.js is the Ignition-mobile/Railway path, not cultivar-os web.

### What does NOT exist

- No `CREATE TABLE ai_usage` migration in `supabase/migrations/` for cultivar-os
- No INSERT call to any usage/cost table in `execute.ts`, `ocr.ts`, or `pmi/suggest.ts`
- No per-tenant cost dashboard or reporting surface

### Why this matters for phase 2

The voice loop uses the same Sonnet calls as social_generate. At scale (recurring weekly
per business), cost is real. The spec (`SPEC-ai-gateway-2026-06-05.md §5 step 5`) calls
out cost logging at the gateway as the right capture point. `AIUsageLog` is designed.
No table or INSERT exists yet. The loop can ship without it (v1), but cost visibility
is a known gap that grows with every business added to the recurring schedule.

---

## SWEEP 6 — MODEL-AS-CONFIG · PARTIAL

### executeCapability supports per-business override (FOUND)

`execute.ts:35–50` queries `business_modules.config.model` for the capability key:
```typescript
if (opts.businessId && opts.supabase) {
  const { data } = await opts.supabase
    .from('business_modules')
    .select('config')
    .eq('business_id', opts.businessId)
    .eq('module_key', capabilityKey)
    .maybeSingle();
  const m = (data as any)?.config?.model;
  if (typeof m === 'string' && m.length > 0) overrideModel = m;
}
const model = overrideModel ?? cfg.model;
```

Model resolution: per-business override → platform default from `CAPABILITIES`. Change
from Haiku to Sonnet for one business = one config write, no code change.

### Override never activates for social or campaign generate (PARTIAL)

Neither `social/generate.ts:89` nor `campaigns/generate.ts:122` passes `businessId` to
`executeCapability`. The gateway supports override; the callers don't enable it.
Picking the voice model against a quality bar would require:
1. Passing `businessId` + `supabase` client to `generateSocialDrafts()` / `generateCampaignPosts()`
2. Or adding a `social_voice` capability key to `CAPABILITIES` with a separate model entry

### OCR model: fully configurable (FOUND)

`platform_config` table → `OCR_PRIMARY_MODEL` env var → named constant. A DB row edit
swaps the model for all users instantly, no code change or deploy.

### PMI suggest: NOT configurable (STD-002 violation)

`pmi/suggest.ts:44` — `model: 'claude-sonnet-4-6'` inline. Only a code edit can change it.

---

## Summary: what matches expectation, what surprised

| Sweep | Status | Surprise? |
|---|---|---|
| 1 · Edit capture (social) | FOUND — complete | No — signaled in migrations |
| 2 · Brand-voice config | PARTIAL | Campaigns has a CLOSED loop (toneBlock + samples table); social does not. The gap between the two flows is wider than expected. |
| 3 · AI gateway | PARTIAL | `executeCapability` is substantially built and routing all 5 original targets. OCR has its own superior config chain. PMI is the outlier. |
| 4 · STD-002 violations | 1 true violation | Fewer than expected given the spec's starting state. All 4 original call sites were migrated. Only pmi/suggest.ts (new, post-spec) remains. |
| 5 · Cost-logging | NOT FOUND | `AIUsageLog` type designed; no table, no INSERT anywhere. The spec called this out; it has not been built. |
| 6 · Model-as-config | PARTIAL | Override infrastructure exists in executeCapability; callers (social, campaign) don't pass businessId so override never fires. |

---

## Phase 2 design inputs (for the design session, not this doc)

Based on recon, the critical inputs are:

1. **Signal exists.** `social_drafts.original_text` + `edited_text` pairs are being captured.
   The learning corpus is there — it just isn't being read back into generation yet.

2. **Campaigns is the precedent.** `campaign_tone_samples` + `toneBlock` injection is the
   working model. Social phase 2 is essentially "do what campaigns already does, sourced
   from `social_drafts`."

3. **One open decision before design:** use `social_drafts` directly (query + filter) or
   build a `social_tone_samples` table (parallel to `campaign_tone_samples`, cleaner
   separation, enforces `edited_text NOT NULL`). This is the primary design decision.

4. **businessId must flow to executeCapability.** If the voice model gets its own capability
   key (e.g. `social_voice_generate`), and we want per-business override to be possible,
   the caller chain must pass `businessId` + `supabase` client.

5. **Cost logging is unbuit.** The loop will run blind on cost until `ai_usage` table +
   gateway INSERT are built. Acceptable for v2; worth flagging before launch.

6. **pmi/suggest.ts is a routing job, not a design question.** Route it through
   `executeCapability` under a `pmi_suggest` capability key in `CAPABILITIES`. Removes
   the only true STD-002 violation in the web function layer.

---

## DEFERRED — Social read-back NOT built (2026-06-13)

**What was done (same session):**
- `campaign_tone_samples` renamed → `business_voice_samples` (migration `20260613_business_voice_samples.sql`)
- `source text NOT NULL` column added; existing rows backfilled to `'campaign_generate'`
- `packages/cultivar-os/api/campaigns.ts` repointed to `business_voice_samples` (both read and write sites)
- Campaigns write site now supplies `source: 'campaign_generate'` explicitly
- Campaigns loop still closes end-to-end: owner edits a campaign post → pair saved to `business_voice_samples` with `source='campaign_generate'` → next generation reads back from `business_voice_samples` filtered by `business_id` only (pooled — no source filter)

**What was NOT built (deferred):**
- `social/generate.ts` does NOT read voice samples back from `business_voice_samples`
- `social_drafts` captures `original_text`/`edited_text` pairs (Sweep 1 — FOUND) but they are NOT written into `business_voice_samples` on owner edit
- Social has a working demo output without this; Cost-to-Produce is the active priority

**To build when voice thread resumes:**
1. On owner edit/save in social drafts (`Dashboard.tsx handleSaveEdit`), write a row to `business_voice_samples` with `source='social_generate'`, `business_id`, `platform`, `original_text`, `edited_text`
2. In `social/generate.ts` (`generateSocialDrafts`), query `business_voice_samples` filtered by `business_id` (NOT by source — pooled voice), inject as few-shot `toneBlock` analogous to `campaigns/generate.ts:78-84`
3. Write-trigger decision: either fire on `handleSaveEdit` directly, or add a separate `social_tone_learn` action to `api/social/generate-posts.ts`. The `handleSaveEdit` path is simpler.
4. Filter for true edits only: `WHERE edited_text IS NOT NULL AND edited_text != original_text`

**Voice thread parked:** schema locked, campaigns repointed. Returning to Cost-to-Produce.
