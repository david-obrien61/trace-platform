/**
 * oauth.ts — QuickBooks OAuth 2.0 flow (frontend side).
 * Extracted from CAI/ExternalBridge.js — universal (web).
 *
 * Flow:
 *   1. initiateOAuth() → opens Intuit popup → polls /api/qbo/status
 *   2. On success: connection stored in localStorage via saveConnection()
 *   3. disconnect() → POST /api/qbo/disconnect → clears local state
 */

const API_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
  'http://localhost:8000';

// ── connection state (localStorage) ──────────────────────────────────────────

const STORAGE_KEY = 'IGNITION_OS_DATA';

function _load(key: string): any {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')[key] ?? null;
  } catch { return null; }
}

function _save(key: string, value: any): void {
  if (typeof window === 'undefined') return;
  try {
    const store = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    store[key] = value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch { /* non-fatal */ }
}

export interface QBOConnection {
  connected:    boolean;
  realmId:      string | null;
  companyName:  string | null;
  connectedAt:  string | null;
  lastSync:     string | null;
}

export function getQBOConnection(): QBOConnection {
  const connections = _load('external_connections') || {};
  return connections.quickbooks || {
    connected: false, realmId: null, companyName: null, connectedAt: null, lastSync: null,
  };
}

export function saveQBOConnection(data: Partial<QBOConnection>): void {
  const current = getQBOConnection();
  const connections = _load('external_connections') || {};
  _save('external_connections', { ...connections, quickbooks: { ...current, ...data } });
}

// ── live status ────────────────────────────────────────────────────────────────

export async function getQBOStatus(): Promise<{ connected: boolean; realmId?: string; companyName?: string }> {
  const res = await fetch(`${API_URL}/api/qbo/status`);
  if (!res.ok) return { connected: false };
  return res.json();
}

// ── OAuth popup flow ───────────────────────────────────────────────────────────

/**
 * Opens the Intuit OAuth popup and polls /api/qbo/status until connected.
 * Resolves with the status object on success; rejects on cancel or timeout.
 */
export async function initiateOAuth(): Promise<{ connected: boolean; realmId?: string; companyName?: string }> {
  const res = await fetch(`${API_URL}/api/qbo/auth-url`);
  if (!res.ok) throw new Error('Backend unavailable. Make sure the API server is running.');
  const { url } = await res.json();

  const popup = window.open(url, 'qbo_auth', 'width=600,height=700,left=200,top=100');
  if (!popup) throw new Error('Popup blocked. Please allow popups for this page and try again.');

  return new Promise((resolve, reject) => {
    const poll = setInterval(async () => {
      try {
        const status = await getQBOStatus();
        if (status.connected) {
          clearInterval(poll);
          saveQBOConnection({
            connected:   true,
            realmId:     status.realmId || null,
            companyName: status.companyName || null,
            connectedAt: new Date().toISOString(),
          });
          resolve(status);
        }
        if (popup.closed && !status.connected) {
          clearInterval(poll);
          reject(new Error('Authorization cancelled.'));
        }
      } catch (e) {
        clearInterval(poll);
        reject(e);
      }
    }, 2000);

    setTimeout(() => {
      clearInterval(poll);
      reject(new Error('Authorization timed out. Please try again.'));
    }, 180000);
  });
}

// ── disconnect ─────────────────────────────────────────────────────────────────

export async function disconnectQBO(): Promise<void> {
  await fetch(`${API_URL}/api/qbo/disconnect`, { method: 'POST' });
  saveQBOConnection({ connected: false, realmId: null, companyName: null });
}
