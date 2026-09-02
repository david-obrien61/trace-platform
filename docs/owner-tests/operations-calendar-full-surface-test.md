# OWNER TEST — OPERATIONS CALENDAR (four weeks, day types, and the mismatch)

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> One glance. Match it to `git log --oneline origin/main -1` — **not to a SHA written in this
> file**, because Vercel deploys the TREE and *any* push to `main`, docs included, moves the
> stamp. *(GATE 0 · OP-15 · paid for twice on 2026-08-31: once hunting a defect in code that
> was never deployed, once by a pinned SHA going stale on the very next commit.)*

**Capability:** 3.4 (scheduling) · 3.5 (delivery / routing)
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 15 covered** (14 `owed` · **1 `needs-test` — CARD 4, whose precondition closed unrun when the migration was applied 2026-08-30**).
🔴 **CARDS 1 AND 9 WERE REWRITTEN 2026-08-31 AND THE REASON IS THE FINDING, NOT THE EDIT.** Both were written on 2026-08-28 against the window as it stood that day, and both had since become **impossible to run as written** — they asked the reader to look at Saturday 08-29 in a window that, three days later, starts on 08-30. **True when written, false by the passage of time, and nothing watched them.** That is [[R-26]]'s shape and [[R-29]]'s half-life: a card that names a DATE is a claim with an expiry, exactly like a line number. The dates below are now given **relative to the window**, and the absolute ones are marked with what makes them reachable.
**DEVICE: desktop** — declared per the 2026-08-23 tile-capability ruling, using this board's own `DEVICE:` vocabulary. The `TileEntry.capability` field that ruling calls for is still **OPEN** (a 33-tile backfill); this build did not mint it.

---

## ⛔ GATE 0 — DO THIS BEFORE READING ANY SCREEN (OP-15)

A failed Vercel build is **SILENT** — the last-good bundle keeps serving — and **Vercel deploys the TREE, not the COMMIT**. If the SHA under test is not live, every observation below is fiction.

1. `git log -1 --format=%h` on the branch under test.
2. Vercel dashboard: the deployment for **that exact SHA** reads **READY** (not a *different* push's Ready).
3. Open the app with `?debug=1` and confirm the **DebugPanel footer shows the same 7-char SHA**.
4. Hard-refresh.

If ①–③ do not agree, **STOP**. Do not record a pass or a fail.

✅ **GATE 0 IS MET FOR `8bbaec4` — verified mechanically 2026-08-30, no dashboard needed.** The production bundle at `cultivar-os.app` (`/assets/index-B7VA7TMb.js`) contains the literal **`"8bbaec4"`** — the merge SHA — rendered beside `built 2026-08-30T18:00:43.412Z`. That is steps ①②③ agreeing, which is exactly what tech-debt **#60**'s SHA stamp was built to make possible. **You still owe step ④, the hard-refresh**, and you should still glance at the `?debug=1` footer — if it ever disagrees with the string above, believe the footer and stop.

---

## ⛔ GATE 0b — ✅ THE MERGE IS DONE AND THE MIGRATIONS ARE APPLIED. THIS GATE IS CLOSED.

✅ **Two things had to be true before any card below could run. BOTH ARE NOW TRUE** — and the header said otherwise for three sessions while its own body said both clauses were closed. **A header is a claim (§6 r18); this one contradicted the text underneath it, which is the version of that defect nobody looks for.** Corrected 2026-09-02.

✅ **(a) MERGED — THIS CLAUSE IS CLOSED.** `feat/operations-calendar` merged to `main` as **`8bbaec4`** on 2026-08-30 and is live. The hold ran its course: Saturday 2026-08-29's seven installs were run on the old `/delivery-schedule`, and David released the hold afterwards. **The branch was never held for a technical reason.**

⚠️ **AND THE REASON THIS CLAUSE ORIGINALLY GAVE FOR "UNRUNNABLE" WAS WRONG.** It cited `TRACE-SESSION-BOOTSTRAP.md:54` — *"No per-branch previews"* — as the deploy model. **Measured 2026-08-30: previews are not absent, they are behind Vercel Deployment Protection.** A non-production hostname returns **302 → `vercel.com/sso-api`**; a hostname that does not exist returns **404 `DEPLOYMENT_NOT_FOUND`**; production returns **200 with no SSO**. Nothing in `vercel.json` disables previews. So a future build of this shape **could** have been proven before merging, and this gate said it could not. Left standing rather than rewritten, because the fix is a project setting only David can make — **correct this clause and line 54 together, once Deployment Protection is set to *Only Production*.**

✅ **(b) APPLIED 2026-08-30 — THIS CLAUSE IS CLOSED TOO.** David ran it in the SQL editor and verified from the catalog: **8 columns · RLS on · 5 policies with the shapes as written · both CHECKs plus the FK · and grants IDENTICAL to `business_inventory` with NO TRUNCATE and NO REFERENCES for `anon`** — §6 r17's hazard confirmed absent by comparing two tables in one query rather than by reading one in isolation. **Seed run the same day on LAWNS** (`ed2e5933-45dc-4b9b-a331-ddfd125e7a74`): seven pattern rows, Monday `service` · Tue/Wed `delivery_only` · Thu–Sun `delivery_placement`.

~~⚠️ **A FOLLOW-UP MIGRATION IS NOW PENDING AND IS *NOT* APPLIED:** `20260830b_business_operating_days_check_and_comments.sql`…~~ ✅ **APPLIED + VERIFIED 2026-08-30 by David** — all three constraints present, the eleven comments landed, and the negative test **refused `not_a_real_day_type` BY NAME**, which is the whole reason the CHECK was named rather than declared inline (#91's lesson: an inline CHECK gets an auto-generated name nobody can grep). Struck and dated rather than deleted — it was true when written (2026-08-30, ledger #235). ⚠️ **It was carried forward as *pending* through TWO later sessions without anyone re-checking it** — a status inherited rather than measured, which is [[R-26]]'s own shape and is why this line names who verified it and how.

⚠️ **CARDS 1–4 and 9–11 are runnable WITHOUT the migration** and are worth running first — the calendar is honest about the table being absent, and card 4 is the check that it is.

---

## CARD 1 — The four weeks render, and every week says how far away it is
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

⚠️ **REWRITTEN 2026-08-31.** The original asked for seven stops on Saturday 08-29 and a header count of 9 — both **correct on 2026-08-28 and impossible from 2026-08-30 onward**, when the home window rolled past that Saturday. The stops did not move; the window did. Saturday 08-29 is now **CARD 14's** job.

Open `/delivery-schedule` as **David (OWNER) on LAWNS**.

- Four week rows: **This week**, **Next week**, **In 2 weeks**, **In 3 weeks**. Days named Sun→Sat.
  ⚠️ The second row says **"Next week"**, not "In 1 week" — one either way is said the way a person says it.
- Today is marked **TODAY** and **only one day is**.
- The green subtitle reads **"This week and the three ahead — <first day> to <last day>"**.
- 🔴 **The header count counts what is ON THIS WINDOW, and only that.** Standing in the week of 2026-08-30 that is **1 scheduled item** (Saturday 09-12) with the words **"deliveries only"** beside it. **LAWNS has nine deliveries and eight of them are behind you** — that is not a defect, it is the window, and CARD 14 is how you reach them.
- Days before today are dimmed; days after are not.

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
STATUS: needs-test · DEVICE: desktop · LAST-PROVEN: —

🔴 **ITS WINDOW CLOSED UNRUN, AND THAT IS RECORDED RATHER THAN QUIETLY DROPPED (OP-14 clause 2).** This card tests the state the build SHIPPED in — the table absent, the calendar saying so. The migration was applied 2026-08-30 **before anyone ran it**, and `business_operating_days` is a shared table, so the precondition no longer exists on any tenant. It is not reachable again without dropping the table, which nobody should do to reach a test.

⚠️ **WHAT WAS PROVEN INSTEAD, and it is weaker on purpose — it is the DATA half, never the SCREEN half:** the migration's own pre-write verify was executed 2026-08-30 against the live database using the public anon key, and returned `business_operating_days` → **404 `PGRST205`, ABSENT**, exactly as the migration predicted, with `businesses`/`deliveries`/`business_pmi_schedule` → 200 as controls. That confirms the state existed. **It does not confirm the screen rendered honestly in it**, which is what this card was for.

**Kept, not deleted.** The `unavailable` branch is live code (`OperationsCalendar.tsx`, `TABLE_ABSENT`) and the next tenant provisioned against a database without this migration will hit it. Re-run this card there.

_Original steps, retained:_

- The **Day types** panel header reads **"not available yet"**.
- The panel says the rules **haven't been applied to the database**, and that the calendar can still show every scheduled day but **can't tell you which are the wrong kind of day**.
- Every day cell shows **"no day type"** — not a blank chip, and not a green one.
- 🔴 **Nothing is flagged, and the screen has told you why.** A silent unflagged week here would be the lie this card exists to catch.

## CARD 5 — Lauren's weekly pattern saves and renders
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

🔴 **THE SEED DOES NOT COVER THIS CARD, AND THAT IS THE WHOLE POINT OF IT.** LAWNS's seven rows were written 2026-08-30 **in the SQL editor as `postgres`, which bypasses RLS entirely** — so the `settings:update` INSERT/UPDATE policy has never been exercised, not once. **This card is covered only when a day is changed THROUGH THE UI as a member who is not the `owner_id` account.** The rows being present on screen proves the READ policy and nothing else.

**Migration applied.** As **Joel (MANAGER)** — or Lauren if her membership is not the `owner_id` row — on LAWNS, open **Day types** and change one day, then change it back:

| Monday | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---|---|---|---|---|---|
| Service / maintenance | Delivery only | Delivery only | Delivery / placement | Delivery / placement | Delivery / placement | Delivery / placement |

- Each select saves without a page reload; the panel header count climbs to **7 rules**.
- Every day cell in all four weeks now carries its type as a green chip.
- 🔴 **Saturday 08-29's seven stops are NOT flagged** — a delivery/placement Saturday is exactly what that work is. A flag here would mean the check fires on correct work, which is how a flag stops being read.

## CARD 6 — 🔴 THE MISMATCH. A conflict must be CREATED; there is none to observe
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

🔴 **Do this on Test Dave's Tree Nest (`f7ec5d67-a9ef-4cb0-b807-438d67687d1b`). NEVER on LAWNS (`ed2e5933-45dc-4b9b-a331-ddfd125e7a74`) — LAWNS has installs and this card moves a delivery.** ⚠️ **Those two UUIDs were contradicted by two other documents until 2026-08-30** — one of them labelled Test Dave's id as *LAWNS* (R-26 instance 12, ledger #235). Trust this line; both are confirmed from live data.

⚠️ **EXPECT NO FLAG ON LAWNS, AND THAT IS CORRECT BEHAVIOUR RATHER THAN A FAILURE.** With the seed applied, Saturday 2026-08-29's seven stops all sit on a `delivery_placement` day and the whole four-week window is conflict-free. **There is nothing on LAWNS for the flag to fire on — the mismatch must be CREATED on Test Dave's to be seen at all.** A clean LAWNS calendar is the flag not firing on correct work, which is card 5's assertion, not a defect.

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

⚠️ **REWRITTEN 2026-08-31 for the same reason as CARD 1** — it named Saturday 08-29, which the home window no longer reaches. Run it on **Saturday 09-12** (in the home window, one stop); its seven-stop form is **CARD 14**.

- Click **Saturday 2026-09-12** on LAWNS. **Directly below the grid** the delivery list header reads **"Saturday, Sep 12, 2026"** and **"1 stop on this day · 9 scheduled in total"**.
- Every affordance Lauren already uses is present and unmoved: **inline date edit**, **Edit customer**, **Route this day**, **Capture an invoice**, and both route buttons.
- Click the same day again to deselect: the list returns to all scheduled days and the header returns to **"Scheduled Deliveries"**.
- Click a day with nothing on it: the list reads **"Nothing scheduled on this day"** and says how many are scheduled on other days. 🔴 It must **not** show "No scheduled deliveries" or the "Snap an invoice" prompt — that is a different fact and borrowing its words is the #224 defect.
- 🔴 **The green header bar is FULL WIDTH**, edge to edge, exactly as it rendered before it moved. If it is inset by ~16px on both sides, the negative margin that cancels the container's padding did not apply.

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

## CARD 12 — 🔴 CLICK A DAY AND THE DAY IS WHAT YOU ARE LOOKING AT
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

🔴 **THIS IS THE CARD FOR DEFECT ①, AND IT IS NOT "the day view renders" — it always did.** The day view was correct and complete on 2026-08-31 and it was **at the bottom of the page, under four weeks of grid and the sources footnote**, so clicking a day appeared to do nothing but outline a cell. What is being proven is that you can **see** it.

On LAWNS, scroll to the **top** of `/delivery-schedule` so the grid fills the screen. Then click **Saturday 2026-09-12**.

- 🔴 **The page moves, and the day view is on screen without you scrolling.** If you have to scroll to find it, this card fails, and the fix did not land.
- The grid is still where it was — it did not collapse, jump or re-order. You scrolled *to* the day, the calendar did not rearrange itself around you.
- The order down the page is: the grid · the day's type control (**"Saturday Aug 30 · this day is: …"**, or whichever day) · the day's delivery list · **then** "What this calendar shows". 🔴 **The sources footnote is BELOW the day, not above it** — that inversion is the whole defect.
- Click a **different** day. The page moves again, to that day.
- Click the **same** day to deselect. The list returns to all scheduled days; nothing scrolls, because there is no longer a day to look at.

## CARD 13 — A busy cell says how busy it is, and does not print three ellipses
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

🔴 **The reported symptom was a cell reading "Josh Ph…" and the conclusion drawn from it was that the DAY VIEW was too small. It was the cell.** A ~90px cell cannot hold six names and should not try; three truncated names identify nobody, and the count is strictly more information.

Needs a day with more than one stop — **CARD 14 gets you to Saturday 2026-08-29, which has seven.**

- A day with **one** stop still prints **the customer's name**. One label fits, and knowing *who* is on an otherwise empty day is the point of the glance.
- 🔴 **Saturday 2026-08-29's cell reads "7 stops"** — a count, in a cell wide enough for the words. **Not seven ellipses, and not one name standing in for seven.**
- If some of that day's stops are planting / install jobs, the cell says so: **"7 stops · 2 planting"**, or **"7 stops · all planting"** when every one of them is. ⚠️ That sub-count is not decoration — it is the exact axis the day-type flag is about to use, and a bare "7 stops" would flatten the distinction the amber flag underneath is making.
- The icon matches the mix (sprout when any stop is a planting job, truck otherwise), and the count line is **never** truncated.
- The day view below still lists **every one of the seven by name**. The cell summarises; nothing is hidden.

## CARD 14 — 🔴 THE TEST. MOVE BACK FOUR WEEKS AND OPEN SATURDAY 29 AUGUST
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

🔴 **THIS IS THE CARD THE WHOLE BUILD EXISTS FOR, AND THE NUMBER IS THE ASSERTION.** Saturday 2026-08-29 — seven stops, six made, one rescheduled, the day David spent a week trying to reconstruct — sat **one day** outside a window that could not move, while the drill-in beneath it said *"9 scheduled in total"* and offered one of them. **Nine deliveries existed and eight were unreachable.**

On **LAWNS**, at the top of `/delivery-schedule`:

1. In the green header, the **window dropdown** (desktop) sits to the right of the title. Open it. It lists windows by date range, six back and six forward, with **"· this week"** marking the one you are on.
2. Choose the window **four weeks back** — the one ending **Aug 29**. (On a phone or tablet: press **◀** once.)
3. ✅ **The grid redraws to Aug 2 – Aug 29.** The four week rows now read **"4 weeks ago" · "3 weeks ago" · "2 weeks ago" · "Last week"**. 🔴 **None of them says "This week"** — if the top row calls itself This week, the label is anchored to the grid instead of to today, and that is a lie about where you are.
4. The green subtitle reads **"Four weeks · 4 weeks back — Aug 2 to Aug 29"**. 🔴 **It must NOT read "This week and the three ahead"** — that sentence is true of exactly one window (§6 r18).
5. Every day is dimmed and **nothing is marked TODAY** — the whole window is in the past and says so.
6. 🔴 **Saturday 2026-08-29 is the last cell in the last row, and it reads "7 stops."**
7. **Click it.** The day view comes into view (CARD 12) and its header reads **"Saturday, Aug 29, 2026"** and **"7 stops on this day"**. ✏️ **THE "· 9 scheduled in total" CLAUSE IS GONE AS OF 2026-09-01 (ledger #251) AND ITS ABSENCE IS THE CORRECT ANSWER.** The day view now asks the database for THAT DAY rather than filtering the first 200 rows in the browser, so a business-wide total is no longer something this read establishes — and the grid one line above already carries every other day's count. **A header that still printed a total would be printing this day's own number under another name.**
8. 🔴 **ALL SEVEN ARE LISTED BY NAME.** Measured live 2026-08-28: Paul Christ · Mark & Vanessa Ashcraft · Andrea & Angel Navarrette · Humberto Garza · Ariel Thiry · Sherry Cooper · Leroy & Lila Ludemann. **If you see a number other than 7, say what it is before judging anything else on this page.**
9. Every affordance still works on this past day: inline date edit, Edit customer, Route this day, Capture an invoice, both route buttons. **A past day is not a read-only day** — a stop entered on the wrong date still needs moving.

Then the other wall:

10. Move **forward** past Sep 26 (dropdown, or **▶** twice from here). The grid reaches October. The week rows read **"In 4 weeks"** and up. Nothing errors and nothing is empty-with-no-explanation — an empty future window still says **"Nothing scheduled in the next four weeks."**

---

## CARD 16 — 🔴 THE DAY VIEW ASKS FOR THE DAY. THE REGRESSION TEST FOR THE HISTORY IMPORT.
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

🔴 **RUN THIS BEFORE THE HISTORY IMPORT AND AGAIN AFTER IT. It is the same card both times, and
the point is that the answer does not change.**

Until 2026-09-01 the day view read `deliveries` with **no date bound at all** — the oldest 200 rows,
ascending — and then filtered the selected day **in the browser**. With twenty-six stops in the
table that is indistinguishable from correct. **With 564 imported past stops it is not:** every one
of them sorts before the nineteen future ones, so the 200 fill with 2025, and a client-side filter
can only ever narrow what was already fetched. **Selecting a day outside those 200 would have
returned nothing, and the screen would have said "Nothing scheduled on this day" for a day that has
stops** — absence asserted without ever being established, on the surface the fulfilment tap and the
open-order notice mount on.

1. Open `/delivery-schedule`. With **no day selected**, the green subtitle reads
   **"N deliveries — the last 30 days and everything ahead."** 🔴 **It must NOT say "N scheduled
   deliveries"** — after the import that sentence would be claiming fourteen months it is not showing.
2. 🔴 **The nineteen QuickBooks stops are all still listed, and so are Saturday 29 August's six.**
   This is the acceptance test the import's own prompt names. Count them.
3. Move back four weeks and click **Saturday 29 August** (CARD 14). **Seven stops, by name.**
4. 🔴 **Now go somewhere genuinely old.** After the import, move back to **any month in 2025 with a
   stop on the grid** and click that day. **The stops must be listed.** Before this fix they would
   not have been — and the screen would have blamed the day rather than the query.
5. Open the console (desktop, and this one step needs it): each day you select prints
   **`[TRACE:DELIVERY] list bound — {kind: 'day', date: '…'}`** with the date you clicked, and the
   unfiltered list prints **`{kind: 'window', from: '…'}`** thirty days back. 🔴 **If you ever see a
   `window` bound while a day is selected, stop** — the day is being filtered in the browser again.
6. ⚠️ **A stop with NO date must still appear** in the unfiltered list, grouped last. The window is
   built as *"undated OR on/after the floor"* precisely so a bare date floor could not silently
   drop it; if undated stops vanish, that clause has been lost.

---
## CARD 15 — One press home, and the control is where the device needs it
STATUS: owed · DEVICE: desktop + phone · LAST-PROVEN: —

⚠️ **THE ONLY CARD ON THIS BOARD THAT NEEDS A PHONE**, and it is deliberate: the placement decision was David's, not a default — *"the desktop already has dropdown navigation and does not need arrows. Arrows are for the phone and the tablet in the yard, where they are the whole interface."* One mechanism, two placements; this is the card that proves both got built.

**On the desktop:**
- Move four or more windows away in either direction. A **"This week"** button appears beside the dropdown. Press it once — you are back at Aug 30 – Sep 26, the subtitle reads **"This week and the three ahead"**, and TODAY is marked again. 🔴 **One press, from anywhere.** A reader four months out should not have to count their way back.
- At home, the **"This week" button is not shown at all** — a control that would do nothing says nothing (§6 r18).
- 🔴 **There are NO arrows on the desktop.**

**On a phone (or narrow the browser under 768px):**
- 🔴 **The dropdown is replaced by ◀ ▶ arrows** — and they are at least **48px** square, pressable with a glove on. If they are small enough to need aim, that is the finding.
- ◀ moves back a whole window, ▶ forward. Four weeks a press, no overlap and no gap: press ◀ then ▶ and you are exactly where you started.
- The **"This week"** button appears beside them when you are away from home, same rule.
- ⚠️ **Resize a desktop browser narrow and back.** The control swaps between dropdown and arrows **without losing your place** — the window you were on stays the window you are on, and the dropdown still has an option to sit on.

---

## WHAT THIS TEST DELIBERATELY DOES NOT COVER

Named rather than silently absent (OP-14 clause 2):

- **PMI on the calendar** — `STATUS: needs-test`, and the reason is that there is nothing to test: no tenant has a derivable PMI due date (`last_service_at` is null on all three schedule rows; `business_service_log` is empty platform-wide). A card asserting an empty panel would prove nothing. It is owed the day the first service is logged.
- **Graduations / uppotting and spray** — no data and no build. The seam is declared and card 10 checks the declaration; there is no behaviour to prove.
- **Recurring obligations (payroll, sales tax), crew and equipment assignment** — explicitly out of this build.
- **Phone rendering of the GRID** — `DEVICE: desktop`, declared and moved on. ⚠️ **CARD 15 is the one exception and it is narrow on purpose:** it proves the window ARROWS exist and are pressable on a phone, because that placement was a deliberate ruling. It does **not** claim the four-week grid reads well at 380px; nobody has checked, and this build did not change it.
- **That the day actually SCROLLS INTO VIEW, asserted by a machine** — `STATUS: needs-test`, and the reason is [[tech-debt #134]] verbatim: the scroll is a `useEffect` on a `ref` inside a `.tsx` component needing router, context and Supabase, and `scripts/run-tests.mjs` is esbuild → node with no DOM by design. **44 assertions were added and not one of them can see a scroll.** CARD 12 is the only proof that exists, which is exactly the gap #134 names. Stated rather than implied.
- **The placement swap at the 768px line, asserted by a machine** — same reason: `useIsNarrow` reads `matchMedia`. CARD 15's resize step is the whole check.

---

## ✅ MERGE CHECKLIST — RECONCILED 2026-08-30 (`8bbaec4`)

🔴 **Homed HERE, where David stands, not only in a protocol doc — that is OP-15's own lesson: a rule filed where the actor isn't standing is a note, and notes don't act.**

The four obligations this build deliberately deferred to the merge, and what happened to each:

1. ✅ **`CLAUDE.md` §3 HANDOFF + line 3 — WRITTEN AT THE MERGE, as planned.** The overflow entry (2026-08-29 (2), 8,884 chars) was archived **verbatim** to `docs/handoff-archive.md` first; §3 is back to three; **entries-in == entries-out** (archive 260 → 261). Line 3 is a one-line pointer, not a summary. Deferring it was the right call — main wrote three §3 entries while this branch was held, and writing a fourth on the branch would have conflicted in the one file every session loads.
2. ✅ **`docs/built-inventory.md` + `TRACE-SESSION-BOOTSTRAP.md` ⚡ ACTIVE STATUS — RECONCILED against what main gained.** Both `Last updated:` headers resolved to main's newer values and then bumped to 2026-08-30. ⚠️ **`docs/DECISIONS-INDEX.md` needed a hand-fix the conflict resolver could not give it:** this branch wrote its drift watch into the `Last updated:` **header** while main's sessions write to the `> ✅ Drift watch` **blockquote list**, so git auto-merged with no conflict and left the header asserting *2026-08-28 (2)* over content four sessions newer. Moved into the list in date order. **A clean auto-merge is not the same as a correct one.**
3. 🔴 **THE LEDGER NUMBER COLLIDED A SECOND TIME — #229 WAS ALSO TAKEN BY THE TIME THIS MERGED.** This build renumbered **#228 → #229** on 08-28 to get out of the permissions pass's way. While it was held, `main` consumed **#229, #230, #231 AND #232**. It is now **#233**, placed above #232, with all eight citations updated (bootstrap ×5 · tech-debt ×2 · built-inventory ×1 · this board ×1). ✏️ **The lesson is not "check harder" — it is that a number picked to dodge a collision is only safe until the next merge. Take the ledger number AT MERGE, not at build.**
4. ~~🔴 **THE MIGRATION IS STILL NOT APPLIED, AND MERGING DID NOT APPLY IT.**~~ ✅ **RESOLVED 2026-08-30 — `20260828_business_operating_days` IS APPLIED, catalog-verified and SEEDED for LAWNS (7 weekday rows).** Struck rather than deleted: the note was TRUE when written at the merge and the reason it was true is the point. ⚠️ ~~**A DIFFERENT migration is now pending — `20260830b`**~~ ✅ **`20260830b` IS ALSO APPLIED + VERIFIED (2026-08-30, David) — the day_type CHECK refuses an unknown value BY NAME; see GATE 0b.** Original text: See GATE 0b (b). Thunder **could not** apply it — there is no DDL credential in the build environment (`SUPABASE_PAT` absent, `SUPABASE_SERVICE_KEY` empty in all five `.env*` files, stored anon keys rejected as `Invalid API key`). ✅ **The migration's own pre-write verify WAS run** using the public anon key the live bundle ships: `business_operating_days` → **404 `PGRST205`, ABSENT**, exactly as the file predicts.

⚠️ **BOARD STATE: 0 of 11. Thunder ran none of them and marked none of them** — OP-14 (only David's live run sets `covered`), and separately they were not runnable here: no browser driver is installed, and seven of the eleven need an authenticated session as a specific role. Two checks WERE run and are recorded as evidence, not as coverage:
- **CARD 9's core assertion, audited in the source.** `filterDate` occurs in exactly six places in `DeliverySchedule.tsx` — the grouping source (`:193`), `minHeight` (`:208`), the header title (`:212`), the header subtitle (`:216-217`), and the two distinct empty states (`:236`, `:246`). **No affordance is gated on it.** Inline date edit (`:336`), Edit customer (`:367-369`), Route this day (`:276-279`), Capture an invoice (`:223`) and both route buttons remain gated on `can(...)` alone, and the route's `deliveries:read` gate is unchanged.
- **CARDS 6 and 7, rehearsed through the real `operationsCalendar` model.** One delivery moved onto a maintenance Monday produces the flag **verbatim as CARD 6 asserts it** — *"Monday is a service / maintenance day — 1 delivery scheduled"* — with the stop **still listed**, the flag **clearing** on the move back, and CARD 7's exception moving **only** that Monday (the other three read `Service / maintenance`, source `pattern`). 🔴 **This does NOT prove CARD 6 step 3 — "the save succeeds" — which is the half that IS the card.** That is an RLS write on live data and it remains owed.

**Run order now that the branch has landed:** apply the migration → GATE 0 step ④ (hard-refresh) → cards 1–4 and 9–11 → then 5–8.
