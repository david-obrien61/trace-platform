# OPEN QUESTIONS — everything waiting on David, in one place

**Last updated: 2026-09-12** — created at David's request (ledger #302); count reconciled and two rows corrected 2026-09-12 — see the ✏️ marks in the count table and the short list.
**Scope:** every question the platform cannot answer for itself, across all seven places they currently live.

> 🔴 **THIS FILE IS AN INDEX, NEVER A SECOND COPY.** Each entry gives the question, enough of its own
> words to be actionable, and **the file that OWNS it**. The owning file stays authoritative: answer a
> question there, and update the one line here. **A second full copy of a question is STD-011** — two
> representations of one fact, and the copy is always the one that goes stale. That is precisely the
> defect this repo has logged eleven times in three days ([[R-26]]).
>
> ⚠️ **WHY IT EXISTS ANYWAY:** the questions are real and they are scattered across **seven homes** —
> `RULINGS.md`'s OWED table, CLAUDE.md §3's *FLAGGED FOR DAVID*, CLAUDE.md's *Open Architecture
> Decisions*, CLAUDE.md §4's pending data task, the close-out ledger's Blocker column,
> `tech-debt-log.md`, and `DECISIONS-INDEX.md`. **No single surface has ever shown David how many
> there are.** This one does, and it holds counts and pointers only.

---

## THE COUNT, MEASURED 2026-09-11

| Home | Open items | What lives there |
|---|---|---|
| `docs/RULINGS.md` → **OWED** section (line 248+) | 🔴 **65** | Questions only David can answer. 90 rows total; **24 already answered and kept for the trail**, **1 header row**. **90 − 24 − 1 = 65**, which is exactly what the command in *How this file stays true* returns. ✏️ **CORRECTED 2026-09-12: this cell said *2 header rows* and closed at 64.** There is only one header row in the counted population — the `|---|---|---|` separator **can never enter it**, because `grep '^| '` requires a space after the pipe and the separator has a dash. The commands, the arithmetic and the headline now agree at **65**. |
| `docs/RULINGS.md` → main table, `OPEN` state | 🟡 **35** | Rulings David has MADE that are **not yet built**. Not questions — work. |
| `docs/RULINGS.md` → main table, `PARTIAL` | 🟡 **16** | Ruled and half-built. |
| CLAUDE.md §3 — *FLAGGED FOR DAVID* | 🔴 **11** | The three newest sessions' questions (#299 · #300 · #301). Scrolls out at N=3 — **this is the only place they survive it.** |
| CLAUDE.md — *Open Architecture Decisions* | 🟡 **4** | Rows 3, 5, 6, 9. Long-dormant. |
| CLAUDE.md §4 — *PENDING DATA TASK* | 🔴 **2** | Work only David can do (LAWNS is read-only to Thunder). |
| `docs/tech-debt-log.md` + CLAUDE.md tech-debt line | 🟡 **~36 mentions** | Items whose fix is explicitly *"David's call"*. |
| `docs/DECISIONS-INDEX.md` | 🟡 **26** | Rows marked OPEN. |

🔴 **The honest headline: 65 questions are sitting in the OWED queue, and the newest three sessions
added 11 more that nothing but §3 was holding.**

---

## 🔴 THE SHORT LIST — what is BLOCKING work right now

These are the ones where a build is stopped, not merely slower. Each is quoted from its owner.

**1 · `20260905_production_planning` — ✏️ NARROWED 2026-09-12. THE TABLES ARE THERE; THE REST IS UNPROVEN.**
🔴 **The "never applied / cannot save on every tenant" claim is STRUCK.** A live probe **with a negative
control** found all three of `business_operations_config`, `production_plans`, `production_plan_lines`
**present**. The blocking half of this row was false, and it was the #1 item on this list.
⚠️ **What the probe could NOT see, and so is still genuinely unproven:** the probe was **anon**, which
reads tables and nothing else. The migration also creates **12 policies, 3 indexes and 3 triggers** —
none of which anon can observe. So the open question is no longer *apply or retire*; it is **did the
whole migration run, or only its `CREATE TABLE` half** — and a table that exists proves nothing about
*how* it got there (tech-debt **#249**/**#39**: schema changed outside the repo, twice already).
**The answer needs a service-role catalog read, not a ruling** — so this is a task, not a question for
you, and it drops off the blocking list the moment someone runs it.
→ `RULINGS.md` OWED · tech-debt **#253** (re-scope it; do not close it)

**2 · WHO MAY SEE THE EQUIPMENT LIST WITHOUT SEEING WHAT IT COST?**
*"Equipment lives in `cost_objects` (confidential, gated on `costs:read`); maintaining it is `pmi:*`.
So someone who holds `pmi:*` and not `costs:read` gets a locked screen with nothing to maintain."*
**Joel is in exactly that state today** — `/pmi` shows him nothing. → `RULINGS.md` OWED · tech-debt **#262**

**3 · HOW DOES FOLLOW-UP GET TURNED ON?** Catalog 30-day clock, by hand in SQL, or core.
`followup_engine` is a `planned` tile and `/subscription` offers **no Turn on**, so the review ask
**cannot fire on any tenant** whatever link you enter. → CLAUDE.md §3 #300 · tech-debt **#270**

**4 · LAWNS'S THREE SERVICE ROWS — you write them, Thunder cannot.**
Trip charge (533 lines, $40,760) · Tailgate Delivery (127 lines, $18,990) · self-collect (no line).
All four rows read `category='addon'` today. 🔴 **Blocked on tech-debt #251** — checkout offers one
staff/flat row, so trip charge and tailgate would hide one of the two. → CLAUDE.md §4

**5 · THE 8-HOUR RULE — WHAT EXACTLY WAS RULED?**
*"The backlog lists 'Crew capacity / the 8-hour rule — ruled, not built' and gives no wording. A
ruling cannot be numbered without its words."* → `RULINGS.md` OWED

**6 · THE YARD-WORKER PERMISSION SET — confirm or amend.** Proposed `inventory:read`,
`deliveries:read`, `deliveries:update`, `pmi:read`, `pmi:update`; excluded `inventory:reconcile`,
every `costs:*`, `pricing_recipe:*`, `settings:*`. ⚠️ As proposed it collides with question 2.
→ `RULINGS.md` OWED

**7 · THE COARSE SPLIT — A or B?** `businesses_owner_update` guards the profile fields **and**
`owner_id` / `qbo_writes_enabled` on one policy, and RLS has no column-level restriction.
→ `RULINGS.md` OWED

**8 · RENDERER HOST — HOW DO THE BOARDS GET ONTO A PHONE?** ✏️ **ADDED 2026-09-12.**
`status.html`, `owner-tests.html` and `ui-standards.html` are pure renderers you can only open from a
desktop checkout today. 🔴 **Blocked on BUILD-TIME REDACTION, not on hosting** — the boards carry
**staff emails, ten tenant UUIDs and live SQL**, and **Vercel Hobby has no password protection**
(§6 r11: the plan is Hobby, verified 2026-09-08), so publishing them as-is puts all three on the open
internet. ⚠️ **And there is a real defect underneath the question: root HTML never reaches `dist/`** —
so even once you rule on redaction, there is nothing to serve until that is fixed.
Your call is the redaction policy; the `dist/` gap is a build task either way.
→ **NEW — no owning file yet.** Give it one when you answer (a ruling in `RULINGS.md`, or a tech-debt
id for the `dist/` half), per rule 1 below.

---

## THE THREE NEWEST SESSIONS' QUESTIONS (§3 holds these for three sessions only)

> ⚠️ **#299's block is now one session PAST the §3 window** — it was archived verbatim by close-out #303, so these lines are the only thing still pointing at it. That is exactly what this register is for.

**#303 — the ship-to address book (`customer_addresses`)**
- 🔴 **A STORY IS OWED BY YOU, and Thunder did not write one.** `user_stories.md:1630` carries `customer_addresses` as `STATUS: scoped-out`; **this build inverts that row**, which is a status flip you make. `:524` and `:608` name the owed `conditional-address-on-delivery` sub-story.
- 🔴 **Apply `20260911b_customer_addresses.sql`** — written, not applied. **Board CARD 2 is only runnable BEFORE you apply it**; everything else waits on it.
- **`line2` exists and no surface writes it** (tech-debt #279). When the Line2 importer fix (#254) lands: does `deliveries` gain an `address_line2`, or does the importer fold Line2 into Line1 on the way in? Neither was this build's call.
- ⚠️ **You overrode a written trigger and it is recorded, not hidden** — the 2026-09-09 recon said *build the book when the count passes ~25*; it is 17 raw / 5 clean. Nothing needs answering here; it is logged so nobody later reads the trigger and calls it drift.

**#299 — install date + inventory location (recon)**
- Retire `orders.install_date` once you confirm the warranty clock reads the planting stop's `completed_at`? It is **0 of 76, with no writer in any commit.**
- **R-143 is filed on the prompt's words** — strike it to OWED if that was a paraphrase rather than your ruling.
- Infer `planting` on QuickBooks stops, or let Lauren mark it? **7 of 19 ingested LAWNS stops are installs typed as delivery**, so they would never start a warranty (tech-debt #268).
- Zones need a story before any build — the walk tool exports for `business_inventory.zone` and *"the irrigation zone records"*, and **neither exists** (tech-debt #266).

**#300 — the Google review ask**
- How Follow-Up gets turned on (question 3 above).
- **Does a SKIP start the 180-day window?** Today it does.
- The one-day grace for a late done-tap is **Thunder's number, not yours** — confirm or set it.

**#301 — one stop, three screens**
- Run the stop board's **CARD 1** first; it is read-only SQL.
- Route board **CARDS 1, 2 and 7** are back to `owed` — the stop list feeding the Maps link was rebuilt.
- The select strings were **not probed against live PostgREST** (the anon key on disk is rejected); stop **CARD 2** is that proof.
- Retire or convert the legacy `/deliveries` order list? **27 Test Dave's orders have no stop** (tech-debt #277).

---

## LONG-DORMANT (CLAUDE.md → Open Architecture Decisions)

| # | Question | Deferred since |
|---|---|---|
| 3 | KINNA-OS production app domain — `kinna-os.app`, `.com`, or a `builtwithcai.com` subdomain | 2026-05-26 |
| 5 | PLATFORM_STRATEGY.md metadata claims to be authoritative — soften or remove | 2026-05-26 |
| 6 | PANTRY_OS.md rename, *if* the file is ever re-created | 2026-05-26 |
| 9 | Family-member role descriptions — each person reviews their own paragraph | 2026-05-27 |

---

## HOW THIS FILE STAYS TRUE

1. **Answer a question in its OWNING file first** — `RULINGS.md`, CLAUDE.md §3, the tech-debt log —
   then update its line here. Never the reverse.
2. **A close-out that adds a FLAGGED FOR DAVID item adds a line here too**, because §3 drops it after
   three sessions and **this file is what survives N=3**.
3. **Counts are re-measured, never carried forward.** The commands are recorded so the next session
   re-derives rather than trusts:
   ```bash
   sed -n '248,$p' docs/RULINGS.md | grep '^| ' | grep -vc '^| ✅\|^|---\|^| Question\|^| # '   # OWED still open
   grep -c '| \*\*OPEN\*\*' docs/RULINGS.md                                                      # ruled, not built
   grep -c 'OPEN' docs/DECISIONS-INDEX.md
   ```
4. ⚠️ **A question that has been answered is marked ANSWERED and KEPT**, the way `RULINGS.md` keeps
   its 24 — deleting it erases the trail of what was decided and when.
