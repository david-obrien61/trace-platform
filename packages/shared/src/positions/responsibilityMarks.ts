// ============================================================
// responsibilityMarks — THE THREE MARKS A TICKED RESPONSIBILITY CARRIES, IN CONSEQUENCES
//
// PURPOSE:      Turn a catalogue row into what the owner needs to READ as they tick it —
//               *"this lets them see what people are paid"*, not *"wages:read"*. The story is
//               explicit: mark it in CONSEQUENCES and never in permission strings, because the
//               whole point of the inversion is that an owner can answer *what does this person
//               DO* and cannot answer *which permission should they hold*.
// DEPENDENCIES: permissionManifest.ts (the ONE authority on what a string means) ·
//               responsibilityCatalogue.ts (the rows). Pure — no React, no fetch.
// OUTPUTS:      `marksFor(row)` → { sensitive, delegable, capability } with the reason text.
//
// ── EVERY MARK IS DERIVED FROM THE MANIFEST EXCEPT WHERE THE MANIFEST CANNOT KNOW ───────────
// A second hand-maintained list of "which responsibilities are sensitive" would be a second
// representation of a fact the manifest already owns, and the redundant copy is the one that
// drifts (STD-011). So:
//   SENSITIVE            ← any cited string whose resource is `confidential`. The REASON is the
//                          manifest's own `exposure` sentence, which already reads as a
//                          consequence ("PAYROLL — … What every person on the team is paid.").
//   CANNOT BE DELEGATED  ← any cited string whose resource is `owner-only`. This is not a policy
//                          choice made here: `CATALOG_PERMISSIONS` filters `owner-only` out of the
//                          grantable chip catalog entirely, so such a string **cannot be granted
//                          to anyone, by construction** (ruling 2026-08-01). Falls back to the
//                          row's hand-declared `accountHolderOnly` ONLY where no string is cited
//                          — the manifest has nothing to say about an act with no permission.
//   NO CAPABILITY YET    ← the row's declared `capability`. Not inferred from an empty array; see
//                          the catalogue header for the 20-rows-three-meanings measurement.
//
// 🔴 THE DERIVATION IS WHAT MAKES THIS CORRECT RATHER THAN PLAUSIBLE, AND IT WAS MEASURED:
// the 2026-08-29 draft hand-set `ownerOnly: false` on **eight rows that cite an owner-only
// string** — PPL-01…04 (`team:*`), SYS-03 (`audit_log:read`), SYS-05/SYS-06 (`subscription:*`),
// PHC-08 (`audit_log:read`). Every one of those is undelegable in this model whatever a hand
// flag says, and a picker that offered them as delegable would be describing a grant the
// platform refuses to make. Nobody transcribed them wrongly; the fact simply lives somewhere
// else. `responsibilityCatalogue.test.ts` asserts this in both directions.
// ============================================================
import { PERMISSION_MANIFEST } from '../auth/permissionManifest';
import type { Responsibility, ResponsibilityCapability } from './responsibilityCatalogue';

export interface ResponsibilityMarks {
  /** Reading this work exposes confidential figures. `null` when it does not. */
  readonly sensitive: string | null;
  /** False = only the account holder may do this. `reason` says which fact decided it. */
  readonly delegable: boolean;
  readonly delegableReason: string | null;
  readonly capability: ResponsibilityCapability;
  /** One plain sentence for a `partial` / `none` / `not_software` row. `null` for `covered`. */
  readonly capabilityNote: string | null;
}

const CAPABILITY_NOTE: Record<ResponsibilityCapability, string | null> = {
  covered:      null,
  partial:      'Your business does this. The software carries part of it today.',
  none:         'Your business does this. The software cannot represent it yet.',
  not_software: 'Part of the job, not part of the software.',
};

/**
 * The consequence of every confidential string this row exercises, de-duplicated by resource so a
 * row citing `costs:read` and `costs:create` says the cost sentence once rather than twice.
 */
function exposuresOf(row: Responsibility): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of row.permissions) {
    const e = PERMISSION_MANIFEST[p];
    if (!e || e.sensitivity !== 'confidential') continue;
    if (seen.has(e.resource)) continue;
    seen.add(e.resource);
    // `exposure` is required on confidential entries (capQ (e) enforces it). The fallback is not
    // dead weight: it keeps this honest rather than blank if that ever stops being true.
    out.push(ownerReadable(e.exposure) ?? `confidential data (${resourceWords(e.resource)})`);
  }
  return out;
}

/**
 * 🔴 THE MANIFEST'S `exposure` TEXT IS WRITTEN FOR THE ROLES PAGE, NOT FOR AN OWNER TICKING A JOB —
 * and reusing it verbatim leaks model vocabulary into the one place the story forbids it.
 * MEASURED, not assumed: exactly ONE of the five confidential exposures does this today —
 * `margin`'s trailing sentence reads *"It requires costs:read, so granting it grants the basis
 * too (Rule 2)."* An owner being asked what a person DOES should never meet `costs:read`.
 *
 * So a SENTENCE carrying a `resource:verb` shape is dropped, and the consequence prose is kept.
 * Dropping the sentence rather than the string keeps the copy grammatical, and dropping it here
 * rather than editing the manifest keeps ONE authority: the Roles page still wants that sentence,
 * because on that page the string IS the subject. `positions.test.ts` C8 asserts the result over
 * every row, so a future exposure that adds mechanics is caught by the check rather than by a
 * reader. Returns null when nothing survives — never an empty string.
 */
function ownerReadable(exposure: string | undefined): string | null {
  if (!exposure) return null;
  const kept = exposure
    .split(/(?<=\.)\s+/)
    .filter((sentence) => !/[a-z_]+:[a-z_]+/.test(sentence))
    .join(' ')
    .trim();
  return kept.length > 0 ? kept : null;
}

/** The `owner-only` resources this row exercises. Empty = the manifest has no objection. */
function ownerOnlyResourcesOf(row: Responsibility): string[] {
  const seen = new Set<string>();
  for (const p of row.permissions) {
    const e = PERMISSION_MANIFEST[p];
    if (e && e.sensitivity === 'owner-only') seen.add(e.resource);
  }
  return [...seen];
}

/** Human name for a resource — `deliveries.route` → "deliveries route". No new vocabulary. */
function resourceWords(resource: string): string {
  return resource.replace(/[._]/g, ' ');
}

export function marksFor(row: Responsibility): ResponsibilityMarks {
  const exposures = exposuresOf(row);
  const ownerOnly = ownerOnlyResourcesOf(row);

  // The manifest decides wherever it has an opinion; the hand flag only covers the case it
  // structurally cannot see — a responsibility that exercises no permission at all.
  const delegable = ownerOnly.length === 0 && !(row.permissions.length === 0 && row.accountHolderOnly);
  const delegableReason = delegable
    ? null
    : ownerOnly.length > 0
      ? `Only the account holder can do this — it covers ${ownerOnly.map(resourceWords).join(' and ')}.`
      : 'Only the account holder can do this.';

  return {
    sensitive: exposures.length ? exposures.join(' ') : null,
    delegable,
    delegableReason,
    capability: row.capability,
    capabilityNote: CAPABILITY_NOTE[row.capability],
  };
}
