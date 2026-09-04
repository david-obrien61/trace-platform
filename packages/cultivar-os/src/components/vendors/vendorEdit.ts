// ============================================================
// vendorEdit — every DECISION the vendor editor makes, as pure functions.
//
// PURPOSE:      `VendorEditor.tsx` renders; this file decides. A render condition inside a .tsx
//               cannot be asserted by a probe (tech-debt #134), so the diff, the validation, the
//               owner-only carve-out and the error translation all live here where §-probes reach
//               them — the same split `receiptDetail.ts` and `customerEdit.ts` already use.
//
// THE COMMIT MODEL IS E2, AND IT IS THE FORM SHAPE (not the cell shape):
//               the RECORD is the unit of work — an owner opens ONE vendor to revise it as a
//               whole — so every field BUFFERS into `draft` and nothing is written until Save.
//               Cancel genuinely discards. Create and edit differ ONLY in title and
//               insert-vs-update, which is the loophole E2 closed after `CustomerPartyEditor`
//               shipped two commit models separated by a prop.
//
// DEPENDENCIES: `@trace/shared/business-logic` ONLY — the field lists, so this file cannot drift
//               from `VENDORS_SELECT` (E6). No React, no Supabase, no DOM. Pure.
//
// OUTPUTS:      buildVendorPatch · validateVendorDraft · vendorWriteFailure · emptyVendorDraft
// ============================================================
import {
  VENDOR_EDITABLE_FIELDS,
  type VendorRow,
} from '@trace/shared/business-logic';

/** The on-screen working copy. Every value is a string — an <input> has no other kind. */
export type VendorDraft = Record<string, string>;

/**
 * The preference half, held apart from the text fields because it is OWNER-ONLY and because
 * `preferred` is a boolean rather than a string.
 */
export interface PreferenceDraft {
  preferred: boolean;
  note: string;
}

interface VendorPatchResult {
  values: Record<string, unknown>;
  error: string | null;
}

/** A blank draft for CREATE mode — every editable field present and empty, never `undefined`. */
export function emptyVendorDraft(): VendorDraft {
  const d: VendorDraft = {};
  for (const f of VENDOR_EDITABLE_FIELDS) d[f] = '';
  return d;
}

/** Seed a draft from a persisted row. Absent ≠ empty: a null column becomes '', deliberately. */
export function draftFromVendor(v: VendorRow): VendorDraft {
  const d: VendorDraft = {};
  for (const f of VENDOR_EDITABLE_FIELDS) {
    const raw = (v as unknown as Record<string, unknown>)[f];
    d[f] = raw === null || raw === undefined ? '' : String(raw);
  }
  return d;
}

/**
 * 🔴 VALIDATION IS ONE PASS OVER THE WHOLE RECORD, NOT PER FIELD — that is what the FORM shape
 * buys (M2: a blank required field BLOCKS save with a visible message, never a silent no-op).
 *
 * Only `name` is required, and it is required because the DATABASE requires it: `name text NOT
 * NULL` plus the unique index on `(business_id, lower(btrim(name)))`. Nothing else is invented as
 * mandatory — a vendor known only by name is the honest normal case, and eleven empty columns is
 * exactly the state every vendor row is in today.
 */
export function validateVendorDraft(draft: VendorDraft): string | null {
  if (!String(draft.name ?? '').trim()) {
    return 'A vendor needs a name. It is the only field that is required.';
  }
  const email = String(draft.email ?? '').trim();
  // Deliberately shallow: one '@' with something either side. A stricter pattern rejects real
  // addresses, and a vendor email is a HINT for identity (D-47), never an authentication factor.
  if (email && !/^[^@\s]+@[^@\s]+$/.test(email)) {
    return `"${email}" does not look like an email address. Leave it blank rather than guessing.`;
  }
  return null;
}

/**
 * Diff the draft against the PERSISTED row and return only what changed (E4 — the unchanged-check
 * reads the persisted value, never the working copy; comparing the draft to itself always answers
 * "no change" and every field silently writes nothing).
 *
 * 🔴 THE PREFERENCE PAIR IS OMITTED ENTIRELY WHEN THE ACTOR MAY NOT SET IT. Not sent-and-refused,
 *    not sent-unchanged — ABSENT. The trigger would let an unchanged value through
 *    (`IS NOT DISTINCT FROM` on both columns returns NEW), so sending it would "work" and teach
 *    the next reader that a manager may write these columns. Omitting it keeps the client's shape
 *    honest about the authority it actually holds. **The enforcement is still the trigger** — this
 *    is the UI agreeing with the database, never the UI being the gate.
 */
export function buildVendorPatch(params: {
  saved: VendorRow | null;
  draft: VendorDraft;
  preference: PreferenceDraft;
  creating: boolean;
  canSetPreference: boolean;
}): VendorPatchResult {
  const { saved, draft, preference, creating, canSetPreference } = params;

  const invalid = validateVendorDraft(draft);
  if (invalid) return { values: {}, error: invalid };

  const values: Record<string, unknown> = {};
  const savedRec = (saved ?? {}) as unknown as Record<string, unknown>;

  for (const f of VENDOR_EDITABLE_FIELDS) {
    const raw = draft[f];
    if (raw === undefined) continue;          // a field the caller never loaded is never written
    const trimmed = raw.trim();
    // `name` is NOT NULL; everything else stores a real NULL rather than an empty string, so an
    // absent value reads as absent instead of as a present blank (D-9 / A9).
    const value: string | null = trimmed === '' ? (f === 'name' ? '' : null) : trimmed;
    const before = savedRec[f] ?? null;
    if (creating) {
      if (value !== null && value !== '') values[f] = value;
    } else if (value !== (before === '' ? '' : before)) {
      values[f] = value;
    }
  }

  if (creating && !values.name) values.name = String(draft.name ?? '').trim();

  if (canSetPreference) {
    const noteOut = preference.note.trim() || null;
    if (creating) {
      // 🔴 NEVER BORN PREFERRED, even for an owner. `vendors_preference_owner_only_insert` refuses
      //    a new vendor created already preferred, and the client agrees with it rather than
      //    discovering it as a 42501.
      if (preference.preferred) {
        return {
          values: {},
          error: 'A new vendor cannot be created already preferred. Save it first, then mark it.',
        };
      }
    } else {
      if (preference.preferred !== (savedRec.preferred === true)) values.preferred = preference.preferred;
      const beforeNote = (savedRec.preference_note ?? null) as string | null;
      if (noteOut !== beforeNote) values.preference_note = noteOut;
      // Clearing the mark clears its reason with it — a note explaining a preference that no
      // longer exists is a sentence about nothing, and it would resurface if the mark returned.
      if (values.preferred === false) values.preference_note = null;
    }
  }

  return { values, error: null };
}

/** Did the patch actually ask for anything? A no-op Save must say so, not claim a write (E5). */
export function patchIsEmpty(values: Record<string, unknown>): boolean {
  return Object.keys(values).length === 0;
}

/**
 * Translate a write failure into a sentence an owner can act on.
 *
 * 🔴 THE ZERO-ROW CASE IS NOT AN ERROR AND THAT IS THE WHOLE REASON THIS EXISTS. A PostgREST
 * UPDATE whose USING clause filters the row out returns SUCCESS WITH ZERO ROWS — so an
 * error-only check reports "saved" while nothing changed (E5, STD-023, tech-debt #74's class).
 * The caller passes the matched-row count and this function is what makes the two shapes
 * distinguishable to the person at the screen.
 */
export function vendorWriteFailure(input: {
  errorCode?: string | null;
  errorMessage?: string | null;
  matchedRows: number | null;
  attemptedPreference: boolean;
}): string | null {
  const { errorCode, errorMessage, matchedRows, attemptedPreference } = input;

  if (!errorCode && !errorMessage) {
    if (matchedRows === 0) {
      return 'That vendor could not be updated from your account. Nothing was saved.';
    }
    return null;
  }

  const msg = errorMessage ?? '';
  if (errorCode === '23505' || msg.includes('vendors_business_name_uidx')) {
    return 'You already have a vendor with that name. Vendor names are unique, so give this one a name that tells them apart — or edit the existing row instead.';
  }
  if (errorCode === '42501' || msg.includes('owner-only')) {
    return attemptedPreference
      ? 'Only an owner can set the preferred vendor. Your change was not saved.'
      : 'Your account is not allowed to make that change. Nothing was saved.';
  }
  return `Could not save: ${msg || errorCode}`;
}
