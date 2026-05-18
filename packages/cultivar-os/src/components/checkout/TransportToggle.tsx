import type { TransportOption } from '../../lib/constants';
import { TRANSPORT_OPTIONS } from '../../lib/constants';

interface Props {
  value: TransportOption;
  onChange: (t: TransportOption) => void;
}

const OPTIONS: { value: TransportOption; label: string; sub: string }[] = [
  {
    value: TRANSPORT_OPTIONS.SELF,
    label: "I'll transport it myself",
    sub: 'Pick up today — netting required for large containers',
  },
  {
    value: TRANSPORT_OPTIONS.DELIVERY,
    label: 'LAWNS delivers',
    sub: 'We bring it to your property',
  },
  {
    value: TRANSPORT_OPTIONS.INSTALL,
    label: 'LAWNS delivers & installs',
    sub: 'Full planting service included',
  },
];

export function TransportToggle({ value, onChange }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        Transport method
      </p>
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '14px 16px',
              border: `2px solid ${selected ? '#27500A' : '#e5e7eb'}`,
              borderRadius: 10,
              background: selected ? '#f0f7ea' : '#fff',
              textAlign: 'left',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <span
              style={{
                flexShrink: 0,
                marginTop: 2,
                width: 18,
                height: 18,
                borderRadius: '50%',
                border: `2px solid ${selected ? '#27500A' : '#9ca3af'}`,
                background: selected ? '#27500A' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selected && (
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', display: 'block' }} />
              )}
            </span>
            <span>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.9375rem', color: '#1f2937' }}>
                {opt.label}
              </span>
              <span style={{ display: 'block', fontSize: '0.8125rem', color: '#6b7280', marginTop: 2 }}>
                {opt.sub}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
