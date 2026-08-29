# OWNER TEST — THE OWNER ROLE CARRIES THE AUTHORITY (Pass 2, Stage 1 — ACCESS)

**Capability:** 1.5 (identity / roles / RBAC) · 2.3 (settings → services) · 3.5 (team & invitations)
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 8 covered.**

Ruling under test: **R-22** — *the OWNER role carries full authority; `owner_id` is the account holder of last resort.*
Story: *Hand over the keys — the owner role outlives the person who opened the account.*

---

## ⛔ GATE 0 — DO THIS BEFORE READING ANY SCREEN (OP-15)

A failed Vercel build is **SILENT** — the last-good bundle keeps serving — and **Vercel deploys the TREE, not the COMMIT**. If the SHA under test is not live, every observation below is fiction.

1. `git log -1 --format=%h` on `main`.
2. Vercel dashboard: the deployment for **that exact SHA** reads **READY** (not a *different* push's Ready).
3. Open the app with `?debug=1` and confirm the **DebugPanel footer shows the same 7-char SHA**.
4. Hard-refresh.

If ①–③ do not agree, **STOP**. Do not record a pass or a fail.

---

## 🔴 GATE 0b — THE MIGRATION IS NOT APPLIED YET, AND THE ORDER MATTERS

**`supabase/migrations/20260828_owner_role_carries_authority.sql` is WRITTEN, NOT APPLIED.** Apply it as `postgres` **before** the client deploy lands, and here is why the order is not a preference:

The manifest flip grows `OWNER_LOCKED_SET` **on the client at page load, with no migration involved**. The server reads a STORED array. So a client that deploys first offers Lauren an "Add a service" button and an "Invite" button that the database still refuses — visible rather than silent now that `393682a` shipped, but it will read as a regression rather than as a build in flight.

**PROVE IT ON TEST DAVE'S TREE NEST FIRST — `95c1b2e9-3b09-43dd-a9f8-ba0744ca4382`.** It has real role variety: David as OWNER/`owner_id`, one MANAGER (`df7723be`), two STAFF (`39691f0b`, `877e0dfa`). **LAWNS has seven installs and is the wrong place to find a mistake.**

Then run **V1–V9 in the migration footer and paste the output**, not a sentence saying it passed.

🔴 **V7 AND V8 MUST BE RUN IMPERSONATED.** `has_permission()` reads `auth.uid()`, which is **NULL** under the SQL editor's role — run as `postgres` it returns false for everyone and proves nothing. Both blocks carry `SET LOCAL role authenticated` + `request.jwt.claims`, and both roll back.

| check | what it must say |
|---|---|
| **V1** | floor `n = 57`, all three new strings `t` |
| **V2** | every OWNER-role member: `n = 57`. An `n = 54` is a tenant the reset missed |
| **V3** | 🔴 MANAGER = 25, STAFF = 10, and **zero** rows holding any new string |
| **V4** | 0 rows — no tenant was skipped |
| **V5** | 5 policies; every qual carries **both** `is_active_member` and `has_permission`; **none** carries `owner_id` or a literal `'OWNER'` |
| **V6** | exactly ONE row — `service_offerings_owner`. A member DELETE policy here means R2 was violated |
| **V7** | 🔴 the OWNER-role non-`owner_id` member: `roster_rows` = the **full** count, `can_invite` / `can_edit_service` / `can_add_service` all **true** |
| **V8** | 🔴 the MANAGER: **false on everything**, `roster_rows = 1` |
| **V9** | the funnel refuses a non-holder and writes `invitation.create_denied` / `denied` |

**A refusal is the migration working.** §0 aborts the apply if `is_active_member` or `has_permission` is not a `postgres`-owned SECURITY DEFINER (§3's policy would recurse), if a required column is missing, or if the OWNER floor row is absent.

---

## SURFACE: services — the sell-side menu

### CARD 1 — an OWNER-role member who is not the account holder can edit a service
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #228

Sign in as the **OWNER-role member who is NOT `businesses.owner_id`** on Test Dave's. Open **Settings → Services**.

- Press **On/Off** on any add-on. **It flips and stays flipped after a reload.**
- Press **Edit**, change the price, **Save**. The new price is there after a reload.
- Press **+ Add service**, fill name + price, save. **The row appears.**
- No red failure banner appears on any of the three.

🔴 **Before this build, all three failed with a named refusal** — *"That service was not turned on — you may not have permission to change services…"* (`393682a` is what made that sentence appear instead of a screen that lied). If you still see that sentence, the migration has not been applied to this project, or the client is ahead of it. **That is GATE 0b, not a card failure.**

### CARD 2 — the ✕ is gone, and On/Off is how a service leaves the menu
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #228

Same screen, any role that can see it.

- **There is no ✕ / delete button on any service row**, in any group.
- Turning a service **Off** greys the row and removes it from checkout; turning it **On** brings it back.

🔴 **The removed button was broken in both directions, which is why it went rather than being gated.** `order_service_selections.service_offering_id` is `NOT NULL REFERENCES service_offerings(id)` with **no `ON DELETE` clause**, so deleting a service **that had ever been sold** raised a foreign-key error the owner saw as a generic failure — and deleting one that had not **destroyed it permanently**, with no tombstone, no ledger row and no audit row. R2 already named retire-by-flag as the shape and the On/Off toggle already was it.

⚠️ **WHAT THIS COSTS, so you can overrule it:** there is now **no way to remove a service typed by mistake** — it goes Off and stays in the list. Making that possible is a real build (a tombstone matching the `inventory:delete` pattern, plus the delete verb R2 currently withholds).

---

## SURFACE: invitations

### CARD 3 — she can invite someone, end to end
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #228

As the OWNER-role non-`owner_id` member, open **/team → Users → + Invite**. Invite a STAFF member.

- An **invite link and QR** come back. No error.
- The new person appears in **Team members** as **Invited**, and in **Pending invites**.
- **Open the link in a private window and accept it.** The account is created and the person can sign in.

🔴 **THE HALF THAT WOULD HAVE BEEN MISSED.** Creating an invitation used to write **two** rows from the browser — the `invitations` row **and** a paired inactive `business_members` row. Opening only `invitations` would have let step one succeed and step two be refused, leaving an invite whose acceptance fails with `MEMBER_ROW_NOT_FOUND`. **So the accept is part of this card, not a separate one.**

### CARD 4 — Revoke actually withdraws
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #228

Same session, **Pending invites → Revoke** on the invite from Card 3.

- The row disappears and **does not come back on reload**.
- Opening that invite link now **fails**.

🔴 **A Revoke that refuses is the dead affordance §1.6 item 5 forbids**, and until this build the button was there and the policy was not. The write now also asks for evidence it landed (`.select('id')`) — an RLS-refused UPDATE returns **zero rows and no error**, which is indistinguishable from success, and the list would have refreshed showing the invite still pending with nothing said.

### CARD 5 — the invite seeds the role's real permissions, and the browser does not choose them
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #228

After Card 3's person accepts, open them in **/team → the person → Role**.

- Their role reads **STAFF** and their permissions match what the **Roles tab** shows for STAFF — not more, not fewer.
- In the browser console, the invite emitted `[TRACE:MEMBERCONSOLE] invite created` with **`source: 'create_invitation (server-resolved)'`** and a `seededPermissions` count.

🔴 **This closes a hole that existed before the pass, not one it created.** The permission array used to travel **from the browser** in the request body. The owner's own client resolved it honestly; nothing required that. `create_invitation` reads the role floor server-side, so the array can no longer be chosen by the caller.

---

## SURFACE: the roster

### CARD 6 — the team page shows the team
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #228

As the OWNER-role non-`owner_id` member, open **/team → Users**.

- The header reads **Team members (N)** where **N is everybody on Test Dave's** — David, the MANAGER, both STAFF, and her.
- The browser console's `[TRACE:MEMBERCONSOLE] loaded` line reports the same `members:` count.

🔴 **It read `members: 1` before this build** — herself, via `bm_self_select (user_id = auth.uid())` — and that is why an invitation already sitting in the system was invisible to her. A roster that shows one person does not look broken; it looks like a business with one person in it.

### CARD 7 — three controls are locked, and they say why
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #228

Same session. Open **any team member** from the roster.

- **Remove member** and **Deactivate** are **visibly disabled**, and underneath them a line reads
  🔒 *"Only the account holder can remove someone from the team. Your owner role covers everything else on this page, including inviting people and setting what each role can do."*
- The phone **Edit / Add** control is disabled with its own line naming the account holder.
- Nothing on this page produces a red failure — **because nothing was attempted.**

🔴 **This card is the one most likely to be read as a bug, so read the reason first.** Those three are direct writes still fenced on `businesses.owner_id`, and this Stage widened only the roster READ. Shipping the read alone would have handed her a full team list with three buttons that refuse — a fix that creates three visible failures. ⚠️ **DAVID'S NOTE, recorded for the next pass, not this one:** Remove and Deactivate are **access control, not data edits**, and belong in the funnel beside `assign_member_role`. Set-phone is benign and can stay a normal write.

### CARD 8 — nobody else moved
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #228

Sign in as the **MANAGER (`df7723be`)**, then as a **STAFF** member.

- **MANAGER:** `/team` still refuses — *"Team management is available to the business owner."* Settings → Services is **readable and not editable**: no On/Off, no Edit, no Add.
- **STAFF:** unchanged in every respect. No Services section, no team page.
- Sign in as **David (`owner_id`)**: everything works exactly as before, **including Remove, Deactivate and Set-phone**, which are his alone.
- Open a **different tenant** and confirm nothing there moved.

🔴 **This is provable without running it, and should still be run.** All three new strings are absent from `MANAGER_DEFAULT_BUNDLE` (25) and `STAFF_DEFAULT_BUNDLE` (10), and a status flip makes a string *grantable*, not *held* — no bundle was edited, so neither role can move. **V3 asserts the same thing in the data and V8 asserts it in the session.** Run it anyway: the pass that proved this by construction is the same pass that would have shipped a phantom 58th permission if a comment had carried an apostrophe.

---

## WHAT THIS TEST DOES **NOT** COVER — named, not silently absent

- **STAGE 2 (AUTHORITY) IS NOT BUILT.** An OWNER-role member **still cannot assign a role** — the dropdown calls `assign_member_role`, whose actor gate is still `businesses.owner_id`. Expect a refusal there and do not record it as a failure of this test.
- **Inviting someone as an OWNER** is refused for anyone but the account holder in this Stage. That is **Lightning's call, not David's**, and it is flagged for overrule: promotion belongs in Stage 2's audited door rather than arriving early through the invite path.
- **The other ~21 owner-only tables are untouched.** This pass widened three.
- **`docs/reference/` is still untracked**; the three `docs/inventory-*.md` files still read `Last updated: 2026-06-13`.
