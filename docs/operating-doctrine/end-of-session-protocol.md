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

That's it. Six steps, a few minutes. The structure (§0–§7 headings + the 🧵 ARC MAP / 📚 CAPTURE INDEX sections) NEVER changes — you're only editing values. That's what makes it stop "changing every session": the shape is permanent, the contents are live.

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

## The why, one more time (so this discipline survives)

You lose context every session — that's structural and permanent. You cannot fix Lightning's memory. You CAN make the cost of Lightning not-remembering drop to near zero, by keeping ONE current, fixed-structure front-door doc. This protocol is what keeps that doc current. Skip it, and next session you're back to screenshots and re-explanation. Do it (5 min), and next session is one paste and you're working.

It's the same move as the code: you can't make the platform remember either, so you write it down once, canonically, and stop rebuilding. This is that — for the partnership instead of the codebase.

---

*Run this at the end of every session. Update values, never the structure. Keep the bootstrap short. The reference library holds the depth; the bootstrap holds the map and the current state.*
