// normalizePhone — ONE canonical STORAGE normalization for user-entered phone numbers.
//
// PURPOSE:      Business phone (businesses.phone — signup R1, Settings R3) and personal phone
//               (business_members.phone — /profile self-edit) are written from three places, each
//               of which formerly trimmed inline. This is the rule-of-three dedup: a number typed
//               at signup, in Settings, or on /profile is stored identically.
//               NOT a display formatter (see cultivar CustomerCapture.formatPhone — parens/dashes
//               as you type) and NOT an E.164 delivery normalizer (see notifications/send.ts —
//               Twilio `To:`). Storage preserves the human-entered format; it only trims, collapses
//               internal whitespace, and maps empty → null.
// DEPENDENCIES: none.
// OUTPUTS:      a trimmed, single-spaced phone string, or null when the input is empty/blank.
export function normalizePhone(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const cleaned = String(raw).trim().replace(/\s+/g, ' ');
  return cleaned.length > 0 ? cleaned : null;
}

// phoneMatchKey — ONE canonical MATCHING normalization. Sibling of normalizePhone, deliberately
// separate and in the same file so nobody writes a third.
//
// WHY IT IS NOT normalizePhone: that function is a STORAGE normalizer and preserves the
// human-entered format on purpose. Matching on it would miss "(512) 456-3632" vs "5124563632" —
// which is precisely the case a checkout customer-search exists to catch, because the customer is
// standing there reading their number aloud in whatever shape they say it.
//
// Last 10 digits: drops a leading 1 / +1 so a number typed with a country code matches one without.
// Returns null when there are too few digits to identify anyone — an ABSENT key, never a loose one
// (A9: a 3-digit "key" would match half the roster and read as a hit).
export function phoneMatchKey(raw: string | null | undefined): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 7) return null;
  return digits.slice(-10);
}
