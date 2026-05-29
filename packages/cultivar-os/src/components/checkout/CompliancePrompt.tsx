// CompliancePrompt — generic compliance/legal notice at checkout.
// Any service_offering with compliance_title + compliance_body shows this prompt.
// Pattern covers: netting (TX TCC Ch.725), DOT inspections, EPA disposal notices,
// manager overrides, and any future legal acknowledgment.

interface Props {
  title:        string;       // "Texas law requires securing your load"
  body:         string;       // full legal paragraph
  serviceNote:  string;       // "Applied by staff before you leave"
  pricePerUnit: number;
  unitLabel:    string;       // "tree", "plant", "vehicle"
  quantity:     number;
  selected:     boolean;
  onToggle:     () => void;
}

export function CompliancePrompt({
  title, body, serviceNote, pricePerUnit, unitLabel, quantity, selected, onToggle,
}: Props) {
  const total = pricePerUnit * quantity;

  return (
    <div style={{ border: '3px solid #A32D2D', borderRadius: 12, background: '#fffbeb', padding: '16px' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>⚠️</span>
        <span style={{ fontWeight: 700, fontSize: '1rem', color: '#7f1d1d', lineHeight: 1.3 }}>
          {title}
        </span>
      </div>

      <p style={{ fontSize: '0.875rem', color: '#92400e', lineHeight: 1.6, marginBottom: 12 }}>
        {body}
      </p>

      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#7f1d1d', marginBottom: 14 }}>
        ${pricePerUnit.toFixed(2)} per {unitLabel} — {serviceNote}
      </p>

      {selected ? (
        <>
          <button
            onClick={() => {}}
            style={{
              display: 'block', width: '100%', minHeight: 48, padding: '12px 20px',
              border: 'none', borderRadius: 8, background: '#27500A', color: '#fff',
              fontSize: '1rem', fontWeight: 700, cursor: 'default', textAlign: 'center',
            }}
          >
            ✓ Added — ${total.toFixed(2)}
          </button>
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button
              onClick={onToggle}
              style={{
                background: 'none', border: 'none', fontSize: '0.8125rem', color: '#9ca3af',
                cursor: 'pointer', padding: '4px 0', textDecoration: 'underline',
                textDecorationColor: '#d1d5db',
              }}
            >
              I understand the risk — no thanks
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{
            display: 'block', width: '100%', minHeight: 48, padding: '12px 20px',
            border: '2px solid #d1d5db', borderRadius: 8, background: '#f9fafb',
            color: '#6b7280', fontSize: '1rem', fontWeight: 600, textAlign: 'center',
            lineHeight: '24px', boxSizing: 'border-box' as const,
          }}>
            Declined
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#92400e', fontStyle: 'italic', textAlign: 'center', marginTop: 8 }}>
            No service added. Customer acknowledged the notice above.
          </p>
          <div style={{ textAlign: 'center', marginTop: 6 }}>
            <button
              onClick={onToggle}
              style={{
                background: 'none', border: 'none', fontSize: '0.8125rem', color: '#27500A',
                cursor: 'pointer', padding: '4px 0', textDecoration: 'underline', fontWeight: 600,
              }}
            >
              Actually, add it back — ${total.toFixed(2)}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
