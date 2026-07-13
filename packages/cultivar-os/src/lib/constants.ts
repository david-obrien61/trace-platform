// D-40: the tax rate is per-tenant SUPPLIED DATA (business_pricing_config.config.taxRate via the
// resolveTaxRate seam) — never a hardcoded default. An unset rate renders "Tax: not identified"
// (redline), never a fabricated 8.25%. The old `TAX_RATE = 0.0825` constant is retired.

export const DEMO_BUSINESS_ID = 'a1b2c3d4-0000-0000-0000-000000000001';

export const LARGE_CONTAINERS = ['15 gal', '30 gal', '45 gal', '60 gal', '100 gal'];

export const CONTAINER_SIZES = [
  '4 in', '1 gal', '3 gal', '5 gal', '10 gal',
  '15 gal', '30 gal', '45 gal', '60 gal', '100 gal',
];

export const TRANSPORT_OPTIONS = {
  SELF:     'self',
  DELIVERY: 'delivery',
  INSTALL:  'install',
} as const;

export type TransportOption = typeof TRANSPORT_OPTIONS[keyof typeof TRANSPORT_OPTIONS];
