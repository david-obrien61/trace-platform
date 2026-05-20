import { Link } from 'react-router-dom';
import type { Plant } from '../../types/plant';

interface PlantCardProps {
  plant: Plant;
}

export function PlantCard({ plant }: PlantCardProps) {
  return (
    <Link to={`/plant/${plant.tag_id}`} style={{ display: 'block', textDecoration: 'none' }}>
      <div className="card" style={{ display: 'flex', gap: 12, padding: '12px 14px' }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 8,
          background: 'var(--sage-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          flexShrink: 0,
        }}>
          🌳
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9375rem', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {plant.common_name ?? plant.species}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--gray-600)' }}>
            {plant.current_container} · {plant.tag_id}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, color: 'var(--green-primary)' }}>
            ${plant.base_price.toLocaleString()}
          </div>
          <span className={`badge ${plant.status === 'available' ? 'badge-green' : 'badge-gray'}`}
            style={{ fontSize: '0.65rem' }}>
            {plant.status}
          </span>
        </div>
      </div>
    </Link>
  );
}
