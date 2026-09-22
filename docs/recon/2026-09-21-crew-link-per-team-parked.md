# The per-team crew link is PARKED — what was ruled out, and how

**Ledger #374 · branch `feat/crew-link-per-team` · migration `20260921d_crew_link_per_team.sql`
(WRITTEN, **NOT APPLIED**, and must not be) · David's instruction, 2026-09-21.**

This file exists for one reason: **so the next session starts where this one stopped, instead of
repeating four dead ends.** Every line below is something that was MEASURED, not reasoned about.

---

## 🛑 The standing instruction

**Do not apply `20260921d`.** Not to live, not to Test Dave's. The migration's own V-blocks pass, but
the crew path tests go red with it in the chain and **the cause is not found** — so its effect on the
crew endpoint is unaccounted for. That endpoint is the one a driver uses alone in a yard.

---

## The symptom, exactly

Every crew path test that calls the endpoint returns `{"ok":false,"code":"server_error"}` (HTTP 500).
The endpoint's own trace says what it is hiding:

```
[TRACE:CREW] rpc error {
  method: 'GET',
  message: 'Error: unexpected fetch http://pglite.test/rest/v1/rpc/crew_day_read'
}
```

`unexpected fetch` is thrown by the crew page's own `fetch` stub in `crew-day.paths.mts`, which
answers `/api/crew/day` and refuses everything else. So at the moment the endpoint's Supabase client
issued `/rest/v1/rpc/crew_day_read`, **the active global `fetch` was the page stub, not the PGlite
Supabase shim.** Something about having this migration in the chain changes which `fetch` is in
place when the endpoint runs — or makes the shim decline that RPC so it falls through to the stub.

## 🔴 The blast radius is the whole crew door, not the new feature

This is the reason for parking rather than shipping with a known gap. With `20260921d` in the chain,
these **pre-existing, previously green** guards fail identically:

| Guard | Was |
|---|---|
| `crew.expired` | green |
| `crew.revoked` | green |
| `crew.other-day` | green |
| `crew.other-business` | green |

The new guards (`crew.link-shows-only-its-team`, `crew.link-cannot-act-on-another-teams-stop`,
`crew.whole-day-link-unchanged`, `crew.one-live-link-per-team`) fail the same way.
`crew.link-refuses-another-businesss-team` **PASSES** — and that is informative: it is the only new
guard that never touches the endpoint, because it asserts a refusal from `createCrewDayLink` itself.

---

## RULED OUT — do not spend time here again

**1. It is not the guards' content.**
`crew.whole-day-link-unchanged` creates **no teams at all**. It makes a plain whole-day link and
reads it — structurally the same as the long-green `crew.other-day`. It fails. So the failure does
not depend on anything team-shaped in the test.

**2. It is not where the guards sit in the file.**
First written at the end of the file (after the `route.*` section), then **moved to sit with the
other `crew.*` guards, above `route.save-per-team`**. Rebuilt and re-run: **identical failures**.
The "later guards inherit clobbered global state" theory is dead.

**3. It is not team setup through the app client.**
First version called `saveTeam(lauren(db), …)` and `assignStopsTeam(lauren(db), …)` before touching
the endpoint — a plausible way to leave a client's `fetch` installed. Rewritten to create teams and
assign stops with **raw SQL** (`INSERT INTO delivery_teams`, `UPDATE deliveries SET team_id`), so the
endpoint is the only thing under test. **Identical failures.**

**4. `PATH_ONLY` IS NOT A SAFE WAY TO BISECT THIS — and this is the most useful line in the file.**
Running one guard alone with `PATH_ONLY` makes **pre-existing green guards fail too**: `PATH_ONLY=
crew.other-day` fails with the same `server_error` on a tree where the full run passes it. **So
isolation is its own artifact.** Any bisect that uses `PATH_ONLY` will produce confident nonsense.
Only full-suite runs mean anything here.
⚠️ This was found by running a **negative control** — a guard known to be good, through the same
path as the suspect ones. Without it the night would have gone into chasing a phantom. ([[R-33]]:
a check that cannot disagree is not a check; the same applies to a harness that cannot pass.)

**5. A tempting non-baseline.** Running the ORIGINAL `crew-day.paths.mts` (from `origin/main`) in
this worktree is **not** a clean baseline: the client on this branch always sends `p_team_id`, so it
fails with `function … (…, p_team_id => unknown) does not exist` — a different failure entirely.
A real baseline needs the original client too, i.e. a clean worktree off `origin/main`.

---

## What IS known good

* The migration **applies** cleanly on the real chain in PGlite, and **V1–V6 were RUN**, not eyeballed:
  the column exists and is nullable; the live-link index is the three-column one and **carries its
  `COALESCE`**; exactly one `crew_day_stops` and one `create_crew_day_link` exist and both are the new
  arity; the refusal string is present in the shipped `crew_stop_act` body; the read passes
  `(r.link).team_id` through.
* `tsc` is clean across the client, the panel and the crew page.

## Two defects this work already caught — keep these even if the approach changes

**A. `CREATE OR REPLACE` with a new DEFAULTED parameter OVERLOADS; it does not replace.**
After replacing `crew_day_stops` and `create_crew_day_link`, the catalog held **four** functions —
the old two-arg and three-arg versions beside the new ones — and **Postgres resolves an exact-arity
call to the OLD one**. A client still passing three arguments would have gone on minting whole-day
links, and `crew_day_stops(business, date)` would have stayed callable and **unfiltered**. Fixed with
explicit `DROP FUNCTION` of the old arities, ordered after the caller is repointed.
**This is tech-debt #241's shape: a superseded definition that is still reachable.**

**B. Re-typing a function body from memory silently reverts what is in it.**
The first `create_crew_day_link` here lost **six** things — `is_active_member`, the time-zone
validation, `revoked_by`, the actor role on every audit row, the audit row written per REVOKED link,
and the four real refusal codes (`not_permitted` / `bad_date` / `bad_time_zone` / `past_day`) that the
client and its tests match on — and **invented** `audit_log(user_id, entity, entity_id, changes,
result)` when the real columns are `actor_user_id, actor_role, target_type, target_id, detail,
outcome`. Caught by RUNNING the tests: `column "user_id" of relation "audit_log" does not exist`.
Now rebuilt as 20260917c's body with only the team added.
⚠️ HISTORY sent the identical warning about `undo_import_run` on the same day: **start from the body
that is live, or you revert what is in it.**

---

## Where to start next time

1. Build a clean worktree off `origin/main` and confirm the crew suite is green there — the real
   baseline this session never established.
2. Add **only** the migration (no client, no test changes) to that tree's chain and re-run the FULL
   suite. If the pre-existing guards go red on that alone, the cause is in the SQL and the next
   question is which statement — most likely candidates are the `DROP FUNCTION` calls or the
   `crew_day_read` replacement, since those change what the shim must resolve.
3. If they stay green, add the client change next, then the guards. One layer at a time, full runs
   only, **never `PATH_ONLY`**.
