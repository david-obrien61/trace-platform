# OWNER TEST — THE CONTACT RECORD (`customer_phones` · `customer_emails` · `customer_addresses.kind`)

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha> · <where>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**, because
> Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> 🔴 **AND THE LAST TOKEN MUST READ `prod`.** Anything else is **not production**, and the SHA being
> right does not rescue it: an amber **`PREVIEW <branch>`** chip, an amber **`prod⚠ <branch>`**
> (production, but built from a branch), **`env?`** (target unknown), or **`local`**. **A preview
> serves the RIGHT CODE at the WRONG TARGET — the stamp's SHA matches and the screen is still not
> evidence.** That is tech-debt **#280 ②**, and ledger **#303** was recorded complete on
> preview-only deploys. **If the chip is amber, stop.** *(ledger #321.)*

**Capability:** 3.7 (customers)
**Ruling:** **David, 2026-09-22** — *"the sort is on LAST NAME… use the contacts-app standard: PEOPLE with a last name file under the SURNAME, shown with the surname in bold so the eye sees why; ORGANISATIONS file under their name (ignore a leading 'The'); ONE-NAME people file under that name; numbers/symbols under #."* And: *"the list GROUPED like contacts — A–Z SECTION HEADINGS within one scroll, and a letter index that JUMPS."*
**Story:** ⚠️ **NO MATCH — a story is OWED to David.** The roster's ordering has never been on the board; it arrived as a defect report ("2 of 2005 shown", #377) and then as this ruling. A story flip is David's, not Thunder's.
**Surfaces:** the `/customers` roster grid — its default order, the Name column, the A–Z section headings and the letter index. The shared `DataSheet` engine gains one OPT-IN prop; no other screen changes.

> 🔴 **NOTHING ON THIS BOARD HAS BEEN RUN. THE BUILD IS HELD ON `feat/customer-list-az`.**
> Every card below is `owed`. Thunder never marks a card `covered` — only David's live run does.

> ⚠️ **THIS BUILD TOUCHED NO DATABASE.** No migration, no schema, no policy. It changes how 2,005
> rows that already exist are ORDERED and GROUPED on one screen.

---

### CARD 1 — the roster opens in filing order, not newest-first
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #378

Open **/customers**. Do not touch any control.

**PASS:** the first rows on screen are surnames beginning with **A**, and an **A** heading sits above
them. The old behaviour put the most recently imported customer first — with LAWNS's reload that
was an arbitrary row, because 500 customers share one timestamp.

**PASS:** the header pill still reads **`2005 of 2005 customers`**. Grouping is not filtering, and
the count must not drop.

---

### CARD 2 — 🔴 THE SURNAME IS BOLD, AND THAT IS HOW YOU CHECK THE SORT IS RIGHT
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #378

Still on **/customers**, read any three rows in the Name column.

**PASS:** in each row the word the list is filed by is **bold** — e.g. *Jim & Virginia **Patskowski***
sits under **P** with `Patskowski` bold; *Barb & Mark **Gleinser*** under **G**.

**PASS:** a business reads the other way — ***A.J.** Landscaping* under **A**, ***The** **Tree Place***
under **T** with "The" shown but not bold.

🔴 **THIS IS THE CARD THAT MATTERS MOST.** The bold word is the reason a surname sort is legible at
all. If a row sits under a letter that is not its bold word, the filing rule and the sort have
drifted apart and the list will read as broken — that is exactly the complaint this build answers.

---

### CARD 3 — the letter index jumps
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #378

Press **M** in the A–Z strip above the grid.

**PASS:** the list SCROLLS so the **M** heading is at the top of the grid's scroll box — the rows
above it are still there if you scroll back up. Nothing is removed and the pill still reads
`2005 of 2005 customers`.

**PASS:** a letter nobody uses (try **X** or **Q**) is **greyed and does not respond**. Hover it and
it says *"No customers under X"*.

---

### CARD 4 — the index still works after you sort another way
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #378

Click the **Added** column header to sort by date. Then press **R** in the strip.

**PASS:** while sorted by Added, the A–Z headings **disappear** and the strip shows the note
*"sorted another way — a letter returns to A–Z order"*.

**PASS:** pressing **R** puts the list back in filing order, brings the headings back, and jumps to
**R**.

🔴 **WHY THE HEADINGS VANISH RATHER THAN STAYING:** a heading claims everything beneath it starts
with that letter. Sorted by date that claim is false, and a heading that lies is worse than none.

---

### CARD 5 — search and the sections together
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #378

Type **highland** in the search box.

**PASS:** the list narrows, the pill reads **`N of 2005 shown`** (the word *shown*, not *customers*),
and any headings still on screen have rows under them.

**PASS:** most letters in the strip are now **greyed**, because those letters have nothing left to
jump to. Clear the search and they come back.

---

### CARD 6 — 🔴 THE OTHER SEVEN GRIDS ARE UNCHANGED
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #378

Open **/inventory**, then **/assets**.

**PASS:** neither screen has an A–Z strip and neither has section headings. They look exactly as
they did.

**PASS:** on **/inventory**, pick a value in the **second** dropdown (the "needs a look" filter) and
read the header pill: it says **`N of 647 shown`**. 🔴 **BEFORE THIS BUILD IT SAID `N of 647 items`**
— the population sentence, while a filter was active. That one-word change is a real defect fixed
in passing, and this is the only place you can see it.
