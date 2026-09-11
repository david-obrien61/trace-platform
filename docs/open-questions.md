# OPEN QUESTIONS — everything waiting on David, in one place

**Last updated: 2026-09-11** — created at David's request (ledger #302).
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
| `docs/RULINGS.md` → **OWED** section (line 248+) | 🔴 **65** | Questions only David can answer. 90 rows total; **24 already answered and kept for the trail**, 2 header rows. |
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

**1 · `20260905_production_planning` — APPLY OR RETIRE?**
*"It creates `business_operations_config`, `production_plans`, `production_plan_lines`, and **shipped
code already reads and writes all three** (Settings → Operations, the Uppot plan page,
`productionHold.ts`)."* Until you answer, **Settings → Operations cannot save and the Uppot plan page
cannot commit, on every tenant.** → `RULINGS.md` OWED · tech-debt **#253**

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

---

## THE THREE NEWEST SESSIONS' QUESTIONS (§3 holds these for three sessions only)

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
