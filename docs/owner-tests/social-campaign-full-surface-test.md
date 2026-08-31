# SOCIAL / CAMPAIGN GENERATION — FULL-SURFACE OWNER TEST

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> One glance, no dashboard, no `git log`. *(GATE 0 · OP-15 · paid for on 2026-08-31: a whole
> session was spent hunting a defect in code that was never deployed.)*

> **Rendered board:** open `owner-tests.html` (a PURE renderer — it parses this file live and holds
> no data of its own). Sibling of `stories.html` / `status.html`.
>
> **This file is the ONLY source of truth for the social/campaign generation owner-tests.** It is
> STANDING — run it after any change to `packages/shared/src/campaigns/generate.ts`,
> `packages/shared/src/social/generate.ts`, `api/campaigns.ts`, or `api/social/generate-posts.ts`.
> A per-build proof is a FILTER (`COVERS: #NNN`), never a second doc.

**Purpose:** this surface writes text that publishes **under the owner's name, on the owner's own
feed**. That is the reason it earns a board of its own: every other capability's defect costs the
owner time or money, and this one costs the owner their word.

**Why this exists (the defect the first card defends against):**

🔴 **There was NO anti-fabrication instruction anywhere in the generator, and the prompt leaned the
other way.** `campaigns/generate.ts:19` asked for posts that are *"warm, local, **specific**"* and
the user prompt repeated it — and **"specific" with no facts to be specific about is an instruction
to invent some.** The story that requires the fix is *"Truth in advertising — suggest facts, never
censor, keep the record"* (`user_stories.md` § NEEDED): **TRACE NEVER ORIGINATES AN UNVERIFIED
FACTUAL CLAIM** — *"a fabricated energy-saving percentage in her Instagram feed is her liability,
not ours."* Found 2026-08-23 (ledger #194), fixed 2026-08-23 (ledger #197), owner-proof owed.

⚠️ **AND THE HONEST LIMIT THAT MAKES THIS CARD THE ONLY PROOF THERE IS: `npm run verify` CANNOT TEST
A PROMPT CHANGE.** No probe can assert that a model stopped inventing numbers. A test asserting the
instruction string is present would assert a **CONFIGURATION** and call it covered — **STD-025's
exact shape** — so one was deliberately not written. **This card is the entire control.** Until
David runs it, the fix is a claim.

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

- [ ] **① SHA is live** — the `?debug=1` DebugPanel stamp matches `git log -1 --format=%h`
      (this build: **`c020560`**). ✅ **ALREADY PROVEN ONCE MECHANICALLY AT CLOSE-OUT, FROM THE DEPLOYED
      BUNDLE RATHER THAN THE VERCEL DASHBOARD:** the live bundle moved `index-Nn14LRrJ.js` → **`index-B4pdsrLq.js`**,
      and that new bundle **CONTAINS the string `c020560`** (fetched from `cultivar-os.vercel.app`, not
      read off a deployment list). Confirm the `?debug=1` stamp still reads `c020560` before you begin.
- [ ] **② NO MIGRATION NEEDED** — this build is one line of system prompt plus docs. **Nothing to
      apply.** No schema change, no policy change, no new permission string.
- [ ] **③ 🔴 THE PROMPT CHANGE IS SERVER-SIDE, SO A HARD-REFRESH IS NOT ENOUGH ON ITS OWN.** The
      generator runs in `api/campaigns.ts`, not in the browser bundle. The DebugPanel SHA proves the
      FRONTEND is current; the same Vercel deployment carries the function, so ① covers both — but
      **do not reason from a stale generation you triggered before the deploy went READY.** Generate
      fresh.

---

## THE CARDS

### CARD 1 — a week of posts with NO facts supplied invents NO facts
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #197 — the anti-fabrication instruction; story *"Truth in advertising"*
SIGNAL: none — **there is deliberately no trace line for this.** A `[TRACE:*]` emit could only report
that the instruction was sent, not that the model obeyed it. **The proof is reading the copy.**

On **Test Dave's Tree Nest**, create a campaign and **leave the "Context for the AI" box EMPTY** —
that is the whole point of the test: give the generator nothing factual to work with and see what it
does with the word *specific*. Set a name, a type and a date range, pick a product focus, and
generate. Let it write the full set across every channel you have enabled.

Then **read every line of every post.**

**PASS:** not one post contains a number, claim or credential that you did not supply and that is not
in your own data. Specifically, nothing of this shape appears anywhere:
- a **statistic or percentage** — *"shade trees cut cooling costs 13%"*, *"90% of Texas homeowners…"*
- a **dollar figure** you did not set — a price, a saving, an average spend
- a **date or timeframe** presented as fact — *"since 1987"*, *"in just 3 weeks"*
- an **award, certification or membership** — *"award-winning"*, *"certified arborists on staff"*
- a **comparative claim** — *"the largest selection in Central Texas"*, *"lowest prices in Leander"*

Posts may still be warm, local and specific about things that are TRUE — the variety, the season, the
service, the yard. **A post that reads a little plainer than before is a PASS, not a regression.**

**FAIL:** any invented number or claim, anywhere, in any channel. 🔴 **One is a failure.** This is not
a rate — a single fabricated statistic on a live feed is the whole defect, and finding one means the
instruction is not holding and the wording needs to change.

⚠️ **If you supplied a factual claim yourself** (in the Context box, or in the campaign name), the
generator repeating it is **correct behaviour and not a failure** — the rule is *never ORIGINATE*,
never *never repeat*. That is why the card says leave the box empty: it isolates what the generator
does on its own.

### CARD 2 — the WEEKLY social generator is a SECOND generator and it is UNFIXED
STATUS: needs-test
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #197 — the same class, one file over, deliberately out of scope
SIGNAL: `[TRACE:socialdraft]` (behind `SOCIALDRAFT_DEBUG`)

🔴 **RECORDED AS A KNOWN HOLE RATHER THAN A TEST, because there is nothing yet to prove.** The
campaign generator (`campaigns/generate.ts`) now carries the anti-fabrication instruction. The
**weekly social-draft generator (`social/generate.ts:47-52`) does not** — and it asks for the same
thing in the same way: *"Write warmly and **specifically** — reference what actually happened."*

**Why this is the sharper observation:** that prompt **already carries three prohibitions**
(*"Never mention prices. Never include customer last names, emails, or contact info."*) — so it is
demonstrably a place where prohibitions live, and the anti-fabrication one is **conspicuously absent
from a list that already has three.**

**No test is written here because the fix is not.** When the instruction lands in the second
generator, this card becomes CARD 1's twin run against `/social/setup` instead of `/campaigns`.
Recorded now so the gap is visible rather than assumed handled (OP-14 clause 2).
