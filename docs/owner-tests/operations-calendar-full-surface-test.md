# OWNER TEST — OPERATIONS CALENDAR (four weeks, day types, and the mismatch)

**Capability:** 3.4 (scheduling) · 3.5 (delivery / routing)
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 11 covered.**
**DEVICE: desktop** — declared per the 2026-08-23 tile-capability ruling, using this board's own `DEVICE:` vocabulary. The `TileEntry.capability` field that ruling calls for is still **OPEN** (a 33-tile backfill); this build did not mint it.

---

## ⛔ GATE 0 — DO THIS BEFORE READING ANY SCREEN (OP-15)

A failed Vercel build is **SILENT** — the last-good bundle keeps serving — and **Vercel deploys the TREE, not the COMMIT**. If the SHA under test is not live, every observation below is fiction.

1. `git log -1 --format=%h` on the branch under test.
2. Vercel dashboard: the deployment for **that exact SHA** reads **READY** (not a *different* push's Ready).
3. Open the app with `?debug=1` and confirm the **DebugPanel footer shows the same 7-char SHA**.
4. Hard-refresh.

If ①–③ do not agree, **STOP**. Do not record a pass or a fail.

---

## ⛔ GATE 0b — THIS BUILD IS ON A BRANCH, AND THE MIGRATION IS NOT APPLIED

🔴 **Two things must be true before ANY card below can be run, and neither is true as this is written.**

**(a) THE BRANCH IS NOT MERGED — deliberately — AND THERE IS NO WAY TO TEST IT UNMERGED.** `feat/operations-calendar` replaces `/delivery-schedule`, which is the screen Lauren runs **Saturday 2026-08-29's seven installs** from. **Merge after Saturday.**

🔴 **AND THIS PROJECT HAS NO PER-BRANCH PREVIEWS.** `TRACE-SESSION-BOOTSTRAP.md:54` states it plainly: *"Deploy = merge to `main` → Vercel auto-deploys from main. No per-branch previews — to test a branch, merge it first."* So **every card below is unrunnable until the merge** — there is no preview URL to run them against. That is not a gap in this test, it is the deploy model, and it means the sequence is fixed: **Saturday's installs happen → merge → GATE 0 confirms the SHA → then the cards.** If David would rather prove it before merging, the prerequisite is **turning on Vercel preview deployments for this branch** — a project-settings change, and his call, not something this build can assume.

**(b) `20260828_business_operating_days.sql` IS GATED / UNAPPLIED.** Apply it in the Supabase SQL editor — **not the table editor** (§6 r17: the table editor's `supabase_admin` default ACL grants TRUNCATE + REFERENCES to `anon`, and RLS cannot filter TRUNCATE). Then run the catalog verification at the foot of the migration: 8 columns, 5 policies, `relrowsecurity = t`, and no TRUNCATE/REFERENCES for `anon`.

⚠️ **CARDS 1–4 and 9–11 are runnable WITHOUT the migration** and are worth running first — the calendar is honest about the table being absent, and card 4 is the check that it is.

---

## CARD 1 — The four weeks render, and Saturday shows every stop
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

Open `/delivery-schedule` as **David (OWNER) on LAWNS**.

- Four week rows: **This week**, **In 1 week**, **In 2 weeks**, **In 3 weeks**. Days named Sun→Sat.
- Today is marked **TODAY** and only one day is.
- 🔴 **Saturday 2026-08-29 shows SEVEN stops.** Measured live 2026-08-28: Paul Christ · Mark & Vanessa Ashcraft · Andrea & Angel Navarrette · Humberto Garza · Ariel Thiry · Sherry Cooper · Leroy & Lila Ludemann. **If you see a number other than 7, that is the finding — say what it is before judging anything else on this page.**
- Wednesday 08-26 shows one stop; Saturday 09-12 shows one.
- The header count reads **9 scheduled items** and the words **"deliveries only"** beside it.

## CARD 2 — An empty week reads as empty, not as a blank screen
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

Same screen. Weeks 2 and 3 (09-06 onward, apart from 09-12) hold nothing.

- Those days render as **empty cells inside a drawn grid** — not missing, not collapsed, not a spinner.
- On a tenant with nothing at all in four weeks (**Test David's new Business** — both its deliveries are in June), the header reads **"Nothing scheduled in the next four weeks."** That is a sentence, not a zero and not an error.

## CARD 3 — A read failure is distinguishable from an empty calendar
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

DevTools → Network → block requests to `/rest/v1/deliveries`, reload.

- The page shows **"The schedule could not be read"** in red with the reason, and the line **"This is a failure, not an empty four weeks."**
- It does **not** show "Nothing scheduled". These are different facts and must not share words.

## CARD 4 — Before the migration, the calendar says day types aren't available — it does not say the week is clean
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

**Run this BEFORE applying the migration.** This is the state the build ships in.

- The **Day types** panel header reads **"not available yet"**.
- The panel says the rules **haven't been applied to the database**, and that the calendar can still show every scheduled day but **can't tell you which are the wrong kind of day**.
- Every day cell shows **"no day type"** — not a blank chip, and not a green one.
- 🔴 **Nothing is flagged, and the screen has told you why.** A silent unflagged week here would be the lie this card exists to catch.

## CARD 5 — Lauren's weekly pattern saves and renders
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

**Migration applied.** As **Lauren (OWNER)** or **Joel (MANAGER)** on LAWNS, open **Day types** and set:

| Monday | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---|---|---|---|---|---|
| Service / maintenance | Delivery only | Delivery only | Delivery / placement | Delivery / placement | Delivery / placement | Delivery / placement |

- Each select saves without a page reload; the panel header count climbs to **7 rules**.
- Every day cell in all four weeks now carries its type as a green chip.
- 🔴 **Saturday 08-29's seven stops are NOT flagged** — a delivery/placement Saturday is exactly what that work is. A flag here would mean the check fires on correct work, which is how a flag stops being read.

## CARD 6 — 🔴 THE MISMATCH. A conflict must be CREATED; there is none to observe
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

🔴 **Do this on Test Dave's Tree Nest. NEVER on LAWNS — LAWNS has installs and this card moves a delivery.**

There is **no naturally occurring conflict in the current four weeks on any tenant** — measured 2026-08-28. Test Dave's three real maintenance-Monday conflicts (2026-06-29, 07-13, 07-20) are all in the past and outside the window. So the flag has to be given something to fire on:

1. Set Test Dave's weekly pattern with **Monday = Service / maintenance**.
2. In the day drill-in, take the **2026-09-04** delivery and edit its date to **Monday 2026-09-07**.
3. ✅ **THE SAVE SUCCEEDS.** The delivery moves. Nothing is refused, nothing is rolled back.
4. ✅ **The Monday cell turns red-bordered** and carries an amber flag reading **"Monday is a service / maintenance day — 1 delivery scheduled"**.
5. ✅ The stop is **still listed in the cell** and still opens in the drill-in below. Flagged, never hidden.
6. **Move it back to 2026-09-04.** The flag clears.

🔴 **Step 3 is the card.** If the save is ever refused, blocked, or reverted, that is a defect against the ruling this build was written under — the schedule advises, the owner decides.

## CARD 7 — A single day can be overridden without moving the pattern
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

On **Test Dave's**, with Monday = Service / maintenance:

1. Click a Monday. In the selected-day panel, set **this day is: Delivery / placement**.
2. That Monday's chip reads **"Delivery / placement · override"**, and any conflict on it clears.
3. 🔴 **Every OTHER Monday in the four weeks still reads Service / maintenance.** This is the whole reason exceptions exist; if the other Mondays moved, the exception wrote to the pattern.
4. Set it back to **Follow the weekly pattern**. The chip returns to Service / maintenance.

## CARD 8 — Staff can read the calendar and cannot change the rules
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

Sign in as the **real STAFF member on Test Dave's** (`39691f0b`, 10 permissions — holds `deliveries:read`, does **not** hold `settings:update`).

- The calendar renders: the grid, the stops, the day-type chips, and the flags. Staff see what kind of day it is — that is the read rule.
- The **Day types** panel opens and shows **"Changing day types"** as not permitted, naming `settings:update`.
- Every select is **disabled**. There is no control that looks editable and refuses on click.
- 🔴 **Then prove the server, not the UI:** in the console, attempt the write directly —
  `await supabase.from('business_operating_days').insert({business_id:'f7ec5d67-a9ef-4cb0-b807-438d67687d1b',weekday:1,day_type:'closed'}).select('id')`
  It must be **refused by RLS**, not merely hidden. A disabled select is a courtesy; the policy is the control.

## CARD 9 — The day drill-in is the same list, filtered — not a second delivery list
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

- Click Saturday 08-29 on LAWNS. Below the grid the delivery list header reads **"Saturday, Aug 29, 2026"** and **"7 stops on this day · 9 scheduled in total"**.
- Every affordance Lauren already uses is present and unmoved: **inline date edit**, **Edit customer**, **Route this day**, **Capture an invoice**.
- Click the same day again to deselect: the list returns to all scheduled days and the header returns to **"Scheduled Deliveries"**.
- Click a day with nothing on it: the list reads **"Nothing scheduled on this day"** and says how many are scheduled on other days. 🔴 It must **not** show "No scheduled deliveries" or the "Snap an invoice" prompt — that is a different fact and borrowing its words is the #224 defect.

## CARD 10 — The screen states what it cannot see
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

Scroll to **"What this calendar shows"**.

- Five rows: Deliveries (live) · Planting/install (an attribute of a delivery, not its own source) · Equipment maintenance (no dated data, and it says why) · Uppotting/graduation (no dated table, and that it is a **window**, not a day) · Spray (nothing anywhere).
- The footnote names that counter-scheduled deliveries without a delivery record are **not shown** (tech-debt #108), and that payroll, sales tax, and crew/equipment assignment are **not in this screen at all**.
- 🔴 **This is the card that keeps the build honest.** If a source's state ever disagrees with reality, this footnote is where it will be visible first.

## CARD 11 — No other tenant's behaviour moved
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

- **Test David's new Business** (`06065fe7`): four empty weeks, "Nothing scheduled in the next four weeks", no flags, no rules.
- Day types set on one tenant appear on **no other** tenant. Set Monday = Closed on Test Dave's and confirm LAWNS still reads Service / maintenance (or "no day type" if unset).
- LAWNS' nine deliveries are **unchanged in number, date and status** after every card above.

---

## WHAT THIS TEST DELIBERATELY DOES NOT COVER

Named rather than silently absent (OP-14 clause 2):

- **PMI on the calendar** — `STATUS: needs-test`, and the reason is that there is nothing to test: no tenant has a derivable PMI due date (`last_service_at` is null on all three schedule rows; `business_service_log` is empty platform-wide). A card asserting an empty panel would prove nothing. It is owed the day the first service is logged.
- **Graduations / uppotting and spray** — no data and no build. The seam is declared and card 10 checks the declaration; there is no behaviour to prove.
- **Recurring obligations (payroll, sales tax), crew and equipment assignment** — explicitly out of this build.
- **Phone rendering** — `DEVICE: desktop`, declared and moved on.

---

## ⛔ MERGE CHECKLIST — what is deliberately UNDONE until this branch lands

🔴 **Homed HERE, where David stands, not only in a protocol doc — that is OP-15's own lesson: a rule filed where the actor isn't standing is a note, and notes don't act.**

This build is BUILDER-COMPLETE on a branch that does not merge until after **Saturday 2026-08-29**. Three close-out obligations were therefore **deferred on purpose, not forgotten**, because each one describes the state of `main` and a second session (the permissions pass) was writing the same sections the same evening:

1. **`CLAUDE.md` §3 HANDOFF + line 3.** No entry was written. §3 holds the **narrative of the last three sessions on main** and its retention rule is arithmetic (`entries-in == entries-out`, N=3) — writing entry #1 on a branch while another session writes entry #1 on main would break that arithmetic and guarantee a conflict in the file every session loads. **Write the §3 entry at merge**, archiving the overflow verbatim first. The build's full record is already in `docs/CLOSE-OUT-LEDGER.md` #229, which is the system of record; §3 never was.
2. **`docs/built-inventory.md` + `TRACE-SESSION-BOOTSTRAP.md` ⚡ ACTIVE STATUS.** Both **were** updated on this branch. **Reconcile them at merge** against whatever main has gained meanwhile — in particular the `Last updated:` line, which both this branch and the concurrent session set to 2026-08-28.
3. 🔴 **THE LEDGER NUMBER COLLIDED AND WAS ALREADY CORRECTED — CHECK IT SURVIVED THE MERGE.** Both this build and the concurrent permissions pass took **#228** on the same evening; the permissions pass committed to `main` first (`78bf37f`), so **this build renumbered itself to #229** rather than leaving two rows wearing one number. This branch's `CLOSE-OUT-LEDGER.md` was cut from `main` **before** #228 existed, so the merge will want #229 placed **above** #228. Two builds silently sharing a ledger number is exactly the kind of thing that makes a record unbelievable later.
4. **The migration.** `20260828_business_operating_days.sql` is GATED. Merging the branch does **not** apply it. See GATE 0b.

**Merge order that keeps Saturday safe:** Saturday's seven installs happen on the current `/delivery-schedule` → merge → apply the migration → GATE 0 → cards 1–11.
