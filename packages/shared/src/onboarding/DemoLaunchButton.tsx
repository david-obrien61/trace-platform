import React from 'react';

interface DemoLaunchButtonProps {
  /** Button label text */
  label?: string;
  /** Subtext shown below the label */
  description?: string;
  /** true = jump directly to the scenario picker (step 3), skipping shop setup */
  quick?: boolean;
  /** Base URL of the vertical app. Defaults to current origin + '/'. */
  baseUrl?: string;
  /** Accent color for border + label. Defaults to Ignition green. */
  primaryColor?: string;
  style?: React.CSSProperties;
}

/**
 * DemoLaunchButton — shared launcher for the pain-point onboarding wizard.
 *
 * Navigates to ?demo=true (full walkthrough) or ?demo=quick (jump to scenario
 * picker). The receiving app handles the URL param and mounts the wizard.
 *
 * AC-1 compliant: zero vertical nouns. Color and copy are caller-supplied.
 */
export const DemoLaunchButton: React.FC<DemoLaunchButtonProps> = ({
  label = 'Launch Demo',
  description = 'See what this platform can do for your business in 30 minutes',
  quick = false,
  baseUrl,
  primaryColor = '#22c55e',
  style,
}) => {
  const handleLaunch = () => {
    const base = baseUrl ?? (window.location.origin + '/');
    const sep = base.includes('?') ? '&' : '?';
    window.location.href = `${base}${sep}demo=${quick ? 'quick' : 'true'}`;
  };

  return (
    <button
      onClick={handleLaunch}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: '100%',
        padding: '20px 24px',
        borderRadius: 16,
        border: `1.5px solid ${primaryColor}50`,
        background: `${primaryColor}12`,
        color: primaryColor,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        cursor: 'pointer',
        letterSpacing: '0.05em',
        transition: 'background 0.15s, border-color 0.15s',
        ...style,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = `${primaryColor}20`;
        (e.currentTarget as HTMLButtonElement).style.borderColor = `${primaryColor}80`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = `${primaryColor}12`;
        (e.currentTarget as HTMLButtonElement).style.borderColor = `${primaryColor}50`;
      }}
    >
      <span style={{ fontWeight: 900, fontSize: '0.95rem', textTransform: 'uppercase' }}>
        {label}
      </span>
      {description && (
        <span style={{
          fontWeight: 500,
          fontSize: '0.78rem',
          color: '#94a3b8',
          textTransform: 'none',
          letterSpacing: 0,
          lineHeight: 1.4,
          textAlign: 'center',
        }}>
          {description}
        </span>
      )}
    </button>
  );
};

export default DemoLaunchButton;
