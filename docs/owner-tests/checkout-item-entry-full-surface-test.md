# OWNER TEST — ONE SEARCH, TWO SURFACES: TYPING AT THE COUNTER AND FILTERING ON THE ROSTER

> 🔴 **GATE 0 · BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha> · <where>`.**
> If it is not the SHA you mean to test, **stop.** Match it to `git log --oneline origin/main -1` —
> **not to a SHA written in this file**, because Vercel deploys the TREE and *any* push to `main`,
> docs included, moves the stamp. *(OP-15.)*
> 🔴 **AND THE LAST TOKEN MUST READ `prod`.** *(tech-debt #280 ②.)*

**Capability:** 2.1 Cart / QR checkout · inventory roster · **Ledger:** #388 · #393 · **Rulings:** R-175 · R-176
**Board: 0 of 9 covered** (9 `owed`). Thunder writes the cards and sets `owed`; **only David's live run flips a card to `covered`, with a date.**

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

### CARD 9 — 🔴 EVERY ON-HAND NUMBER SAYS WHERE IT CAME FROM
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David · **TENANT:** LAWNS · **COVERS:** #393 · R-176

Apply `supabase/migrations/20260923m_inventory_qty_provenance.sql`, then open a new order and type
enough of a plant name to bring up a few rows.

**PASS, all three:** ① **no row shows a bare number** — each reads **`10 · placeholder`**, and the
figure is amber rather than grey; ② 🔴 **EVERY row reads `placeholder` — not one says `counted`**,
because the entire inventory has never been counted (David, 2026-09-23); ③ **placeholders are still
listed and still sellable** — they are marked, not hidden.

✏️ **THIS CARD USED TO SAY A COUNTED ROW WOULD READ `1 · counted 26 Aug`, AND THAT WAS THE DEFECT
DAVID'S RED-TEAM CAUGHT BEFORE THE MIGRATION WAS APPLIED.** There are three `inventory_counts` rows
on LAWNS and they are a **TEST**: one session (`046394fc`) that is still `status='in_progress'` with
`completed_at` NULL, run from **David's own account**, three rows in **3½ minutes**, the **same lot
counted twice 27 seconds apart**. Seeding those as `counted` would have put *"counted 26 Aug"* in
front of Lauren on a lot nobody has walked — **exactly the trust failure R-170 exists to stop.** They
now seed as placeholders whose reason names the test.

🔴 **WHY IT MATTERS MORE THAN IT LOOKS, MEASURED LIVE 2026-09-23:** **512 of LAWNS's 632 lots sit at
exactly qty 10, 120 at 0, and not one lot at any other value.** All 512 were written by a single
import run on 2026-09-21. The purchases-minus-sales derivation **has never run and has no inputs** —
**zero** purchase-kind ledger rows, and **3,924 of 3,925** order lines unlinked to a lot. **Two lots
have ever been counted.** So before this card, the number on Lauren's screen was a flat import
default that looked exactly like a measured one.

**FAIL:** a bare figure anywhere, OR a placeholder row missing from the list. 🔴 **Hiding it would be
the worse failure** — David's ruling: *"the placeholder is deliberately low — the BLOCK AT SALE IS
THE RECONCILE TRIGGER. Do not raise it, do not hide it."* Running out is the mechanism that sends
somebody to count; a hidden row cannot run out.

⚠️ **BEFORE the migration is applied, every row will read `basis unknown`.** That is correct and is
not a failure — the bundle has not been told, which is a different fact from "nobody counted it".
