# The task model — as ruled 2026-09-10

**Status:** RULED (R-131 · R-134 · R-137 · R-138) · **Nothing built.**
**Source:** `backlog-2026-09-10.md` Part 5, compiled by Lightning from David's rulings; confirmed for filing by David 2026-09-11 (ledger #295).
**Why this doc exists:** RULINGS.md holds one line per ruling. *"A ruling that needs a paragraph here is a ruling whose decision doc is missing"* — the task model is several rulings that only make sense together.

---

## The rulings

1. **A task APPEARS at its time. No assignee.** The production manager, or whoever is responsible, sees it and ensures it gets done. — **R-131**
2. **The instruction is the payload** — *two flats, thirty inches back, within one to two weeks.* — **R-131**
3. **One object.** An emergency and a task are the same thing at different urgency. An **observation** (*"plants look dry"*) is a different thing: it needs a judgment, not a repair. — **R-137**
4. **It lives on the operations calendar, beside the deliveries**, because they compete for the same people on the same day. Terry's drive-through list, visible to Lauren and Joel. — **R-134**
5. **Closing must be one tap from where you already are**, or the list rots. LAWNS has zero inactive customers in 1,959 because nothing ever deactivates. — **R-138**
6. **A duty generates; a task is its instance.** Filed 2026-09-11 from David's PMI prompt: *"a task APPEARS rather than being assigned; a DUTY generates, a TASK is the instance."* — **R-142**
7. **Usage-based recurrence is required**, and taking the meter reading is itself a task. — **R-140**
8. **The interval belongs on the task**, not on the schedule. — **R-141**

## Stated with the rulings, not rulings themselves

- ⚠️ **Urgency needs a consequence, and the consequence is push — which needs the wrap.** Until then an emergency is still a phone call, and the system records it rather than routes it. (Carried on R-137.)

## Open — not numbered

- 🔴 **A duty is a generator; a task is its instance.** PMI schedules, zone rotations and Cuda's weekly fertilising all generate the same kind of row. **The backlog lists this as ruled (Part 5) and as Lightning's proposal (Part 3).** Filed as an OWED question in RULINGS.md rather than numbered.
- 🔴 **Crew capacity — the 8-hour rule.** Listed as ruled, with no wording given. OWED.

## What already exists that this model will reuse

- **PMI** already has the generator/instance relation this model describes (a schedule and its service log).
- **The operations calendar** exists (`OperationsCalendar.tsx`, `business_operating_days`).
- ⚠️ `business_operations_config` — part of the uppot planning build — is **not applied** (`20260905_production_planning`, tech-debt #253).
