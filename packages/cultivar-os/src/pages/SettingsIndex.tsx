/**
 * SettingsIndex — the Settings landing page (/settings).
 *
 * PURPOSE:      Clicking "Settings" lands here, on a SHORT index — NOT the long business-settings
 *               page (direct-access over scroll, D-21). Settings = USER-level: Your Profile is the
 *               primary entry; for those with access, a clear link to business administration and
 *               to the full business-settings page (the Services/Team/cost-config wall, now a
 *               deliberate destination rather than the default landing).
 * DEPENDENCIES: useBusinessContext (isOwner / userPermissions → who may see business settings) ·
 *               react-router.
 * OUTPUTS:      Your Profile (every authenticated user) + (manage_settings) Business administration
 *               (→ /admin) + All business settings (→ /settings/all).
 * INSTRUMENTATION (STD-003): [TRACE:NAV] settings-index — ON by default (standing owner instruction).
 */
import { useNavigate } from 'react-router-dom';
import { UserCircle, Shield, SlidersHorizontal } from 'lucide-react';
import { useBusinessContext } from '@trace/shared/context';
import { NavIndexCard } from '../components/NavIndexCard';

const GREEN = '#27500A';

export function SettingsIndex() {
  const navigate = useNavigate();
  const { isOwner, userPermissions } = useBusinessContext();
  const canManageSettings = isOwner || (userPermissions ?? []).includes('manage_settings');

  console.log('[TRACE:NAV] settings-index', { canManageSettings });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sage-bg)' }}>
      <div style={{ background: GREEN, padding: '20px 16px', color: '#fff' }}>
        <p style={{ fontSize: '0.6875rem', color: '#a8c890', margin: 0, letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase' }}>
          Your account
        </p>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, margin: 0 }}>Settings</h1>
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 540, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* USER-level — available to every authenticated person. */}
        <NavIndexCard
          icon={UserCircle}
          label="Your Profile"
          description="Your name, phone, and login email."
          onClick={() => navigate('/profile')}
        />

        {/* BUSINESS-level — only for those who can manage the business. */}
        {canManageSettings && (
          <>
            <NavIndexCard
              icon={Shield}
              label="Business administration"
              description="Business profile, accounting, roles, and cost-to-produce."
              onClick={() => navigate('/admin')}
            />
            <NavIndexCard
              icon={SlidersHorizontal}
              label="All business settings"
              description="Services, team, tax rate, install price, and cost config."
              onClick={() => navigate('/settings/all')}
            />
          </>
        )}
      </div>
    </div>
  );
}
