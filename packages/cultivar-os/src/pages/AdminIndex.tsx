/**
 * AdminIndex — the Admin landing page (/admin).
 *
 * PURPOSE:      Admin is now a clickable destination (not a dead nav header). It lands on a SHORT
 *               index of business-administration sections — each a card that clicks into its
 *               destination — so the owner orients on a list, never a scroll wall (D-21). This
 *               also gives the breadcrumb a real /admin parent so Admin children (Cost-to-Produce,
 *               Business Profile, …) have a clickable ancestor.
 * DEPENDENCIES: tileRegistry NAV_IA (navChildrenOf('sec_admin') — the ONE source; cards are the
 *               Admin children, no parallel list) · useBusinessContext.can() (each card respects
 *               its own required_permission) · react-router.
 * OUTPUTS:      A gated card list. The PAGE is gated to manage_settings (router); each CARD is
 *               additionally gated by its node's permission (owner-only items hidden from a
 *               manager who lacks them).
 * INSTRUMENTATION (STD-003): [TRACE:NAV] admin-index — ON by default (standing owner instruction).
 */
import { useNavigate } from 'react-router-dom';
import { Building2, FileText, Landmark, Shield, Calculator, PlusCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useBusinessContext } from '@trace/shared/context';
import { navChildrenOf, navRoute, navPermission, navLabel } from '../registry/tileRegistry';
import { NavIndexCard } from '../components/NavIndexCard';

const GREEN = '#27500A';

// Per-node icon + description (presentation only; structure/labels/routes/permissions come from the IA).
const CARD_META: Record<string, { icon: LucideIcon; description: string }> = {
  nav_add_business:     { icon: PlusCircle, description: 'Create another business under your account.' },
  nav_business_profile: { icon: Building2,  description: 'Name, contact info, address, tax rate.' },
  nav_accounting:       { icon: Landmark,   description: 'Connect QuickBooks for automatic invoicing.' },
  nav_team:             { icon: Shield,     description: 'Invite people, set roles, and manage their devices.' },
  nav_cost_to_produce:  { icon: Calculator, description: 'Your cost-to-produce model and pricing.' },
};

export function AdminIndex() {
  const navigate = useNavigate();
  const { can } = useBusinessContext();

  // Cards ARE the Admin IA children, in declared order, gated by each node's own permission.
  const cards = navChildrenOf('sec_admin')
    .filter((n) => can(navPermission(n)) && navRoute(n) !== null);

  console.log('[TRACE:NAV] admin-index', { cards: cards.map((c) => c.key) });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sage-bg)' }}>
      <div style={{ background: GREEN, padding: '20px 16px', color: '#fff' }}>
        <p style={{ fontSize: '0.6875rem', color: '#a8c890', margin: 0, letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase' }}>
          Business administration
        </p>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, margin: 0 }}>Admin</h1>
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 540, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {cards.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>
            No administration sections are available for your role.
          </p>
        ) : (
          cards.map((n) => {
            const meta = CARD_META[n.key] ?? { icon: FileText, description: '' };
            return (
              <NavIndexCard
                key={n.key}
                icon={meta.icon}
                label={navLabel(n)}
                description={meta.description}
                onClick={() => navigate(navRoute(n)!)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
