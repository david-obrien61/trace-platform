# `businesses` WRITE PATHS — FULL-SURFACE OWNER TEST

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> One glance. Match it to `git log --oneline origin/main -1` — **not to a SHA written in this
> file**, because Vercel deploys the TREE and *any* push to `main`, docs included, moves the
> stamp. *(GATE 0 · OP-15 · paid for twice on 2026-08-31: once hunting a defect in code that
> was never deployed, once by a pinned SHA going stale on the very next commit.)*

> **Rendered board:** open `owner-tests.html` (a PURE renderer — it parses this file live and holds
> no data of its own). Sibling of `stories.html` / `status.html`.
>
> **This file is the ONLY source of truth for the `businesses` write-path owner-tests.** It is
> STANDING — run it after any change to `OwnerSignup.tsx`, `OnboardingWizard.tsx`, `Settings.tsx`,
> `DiscoveryGlimpse.tsx`, `BusinessProvider.tsx`, or `set_business_profile`. A per-build proof is a
> FILTER (`COVERS: #NNN`), never a second doc.

**Purpose:** `businesses` is the RLS anchor — `business_id` is what AC-2 scopes to and AC-3 makes
absolute — and this build touched **a type on the money path**, **a declaration covering seven write
paths**, and **two sites that were deliberately NOT repointed**. Every card below is `STATUS: owed`.
**The board is 0 of 4.**

**Why this exists (the two defects and the one near-miss these cards defend against):**

1. **`Business.tax_rate: number` was a PHANTOM.** The column was dropped by
   `20260727e_drop_businesses_tax_rate.sql:45`, but the interface still promised a **non-nullable
   number** — and it was **invisible to `tsc`** precisely because the loader uses `select('*')`, so
   the field simply never arrived and no type error could ever fire. **Card 4 exists because the
   removed field sits one hop from checkout.**
2. **🔴 THE NEAR-MISS IS THE REASON CARDS 1 AND 2 ARE NON-OPTIONAL.** Two sites were slated to be
   repointed through `set_business_profile`, and both were stopped by a hazard check *before any code
   was written*: **the RPC SETs all five identity columns UNCONDITIONALLY — it is not a patch API.**
   Routing `OnboardingWizard:608` would have sent `p_email=null` and **wiped the business email that
   `OwnerSignup.tsx:277` inserts at signup.** Nothing was changed at either site — **cards 1 and 2
   prove that "nothing changed" is TRUE, not assumed.**
3. **A MANAGER's refusal must be VISIBLE.** `set_business_profile` audits its denials and returns
   `(applied, reason)`; `Settings.tsx:263-267` surfaces it. Card 3 is the six-state ruling applied to
   the one gated writer on this table.

---

## HOW TO READ A CARD

| Tag | Means |
|---|---|
| `STATUS: covered` | 🟢 A test exists AND it passed on `LAST-PROVEN`. Only David sets this. |
| `STATUS: owed` | 🟡 Written but not run since the surface changed. **Not proven.** |
| `STATUS: needs-test` | 🔴 Surface exists, no test — a known hole. |
| `LAST-PROVEN: never` | Nobody has ever run this against the real UI. |
| `DEVICE:` | `phone` (capture) · `desktop` (reconcile/admin) · `either`. |
| `COVERS:` | The ledger row / gap / card this check defends. |
| `SIGNAL:` | The `[TRACE:*]` line. **Always secondary** — every PASS must be visible without a console. |

**PASS = every card in scope is `covered` with today's date.** Thunder never sets `covered` (OP-14).

---

## ⛔ GATE 0 — CONFIRM YOU ARE TESTING THE DEPLOYED CODE (OP-15 — owner-prove STEP ZERO)

> **STEP ZERO. Before you read any screen as evidence: confirm the deploy for the SHA under test is
> live.** A failed Vercel build is SILENT — it keeps serving the last-good bundle, and Vercel deploys
> the TREE not the COMMIT. If the SHA under test is not live, every observation below is fiction.

- [ ] **① SHA is live** — the `?debug=1` DebugPanel stamp matches `git log -1 --format=%h`
      (this build: **`93d8fde`**). ✏️ Already proven once mechanically at close-out: the deployed
      bundle moved `index-CpPmzeV8.js` → **`index-BiNif68G.js`** and **contains `93d8fde`**. Confirm
      it still reads that before you begin.
- [ ] **② NO MIGRATION NEEDED** — this build is app-code, a cap and a declaration. **Nothing to
      apply.** No schema change, no policy change.
- [ ] **③ cards 1, 2 and 4 are the OWNER. Card 3 is the ONE that deliberately needs a MANAGER
      session** (`df7723be`) — it cannot be proven as the owner, because the owner passes every gate.

---

## THE CARDS

### CARD 1 — the front door still reveals AND still writes back
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #190b ② — `DiscoveryGlimpse.tsx:183` was NOT repointed, deliberately
SIGNAL: `[TRACE:DISCOVERY] conflict resolved {field: …, choice: 'updated'}`

Sign up a new business (or re-run the signup vertical step) with a **website whose public details
differ from what you type** — easiest: enter a **phone or address that does not match the site**.
Let the reveal run to *done*. When the entered-vs-site conflict appears, choose **use the site's
value**. Then open **Settings → Business Profile** and look at that field.

**PASS:** the field now holds the **site** value — the write-back landed, and **only that one field
changed**. **FAIL:** the value did not change (the write was refused), **or any OTHER field on the
profile is now blank** — that second failure is the exact null-clobber this build refused to
introduce, and seeing it would mean the site was repointed after all.

### CARD 2 — signup completes and the business keeps its email, phone AND website
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #190b ② — `OnboardingWizard.tsx:608` was NOT repointed, deliberately
SIGNAL: `[TRACE:ONBOARD] address saved {businessId, hasAddress: true}`

Complete a **full signup → onboarding** run: at signup fill in **email, phone, website and address**;
in the onboarding wizard **type or edit the address** and finish to the *"is live"* screen. Then open
**Settings → Business Profile**.

**PASS:** the address is the one you typed in the wizard, **and the email, phone and website you gave
at SIGNUP are all still there.** 🔴 **FAIL — and this is the whole point of the card: the address is
right but the email, phone or website came back BLANK.** That is what routing the wizard's address
write through the five-column RPC would have caused, and it is why the site was left alone and
declared instead. **This card is a regression test for a change that was NOT made.**

### CARD 3 — a MANAGER is refused by `set_business_profile`, and the refusal is SURFACED
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the narrow writer's gate + the six-state ruling (2026-07-30) · #190
SIGNAL: an `audit_log` row `action='settings.update_denied'`, `outcome='denied'`

**MANAGER session required (`df7723be`) — this cannot be proven as the owner.** Sign in as the
manager, open **Settings → Business Profile**, change the business **name**, press **Save**.

**PASS:** the page shows an **explicit refusal naming what is needed** — the message comes from the
RPC's own `reason` (*"settings:update permission required"*), surfaced by `Settings.tsx:263-267`.
🔴 **FAIL (either direction, both are defects):** it says **"Saved"** and nothing changed — a silent
no-write, which is the E5 class this table is latent for; **or** the change actually lands, which
would mean a member UPDATE policy has appeared on `businesses` and the column-level boundary is gone.
**A refusal that is invisible is the same defect as no gate at all.**

### CARD 4 — 🔴 NON-NEGOTIABLE: checkout shows a REAL tax rate, not "Tax: not identified"
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: D2 — `Business.tax_rate` removed from the type (#190) · D-40 · ledger #153
SIGNAL: `[TRACE:TAX]` on save; the Review screen's tax line

**This card is non-negotiable because D2 touched a type on the money path.** Confirm a rate is set
(**Settings → Business Profile → Sales tax rate**, e.g. `0.0825`; it is stored in
`business_pricing_config.config->'taxRate'`, **not** on `businesses`). Then run a scan → cart →
**Review** and read the tax line.

**PASS:** Review shows a **real tax amount computed at the set rate**, and the order total matches.
**FAIL:** the redline **"Tax: not identified"** appears over a rate that IS set, or tax computes as
**$0** or at a **hardcoded 8.25%** that ignores what you entered.

✏️ **What this card is really checking, stated so a PASS means something:** the removed field had
**zero readers** — both money paths already read through the narrow `get_business_tax_rate` RPC via
the shared `fetchTaxRate` seam (`CartReview.tsx:54`) and `resolveTaxRate` (`submit.ts:280`), and both
say so in their own comments. **The sweep found no site that would change behaviour.** This card is
the live confirmation of that negative claim (STD-021) — a sweep is a reading of source, and the
money path does not get closed on a reading.

---

## WHAT THESE CARDS CANNOT PROVE — named, not left implicit

- **That seven is the total.** `verify-write-paths` reads the repo migration corpus; **a function
  created outside the migration path is invisible** (§6 r17), and the schema-snapshot checker that
  would close it is **OWED and not built**. Assume one more writer exists than was found.
- **The Q6 zero-row residual.** Six of the nine app sites do not check affected rows. That is
  **LATENT, not live** — `businesses` has no member UPDATE policy, so a non-owner UPDATE matches zero
  rows and reports success, and every member-reachable path routes through the RPC. **The day a
  manager reaches a direct update on this table, six sites go live at once.** Card 3 is the closest
  thing to a canary for it.
- **That `business_type` is safe in the database.** The new cap proves the *profile writer* cannot
  reach it. **Nothing proves no other caller can** — today it is protected by the absence of code
  that writes it, and RLS has no column-level restriction.
