# OWNER TEST — ONE SEARCH, TWO SURFACES: TYPING AT THE COUNTER AND FILTERING ON THE ROSTER

> 🔴 **GATE 0 · BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha> · <where>`.**
> If it is not the SHA you mean to test, **stop.** Match it to `git log --oneline origin/main -1` —
> **not to a SHA written in this file**, because Vercel deploys the TREE and *any* push to `main`,
> docs included, moves the stamp. *(OP-15.)*
> 🔴 **AND THE LAST TOKEN MUST READ `prod`.** *(tech-debt #280 ②.)*

**Capability:** 2.1 Cart / QR checkout · inventory roster · **Ledger:** #388 · **Ruling:** R-175
**Board: 0 of 8 covered** (8 `owed`). Thunder writes the cards and sets `owed`; **only David's live run flips a card to `covered`, with a date.**

**TENANT:** LAWNS = `ed2e5933-45dc-4b9b-a331-ddfd125e7a74`. **ACTOR:** anyone who can ring up an order.

🔴 **WHAT CHANGED AND WHY IT IS ONE BUILD, NOT TWO.** David: *"inventory already has the filter type
function, why not reuse that like we should."* Checkout had its own search that matched **`sku`** —
**populated on 1 of 632 live LAWNS rows** — while the code the grid displays lives in
`qb_item_name` on **632 of 632**. That is ledger #384's fix never reaching a second surface.
**There is now ONE matcher and both surfaces call it**, so CARDS 1–3 and CARDS 6–7 are the same
rule seen from two screens. If one passes and the other fails, the extraction did not happen.

⚠️ **THE ROSTER GAINS SOMETHING TOO.** Its old filter was a plain substring; checkout's old one had
**token-subset** matching. The shared rule keeps both, so `/inventory` can now do things it could
not do yesterday — CARD 6 is that.

---

## At the counter — `/checkout/scan`

### CARD 1 — 🔴 TYPING THE ITEM CODE FINDS THE ITEM
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David · **TENANT:** LAWNS · **COVERS:** #388 · R-175

Open a new order. The field at the top is focused. Type **`CLCC45`**.

**PASS:** *Cherry Laurel Centre Court · 45 Gallon* appears. **Before this build it returned
nothing** — the search read `sku`, which is null on that row and on 630 others.
**FAIL:** nothing matches. Then checkout is still on its own search.

### CARD 2 — 🔴 "CENTER" FINDS "CENTRE"
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David · **TENANT:** LAWNS · **COVERS:** R-175

Type **`Center Court`** — the American spelling. The catalogue says **Centre**.

**PASS:** all **five** Cherry Laurel Centre Court rows appear (7, 15, 30, 45 and 65 Gallon).
David's ruling: *"She will not adapt and should not have to."*
**FAIL:** nothing. Then the fold is not reaching the query.

### CARD 3 — WORDS IN ANY ORDER
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David · **COVERS:** R-175

Type **`creek shoal`** — deliberately backwards.

**PASS:** *Shoal Creek Vitex* appears. **FAIL:** nothing — then only substring matching survived.

### CARD 4 — 🔴 KEYBOARD ONLY, NO MOUSE, LINE AFTER LINE
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David · **COVERS:** #388

**Put your hand on the keyboard and do not touch the mouse.** Type part of an item · **↓** to move ·
**Enter** to pick · type a quantity · **Enter** to add. Then type the next item and do it again.
Add **three different items** this way.

**PASS:** three lines in the cart, and the cursor is back in the search field ready for a fourth
without you touching anything. This is the QuickBooks pattern David described: *"she starts typing,
the inventory filters, she picks, then starts typing another item, picks, again and again."*
**FAIL:** you had to reach for the mouse at any point.

### CARD 5 — 🔴 AN ITEM YOU CANNOT SELL IS SHOWN, AND SAYS WHY
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David · **TENANT:** LAWNS · **COVERS:** R-175 · D-9

Type a name that matches something with **nothing on hand** (133 of LAWNS's 632 live rows cannot be
sold right now — no stock, no price, or both).

**PASS, all three:** ① the row is **visible**, greyed, and says **`none in stock`** / **`no price
set`** / **both**; ② it cannot be picked with Enter; ③ a row you CAN sell sorts **above** it.
🔴 **Hiding it would answer "why isn't it in the list?" with silence, and a zero on hand is what
sends someone to count.**
**FAIL:** it is missing from the list, or it says only "unavailable" without which problem it is.

---

## On the roster — `/inventory`

### CARD 6 — 🔴 THE ROSTER GAINS WORDS-IN-ANY-ORDER
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David · **COVERS:** R-175

On `/inventory`, type **`creek shoal`** into the search.

**PASS:** the Shoal Creek Vitex rows appear. **This did not work yesterday** — the roster's filter
was a plain substring. It works now because both surfaces run the one rule.
**FAIL:** nothing. Then the roster kept its old matcher and there are still two searches.

### CARD 7 — AND THE ROSTER GAINS THE SPELLING FOLD
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David · **COVERS:** R-175

On `/inventory`, type **`Center Court`**.

**PASS:** the Cherry Laurel rows appear. **FAIL:** nothing.
⚠️ **CARDS 6 and 7 are the proof that this was an EXTRACTION and not a second copy.** If the
counter can do something the roster cannot, the ruling was not carried out.

---

### CARD 8 — 🔴 A SCAN STILL RESOLVES TO THE SAME ROW IT ALWAYS DID
`STATUS: owed` · `DEVICE: phone` · `LAST-PROVEN: —`
**WHO:** David · **COVERS:** R-175 — the guard, not the feature

On a phone, open a new order, press **Scan a tag instead**, and scan a plant tag you have scanned
before.

**PASS:** it resolves to **exactly the same row as it always has**.
🔴 **THIS IS THE MOST IMPORTANT CARD ON THE BOARD AND IT IS ABOUT SOMETHING NOT CHANGING.** The
spelling fold makes "Center" find "Centre" **for search only**. Scan resolution runs on
`canonicalNameKey` (D-45/D-46), which is a **money path** — it decides which catalogue row a tag
becomes. That key is untouched, and proven so three ways: the file is byte-identical to `main`,
nothing on the resolution path imports the fold, and `canonicalNameKey('… Centre Court')` still
returns `centre cherry court laurel` — **still not equal** to the Center spelling.
**FAIL:** a tag resolves to a different row, or to an ambiguity it did not used to have. **Stop and
report it** — that would mean the fold reached the resolution path.
*(Provable without a console: it is the same scan you have always done.)*
