# OWNER TEST — THE OWNER ROLE CARRIES THE AUTHORITY (Pass 2, Stage 1 — ACCESS)

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> One glance. Match it to `git log --oneline origin/main -1` — **not to a SHA written in this
> file**, because Vercel deploys the TREE and *any* push to `main`, docs included, moves the
> stamp. *(GATE 0 · OP-15 · paid for twice on 2026-08-31: once hunting a defect in code that
> was never deployed, once by a pinned SHA going stale on the very next commit.)*

**Capability:** 1.5 (identity / roles / RBAC) · 2.3 (settings → services) · 3.5 (team & invitations)
**Ledger:** #228 · **#274** (RESET INVITE — the expiry a screen never showed) · **Branch:** `main`
**Last updated:** 2026-09-04
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 16 covered · owed 16 · needs-test 0.**

Ruling under test: **R-22** — *the OWNER role carries full authority; `owner_id` is the account holder of last resort.*
Story: *Hand over the keys — the owner role outlives the person who opened the account.*
⚠️ **CARDS 9–16 have NO story on the board yet.** David is writing it (*"I will write it. Do not wait on it for the recon; do not ship without it."*). The §9 story-reconciliation gate is therefore **OPEN on this build**, and it is recorded here rather than assumed away.

> 🔴 **CARDS 3 AND 4 WERE REWRITTEN ON 2026-09-04 AND THEIR STATUS DID NOT CHANGE — because there was nothing to flip.** OP-14 cl.3 flips a card `covered` → `owed` when its surface moves; **both were already `owed` and had never been proven**, so no green claim was lost. They are called out because the SURFACE THEY DESCRIBE CHANGED: the pending-invites list now carries an expired row, a subhead, and a validity sentence instead of a bare `expires <date>`. Their prior wording is preserved inline as **WAS**, because the old text is evidence about what the surface used to assert.

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
- 🔴 **NEW 2026-09-04:** the Pending invites row reads **`STAFF · valid until <a date about a week out>`** — *not* `expires <date>`, and *not* an undated row. The card under **Pending invites** reads *"Not yet accepted. An expired one is still recoverable — open that person to reset it."*
- **Open the link in a private window and accept it.** The account is created and the person can sign in.

> **WAS (2026-08-28, never proven):** the third bullet did not exist. The row read `{role} · expires {date}`, and the section had no subhead.

🔴 **THE HALF THAT WOULD HAVE BEEN MISSED.** Creating an invitation used to write **two** rows from the browser — the `invitations` row **and** a paired inactive `business_members` row. Opening only `invitations` would have let step one succeed and step two be refused, leaving an invite whose acceptance fails with `MEMBER_ROW_NOT_FOUND`. **So the accept is part of this card, not a separate one.**

### CARD 4 — Revoke actually withdraws
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #228

Same session, **Pending invites → Revoke** on the invite from Card 3.

- The row disappears and **does not come back on reload**.
- Opening that invite link now **fails**.
- 🔴 **NEW 2026-09-04 — the row disappearing is now MEANINGFUL, and it was not before.** Until this build the pending list also dropped rows silently on **expiry**, so a vanished row meant either "withdrawn" or "ran out of time" and the screen never said which. Expiry no longer removes a row (it restyles it), so **a row leaving this list now means exactly one thing: somebody withdrew it.**
- Open that person in **Team members**. The **Invite — link & QR** card is **gone** — correct, there is nothing left to share or reset.

> **WAS (2026-08-28, never proven):** two bullets only. The disappearance was ambiguous between revoke and expiry and nothing said so.

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

## SURFACE: RESET INVITE — the seven-day clock and the button that restarts it (ledger #274)

> 🔴 **WHAT THESE CARDS EXIST FOR, IN ONE SENTENCE.** Joel Joiner was invited to LAWNS on
> 2026-08-27 13:32 as MANAGER; his token expired 2026-09-03 13:32:43, unused; **nothing in the
> product could reissue or extend it** (a sweep of all 1,061 commits on every branch found no
> resend/reissue/regenerate had ever existed), and the card that hands out his link **never read
> the expiry column at all** — so a live invite on day 6 looked identical to one on day 1, and at
> the moment of expiry the whole card silently disappeared. David: *"I could have sent that QR
> this morning and he would have hit a dead end."*

### MUST BE TRUE BEFORE ANY CARD 9–16
1. **GATE 0 above passed** — the SHA stamp matches the push.
2. ⛔ **`supabase/migrations/20260904b_reset_invitation_expiry.sql` IS APPLIED.** It is **NOT applied
   as of 2026-09-04**. **CARDS 11, 12, 13 and 16 CANNOT PASS WITHOUT IT.** Without it the button is
   present and pressing it produces a red error naming a missing function — which is the honest
   failure, not a silent one, but it is not a pass.
   **Run V1–V7 in the migration footer and paste the OUTPUT**, not a sentence saying it passed.
3. **A PENDING, EXPIRED invitation exists.** Joel's at LAWNS is the real one — ⚠️ **but David
   extended it by hand on 2026-09-04, so it is LIVE again and CARD 11 needs a dead one.** To make
   one without waiting a week, as `postgres`:
   `UPDATE invitations SET expires_at = now() - interval '1 day' WHERE id = '<a pending invite>' AND used = false;`

---

### CARD 9 — a LIVE invite says how long it is good for
**STATUS:** owed · **LAST-PROVEN:** — · **DEVICE:** desktop · 📄 **PRINT-PROVABLE** (shares one print with CARD 10) · **COVERS:** #274
**TENANT:** LAWNS `ed2e5933` · **ACTOR:** David, or Lauren (OWNER role)
**MUST BE TRUE FIRST:** GATE 0. A pending invitation that has **not** expired. Migration NOT required — this card is pure client.
1. Open **`/team` → Users** and click the name of somebody badged **Invited**.
2. Scroll to the **Invite — link & QR** card.
3. Read the line directly under the "hasn't joined yet" sentence.
**EXPECT, EXACTLY:** a line reading **`valid until <day> <month>`** — e.g. `valid until 11 September` — in green, with **no** ⚠️. Card border is the normal grey.
**FAIL LOOKS LIKE:** 🔴 **no such line at all.** That is the pre-#274 bundle and it is the entire defect — go back to GATE 0. Also a fail: a relative phrase (*"expires soon"*), a US-ordered date (*"September 11"*), or a bare number.
**THIS CARD CANNOT PROVE:** that the date is *correct*. Cross-check it against `SELECT expires_at FROM invitations WHERE id = '<id>'` if you want the value verified as well as present.

### CARD 10 — the button says what it will do before you press it
**STATUS:** owed · **LAST-PROVEN:** — · **DEVICE:** desktop · 📄 **PRINT-PROVABLE** (same print as CARD 9) · **COVERS:** #274
**TENANT:** LAWNS `ed2e5933` · **ACTOR:** David or Lauren
**MUST BE TRUE FIRST:** CARD 9's screen is open. **Do not press anything.**
1. On the same **Invite — link & QR** card, look below the QR, under a thin divider.
2. Read the button and the sentence beneath it.
**EXPECT, EXACTLY:** a button reading **`Reset invite`**, and under it: *"Gives this invitation another **7** days. **The link and QR above do not change** — anything already sent to <name> starts working again."*
**FAIL LOOKS LIKE:** no button; a button reading *"Resend"* or *"New link"* (both promise the one thing this must never do — a new token orphans the member row); or a button with no sentence under it.
**THIS CARD CANNOT PROVE:** that the button works. That is CARD 11. **It proves the promise**, which is the half that decides whether David trusts it in front of a customer.

### CARD 11 — 🔴 THE ONE THAT MATTERS. An expired invite resets, and the QR does not change.
**STATUS:** owed · **LAST-PROVEN:** — · **DEVICE:** desktop · 🖱 **NEEDS INTERACTION** · 🔧 **NEEDS SETUP** (the migration + a dead invitation) · **COVERS:** #274
**TENANT:** LAWNS `ed2e5933` · **ACTOR:** David, or Lauren (OWNER role — she holds `team:create`)
**MUST BE TRUE FIRST:** migration **applied**; a **pending, expired** invitation exists (see setup step 3).
1. Open **`/team` → Users** → that person → **Invite — link & QR**.
2. **BEFORE PRESSING ANYTHING**, screenshot or copy the full link out of the box. You need it in step 6.
3. Confirm the card reads **`⚠️ expired <day> <month>`** in red, with a red-tinted border, and the sentence *"…this link no longer works. Reset it and the same link and QR below start working again."*
4. Press **`Reset invite`**. The button reads **Resetting…** briefly.
5. **EXPECT:** the line flips to **`valid until <a date 7 days from today>`** in green, the ⚠️ is gone, and the border returns to grey.
6. 🔴 **COMPARE THE LINK IN THE BOX TO THE ONE YOU COPIED IN STEP 2. THEY MUST BE CHARACTER-FOR-CHARACTER IDENTICAL.** This is the whole safety property of the build.
7. Open that link in a private window. **EXPECT:** the **Join <business>** form, not the expired screen.
**FAIL LOOKS LIKE:** a red error under the header (read it — *"you do not have permission"* means the actor lacks `team:create`; *"can no longer be reset"* means the invitation is already accepted or withdrawn; a message naming a missing function means the migration is not applied). 🔴 **AND THE WORST FAIL, WHICH LOOKS LIKE A PASS: the token in step 6 has CHANGED.** Everything on screen would look right and every QR already sent to that person would be dead forever.
**THIS CARD CANNOT PROVE:** that the audit row was written. That is CARD 12.

### CARD 12 — the reset is on the record: who, when, whose
**STATUS:** owed · **LAST-PROVEN:** — · **DEVICE:** desktop (SQL editor) · 🔧 **NEEDS SETUP** · **COVERS:** #274
**TENANT:** LAWNS `ed2e5933` · **ACTOR:** `postgres`, reading
**MUST BE TRUE FIRST:** CARD 11 was performed at least once.
1. In the SQL editor, run:
   `SELECT actor_user_id, action, target_type, target_id, outcome, created_at, detail->>'invited_name', detail->>'new_expires_at' FROM audit_log WHERE action LIKE 'invitation.expiry_reset%' ORDER BY created_at DESC LIMIT 5;`
**EXPECT:** at least one row · `action` = `invitation.expiry_reset` · `outcome` = `success` · `actor_user_id` = **the person who pressed the button, not `businesses.owner_id`** · `target_id` = the invitation's uuid · `invited_name` = the invited person's name · `created_at` = just now.
**FAIL LOOKS LIKE:** zero rows (the audit INSERT is not firing — the reset then has no accountability record at all, which was true of David's own SQL-editor run); or `actor_user_id` NULL under a browser session (the actor is not being carried).
**THIS CARD CANNOT PROVE:** that a REFUSED reset is also audited. That is CARD 13.

### CARD 13 — 🔴 A MANAGER CANNOT RESET, AND THE REFUSAL IS RECORDED
**STATUS:** owed · **LAST-PROVEN:** — · **DEVICE:** desktop (SQL editor, impersonated) · 🔧 **NEEDS SETUP** · **COVERS:** #274
**TENANT:** 🔴 **Test Dave's Tree Nest `f7ec5d67`** — `test obrien` is the only **active MANAGER** in the database. **Running this at LAWNS as Lauren proves nothing: she holds the OWNER role there.**
**ACTOR:** the MANAGER, impersonated
**MUST BE TRUE FIRST:** migration applied.
1. Run **V3** from the migration footer verbatim, substituting the MANAGER's `user_id`.
**EXPECT:** `applied` = `f` · `reason` = *"you do not have permission to reset invitations for this business"* · and the follow-up SELECT returns one `invitation.expiry_reset_denied` row with `outcome` = `denied`.
**FAIL LOOKS LIKE:** 🔴 `applied` = `t`. The MANAGER floor holds **zero `team:*` strings** (`MANAGER_DEFAULT_BUNDLE`, 24 strings, measured), so a `t` here means the gate is not being consulted. Also a fail: `applied` = `f` but **no audit row** — a refusal nobody can see is the incident R-18 exists to capture.
**⚠️ THIS CANNOT BE PROVEN FROM THE UI**, and that is a real gap rather than a shortcut: a MANAGER cannot open `/team` at all (`PermissionRoute permission="team:read"`), so there is no screen on which to observe the refusal. The button is unreachable for the role it refuses.

### CARD 14 — the pending list stops hiding the dead ones
**STATUS:** owed · **LAST-PROVEN:** — · **DEVICE:** desktop · 📄 **PRINT-PROVABLE** (shares one print with CARD 15) · **COVERS:** #274
**TENANT:** LAWNS `ed2e5933` · **ACTOR:** David or Lauren
**MUST BE TRUE FIRST:** a **pending, expired** invitation exists. Migration NOT required — this is the query change, client-side.
1. Open **`/team` → Users** and scroll to **Pending invites**.
2. Read the subhead and every row.
**EXPECT:** the expired person **IS LISTED**, their line reading **`⚠️ MANAGER · expired <day> <month>`** in red while live ones read `<ROLE> · valid until <date>` in amber. The subhead reads *"Not yet accepted. An expired one is still recoverable — open that person to reset it."*
**FAIL LOOKS LIKE:** 🔴 **the expired person is absent.** That is the pre-#274 filter still in place, and it is the reason Joel vanished from every screen the day his invite died — not marked stale, simply gone, as though he had never been invited.
**THIS CARD CANNOT PROVE:** that `/settings` does the same. That is CARD 15.
**⚠️ ALSO CHECK, and it is deliberate:** there is **no Reset button on this row**. E7 — *"a control that changes one record lives where that record is opened, not on the row."* A Reset button here would be a fail, not a convenience.

### CARD 15 — the second team surface says the same thing in the same words
**STATUS:** owed · **LAST-PROVEN:** — · **DEVICE:** desktop · 📄 **PRINT-PROVABLE** (same print as CARD 14) · **COVERS:** #274
**TENANT:** LAWNS `ed2e5933` · **ACTOR:** David or Lauren
**MUST BE TRUE FIRST:** the same expired invitation as CARD 14.
1. Open **`/settings`** and scroll to the team block → **Pending invites**.
**EXPECT:** the same person, the same sentence — **`⚠️ expired <day> <month>`** — and the subhead *"Not yet accepted. Reset an expired one from Team → that person."*
**FAIL LOOKS LIKE:** the row absent; or present but phrased differently from `/team` (*"Expires 3 September"*). 🔴 **A DIFFERENT SENTENCE IS THE FAIL, not a cosmetic difference** — both surfaces call one shared `invitationValidity`, so a divergence means one of them has grown its own copy, which is the drift STD-011 names.
**THIS CARD CANNOT PROVE:** anything about resetting. `/settings` has no per-person page, so under E7 it correctly carries the mark and not the control.

### CARD 16 — Reset PIN no longer lies to somebody who has never joined
**STATUS:** owed · **LAST-PROVEN:** — · **DEVICE:** desktop · 🖱 **NEEDS INTERACTION** · **COVERS:** #274
**TENANT:** LAWNS `ed2e5933` · **ACTOR:** David or Lauren
**MUST BE TRUE FIRST:** GATE 0. A member badged **Invited** (never accepted, so `user_id` is NULL). Migration NOT required.
1. Open that person in **`/team` → Users** → scroll to **Reset PIN**.
**EXPECT:** the **Reset PIN** button is **greyed and unclickable**, with a 🔒 note reading *"A PIN unlocks an account, and <name> doesn't have one until they accept their invite. Reset the invite above instead."*
2. Now open somebody who **has** joined (badged **Active**). **EXPECT:** the button is live and green.
**FAIL LOOKS LIKE:** 🔴 **the button is pressable on the Invited person and prints "PIN revoked. Share this reset link:".** That was the behaviour until this build: it nulled a `pin_hash` that was already null and handed over a link to a sign-in form the person has no credentials for. Also a fail: the button greyed with **no explanation** — that is the mystery-lock §6 r13 forbids, and it is a different defect from the one being fixed.
**THIS CARD CANNOT PROVE:** the **other** half of the `armPinReset` fix. A zero-row RLS refusal now throws instead of reporting success, but reproducing it needs an OWNER-role member who is not `businesses.owner_id` pressing Reset PIN on a joined member — **and at LAWNS that is Lauren, so it is reachable**: if she presses it and sees *"the PIN was not revoked — you may not have permission"* instead of a reset link, that is the fix working. **Recorded here rather than given its own card because it is a refusal path nobody has confirmed is still refused** — Stage 2 may already have widened it.

---

## WHAT THIS TEST DOES **NOT** COVER — named, not silently absent

- **STAGE 2 (AUTHORITY) IS NOT BUILT.** An OWNER-role member **still cannot assign a role** — the dropdown calls `assign_member_role`, whose actor gate is still `businesses.owner_id`. Expect a refusal there and do not record it as a failure of this test.
- **Inviting someone as an OWNER** is refused for anyone but the account holder in this Stage. That is **Lightning's call, not David's**, and it is flagged for overrule: promotion belongs in Stage 2's audited door rather than arriving early through the invite path.
- **The other ~21 owner-only tables are untouched.** This pass widened three.
- **`docs/reference/` is still untracked**; the three `docs/inventory-*.md` files still read `Last updated: 2026-06-13`.
- 🔴 **NOTHING HERE PROVES A SECOND INVITE IS SAFE, BECAUSE IT IS NOT.** `create_invitation` INSERTs a `business_members` row with no dedup, and the table has no unique index, so inviting the same person twice mints a second inactive row and the accept leaves one a permanent orphan `removeMember` will not clear. **Do not test by re-inviting.** The durable fix (a partial unique index) is **OWED** — see the ledger row for its blocker.
- **No card proves the `/join` copy change.** The expired screen now says *"Ask whoever invited you to reset it, and this same link will start working again. Keep it."* — proving it means letting an invitation actually expire, or hand-expiring one and opening its link in a private window. Worth doing alongside CARD 11 step 2, and **recorded as uncovered rather than quietly assumed**.
