// Cultivar OS role definitions and permission bundles.
//
// Three roles cover the entire nursery staff hierarchy:
//   OWNER   — the nursery owner. Full access including settings and team management.
//   MANAGER — Lauren's role. Runs day-to-day ops: checkout, deliveries, campaigns.
//             Cannot change business settings or manage team members.
//   STAFF   — Seasonal / part-time. Can scan QR and run checkout. No admin views.
//
// Permissions are stored as string arrays in the business_members.permissions JSONB column.
// Use checkPermission(member.permissions, 'manage_settings') at call sites to gate UI.

export const ROLES = ['OWNER', 'MANAGER', 'STAFF'] as const;
export type CultivarRole = typeof ROLES[number];

export const PERMISSIONS = {
  VIEW_DASHBOARD:    'view_dashboard',
  QR_CHECKOUT:       'qr_checkout',
  VIEW_ORDERS:       'view_orders',
  MANAGE_DELIVERIES: 'manage_deliveries',
  MANAGE_CUSTOMERS:  'manage_customers',
  MANAGE_CAMPAIGNS:  'manage_campaigns',
  VIEW_REPORTS:      'view_reports',
  MANAGE_SETTINGS:   'manage_settings',   // settings page, QB connect, team management
} as const;

export const DEFAULT_PERMISSIONS: Record<CultivarRole, string[]> = {
  OWNER: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.QR_CHECKOUT,
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.MANAGE_DELIVERIES,
    PERMISSIONS.MANAGE_CUSTOMERS,
    PERMISSIONS.MANAGE_CAMPAIGNS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_SETTINGS,
  ],
  MANAGER: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.QR_CHECKOUT,
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.MANAGE_DELIVERIES,
    PERMISSIONS.MANAGE_CUSTOMERS,
    PERMISSIONS.MANAGE_CAMPAIGNS,
    PERMISSIONS.VIEW_REPORTS,
  ],
  STAFF: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.QR_CHECKOUT,
    PERMISSIONS.VIEW_ORDERS,
  ],
};

// Human-readable role labels for the invite UI.
export const ROLE_LABELS: Record<CultivarRole, string> = {
  OWNER:   'Owner',
  MANAGER: 'Manager',
  STAFF:   'Staff',
};

export const ROLE_DESCRIPTIONS: Record<CultivarRole, string> = {
  OWNER:   'Full access — settings, team, QB, all reports',
  MANAGER: 'Day-to-day ops — checkout, deliveries, campaigns, orders',
  STAFF:   'QR checkout and order history only',
};
