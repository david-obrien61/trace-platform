// D-40: the tax rate is per-tenant SUPPLIED DATA (business_pricing_config.config.taxRate via the
// resolveTaxRate seam) — never a hardcoded default. An unset rate renders "Tax: not identified"
// (redline), never a fabricated 8.25%. The old `TAX_RATE = 0.0825` constant is retired.

export const DEMO_BUSINESS_ID = 'a1b2c3d4-0000-0000-0000-000000000001';

// 🔴 NO SIZE LIST LIVES HERE (ledger #343). `LARGE_CONTAINERS` and `CONTAINER_SIZES` were deleted
// 2026-09-16: both had ZERO importers, and both named sizes LAWNS does not sell (60, 100) while
// missing ones it does (65, 200). David, 2026-09-16: *"No second list of sizes."* The nursery's
// sizes are its container ladder — `container_ladder`, read by `lib/containerLadderRead.ts`.

export const TRANSPORT_OPTIONS = {
  SELF:     'self',
  DELIVERY: 'delivery',
  INSTALL:  'install',
} as const;

export type TransportOption = typeof TRANSPORT_OPTIONS[keyof typeof TRANSPORT_OPTIONS];
