import React from 'react';
import type { LucideProps } from 'lucide-react';
import { Lock } from 'lucide-react';

export type TileState = 'active' | 'available' | 'locked';

export interface TileProps {
  id: string;
  label: string;
  icon: React.ComponentType<LucideProps>;
  color: string;
  bg: string;
  state: TileState;
  onEnable?: () => void;
  onNavigate?: () => void;
  tierRequired?: string;
  count?: number;
}

export function Tile({
  label,
  icon: Icon,
  color,
  bg,
  state,
  onEnable,
  onNavigate,
  tierRequired,
  count,
}: TileProps) {
  const isLocked    = state === 'locked';
  const isAvailable = state === 'available';
  const isActive    = state === 'active';

  function handleClick() {
    if (isActive && onNavigate)      onNavigate();
    if (isAvailable && onEnable)     onEnable();
  }

  return (
    <div
      role={isLocked ? undefined : 'button'}
      tabIndex={isLocked ? undefined : 0}
      onClick={isLocked ? undefined : handleClick}
      onKeyDown={isLocked ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        width: 72,
        cursor: isLocked ? 'default' : 'pointer',
        userSelect: 'none',
      }}
    >
      {/* ── Icon box ── */}
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 60,
          height: 60,
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isLocked ? '#e5e7eb' : bg,
          filter: isLocked ? 'grayscale(1)' : 'none',
          opacity: isLocked ? 0.4 : 1,
          border: '1px solid rgba(0,0,0,0.07)',
          boxShadow: isActive
            ? '0 2px 8px rgba(0,0,0,0.12)'
            : '0 1px 3px rgba(0,0,0,0.06)',
          transition: 'box-shadow 0.15s',
        }}>
          <Icon size={28} color={isLocked ? '#9ca3af' : color} />
        </div>

        {/* Active + count → amber notification badge top-left */}
        {isActive && count != null && count > 0 && (
          <div style={{
            position: 'absolute',
            top: -4,
            left: -4,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            background: '#f59e0b',
            border: '2px solid #fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
          }}>
            <span style={{ fontSize: '0.5rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>
              {count > 99 ? '99+' : count}
            </span>
          </div>
        )}

        {/* Active → green status dot */}
        {isActive && (
          <div style={{
            position: 'absolute',
            top: -3,
            right: -3,
            width: 11,
            height: 11,
            borderRadius: '50%',
            background: '#22c55e',
            border: '2px solid #fff',
          }} />
        )}

        {/* Locked → red lock badge (matches CAI pattern) */}
        {isLocked && (
          <div style={{
            position: 'absolute',
            top: -4,
            right: -4,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'var(--red-border, #A32D2D)',
            border: '2px solid #fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Lock size={9} color="#fff" strokeWidth={2.5} />
          </div>
        )}
      </div>

      {/* ── Label ── */}
      <span style={{
        fontSize: '0.625rem',
        fontWeight: 600,
        color: isLocked ? 'var(--gray-400, #9ca3af)' : 'var(--gray-800, #1f2937)',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        lineHeight: 1.3,
        maxWidth: 72,
        wordBreak: 'break-word',
      }}>
        {label}
      </span>

      {/* ── Available → [ Enable ] ── */}
      {isAvailable && (
        <button
          onClick={(e) => { e.stopPropagation(); onEnable?.(); }}
          style={{
            fontSize: '0.5625rem',
            fontWeight: 700,
            color: 'var(--green-primary, #27500A)',
            background: 'none',
            border: '1px solid var(--green-primary, #27500A)',
            borderRadius: 4,
            padding: '2px 8px',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            lineHeight: 1.6,
          }}
        >
          Enable
        </button>
      )}

      {/* ── Locked → tier label ── */}
      {isLocked && tierRequired && (
        <span style={{
          fontSize: '0.5625rem',
          fontWeight: 600,
          color: 'var(--gray-400, #9ca3af)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          {tierRequired}
        </span>
      )}
    </div>
  );
}
