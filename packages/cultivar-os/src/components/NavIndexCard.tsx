/**
 * NavIndexCard — one clickable row on a section landing index (Admin / Settings).
 *
 * PURPOSE:      A short, scannable index entry so a parent nav item lands on a list of its
 *               sections (direct access over scroll, D-21) instead of a data/scroll wall. Used
 *               by AdminIndex and SettingsIndex (rule of three — ONE card, no drift).
 * DEPENDENCIES: lucide-react icon (passed in) · forest-green tokens (inline, matches the app).
 * OUTPUTS:      A full-width card button: icon + label + one-line description + chevron.
 */
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';

const GREEN = '#27500A';
const GRAY  = '#6b7280';
const DARK  = '#111827';

export function NavIndexCard({
  icon: Icon, label, description, onClick,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14,
        padding: '16px 16px', cursor: 'pointer',
      }}
    >
      <span style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: '#f0f7e8', color: GREEN,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={20} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: '0.95rem', color: DARK }}>{label}</span>
        <span style={{ display: 'block', fontSize: '0.8125rem', color: GRAY, marginTop: 2, lineHeight: 1.4 }}>
          {description}
        </span>
      </span>
      <ChevronRight size={18} color="#9ca3af" style={{ flexShrink: 0 }} />
    </button>
  );
}
