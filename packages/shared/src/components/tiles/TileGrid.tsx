import React from 'react';

export interface TileGridProps {
  children: React.ReactNode;
}

export function TileGrid({ children }: TileGridProps) {
  return (
    <>
      <style>{`
        .trace-tile-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px 8px;
          justify-items: center;
        }
        @media (min-width: 640px) {
          .trace-tile-grid { grid-template-columns: repeat(6, 1fr); }
        }
        @media (min-width: 1024px) {
          .trace-tile-grid { grid-template-columns: repeat(8, 1fr); }
        }
      `}</style>
      <div className="trace-tile-grid">{children}</div>
    </>
  );
}
