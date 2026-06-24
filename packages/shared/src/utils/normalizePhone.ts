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
