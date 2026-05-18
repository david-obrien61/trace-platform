import { format } from 'date-fns';
import type { PlantEvent } from '../../types/plant';

const EVENT_LABELS: Record<string, string> = {
  arrived:   'Arrived at nursery',
  repotted:  'Moved up a container',
  moved:     'Relocated in nursery',
  treated:   'Treatment applied',
  photo:     'Photo taken',
  priced:    'Price updated',
  reserved:  'Reserved',
  sold:      'Sold',
  lost:      'Loss recorded',
  returned:  'Returned',
};

const EVENT_ICONS: Record<string, string> = {
  arrived:  '🌱',
  repotted: '🪴',
  moved:    '📍',
  treated:  '💧',
  photo:    '📷',
  priced:   '🏷',
  reserved: '🔖',
  sold:     '✅',
  lost:     '❌',
  returned: '↩️',
};

interface PlantTimelineProps {
  events: PlantEvent[];
}

export function PlantTimeline({ events }: PlantTimelineProps) {
  if (events.length === 0) return null;

  return (
    <div className="section">
      <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 16, color: 'var(--gray-800)' }}>
        This plant's journey
      </h2>

      <div style={{ position: 'relative', paddingLeft: 32 }}>
        {/* Vertical line */}
        <div style={{
          position: 'absolute',
          left: 11,
          top: 8,
          bottom: 8,
          width: 2,
          background: 'var(--sage-border)',
        }} />

        {events.map((event, i) => {
          const isLast = i === events.length - 1;
          return (
            <div key={event.id} style={{ position: 'relative', marginBottom: isLast ? 0 : 20 }}>
              {/* Dot */}
              <div style={{
                position: 'absolute',
                left: -32,
                top: 2,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: isLast ? 'var(--green-primary)' : 'var(--white)',
                border: `2px solid ${isLast ? 'var(--green-primary)' : 'var(--sage-border)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.625rem',
              }}>
                {EVENT_ICONS[event.event_type] ?? '•'}
              </div>

              {/* Content */}
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: isLast ? 'var(--green-primary)' : 'var(--gray-800)' }}>
                  {EVENT_LABELS[event.event_type] ?? event.event_type}
                </div>

                {event.from_container && event.to_container && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--gray-600)', marginTop: 1 }}>
                    {event.from_container} → <strong>{event.to_container}</strong>
                  </div>
                )}

                {!event.from_container && event.to_container && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--gray-600)', marginTop: 1 }}>
                    {event.to_container}
                  </div>
                )}

                {event.notes && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--gray-600)', marginTop: 1 }}>
                    {event.notes}
                  </div>
                )}

                <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 2 }}>
                  {format(new Date(event.occurred_at), 'MMM d, yyyy')}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
