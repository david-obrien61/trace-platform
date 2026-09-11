// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the ONE renderer for the lines on an order — code · description · quantity, plus the
//   unit price and line total when the caller has money to show. Extracted from QboOrderIngest's
//   preview table (2026-08-31) when the stop card needed the same list (ledger #301, 2026-09-11),
//   so the ingest preview and the day sheet cannot drift into two descriptions of one line
//   (§6 r8 — the same OPERATION in exactly one place).
// DEPENDENCIES: React only. No client, no fetch, no permission — the caller decides what it may show.
// OUTPUTS: <OrderLineList lines money? />
//
// 🔴 MONEY IS OPT-IN, NOT OPT-OUT. The stop card shows what is on the order to a crew on a phone and
//   passes no `money`; the ingest preview is an operator reading a sale record and passes it. A
//   renderer that showed prices by default would put them on every screen that forgot to hide them.
// ─────────────────────────────────────────────────────────────────────────────

const GRAY = '#6b7280';
const DARK = '#111827';

interface OrderLineListLine {
  quantity: number;
  description: string | null;
  sku: string | null;
  unitPrice?: number;
  subtotal?: number;
}

const cell = { padding: '.2rem .4rem' } as const;

export function OrderLineList({ lines, money }: {
  lines: OrderLineListLine[];
  /** Pass to show `@ unit` and the line total. Omit and no price reaches the screen. */
  money?: (n: number) => string;
}) {
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '.78rem' }}>
      <tbody>
        {lines.map((l, i) => (
          <tr key={i}>
            <td style={{ ...cell, color: GRAY, whiteSpace: 'nowrap', fontFamily: 'ui-monospace, monospace' }}>{l.sku || '—'}</td>
            <td style={{ ...cell, color: DARK }}>{l.description || '(no description)'}</td>
            <td style={{ ...cell, color: DARK, whiteSpace: 'nowrap' }}>×{l.quantity}</td>
            {money && (
              <td style={{ ...cell, color: GRAY, whiteSpace: 'nowrap' }}>
                @ {typeof l.unitPrice === 'number' ? money(l.unitPrice) : '—'}
              </td>
            )}
            {money && (
              <td style={{ ...cell, color: DARK, whiteSpace: 'nowrap' }}>
                {typeof l.subtotal === 'number' ? money(l.subtotal) : '—'}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
