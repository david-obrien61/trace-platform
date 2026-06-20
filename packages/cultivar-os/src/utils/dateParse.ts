/**
 * ── DATE PARSE (Cultivar OS) · THUNDER Wave 2 fix · 2026-06-20 ───────────────────
 *
 * PURPOSE      Normalize an OCR-extracted date string to strict YYYY-MM-DD so it binds to
 *              an HTML <input type="date">. OCR returns dates "as printed" (LAWNS prints US
 *              MM/DD/YYYY); a non-ISO value renders the date input EMPTY — which is why
 *              invoice Date / Due / Delivery all came back blank while text fields populated.
 * DEPENDENCIES none (pure). US month-first assumption (Texas invoices).
 * OUTPUTS      'YYYY-MM-DD' on success; '' when absent/unparseable (D-9 — never fabricate).
 */
export function toISODate(raw: string | null | undefined): string {
  if (!raw) return '';
  const s = String(raw).trim();
  if (!s) return '';
  // Already ISO (optionally with a time component) → take the date part
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // MM/DD/YYYY · M/D/YYYY · MM-DD-YYYY · MM.DD.YYYY · 2-digit year (MM/DD/YY)
  const mdy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (mdy) {
    const mm = mdy[1].padStart(2, '0');
    const dd = mdy[2].padStart(2, '0');
    const year = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
    if (+mm >= 1 && +mm <= 12 && +dd >= 1 && +dd <= 31) return `${year}-${mm}-${dd}`;
  }
  // Textual month ("June 22, 2026" / "Jun 22 2026") → Date fallback (date-only, no TZ shift)
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    if (y > 1900 && y < 2200) {
      return `${y}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }
  }
  return ''; // genuinely unreadable — leave empty, do not fabricate (D-9)
}
