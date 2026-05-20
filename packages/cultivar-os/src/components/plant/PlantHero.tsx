import { differenceInYears, differenceInMonths } from 'date-fns';
import type { Plant } from '../../types/plant';

function formatAge(arrivedAt: string): string {
  const arrived = new Date(arrivedAt);
  const now     = new Date();
  const years   = differenceInYears(now, arrived);
  const months  = differenceInMonths(now, arrived) % 12;

  if (years === 0 && months === 0) return 'Just arrived';
  if (years === 0) return `${months} month${months !== 1 ? 's' : ''} in cultivation`;
  if (months === 0) return `${years} year${years !== 1 ? 's' : ''} in cultivation`;
  return `${years} year${years !== 1 ? 's' : ''}, ${months} month${months !== 1 ? 's' : ''} in cultivation`;
}

interface PlantHeroProps {
  plant: Plant;
}

export function PlantHero({ plant }: PlantHeroProps) {
  const age = plant.arrived_at ? formatAge(plant.arrived_at) : null;

  return (
    <div>
      {/* Photo / placeholder */}
      {plant.photo_url ? (
        <img
          src={plant.photo_url}
          alt={plant.common_name ?? plant.species}
          style={{ width: '100%', height: 240, objectFit: 'cover' }}
        />
      ) : (
        <div style={{
          width: '100%',
          height: 200,
          background: 'var(--sage-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '3rem',
        }}>
          🌳
        </div>
      )}

      <div className="section">
        {/* Tag + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', fontFamily: 'monospace' }}>
            {plant.tag_id}
          </span>
          <span className={`badge ${plant.status === 'available' ? 'badge-green' : 'badge-gray'}`}>
            {plant.status}
          </span>
        </div>

        {/* Species */}
        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, lineHeight: 1.2, marginBottom: 4 }}>
          {plant.common_name ?? plant.species}
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)', fontStyle: 'italic', marginBottom: 16 }}>
          {plant.species}
        </p>

        {/* Key stats row */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <Stat label="Container" value={plant.current_container} />
          {age && <Stat label="Age" value={age} />}
          <Stat label="Warranty" value={`${plant.warranty_months} months`} />
        </div>

        {/* Pricing */}
        <div style={{
          background: 'var(--sage-bg)',
          borderRadius: 10,
          padding: '14px 16px',
        }}>
          <PriceLine label="Plant price" amount={plant.base_price} large />
          {plant.install_price > 0 && (
            <PriceLine
              label="+ Professional installation"
              amount={plant.install_price}
              note="Choose at checkout"
            />
          )}
        </div>

        {plant.notes && (
          <p style={{ marginTop: 12, fontSize: '0.875rem', color: 'var(--gray-600)' }}>
            {plant.notes}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function PriceLine({ label, amount, large, note }: {
  label: string;
  amount: number;
  large?: boolean;
  note?: string;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
      <div>
        <span style={{ fontSize: large ? '1rem' : '0.875rem', color: large ? 'var(--gray-800)' : 'var(--gray-600)' }}>
          {label}
        </span>
        {note && (
          <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginLeft: 6 }}>
            ({note})
          </span>
        )}
      </div>
      <span style={{
        fontWeight: large ? 700 : 600,
        fontSize: large ? '1.25rem' : '0.9375rem',
        color: 'var(--green-primary)',
      }}>
        ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </span>
    </div>
  );
}
