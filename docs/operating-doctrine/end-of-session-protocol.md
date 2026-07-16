# TRACE — END-OF-SESSION PROTOCOL

> **What this is:** the discipline that keeps `TRACE-SESSION-BOOTSTRAP.md` current so the NEXT session starts current — instead of you re-pasting the whole library and rebuilding Lightning's context from scratch. This is the conversational equivalent of the session-end git-diff drift protocol, applied to the context handoff itself.
>
> **Why it exists:** the bootstrap kept "changing every session" because it grew by accretion (paste CLAUDE.md, then THOUGHTS, then audits, then…). The fix is a FIXED-STRUCTURE bootstrap + a SHORT end-of-session ritual that updates VALUES, never adds new docs to paste. The structure never changes; only the contents do.

---

## The core rule

**The last deliverable of every session is the updated bootstrap.** Tonight's spec, findings, and addendum are the handoff *artifacts* — but they're useless if scattered. The discipline is folding their CONCLUSIONS back into the single front-door doc (`TRACE-SESSION-BOOTSTRAP.md`) so next session you paste ONE thing and Lightning is current.

**Folding back ≠ copying in.** Deep docs stay deep and separate (the reference library). The bootstrap only gets the *map-level* update: a new "what's built" line, a changed "decided" item, the new "in flight" state, a pointer to the new deep doc. The bootstrap stays SHORT. If it's getting long, you're putting territory where the map goes — push detail down to the library and leave a pointer.

---

## The 5-minute end-of-session ritual

At the end of each session, Lightning produces (or David requests) an updated bootstrap by walking these — in order, fast:

1. **§6 IN FLIGHT / TOP OF MIND — rewrite it.** This is the section that changes most. What got committed/decided/built this session? What's the immediate next thing? What's not-yet-done? This is the "where we left off" that saves the most time next session.

2. **§4 WHAT'S BUILT — add/upgrade any line.** Did we discover something already exists (the anti-rebuild win)? Did we build/verify something new? Add it. *Especially* capture "X already exists in Ignition" findings — those are the ones that prevent the most expensive rebuilds.

3. **§5 WHAT'S DECIDED — add any new canonical decision.** Something settled this session that shouldn't be relitigated? One line. (AC-4: settle once, encode, stop relitigating — this is where "encode" happens for decisions.)

4. **§7 LIBRARY — add a pointer if a new deep doc was created.** New spec/audit/findings doc → one row in the table. Don't paste its contents into the bootstrap; just point.

5. **Update the `Last updated` date** at the top.

6. **Update the 🧵 ARC MAP and 📚 CAPTURE INDEX.** Ask three questions, fast: **(a)** did any arc's piece-status change this session (a piece went 🔴→🟡→🟢, or a spine became coherent / dead-ended)? Flip the emoji + the one-line ARC STATUS, and keep the file:line evidence current. **(b)** Did anything get CAPTURED to a doc (a new decision, doctrine, concept, or recon)? Add ONE pointer row to the CAPTURE INDEX — *a capture without an index row is not done.* **(c)** Did anything new get DISCUSSED that isn't placed in an arc yet (an off-course/extra idea, or a conversation-only capture owed a home)? Drop it in the relevant arc's **OFF-COURSE / EXTRA** lane (or the index's ⚠️ conversation-only list) so it isn't re-derived next session. Rule: every arc-piece status and every index row traces to a file:line or doc section — **never populate from memory** (that is the stale-board trap this whole protocol exists to kill); mark ⚪ unverified instead of guessing. This is what makes the two structures self-maintaining instead of one-time.

7. **Reconcile `docs/built-inventory.md` (only if a capability was built/changed/removed this session) — the same self-maintaining move as step 6, applied to "what exists."** For each capability touched: (a) it has a BODY entry reflecting CURRENT state (findable by capability, not just a changelog line on line 4), (b) the entry matches the code with **audit winning on conflict** (describe what IS), (c) a capability built with NO body entry = DRIFT → create it before close, and (d) bump `Last updated:` on line 4 to today. Same "trace to file:line / code, never from memory" rule as step 6 — built-inventory is the ARC MAP's twin for capability existence, and it drifts the same way if not walked. **This is the GATE below, folded into the walk so it is executed every close, not left as a section to remember.** Full statement of force + relationship to the Thunder Step-17 checklist and CLAUDE.md §9: see **GATE — BUILT-INVENTORY RECONCILIATION** below.

That's it. Seven steps, a few minutes. The structure (§0–§7 headings + the 🧵 ARC MAP / 📚 CAPTURE INDEX sections + the reconciliation gate) NEVER changes — you're only editing values. That's what makes it stop "changing every session": the shape is permanent, the contents are live.

---

## What does NOT go in the bootstrap

- Long explanations, full specs, code, detailed audits → those are reference-library docs; bootstrap just points at them.
- "Nice to have someday" ideas → THOUGHTS.md.
- Anything that would make the paste take more than ~2 minutes to read → push it down, leave a pointer.

The bootstrap's job is SPEED: get Lightning oriented in ~90 seconds and pointed at the right deep doc for the task at hand. Every line earns its place by saving session-start time.

---

## Handoff to Thunder (separate, parallel discipline)

Thunder has its own session-end handoff (CLAUDE.md Part 9 / drift protocol). Keep them in sync:
- Decisions Lightning captured this session that affect code → ensure they land in CLAUDE.md / the specs so Thunder sees them.
- Deep docs Lightning produced (specs/findings) → Thunder commits them to the repo; bootstrap §7 points at the committed path.
- The bootstrap is Lightning's front door; CLAUDE.md is Thunder's. They reference the same reference library.

---

## GATE — BUILT-INVENTORY RECONCILIATION (mandatory every close, not optional)

Every session that **builds, changes, or removes a capability** MUST reconcile `docs/built-inventory.md` before the close is complete. This is a GATE, not a courtesy: `built-inventory.md` is the source-of-truth answer to "what exists." Drift here corrupts every future session's orientation — a stale or missing entry is how the next session rebuilds something that already ships. **A close-out is NOT complete until built-inventory reconciles. Same enforcement weight as STEP 0 (the session-open staleness check) and the two-bar rule (BUILDER-COMPLETE vs OWNER-PROVEN).**

For **each capability touched this session**, confirm all three:

1. **Entry reflects CURRENT state.** `built-inventory.md` has a body entry describing the capability's actual state (built / wired / proven), with `Last updated:` on line 4 bumped to today. The top-of-file changelog line is NOT sufficient on its own — the capability needs a body entry a future session can find by capability, not by date.
2. **Entry matches the CODE, and audit wins on conflict.** Where the entry and the actual code disagree, the code is truth — fix the entry to describe what IS, not what was planned or claimed. `built-inventory.md` describes reality, not intent.
3. **No silent drift.** If a capability was built this session but has NO body entry → that is DRIFT → create the entry before close. A capability that ships without a findable entry is an INCOMPLETE task.

**Relationship to the other end-of-session doc:** the authoritative Thunder close-out checklist (`docs/end-of-session-protocol.md`, Step 17) already requires the built-inventory write-back; this gate is its standing statement of *force* — reconciliation is mandatory, audit-derived, and drift-detecting, not a best-effort. The two agree; if they ever diverge, the code (audit) wins, then both docs get corrected. CLAUDE.md §9 carries the binding STANDING INSTRUCTION and cross-refs this gate.

---

## GATE — CLAUDE.md §3 HANDOFF RETENTION (N=3, mandatory every close, not optional)

**The rule: §3 HANDOFF holds the most recent THREE session entries. At every close-out, any entry beyond the newest three is MOVED — verbatim, not summarized — to `docs/handoff-archive.md`, newest-first, BEFORE the new entry is written.** Nothing is deleted. Nothing is condensed. The archive is append-and-preserve. **A close-out that writes a §3 entry without archiving the overflow is an INCOMPLETE task — same enforcement weight as the BUILT-INVENTORY RECONCILIATION gate above, the close-out-ledger gate, and the ⚡ ACTIVE STATUS gate.**

**Why this is a gate and not a cleanup task.** CLAUDE.md is loaded into context at the start of EVERY session — it is the one doc whose size is a tax on every future session, paid before any work begins. It was trimmed to 746 lines and measured **907** on 2026-07-16: it grew ~100 lines in a single session, and a further ~44 on a build whose write-back was deliberately kept minimal. **The close-out protocol manufactures the bloat faster than any trim removes it** — so a trim is a one-time payment against a recurring cost, and buys roughly five sessions before the problem returns identically. The fix is not a smaller doc; it is a RETENTION RULE that makes the trim self-maintaining. This is AC-4 applied to the handoff: settle it once, encode it as a variable (N=3), stop re-deciding it every session.

**The two clauses:**

1. **N=3, verbatim overflow.** Before writing the new §3 entry, count the existing entries. Entry 4 and beyond move to `docs/handoff-archive.md` — **verbatim**, preserving every link, SHA, and character of formatting, inserted newest-first at the top of the archive's entry list under a dated provenance comment. Then write the new entry. The new entry counts as entry #1; the rule applies to itself from the first close-out. **Verification is arithmetic: entries-in == entries-out.** State the count in the write-back.
2. **The line-3 header is a POINTER, never a SUMMARY.** CLAUDE.md's `# Last updated:` line is ONE line: a date, a short title, and "see §3." It does NOT restate the newest entry's narrative. A ~600-word prose header restating §3 is a SECOND representation of one fact — precisely the disease **STD-011** names — and because it is a single physical line it hides from the line-count metric entirely while costing ~1,400 tokens on every session load. The narrative lives in §3 and ONLY in §3.

**What is NOT lost.** The archive is the full history and is NOT loaded at session start — it exists for reference. A fact recorded in a §3 entry survives the move identically; only its *location* changes. Canonical "is X closed / owner-proof owed" state does not live in §3 at all — it lives in `docs/CLOSE-OUT-LEDGER.md`, `docs/DECISIONS-INDEX.md`, and `docs/built-inventory.md`, each with its own gate. §3 is the narrative of the last three sessions; it was never the system of record.

**Honest scope (recorded so the next session doesn't re-derive it).** N=3 does not by itself bring CLAUDE.md under its ~600-line budget — measured, it lands around 700. The remaining overage is structural (§2's infra tables, §6's ten coding rules, §9's standing instructions), and is the separate, still-open §4 Housekeeping item *"Lean CLAUDE.md to rules + state + pointers only."* **This gate stops the GROWTH; it does not by itself close the budget.** Do not silently raise or lower N to hit a number — N is David's call, and a miss is a finding to report, not a parameter to tune.

**Relationship to the other gates:** BUILT-INVENTORY reconciles "what exists"; OWNER-PROVEN reconciles "what's proven"; this gate reconciles **"what still needs to be READ."** The first two prevent drift in the record; this one prevents the record from crowding out the work. (Operating principle: **OP-13**. Binding home: CLAUDE.md §9.)

---

**SIBLING GATE — OWNER-PROVEN RECONCILIATION (fires on the OWNER-PROVEN bar, same force):** the gate above fires when a capability is BUILT/changed (BUILDER-COMPLETE). This sibling fires when David reports an **OWNER-PROVEN** (single or batch). **The FIRST action that session is to flip the status marks for those capabilities from 🟡→🟢 across ALL canonical surfaces** — ⚡ ACTIVE STATUS · 📋 24-board · `built-inventory.md` · 🧵 ARC-MAP · any mapped `user_story` — bump `Last updated:` to today, and state in the write-back which caps flipped. A stale 🟡 on an owner-proven capability is DRIFT (tech-debt #39 class); leaving it un-flipped is an INCOMPLETE close, **same enforcement weight as the BUILDER-COMPLETE reconciliation gate above.** The two gates are the two bars of the two-bar rule made self-maintaining: BUILDER-COMPLETE reconciles "what exists," OWNER-PROVEN reconciles "what's proven." (Proposed operating-principle id: **OP-11** — confirm the DECISIONS.md OP sequence before assigning. Binding home: CLAUDE.md §9.)

---

## The why, one more time (so this discipline survives)

You lose context every session — that's structural and permanent. You cannot fix Lightning's memory. You CAN make the cost of Lightning not-remembering drop to near zero, by keeping ONE current, fixed-structure front-door doc. This protocol is what keeps that doc current. Skip it, and next session you're back to screenshots and re-explanation. Do it (5 min), and next session is one paste and you're working.

It's the same move as the code: you can't make the platform remember either, so you write it down once, canonically, and stop rebuilding. This is that — for the partnership instead of the codebase.

---

*Run this at the end of every session. Update values, never the structure. Keep the bootstrap short. The reference library holds the depth; the bootstrap holds the map and the current state.*
