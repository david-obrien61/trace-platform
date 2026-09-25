# YARD WORK ORDERS — FULL-SURFACE OWNER TEST

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha> · prod`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a failed or
> unmerged build looks *completely normal* — the app just serves the old bundle. Match it to
> `git log --oneline origin/main -1`, **not** to a SHA written in this file. *(GATE 0 · OP-15.)*

> **Rendered board:** open `owner-tests.html` (a PURE renderer — it parses this file live and holds no
> data of its own).
>
> **This file is the ONLY source of truth for the work-order owner-tests.** It is STANDING — run it
> after any change to `20260925i`'s tables, `work_order_apply`, or `buildTiming.ts`.

**Purpose:** prove that a dated job with a crew can be planned, and that finishing it **does the work** —
a mix batch adds what it made and draws what it used, an uppot records the potting date — **once, and
only once**.

**Board: 0 of 1.** ⚠️ **THE ONE CARD IS `needs-test`, AND THE REASON IS THE WHOLE STATE OF THIS
CAPABILITY: THERE IS NO SCREEN.** `20260925i` creates the tables and the Done function, and nothing in
the app calls them. The crew-link phone pattern and the Operations calendar are P6's and P7's surfaces
and neither is built. **Recording that hole is not optional (OP-14 clause 2); inventing a card that asks
you to click something that does not exist would be worse than none.**

**Why this exists.** LAWNS blends its own mix and pots its own trees, and until now the platform had no
way to say *"Joel, make 2 batches on Thursday"* — the only work-order shaped table in the database is
`business_pmi_schedule`, which is equipment maintenance. Measured 2026-09-25.

---

# DAVID CAN RUN THIS NOW

### CARD 1 — 🔴 THE JOB'S RULES HOLD IN THE DATABASE, AND DONE BUILDS EXACTLY ONCE (needs `20260925i` applied)
STATUS: needs-test
DEVICE: desktop
COVERS: #413
LAST-PROVEN: —
SIGNAL: `V3 PASS — Done built once (qty 0→2, 1 run), and a second tap applied 0 and skipped 1`

⚠️ **RUN IN THE SQL EDITOR, ON TEST DAVE'S.** Paste the migration's **V1–V4** from the foot of
`supabase/migrations/20260925i_production_work_orders.sql`, one at a time. Each builds its own fixture,
RAISEs its verdict and **rolls back**, so the error message *is* the report and nothing is left behind.

- **V1** — the two tables, RLS on both, 8 policies, and `build_runs` gaining `started_at`/`finished_at`.
- **V2** — a line must match its order's kind, **both ways**: a mix-batch line with no recipe is refused,
  one naming a *lot* is refused, a correct one is accepted, and an uppot line naming a *recipe* is refused.
- **V3** — 🔴 **the one that matters.** Done runs the build (on-hand 0 → 2, one `build_runs` row), and a
  **second** tap applies **0** and skips **1**. *This is the double-tap guard: a crew taps Done on a phone
  with a bad signal, and without it that one extra tap adds 2.5 yards of mix that was never made.*
- **V4** — a member holding `inventory:read` but not `inventory:update` is refused, and the refusal says
  **why**: finishing this job moves stock.

**PASS:** four messages beginning `V1 PASS` … `V4 PASS`.
**🔴 FAIL if** V3's second tap reports `applied: 1` — that is stock moving twice — or if V1 reports fewer
than 8 policies.

⚠️ **WHAT THESE CANNOT PROVE, said plainly:** that anybody can *reach* this. There is no button. The
database behaviour is also covered by `work-orders-413.pglite.mjs` (58 probes, 4 mutants all caught),
and **two real defects of mine were found by those probes rather than by review** — a `build_runs` UPDATE
that matched zero rows in silence, and a status computed twice that could disagree with itself.

---

# NEEDS A DESK VISIT

*(Nothing yet — there is no screen. When P6's crew-link view and P7's calendar band exist, the cards that
need Joel's or Lauren's own login belong here: a crew seeing only its own jobs, and a draft a person
confirms, moves or deletes.)*
