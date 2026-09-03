# HAND-OFF — THE TEST-MODE STOCK SENTENCE, AND FOUR RECORD CORRECTIONS

**For:** the session that owns **`thunder/qbo-review-test-mode`** (worktree `wt-qbo-review`, branch tip `0ab0f09`, ledger **#255**).
**From:** `trace-platform-19` (session `4d8d8c6a`), working on `main`. Ledger **#256**.
**Filed:** 2026-09-02.

> 🔴 **WHY THIS IS A DOCUMENT AND NOT AN EDIT.** David's ruling, this session, verbatim:
> *"A session edits only branches it owns. Work belonging to another session's branch is handed to that
> session, never applied across. One writer per branch."* Filed as **[[R-62]]**.
> I could measure your branch and I could not address your session — it never ran `ListAgents`, so its
> name is not recoverable from disk and the peer `[ref]` is not derivable from a session id. **So the
> hand-off is durable rather than delivered**, which is the failure mode this file is designed around:
> a message needs a live listener, a committed file does not.

---

## 1 · THE STOCK SENTENCE — DAVID HAS RULED IT

You built test mode as **not** depleting stock. That is the reversible direction and it is correct.
His clause — *if the answer is no, the screen must say so* — is honoured with this wording.

**On the persistent banner:**

> **TEST MODE — nothing you do here reaches QuickBooks, and your tree counts do not change.**

**And immediately below it, on any screen where an order is rung up:**

> *Because stock does not move in test mode, this is not a test of whether the system tracks your trees.
> That happens after you switch writes on.*

**Both sentences are required.** The first states the protection. **The second states what is NOT being
proven — and it is the one that matters**, because a screen that only says what it protects lets someone
conclude they have tested something they have not.

⚠️ **Do not shorten it to *"stock is unaffected."*** That reads as a feature. The point is that a
capability she cares about is deliberately not exercised yet, and she should know which one.

**Where it lands (measured on your branch, read-only, 2026-09-02):**

| | |
|---|---|
| `packages/shared/src/business-logic/testMode.ts:94` | `TEST_MODE_BANNER` — today: *"Test mode — nothing is being sent to QuickBooks. Orders you ring up are saved here so you can see what comes out, and they are kept out of your sales figures."* **The stock half is absent.** |
| `packages/shared/src/business-logic/testMode.ts:99` | the second list string — check it does not now contradict the banner |
| `packages/shared/src/components/QboWriteSwitch.tsx:113` | *"Test mode — nothing is being sent to QuickBooks."* — the settings copy, same omission |
| **NEW** | the order-screen sentence has **no home yet** — it is a new string plus a mount on the ring-up surface, not an edit |

⚠️ **Your `testMode.ts:27` and `:89` comments already argue the banner must name BOTH halves** —
*"it says WHAT IS AND IS NOT HAPPENING"*. This ruling agrees with your own header and extends the
halves from *(QuickBooks / orders saved)* to *(QuickBooks / orders saved / **stock**)*.

---

## 2 · FOUR CORRECTIONS OWED ON YOUR OWN #255 RECORD

Recorded here because they belong to your branch's row, which I may not edit.

1. ✅ **`api/dashboard.ts` was overstated — it is LATENT, not live.** **Verified on `main` and on your
   branch: there is no `fetch('/api/dashboard')` anywhere**; the only references are two comments and the
   one-line repo-root shim. Lightning called it a live defect twice and used it to argue for scope. Fixing
   it was still right — it is deployed, reachable, and one of twelve slots — **but the record should say
   latent.** ✏️ Your `orderKind.ts:21` already says exactly this; the ledger row is what needs it.

2. 🔴 **The trap you found is the better justification than the one in the prompt.**
   `.neq('order_kind','test')` **drops every NULL row — the entire real business.** A filter that looks
   obviously correct and silently returns nothing. **That, not the dashboard divergence, is why "which
   orders count" is one function.**

3. 🔴 **The mutant pattern is worth carrying as a NAMED PROPERTY.** Five survived first, four in the
   findings suite, and **every one made the screen shorter, calmer and more confident than the truth.**
   A findings surface **fails toward reassurance**, and a calm screen looks like good news — **so looking
   at it can never find them.** Put that in the owner test in words:
   *a finding MISSING is the failure mode, not a finding being wrong.*

4. ⚠️ **#146 is the SIXTH instance of a probe that never touched its path** — including one green since
   27 August that would have passed on a **deleted** guard so long as a comment still named the function.
   Six in a fortnight. **Worth asking whether the cap should assert that a probe's TARGET IS REACHED, not
   only that the probe passes.** ([[R-33]]'s class — a check that cannot disagree is not a check.)

---

## 3 · NUMBERING — YOUR IDS ARE SAFE, AND `main` HAS MOVED

- **You hold `R-55…R-61` and ledger `#255`, claimed at 13:45. They are yours — earliest claim keeps its
  number.** Do not renumber them on merge.
- **`main` now holds `R-62` and ledger `#256`** (filed 2026-09-02, after yours, deliberately skipping your
  range rather than colliding with it).
- 🔴 **A Stage 1 prompt in flight instructs that *"selling does not require seeing cost"* be minted as
  `R-55`. That id is yours and the instruction is dead** — whoever files it takes the next free id at file
  time and says which they took.
- 🔴 **NEVER LEAVE A GAP:** if any of `R-55…R-61` is abandoned, file it as **withdrawn with its reason**
  rather than deleting it. A hole in a sequence reads as a lost record and someone will go looking for it.
- ✅ **The close-out ledger's merge-state column was five rows stale and is now correct** (#252, #251,
  #250, #248, #247 are all in `main`). **Your branch is the one genuinely NOT merged** — that is now true
  in the file rather than true by accident.

---

*Delete this file when the work lands, in the same commit that lands it.*
