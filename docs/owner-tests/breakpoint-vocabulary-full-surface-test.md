# OWNER TEST — THE BREAKPOINT VOCABULARY (`useDevice`)

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**, because
> Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> *(GATE 0 · OP-15.)*

**Capability:** 3.4 (operations calendar) · Receipt / Expense Storage — ⚠️ **that surface has no id on the 24-capability board**, flagged in `built-inventory.md` and still not minted.
**Story:** `user_stories.md` → PLATFORM STANDARD CAPABILITIES → *Device vocabulary — one detector, four axes*. Written by Thunder this pass as the **IN-CODE-NOT-ON-THE-BOARD** case (§9 story gate); the **behavioural** mobile story — Lauren running delivery day twice — is **OWED TO DAVID** and is not Thunder's to dictate.
**Surfaces:** the Operations calendar's window control · the Receipt Keeper capture screen · the dashboard tile grid.
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 1 of 7 covered** (1 `covered` · 6 `owed`). ✅ **CARD 1 — David, 2026-09-12, build `13d64aa`.**

> 🔴 **THIS PASS CHANGED ONE BEHAVIOUR ON PURPOSE, AND CARD 2 IS THAT BEHAVIOUR.**
> The Operations calendar's window control used to switch from a dropdown to arrows below **767px**.
> It now switches below **1024px**. The old number was justified in its own comment as *"the
> platform's existing desktop/tablet line (§6 r7, the tile grid)"* — **the tile grid has never used
> 768**; it breaks at 640 and 1024. Meanwhile the comment three lines above the control says
> *"Arrows are the whole interface on a phone **or the tablet in the yard**"* — and at 767 a portrait
> tablet (768–834px) got the dropdown, which is the opposite. **If you would rather keep the old
> feel, say so and it is one word to revert** (`band === 'compact'`). Nothing else in this pass
> changes what anything looks like.

> 🔴 **WHO CAN RUN WHAT, AND ON WHICH TENANT.**
> **David can run these now, on the desk browser, no SQL and no console:** CARDS 1, 2, 5, 6, 7.
> **David needs a phone in his hand (no console — these must be provable in a lot):** CARDS 3, 4.
> **Tenant: ANY, including LAWNS — this pass writes nothing.** No migration, no schema, no row.
> It changes which control is drawn, never what is stored, so there is no way to spoil live data.
> **Nothing here needs a login David does not hold.**

> **🔴 ORDER: ~~CARD 1~~ ✅ → CARD 2 (the behaviour change, a judgement call) → the rest in any order.**
> **NEXT: CARD 2.** It is the only card on this board that asks you to decide something rather than
> observe it — everything else is pass/fail.

---

### CARD 1 — the calendar control follows the WINDOW, not the machine
STATUS: covered
LAST-PROVEN: 2026-09-12 (David, build `13d64aa`)
DEVICE: desktop
COVERS: ledger #305

> ✅ **COVERED 2026-09-12 — DAVID RAN IT, on build `13d64aa`.** His words: *"Two arrows appearing as
> you drag and the dropdown returning to the range you arrowed to is the whole proof: nothing is
> reading the machine's name."* 🔴 **That is the right reading of this card, and it is worth keeping
> as the record of WHY it counts:** a desktop browser reports "desktop" at every width, so a layout
> that changes *as you drag* cannot be coming from a user-agent — and the arrowed-to range surviving
> the swap proves the two controls drive one `moveWindow`, not two states that happen to agree.

**On the desk browser, any tenant.** Open **Operations calendar**.

1. With the window **full-screen**, look at the top-right of the header, beside *Operations calendar*.
   → You should see a **dropdown** listing date ranges (*"Sep 8 – Oct 5 · this week"*).
2. Now **drag the window narrow** — roughly half the screen — and watch that same corner.
   → The dropdown is **replaced by two arrow buttons** (‹ ›). You do not need to reload.
3. **Drag it wide again.** → The dropdown comes back, and it is **sitting on the range you arrowed
   to**, not snapped back to today.

🔴 **THE POINT OF THIS CARD IS STEP 2 HAPPENING AT ALL.** The old code read the user-agent to decide
this. A desktop browser says "desktop" no matter how narrow you drag it, so the layout could not
follow the window. If the control changes as you drag, nothing is reading the machine's name.

**PASS:** the control changes while you drag, and the chosen range survives the change.
**FAIL:** the control never changes, or the range resets when it does.

---

### CARD 2 — 🔴 THE ONE DELIBERATE BEHAVIOUR CHANGE: the yard tablet gets arrows
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #305

**On the desk browser.** This card is a judgement call, not a pass/fail of correctness — **you are
deciding whether you like it**, and the answer is yours.

1. Open **Operations calendar** and make the window **about two-thirds of a 1440px screen** — wide
   enough for a tablet, not full width. (If you want it exact: anything between **768 and 1023px**.)
2. Look at the window control.
   → **NOW:** two arrows. → **BEFORE this build:** the dropdown.
3. Ask the real question: **at that width — a tablet held in the yard — which do you want?**

**PASS:** arrows appear, and you are content that a tablet-width screen navigates by arrow.
**FAIL / OVERRIDE:** you would rather a tablet kept the dropdown. Say so — it is a one-word revert
and Thunder made the change because the code's own comment promised it, not because you asked.

---

### CARD 3 — the phone still opens the camera first
STATUS: owed
LAST-PROVEN: never
DEVICE: phone
COVERS: ledger #305

**On your phone, in the browser, any tenant.** No console — this must be provable standing in a lot.

1. Open the app and go to **capture a receipt / invoice** (the Receipts tile).
2. → You should see a **big green "📷 Take Photo"** button, with *"Point at the invoice or receipt"*
   under it, and a quieter **"Choose from photos / files"** beneath that.
3. Tap **Take Photo**. → The **camera** opens, rear-facing.

🔴 **This is the card that proves the user-agent regex was safe to delete.** The old code decided
this by testing the phone's name against a list (`iPhone|iPad|Android|…`); it now decides by asking
whether a finger is doing the tapping. If you see the camera button, that swap held.

**PASS:** camera-first layout, and Take Photo opens the camera.
**FAIL:** you get a grey drag-and-drop box instead — the desk layout on a phone.

---

### CARD 4 — 🔴 the phone in LANDSCAPE, which is the case the old code needed the regex for
STATUS: owed
LAST-PROVEN: never
DEVICE: phone
COVERS: ledger #305

**On your phone.** No console.

1. Open the receipt capture screen and **turn the phone sideways.**
2. → The **"📷 Take Photo"** button is **still there.** It does not become a drop zone.

🔴 **WHY THIS CARD EXISTS.** A modern phone in landscape is about **844px** wide — wider than the
**820px** test the old code used. On that test alone a sideways phone read as a desktop, and the
only thing rescuing it was the user-agent regex. That regex is gone, so this is the case most
likely to have broken. It should now hold for a different reason: a finger still cannot hover.

**PASS:** camera-first in both orientations.
**FAIL:** rotating to landscape swaps in the desktop drop zone.

---

### CARD 5 — the desk still gets the drop zone
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #305

**On the desk browser.**

1. Open the receipt capture screen.
2. → A **grey drag-and-drop panel**: *"Tap or drop a receipt or invoice here"*, with
   *JPEG · PNG · WEBP · HEIC · PDF · Max 10MB* under it. **No camera button.**
3. **Drag a file onto it.** → It loads, exactly as before.
4. 🔴 **Now drag the window as narrow as it goes.** → It should **stay** the drop zone.

**Step 4 is the assertion.** Capture follows the *pointer*, not the width — your mouse does not
become a finger when the window gets small, and a narrow desk window has no camera to offer.

**PASS:** drop zone at every width on the desk, and drag-and-drop still works.
**FAIL:** narrowing the window swaps in a camera button that then does nothing useful.

---

### CARD 6 — the dashboard tiles are untouched
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #305

**On the desk browser, then on your phone.** This card is looking for **no change at all.**

1. Open the **dashboard** on the desk. Count the tiles across: **8 per row** on a wide screen.
2. Narrow the window until it is about half: **6 per row**. Narrower still: **4 per row**.
3. Open the same dashboard **on your phone**: **4 per row**.

The tile grid's two size changes were moved onto the shared numbers this pass. The values were
kept identical (640 and 1024), so **anything that looks different here is a mistake** — that is the
whole claim, and this card is how you catch it.

**PASS:** 4 / 6 / 8 as it always was, phone included.
**FAIL:** any column count changed, or tiles reflow at a different width than they used to.

---

### CARD 7 — nothing decides what you see by asking what device you are on
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #305

**On the desk browser.** One minute, and it is the card that proves the headline claim.

1. Open **Operations calendar**. Drag the window narrow → arrows. Wide → dropdown. (CARD 1.)
2. Open the **receipt capture** screen. Drag the window narrow → **still the drop zone.** (CARD 5.)

🔴 **Two surfaces, same window, opposite answers — and both are correct.** That is the thing that
was not possible before: one boolean was answering both questions, so a change that fixed one broke
the other. The calendar asks *"is there room?"*; capture asks *"is a finger doing this?"* They are
different questions and they now have different answers.

**PASS:** the calendar follows the window and capture does not.
**FAIL:** both change together, or neither does — the two axes have been re-merged.

---

> ⚠️ **WHAT THIS BOARD DOES NOT COVER, STATED RATHER THAN IMPLIED.**
> **The container axis is unproven and cannot be proven today.** `useContainer()` can return
> `native` (inside a wrapped app) or `installed` (an installed PWA) — **neither state has ever
> existed for this app**: there is no wrap, and no web-app manifest, so a browser will not install
> it. The seam is built so the wrap needs no refactor; **it is not evidence that the wrap will
> work**, and no card here can make it so.
> **The platform axis has no detector at all**, deliberately — see `useDevice.ts`'s header, and
> David's 2026-08-23 ruling that device targeting is **declared, not detected**. That ruling's
> build (the `TileEntry` field and its default) is still **OPEN and owed**, and this pass does not
> pre-empt it.
