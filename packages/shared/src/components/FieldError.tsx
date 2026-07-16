// ============================================================
// FieldError — THE required-field validation surface (the "FIX 5" pattern, ledger #102)
//
// PURPOSE:      The cross-cutting platform rule (user_stories.md ## NEEDED; §6 r15 / M2): a save
//               with a bad or empty required field BLOCKS, HIGHLIGHTS the offending field, and SAYS
//               WHY — never fails silently, and never a greyed button with no reason. A greyed
//               button that won't say what's wrong is the exact anti-pattern this pattern exists to
//               kill: the owner is left guessing, which is worse than a refusal.
//
// WHY IT IS SHARED (STD-011 / §6 r8 — rule of three, already exceeded):
//               `errBorder` existed in THREE byte-identical copies (shared Settings, Discounts,
//               InventoryEditor) and `FieldError` in two, plus four hand-inlined copies of its
//               <p> body. Discounts' own comment pointed at Settings as "the reference" — the
//               copies knew they were copies. Same operation, same intent, N spellings: exactly the
//               class §6 r8 says to extract, and the class that drifts silently (a red that stops
//               matching, a message style that diverges) because nothing errors when it does.
//               ONE home now; every consumer inherits a fix to the pattern.
//
// DEPENDENCIES: none (React types only). No vertical noun (AC-1), no tenant identity (STD-015).
// OUTPUTS:      FIELD_ERROR_RED · errBorder(hasErr) · <FieldError msg={…} />
// USAGE:        <input style={{ ...input, ...errBorder(!!errors.size) }} />
//               <FieldError msg={errors.size} />
//               …with the validator returning a Record<string, string> and the save doing:
//               `if (Object.keys(errs).length) { setErrors(errs); return; }` — validate on
//               save-ATTEMPT, block, show. Never disable the button in place of explaining.
// ============================================================

/** The platform error red — the same red as the compliance/netting prompt (§6 r3). */
export const FIELD_ERROR_RED = '#A32D2D';

/** Red error border merged onto an input whose field failed validation. Spread it LAST so it wins:
 *  `style={{ ...inputStyle, ...errBorder(!!errors.field) }}`. Returns {} when the field is valid,
 *  so it is safe to spread unconditionally. */
export function errBorder(hasErr: boolean): React.CSSProperties {
  return hasErr ? { borderColor: FIELD_ERROR_RED, boxShadow: `0 0 0 1px ${FIELD_ERROR_RED}` } : {};
}

/** Inline red message under a field. Renders nothing when the field is valid — so it can sit in the
 *  markup permanently and never needs a conditional wrapper at the call site. */
export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p style={{ margin: '3px 0 0', fontSize: '0.75rem', fontWeight: 600, color: FIELD_ERROR_RED }}>{msg}</p>;
}
