# OWED CLAUSES — drafted, unnumbered, awaiting David

**What this is:** clauses that a build needed, that `ui-control-standards.md` does not answer, drafted
in the form they would take **and deliberately not filed**. Numbering is David's; so is the wording.

**Why it exists.** The order is `① the design doc is updated ② THEN the display widget is updated,
once ③ surfaces use the widget` — *"where the doc is SILENT it is AMENDED BEFORE the widget is
touched. A question the standard does not answer is a GAP in the standard; answering it inside a
component is how the next surface comes to re-derive it. Silence is not permission to decide
locally."*

That rule assumes the doc is writable when the gap is found. On **2026-09-04** it was not: another
session held `docs/standards/ui-control-standards.md` mid-edit (minting E7), and a second held
`docs/RULINGS.md`. David's instruction: *"Do not wait. The other session is mid-edit and I am not
blocking a build on a docs merge. Draft all three in my register, unnumbered, and hand them over
with the build."*

🔴 **THIS FILE IS A STAGING AREA, NOT A SECOND STANDARD.** Two documents answering one question
drift, and the copy nobody reads is the one that drifts. **A clause leaves here by being filed into
`ui-control-standards.md` under a number David assigns — and is DELETED from this file in the same
commit.** An entry that has been here across more than a couple of sessions is a signal that it was
never really needed, and should be withdrawn rather than aged.

⚠️ **NOTHING BELOW IS BINDING.** The build that prompted each clause states in its own code what it
did and why; these are proposals about what the *next* surface should be able to look up.

---

## ① TEST / OPERATOR FACILITY PLACEMENT

> **A CONTROL THAT EXISTS FOR THE OPERATOR RATHER THAN THE OWNER DOES NOT RENDER ON THE OWNER'S
> SURFACE — IT IS ABSENT, NOT DISABLED AND NOT EXPLAINED.**
>
> A rehearsal loader, a fixture switch, a replay door, a seed button: these exist so *we* can drive
> a surface without the real thing behind it. They belong to the account owner at most, and to a
> separate operator surface at best. **The absence carries no explanation**, because there is
> nothing the reader is waiting on permission to do.
>
> ⚠️ **THIS IS NOT AN EXCEPTION TO THE MYSTERY-LOCK RULE, AND THE DISCRIMINATOR IS WHAT THE READER
> CAN SEE.** §6 r13 governs a FIELD OR CONTROL THE READER CAN SEE, greyed with no reason — they
> know something is there and cannot learn why it is shut, so it must say. Here there is no control
> and no state: a whole tool that is not theirs is simply not on the page, the way a billing screen
> is not on a staff member's page. **An explained absence of a tool the reader was never going to
> notice is the page explaining its own internals to someone who did not ask.**
>
> ⚠️ **AND IT KEEPS ITS OWN VISUAL VOCABULARY.** An operator facility must not wear the palette a
> surface uses for WARNINGS ABOUT STATE. When both are amber they read as the same kind of thing,
> and the facility competes for attention with whatever the surface actually exists to offer.

**What provoked it (2026-09-04):** the QuickBooks accounting card carried a `TEST FACILITY — load a
saved read instead of connecting` box, in `#fffbeb`/`#92400e` — **byte-identical to the test-mode
banner a few hundred pixels above it on the same card**. One is a warning that writes are not
reaching QuickBooks; the other is a rehearsal tool. David: *"I said make it visibly a test facility;
I never said she must not see it. My omission, corrected now."* And: *"the red is wrong on it. That
colour belongs to the test-mode banner — a warning about state. This is a facility, not a warning,
and it is competing with the one thing she should notice, which is a single button."*

⚠️ **THE COLOUR NAME IN THAT INSTRUCTION WAS OFF BY ONE AND THE DIAGNOSIS WAS EXACT.** The box was
amber, not red — and being the *same* amber as a state-warning is worse than being the wrong colour
outright, which is the half worth encoding.

**How it was built pending a ruling:** owner-gated (absent for a manager) and recoloured to neutral
slate. Amber now means one thing on that card again.

**⚠️ THE HARD PART, AND IT IS WHY THIS SHOULD BE RULED RATHER THAN INFERRED:** *operator* is not a
role in the model. The gate used was `businesses.owner_id`, which is the closest available and is
not the same claim. **A ruling that names operator surfaces as a category is a bigger change than a
clause** — and the clause above is written so it does not require one.

---

## ② PRE-FIRST-RUN STATE OF A RESULTS SURFACE

> **A SURFACE THAT REPORTS OUTCOMES SHOWS NO OUTCOMES BEFORE IT HAS BEEN RUN. BEFORE THE FIRST RUN
> IT SHOWS WHAT IT WILL DO AND THE CONTROL THAT DOES IT — NOTHING ELSE.**
>
> The three states of a check — **fired · did not fire · could not run** — are ANSWERS, and answers
> require a question. Before the run nobody asked one, so there is nothing to be honest or
> dishonest about. **A row saying "not checked" before anything has been checked is not a
> disclosure; it is noise wearing a disclosure's clothes.**
>
> 🔴 **AND ITS QUOTED, ILLUSTRATIVE OR REFERENCE FIGURES MUST NOT APPEAR AT ALL BEFORE THE RUN.** A
> figure carried for comparison is intelligible only beside a measured one. Standing alone on an
> untouched page it reads as a statement about the reader's own business that the reader never
> requested and cannot check.
>
> ⚠️ **THIS DOES NOT WEAKEN THE RULE THAT UNRUN CHECKS ARE SHOWN AFTER A RUN.** A hidden row after
> a run is a row the reader assumes passed, which is the more expensive failure of the two. The
> clause is about the empty state and only about the empty state — and the two must be checked in
> one sitting, or fixing either one breaks the other.

**What provoked it (2026-09-04):** the books-review panel rendered unconditionally. Measured on an
untouched page: **16 rules, 0 measured, 16 carrying a figure quoted from a 29 August analysis** —
so the screen opened by telling the business owner *"504 lines carrying $614,053"* and *"881 of
1,469"* about her own books, under sixteen grey rows saying *"not checked"*. David: *"Sixteen 'not
checked' rows carrying 29 August figures, before I press anything, is the system explaining its
internals to someone who has not started."*

**How it was built pending a ruling:** the panel is mounted only once a read exists, on the same
condition the report button already used — one fact, asked one way.

---

## ③ OWNER-TOOL PLACEMENT ON A SHARED SURFACE

> **A CONTROL WHOSE ACT IS OWNER-CLASS DOES NOT SIT ON A SURFACE A NON-OWNER OPENS FOR A DIFFERENT
> PURPOSE. GATING IT IS NOT THE SAME AS PLACING IT.**
>
> Server-side authority and screen composition are different questions, and answering the first is
> not answering the second. A panel that refuses a manager still occupies her screen, still has to
> be scrolled past, and still invites her to wonder what it is for. **Ask "why is this on her
> screen" before "may she press it" — the second question has a satisfying answer that leaves the
> first one untouched.**
>
> ⚠️ **AN OWNER-CLASS ACT IS ONE THAT CHANGES WHAT THE BUSINESS HOLDS RATHER THAN WHAT IT IS
> DOING TODAY** — importing a company's records, connecting or changing an external system,
> anything whose blast radius is the tenant rather than a transaction. **A verb permission sized
> for one record is not a gate for a whole-company operation**, and it is not a placement decision
> either.

**What provoked it (2026-09-04):** `QboDeliveryIngest` and `QboOrderIngest` are import tools from
earlier builds. They were mounted on the Accounting card because the read panel went above them.
Owner-gating them server-side was correct and did not move them. David: *"Gating them owner-only was
the right fix for the wrong problem — I answered 'she can press it' instead of 'why is it on her
screen.'"*

**How it was built pending a ruling:** both render `null` for a non-owner — nothing to scroll past.
They remain on the Accounting card for the owner, because David's ruling was *"gate them on that,
not on where they sit."*

⚠️ **AND THE PLACEMENT QUESTION IS THEREFORE STILL OPEN, NOT ANSWERED BY THE BUILD.** The obvious
home, `/admin`, is gated on `settings:read` — **which the manager floor holds** — so moving them
there changes the address and not the reach. A real move needs an owner-gated route; the only
existing precedent is `/admin/subscription` at `subscription:read`.

---

## FILED AND REMOVED

*(Nothing yet. An entry leaves this file by being filed into `ui-control-standards.md` under a
number David assigns, and is deleted here in the same commit. A line is added below naming what it
became, so this section is a record of the register working rather than an empty heading.)*
