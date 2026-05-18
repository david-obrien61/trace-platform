// Supabase
export { supabase } from './supabase/client';
export * from './supabase/auth';

// QuickBooks
export * from './quickbooks/oauth';
export * from './quickbooks/customer';
export * from './quickbooks/invoice';

// AI Engine
export { default as AIEngine } from './ai/AIEngine';
export type { AIPayload, AIOptions, AIResult } from './ai/AIEngine';
