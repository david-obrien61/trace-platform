// PURPOSE:      THE SIX SURFACE STATES (ruling 2026-07-30). A surface tells the truth about its own
//               state. Each of the six says something DIFFERENT, and none may be confused for
//               another — which is the whole point, because before this module the platform had
//               essentially one refusal (silence) doing the work of four.
//
//               Measured the day this was written: ~30 refusal surfaces, 27 SILENT, 3 apologetic
//               AFTER a failed write, 0 pre-emptive.
//
// 🔴 WHY THIS IS NOT COSMETIC — the argument, in full, because a future reader will be tempted to
//    treat it as polish and cut it:
//
//    A manager who hits a SILENT wall gets made an OWNER as a workaround. Thirty seconds, it works,
//    and it destroys the model — the cost basis is now visible to a manager permanently because of
//    an undocumented Tuesday shortcut, and the customer has learned the permissions do not work.
//
//    A control that says what it needs produces a GRANT. A control that is silently absent produces
//    a phone call and a workaround. The surface is what keeps the permission model credible in a
//    real business.
//
// COUNTER-EXAMPLES, all from the week of 2026-07-30, all real:
//    · the Accounting page redirecting to the dashboard with no explanation — indistinguishable
//      from a bug, and read as one
//    · "Adjust price" absent for a manager who HELD the permission
//    · PMI's empty asset list, shown before its redaction notice
//    · the dead QuickBooks connect link that 403'd while looking perfectly operable
//    · DeliverySchedule's vanishing customer block
//
// THE SIX:
//    WORKS                renders normally — no component here; the absence of one IS the state
//    NOT PERMITTED        renders, visibly unavailable, NAMES WHAT IS NEEDED     → <NotPermitted>
//    BEING BUILT          distinct treatment, explains on hover, "coming soon"   → <BeingBuilt>
//    DOES NOT EXIST       absent — render nothing at all, deliberately
//    WITHHELD DATA        ANNOUNCES its redaction; never an empty list, never a 0 → <WithheldData>
//    PAGE WITHOUT ACCESS  RENDERS AND SAYS SO. NEVER REDIRECTS.                  → <PageWithoutAccess>
//
// DEPENDENCIES: permissionManifest (permissionLabel — the copy is DERIVED, so a new permission gets
//               readable refusal text with no UI edit) · react. No DB, no router, no vertical noun.
// OUTPUTS:      NotPermitted · BeingBuilt · WithheldData · PageWithoutAccess · requirementText.
import type { ReactNode, CSSProperties } from 'react';
import { permissionLabel } from '../auth/permissionManifest';

// Neutral tokens. AC-4: structure is shared, only color/vocabulary vary per vertical — so these
// stay greyscale + one amber accent and inherit nothing vertical-specific.
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const SURFACE = '#F9FAFB';
const AMBER_BG = '#FEF3C7';
const AMBER_BORDER = '#F59E0B';
const AMBER_FG = '#92400E';

/**
 * THE ONE PLACE REFUSAL COPY IS COMPOSED. Derived from the manifest, never hand-written per
 * surface — a hand-written string per surface is 30 strings that drift, which is the same STD-011
 * disease that produced six field lists on `customers`.
 *
 * "Requires Tax Exempt · Apply — ask the owner."
 *
 * NAMES WHAT IS NEEDED and WHO CAN GIVE IT. Both halves matter: naming the permission without
 * naming the grantor produces a person who knows they are blocked and not what to do about it,
 * which is a nicer-looking dead end but still a dead end.
 */
export function requirementText(permission: string): string {
  if (permission === 'owner-only') return 'Requires owner access — ask the owner.';
  if (permission === 'member') return 'Requires an active membership.';
  return `Requires ${permissionLabel(permission)} — ask the owner.`;
}

/**
 * NOT PERMITTED — the control RENDERS, is visibly unavailable, and names what is needed.
 *
 * 🔴 IT RENDERS. That is the entire difference from what this replaces. A hidden control teaches
 * the user the feature does not exist; a disabled control that names its permission teaches them
 * exactly what to ask for, and turns a workaround into a grant request.
 *
 * `inline` renders the compact form for a control strip; the default is a bordered block.
 */
export function NotPermitted({
  permission, what, inline = false, style,
}: {
  /** The permission string the surface needs. Copy is derived from it. */
  permission: string;
  /** What the control WOULD do, in the user's words: "Adjust price", "Edit customer". */
  what: string;
  inline?: boolean;
  style?: CSSProperties;
}) {
  const base: CSSProperties = {
    color: MUTED, fontSize: inline ? '0.75rem' : '0.8125rem', lineHeight: 1.45,
    display: inline ? 'inline-flex' : 'flex', alignItems: 'center', gap: 6,
    ...(inline ? {} : {
      border: `1px dashed ${BORDER}`, background: SURFACE,
      borderRadius: 10, padding: '10px 12px',
    }),
    ...style,
  };
  return (
    <div style={base} data-surface-state="not-permitted" title={requirementText(permission)}>
      <span aria-hidden style={{ opacity: 0.7 }}>🔒</span>
      <span>
        <strong style={{ fontWeight: 600, color: '#4B5563' }}>{what}</strong>
        {' — '}
        {requirementText(permission)}
      </span>
    </div>
  );
}

/**
 * BEING BUILT — distinct from NOT PERMITTED, and the distinction is the point: one is a permission
 * you could be granted, the other is a feature nobody has yet. Collapsing them makes a roadmap item
 * look like a snub, and makes a snub look like a roadmap item.
 *
 * Driven off the tile registry's existing `status: 'planned'` — the platform ALREADY KNOWS which
 * surfaces are unbuilt, so this reads that fact rather than introducing a second list of it.
 */
export function BeingBuilt({
  what, detail, inline = false, style,
}: {
  what: string;
  /** What it will do, shown on hover. Honest about the fact that it does nothing yet. */
  detail?: string;
  inline?: boolean;
  style?: CSSProperties;
}) {
  const base: CSSProperties = {
    color: AMBER_FG, fontSize: inline ? '0.75rem' : '0.8125rem', lineHeight: 1.45,
    display: inline ? 'inline-flex' : 'flex', alignItems: 'center', gap: 6,
    background: AMBER_BG, border: `1px solid ${AMBER_BORDER}`,
    borderRadius: 10, padding: inline ? '3px 9px' : '10px 12px', fontWeight: 600,
    ...style,
  };
  return (
    <div
      style={base}
      data-surface-state="being-built"
      title={detail ?? `${what} is not built yet — it is on the roadmap, not hidden from you.`}
    >
      <span aria-hidden>🚧</span>
      <span>{what} — coming soon</span>
    </div>
  );
}

/**
 * WITHHELD DATA — the surface ANNOUNCES its redaction.
 *
 * 🔴 NEVER AN EMPTY LIST, NEVER A ZERO. This is the most dangerous of the six to get wrong,
 * because the failure is SILENT AND PLAUSIBLE: a withheld list renders as "no records" and a
 * withheld number renders as "0", and both are read as FACTS ABOUT THE BUSINESS rather than facts
 * about the viewer's permissions. A manager who sees $0 of costs does not think "I am not allowed
 * to see this" — they think the costs are zero, and then they act on it.
 *
 * `count` is optional and worth passing whenever it is known and not itself sensitive: "3 records
 * withheld" is a much more honest empty state than "records withheld".
 */
export function WithheldData({
  permission, what, count, inline = false, style,
}: {
  permission: string;
  /** What is being withheld: "Customer details", "Cost basis", "Wage records". */
  what: string;
  count?: number;
  inline?: boolean;
  style?: CSSProperties;
}) {
  const base: CSSProperties = {
    color: MUTED, fontSize: inline ? '0.75rem' : '0.8125rem', lineHeight: 1.45,
    display: inline ? 'inline-flex' : 'flex', alignItems: 'center', gap: 6,
    ...(inline ? {} : {
      border: `1px dashed ${BORDER}`, background: SURFACE, borderRadius: 10, padding: '10px 12px',
    }),
    ...style,
  };
  return (
    <div style={base} data-surface-state="withheld-data" title={requirementText(permission)}>
      <span aria-hidden style={{ opacity: 0.7 }}>👁️</span>
      <span>
        <strong style={{ fontWeight: 600, color: '#4B5563' }}>
          {typeof count === 'number' ? `${what} withheld (${count})` : `${what} withheld`}
        </strong>
        {' — '}
        {requirementText(permission)}
      </span>
    </div>
  );
}

/**
 * PAGE WITHOUT ACCESS — RENDERS AND SAYS SO. NEVER REDIRECTS.
 *
 * 🔴 THE REDIRECT WAS THE SINGLE WORST REFUSAL AVAILABLE and it was our default for 26 routes. The
 * member taps a nav item, lands somewhere else, and is given no reason — which is INDISTINGUISHABLE
 * FROM A BUG. That is not a hypothetical reading: it is exactly how David read the Accounting
 * bounce, and he wrote the gate.
 *
 * It also destroys the one piece of information the person needs. A redirect says "not here"; this
 * says "here, and here is the key you are missing." One produces a support call, the other produces
 * a grant.
 *
 * Stays on the URL deliberately — the address bar keeps saying what you tried to open, so the page
 * is shareable, reloadable, and describable to whoever is going to grant the permission.
 */
export function PageWithoutAccess({
  permission, title, children,
}: {
  permission: string;
  /** The surface's own name — "Accounting", "Cost to Produce". */
  title: string;
  children?: ReactNode;
}) {
  return (
    <div
      data-surface-state="page-without-access"
      style={{
        maxWidth: 560, margin: '48px auto', padding: '28px 24px',
        border: `1px solid ${BORDER}`, borderRadius: 14, background: '#fff', textAlign: 'left',
      }}
    >
      <div style={{ fontSize: '1.75rem', marginBottom: 10 }} aria-hidden>🔒</div>
      <h1 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 8px', color: '#111827' }}>
        {title}
      </h1>
      <p style={{ margin: '0 0 14px', color: MUTED, fontSize: '0.875rem', lineHeight: 1.55 }}>
        This page exists and you reached it correctly — your account does not have access to it yet.
      </p>
      <div style={{
        border: `1px solid ${BORDER}`, background: SURFACE, borderRadius: 10,
        padding: '11px 13px', fontSize: '0.8125rem', color: '#374151', lineHeight: 1.5,
      }}>
        <strong style={{ fontWeight: 600 }}>{requirementText(permission)}</strong>
        <div style={{ marginTop: 6, color: MUTED, fontSize: '0.75rem' }}>
          Permission name: <code style={{ fontFamily: 'ui-monospace, monospace' }}>{permission}</code>
          {' — '}the owner can grant it on the Team page.
        </div>
      </div>
      {children}
    </div>
  );
}
