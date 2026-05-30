// Canonical status color tokens — use everywhere a status badge or border needs a color.
// Applies across all verticals. Keys map to business-level states, not visual names.

export type StatusLevel = 'ok' | 'warning' | 'critical' | 'inactive' | 'info';

export const STATUS_COLORS: Record<StatusLevel, { bg: string; text: string; border: string }> = {
  ok:       { bg: '#EAF3DE', text: '#27500A', border: '#27500A' },
  warning:  { bg: '#FFF8E1', text: '#7A5800', border: '#F9A825' },
  critical: { bg: '#FDECEA', text: '#A32D2D', border: '#A32D2D' },
  inactive: { bg: '#F5F5F5', text: '#757575', border: '#BDBDBD' },
  info:     { bg: '#E3F2FD', text: '#0D47A1', border: '#1976D2' },
};

// PMI-specific aliases that map to STATUS_COLORS
export const PMI_STATUS_COLORS = {
  OVERDUE:  STATUS_COLORS.critical,
  DUE_SOON: STATUS_COLORS.warning,
  OK:       STATUS_COLORS.ok,
  NONE:     STATUS_COLORS.inactive,
} as const;

// Order / leakage aliases
export const ORDER_STATUS_COLORS = {
  leakage: STATUS_COLORS.critical,
  clean:   STATUS_COLORS.ok,
} as const;
