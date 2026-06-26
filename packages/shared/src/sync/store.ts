// ============================================================
// sync/store — namespaced local persistence (the promotable DataBridge slice).
// PURPOSE:  A per-(business,domain) key/value store over localStorage, the clean
//           de-Ignition-keyed lift of DataBridge's save/load. Replaces the single
//           hardcoded IGNITION_OS_DATA blob with `trace:sync:<businessId>:<domain>`
//           so two tenants / two domains never collide (recon §2, §6).
// DEPENDENCIES: localStorage when present; falls back to an in-memory map
//           (SSR / Node / tests). Mobile AsyncStorage adapter is deferred (web
//           is Cultivar's target — Lauren on a phone browser).
// OUTPUTS:  NamespacedStore { load, save, remove }.
// ============================================================

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultAdapter(): StorageAdapter {
  if (typeof localStorage !== 'undefined') {
    return {
      getItem:    (k) => localStorage.getItem(k),
      setItem:    (k, v) => { localStorage.setItem(k, v); },
      removeItem: (k) => { localStorage.removeItem(k); },
    };
  }
  // No DOM storage (SSR/Node/test) — in-memory, process-lifetime only.
  const mem = new Map<string, string>();
  return {
    getItem:    (k) => mem.get(k) ?? null,
    setItem:    (k, v) => { mem.set(k, v); },
    removeItem: (k) => { mem.delete(k); },
  };
}

const ROOT = 'trace:sync';

export class NamespacedStore {
  private adapter: StorageAdapter;
  private ns: string;

  constructor(businessId: string | null, domain: string, adapter?: StorageAdapter) {
    this.adapter = adapter ?? defaultAdapter();
    this.ns = `${ROOT}:${businessId ?? 'no-business'}:${domain}`;
  }

  private k(key: string): string { return `${this.ns}:${key}`; }

  load<T>(key: string, fallback: T): T {
    const raw = this.adapter.getItem(this.k(key));
    if (raw == null) return fallback;
    try { return JSON.parse(raw) as T; } catch { return fallback; }
  }

  save<T>(key: string, value: T): void {
    try { this.adapter.setItem(this.k(key), JSON.stringify(value)); }
    catch { /* quota exceeded / storage disabled — best-effort, never throw into a Save */ }
  }

  remove(key: string): void { this.adapter.removeItem(this.k(key)); }
}
