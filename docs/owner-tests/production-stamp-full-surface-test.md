# OWNER TEST — THE PRODUCTION STAMP (`built <time> · <sha> · <where>`)

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha> · <where>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**, because
> Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> 🔴 **AND THE LAST TOKEN MUST READ `prod`.** Anything else is **not production**, and the SHA being
> right does not rescue it: an amber **`PREVIEW <branch>`** chip, an amber **`prod⚠ <branch>`**
> (production, but built from a branch), **`env?`** (target unknown), or **`local`**. **A preview
> serves the RIGHT CODE at the WRONG TARGET — the stamp's SHA matches and the screen is still not
> evidence.** That is tech-debt **#280 ②**, and ledger **#303** was recorded complete on
> preview-only deploys. **If the chip is amber, stop.** *(ledger #321.)*
> *(GATE 0 · OP-15.)*

**Capability:** operator provenance — owner-prove GATE 0 (OP-15) · tech-debt **#280 ②**
**Ledger:** #321 · **Branch:** `main` (merged `15fe4f2`) · **Rulings:** OP-15 · OP-14
**Tech-debt:** **#280** (🟡 PARTIAL — ② is OBSERVABLE, no cap asserts it; ① still owed)
**Surfaces:** `<VersionStamp>` — pinned bottom-centre, **every screen, every user, signed in or not**.
**Last updated:** 2026-09-14
**Proven:** 1 of 5 · **Owed:** 3 · **needs-test:** 1

> 🔴 **THIS BOARD EXISTS BECAUSE IT WAS MISSING.** Ledger #321 changed a surface that renders on
> every screen and wrote the GATE 0 clause into **40 boards** — and created **no card for the stamp
> itself**. That is an OP-14 gap in the build that was tightening OP-14's neighbour, and it was
> found when David reported the live run and there was nothing to flip. Filed 2026-09-14.
>
> 🔴 **CARD 1 IS THE ONE THAT MATTERS, AND IT IS THE ONLY ONE DAVID HAS RUN.** The other four are
> the cases the stamp exists to distinguish. **Thunder never marks a card `covered`.**

---

### CARD 1 — the live production stamp ends in `· prod`
STATUS: covered
LAST-PROVEN: 2026-09-14 (David, live run on `cultivar-os.app` — *"the foot of the screen reads · prod"*)
DEVICE: any

**Do this.** Open `cultivar-os.app`. Read the line pinned at the bottom-centre of the screen.

**It must read** `built <time> · <sha> · prod` — three tokens after the word *built*, the last of
them `prod`, rendered in the same muted grey as the rest of the line, **with no coloured chip**.

**It must NOT** end in an amber chip of any kind, and must not be missing the third token entirely
(a stamp with only `built <time> · <sha>` is a bundle built before ledger #321 — see CARD 5).

⚠️ **Match the `<sha>` against `git log --oneline origin/main -1`, not against a SHA written here.**
Any push to `main`, docs included, moves it — this file cannot know the current one.

✏️ **Thunder had read the same thing from the deployed bundle hours earlier and that was NOT
enough** (OP-14): it traced `jJ("production","main")` → `{label:"prod", loud:false}` through the
shipped minified code, which is evidence about the artefact and **not a person looking at a
screen**. Both readings are kept — the first is why the build was reported complete, David's is why
this card is closed.

---

### CARD 2 — 🔴 a PREVIEW deploy shouts, and says not to trust it
STATUS: owed
LAST-PROVEN: never
DEVICE: any

**Do this.** Open any Vercel **Preview** URL for a branch (a PR preview link, or the preview
deployment of any unmerged branch).

**It must read** `built <time> · <sha> · PREVIEW <branch>` with **`PREVIEW <branch>` in an amber
chip** — dark red-brown background, light amber bold text — unmistakably different from the muted
line beside it. Hovering it (desk only) shows *"A PREVIEW deployment, not production. Do not record
an owner-proof from this screen."*

🔴 **THIS IS THE DEFECT THE WHOLE BUILD EXISTS FOR.** Ledger **#303** was recorded complete *"with
only Preview deploys"*. Before #321 a preview and a production deploy of the **same commit** were
byte-identical on this line: same SHA, same stamp, GATE 0 passed on both.

✏️ **A build-time equivalent was proven pre-merge** — a real `VERCEL_ENV=preview` build produced a
bundle containing `PREVIEW`, the branch name, and that exact sentence. **That is not this card.**
This card is the chip on a screen.

---

### CARD 3 — a production deploy built from a branch shouts too
STATUS: owed
LAST-PROVEN: never
DEVICE: any

**Do this.** Only if you ever promote a non-`main` branch to production. Do **not** manufacture one
for this card — it is not worth a production deploy.

**It must read** `… · prod⚠ <branch>` in an amber chip, naming the branch it was built from.

**Why it is here at all.** Promoting a branch is legal and occasionally right. It is also exactly
the state where *"is this what `main` says?"* and *"is this production?"* give different answers,
and the stamp should not let that pass quietly.

⚠️ **This is a judgement Thunder made without asking** (flagged in #321): a promoted branch could
equally have been left quiet. **If you would rather it stayed quiet, say so and it is one line.**

---

### CARD 4 — the stamp survives a broken screen
STATUS: owed
LAST-PROVEN: never
DEVICE: any

**Do this.** On any screen where something has failed to load — a page that errored, a tile that
did not render, a view you reached while offline — look at the bottom of the screen.

**The stamp must still be there.** It takes no context, no network and no auth, and it renders for
signed-out users. It is deliberately **not** behind the debug gate.

**Why.** GATE 0 reads this stamp to decide whether a screen is evidence at all. If it lived inside
the debug panel, **a broken deploy could hide its own tell** — invisible exactly when it matters.

---

### CARD 5 — 🔴 an OLD bundle is distinguishable from a production one
STATUS: needs-test
LAST-PROVEN: never
DEVICE: any

**Why this is `needs-test` and not `owed`:** it cannot be run on demand any more. It required a
bundle built **before** ledger #321, and `main` now carries the stamp everywhere. The evidence
below was captured while it was still possible; **recording that rather than leaving the card
silent is the point** (OP-14 clause 2).

**What was observed, 2026-09-14, on `cultivar-os.app` minutes before the #321 merge:**
the live bundle rendered `built Sep 14, 12:25p · 02ea7d7` — **two tokens, no third.**

**Why it matters.** This is the argument for stamping production **positively** rather than leaving
it blank, which is a deliberate deviation from the standard environment badge (§6 r16). Had `prod`
rendered as *nothing*, this old bundle and a correct production deploy would be **identical on the
screen** — and absence cannot carry a claim (A9 *absent is not empty*).
