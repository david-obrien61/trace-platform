// packages/shared/src/design-system/tokens.ts
// Canonical design token system for all TRACE verticals.
// AC-1: token names are vertical-agnostic identifiers. Color values are supplied
// per-vertical via palette objects — no vertical noun appears in any identifier.
// Usage: import { ignition, cultivar, spacing, radius, font } from '@trace/shared/design-system/tokens';

// ─── Spacing scale (Tailwind default, px values) ──────────────────────────────
export const spacing = {
  0:    0,
  0.5:  2,
  1:    4,
  1.5:  6,
  2:    8,
  2.5:  10,
  3:    12,
  3.5:  14,
  4:    16,
  5:    20,
  6:    24,
  7:    28,
  8:    32,
  9:    36,
  10:   40,
  11:   44,
  12:   48,
  14:   56,
  16:   64,
  20:   80,
  24:   96,
} as const;

// ─── Border radius scale ──────────────────────────────────────────────────────
export const radius = {
  none:   0,
  sm:     4,
  base:   6,
  md:     8,
  lg:     8,   // Tailwind rounded-lg = 8px
  xl:     12,
  '2xl':  16,
  '3xl':  24,
  full:   9999,
} as const;

// ─── Font size scale (px) ─────────────────────────────────────────────────────
export const font = {
  size: {
    xs:   12,
    sm:   14,
    base: 16,
    lg:   18,
    xl:   20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    // Arbitrary sizes used in Ignition
    '9px':  9,
    '10px': 10,
    '11px': 11,
  },
  weight: {
    normal:    400,
    medium:    500,
    semibold:  600,
    bold:      700,
    extrabold: 800,
    black:     900,
  },
  tracking: {
    tighter: '-0.05em',
    tight:   '-0.025em',
    normal:  '0em',
    wide:    '0.025em',
    wider:   '0.05em',
    widest:  '0.1em',
    // Ignition uses even wider tracking in some places
    pin:     '0.3em',
    pinWide: '1em',
  },
  leading: {
    none:    1,
    tight:   1.25,
    snug:    1.375,
    normal:  1.5,
    relaxed: 1.625,
    loose:   2,
  },
} as const;

// ─── Shadow scale ─────────────────────────────────────────────────────────────
export const shadow = {
  sm:   '0 1px 2px 0 rgba(0,0,0,0.05)',
  base: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
  md:   '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
  lg:   '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
  xl:   '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
  '2xl':'0 25px 50px -12px rgba(0,0,0,0.25)',
  none: 'none',
  // Ignition glow shadows
  glowBlue:    '0 0 20px rgba(59,130,246,0.3)',
  glowEmerald: '0 0 20px rgba(16,185,129,0.3)',
  glowOrange:  '0 0 20px rgba(249,115,22,0.3)',
} as const;

// ─── Transition helpers ───────────────────────────────────────────────────────
export const transition = {
  colors: 'color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease',
  all:    'all 0.15s ease',
  fast:   'all 0.1s ease',
  slow:   'all 0.3s ease',
  none:   'none',
} as const;

// ─── Max-width scale ──────────────────────────────────────────────────────────
export const maxWidth = {
  xs:  320,
  sm:  384,
  md:  448,
  lg:  512,
  xl:  576,
  '2xl': 672,
  '3xl': 768,
  full: '100%',
} as const;

// ─── Ignition OS palette (dark navy/industrial theme) ─────────────────────────
// All raw hex values. Opacity variants use rgba() inline at the call site.
export const ignition = {
  // Backgrounds
  bg: {
    black:   '#000000',
    base:    '#020617',   // slate-950
    surface: '#0f172a',   // slate-900
    raised:  '#1e293b',   // slate-800
    hover:   '#334155',   // slate-700
    muted:   '#475569',   // slate-600
  },
  // Text
  text: {
    primary:   '#ffffff',
    secondary: '#f1f5f9', // slate-100
    dim:       '#cbd5e1', // slate-300
    muted:     '#94a3b8', // slate-400
    subtle:    '#64748b', // slate-500
    faint:     '#475569', // slate-600
    ghost:     '#334155', // slate-700
  },
  // Borders
  border: {
    strong:  '#334155',   // slate-700
    base:    '#1e293b',   // slate-800
    faint:   '#0f172a',   // slate-900 (barely visible)
  },
  // Interactive — Blue (primary action)
  blue: {
    text:    '#60a5fa',   // blue-400
    default: '#3b82f6',   // blue-500
    action:  '#2563eb',   // blue-600
    hover:   '#1d4ed8',   // blue-700
    // alpha variants
    bg10:    'rgba(37,99,235,0.10)',
    bg20:    'rgba(59,130,246,0.20)',
    border30:'rgba(59,130,246,0.30)',
    border50:'rgba(59,130,246,0.50)',
  },
  // Success — Emerald
  emerald: {
    text:    '#34d399',   // emerald-400
    default: '#10b981',   // emerald-500
    action:  '#059669',   // emerald-600
    bg10:    'rgba(5,150,105,0.10)',
    border30:'rgba(16,185,129,0.30)',
    border20:'rgba(5,150,105,0.20)',
  },
  // Warning — Orange
  orange: {
    text:    '#fb923c',   // orange-400
    default: '#f97316',   // orange-500
    action:  '#ea580c',   // orange-600
    hover:   '#c2410c',   // orange-700
    bg10:    'rgba(234,88,12,0.10)',
    border30:'rgba(249,115,22,0.30)',
  },
  // Danger — Red
  red: {
    text:    '#f87171',   // red-400
    default: '#ef4444',   // red-500
    action:  '#dc2626',   // red-600
    bg10:    'rgba(239,68,68,0.10)',
    border20:'rgba(239,68,68,0.20)',
    border30:'rgba(239,68,68,0.30)',
  },
  // Alert — Yellow/Amber
  yellow: {
    text:    '#facc15',   // yellow-400
    amber:   '#fbbf24',   // amber-400
    bg10:    'rgba(250,204,21,0.10)',
    border30:'rgba(250,204,21,0.30)',
  },
  // Overlays
  overlay: {
    dark70:  'rgba(0,0,0,0.70)',
    dark80:  'rgba(0,0,0,0.80)',
    dark50:  'rgba(0,0,0,0.50)',
    grid:    'rgba(30,41,59,0.3)',
  },
} as const;

// ─── Cultivar OS palette (sage/green nursery theme) ───────────────────────────
export const cultivar = {
  bg: {
    page:    '#EAF3DE',
    surface: '#ffffff',
    muted:   '#f0f4f0',
  },
  text: {
    primary:   '#111827',
    secondary: '#374151',
    muted:     '#6b7280',
    faint:     '#9ca3af',
  },
  border: {
    base:    '#d1d5db',
    muted:   '#e5e7eb',
  },
  green: {
    primary: '#27500A',
    hover:   '#1f3d07',
    light:   '#3d7a10',
    bg10:    'rgba(39,80,10,0.10)',
  },
  red: {
    netting: '#A32D2D',
    bg:      'rgba(163,45,45,0.05)',
  },
} as const;

// ─── Common style helpers (reusable object fragments) ─────────────────────────
// These are composable fragments, not complete style objects.

export const S = {
  // Layout
  flex:           { display: 'flex' as const },
  flexCol:        { display: 'flex' as const, flexDirection: 'column' as const },
  flexCenter:     { display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const },
  flexBetween:    { display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
  itemsCenter:    { alignItems: 'center' as const },
  justifyCenter:  { justifyContent: 'center' as const },
  justifyBetween: { justifyContent: 'space-between' as const },
  justifyEnd:     { justifyContent: 'flex-end' as const },
  fullWidth:      { width: '100%' as const },
  fullHeight:     { height: '100%' as const },
  screenSize:     { width: '100vw' as const, height: '100vh' as const },
  relative:       { position: 'relative' as const },
  absolute:       { position: 'absolute' as const },
  fixed:          { position: 'fixed' as const },
  inset0:         { top: 0, right: 0, bottom: 0, left: 0 },
  overflowHidden: { overflow: 'hidden' as const },
  overflowYAuto:  { overflowY: 'auto' as const },
  noSelect:       { userSelect: 'none' as const },
  pointer:        { cursor: 'pointer' as const },
  // Typography helpers
  uppercase:      { textTransform: 'uppercase' as const },
  italic:         { fontStyle: 'italic' as const },
  textCenter:     { textAlign: 'center' as const },
  truncate:       { overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const },
  nowrap:         { whiteSpace: 'nowrap' as const },
} as const;
