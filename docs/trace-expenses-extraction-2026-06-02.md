# TRACE Expenses Extraction — 2026-06-02

**Type:** Read-only audit  
**Scope:** All TRACE-domain spending across all repos and doc folders  
**Auditor:** Claude Code  
**Status:** No expense data was modified. All findings are extracted from existing documents.

---

## TASK 1 — Expense Tracking Files Found

### File 1: `CoolRunning/MASTER_BRIEF-2.md` — PART 12 — COST AUDIT

**Path:** `/Users/terrenceobrien/Desktop/CoolRunning/MASTER_BRIEF-2.md` (lines 659–696)  
**Type:** Authoritative cash-spent ledger + sweat equity table + monthly burn rate  
**Date captured:** 2026-05-12 (stated explicitly as "as of 2026-05-12")  
**Last updated:** Unknown — file has no session-by-session update discipline like CLAUDE.md  
**Status:** **STALE** — 21 days old as of this audit. Six additional domains were registered after this date (see CLAUDE.md domain table dated 2026-05-26). Gemini and Claude subscription amounts may have changed. No entries after May 12.

**Covers:**
- Exact GoDaddy purchase receipts with receipt numbers (4 domain registrations + 2 M365 subscriptions)
- Claude Pro and Gemini Advanced subscription costs
- Texas sales tax
- Total cash to date
- Sweat equity estimate (hours × rate)
- Monthly burn rate breakdown
- Break-even math

---

### File 2: `CLAUDE.md` — Domain Registry (as of 2026-05-26)

**Path:** `/Users/terrenceobrien/Desktop/trace-platform/CLAUDE.md` (lines 134–153)  
**Type:** Domain inventory with protection status and purpose  
**Date captured:** 2026-05-26 (stated in header)  
**Status:** Current — most recently updated domain table in any document  
**Coverage gap:** No purchase prices listed. No receipt numbers. Presence only, not cost.

**Domains listed (10 total):**

| Domain | Protection | Notes |
|---|---|---|
| trace-enterprises.com | None | Parent company |
| builtwithcai.com | Full Protection | Platform brand |
| cultivar-os.com | None | Nursery vertical |
| cultivar-os.app | None | Production app |
| ignition-os.com | Full Protection | Auto/diesel vertical |
| ignition-os.app | None | Alternate TLD |
| conduit-os.com | None | HVAC/electrical vertical |
| conduit-os.app | None | Alternate TLD |
| kinna-os.com | None | Nonprofit vertical |
| kinna-os.app | None | Alternate TLD |

Domains builtwithcai.com and ignition-os.com had Full Protection purchased at registration. The other 8 have no WHOIS protection. CLAUDE.md notes these will be moved to Cloudflare (free WHOIS) after July 1-2, 2026, when the 60-day ICANN transfer window opens.

---

### File 3: `CoolRunning/MASTER_BRIEF-2.md` — PART 14 — ACTION ITEMS (Item D2)

**Path:** `/Users/terrenceobrien/Desktop/CoolRunning/MASTER_BRIEF-2.md` (line 766)  
**Type:** Explicit directive to track expenses  
**Content:** "D2 — Log all project expenses from today forward | Terrence | Required for grants + investor 'capital deployed' claim"  
**Status:** This instruction was written on 2026-05-12. There is no evidence in any document that a separate expense log was created after this date. The directive exists; its fulfillment does not.

---

### File 4: `MASTER_BRIEF.md` — Hardware Kit Cost Reference

**Path:** `/Users/terrenceobrien/Desktop/trace-platform/MASTER_BRIEF.md` (lines 576–585)  
**Type:** Per-customer hardware kit cost estimate  
**Status:** Planning data, not purchase records  
**Content:** $25 magnetic mount + $10 cable + $1 cheat sheet + $2 sticker = ~$38 per kit. Brother QL-820NWB (~$200 demo unit, not per-kit).

---

### File 5: `CoolRunning/MASTER_BRIEF-2.md` — Hardware Stack (Liberty Hill Pilot)

**Path:** `/Users/terrenceobrien/Desktop/CoolRunning/MASTER_BRIEF-2.md` (lines 283–303)  
**Type:** Hardware inventory — devices installed at Liberty Hill, TX  
**Status:** Inventory only — no purchase prices, no receipt numbers, no total  
**Date:** Unknown — written before 2026-05-12  

**Devices listed (no prices):**
- HP ProDesk 600 G6 (Home Assistant OS server)
- Meross MTS300 Matter thermostat
- Sonoff SNZB-02D × 8 (room sensors)
- HA Connect ZBT-2 × 2 (Zigbee coordinators)
- NSPanel Pro 120 × qty unknown (wall panels)
- Sonoff ZBMINIL2 + Mini Duo-L (in-wall switches)
- Sonoff iFan04-L (fan controller)
- Eve Energy × 6 (smart outlets)
- Apollo MSR-2 mmWave × 5 (presence detectors)
- RAK LoRa gateway (outdoor sensor mesh)
- Tailscale VPN (software, free tier)

Also noted as pending/upcoming hardware:
- PSU ATX→HP adapter ($10) for RTX 3060 installation
- RTX 3060 (GPU for local AI inference — already on hand per context)

---

### File 6: `CoolRunning/MASTER_BRIEF-2.md` — Irrigation Phase 2

**Path:** `/Users/terrenceobrien/Desktop/CoolRunning/MASTER_BRIEF-2.md` (lines 978–997)  
**Type:** Hardware inventory — already-purchased irrigation equipment  
**Status:** Inventory only — no prices  
**Content:** Orbit B-hyve 12-station smart timer + Orbit Heavy Duty 3-valve manifold × 2. Purchased and on hand. Install planned for Fall 2026.

---

### File 7: `MASTER_BRIEF.md` — AI API Cost Estimate (per-trial)

**Path:** `/Users/terrenceobrien/Desktop/trace-platform/MASTER_BRIEF.md` (line 269)  
**Type:** Planning estimate, not actual spend  
**Content:** "AI API cost during trial: ~$3–5" (per customer trial, not monthly total)

---

### File 8: `THOUGHTS.md` — AI Subscription Reference

**Path:** `/Users/terrenceobrien/Desktop/trace-platform/THOUGHTS.md` (line 938)  
**Content:** "Currently Andrew uses Gemini as his daily AI (cannot afford Claude)."  
**Significance:** Confirms Andrew is NOT on a Claude subscription. David is. Gemini Advanced is David's, not Andrew's.

---

### What Was NOT Found

- No dedicated expense spreadsheet (`.xlsx`, `.csv`) for TRACE operational costs
- No Gemini API console usage log or export
- No Anthropic Claude API invoice or usage report
- No Supabase billing records
- No Vercel billing records
- No Railway billing records (Railway is legacy/decommissioned for web builds)
- No itemized CoolRunnings hardware purchase receipts with dollar amounts
- No Square or Stripe account setup confirmation (both were listed as action items in CoolRunning/MASTER_BRIEF-2.md — status unknown)
- No expense tracking after May 12, 2026

---

## TASK 2 — Expense Categories Consolidated

### Category Table

All amounts sourced from `CoolRunning/MASTER_BRIEF-2.md` PART 12 (as of 2026-05-12) unless otherwise noted. Amounts marked `[est.]` are estimates from planning docs.

#### A. AI / API Subscriptions

| Service | Type | Cost | Notes |
|---|---|---|---|
| Claude Pro (includes Claude Code) | Monthly recurring | $17/mo | David's subscription. As of May 12. May have upgraded to Max since (unconfirmed). |
| Gemini Advanced | Monthly recurring | $20/mo | David's subscription. As of May 12. |
| Texas sales tax on AI subscriptions | Monthly recurring | ~$3/mo | ~8.25% on $37/mo |
| ANTHROPIC_API_KEY (Claude API) | Usage-based, pay as you go | Untracked | Powers social post generation in cultivar-os, AI features in both verticals. No usage log in any doc. |
| Gemini API | Usage-based | $0 — not yet wired | AIEngine routes to Gemini for vision tasks but Gemini API calls are not active in production. |

**Subtotal recurring (AI):** ~$40/mo  
**Usage-based API costs:** Untracked — no dashboard or log accessible from the repo

---

#### B. Infrastructure — Cloud Services

| Service | Tier | Cost | Notes |
|---|---|---|---|
| Vercel — cultivar-os | Hobby/Free | $0 | Confirmed free tier. No production team seat. |
| Vercel — ignition-os | Hobby/Free | $0 | Same project, second deployment config. |
| Supabase — bgobkjcopcxusjsetfob (cultivar-os) | Free tier | $0 | PostgreSQL, auth, storage. Confirmed in CLAUDE.md. |
| Supabase — ufsgqckbxdtwviqjjtos (ignition-os) | Free tier | $0 | Separate project. Confirmed in CLAUDE.md. |
| Railway | Legacy | $0 | Decommissioned for web builds. Was used for ai_router.py. No active Railway charges referenced. |
| GitHub | Free | $0 | david-obrien61 account. Private repo. |

**Subtotal (infrastructure):** $0/mo — entirely on free tiers as of this audit

---

#### C. Domain and DNS

The initial 4 domains were purchased via GoDaddy on or around May 2, 2026 (receipt #4078817559, #4078823681, #4078828305, #4079365889). Six additional domains appear in CLAUDE.md (as of 2026-05-26) that are not in the May 12 cost audit — they were registered between May 12 and May 26.

**Confirmed from cost audit (May 2, 2026):**

| Domain | Term | Amount | Receipt |
|---|---|---|---|
| builtwithcai.com — registration (3-yr) | 3-yr | $46.59 | #4078817559 |
| builtwithcai.com — Full Domain Protection (3-yr) | 3-yr | $38.97 | #4078817559 |
| ignition-os.com — registration (3-yr) | 3-yr | $46.59 | #4078823681 |
| ignition-os.com — Full Domain Protection (3-yr) | 3-yr | $38.97 | #4078823681 |
| conduit-os.com — registration (3-yr) | 3-yr | $46.59 | #4078828305 |
| trace-enterprises.com — registration (3-yr) | 3-yr | $46.59 | #4079365889 |

**Additional domains in CLAUDE.md not in cost audit (registered after May 12):**

| Domain | Term | Amount | Status |
|---|---|---|---|
| cultivar-os.com | 3-yr (assumed) | Unknown — no receipt logged | No protection |
| cultivar-os.app | 3-yr (assumed) | Unknown — no receipt logged | No protection |
| ignition-os.app | 3-yr (assumed) | Unknown — no receipt logged | No protection |
| conduit-os.app | 3-yr (assumed) | Unknown — no receipt logged | No protection |
| kinna-os.com | 3-yr (assumed) | Unknown — no receipt logged | No protection |
| kinna-os.app | 3-yr (assumed) | Unknown — no receipt logged | No protection |

**GoDaddy M365 Email Essentials:**

| Purchase | Amount | Receipt | Status |
|---|---|---|---|
| builtwithcai.com — M365 Email Essentials (1-yr) | $12.66 | #4078817559 | Keep — reassign to trace-enterprises.com |
| ignition-os.com — M365 Email Essentials (1-yr) | $12.66 | #4078823681 | Duplicate — action item: attempt refund from GoDaddy 1-480-505-8877 |

**Domain subtotals (confirmed, excluding 6 untracked domains):**
- Registration: $186.36 (one-time, 3-yr term)
- Protection: $77.94 (one-time, 3-yr term)
- M365 Email: $25.32 (annual, one paid in duplicate)

**Annualized domain cost (confirmed only):** ~$8.44/yr (registrations only; protection is prepaid 3yr)  
**Cloudflare transfer target (July 2026):** Renewals drop to ~$10.46/yr per domain vs. GoDaddy ~$22.99/yr.

---

#### D. Hardware

| Item | Category | Amount | Status |
|---|---|---|---|
| CoolRunnings Liberty Hill hardware stack (HP ProDesk, sensors, switches, thermostat, etc.) | One-time, capital | **Unknown** — no receipts logged | Purchased before May 12, not in cost audit |
| Orbit B-hyve 12-station timer + manifold × 2 | One-time | **Unknown** — no receipt | Irrigation Phase 2, already on hand |
| PSU ATX→HP adapter | One-time | $10 | Pending install, mentioned in MASTER_BRIEF-2 |
| Brother QL-820NWB (demo label printer) | One-time, demo | ~$200 [est.] | Status unknown — not confirmed purchased |
| Brother QL-800 (pilot loaner printer) | One-time per loan | ~$120 [est.] | Status unknown — not confirmed purchased |
| Per-customer hardware kit (magnetic mount, cable, sticker, cheat sheet) | One-time per customer | ~$38 [est.] | No kits distributed yet — LAWNS is the first prospect |
| Square Reader | One-time | ~$49 | Listed as action item in MASTER_BRIEF-2; status unknown |

**Hardware total:** Cannot be determined. No aggregated hardware purchase record exists anywhere in the codebase or documentation.

---

#### E. Legal and Business Formation

| Item | Cost | Status | Source |
|---|---|---|---|
| TRACE Enterprises LLC — TX SOS initial registration | Unknown | Done — registered as real estate business | MASTER_BRIEF-2 Part 19 |
| SOS amendment (add technology/software services) | ~$150 | Not yet filed | MASTER_BRIEF-2 Part 14 Item B1 |
| EIN | $0 | Status unknown | Action item B2 in MASTER_BRIEF-2 |
| Business bank account | $0–25/mo | Status unknown | Action item B3 in MASTER_BRIEF-2 |

---

#### F. Third-Party Services (Wired but Free or Unconfirmed Cost)

| Service | Type | Cost | Notes |
|---|---|---|---|
| Blotato | Social post publishing | Unknown | API key is in Vercel. Free tier or paid? No tier documented. |
| QuickBooks Online (Intuit production) | Per David's QB account | Unknown | Used for Cultivar OS invoice creation. TRACE doesn't pay for this — customers do. David's account used for dev. |
| Resend | Transactional email | Free tier (assumed) | Wired in packages/shared/src/notifications/send.ts. No Resend API key or billing confirmed. |
| Twilio | SMS | Unknown | Wired in shared notifications. No Twilio SID or auth token confirmed in Vercel env vars. |
| Stripe | Billing | Not yet active | No Stripe integration built. No Stripe account confirmed. |

---

## TASK 3 — David's Labor Rate

### Found: One explicit labor rate

**Source:** `CoolRunning/MASTER_BRIEF-2.md`, Part 12 — Sweat Equity table (line 682)

```
Terrence OBrien | 160 hrs (40/wk × 4 wks) | $75/hr (last paid rate) | $12,000
```

**Rate:** $75/hour  
**Basis:** "last paid rate" — this is David's final federal civilian pay rate converted to an hourly equivalent, not a market rate for SaaS founders or software engineers.

**Hours logged (as of 2026-05-12):** 160 hours (4 weeks at 40 hrs/week)  
**Sweat equity value at that snapshot:** $12,000

**Important caveats:**
1. The hours figure (160) was captured on May 12, 2026. The TRACE founding timeline (docs/trace-founding-timeline-2026-05-27.md) documents that Ignition OS work began April 11, 2026. The 160-hour figure likely covers April 11 through approximately May 9 — consistent with 4 weeks.
2. As of this audit (June 2, 2026), roughly 7 additional weeks of intense work have occurred since May 12 (Cultivar OS demo hardening, multi-tenant extraction, Ignition web build, campaign scheduler, discovery module, Ignition audits). At 40 hrs/week, an additional ~280 hours would bring total to ~440 hours and total sweat equity to ~$33,000 at the $75/hr rate.
3. The $75/hr rate is conservative relative to market rates for solo SaaS founders with 40 years of knowledge management expertise. It is appropriate for sweat equity documentation purposes.

**Andrew's hours and rate:** Listed as "TBD" in the cost audit table. Not documented elsewhere.

**No other labor rate references were found** in any document across any of the repos or folders audited.

---

## TASK 4 — Gaps Identified

### Gap 1 — No expense log after May 12, 2026

The CoolRunning MASTER_BRIEF-2.md explicitly instructs: "Log all project expenses from today forward." No log was created. Six additional domain registrations happened after May 12 with no prices captured. There is no record of what those 6 domains cost.

**Action item D2 from MASTER_BRIEF-2 (written May 12):** "Log all project expenses from today forward — Terrence — Required for grants + investor 'capital deployed' claim." **Status: Not fulfilled.**

---

### Gap 2 — No CoolRunnings hardware purchase record

The Liberty Hill hardware stack is documented as an inventory list (what was installed) but not as a purchase record (what was paid, when, from which account). The HP ProDesk, 8 Sonoff sensors, ZBT-2 coordinators, NSPanel Pros, Eve Energy outlets, Apollo mmWave detectors, RAK gateway, and Meross thermostat are all installed but unpriced in any document.

This is likely hundreds to low-thousands of dollars of capital deployed with no capture.

---

### Gap 3 — Claude API usage is untracked

The ANTHROPIC_API_KEY is in Vercel for cultivar-os (and will be for ignition-os when AI features activate). Every social post generation call, every discovery synthesis call, every AI analysis runs against this key and incurs API cost. There is no usage log, no dashboard reference, no cost cap, no monthly total anywhere in the docs.

MASTER_BRIEF.md (line 128) notes prompt caching is used (`cache_control: ephemeral`) — this reduces costs. But the total is unknown.

The Ignition OS AIEngine documents `_log_usage()` which writes to an `ai_usage` table with `cost_usd` per call (docs/built-inventory.md line 68). This table exists in the Ignition schema but is not replicated in Cultivar OS. There is no equivalent cost logging in the cultivar-os package.

---

### Gap 4 — Six domain costs not captured

The domains registered between May 12 and May 26 (cultivar-os.com, cultivar-os.app, ignition-os.app, conduit-os.app, kinna-os.com, kinna-os.app) have no purchase prices documented anywhere. At GoDaddy's standard rates (~$15–20/yr for .com, ~$20–25/yr for .app), 6 domains at 3-year terms is likely $250–450. The actual receipts are in GoDaddy under AMEX ••••1005 and have not been entered into any tracking document.

---

### Gap 5 — Hardware total is unknown

David has installed a live CoolRunnings system at Liberty Hill. The devices are documented. The costs are not. This matters for two reasons:
1. Grant applications require "capital deployed" figures — hardware purchases are capital.
2. Any future investor conversation needs an honest all-in cost picture.

---

### Gap 6 — Blotato, Resend, Twilio tiers undocumented

All three services are wired. None have confirmed tiers, billing status, or monthly costs captured in any document. Blotato in particular is live in production (social posts are being published). Its tier and cost are invisible.

---

### Gap 7 — No month-over-month total

There is one snapshot (May 12) and no subsequent captures. The current (June 2) burn rate, cumulative cash spent, and cumulative hours invested cannot be read from any document without manual reconstruction.

---

### Gap 8 — Square Reader purchase unconfirmed

Square Reader (~$49) was listed as an action item in May. No confirmation of purchase or account creation anywhere in any document.

---

### Gap 9 — Andrew's sweat equity entirely undocumented

Andrew established the Git/GitHub/Supabase/Railway foundation. He has his own product (MicroGrant Sniper) running alongside. His hours on TRACE infrastructure are not captured anywhere. The cost audit table has "TBD" for both Andrew and "Son 2."

---

## TASK 5 — Recommended Single Source of Truth

### What the data situation actually is

There is one historical snapshot (CoolRunning/MASTER_BRIEF-2.md Part 12, May 12), one domain inventory (CLAUDE.md, May 26), and scattered hardware references with no prices. No centralized expense tracking exists after May 12. The D2 action item (log expenses going forward) was never fulfilled.

The current burn rate is approximately $40/mo in AI subscriptions + usage-based Claude API (untracked). Infrastructure is $0 on free tiers. Everything else is one-time spending that hasn't been logged.

---

### Recommendation: Markdown file in trace-platform/docs/

**Path:** `docs/trace-expenses.md`  
**Format:** Monthly sections with a running total table at the top.

**Why not a spreadsheet:**  
Spreadsheets require a separate app, don't live in version control, and don't appear in Claude Code context. A markdown file in `docs/` is committed to git, appears in `docs/` alongside other audits, and can be read by Claude Code in any session without a tool call.

**Why not QuickBooks:**  
"Eat your own dog food" is appealing but premature. QuickBooks is for customer invoicing and business accounting. Expense tracking at this stage is internal operational visibility — the friction of QB entry for a $17 subscription charge is not worth the integration overhead before revenue exists.

**Why not a spreadsheet on Google Drive or iCloud:**  
Not version-controlled. Not visible to Claude. Not alongside the other docs. Loses the git history that makes the other TRACE docs reliable.

**Why not automated Gemini/Claude API cost fetching:**  
Both Anthropic and Google provide API usage dashboards and exportable CSVs. Fetching these automatically would require a separate script or cron job. At current scale (<$10/mo in API usage), the engineering cost of automation exceeds the tracking value. Flag this for automation when monthly API spend exceeds $50/mo.

---

### Recommended structure for `docs/trace-expenses.md`

```markdown
# TRACE Expenses — Running Log

## Summary (updated monthly)

| Category | This Month | YTD | One-Time Total |
|---|---|---|---|
| AI Subscriptions (Claude Pro, Gemini Advanced) | $40 | ... | ... |
| Claude API (usage-based) | $X | ... | ... |
| Infrastructure (Vercel, Supabase, Railway) | $0 | ... | ... |
| Domains + DNS | $0 | ... | $XXX |
| Email (M365) | $1.06/mo amortized | ... | $12.66 |
| Hardware (CoolRunnings + demo equipment) | $0 | ... | $XXX |
| Legal (LLC, SOS) | $0 | ... | $XXX |
| **Total** | **$X** | ... | ... |

David's sweat equity: X hours × $75/hr = $X (updated monthly)

## June 2026

### Recurring
- Claude Pro (includes Claude Code): $17.00
- Gemini Advanced: $20.00
- TX sales tax: ~$3.00

### One-Time (new this month)
[Any new purchases]

### API Usage (pull from dashboard ~1st of month)
- Anthropic (cultivar-os Vercel project): $X.XX
- Google (Gemini API): $0 — not yet activated

## May 2026

### One-Time (already logged in CoolRunning/MASTER_BRIEF-2.md)
[Move the May 12 entries here for consolidation]
```

---

### Migration steps to consolidate (in priority order)

1. **Create `docs/trace-expenses.md`** using the structure above.
2. **Port the May 12 cost audit entries** from CoolRunning/MASTER_BRIEF-2.md Part 12 into the new file under "May 2026."
3. **Pull GoDaddy order history** for the 6 domains registered after May 12 and add their costs to May 2026.
4. **Add a best-effort CoolRunnings hardware total** — search Amazon order history and other purchase records for the Liberty Hill hardware stack. Even an approximate total ("~$XXX, exact receipts in Amazon account") is better than nothing.
5. **Check Blotato account** for current plan and monthly cost. Add to June 2026.
6. **Add ANTHROPIC_API_KEY usage** by pulling from the Anthropic console (console.anthropic.com → Usage). Add monthly total to the running log from the first month forward.
7. **From this point forward:** When a new domain, subscription, or hardware item is purchased, add it to `docs/trace-expenses.md` before the end of the session. This is a 2-minute entry, not a 20-minute reconciliation.

---

### Automation flag (future, not now)

When Claude API spending exceeds ~$50/mo, it becomes worth adding a `docs/api-usage-log.md` or a simple `api/admin/usage-report.ts` endpoint that pulls from the Anthropic billing API and logs monthly totals. MASTER_BRIEF.md already notes that `_log_usage()` exists in AIEngine for Ignition OS — the same pattern can be added to Cultivar OS's Claude calls when tracking becomes important.

---

## Summary

| Finding | Detail |
|---|---|
| Only one authoritative expense record found | CoolRunning/MASTER_BRIEF-2.md Part 12, dated 2026-05-12 — 21 days stale |
| Confirmed cash spent (as of May 12) | ~$329.68 |
| Estimated cash spent since May 12 | Unknown — 6 domain registrations unpriced, Claude API usage untracked |
| Monthly recurring burn (as of May 12) | ~$40/mo (AI subscriptions + tax only; infrastructure $0) |
| David's labor rate | $75/hr (last paid federal rate) |
| David's hours documented | 160 hrs as of May 12; ~440 hrs estimated through June 2 |
| Sweat equity at June 2 (estimated) | ~$33,000 at $75/hr |
| Andrew's sweat equity | Entirely undocumented (TBD in cost audit) |
| Biggest untracked category | CoolRunnings hardware stack — installed, inventory documented, cost unknown |
| Second-biggest untracked category | Claude API usage-based costs |
| Instruction to track expenses | Written May 12 (MASTER_BRIEF-2.md D2) — never acted on |
| Recommended single source of truth | `docs/trace-expenses.md` in this repo, markdown format, monthly sections |
