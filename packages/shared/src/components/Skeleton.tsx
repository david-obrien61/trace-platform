import React from 'react';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
  style?: React.CSSProperties;
}

const pulse = `
@keyframes trace-skeleton-pulse {
  0%   { opacity: 1; }
  50%  { opacity: 0.4; }
  100% { opacity: 1; }
}
`;

let styleInjected = false;
function injectStyle() {
  if (styleInjected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.textContent = pulse;
  document.head.appendChild(el);
  styleInjected = true;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 6, style }: SkeletonProps) {
  injectStyle();
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: '#E0E0E0',
        animation: 'trace-skeleton-pulse 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

// Convenience: a full card-shaped skeleton block
export function SkeletonCard({ height = 80 }: { height?: number }) {
  return (
    <div style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #E0E0E0' }}>
      <Skeleton width="40%" height={12} style={{ marginBottom: 10 }} />
      <Skeleton width="100%" height={height - 40} />
    </div>
  );
}
