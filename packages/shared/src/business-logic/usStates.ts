// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      The USPS state codes, and turning whatever a person typed or pasted into one.
// DEPENDENCIES: none. Pure.
// OUTPUTS:      US_STATES · normalizeState() · isValidStateCode().
//
// ═════════════════════════════════════════════════════════════════════════════
// 🔴 WHY THIS EXISTS: "TEXAS" WAS BEING STORED AS "TE"
// ═════════════════════════════════════════════════════════════════════════════
// Found by David at the counter, 2026-09-25. The state field was
// `setState(e.target.value.toUpperCase().slice(0, 2))` — take the first two letters and hope.
// Type "Texas" and the customer's state is **TE**. Paste "Texas" from anywhere and the same.
//
// ⚠️ IT IS NOT A COSMETIC DEFECT. "TE" is not a state, so the address is unverifiable by
// construction: Google is asked about a place that cannot exist, the ③ check says it cannot be
// placed, and under ruling 1 that verdict is STORED WITH A DATE and reused for thirty days.
// Two characters of truncation become a customer who cannot be delivered to for a month.
//
// 🔴 THE FIRST TWO LETTERS ARE RIGHT FOR EXACTLY ELEVEN STATES and wrong for the other forty.
// ALabama, ALaska→AL. ARizona, ARkansas→AR. CAlifornia→CA and COlorado→CO are both correct;
// CONNECTICUT→CO is NOT. The rule is not "usually right" — it is a coin flip that happens to
// land correctly often enough that nobody checks it.
// ─────────────────────────────────────────────────────────────────────────────

export const US_STATES: ReadonlyArray<{ code: string; name: string }> = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
  // The territories LAWNS will never deliver to but a QuickBooks import can still carry.
  { code: 'PR', name: 'Puerto Rico' }, { code: 'VI', name: 'U.S. Virgin Islands' }, { code: 'GU', name: 'Guam' },
];

const BY_CODE = new Map(US_STATES.map(s => [s.code, s.code]));
const BY_NAME = new Map(US_STATES.map(s => [s.name.toUpperCase(), s.code]));

export function isValidStateCode(v: string | null | undefined): boolean {
  return typeof v === 'string' && BY_CODE.has(v.trim().toUpperCase());
}

/**
 * Turn what a person typed, pasted or imported into a USPS code.
 *
 * 🔴 IT RETURNS `null` RATHER THAN A GUESS. "TE" is not a state and must not become "TX" because
 * Texas is nearby in the alphabet — that is the same coin flip that caused this, wearing a
 * different hat. An unrecognised value is handed back as null so the surface can say so, and the
 * caller keeps what the person typed rather than the platform inventing a state for them.
 */
export function normalizeState(v: string | null | undefined): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/\s+/g, ' ').toUpperCase();
  if (s === '') return null;
  const code = BY_CODE.get(s);
  if (code) return code;
  const byName = BY_NAME.get(s);
  if (byName) return byName;
  // "TX 78642" pasted out of an address line — take the leading code when the rest is a ZIP.
  const m = /^([A-Z]{2})\s+\d{5}(-\d{4})?$/.exec(s);
  if (m && BY_CODE.has(m[1])) return m[1];
  return null;
}
