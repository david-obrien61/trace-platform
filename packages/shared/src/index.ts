// Supabase
export { supabase } from './supabase/client';
export * from './supabase/auth';
export * from './supabase/types';

// Auth factory
export * from './auth';

// QuickBooks
export * from './quickbooks/oauth';
export * from './quickbooks/customer';
export * from './quickbooks/invoice';

// AI Engine
export { default as AIEngine } from './ai/AIEngine';
export type { AIPayload, AIOptions, AIResult } from './ai/AIEngine';

// Notifications
export * from './notifications/index';

// QR
export * from './qr/generate';
export * from './qr/print';

// Pricing
export { calculateRetail, calculateMargin } from './pricing/marginEngine';

// Utils
export { formatDollars, formatMoney, formatMoneyOrDash } from './utils/formatCurrency';
export { formatDateShort, formatDateTimeShort, todayRange, daysBetween } from './utils/dateHelpers';
export { STATUS_COLORS, PMI_STATUS_COLORS, ORDER_STATUS_COLORS } from './utils/statusColors';
export type { StatusLevel } from './utils/statusColors';

// Components
export { FormField, inputStyle, inputErrorStyle } from './components/FormField';
export type { FormFieldProps } from './components/FormField';
export { ProgressBar } from './components/ProgressBar';
export type { ProgressBarProps } from './components/ProgressBar';
export { Skeleton, SkeletonCard } from './components/Skeleton';
export type { SkeletonProps } from './components/Skeleton';
export { Button } from './components/Button';
export type { ButtonProps } from './components/Button';
export { Card, CardHeader } from './components/Card';
export type { CardProps, CardHeaderProps } from './components/Card';
export { Badge } from './components/Badge';
export type { BadgeProps, BadgeVariant } from './components/Badge';
export { LockedOverlay } from './components/LockedOverlay';
export type { LockedOverlayProps } from './components/LockedOverlay';
export { TileGrid } from './components/tiles/TileGrid';
export type { TileGridProps } from './components/tiles/TileGrid';
export { Tile } from './components/tiles/Tile';
export type { TileProps, TileState } from './components/tiles/Tile';
