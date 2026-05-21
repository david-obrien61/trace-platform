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

// Components
export { Button } from './components/Button';
export type { ButtonProps } from './components/Button';
export { Card, CardHeader } from './components/Card';
export type { CardProps, CardHeaderProps } from './components/Card';
export { Badge } from './components/Badge';
export type { BadgeProps, BadgeVariant } from './components/Badge';
export { LockedOverlay } from './components/LockedOverlay';
export type { LockedOverlayProps } from './components/LockedOverlay';
