// ─────────────────────────────────────────────────────────────────────────────
// onHandProvenance — an on-hand number NEVER appears without saying where it came from.
//
// PURPOSE:  R-170 one surface further in — *"a promise on a surface is derived from the thing
//           that fulfils it."* **A bare "10" on a till screen is a promise that somebody knows
//           there are ten.** Today nobody does.
//
// 🔴 THE MEASUREMENT, LIVE 2026-09-23. **512 of LAWNS's 632 live lots sit at exactly qty 10,
//           120 sit at 0, and NOT ONE lot carries any other value.** All 512 were written by a
//           single import run on 2026-09-21. The purchases-minus-sales derivation (David's model,
//           2026-09-01, reaffirmed 2026-09-16) has **never run and has no inputs**: zero
//           purchase-kind ledger rows, and 3,924 of 3,925 order lines unlinked to a lot. Only
//           **two lots have ever been counted.** So the number Lauren sees at the till is a flat
//           import default, and until now it looked exactly like a measured one.
//
// 🔴 IT DOES NOT HIDE A PLACEHOLDER AND IT DOES NOT CHANGE ONE. David, 2026-09-23: *"Do NOT hide
//           placeholders — the block must still fire at sale… the placeholder is deliberately low
//           — the BLOCK AT SALE IS THE RECONCILE TRIGGER. Do not raise it, do not hide it."*
//           Running out is the mechanism that sends somebody to count. This module only makes the
//           number say what kind of number it is.
//
// ⚠️ ABSENT IS NOT EMPTY (A9). A row whose `qty_basis` is missing — a bundle reading rows from
//           before the migration — is reported as `unknown`, NOT quietly as a placeholder and
//           never as a bare figure. "We have not been told" and "nobody has counted it" are
//           different facts, and the screen says which.
//
// DEPENDENCIES: none. Pure — no React, no database, no clock except the date passed in.
// OUTPUTS:  QtyBasis · OnHandDescription · describeOnHand.
// ─────────────────────────────────────────────────────────────────────────────

/** Where a quantity came from. Mirrors `business_inventory.qty_basis` (20260923m). */
export type QtyBasis = 'counted' | 'derived' | 'placeholder' | 'unknown';

export interface OnHandDescription {
  /** The figure itself, unchanged. */
  qty: number;
  basis: QtyBasis;
  /** What the screen prints after the number — "placeholder", "counted 20 Sep", "derived". */
  label: string;
  /** The whole thing: "10 · placeholder". NEVER just the number. */
  text: string;
  /** True when this figure has been verified by a person or a real derivation. */
  trusted: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "20 Sep" — short, because it sits inline beside a number on a till row. */
function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/**
 * Describe one on-hand figure.
 *
 * 🔴 THE INVARIANT THIS FILE EXISTS FOR: `text` ALWAYS carries a basis word. There is no input —
 * not a null basis, not a null date, not a zero quantity — for which `text` is just the number.
 * `onHandProvenance.test.ts` §D asserts that over every combination, because a single bare figure
 * is the whole defect.
 */
export function describeOnHand(
  row: { qty?: number | null; qty_basis?: string | null; qty_basis_at?: string | null },
): OnHandDescription {
  const qty = Number(row.qty) || 0;
  const raw = (row.qty_basis ?? '').trim();
  const basis: QtyBasis =
    raw === 'counted' || raw === 'derived' || raw === 'placeholder' ? raw : 'unknown';

  let label: string;
  switch (basis) {
    case 'counted': {
      const when = shortDate(row.qty_basis_at);
      // A count with no date is still a count — say so without inventing a day for it.
      label = when ? `counted ${when}` : 'counted';
      break;
    }
    case 'derived':
      label = 'derived';
      break;
    case 'placeholder':
      label = 'placeholder';
      break;
    default:
      // 🔴 NOT "placeholder". A bundle reading pre-migration rows has not been TOLD the basis,
      // which is a different fact from having been told it is unverified.
      label = 'basis unknown';
  }

  return { qty, basis, label, text: `${qty} · ${label}`, trusted: basis === 'counted' || basis === 'derived' };
}
