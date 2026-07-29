# CUSTOMER EDIT SURFACE — FULL-SURFACE OWNER TEST

> **Rendered board:** open `owner-tests.html` (a PURE renderer — it parses this file live and holds
> no data of its own). Sibling of `stories.html` / `status.html`.
>
> **This file is the ONLY source of truth for the customer edit-surface owner-tests.** It is STANDING —
> run it after any change to `CustomerPartyEditor`, `CustomerEditModal`, `customerEdit.ts`, or the
> `/customers` roster's inline cells. A per-build proof is a FILTER (`COVERS: #NNN`), never a second doc.

**Purpose:** prove the customer form actually WRITES what it says it writes. Every card below is a
`STATUS: owed` — the whole board is 0 of 7.

**Why this exists (the defect these cards defend against):** `CustomerPartyEditor` compared each
edited field against `draft` — the ON-SCREEN working copy that `input()` had already updated on every
keystroke. The unchanged-check therefore asked *"does what I typed equal what I typed?"*, answered
yes, and returned without writing. **Every plain text field in the one customer form silently wrote
nothing in edit mode, while the footer read "Changes save automatically as you edit."** Separately,
the Tax group alone required a "Save exemption" button that the same footer told the owner did not
exist — a certificate number typed there was lost on close. Cards 1–4 are the live proofs of the
write; cards 5–7 prove the rules that survived the change.

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

- [ ] **① SHA is live** — the `?debug=1` DebugPanel stamp matches `git log -1 --format=%h`.
- [ ] **② no migration needed** — this build is app-code only. Nothing to apply.
- [ ] **③ you are the OWNER for cards 1–6.** `customers` RLS is owner-only FOR ALL; a non-owner
      cannot write it at all. Card 7 is the one that deliberately uses a non-owner session.

---

## THE CARDS

### CARD 1 — a text edit actually persists (the defect, head-on)
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the commitText working-copy defect (2026-07-29)
SIGNAL: `[TRACE:customers] edit {field: 'email', from: …, to: …}`

Open `/customers` → **Edit** on any customer → change **Email** to something new → click outside the
field (blur) → **close the dialog** → **reload the page** → re-open the same customer.
**PASS:** the new email is there. **FAIL (the old behaviour):** the old email is back.
Reload is the whole point — before the fix the value stayed on screen and was never written, so
*not* reloading is exactly how this hid.

### CARD 2 — the same, on a field in every other group
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the commitText working-copy defect — group coverage

Repeat card 1's edit-blur-close-**reload** loop once per group: **Identity** (Display name) ·
**Contact** (Phone) · **Billing address** (City) · **Commercial terms** (Payment terms) ·
**Status** (Notes). **PASS:** all five survive the reload. One group failing means the fix reached
some paths and not others.

### CARD 3 — the Tax group commits with no button (the fold)
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the tax-group commit-model fold (2026-07-29)

Edit a customer → tick **Tax-exempt customer** → set a **Reason** → type a **Certificate #** → set
**Cert expires** → **do not look for a Save button, there isn't one** → close → reload → re-open.
**PASS:** exemption, reason, certificate number and expiry are all there. **This is the card that
proves the lost-certificate defect is dead** — the number used to require a "Save exemption" press
the footer copy said was unnecessary.

### CARD 4 — the roster reflects it without a manual refresh
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the `onSaved()` reload path

With the editor open over the roster, change the **Tax** state → close the dialog.
**PASS:** the roster's **Tax** column already reads the new state — no page refresh.

### CARD 5 — NEGATIVE: exempt without a reason is REFUSED, and says so
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: D-40 (never zero tax without a recorded reason) — survives the fold
SIGNAL: no `[TRACE:customers] edit` line is emitted

Edit a customer → tick **Tax-exempt** → set Reason to **Other** → leave the free-text box **empty** →
click outside it. **PASS:** the inline message *"A reason is required to make a customer tax-exempt"*
appears **and nothing is written** — close, reload, re-open: the customer is still **Taxable**.
**FAIL:** the customer comes back exempt with a blank reason. This is the rule the removed button
used to carry; it now lives in `commitExemption` and must still hold.

### CARD 6 — NEGATIVE: first name cannot be blanked, and the screen tells the truth
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: first_name is identity (`coerceCustomerField`) + D-9 (screen never shows what the DB lacks)

Edit a customer → clear **First name** entirely → click outside the field.
**PASS:** the field **snaps back** to the stored name immediately. **FAIL:** the box stays empty —
that is the screen showing a value the database does not have, which is the defect one layer over.

### CARD 7 — 🔴 NEGATIVE, the OPEN one: a save that cannot write must not say it saved
STATUS: needs-test
LAST-PROVEN: never
DEVICE: desktop
COVERS: ui-control-standards E5 · STD-023 · tech-debt #74's class

**REASON THIS IS `needs-test` AND NOT `owed`: the behaviour it checks is NOT FIXED.** No write on
this record checks affected rows, and a PostgREST UPDATE matching zero rows returns **no error** — so
a save by a caller the RLS policy refuses reports success and writes nothing. Today `customers` is
owner-only FOR ALL, so an owner always matches and this cannot be triggered through the UI; it is
**latent, not live**. It goes live the moment a non-owner is given a write path. Recorded now so the
hole is counted rather than discovered later. **Write the check when E5 is built, not before.**

---

## WHAT THIS BOARD DOES NOT COVER (stated, not silent)

- **`CustomerEditModal`** (the 8-field editor mounted from `DeliverySchedule`) is a SECOND edit
  surface over the same record — a live E1 violation. It was **not changed** by this build and has
  **no cards here**. It never had the working-copy defect (it keeps `draft` persisted and `form`
  working, which is how the defect was diagnosed). Cards arrive when the merge does.
- **The roster inline cells** (Tier, Status) write immediately and correctly today; no card.
- **Create mode** ("Add Customer") buffers to one INSERT and was not the defect; no card.
