/**
 * auth.ts — PIN auth, session management, and trial clock.
 * Extracted from CAI/DataBridge.js — universal (web + mobile).
 *
 * Covers:
 *   - hashPin          SHA-256 hash salted by shop/nursery ID
 *   - authenticate     PIN → Supabase lookup → session object
 *   - autoEnrollDevice Register/update browser fingerprint in member_devices
 *   - logout           Wipe current_user from storage
 *   - getTrialStatus   14-day trial clock: active/warning/blurred/archived states
 *   - simulateTrialDay Test utility — shift trial_started_at to simulate day N
 *   - checkTrialStatus Module-level 30-day trial check (legacy per-module trials)
 */

import { supabase } from './client';

// ── platform detection ────────────────────────────────────────────────────────

const isWeb = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

// ── key used to persist current_user in localStorage ─────────────────────────

const STORAGE_KEY = 'IGNITION_OS_DATA';

function _load(key: string): any {
  if (!isWeb) return null;
  try {
    const store = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return store[key] ?? null;
  } catch {
    return null;
  }
}

function _save(key: string, value: any): void {
  if (!isWeb) return;
  try {
    const store = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    store[key] = value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* non-fatal */
  }
}

// ── PIN hashing ───────────────────────────────────────────────────────────────

/**
 * SHA-256 hash of `<entityId>:<pin>`.
 * Salted by entity ID so the same PIN at two shops/nurseries produces
 * different hashes — prevents cross-tenant collisions.
 */
export async function hashPin(entityId: string, pin: string): Promise<string> {
  const raw = new TextEncoder().encode(`${entityId}:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', raw);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── device auto-enrollment ────────────────────────────────────────────────────

/**
 * Register (or update last_seen on) the current browser as a member_devices row.
 * Called automatically on every successful login.
 */
export async function autoEnrollDevice(memberId: string, entityId: string): Promise<void> {
  if (!isWeb) return;

  let fingerprint = localStorage.getItem('device_fingerprint');
  if (!fingerprint) {
    fingerprint = crypto.randomUUID();
    localStorage.setItem('device_fingerprint', fingerprint);
  }

  const { data: existing } = await supabase
    .from('member_devices')
    .select('id')
    .eq('member_id', memberId)
    .eq('device_fingerprint', fingerprint)
    .maybeSingle();

  const now = new Date().toISOString();
  if (!existing) {
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    const label = ua.includes('iPhone') ? 'iPhone'
      : ua.includes('iPad')    ? 'iPad'
      : ua.includes('Android') ? 'Android Device'
      : ua.includes('Mac')     ? 'Mac'
      : 'Browser';
    await supabase.from('member_devices').insert({
      member_id:          memberId,
      shop_id:            entityId,   // shop_id column — nurseries use nursery_id at DB level
      device_fingerprint: fingerprint,
      device_label:       label,
      is_active:          true,
      last_seen:          now,
    });
  } else {
    await supabase.from('member_devices')
      .update({ last_seen: now })
      .eq('id', (existing as any).id);
  }
}

// ── authenticate ──────────────────────────────────────────────────────────────

export interface AuthSession {
  id:          string;
  member_id:   string;
  shop_id:     string;
  name:        string;
  role:        string;
  sub_role:    string | null;
  permissions: string[];
  allowed:     string[];
  cached_at:   string;
}

/**
 * Verify a PIN against Supabase shop_members.pin_hash.
 * Returns the member session on success, null on failure.
 */
export async function authenticate(entityId: string, pin: string): Promise<AuthSession | null> {
  const pinHash = await hashPin(entityId, pin);

  const { data: member } = await supabase
    .from('shop_members')
    .select('*')
    .eq('shop_id', entityId)
    .eq('pin_hash', pinHash)
    .eq('active', true)
    .maybeSingle();

  if (!member) return null;

  await autoEnrollDevice(member.id, entityId);

  const session: AuthSession = {
    id:          member.id,
    member_id:   member.id,
    shop_id:     entityId,
    name:        member.name,
    role:        member.role,
    sub_role:    member.sub_role || null,
    permissions: member.permissions || [],
    allowed: (member.permissions || [])
      .filter((p: string) => p.startsWith('view_'))
      .map((p: string)    => p.replace('view_', '')),
    cached_at: new Date().toISOString(),
  };

  _save('current_user', session);
  return session;
}

export function getCurrentUser(): AuthSession | null {
  return _load('current_user') as AuthSession | null;
}

export function logout(): void {
  _save('current_user', null);
}

// ── trial clock ───────────────────────────────────────────────────────────────

export interface TrialStatus {
  day:           number;
  daysRemaining: number;
  isActive:      boolean;
  isWarning:     boolean;  // day 12-14: savings report shown
  isBlurred:     boolean;  // day 15-29: data visible but blurred
  isArchived:    boolean;  // day 30+: data archived
  isPaid:        boolean;
  showNudge:     boolean;  // day 7-11
  showReport:    boolean;  // day 12-14
}

/**
 * Reads trial_started_at from the entity's info record.
 * Pass `policy` (shop_policy / nursery_policy) and `info` (shop_info / nursery_info)
 * loaded from DataBridge or directly from Supabase.
 */
export function getTrialStatus(info: Record<string, any>, policy: Record<string, any>): TrialStatus {
  if (policy.tier && policy.tier !== 'TRIAL') {
    return {
      day: 0, daysRemaining: 999, isActive: true,
      isWarning: false, isBlurred: false, isArchived: false,
      isPaid: true, showNudge: false, showReport: false,
    };
  }

  const start = info.trial_started_at ? new Date(info.trial_started_at) : null;
  if (!start) {
    return {
      day: 0, daysRemaining: 14, isActive: true,
      isWarning: false, isBlurred: false, isArchived: false,
      isPaid: false, showNudge: false, showReport: false,
    };
  }

  const day = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
  return {
    day,
    daysRemaining: Math.max(0, 14 - day),
    isActive:   day < 14,
    isWarning:  day >= 12 && day < 15,
    isBlurred:  day >= 15 && day < 30,
    isArchived: day >= 30,
    isPaid:     false,
    showNudge:  day >= 7  && day < 12,
    showReport: day >= 12 && day < 15,
  };
}

/**
 * Module-level 30-day trial check (legacy per-module trial system).
 */
export function checkModuleTrialStatus(moduleKey: string): { isExpired: boolean; daysRemaining: number } {
  const data = _load('system_subscriptions');
  if (!data || !data[moduleKey] || !data[moduleKey].trialStartedAt) {
    return { isExpired: false, daysRemaining: 30 };
  }
  const start = new Date(data[moduleKey].trialStartedAt);
  const diffDays = Math.ceil(Math.abs(Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
  return { isExpired: diffDays > 30, daysRemaining: Math.max(0, 30 - diffDays) };
}

/**
 * Test utility — shifts trial_started_at so the app behaves as if it's currently day N.
 * Only works on web (localStorage).
 */
export function simulateTrialDay(day: number): void {
  const info = _load('shop_info') || {};
  const fakeStart = new Date(Date.now() - day * 24 * 60 * 60 * 1000).toISOString();
  _save('shop_info', { ...info, trial_started_at: fakeStart });
  if (isWeb) window.location.reload();
}
