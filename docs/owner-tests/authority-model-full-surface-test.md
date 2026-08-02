# AUTHORITY MODEL — FULL-SURFACE OWNER TEST

> **Rendered board:** open `owner-tests.html` (a PURE renderer — it parses this file live and holds
> no data of its own). Sibling of `stories.html` / `status.html`.
>
> **This file is the ONLY source of truth for the authority-model owner-tests.** It is STANDING —
> run it after any change to `BusinessProvider`'s permission resolution, `PermissionRoute`,
> `SurfaceState`, `permissionManifest`'s owner set, or the permission funnel. A per-build proof is a
> FILTER (`COVERS: #NNN`), never a second doc.

**Purpose:** prove the three things the 2026-07-30 ruling asserts — that the owner passes by HOLDING
permissions rather than by being the owner, that removing `isOwner` took nothing away from him, and
that a refused surface now SAYS SO instead of vanishing.

**Board: 0 of 27.** Every card is `STATUS: owed` except cards 22 and 27, which are `needs-test` with their reasons stated.

**Why this exists.** `businesses.owner_id` was the authority mechanism at three layers. It is
single-valued, so it cannot express the TWO OWNERS David ruled on 2026-07-26 — and the client's
owner short-circuit made the client MORE PERMISSIVE THAN THE SERVER, which is how the owner came to
read *"Tax: not identified"* on his own dashboard while his manager read the rate correctly.
Separately, ~30 refusal surfaces were measured: 27 silent, 3 apologising after a failed write, 0
pre-emptive. Cards 1–6 prove the authority change; 7–14 prove the surfaces; 15 proves the one conversion that came out LOSSY (#172); 16–17 prove the two LIVE defects the A7 sweep found (#174); 18 proves the fourth permission status (#175); 19–20 prove its tile path (#176), and 20 is runnable ONLY as staff; 21–22 prove the uniform-tiles pass (#179) — 21 is the nine-week `campaigns.status` defect, dead; 23–25 prove the tenant module seed + the trial clock (#181): **24 must not be skipped** (it proves the repair mechanism cannot be used to renew a trial or re-term a tenant), and **25 is standing, not one-shot** — it is the only detector of an unseeded tenant that exists. **26–27 prove the trial reversal (#182): 26 is the build** — the migration LAWNS needs before anything on his dashboard changes, and ✏️ **card 23 was AMENDED because its ② and ③ asserted the defect**, telling David to expect the seven add-ons dark. 27 is `needs-test` because the `unpriced` ruling it would test has not been made.

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
- [ ] **② 🔴 THE THREE MIGRATIONS ARE APPLIED, IN ORDER.** This is not optional and the order is
      safety-critical:
      `20260730a_owner_holds_all_backfill.sql` → `20260730b_owner_member_row_invariant.sql` →
      `20260730c_owner_branch_removed_and_owner_role_locked.sql`.
      **Run 20260730b's V2 before deploying Phase 2 code.** Every owner row must read
      `role OWNER · active true · n = 52 · has_tax_rate_read true`. If any row is not 52, STOP —
      re-run 20260730a's §2 for that business first. **Deploying the client ahead of `a` locks the
      owner out of his own platform**; that is the entire reason the phases are ordered.
- [ ] **③ you have BOTH sessions available** — your OWNER login and the MANAGER `df7723be`. Six
      cards below are meaningless as the owner, because the owner now passes everything.

---

## THE CARDS

### CARD 1 — 🔴 THE SYMPTOM, DEAD (the one card that justifies the whole build)
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the `get_business_tax_rate` / `has_permission` owner-branch gap
SIGNAL: `[TRACE:PERM] active business permissions {role: 'OWNER', source: 'OWNER_LOCKED_SET (computed from the manifest)', count: 53}`

**As the OWNER**, open **Checkout → Review** with any item in the cart.
**PASS:** the tax line shows a real rate (8.25%).
**FAIL (the old behaviour):** *"Tax: not identified."*
This failed for the owner and PASSED for the manager, because the manager's array had been
backfilled and the owner's had not — the owner was worse off than his own employee. If this still
fails, check 20260730a's V2 first: the array, not the code, is the thing that changed.
**CANDIDATE (2026-07-31, MANAGER walk — NOT this card's script, recorded honestly):** the MANAGER
read **7.60% / $74.86** on Checkout → Review. That is the MIRROR of this card, not the card: the
symptom was the OWNER reading "not identified" while the manager read a rate, and the manager half
never failed. **This card still needs the OWNER-session run to close.**

### CARD 2 — the owner lost NOTHING when isOwner was removed
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the deletion of `BusinessProvider.tsx:695`

**As the OWNER**, visit each in turn: `/dashboard` · `/costs` · `/add-business` · `/team` ·
`/settings` · `/customers` · `/inventory` · `/receipts` · `/deliveries` · `/campaigns`.
**PASS:** all ten open normally.
**FAIL:** any one shows the 🔒 access page — that means a string is missing from the owner's set,
not that the gate is wrong. Read the permission it names and check it against 20260730a's V1.
🔴 `/costs` and `/add-business` are the sharpest two: they are gated on the `owner-only` sentinel,
which is NOT a manifest entry and had to be added to the owner's set by hand. If the short-circuit
had been deleted without that line, these two — and only these two — would have gone dark.

### CARD 3 — 🔴 TWO OWNERS (the ruling, proven end to end)
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the 2026-07-26 TWO OWNERS ruling

Add a second person as an **OWNER-role member** on the Team page (or via 20260730c's V5 block).
**Do NOT change `businesses.owner_id`.** Sign in as that person.
**PASS:** they reach everything card 2 lists, and the header reads their name.
**FAIL:** they are refused anywhere the first owner is admitted.
This is the card the whole model exists for. Under the old code this person got NO owner bypass at
any layer and fell back to whatever array they happened to hold.

### CARD 4 — the OWNER role cannot be edited, including by the owner
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: 20260730c §2 — the funnel's locked-role refusal

**As the OWNER**, open `/team` → **Roles** → the **OWNER** card.
**PASS:** every chip is lit and locked, the badge reads **"computed from the model"**, there is **no
Save button**, and the footer states the count with the reason it cannot change.
**FAIL:** a chip toggles, or a Save appears.
Then confirm the count is **not** a hardcoded word: the card must read a NUMBER of permissions, not
the phrase "Full access". The old screen printed a ternary — every chip lit unconditionally, whether
or not the model actually granted it.

### CARD 5 — a MANAGER is refused, and the refusal is specific
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the client/server agreement after the owner branch was removed
SIGNAL: `[TRACE:PERMGATE] route entry refused {behavior: 'render-and-say-so'}`

**As MANAGER `df7723be`**, open `/costs`.
**PASS:** the page RENDERS, stays on `/costs` in the address bar, and names the permission.
**FAIL:** you land on `/dashboard` (the old bounce), or you get in.
**CANDIDATE (2026-07-31, MANAGER `df7723be` walk — awaiting David's mark):** reported passing in the
same walk that surfaced the delivery-date gap.

### CARD 6 — the manager's own capabilities are UNCHANGED
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the blast radius of the 15 converted sites

**As MANAGER `df7723be`**, run a normal working day: open `/checkout/scan`, **search a customer by
surname**, attach them, add a service, take the order through to an invoice.
**PASS:** every step works exactly as it did yesterday.
**FAIL:** any control that worked yesterday is now refused. That would mean a converted site took a
string narrower than the one the server enforces — read the name on the refusal and compare it to
`submit.ts`.
🔴 The customer search is called out deliberately: it is the #170 surface, broken one day before
this build by a gate on a retired string, and it is the most likely thing to break again.
🔴 **THIS CARD'S FAIL CLAUSE FIRED — 2026-07-31, MANAGER `df7723be`, first time, on the site it was
written about.** Tax, customer search and "Adjust price" all worked. **The delivery+planting branch
did not:** the delivery-date field was absent because Phase 2 mapped `CustomerCapture.tsx` to
`deliveries:create`, a string `MANAGER_DEFAULT_BUNDLE` does not contain — *"a converted site took a
string narrower than the one the server enforces"*, verbatim. **It is worth recording WHAT caught
it: this card, on a walk. No cap moved** — capA asserts shape, and the shape was perfect. Fixed to
`orders:update` (ledger #172; the string now matches what the code writes). **This card stays
`owed`** and is re-walked WITH the delivery branch — the walk that found the defect is not the walk
that proves the fix.

---

## SURFACE: the six states

### CARD 7 — 🔴 A PAGE WITHOUT ACCESS RENDERS AND SAYS SO
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: the ruling's headline clause · the Accounting-bounce counter-example

**As MANAGER**, type a URL you cannot reach directly into the address bar — `/costs`.
**PASS:** all four:
① the page renders with a 🔒 and the surface's name;
② **the URL still says `/costs`** — it was not replaced;
③ it names the permission in plain words AND gives the raw string;
④ it says the owner can grant it on the Team page.
**FAIL:** you are on `/dashboard` with no explanation.
Clause ② matters more than it looks: with the URL intact the person can paste the link to whoever
grants permissions. A redirect destroys the only thing they had to show.
**CANDIDATE (2026-07-31, MANAGER `df7723be` walk — awaiting David's mark):** reported passing in the
same walk that surfaced the delivery-date gap.

### CARD 8 — the menu shows every item, marked
STATUS: owed
LAST-PROVEN: never
DEVICE: phone
COVERS: the ruling's MENU clause
SIGNAL: `[TRACE:NAV] menu {refusedItems: [...]}`

**As MANAGER, ON A PHONE**, open the hamburger.
**PASS:** items the manager cannot reach are **present**, dimmed, with a 🔒 — not absent. Tapping one
lands on the card-7 page.
**FAIL:** the item is missing entirely.
**`DEVICE: phone` and it must be provable WITHOUT a console.** Compare against the owner's menu on
the same device: the two lists should have the SAME ITEMS, differing only in marking.

### CARD 9 — 🔴 WITHHELD DATA ANNOUNCES ITSELF (never an empty list, never a zero)
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the DeliverySchedule vanishing-customer counter-example

**As a session WITHOUT `customers:read`** (a STAFF member — grant one if none exists), open
`/delivery-schedule` with at least one delivery that HAS a customer.
**PASS:** the row shows **"Customer details withheld — Requires Customers · Read"**.
**FAIL:** the customer block is simply absent, so the row reads as *a delivery with no customer*.
This is the most dangerous of the six to get wrong, and the reason is the failure is PLAUSIBLE: a
withheld list renders as "no records" and a withheld number renders as "0", and both are read as
facts about the BUSINESS rather than facts about the viewer.

### CARD 10 — a refused control RENDERS and names what it needs
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the "Adjust price absent for a manager who held the permission" counter-example

**As a session without `order_discount:apply`**, open a cart at **Checkout → Review**.
**PASS:** where the price-override affordance would be, there is a 🔒 line naming
**Order Discount · Apply**.
**FAIL:** nothing is there at all.
Same check for tax exemption (`tax_exempt:apply`) on the same screen, and for **Editing this order**
on `/orders/:id`.
**CANDIDATE (2026-07-31, MANAGER `df7723be` walk — awaiting David's mark; this is where the walk's
third observation actually lands, NOT on cards 5–7):** "Adjust price" rendered **with** its reason
field and baseline — invisible the day before because the gate read `isOwner` — and tax exemption
rendered as 🔒 *"Tax exemption for this order — Requires Tax Exempt · Apply — ask the owner"*. A
named refusal beside a granted control, on one screen, in one session.

### CARD 11 — a refusal is PRE-EMPTIVE, not an apology
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the three post-write apologies (Customers tier + status, DeliverySchedule date)

**As a session with `customers:read` but NOT `customers:update`**, open `/customers` and change a
row's **Tier** dropdown.
**PASS:** the refusal names the permission **immediately**, and the value does not appear to save.
**FAIL:** the cell repaints as if it saved and the message arrives afterwards.
The old copy — *"that tier change was not saved — you may not have permission"* — was honest but
late. A person who has already made a decision on a value that never saved has been misled once.

### CARD 12 — BEING BUILT is distinguishable from NOT PERMITTED
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the BEING BUILT state

✅ **`needs-test` → `owed` on 2026-07-31 (ledger #176): `<BeingBuilt>` IS NOW MOUNTED.** The old text
read *"built and exported but not yet mounted on any surface … there is no card to run yet"* — true
when written, and true for eight days. BUILD 2 wired it to the `business_insights` readout on
`/dashboard`, and the planned TILES got their own amber `SOON` treatment in `Tile.tsx`.

**As the OWNER**, open `/dashboard` and compare two things on one screen:
**PASS:** the **"Business insights — coming soon"** panel (BEING BUILT — nobody can have it) reads
differently from a 🔒 NOT PERMITTED refusal (a permission you could be granted).
**FAIL:** they look the same, or the insights panel is missing.

Run **cards 19 and 20** with this one — 20 is the only card that proves the underlying fix, and it
must be run as STAFF.

### CARD 13 — the owner's set is COMPUTED, so a new permission is inherited
STATUS: needs-test
LAST-PROVEN: never
DEVICE: desktop
COVERS: `OWNER_LOCKED_SET` — the "computed, not stored" half of the ruling

**`needs-test`, with its reason:** proving this properly means ADDING a permission to the manifest
and confirming the owner holds it with no migration — a code change, so it cannot be a pure UI card.
The mechanical half IS covered: `permissionManifest.test.ts` asserts the computed set equals the
stored bundle, and capA assertion 3 fails the build if the SQL copy drifts. What is NOT proven by a
human is the end-to-end inheritance. Flagged so the hole is visible rather than assumed closed.

### CARD 14 — the audit trail records what happened
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: 20260730a's V4 · 20260730c's V3

Run 20260730a's **V4** and 20260730c's **V3** in the SQL editor.
**PASS:** V4 returns one `role.factory_reset` per business, `outcome success`, with
`reason = 'rbac-model:owner-holds-all'`; V3 returns `applied = false` and one
`role.locked_write_refused` row with `outcome denied`.
**FAIL:** a `permission.self_elevation_denied` row in V4 — that is an `owner_id` problem on that
business, not a permission problem. Read the business name and fix the row.

---

## SURFACE: the delivery date on the checkout customer step (added 2026-07-31, ledger #172)

### CARD 15 — 🔴 THE MANAGER CAN SET A DELIVERY DATE (the lossy conversion, dead)
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #172 — the Phase 2 string chosen from the surface name instead of from what is written
SIGNAL: `[TRACE:DELIVERY] delivery date set { deliveryDate: '…' }` (secondary — the field is visible without a console)

**As MANAGER `df7723be`, never as the owner.** The owner passed this the whole time; that is precisely
why it went unnoticed for a day.

`/checkout/scan` → scan a plant → choose the **delivery + planting** transport → `/checkout/customer`.
**PASS:** below Zip there is a **Delivery date** field with the helper *"When is this going out? You
set the date now; customer self-scheduling comes later."* A date sets, survives to Review, and the
order appears under that day on `/deliveries`.
**FAIL:** the step ends at Zip — the original defect, 2026-07-31 09:59.

**Then run it AGAIN as STAFF.** The field must be there too. That is not a nice-to-have — it is the
ruling: **a permission gates a CAPABILITY, not a FIELD.** Staff hold `orders:create` and take orders,
so they set the date on the order they are taking. If staff sees the form but not the date, the
string has drifted back to `orders:update` and the person standing in the lot has lost the field.

🔴 **What this card is really guarding is the STRING, not the field**, and it has been wrong twice:
`deliveries:create` (Phase 2 — the manager lost it) and `orders:update` (the first correction —
right answer, wrong reason; it happened to include Lauren). It is now **`orders:create`**. If it
fails again, read the permission on the refusal and ask *which capability is being exercised*, not
*which string does this person hold*.

✅ **`submit.ts` has no check on `delivery_date` and that is DELIBERATE** (tech-debt #84, closed by
ruling). "May create an order" implies "may set its fields". So a PASS here is a proof about the
FIELD, not about enforcement — and there is no server gate owed behind it.

---

## SURFACE: the A7 client-gate sweep's two live fixes (added 2026-07-31, ledger #174)

### CARD 16 — 🔴 THE OWNER'S INVENTORY VALUE IS A NUMBER
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #174 — `view_costs` → `costs:read` (A7 instance 3)

**As the OWNER**, open `/dashboard`.
**PASS:** the **Inventory value** readout shows a real dollar figure.
**FAIL:** it is absent, or reads `$0` while you have stock on hand.

🔴 **This is the card for the whole defect class, and it is worth knowing why it went unreported for
so long.** The gate named `view_costs`, a string the model had retired, so `can()` returned false for
**every session including the owner's** — and the query did not even ask for `unit_cost`. **A tile
that is missing looks exactly like a tile that was never built.** Nobody files a ticket about a
feature they assume is unfinished. If this reads `$0`, check the browser network tab for
`business_inventory?select=qty,unit_cost` — if the request says `select=qty` alone, the gate is
false again and the string has drifted.

### CARD 17 — the import does not tell the owner his prices will not save
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #174 — `import_pricing` → `inventory:import_price` (A7 instance 4)

**As the OWNER**, open `/inventory/import`, upload a CSV, and map a **price** column.
**PASS:** no "won't be saved" marker on the price column; the prices import.
**FAIL:** the marker appears — the courtesy flag is false again.
The old string was `import_pricing`, renamed to `inventory:import_price`. This was never a security
hole (the server's `import_write_price` RPC is the authority) — it was the app **lying to the owner
about his own authority**, which is D-9 pointed at the person who owns the business.

---

## SURFACE: the `planned` permission status (added 2026-07-31, ledger #175 — BUILD 1)

### CARD 18 — 🚧 A PLANNED PERMISSION RENDERS AND CANNOT BE GRANTED
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #175 — the fourth status; the six-state ruling's BEING BUILT, applied to a permission

**As the OWNER**, open `/team` → **Roles** → select any role that is **not** OWNER.

**PASS — all four:**
① three chips render **dashed amber with a 🚧 and the words "coming soon"**: **Overdue PMI Override**,
   **Route Update**, and **Reports Read**;
② hovering one says it is not built yet and cannot be granted until it ships;
③ **clicking one does NOT tick it** — it stays exactly as it was;
④ Save, then **reload the page**: the role's permission **count is unchanged**.

**FAIL:** any of those chips is missing entirely (that is the old `declared-unwired` treatment, which
this ruling overturned) · or a chip ticks · or the count moves after a save.

🔴 **Clause ④ is the one that matters and it is worth saying why.** The chip is deliberately
rendered but un-grantable, and the failure this guards against is silent: an owner who believes he
granted access to a feature that does not exist. If the count moves, the string reached a role
array — and because a planned string is filtered out of nothing, it would then be held, invisible
on some screens, and removable only by SQL.

Contrast it with a **`declared-unwired`** string on the same screen — `campaigns:create`,
`team:create`, `service_offerings:create` — which must **NOT** appear at all. That is the
distinction the fourth status exists for: *scoped and coming* renders; *an accident or a deliberate
no* does not.

---

## SURFACE: the planned TILE path (added 2026-07-31, ledger #176 — BUILD 2)

### CARD 19 — 🚧 A PLANNED TILE LOOKS LIKE A ROADMAP ITEM, NOT A SNUB
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #176 — the `planned` TileState + the mounted `<BeingBuilt>`

**As the OWNER**, open `/dashboard`.
**PASS — both:**
① the planned modules (**Opportunities, Follow-Up** — the only two on the dashboard) render with an
   **amber `SOON` badge**, keep their own colour, and **do not respond to a click**;
② below the metric row there is a **"Business insights — coming soon"** panel.

⚠️ **AMENDED 2026-08-01 (ledger #179) — Campaign Scheduler is NO LONGER on this list.** Its
`status:'planned'` was wrong and has been corrected to `live`; it now renders as a normal navigable
tile and is proven by **CARD 21**, not here. Online Shop / Contractors / Seasonal were never on the
dashboard — they are `placement:'settings'`, which renders nowhere today — so naming them in this
card asked David to look for four tiles that could not appear. Corrected rather than left standing.
**FAIL:** a planned tile shows a **red lock on a grey square** — that is the OLD mapping, which said
*"you are not allowed"* about something nobody is allowed because it does not exist · or the
Business insights panel is absent.

🔴 **Clause ② has never rendered before, on any session.** `business_insights` is a READOUT, and
readouts are excluded from the tile grid by `kind !== 'readout'`, so it had no render site at all —
it carried `status:'planned'` from the day it was registered and showed nothing to anyone.
`<BeingBuilt>` itself was written in Phase 3 and mounted for the first time by this build.

### CARD 20 — 🔴 THE FIX, PROVEN FROM THE ONLY SESSION THAT CAN PROVE IT
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #176 — the permission filter no longer runs before the status read

**As STAFF** (not the owner, not the manager), open `/dashboard`.
**PASS:** the planned tiles are **still there**, amber and inert, exactly as the owner sees them.
**FAIL:** they are missing.

**This is the entire defect and it can only be seen from here.** The filter used to be
`can(required_permission)` alone, so a planned tile rendered only for someone who already held its
string — Contractors gates on `pricing_recipe:update`, Follow-Up on `customers:update`, and staff
hold neither. **`planned` was reachable exactly for the people who did not need to be told the
feature was coming.** As the owner this card passes either way, which is precisely why it must be
run as staff.

---

## SURFACE: the tile grid's declared fields (added 2026-08-01, ledger #179 — the uniform-tiles pass)

### CARD 21 — 🔴 THE TILE AND THE NAV ITEM AGREE ABOUT CAMPAIGN SCHEDULER
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #179 — `campaigns.status` 'planned' → 'live'

**As the MANAGER**, open `/dashboard`.
**PASS — all three:**
① the **Campaign Scheduler** tile has a **green status dot**, no amber `SOON` badge, and is clickable;
② clicking it opens **/campaigns** — the same page the **Campaigns** item in the nav opens;
③ the page loads its campaign list (or the "No campaigns yet" empty state) without error.
**FAIL:** the tile still reads `SOON` · or the tile is inert while the nav item works · or the tile
shows an `[ENABLE]` button (that would mean a `module_key` was added to this row — it must not have
one; there is no `business_modules` row behind it and the button would be a dead affordance).

🔴 **This is the nine-week defect, and it is the reason CARD 22 exists.** Campaign Scheduler shipped
2026-05-29; the 2026-06-23 registry consolidation seeded eight tiles `planned` as a batch and swept
this one in with seven that genuinely were. It read as a grey square for five weeks and nobody
looked twice — then `planned` gained the amber SOON badge on 2026-07-31 and a mute wrong field
started making a claim out loud, **while the nav (same tile, same route) opened the working page.**
The nav could not have disagreed on purpose: `navPermission()` has no notion of `status`.

### CARD 22 — every tile declares every field with a legal value, and the build says so
STATUS: needs-test
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #179 — `scripts/verify-tile-fields.mjs`

**REASON THIS IS `needs-test` AND NOT A CARD DAVID RUNS:** the cap has **no user-facing surface**.
It is a build-time assertion over `TILE_REGISTRY` — 15 planted probes both directions, proven
red-first against the real registry (three planted defects → exit 1, named by key and field →
restored → exit 0). There is nothing to look at in the app, so a screen-based card would be
theatre. Recorded rather than omitted, per OP-14 clause 2: an unrecorded hole is a lie by omission.

**What would replace it with a real card:** the first time a tile field gains a RENDERER — the
Admin marketplace reading `placement`, or a grouped grid reading `group` — that surface gets a card,
and this one retires into it.

---

## SURFACE: tenant module seeding + the trial clock (added 2026-08-01, ledger #181 — ITEM 2)

> **SCOPE NOTE, so these two cards are not mistaken for the whole proof.** The migration
> `20260801c_module_seed_and_trial_clock.sql` carries a **ten-query V-block** that proves the SQL
> layer — the gate (V7/V8), the malformed-batch refusal (V9), the key-spelled-once assertion (V2).
> **Those are not repeated here.** A per-build proof is a filter, never a second document (OP-14
> clause 4), and two docs answering one question is how a test becomes unbelievable. The V-block
> proves the FUNCTIONS. These two cards prove the two things only the APP can be wrong about.

### CARD 23 — 🔴 A NEW BUSINESS IS BORN WITH ITS MODULE ROWS, AND SIGNUP STILL COMPLETES
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #181 — `seedBusinessModules` on both creation paths

**Create a NEW test business end-to-end**: `/signup` → owner info → PIN → the discovery step →
through `/onboarding` to the "is live" screen.

**PASS — all four:**
① **signup COMPLETES and lands on the dashboard.** This is the first thing to look at, and it is not
   a formality: a new `await` was added inside `createBusinessAndMember`, after the member INSERT.
   If it throws, the owner loses the business he just created.
✏️ **CARD AMENDED 2026-08-02 (ledger #182) — ② AND ③ ASSERTED THE DEFECT.** They told you to expect
the seven add-ons at `enabled = f`, which is the bug David reversed: a clock running over a module
nobody can use. A card that asks him to confirm the defect is worse than no card. Re-read both.

② 🔴 **NINE TILES RENDER AS `active`, NOT TWO.** QR Checkout and QuickBooks (core, included) **plus
   the seven trialling add-ons** — green dot, no `[ENABLE]` button, and each add-on carrying a
   **`30d TRIAL`** countdown under its label. **The trial is the period during which the module
   fully works**, so a tile offering to "enable" it is the same dead affordance core had. The only
   two tiles still showing `[ENABLE]` are `cost_to_produce` and `inventory_intake` — **a KNOWN
   OPEN RULING** (`unpriced`: no price, so no clock, so no liveness), not a defect of this build.
③ in the SQL editor, `SELECT module_key, enabled, configured, config->>'trial_started_at',
   config->>'trial_days' FROM business_modules WHERE business_id = '<the new business>' ORDER BY
   module_key;` returns **ELEVEN rows** — `qr_checkout` and `qb_invoicing` with **`enabled = t` AND
   `configured = t`** and both trial columns null; the seven add-ons with **`enabled = t` AND
   `configured = t`**, a **non-null** timestamp and **`trial_days = 30`**; `cost_to_produce` and
   `inventory_intake` with `enabled = f` and **both trial columns null**.
   🔴 **AN ADD-ON AT `enabled = f` WITH A NON-NULL TIMESTAMP IS THE DEFECT THIS BUILD REVERSED** —
   if you see one on a NEW business, `moduleSeedRow` did not ship. (On LAWNS, that is expected
   until `20260802` is applied — that is card 26.)
   🔴 **A timestamp with a null `trial_days` is a BROKEN ROW** — expiry computes from the pair, so
   half a pair is a trial nobody can resolve. It should be impossible; if you see one, stop.
④ `SELECT action, outcome FROM audit_log WHERE business_id='<new>' AND action IN
   ('business_modules.seeded','module_trial.started');` → one `seeded` (success) + **seven**
   `module_trial.started` (success).

**FAIL:** signup errors or hangs · **zero rows** (the seed was denied — check the owner's member row
carries `subscription:update`, i.e. n=54, per 20260801c pre-apply stage C) · fewer than eleven rows
(a SHORT SEED — the console warning `MODULE SEED INCOMPLETE` names the numbers).

⚠️ **ONE THING THAT LOOKS WRONG AND IS NOT:** QuickBooks reads `active` on a tenant that has never
connected to Intuit. The tile says *"included"*, not *"connected"* — it routes to `/settings` where
the link is made, and the QB **connection** indicator is a separate surface reading
`business_accounting_secrets`. Considered and recorded, not missed.

### CARD 24 — 🔴 FINISHING ONBOARDING TWICE DOES NOT BUY A SECOND FREE MONTH
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #181 — the self-heal call, and the clock that refuses to restart

**This is the card that matters most, and it exists because the repair mechanism and the money
hazard are the same call.** The module seed runs on the onboarding path **deliberately outside the
legacy-create branch**, so that a failed signup-path seed is fixed when the owner finishes
onboarding. That same re-run must never hand the tenant a fresh thirty days.

Using the business from CARD 23: **write down the seven `trial_started_at` timestamps.** Then visit
`/onboarding?biz=<that business>` again and complete the wizard a second time.

**PASS — both:**
① re-run CARD 23's query ③ — **every one of the seven timestamps is IDENTICAL to what you wrote
   down**, to the second;
② `SELECT action, outcome, detail->>'restart_refused' FROM audit_log WHERE business_id='<that one>'
   ORDER BY created_at DESC LIMIT 8;` → the newest `business_modules.seeded` reads
   **`no_change`**, and all seven `module_trial.started` rows read **`no_change`** with
   `restart_refused = true`.

**FAIL — and treat it as a STOP, not a note:** any timestamp moved. A trial that renews itself on
every onboarding load is a permanent free subscription, arriving through the mechanism built to
make a failed seed recoverable.

### CARD 25 — 🔴 SEED INTEGRITY: THE ONLY WAY ANYONE FINDS AN UNSEEDED TENANT IS BY ASKING
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #181 — the standing seed-integrity query (`20260801c` V6)

**This card exists because David ruled the query belongs on the board rather than only in the
migration**, and the reason is the defect's own shape: **an unseeded tenant looks identical to a
normal tenant on every screen there is.** `useModules` renders a MISSING row and a disabled row the
same way. Nothing errors, nothing is red, no trial runs, no bill is ever raised. A query that lives
only inside a migration file nobody reopens is a question nobody asks — and this is a question that
has to be asked, because nothing will ever volunteer the answer.

**RUN THIS BEFORE THE DEMO, and after any signup that mattered:**

```sql
SELECT b.name,
       COUNT(bm.module_key)                                             AS module_rows,
       COUNT(bm.module_key) FILTER (WHERE bm.config ? 'trial_started_at') AS with_clock,
       COUNT(bm.module_key) FILTER (WHERE bm.config ? 'trial_started_at'
                                      AND NOT bm.config ? 'trial_days')  AS broken_pair
  FROM public.businesses b
  LEFT JOIN public.business_modules bm ON bm.business_id = b.id
 GROUP BY b.id, b.name ORDER BY b.name;
```

**PASS — all three:**
① every business created since `20260801c` shipped reads **`module_rows` = 11**;
② **`with_clock` = 7** on those businesses;
③ **`broken_pair` = 0 everywhere, always** — a start with no term is a trial that cannot be
   resolved, and the function refuses a non-positive term before writing anything, so a non-zero
   here means something wrote the row that is not `start_module_trial`.

**FAIL and what it means:**
- **0 rows** → that tenant has **no trial and no bill**, and no screen will ever say so. Re-run
  `20260801c` V3 for it; the seed is idempotent, so re-running is always safe.
- **1–10 rows** → a SHORT SEED. Same repair. The client logs `MODULE SEED INCOMPLETE` with the
  numbers when it happens, but only if someone had a console open at the time.
- **`broken_pair` > 0** → stop and investigate before doing anything else.

⚠️ **LAWNS AND OTHER PRE-EXISTING TENANTS WILL NOT READ 11 UNTIL THEY ARE SEEDED ONCE.** The
20260604 pivot moved ten rows across for LAWNS; nothing has ever seeded the rest. That is expected
on the first run and is exactly what this card is for — **it is a backfill list, not just an alarm.**

🔴 **This card retires the day the marketplace seeds-if-absent on open (ITEM 3).** At that point an
unseeded tenant repairs itself the first time anyone opens the module screen, and the question stops
needing to be asked by hand. Until then, this is the only detector that exists.

### CARD 26 — 🔴 THE REPAIR: LAWNS' SEVEN TRIALS BECOME REAL TRIALS
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #182 — `20260802_trialling_modules_are_live.sql`

🔴 **THIS CARD IS THE BUILD.** The code fix corrects every FUTURE tenant and **cannot touch LAWNS**
— `20260801c` seeds with `ON CONFLICT DO NOTHING`, which is correct and unchanged (it is what makes
the seeder safe to re-run as the repair path) and which means the eleven rows already on disk keep
whatever they were given this morning. **Nothing changes on your dashboard until this migration is
applied.**

**BEFORE — run the PRE-APPLY query at the top of `20260802`.**
**PASS:** exactly **SEVEN** rows read `🔴 WILL BE CORRECTED` (social_media, followup_engine,
online_shop, business_insights, delivery_routing, seasonal_module, contractor_tiers) · two read
`already live` (the core pair) · two read `no clock` (the two `unpriced`). Eleven total.
**STOP AND SURFACE:** ANY row reading `LAPSED`. It means this is being applied after a term ran
out, and that tenant needs a decision rather than a repair.

**APPLY, then the V-block.**
**PASS — all five:**
① **V1 returns ZERO ROWS.** This is the invariant, asked of the data: a clock over a dark module.
② **V2 reads 9 live / 2 dark** on LAWNS, and the `clock` column shows a real day count.
③ 🔴 **V3 — the terms were NOT touched.** Every trialling row still reads `term = 30` and its
   ORIGINAL `2026-08-02` start stamp. **A repair that quietly re-terms a tenant is precisely what
   the snapshot ruling forbids** — if a start date moved, the migration did something it must not.
④ **V4** — one audit row per business, `detail` naming seven modules.
⑤ **V5** — the core pair untouched: `enabled = t`, `configured = t`, `trial_started_at` NULL.

**THEN THE SCREEN — hard-refresh the dashboard (GATE 0 first: confirm the SHA).**
**PASS:** 🔴 **Delivery Routing and Social Media render as WORKING TILES** — green dot, no
`[ENABLE]` — each with **`30d TRIAL`** beneath the label. Tapping either opens its page. This is
the exact pair you reported this morning as *"[ENABLE], identically to a module nobody has ever
touched."*
**FAIL:** either still shows `[ENABLE]` after the migration verified clean (then `configured` did
not move with `enabled`, and the fix reached the data but not the screen) · a tile shows a
countdown but is greyed · the countdown reads `0d` or a negative number.

### CARD 27 — 🔴 AMENDED: the ruling LANDED, so this is now a real test
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #183 — David's rulings 1 + 2, after `20260802b`

✏️ **AMENDED 2026-08-02 (2). It was `needs-test` "because there is no correct behaviour to test
against yet" — David ruled, so there is one now.** The card is rewritten rather than replaced,
per OP-14 clause 4: two cards answering one question drift.

**Do this AFTER applying `20260802b`.** Owner session, owner dashboard.

1. **Inventory Intake (mobile)** — green dot, opens, works. **NO trial countdown anywhere on it.**
   It is CORE: included, on, nothing expiring. A countdown here would be the defect.
2. **Cost-to-Produce** (admin surface, `/costs`) — reachable and working, and its module row is
   LIVE **with a 30-day countdown**, because it is now a $29/mo add-on inside its trial.
3. 🔴 **NEITHER shows `[ENABLE]`.** That button on a working, already-included feature is the
   dead-affordance class, and it is the whole symptom these two rulings delete.

**FAIL if** either still reads `[ENABLE]` · Inventory Intake shows a countdown · Cost-to-Produce
shows none. ⚠️ **The $29 is a PLACEHOLDER by David's own statement** — do not treat the number as
under test. What is under test is that the module is LIVE and CLOCKED, not what it costs.

### CARD 28 — 🔴 A FREE MODULE MUST NOT BE COUNTING DOWN TO ANYTHING
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #183 — David's ruling 3, after `20260802b`

**The single most important observation of this build**, because it is the one a screen can show
and a query cannot: `contractor_tiers` was on a **live 30-day clock**, and it is free.

1. Run **V1** in `20260802b`. `contractor_tiers` must read `enabled f · configured f ·
   started NULL · term NULL`. 🔴 **A NULL `started` IS THE POINT.** A timestamp still there means
   the strip did not run and a free capability is still counting down to an expiry.
2. On the **Contractors** surface (it is `placement:'settings'`, so reach it via the nav, not the
   grid — see card 29's note): it is **OFF, and offers to be turned on.** It must not say TRIAL,
   must not show days remaining, and must not warn about anything ending.
3. **Order-independence, checked rather than asserted.** Whether or not `20260802` has been applied,
   the answer to (1) is identical. Run **V2**: contractor_tiers must NOT appear in it either way.

**FAIL if** any countdown, expiry warning, or trial badge appears on Contractors · or V1 shows a
`started` timestamp. ⚠️ Note the tile's own `status` is `planned` — the SWITCH is what is ruled
here, not the feature behind it.

### CARD 29 — the four modules counting down to nothing, and the ruling that is owed about them
STATUS: needs-test
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #183 — the four-COMING-clocks ruling, OPEN

**`needs-test` with its reason, per OP-14 clause 2 — and it is card 27's old shape, deliberately
reused for the question that is now the open one.** `followup_engine` · `business_insights` ·
`online_shop` · `seasonal_module` are on **running 30-day clocks with no feature behind them**
(all four `status:'planned'`). There is no correct behaviour to test until David rules.

**What to LOOK at (not pass/fail):** the four tiles read **SOON** in amber and cannot be tapped —
that part is right and already ruled. Then ask what the card exists to force: *in ~30 days, what
does the platform ask an owner to pay for?* At that point each expires into a conversion decision
about something he has never seen. **Thunder's recommendation, on the OWED table: `trial_days: 0`
now, clock starts when the tile ships.** ⚠️ Also note while you are here: **Online Shop and
Seasonal are `placement:'settings'` and Contractors is too — none of the three renders on the
dashboard grid at all**, because `tilesForPlacement()` has no callers. That is a separate owed
question and it is why this card says to look at four tiles but you will only find two.
