// ============================================================
// ContactResultList — WHAT BECAME OF EACH TYPED PHONE, EMAIL AND ADDRESS (ledger #345)
//
// PURPOSE:      David, 2026-09-17: *"A number Lauren types must never disappear."* Every save that
//               carries contact details returns one result per typed value, and this is the ONE
//               place a screen shows them — checkout's confirmation, the customer editor, invoice
//               capture, the customer page's list actions. NOT SAVED renders in red with its reason;
//               the order or save it rode on still succeeded, and the list says so.
// DEPENDENCIES: contactWriter (`contactResultSentence` — the sentence lives with the outcome, so
//               every screen says the same words) · FieldError's red.
// OUTPUTS:      <ContactResultList results={…} /> — renders nothing for an empty list.
// ============================================================
import { contactResultSentence, type ContactValueResult } from '../../business-logic/contactWriter';
import { FIELD_ERROR_RED } from '../FieldError';

export function ContactResultList({ results, title = 'Contact details' }: { results: ContactValueResult[]; title?: string }) {
  if (results.length === 0) return null;
  const refused = results.filter(r => r.outcome === 'not_saved');
  return (
    <div data-testid="contact-results" role="status"
      style={{ border: `1px solid ${refused.length ? FIELD_ERROR_RED : '#e5e7eb'}`, borderRadius: 10, padding: '10px 12px', margin: '12px 0', background: refused.length ? '#fdf2f2' : '#f9fafb' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: 4 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {results.map((r, i) => (
          <li key={`${r.list}-${i}`} data-outcome={r.outcome}
            style={{ fontSize: '0.85rem', lineHeight: 1.5, color: r.outcome === 'not_saved' ? FIELD_ERROR_RED : '#374151', fontWeight: r.outcome === 'not_saved' ? 700 : 400 }}>
            {contactResultSentence(r)}
          </li>
        ))}
      </ul>
      {refused.length > 0 && (
        <p style={{ fontSize: '0.78rem', color: FIELD_ERROR_RED, margin: '6px 0 0' }}>
          Everything else was saved. Open the customer to add the {refused.length === 1 ? 'value' : 'values'} marked NOT SAVED.
        </p>
      )}
    </div>
  );
}
