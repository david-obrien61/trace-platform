// $1,234 (whole dollars, no cents) — dashboard metrics, tile counters
export function formatDollars(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// $12.34 (always two decimal places) — line items, totals, prices
export function formatMoney(n: number): string {
  return `$${Number(n).toFixed(2)}`;
}

// Returns '—' for null/undefined; useful for optional price fields
export function formatMoneyOrDash(n: number | null | undefined): string {
  return n != null ? formatMoney(n) : '—';
}
