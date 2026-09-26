# OWNER TEST — BUILT WITH CAI (David's own general business, served at builtwithcai.app)

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha> · <where>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**, because
> Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> 🔴 **AND THE LAST TOKEN MUST READ `prod`.** An amber **`PREVIEW <branch>`**, **`prod⚠ <branch>`**,
> **`env?`** or **`local`** is not production, and the SHA being right does not rescue it.
> *(GATE 0 · OP-15 · ledger #321.)*

**Capability:** — (platform / tenancy — no board capability id) · **Story:** `user_stories.md` → *Built with CAI is a real tenant at builtwithcai.app*
**Build:** ledger **#422** · branch `feat/builtwithcai-home` · **NO MIGRATION — none is owed**
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 5 covered. All 5 owed.**

> 🔴 **WHY THERE IS NO SQL TO PASTE, STATED FIRST BECAUSE IT IS THE MOST USEFUL FACT HERE.**
> `businesses.business_type` is **`text NOT NULL DEFAULT 'nursery'` with NO CHECK constraint and no enum**
> (read live 2026-09-26). **`'general'` is already legal.** And the app already creates a general business
> through its own UI — `AddBusiness.tsx:15` mounts the shared signup with `businessType: 'general'`.
> **So the tenant is made by signing up, not by SQL, and nothing needs applying.**

> 🔴 **WHO CAN RUN WHAT.**
> **CARDS 0a, 0b, 1, 2 — you, now, on your own login.** CARD 0a is at the registrar and CARD 0b is in the
> Supabase dashboard; neither is in the app. **CARD 3 needs Andrew or Erin at their own device** and cannot
> be run by you — signing in as them proves nothing about their invitation.
> ⚠️ **CARD 1 creates a REAL tenant on the live database.** It is additive and touches no LAWNS data, but it
> is not a dry run.

---

## CARD 0a — builtwithcai.app points at Vercel (at GoDaddy)
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

🔴 **THIS IS A REPLACE, NOT AN ADD.** `builtwithcai.app` already resolves — it has **two A records pointing at
GoDaddy's parking service** and returns HTTP 200 today. Leaving them in place means the domain keeps
resolving to parking for some queries.

1. **First, in Vercel:** open the **cultivar-os** project → **Settings → Domains** → **Add** → `builtwithcai.app`.
   Vercel will then **display the exact record it wants.** ⚠️ **Use what Vercel shows you.** The value below is
   what `cultivar-os.app` uses today, measured live — it is the strongest available evidence and should match,
   but Vercel is the authority on its own IP.
2. **At GoDaddy → `builtwithcai.app` → DNS:**
   - **DELETE** the A record `@` → `3.33.130.190`
   - **DELETE** the A record `@` → `15.197.148.33`
   - **ADD** `A` · host `@` · value **`216.198.79.1`**
   - *(optional)* **ADD** `CNAME` · host `www` · value `cname.vercel-dns.com`
3. ⚠️ **Also turn OFF GoDaddy domain forwarding for this domain if it is set** — forwarding re-creates the
   parking records and will silently undo step 2.
4. Wait, then open **https://builtwithcai.app**.

**PASS:** the browser shows **the TRACE login page** with a **valid certificate** (padlock, no warning).
**⚠️ IF IT DOES NOT LOAD AT ALL, THAT IS EXPECTED FOR A FEW MINUTES AND IS NOT A WRONG RECORD.** `.app` is on
the **HSTS preload list**, so HTTPS is mandatory and there is no http fallback — the page cannot appear until
Vercel has issued the certificate. Vercel's Domains panel will say so.
**FAIL:** you still see a GoDaddy parking page (a record was not deleted, or forwarding is still on).

---

## CARD 0b — login works at the new domain, and the old one is repaired
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

🔴 **ONE OF THESE FOUR LINES IS A REPAIR THAT HAS NOTHING TO DO WITH BUILT WITH CAI, AND I AM NOT LISTING THE
NEW DOMAIN WHILE LEAVING THE LIVE ONE BROKEN.** Read live 2026-09-26: `site_url` and the redirect allow list
both contain **only** `https://cultivar-os.vercel.app` — **`cultivar-os.app`, the domain you actually use, is in
neither.**

1. Supabase → **Authentication → URL Configuration**.
2. **Site URL:** set to `https://builtwithcai.app`
   *(recommended — per the 06-22 rulings the `.app` core is the platform front door. **Overrule in one word**
   if you would rather it stay on Cultivar; nothing else here depends on it.)*
3. **Redirect URLs** — add all four:
   ```
   https://builtwithcai.app/**
   https://www.builtwithcai.app/**
   https://cultivar-os.app/**
   https://cultivar-os.vercel.app/**
   ```
4. Sign in at **https://builtwithcai.app** with your own login.

**PASS:** you reach the dashboard.
⚠️ **A WORKING LOGIN DOES NOT PROVE STEP 3 WAS DONE.** Auth is email/password with confirmation off, and a
plain password login **never consults the redirect list** — it will very likely work even if you skip step 3.
What step 3 actually fixes is **password-reset and any emailed link**, which otherwise bounce to the old
`.vercel.app` host. **Do not read the dashboard as evidence for the allow list.**
🔴 **AND A PASSKEY / FACE UNLOCK REGISTERED ON `cultivar-os.app` WILL NOT WORK ON `builtwithcai.app`** — the
WebAuthn Relying-Party id is the hostname (`OwnerSignup.tsx:570`), so it is domain-bound by design. Expect to
re-register the gesture on the new domain. Password login is unaffected.

---

## CARD 1 — Built with CAI exists, as a general business, with no address
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

1. Signed in at **https://builtwithcai.app**, go to **/add-business** (top-left menu → **Admin → Add Business**).
2. **Business name:** type **`Built with CAI`** — 🔴 **exactly that, including the capital CAI.** The Presence
   Audit's enabling SQL (#421) finds this tenant **by name plus your ownership**; a different spelling and it
   finds nothing.
3. **Your name / email:** already yours (you have a session — the form skips email/password).
4. 🔴 **ADDRESS: LEAVE IT COMPLETELY BLANK.** Do not type anything. The field shows a greyed example
   (`123 Main St, Austin TX`) — **that is placeholder text, not a value.** A blank address is never written,
   so the column stays empty. **Never put your home address here.**
5. **Phone / website:** your call — both are optional and neither is used by anything in this build.
6. Submit.

**PASS — all four:**
- You land on the dashboard and the business name reads **Built with CAI**.
- The business **picker** (top of the dashboard) now lists **Built with CAI alongside LAWNS Tree Farm** — both,
  because the type fence is deliberately off today.
- Switching to **LAWNS** still shows LAWNS exactly as it always did — **its data is untouched**.
- **No address appears anywhere for Built with CAI.**

⚠️ **WHAT YOU WILL SEE THAT LOOKS WRONG AND IS NOT A FAILURE OF THIS CARD — READ THIS BEFORE YOU JUDGE THE
SCREEN.** The dashboard will show **the same tiles LAWNS shows**, including **QR Checkout**, **Inventory
Intake**, and a readout labelled **Plants**. That is **measured and expected**: exactly one tile in the whole
registry is tagged to a vertical, so the `general` filter has almost nothing to filter. It is filed as
**tech-debt #367** and the per-tile list is **your decision**, not a defect to fix on the spot.
🔴 **AND THE ADDRESS CANNOT BE FILLED IN LATER — nothing in the app can edit it** (tech-debt #368). That is
what makes step 4 safe, and it is also a real gap. **If you type an address by mistake, tell me** — undoing it
needs a direct database write.

---

## CARD 2 — Andrew and Erin are invited
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

**Role: MANAGER for both.** *Recommended, one line why:* MANAGER carries the operating permissions without
owner authority, and it is the role Erin already holds on Test Dave's Tree Nest. ⚠️ **PRESENCE-AUDIT owns the
permission its screen requires and I did not read their code** (their build, #421) — **if their screen needs a
permission MANAGER lacks, theirs is the answer, not mine.**

1. On **Built with CAI**, menu → **Settings → Team** → invite.
2. **Erin:** 🔴 **use `erinrobrien1@gmail.com`.** There are **two Erin accounts** on the system
   (`erin@mail.com` from 2026-08-25 and `erinrobrien1@gmail.com` from 2026-09-21). Inviting the wrong one
   creates a member who cannot sign in as herself.
3. **Andrew:** 🔴 **he has NO account at all** — measured; there is no `andrew@…` user on the system. His
   invitation is a genuine first-time signup, so send it to the address he will actually use.

**PASS:** both appear on the Built with CAI roster as MANAGER, invitation pending.

---

## CARD 3 — Andrew and Erin can each get in (THEY run this, not you)
**STATUS:** owed · **DEVICE:** desktop or phone · **LAST-PROVEN:** —

🔴 **YOU CANNOT RUN THIS CARD.** Signing in as them from your own browser proves nothing about their
invitation — it proves yours works. Each person, on their own device, with their own credentials.

1. They open their invitation and set a password (Andrew creates his account; Erin signs in with her existing
   `erinrobrien1@gmail.com`).
2. They go to **https://builtwithcai.app** and sign in.

**PASS:** each lands **in Built with CAI**, sees the business name at the top, and can open the dashboard.
**FAIL / TELL ME:** either of them lands in a *different* business, sees a "no business" state, or the
invitation link is refused as used or expired.
⚠️ **A KNOWN HAZARD WORTH NAMING SO IT IS NOT MISREAD AS THEIR MISTAKE:** re-inviting the same person mints a
second membership row and nothing prevents it (tech-debt **#183**). If you have to re-send an invitation and
the roster then looks doubled, that is #183, not something they did.
