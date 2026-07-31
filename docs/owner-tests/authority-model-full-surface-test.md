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

**Board: 0 of 17.** Every card is `STATUS: owed`.

**Why this exists.** `businesses.owner_id` was the authority mechanism at three layers. It is
single-valued, so it cannot express the TWO OWNERS David ruled on 2026-07-26 — and the client's
owner short-circuit made the client MORE PERMISSIVE THAN THE SERVER, which is how the owner came to
read *"Tax: not identified"* on his own dashboard while his manager read the rate correctly.
Separately, ~30 refusal surfaces were measured: 27 silent, 3 apologising after a failed write, 0
pre-emptive. Cards 1–6 prove the authority change; 7–14 prove the surfaces; 15 proves the one conversion that came out LOSSY (#172); 16–17 prove the two LIVE defects the A7 sweep found (#174).

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
STATUS: needs-test
LAST-PROVEN: never
DEVICE: desktop
COVERS: the BEING BUILT state

**`needs-test`, and the reason is recorded rather than hidden:** `<BeingBuilt>` is built and exported
but **not yet mounted on any surface**. The tile registry carries `status: 'planned'` on five tiles
(`online_shop`, `contractor_tiers`, `seasonal_module`, `services`, `opportunities`), which is the
fact it should read — wiring it is a separate build against those tiles, and doing it inside an
authority commit would have widened the blast radius for no gain. **There is no card to run yet.**

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
