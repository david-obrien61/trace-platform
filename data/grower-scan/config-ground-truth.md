# Config & Model-ID Ground Truth — verify-first recon (READ-ONLY)

**Date:** 2026-06-21
**Author:** Thunder (Claude Code)
**Nature:** Verify-first recon. READ-ONLY — no code/schema/migration/build/design. Reports what LIVES in repo, not what's recalled. Repo + migration source are authority. Live DB rows confirmed where a service-key read was available; otherwise the seeding migration is cited as authority and the live-read is described as a check, not performed.
**Produces:** this doc only. No build → no built-inventory change.

> **Output-location note:** written to `data/grower-scan/config-ground-truth.md` per the prompt's primary path. This is a platform-config-doctrine artifact, not grower-scan data — `docs/` (alongside the DECISION-*.md series) is arguably the better long-term home. Flagging; not moving without David.

---

## TL;DR (the one-paragraph truth)

There is **NO single source of truth for model ids.** They are split across **four** stores with **three different governance models**: (1) **OCR** ids live in a real swappable chain — `platform_config` DB table → env var → hardcoded default; (2) **discovery/social/campaign** ids are **inline literals** in `capabilities.ts`, with a live per-business override via `business_modules.config.model`; (3) **PMI suggest** has its model id **hardcoded inline in the endpoint** (`pmi/suggest.ts:43`), bypassing *both* stores and *both* override paths — the single most drift-exposed id in the codebase; (4) **AIEngine.ts** (legacy Railway router) carries inline ids including the **already-deprecated `gemini-2.0-flash`** (×4). Beyond model ids, several genuinely-driftable values live inline as source constants: the **40% margin floor**, **OCR 9s timeouts**, **10MB upload cap**, **inline provider pricing estimates**, image-compression settings, and a **tax rate that exists as BOTH an env var (`VITE_TAX_RATE`, unread) and a hardcoded constant (`TAX_RATE=0.0825`, actually used)** — a live drift trap.

---

## 1. CONFIG SURFACE INVENTORY

### 1A. `platform_config` — the OCR-model DB table

**Status: EXISTS** (defined by migration `supabase/migrations/20260611_platform_config.sql`). Live-table row-dump requires a service-key read (not performed this recon — no credentials minted; **check described below**). Schema + seeded values are from migration source (authority).

**Exact schema** (`20260611_platform_config.sql:8-13`):
```
platform_config (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
)
```

**Seeded values** (`:25-36`):
| key | value | meaning |
|---|---|---|
| `ocr_primary_model` | `gemini-2.5-flash` | primary OCR model, Google endpoint name |
| `ocr_fallback_model` | `claude-haiku-4-5-20251001` | fallback OCR model, Anthropic id |

**Global-only — NOT business-scopable as-built.** PK is `key` alone; there is **no `business_id` column.** One row = one global value. A per-business OCR model would require a schema change (a `business_id` column + composite key, or a separate table). State: flat global key→value store.

**RLS:** `ENABLE ROW LEVEL SECURITY` with **no user-facing policy** — intentional (`:15-19`, AC-2). Server-side service key bypasses RLS; no client read path. It is operator/infrastructure config, not tenant data.

**Reader:** `getOcrModels()` in `packages/cultivar-os/api/receipts/ocr.ts:126-154` — `.select('key, value').in('key', [...])`, builds a map, falls through to env then default on any miss or unavailability (`:145` swallows "migration not yet applied").

**Live-read check (described, not run):** `SELECT key, value, updated_at FROM platform_config;` via a service-key client against `bgobkjcopcxusjsetfob`. The migration's own verification query (`:38-39`) expects exactly the 2 rows above. This recon could not confirm the live rows match the seed (e.g. whether anyone has hand-edited `ocr_primary_model` since).

### 1B. `capabilities.ts` — inline model literals

**File:** `packages/shared/src/ai/capabilities.ts`. `CAPABILITIES` record — every model id is an **inline string literal** in source. Full dump (file:line):

| Capability | Model | Line |
|---|---|---|
| `discovery_identity` | `claude-haiku-4-5-20251001` | `:12` |
| `discovery_analysis` | `claude-sonnet-4-6` | `:13` |
| `discovery_synthesis` | `claude-sonnet-4-6` | `:14` |
| `discovery_compare` | `claude-sonnet-4-6` | `:15` |
| `discovery_catalog` | `claude-haiku-4-5-20251001` | `:16` |
| `discovery_cost` | `claude-opus-4-8` | `:20` |
| `campaign_generate` | `claude-sonnet-4-6` | `:21` |
| `social_generate` | `claude-sonnet-4-6` | `:22` |

Each entry also carries non-model config that is *also* inline: `maxTokens` (800–3000), `cache` (`none`/`ephemeral`), `batch`, `trace`, `responseFormat`. A comment at `:17-19` notes the opus-4-8 id was "verified against the environment model card, not memory" — and explicitly that the per-business override is honored via `business_modules.config` (execute.ts). These ids match current Anthropic model ids in this environment (opus-4-8, sonnet-4-6, haiku-4-5-20251001).

### 1C. `business_modules.config` — per-business override (jsonb)

**Schema** (`supabase/migrations/20260604_business_modules.sql:21-30`):
```
business_modules (
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  module_key   text NOT NULL,
  enabled      boolean NOT NULL DEFAULT false,
  configured   boolean NOT NULL DEFAULT false,
  config       jsonb NOT NULL DEFAULT '{}',
  ...
  PRIMARY KEY (business_id, module_key)
)
```
RLS: membership-scoped (`business_modules_member_access`, FOR ALL via active `business_members`, `:113-121`, AC-2).

**What it can override, and precedence** — `packages/shared/src/ai/execute.ts:33-50`:
- Override is keyed by `(business_id, module_key)` where **`module_key` === the capability key** (`:41` `.eq('module_key', capabilityKey)`).
- It reads **exactly one key: `config.model`** (`:43` `(data as any)?.config?.model`). No other field of a capability (maxTokens, cache, etc.) is overridable per-business today.
- **Precedence resolution** (`:50`): `const model = overrideModel ?? cfg.model;` — per-business `config.model` (a non-empty string) wins; otherwise fall through to the inline `capabilities.ts` default. A failed/absent lookup falls through silently (`:45-47`).
- Override source is logged (`:58` `source: overrideModel ? 'override' : 'default'`) when `AI_DEBUG=true`.

**Scope of this override:** ONLY capabilities that route through `executeCapability`. Callers confirmed (grep): `discovery/{synthesis,compare,engine,costDiscovery,catalog}.ts`, `social/generate.ts`, `campaigns/generate.ts`, `ai/index.ts`. **The OCR path and the PMI path do NOT route through `executeCapability`** → they get **no** `business_modules` override.

Today's live config payloads are module-enablement, not model overrides — the only observed `config` content in the migration's ground-truth (`:92`) is `{"blotato_account_id":"..."}` on `social_media`. No model-override rows are documented as existing; the mechanism is wired but (as far as the migration record shows) unused for model swapping.

### 1D. Other config homes — driftable values living as source constants

**Model id that escapes every store — `pmi/suggest.ts`:**
- `packages/cultivar-os/api/pmi/suggest.ts:43` `const MODEL = 'claude-sonnet-4-6';` — hardcoded inline, instantiates `new Anthropic(...)` directly (`:50`), `model: MODEL` (`:52`), `max_tokens: 512` (`:53`). **Bypasses `CAPABILITIES`, bypasses `platform_config`, bypasses the `business_modules` override.** This is the most drift-exposed model id in the codebase: a model deprecation must be caught here by code edit, with no config lever.

**AIEngine.ts — legacy Railway router, inline `TASK_ROUTING`** (`packages/shared/src/ai/AIEngine.ts:33-58`): routes to a FastAPI backend (`API_URL`, defaults `http://localhost:8000`, `:17-20`). Inline ids (see §2). Has its own inline Haiku fallback literal at `:151,154`. Note: this is the legacy path (CLAUDE.md flags `ai_router.py`/Railway as legacy for web builds); whether it's still reachable in production is not established by this recon.

> **Store #4 lifecycle status (2026-06-21): DEPRECATED-IN-PLACE — removal blocked, NOT resolved.** The Railway backend is dead, so the deprecated `gemini-2.0-flash` ×4 (`AIEngine.ts:35-38`) and the other inline ids here are **harmless while dead** (never called) — but AIEngine.ts is **kept on purpose**: 3 live `ignition-os` callers + barrel re-export still compile it into `build:ignition`, and its 9 Ignition tasks + tier-gating exist nowhere else. The `gemini-2.0` ids die with the eventual Ignition-AI→Vercel port, **not now**. Any "one model-id list" effort treats store #4 as out-of-scope until that port. Status of record + removal blocker: `docs/built-inventory.md` → "AI Engine" entry; Tech Debt #25 + #12.

**Tunable business-logic constants (inline):**
- **Margin floor / baseline 40%** — `packages/shared/src/business-logic/CostToProduce.ts:115-116` (`baseline: 0.40`, default tier `marginOverride: 0.40`) and `:82` doc, plus the fallback `config.margin?.baseline ?? 0.4` at `:421`. Overridable per-business via `business_modules.config.margin.baseline` (read in the cost engine), but the **default** is an inline literal.
- **Tax rate — DRIFT TRAP.** `packages/cultivar-os/src/lib/constants.ts:1` `export const TAX_RATE = 0.0825;` is what the checkout actually uses (`CartReview.tsx:6,56`). Meanwhile CLAUDE.md/Vercel documents an env var `VITE_TAX_RATE = 0.0825` — **grep finds NO code reading `VITE_TAX_RATE`.** Two declared sources, only the hardcoded constant is live. They can silently diverge.
- **Install price** — Settings persists `default_install_price` per business (`Settings.tsx:43-60`), placeholder `225.00` (`:89`); CLAUDE.md notes seed data hardcodes $225/plant. (Per-business DB value exists; the seed default is hardcoded.)

**Infra / safety constants (inline in `ocr.ts`):**
- OCR provider timeouts: **9000 ms** hardcoded twice (`ocr.ts:178` Gemini AbortController, `:235` Claude client) — both sized against Vercel's 10s kill.
- Upload cap: `MAX_BYTES = 10 * 1024 * 1024` (`:37`).
- Allowed MIME types: inline `Set` (`:26-34`); Claude-vision subset (`:45`).
- Gemini `thinkingBudget: 0`, `temperature: 0`, `maxOutputTokens: 2048` (`:193`); Claude `max_tokens: 2048` (`:239`).
- **Inline provider pricing estimates** (drift as vendors reprice): Gemini `$0.075/1M in, $0.30/1M out` (`:211-212`); Claude Haiku `$0.80/1M in, $4.00/1M out` (`:251-252`).

**Image compression** — `packages/cultivar-os/src/utils/imageCompression.ts`: `maxWidthOrHeight: 1800` (`:9`), `initialQuality: 0.82` (`:13`). Hardcoded.

**Env-var config (the deploy-level store)** — full set read across `packages/` + `api/` (grep):
`AI_DEBUG`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OCR_PRIMARY_MODEL`, `OCR_FALLBACK_MODEL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `VITE_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REDIRECT_URI`, `QBO_ENVIRONMENT`, `RESEND_API_KEY`, `FROM_EMAIL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`. (`OCR_*_MODEL` are the only model-id env vars; they are layer 2 of the OCR chain only.)

---

## 2. MODEL-ID SPECIFIC — the complete list

Every model id referenced in source (`*.ts/.tsx/.mjs/.sql`, excluding tests/dist), with file:line and governing store:

| Model id | Where | file:line | Governing store |
|---|---|---|---|
| `gemini-2.5-flash` | OCR primary default | `ocr.ts:41`; seeded `20260611_platform_config.sql:28` | **platform_config → env → default** (swappable) |
| `claude-haiku-4-5-20251001` | OCR fallback default | `ocr.ts:42`; seeded migration `:33` | **platform_config → env → default** (swappable) |
| `claude-haiku-4-5-20251001` | capabilities ×2 | `capabilities.ts:12,16` | inline + `business_modules.config.model` override |
| `claude-sonnet-4-6` | capabilities ×5 | `capabilities.ts:13,14,15,21,22` | inline + override |
| `claude-opus-4-8` | capabilities ×1 | `capabilities.ts:20` | inline + override |
| `claude-sonnet-4-6` | **PMI suggest** | `pmi/suggest.ts:43` | **inline ONLY — no store, no override** |
| `claude-haiku-4-5-20251001` | AIEngine fallback literal | `AIEngine.ts:151,154` | inline (legacy) |
| `gemini-2.0-flash` | AIEngine routing ×4 ⚠️ **deprecated** | `AIEngine.ts:35,36,37,38` | inline (legacy) |
| `claude-haiku-4-5-20251001` | AIEngine routing ×6 | `AIEngine.ts:41,44,45,46,47,48` | inline (legacy) |
| `claude-sonnet-4-6` | AIEngine routing ×2 | `AIEngine.ts:51,52` | inline (legacy) |
| `whisper-1` | AIEngine routing | `AIEngine.ts:55` | inline (legacy, OpenAI) |
| `gpt-4o-mini` | AIEngine routing ×2 | `AIEngine.ts:56,57` | inline (legacy, OpenAI) |

**Is there one source of truth? NO — it is split (and frayed):**
- **OCR** ids → `platform_config` (DB), the only genuinely swap-without-deploy store.
- **Discovery / social / campaign** ids → inline `capabilities.ts`, overridable per-business via `business_modules.config.model`.
- **PMI** id → inline-only in the endpoint, **no store, no override** (the gap).
- **Legacy AIEngine** ids → inline `TASK_ROUTING`, including the **deprecated `gemini-2.0-flash`** the OCR path already migrated away from (the migration comment at `20260611_platform_config.sql:22` explicitly names the `gemini-2.0-flash` deprecation as the trigger for `platform_config` — yet AIEngine.ts still carries it ×4).

The "one findable list" the doctrine wants **does not exist today**; the table above is the first time it has been assembled in one place.

---

## 3. LAYERING / LEVELS

Levels that actually exist in the codebase:

| Level | Mechanism | Applies to |
|---|---|---|
| **per-deploy / per-env** | env vars (Vercel dashboard) | OCR models (`OCR_*_MODEL`), all API keys, `QBO_ENVIRONMENT`, `AI_DEBUG`, Supabase URLs |
| **platform-global** | `platform_config` table (flat key→value, service-key only) | OCR models only, today |
| **per-business** | `business_modules.config` jsonb (RLS, membership-scoped) | capability `model` override (execute.ts path only); `margin.*`, `denominators`, module enablement |
| **source-constant** | inline literals | capabilities ids, PMI id, AIEngine ids, margin floor default, timeouts, caps, pricing, tax-rate constant |

**For model ids specifically — is the layering composed or flat?**
- **OCR ids:** layered but **flat per layer** — `platform_config` is global-only (no `business_id`), then env, then default. There is **no per-business layer** for OCR, because `platform_config` has no business column and OCR doesn't read `business_modules`.
- **Capability ids:** a real **2-level resolution** exists — global default (inline `capabilities.ts`) **+ per-business override** (`business_modules.config.model`, execute.ts:50). This is the only model-id surface today with a global-default-plus-business-override shape. There is **no DB-backed global layer** (the global default is source, not a row).
- **PMI id:** **single flat inline** — zero levels.

**Could the capability ids migrate INTO `platform_config` without losing the per-business override?**
Findings only: the two stores are orthogonal as built — `platform_config` (global, service-key) and `business_modules.config.model` (per-business, RLS, read at `execute.ts:43`) do not reference each other. `executeCapability` resolves `overrideModel ?? cfg.model`, where `cfg.model` is the inline literal. If `cfg.model` were instead read from a global `platform_config` row, the per-business `??` override path is untouched and would still win — **so a migration of the global default into `platform_config` would not, by itself, disturb the existing per-business override.** Caveat: `platform_config` is flat key→value, so it would hold a global default *per capability* (e.g. `capability_model:discovery_cost`), not a layered value; the per-business layer would continue to come from `business_modules.config`, not from `platform_config`. (No change recommended — feasibility statement only.)

---

## 4. MIGRATION FEASIBILITY — options enumerated (NO recommendation, NO build)

Moving the inline capability model ids (and, by extension, the PMI inline id) out of source into a swappable store. Each option stated with what it requires + the live-swappable ⟷ versioned/reviewable tradeoff.

### Option A — Extend `platform_config` (DB rows)
- **Requires:** seed rows e.g. `capability_model:<key>` → id; change `capabilities.ts` so `executeCapability` reads the global default from `platform_config` (one cached lookup) instead of the inline literal; bring `pmi/suggest.ts` onto the same read.
- **Tradeoff:** maximally **live-swappable** (edit one DB row, no deploy) — matches the OCR pattern already in place. **Cost:** values are **not in version control** (no PR/review trail, no rollback-by-revert; same class as tech-debt #39 "live schema not in version control"). Flat key→value, so no native layering beyond global. A bad row is a silent prod change.

### Option B — Versioned config file (single source in repo)
- **Requires:** one module (e.g. `model-registry.ts` / a JSON) holding every id; repoint `capabilities.ts`, `ocr.ts` defaults, `pmi/suggest.ts`, and AIEngine to read it. Model swap = edit + commit + deploy.
- **Tradeoff:** maximally **reviewable/versioned** (every swap is a reviewed PR, git-blame, instant revert) and gives the "one findable list" doctrine asks for. **Cost:** **not live-swappable** — a deprecation needs a deploy; can't hot-fix a broken model id without shipping.

### Option C — Hybrid (file default + DB emergency override)
- **Requires:** the versioned registry of Option B as the default, **plus** a `platform_config`-style lookup checked first so a single row can override in an emergency (the inverse of today's OCR chain). Both the global override layer and the existing per-business `business_modules.config.model` layer would resolve ahead of the file default.
- **Tradeoff:** gets **both** properties — versioned/reviewable by default, live-swappable when prod is on fire. **Cost:** most moving parts; two stores to keep mentally reconciled; resolution order must be documented or it becomes the next "which value won?" mystery.

### Option D — Status-quo + close only the PMI gap
- **Requires:** route `pmi/suggest.ts` through `executeCapability` (add a `pmi_suggest` capability to `CAPABILITIES`) so it inherits the inline-default + per-business-override path; leave OCR (platform_config) and capabilities (inline) as they are.
- **Tradeoff:** smallest change, removes the one fully-ungoverned id; but leaves the **split** (OCR in DB, capabilities inline) and the AIEngine deprecated-`gemini-2.0-flash` untouched — does not deliver the single findable list.

**Cross-cutting facts any option must absorb (stated, not decided):**
- AIEngine.ts still carries the **deprecated `gemini-2.0-flash` ×4** — any "one list" effort has to decide whether the legacy Railway router is in scope or formally retired.
- `platform_config` is **global-only**; per-business model selection (if ever wanted beyond capabilities) needs a schema change there.
- The per-business override (`business_modules.config.model`) is **already live and orthogonal** — every option above can preserve it via the existing `?? cfg.model` seam.

---

## Appendix — what was verified vs cited

- **Read directly (repo source, authority):** `capabilities.ts`, `execute.ts`, `ocr.ts` (cultivar + root shim), `pmi/suggest.ts`, `AIEngine.ts`, `constants.ts`, `imageCompression.ts`, `CostToProduce.ts` (margin lines), migrations `20260611_platform_config.sql` + `20260604_business_modules.sql`.
- **Grep-swept:** all model ids (model-id regex over `packages/ api/ scripts/ supabase/`, dist excluded); `executeCapability` callers; `new Anthropic(` instantiations; env-var reads; margin/threshold/timeout/compression constants.
- **NOT performed (no credentials minted, READ-ONLY):** live `SELECT` of `platform_config` rows and `business_modules.config` payloads against `bgobkjcopcxusjsetfob`. Seeded/migration values cited as authority; live-read described as a check in §1A. Whether the legacy AIEngine/Railway path is still reachable in production was not established.
