/**
 * AppHeader — persistent identity strip + account menu, mounted once in the authenticated shell.
 *
 * PURPOSE:      Show WHO is signed in and WHICH tenant is active on every authenticated page —
 *               active business name + signed-in name + role badge — AND hang the standard account
 *               menu off the name/avatar: a card (name + email + role) then Your Profile · Help ·
 *               + Business · Sign out. This is the PRIMARY identity entry point (the old per-page
 *               dashboard account-action row is removed; its actions live here). Settings is NOT in
 *               this menu — Settings is a nav-rail section, and listing it here re-creates the
 *               duplicate-nav bug we removed.
 * DEPENDENCIES: useBusinessContext (BusinessProvider) — the ONE canonical identity source (business
 *               name · userName · userEmail · role · isOwner · loading). NEVER queries the DB itself —
 *               identity is read from context only, no client or network call here (cap #1 enforces this).
 *               react-router useNavigate for the menu links. Sign out is INJECTED via the `onSignOut`
 *               prop (AppLayout wires it to the vertical's auth client) so the header stays client-free.
 * OUTPUTS:      A sticky strip; the right side opens a dropdown menu. Renders nothing until an active
 *               business resolves (no identity flash during auth resolution).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusinessContext } from '../context';

export interface AppHeaderProps {
  /** Account "Sign out" handler — injected by the vertical's layout (does signOut + redirect). */
  onSignOut?: () => void | Promise<void>;
}

// Role → badge accent. Renders the 3 roles Cultivar runs today; unknown roles fall back to the
// neutral (STAFF) swatch rather than being faked into one of the named tiers.
const ROLE_ACCENT: Record<string, { bg: string; fg: string }> = {
  OWNER:   { bg: '#FEF3C7', fg: '#92400E' }, // amber — owner / full authority
  MANAGER: { bg: '#DBEAFE', fg: '#1E40AF' }, // blue  — manager
  STAFF:   { bg: '#E5E7EB', fg: '#374151' }, // gray  — staff
};

export function AppHeader({ onSignOut }: AppHeaderProps = {}) {
  const { business, userName, userEmail, role, isOwner, loading } = useBusinessContext();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Nothing to show until identity resolves — no flash of an empty strip.
  if (loading || !business) return null;

  const accent = (role && ROLE_ACCENT[role]) || ROLE_ACCENT.STAFF;
  // Primary = the person's name; email is the secondary detail. userName already falls back to
  // email at the context layer; belt-and-suspenders here.
  const displayName = userName ?? userEmail;
  const initial = (displayName ?? '?').trim().charAt(0).toUpperCase();

  // [TRACE:HEADER] identity actually rendered for the active business (STD-003, ON by default).
  console.log('[TRACE:HEADER] render', {
    businessId: business.id,
    businessName: business.name,
    name: userName,
    email: userEmail,
    role,
  });

  function go(path: string) {
    setMenuOpen(false);
    navigate(path);
  }

  async function signOut() {
    setMenuOpen(false);
    console.log('[TRACE:HEADER] sign out');
    await onSignOut?.();
  }

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 16px',
        background: 'var(--green-primary, #27500A)',
        color: 'var(--white, #ffffff)',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        flexShrink: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* LEFT — active tenant */}
      <span
        style={{
          fontSize: '0.9rem',
          fontWeight: 700,
          letterSpacing: '-0.01em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={business.name}
      >
        {business.name}
      </span>

      {/* RIGHT — account button (name + role + avatar) → opens the account menu */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,0.10)', border: 'none', borderRadius: 999,
            padding: '4px 8px 4px 12px', color: '#fff', cursor: 'pointer',
          }}
        >
          {displayName && (
            <span
              style={{
                fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.92)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '32vw',
              }}
            >
              {displayName}
            </span>
          )}
          {role && (
            <span
              style={{
                fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em',
                textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999,
                background: accent.bg, color: accent.fg, whiteSpace: 'nowrap',
              }}
            >
              {role}
            </span>
          )}
          <span style={{
            width: 28, height: 28, borderRadius: 999, background: 'rgba(255,255,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.8125rem', fontWeight: 700,
          }}>
            {initial}
          </span>
        </button>

        {menuOpen && (
          <>
            {/* click-out backdrop */}
            <div
              onClick={() => setMenuOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 30 }}
            />
            <div
              role="menu"
              style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 31,
                minWidth: 240, background: '#fff', color: 'var(--gray-800, #1f2937)',
                borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
                overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              {/* identity card */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #eef1ea' }}>
                <p style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0, color: 'var(--gray-800, #1f2937)' }}>
                  {displayName}
                </p>
                {userEmail && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--gray-400, #6b7280)', margin: '2px 0 0' }}>
                    {userEmail}
                  </p>
                )}
                {role && (
                  <span style={{
                    display: 'inline-block', marginTop: 8, fontSize: '0.625rem', fontWeight: 800,
                    letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 8px',
                    borderRadius: 999, background: accent.bg, color: accent.fg,
                  }}>
                    {role}
                  </span>
                )}
              </div>

              {/* items — Settings deliberately omitted (it is a nav-rail section, not an account action) */}
              <MenuItem label="Your Profile" onClick={() => go('/profile')} />
              <MenuItem label="Help" onClick={() => go('/help')} />
              {isOwner && <MenuItem label="+ Business" onClick={() => go('/add-business')} />}
              <div style={{ borderTop: '1px solid #eef1ea' }} />
              <MenuItem label="Sign out" onClick={signOut} />
            </div>
          </>
        )}
      </div>
    </header>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
        padding: '11px 16px', fontSize: '0.875rem', fontWeight: 600,
        color: 'var(--gray-800, #1f2937)', cursor: 'pointer',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f6ee'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
    >
      {label}
    </button>
  );
}
