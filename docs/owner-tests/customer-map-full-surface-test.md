# THE MAP — FULL-SURFACE OWNER TEST

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha> · <where>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**.
> 🔴 **AND THE LAST TOKEN MUST READ `prod`.**

> 🔴 **GATE 0b — THE MAP KEY.** Every card on this board needs the browser map key to allow this
> web address. As at 2026-09-25 it is locked to `cultivar-os.vercel.app` while production serves
> from `cultivar-os.app`, so **Google refuses every map on every screen**. If card 1 shows the
> amber "The map isn't showing" block, that is this — fix the key first, then come back. **Cards
> 5–9 can be run WITHOUT the map**, because the lists do not depend on it.

> **Rendered board:** open `owner-tests.html` (a PURE renderer — it parses this file live).
>
> **This file is the ONLY source of truth for the Map page's owner tests.** It is STANDING — run
> it after any change to `CustomerMap.tsx`, `mapLayers.ts`, `locatedCustomers.ts`, `stopPoints.ts`
> or `loadGoogleMaps.ts`.

**Purpose:** prove the map is a **lens** and never a dependency, and that it is honest about what
it cannot show. The single most important card is **CARD 2**: the count of customers who are NOT
on the map. Everything else on this page is a picture, and a picture that quietly omits 86% of the
customer book invites exactly one wrong conclusion — *"nobody lives out that way."*

**Board: 0 of 11 covered** (0 `covered` · 11 `owed`).
🔴 **Thunder never sets `covered` (OP-14).** These flip only on David's live run.

---

## HOW TO READ A CARD

| Tag | Means |
|---|---|
| `STATUS: covered` | 🟢 A test exists AND it passed on `LAST-PROVEN`. Only David sets this. |
| `STATUS: owed` | 🟡 Written but not run since the surface changed. **Not proven.** |
| `DEVICE:` | `phone` (capture) · `desktop` (reconcile/admin) · `either`. |
| `COVERS:` | The ledger row / ruling this check defends. |

---

### CARD 1 — the Map is in the menu, and it opens
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David 2026-09-25 ("the map should be its own page")

Open the menu. Under **Delivery**, beside Route and Load list, there is **Map**.

**PASS:** it is in the menu (not a URL you had to know), it opens, and you get either a map
centred on your yard **or** an amber block that names what is wrong.
**FAIL:** it is not in the menu; or the page shows a blank pale rectangle with no words in it.

---

### CARD 2 — 🔴 THE PAGE SAYS HOW MANY CUSTOMERS IT IS NOT SHOWING
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the unlocated count · tech-debt #186's class

On the Map page, read the line **above** the map.

**PASS:** something like **"208 of 1,497 customer addresses are on this map"**, followed by how
many have never been located and how many Google could not find, and the sentence that the
missing ones are not shown anywhere.
**FAIL:** no such line; or dots with no count at all.

*Why this is the most important card on the board: with 208 of 1,497 located, a map that just drew
the dots would look like a small customer book instead of an unfinished job. Every conclusion you
would draw from it — where your customers are, which ring is busy, who is near a route — would be
drawn from one address in seven, with nothing on screen to tell you so.*

---

### CARD 3 — customers who bought in the last 6 months show as dots
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David 2026-08-24 (the date filter) · 2026-09-25

Customers layer on. Set **Bought** to **Last 6 months**.

**PASS:** green dots on the map, and the layer's label reads **Customers (N)** with N matching
roughly what you would expect for six months.
**FAIL:** no dots at all while card 2 says addresses are located.

---

### CARD 4 — switch to 2 years and there are MORE dots
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David 2026-09-25 (the four presets)

Change **Bought** to **Last 2 years**.

**PASS:** the count in **Customers (N)** goes **up**, and more dots appear.
**FAIL:** the number does not change. *(This is the negative control for card 3: a filter that
never filters would pass card 3 by accident.)*

---

### CARD 5 — "Planted" says on the screen that it is worked out, not recorded
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: D-9 Surface Honesty · the morning file's D3

Look at the three status boxes.

**PASS:** the third reads **"Planted (worked out, not recorded)"**, and the note below explains it
means a delivery that was completed AND was sold as planting work.
**FAIL:** it just says "Planted" as though the system recorded a planting.

*Nothing in this platform stores the moment a tree went in the ground. The box is a derivation and
must not be read as a record.*

---

### CARD 6 — Saturday's route draws, for one crew
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David 2026-09-25 (overlay the delivery route)

Route layer on. Pick **2026-09-26** and **Crew 1**.

**PASS:** a blue line through numbered stops in the order you saved, and a line saying how many
stops.
**FAIL:** nothing draws while the schedule shows that crew has stops that day.

⚠️ **If some stops are missing from the line, the panel says so and why.** A stop is placed
through its customer's located address; a customer with several sites and no street match is
refused rather than guessed at. That is correct behaviour, not a bug — but it means the drawn
route is shorter than the real one, and the panel says that too.

---

### CARD 7 — 🔴 CUSTOMERS ALONG THE ROUTE, AS A LIST YOU COULD RING
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David 2026-09-25 ("customers along the route or within x miles")

With card 6's route drawn, turn on **Customers near that route** and leave it at **2 miles**.

**PASS:** those customers turn **red and larger** on the map, AND a table appears below with
**name, phone, town, last bought, miles** — nearest first. **Export CSV** downloads it.
**FAIL:** highlighting but no list. *The list is the point — it is who you ring before the truck
goes out.*

---

### CARD 8 — the corridor width actually does something
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the corridor query

Change **Within** from 2 to 10 miles, then to 0.5.

**PASS:** the list grows, then shrinks.
**FAIL:** the same list at every width. *(The negative control for card 7.)*

---

### CARD 9 — the map is a LENS: turning it off breaks nothing
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David 2026-09-16 ("delivery/routing/pricing never depend on it")

Without fixing the map key (or with the network throttled so the map cannot load): take a delivery
order through checkout, open the delivery schedule, and open Settings → Delivery.

**PASS:** **everything works.** The delivery charge is calculated, the schedule lists stops, the
ring list is editable. The only thing missing is a picture.
**FAIL:** any of those is broken or blank because the map did not load.

---

### CARD 10 — nothing on this page changes anything
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the read-only rule

Use every control on the Map page. Then open Settings → Delivery and the delivery schedule.

**PASS:** no ring moved, no stop changed crew, no customer edited. The Map page has no Save
anywhere on it.
**FAIL:** anything you did on the map altered data.

---

### CARD 11 — the rings-vs-invoices line is honest about what it could not compare
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: item 3 · tech-debt #186's class

Rings layer on, read the sentence under it. Then Settings → Delivery → "Your rings against your
invoices" for the full table.

**PASS:** it says **how many of your past trip charges could be compared out of how many were
found** — and, with most addresses unlocated, most will be in the "could not" half. Rings with
fewer than three comparable deliveries read **"not enough history to say"**, not "agrees".
**FAIL:** a bare "your rings match" with no count beside it.

*"Not enough history to say" is not agreement, and the table must never let those two read the
same.*
