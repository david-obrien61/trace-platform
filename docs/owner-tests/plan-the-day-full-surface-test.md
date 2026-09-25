# PLAN THE DAY — FULL-SURFACE OWNER TEST

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha> · <where>`.**
> If it is not the SHA you mean to test, **stop.** Match it to `git log --oneline origin/main -1`,
> and the last token must read `prod`.

> **Rendered board:** open `owner-tests.html`. **This file is the ONLY source of truth for the
> crew-split owner tests.** STANDING — run it after any change to `planTheDay.ts`,
> `planDayRead.ts`, `PlanTheDayPanel.tsx`, `loadStopInput.ts` or `gallonsForStop`.

**Purpose:** prove TRACE can propose who goes out, **show its working**, and then get out of the
way. Two cards matter more than the rest: **CARD 4** (a stop nobody can place is listed, never
quietly given to a crew) and **CARD 7** (the numbers you accept are the numbers you were shown).

**Board: 0 of 9 covered** (0 `covered` · 9 `owed`).
🔴 **Thunder never sets `covered` (OP-14).** These flip only on David's live run.

⚠️ **Run this on a day with real stops — Saturday 2026-09-26 has six.**

---

### CARD 1 — the button is where you already stand
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David's PLAN THE DAY prompt

Delivery schedule, on a day with stops.

**PASS:** **Plan the day** sits in the day's header beside **Crew link** and **Route this day**.
Pressing it opens a panel under the header; pressing again hides it.
**FAIL:** you had to go somewhere else to find it.

---

### CARD 2 — it shows its working, and names which figures it used
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: "show the working" · the morning file's D5

Read the line under the headline.

**PASS:** it names the **day limit in hours**, the **minutes per gallon**, and says the drive time
is a **straight-line estimate**. If the day limit is the platform default it says so in those
words — *"the platform default; there is no Settings field for this yet, so it is NOT your 7."*
**FAIL:** a plan with no figures shown, or one that calls 8 hours "your setting".

*As at 2026-09-25 there is no Settings input for the 7-hour day, so this WILL say 8 and say why.
That is the honest state, not a defect in this panel.*

---

### CARD 3 — one crew for a light day, two when it goes over
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: "one crew until over, then two"

Open the plan on a light day, then on a heavy one (Saturday).

**PASS:** the light day reads **"One crew can do this day"** with one column. The heavy day
proposes **two columns**, each with its own hours, drive, planting, stops and trees.
**FAIL:** always one, or always two.

---

### CARD 4 — 🔴 A STOP NOBODY CAN PLACE IS LISTED, NEVER PLANNED
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: "unplaceable stops shown, never guessed"

On a day that includes a customer whose address has not been located (there are ~1,282 such
customers today, so this is easy to find).

**PASS:** an amber block beneath the crews naming each such stop **and the reason** — *"this
customer's address hasn't been located yet"*, or *"this customer has 2 located addresses and none
matches this stop's street"*. It is **not** in either crew's column.
**FAIL:** it appears in a crew, or it vanishes without being mentioned.

*The second reason is the one to look for: a contractor with several job sites is refused rather
than given one of their other pins. A plan built on the wrong pin looks perfectly reasonable,
which is the worst shape of wrong there is.*

---

### CARD 5 — moving a stop re-balances both crews
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: "Lauren accepts, moves a stop (totals re-balance), or overrides"

On a two-crew proposal, press **→ crew 2** on one of crew 1's stops.

**PASS:** the stop moves columns AND **both crews' hours change** — crew 1 down, crew 2 up,
including the drive time, not just the planting.
**FAIL:** the stop moves but the totals do not, or only the planting minutes change.

*The drive time must change too: the totals are recomputed by the same function that made the
proposal, not by adding and subtracting the moved stop's minutes.*

---

### CARD 6 — Start over puts it back
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the override path

After moving two or three stops, press **Start over**.

**PASS:** the columns return to what TRACE proposed, and it says so.
**FAIL:** it clears everything, or nothing happens.

---

### CARD 7 — 🔴 ACCEPT WRITES WHAT YOU WERE SHOWN
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: "ACCEPT writes crew assignment" · §1.6 item 10

Pick a crew for each column, move at least one stop first, then **Accept this plan**.

**PASS:** it confirms *"N stops → Team 1; M stops → Team 2"* matching **exactly** what the columns
showed after your move. Close the panel — the schedule now shows those stops under those teams,
and each stop's own crew dropdown agrees.
**FAIL:** any stop lands with a crew other than the column it was in.

---

### CARD 8 — it refuses to accept a column with no crew
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: a plan has to say WHO

Leave one column's **Who goes out** unchosen and press Accept.

**PASS:** it refuses in words — *"Pick a crew for column N first — a plan has to say WHO goes
out"* — and **nothing is written** (check the schedule).
**FAIL:** it saves the other column silently, or saves nothing without saying why.

---

### CARD 9 — a member without delivery edit rights can look, not accept
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: §1.6 item 4 (permission-gated, enforced server-side)

Sign in as a member who has `deliveries:read` but not `deliveries:update`.

**PASS:** the **Plan the day** button does not appear at all; and if they reach the panel another
way, **Accept this plan** is disabled with a line saying assigning crews needs delivery edit
rights.
**FAIL:** they can accept. *(The writer refuses server-side too, so a failure here is a UI leak
rather than a data breach — but it is still a control that lies about what it can do.)*

⚠️ **NEEDS A SECOND LOGIN.** David holds owner; this card cannot be run from his account.
