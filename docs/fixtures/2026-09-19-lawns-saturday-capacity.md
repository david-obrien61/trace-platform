# GROUND TRUTH — LAWNS Saturday 2026-09-19: the split, the drive, the two estimates

**This is the fixture piece 2.5 (the capacity estimate) is tested against.** David's instruction, 2026-09-21.
Nothing in the platform holds these drive times: `save_route_order` records the stop order and nothing else,
so the optimiser's miles and minutes were discarded at every one of Friday's seventeen saves. **They survive
only because David ran the same two routes in Google Maps himself and wrote them down.** Persisting them at
save time is piece 2's job; until then this file is the only record.

## The split Lauren made (by GEOGRAPHY, not workload — David, 2026-09-21)
Round trips from **400 Honey Comb Mesa**, measured by David in Google Maps on Friday 2026-09-18.

| | Stops (in the saved order) | Drive | Distance | Trees | Container gallons |
|---|---|---|---|---|---|
| **Team 1** | Freehill → Sappal → Thiry → Garzon | **2 h 49 m** (169 min) | **133 mi** | **16** — 2×30, 5×45, 4×30, 3×15, **2×95** | 640 |
| **Team 2** | Dubec → Gustafson → Kossa → Raja | **1 h 21 m** (81 min) | **42.6 mi** | **13** + 1 planted on site | 225 |
| **Day** | all 8 | 250 min | 175.6 mi | 29 (+1) | 865 |

## The two estimates, worked out
**A = 30 minutes per tree** (David validated 2026-08-30 for digging and placement) · **B = 1 minute per gallon** (the earlier estimate).

| | A: plant + drive | B: plant + drive |
|---|---|---|
| **Team 1** | 480 + 169 = **10.82 h** | 640 + 169 = **13.48 h** |
| **Team 2** (13 trees) | 390 + 81 = **7.85 h** | 225 + 81 = **5.10 h** |
| **Team 2** (14, counting Dubec's *Plant Your Tree*) | 420 + 81 = **8.35 h** | — B cannot see it: it has no gallons |
| **Day** | 870 + 250 = **18.67 h** | 865 + 250 = **18.58 h** |

⚠️ **ONE FIGURE DISAGREES AND IS NOT SILENTLY RECONCILED.** David's first message gave Team 2 as **8.4 h** under A
(= 8.35, the 14-tree figure ✓); his second gave **8.0 h**, which matches neither 13 trees (7.85) nor 14 (8.35).
**The arithmetic above is what the tests will use**; if 8.0 came from a different assumption — a different drive
time, or not counting the on-site tree — say which and this file changes.

## The finding that makes the setting necessary
**The day total agrees under both methods by coincidence** (18.67 h vs 18.58 h — 865 gallons happens to be within
five minutes of 29 trees × 30). **The per-team split does not agree at all**: Team 1 differs by 2.7 h between
methods and Team 2 by 2.75 h. A day-level estimate would have hidden this; the moment the day is split by team,
the method decides who is overloaded. **The two methods cross at exactly 30 gallons** (30 min = 30 gal): below it
the flat method costs more, above it the gallon method does. Garzon's **two 95-gallon Natchez** (+130 min under B)
and Dubec's **eight 15s** (−120 min under B) are the extremes, and they landed on opposite teams.

🔴 **Against X = 7 hours, Saturday suggests TWO teams under either method — and Team 1's half is still over the
threshold on its own** (10.8 h / 13.5 h). Lauren's split balanced the map, not the day.

## What is still unmeasured
**Nothing was tapped on Saturday** — no Start, no Done, zero crew events on the 19th, and the crew link was last
opened on Friday at 10:48. So the planting figure remains a stated default, not a measurement. David is asking
Lauren for the actual finish times; that answer is the first real measurement and belongs in this file when it
arrives. This is exactly why the per-tree minutes must be an editable per-business setting rather than a constant.

## How the estimate learns (David, 2026-09-21) — and what is built when
1. **SNAPSHOT THE ESTIMATE** when a day is scheduled or routed: trees, the minutes-per-tree used, the planting
   total, drive minutes and miles. **Stored, never recomputed when a setting later changes** — history keeps what
   was believed at the time. Built with piece 2.5.
2. **THE TAPS GIVE THE ACTUAL MINUTES**, kept by tree size. Derived from `started_at`/`completed_at` and the stop's
   own lines — computed on read, so there is no second copy to drift. Built with piece 2.5.
3. **THE COMPARISON IS SURFACED, NEVER APPLIED** — *"the last N installs at 45 gal averaged M minutes; your setting
   is 30 — change it?"* Lauren accepts or declines; nothing changes a setting silently. **Filed as tech-debt #355**
   until there are taps to compare: Saturday produced none.
4. **X IS A POLICY, NOT AN ESTIMATE.** The one-team/two-team threshold never learns and is never suggested. Only
   planting time does.
