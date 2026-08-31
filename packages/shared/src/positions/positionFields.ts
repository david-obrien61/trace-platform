// ============================================================
// positionFields — THE ONE DECLARATIVE FIELD LIST PER POSITION RECORD
//
// PURPOSE:      `ui-control-standards` E6 — one declarative field list per record — applied at
//               birth rather than after the drift. Every reader of the three position tables
//               imports its column string from HERE; nobody writes a second one.
// DEPENDENCIES: none. Pure data + types, so every consumer can import it without a cycle.
// OUTPUTS:      the three column strings and the row shapes they return.
//
// ⚠️ WHY ITS OWN FILE RATHER THAN THE TOP OF `positionStore.ts`, stated so it reads as a decision:
// `verify-field-lists` counts a LOCAL const column string as a hand-written enumeration and an
// IMPORTED one as a derived list (its own probes F3/F4 draw exactly that line). It is right to:
// a constant beside its consumer is one edit away from becoming two constants, which is the six
// parallel lists on `customers` that E6 was written after. Keeping them here means the second
// reader has somewhere to import from and no reason to type a list.
//
// 🔴 A COLUMN ADDED TO A TABLE AND NOT TO THE STRING HERE READS BACK AS UNDEFINED FOREVER, and
// nothing in the codebase notices — the exact failure E6 exists to prevent. Adding it here is
// what makes it exist to every reader at once.
// ============================================================

/** `business_context` — the three narrative facts nothing else in the platform holds. */
export const BUSINESS_CONTEXT_COLUMNS = 'business_id, what_we_do, who_we_serve, known_for';

/** `business_positions` — a job. `updated_at` rides along so a list can order by recency. */
export const POSITION_COLUMNS = 'id, business_id, title, excellence_note, updated_at';

/** `business_position_responsibilities` — the ticks and their per-position cadence override. */
export const POSITION_RESP_COLUMNS = 'id, position_id, responsibility_id, frequency';

export interface BusinessContextRow {
  business_id:  string;
  what_we_do:   string | null;
  who_we_serve: string | null;
  known_for:    string | null;
}

export interface PositionRow {
  id:              string;
  business_id:     string;
  title:           string;
  excellence_note: string | null;
  updated_at:      string;
}

export interface PositionResponsibilityRow {
  id:                string;
  position_id:       string;
  responsibility_id: string;
  /** NULL = the catalogue default stands. Never a stored copy of it — see the migration (R-27). */
  frequency:         string | null;
}

/** One weekday pattern row of `business_operating_days`. 0 = SUNDAY (JS getDay), NOT ISO-8601. */
export interface OperatingDayRow {
  weekday:  number;
  day_type: string;
}
