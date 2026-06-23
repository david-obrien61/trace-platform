/**
 * AppHeader — persistent identity strip mounted once in the authenticated app shell.
 *
 * PURPOSE:      Show WHO is signed in and WHICH tenant is active on every authenticated page —
 *               active business name + signed-in email + the role badge the user ACTUALLY holds.
 *               Closes verify-universals cap #1 (persistent identity indicator). Cultivar-native
 *               rebuild of Ignition's ShopBanner shape (porting intent, not code).
 * DEPENDENCIES: useBusinessContext (BusinessProvider) — the ONE canonical identity source.
 *               Reads business.name, userEmail, role, loading. It NEVER queries the database
 *               itself (no client, query, or network call here) — one canonical fact, one source.
 * OUTPUTS:      A single sticky strip (business name · email · role pill). Renders nothing until
 *               an active business resolves (avoids an identity flash during auth resolution).
 *
 * Reused across verticals: display values come from context, not props, so the same strip works
 * for any business_type. When Role Machine lands the 5-role model, the badge inherits it for
 * free (it reads the resolved role, not a hardcoded list).
 */
import { useBusinessContext } from '../context';

// Role → badge accent. Renders the 3 roles Cultivar runs today; unknown roles fall back to the
// neutral (STAFF) swatch rather than being faked into one of the named tiers.
const ROLE_ACCENT: Record<string, { bg: string; fg: string }> = {
  OWNER:   { bg: '#FEF3C7', fg: '#92400E' }, // amber — owner / full authority
  MANAGER: { bg: '#DBEAFE', fg: '#1E40AF' }, // blue  — manager
  STAFF:   { bg: '#E5E7EB', fg: '#374151' }, // gray  — staff
};

export function AppHeader() {
  const { business, userEmail, role, loading } = useBusinessContext();

  // Nothing to show until identity resolves — no flash of an empty strip.
  if (loading || !business) return null;

  const accent = (role && ROLE_ACCENT[role]) || ROLE_ACCENT.STAFF;

  // [TRACE:HEADER] identity actually rendered for the active business (STD-003, ON by default).
  console.log('[TRACE:HEADER] render', {
    businessId: business.id,
    businessName: business.name,
    email: userEmail,
    role,
  });

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

      {/* RIGHT — who is signed in + the role they hold */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {userEmail && (
          <span
            style={{
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.78)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '40vw',
            }}
            title={userEmail}
          >
            {userEmail}
          </span>
        )}
        {role && (
          <span
            style={{
              fontSize: '0.625rem',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '3px 8px',
              borderRadius: 999,
              background: accent.bg,
              color: accent.fg,
              whiteSpace: 'nowrap',
            }}
          >
            {role}
          </span>
        )}
      </div>
    </header>
  );
}
