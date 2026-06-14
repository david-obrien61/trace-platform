# TRACE Expenses — Running Log

> **Single source of truth for TRACE operational costs.** Created 2026-06-14 (THUNDER
> Cost-to-Produce build) — fulfills the D2 action item ("Log all project expenses going
> forward") and the recommendation in `docs/trace-expenses-extraction-2026-06-02.md` §Task 5.
>
> **Confidence grades** (same four-value model as `business_inventory.cost_confidence`):
> **CONFIRMED** (receipt/known) · **DERIVED** (computed from confirmed) · **ESTIMATED**
> (owner guess) · **UNKNOWN** (real cost, amount not yet known — never written as $0).
>
> **Boundary** (COST-TO-PRODUCE-DESIGN.md §2): this file captures and labels costs. It
> never takes a tax or legal position — that is the accountant's call.
>
> **Tile link (follow-up):** the Cost-to-Produce config currently lives in
> `business_modules.config` (seeded by `supabase/migrations/20260614_cost_to_produce_trace_seed.sql`).
> The values below and that config should be reconciled; eventually the tile config should
> read from this file (or both from one source). Tracked as a follow-up, not done here.

---

## Summary (update monthly)

| Category | Monthly | Confidence | One-time |
|---|---|---|---|
| AI subscriptions (Claude Pro, Gemini Advanced) | $37.00 | CONFIRMED | — |
| TX sales tax on AI subs | ~$3.00 | DERIVED | — |
| Infrastructure (Vercel, Supabase, GitHub) | $0.00 | CONFIRMED (free tier) | — |
| Claude API usage | UNKNOWN | UNKNOWN | — |
| Domains + DNS (initial 4) | — | CONFIRMED | $186.36 reg + $77.94 protection |
| Domains (6 added after May 12) | — | UNKNOWN | UNKNOWN |
| Email (M365 Essentials) | ~$2.11 amortized | CONFIRMED | $25.32/yr (one paid duplicate) |
| Hardware (CoolRunnings + demo) | — | UNKNOWN | UNKNOWN |
| Blotato / Resend / Twilio | UNKNOWN | UNKNOWN | — |
| Legal (LLC done; SOS amendment) | — | — | ~$150 (SOS amendment, not filed) |
| **Known monthly floor** | **~$40.00** | mixed | — |

**David's labor:** $75/hr (last paid federal rate). Hours: 160 logged as of 2026-05-12;
~440 estimated through 2026-06-02. Sweat equity ≈ $33,000 at 2026-06-02 (ESTIMATED).
*This is owner-input; TRACE does the arithmetic, does not assert a deductible rate.*

---

## Known monthly floor (what the Cost-to-Produce tile prices from)

| Item | Amount | Period | Confidence | Note |
|---|---|---|---|---|
| Claude Pro (incl. Claude Code) | $17.00 | monthly | CONFIRMED | ⚠ **may be Pro Max ~$100 — David verify current plan** |
| Gemini Advanced | $20.00 | monthly | CONFIRMED | David's, not Andrew's (THOUGHTS.md:938) |
| TX sales tax on AI subs | ~$3.00 | monthly | DERIVED | ~8.25% on $37 |
| Infrastructure (Vercel/Supabase/GitHub) | $0.00 | monthly | CONFIRMED | all free tier |
| **Floor total** | **~$40.00** | monthly | | |

---

## UNKNOWN costs (real, amount not yet captured — never counted as $0)

These are the honest gaps from the extraction audit. Each makes the true cost higher
than the $40 floor. Quantify and promote to the table above as receipts/invoices land.

- **CoolRunnings hardware** (HP ProDesk, sensors, switches, thermostat, irrigation) — installed at Liberty Hill, no receipts logged. Likely hundreds–low-thousands. (extraction §Gap 2/5)
- **Claude API usage** (ANTHROPIC_API_KEY) — powers social/discovery/AI. No usage log. Pull from console.anthropic.com → Usage. (extraction §Gap 3)
- **6 domains** registered May 12–26 (cultivar-os.com/.app, ignition-os.app, conduit-os.app, kinna-os.com/.app) — no prices captured. ~$250–450 est. for 3-yr terms. (extraction §Gap 4)
- **Blotato** — live in production (social posts), tier/cost undocumented. (extraction §Gap 6)
- **Resend** — wired in shared notifications, free tier assumed, unconfirmed.
- **Twilio** — wired for SMS, no SID/cost confirmed.

---

## Reference figures

- **Founding subscription price:** $149/mo (locked founding rate).
- **Per-customer hardware kit:** ~$38 (magnetic mount $25 + cable $10 + sticker/sheet $3) — ESTIMATED.
- **AI API cost per trial:** ~$3–5 (planning estimate, MASTER_BRIEF.md:269).
- **Confirmed cash to date (as of 2026-05-12):** ~$329.68 (extraction §Summary).

---

## May 2026 (ported from CoolRunning/MASTER_BRIEF-2.md Part 12 — as of 2026-05-12)

### One-time (CONFIRMED, with GoDaddy receipts)
- builtwithcai.com reg 3-yr $46.59 + protection $38.97 (#4078817559)
- ignition-os.com reg 3-yr $46.59 + protection $38.97 (#4078823681)
- conduit-os.com reg 3-yr $46.59 (#4078828305)
- trace-enterprises.com reg 3-yr $46.59 (#4079365889)
- M365 Email Essentials: builtwithcai.com $12.66 (#4078817559) + ignition-os.com $12.66 duplicate (#4078823681 — refund pending)

### Recurring
- Claude Pro $17.00 · Gemini Advanced $20.00 · TX tax ~$3.00

---

## June 2026

### Recurring (CONFIRMED)
- Claude Pro $17.00 — ⚠ verify Pro vs Pro Max
- Gemini Advanced $20.00
- TX sales tax ~$3.00
- Infrastructure $0.00 (free tier)

### To capture (UNKNOWN → fill when known)
- Anthropic API usage (pull from console ~1st of month)
- 6 post-May-12 domain costs (GoDaddy order history, AMEX ••••1005)
- CoolRunnings hardware total (best-effort from Amazon order history)
- Blotato plan/cost

---

*Going forward: add new domains, subscriptions, and hardware here before the session ends —
a 2-minute entry, not a 20-minute reconciliation. Automate API-cost pulls when monthly
Claude API spend exceeds ~$50/mo (extraction §Automation flag).*
