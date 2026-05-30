import React from 'react';

export interface ProgressBarProps {
  value: number;       // 0–100
  color?: string;      // fill color, defaults to TRACE green
  trackColor?: string; // background track color
  height?: number;
  label?: string;      // accessible label
  showPercent?: boolean;
}

export function ProgressBar({
  value,
  color = '#27500A',
  trackColor = '#EAF3DE',
  height = 8,
  label,
  showPercent = false,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));

  return (
    <div style={{ width: '100%' }}>
      {(label || showPercent) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          {label && <span style={{ fontSize: 12, color: '#555' }}>{label}</span>}
          {showPercent && <span style={{ fontSize: 12, color: '#555' }}>{pct}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        style={{
          width: '100%',
          height,
          borderRadius: height,
          background: trackColor,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: height,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}
