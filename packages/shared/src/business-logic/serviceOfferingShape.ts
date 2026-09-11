// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      THE ONE SHAPE RULE for the columns of a `service_offerings` row that depend on its
//               category — `transport_mode`, `requires_address`, `trigger_transport_mode`. Every
//               writer of the table asks it: the Settings editor (add, edit AND the On/Off toggle),
//               the books review (through `buildServiceRows`) and the website-discovery seed.
// DEPENDENCIES: none. PURE — no client, no fetch, no React.
// OUTPUTS:      TRANSPORT_MODES · TRANSPORT_MODE_REQUIRED · isTransportMode · transportBindingError ·
//               defaultRequiresAddress · categoryScopedFields
//
// Run: node scripts/run-tests.mjs serviceOfferingShape
//
// ══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 WHY IT EXISTS (R-120, David 2026-09-11). On 2026-09-09 LAWNS's Trip Charge was written by the
// books review as `category = 'transport'` with `transport_mode` NULL, and it DID NOT APPEAR ON AN
// ORDER AT ALL — the checkout reported that transport was unavailable. Checkout sorts transport rows
// by mode and nothing else (`cultivar-os/src/lib/transport.ts` → `find(mode === 'self')`,
// `filter(mode === 'staff')`), so a NULL row matches neither and falls out with no error.
//
// Two writers, two different failures of the same rule:
//   · the books review never wrote a mode at all;
//   · the Settings editor HAD a mode-required check that COULD NEVER FIRE — both forms seeded the
//     mode with 'staff', so the select always held a value, and the edit form turned a NULL mode
//     into 'staff' the moment it opened. That is a silent default, which is what the ruling forbids.
// A rule restated per writer is how both happened, so there is no second copy of it.
//
// ══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE RULING: "PICK TRANSPORT, AND THE MODE FIELD APPEARS AND IS REQUIRED." The option stays on
// offer and becomes unsubmittable without a mode.
//   · NOT a silent default — 'self' versus 'staff' is a business fact nobody can infer.
//   · NOT removing the option — an owner who cannot model delivery cannot use checkout at all.
//
// ⚠️ `requires_address` FOLLOWS THE MODE AS A DEFAULT, NEVER A LOCK. Measured on Test Dave's three
// live transport rows (2026-09-10): both staff rows `true`, the self row `false`. A staff drop to a
// site with no street address is a real case, so an explicit value always wins.
//
// ⚠️ `trigger_transport_mode` IS AN ADD-ON COLUMN — it gates an add-on to a chosen transport mode. A
// transport row writes NULL there, which is what all three measured transport rows carry.
// ─────────────────────────────────────────────────────────────────────────────

/** The two values `service_offerings.transport_mode` accepts (20260529_businesses_f CHECK). */
export const TRANSPORT_MODES = ['self', 'staff'] as const;
export type TransportMode = typeof TRANSPORT_MODES[number];

/** What an owner is told when a transport service does not say who transports. One sentence, every surface. */
export const TRANSPORT_MODE_REQUIRED =
  'Choose who transports — your staff, or the customer. A transport service that does not say never appears at checkout.';

export function isTransportMode(v: unknown): v is TransportMode {
  return v === 'self' || v === 'staff';
}

/**
 * The refusal. `null` means the row may be written; a string is the reason it may not.
 * Only a TRANSPORT row can fail it — every other category ignores the mode.
 */
export function transportBindingError(
  category: string | null | undefined,
  transportMode: string | null | undefined,
): string | null {
  if (category !== 'transport') return null;
  return isTransportMode(transportMode) ? null : TRANSPORT_MODE_REQUIRED;
}

/** The address default for a mode: staff carry it somewhere, so they need somewhere. A default, not a lock. */
export function defaultRequiresAddress(transportMode: string | null | undefined): boolean {
  return transportMode === 'staff';
}

export interface CategoryScopedFields {
  transport_mode: TransportMode | null;
  requires_address: boolean;
  trigger_transport_mode: TransportMode | null;
}

export type CategoryScopedResult =
  | { ok: true; fields: CategoryScopedFields }
  | { ok: false; reason: string };

/**
 * The category-scoped columns a writer puts on the row — ONE mapping for every writer.
 *
 * Clears what does not apply, so moving a service between categories can never leave a stale rule
 * behind: a mode typed against an add-on is not written, and an add-on trigger is not written on a
 * transport row. Refuses — never defaults — a transport row with no mode.
 */
export function categoryScopedFields(input: {
  category: string;
  transportMode?: string | null;
  /** Omitted or null ⇒ the mode's default. A boolean is the owner's explicit answer and wins. */
  requiresAddress?: boolean | null;
  triggerTransportMode?: string | null;
}): CategoryScopedResult {
  const refusal = transportBindingError(input.category, input.transportMode);
  if (refusal !== null) return { ok: false, reason: refusal };

  if (input.category === 'transport') {
    const mode = input.transportMode as TransportMode;
    return {
      ok: true,
      fields: {
        transport_mode: mode,
        requires_address: typeof input.requiresAddress === 'boolean' ? input.requiresAddress : defaultRequiresAddress(mode),
        trigger_transport_mode: null,
      },
    };
  }

  const trigger = input.triggerTransportMode;
  return {
    ok: true,
    fields: {
      transport_mode: null,
      requires_address: false,
      trigger_transport_mode: input.category === 'addon' && isTransportMode(trigger) ? trigger : null,
    },
  };
}
