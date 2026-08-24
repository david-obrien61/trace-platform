// ============================================================
// sync/store — namespaced local persistence (the promotable DataBridge slice).
// PURPOSE:  A per-(business,domain) key/value store over localStorage, the clean
//           de-Ignition-keyed lift of DataBridge's save/load. Replaces the single
//           hardcoded IGNITION_OS_DATA blob with `trace:sync:<businessId>:<domain>`
//           so two tenants / two domains never collide (recon §2, §6).
// DEPENDENCIES: localStorage when present; falls back to an in-memory map
//           (SSR / Node / tests). Mobile AsyncStorage adapter is deferred (web
//           is Cultivar's target — Lauren on a phone browser).
// OUTPUTS:  NamespacedStore { load, save, remove, probe } + StoreWriteResult.
//
// 🔴 A WRITE THAT CANNOT PERSIST MUST SAY SO — `save()` RETURNS ITS OUTCOME (2026-08-24).
// `save()` used to swallow the exception entirely:
//     catch { /* quota exceeded / storage disabled — best-effort, never throw into a Save */ }
// The comment's intent was RIGHT — a Save on a phone in a row must never throw — but the
// consequence was that the failure had NO READER. The queue reported `queued`, the banner said
// *"counts are saved on this phone and will sync when you're back in signal"*, and nothing was
// saved. **Not throwing and not reporting are different things, and only the first was wanted.**
// So the exception is still never thrown; it is RETURNED, in a shape a caller cannot ignore by
// accident — the same discriminated-union discipline as `utils/readResult` (R-11), applied to
// the write side (R-12: *a write must prove it wrote*).
// ============================================================

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Why a local write could not be persisted. The two reasons need DIFFERENT words on screen:
 *   • 'quota'       — the device is full. Freeing space or syncing helps.
 *   • 'unavailable' — storage is switched off or ephemeral (Safari Private, blocked site data).
 *                     Nothing the person does in this tab will help; they need a normal tab.
 * Collapsing them into one message would send someone to clear space on a phone that has plenty.
 */
export type StoreFailureReason = 'quota' | 'unavailable';

/** The outcome of a local persist. `ok:false` cannot be reached without narrowing (R-11's shape). */
export type StoreWriteResult =
  | { ok: true }
  | { ok: false; reason: StoreFailureReason; message: string };

/**
 * Classify a thrown storage error. A quota overflow is a DOMException named
 * `QuotaExceededError` (code 22), or Firefox's `NS_ERROR_DOM_QUOTA_REACHED` (code 1014).
 * Anything else — SecurityError, a Private-tab refusal, an absent API — is 'unavailable'.
 */
function classify(err: unknown): { reason: StoreFailureReason; message: string } {
  const e = err as { name?: string; code?: number; message?: string } | null;
  const name = e?.name ?? '';
  const isQuota =
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e?.code === 22 || e?.code === 1014;
  return {
    reason:  isQuota ? 'quota' : 'unavailable',
    message: e?.message ?? String(err),
  };
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

/**
 * THE ONE SENTENCE A PERSON READS WHEN LOCAL STORAGE COULD NOT HOLD THEIR WORK.
 *
 * 🔴 IT NEVER SAYS THE WORK WAS SAVED, AND IT NAMES WHICH PROBLEM IT IS. The two reasons need
 * different actions: a FULL device can be freed up; a Private/blocked tab cannot be fixed from
 * inside that tab, and telling someone to clear space on a phone with 60 GB free is the same
 * class of false-but-actionable instruction as *"check the tag"* on a network failure.
 *
 * Written once, here, so the count screen and any future consumer cannot drift two descriptions
 * of one event (STD-011).
 */
export function storageError(failure: { reason: StoreFailureReason }): string {
  return failure.reason === 'quota'
    ? "This device is out of storage, so we could NOT save that. Free up some space, or reconnect and sync what's already waiting, then try again."
    : "This phone isn't letting the app store anything — that usually means a Private browsing tab, or site data turned off. We could NOT save that. Open the app in a normal tab and count there.";
}

/**
 * THE PREVENTIVE SENTENCE — said BEFORE any work is attempted, when the probe finds the store
 * unusable at session start.
 *
 * ⚠️ WHY THIS IS NOT `storageError()` WITH DIFFERENT TENSE, AND WHY THAT IS NOT STD-011 DRIFT:
 * they report two genuinely different events. `storageError()` says *a save you made did not
 * happen*; this says *nothing has failed yet, and here is what will*. Saying "we could NOT save
 * that" before she has saved anything would be a false claim in its own right. **The DIAGNOSIS
 * — quota vs unavailable — is the part that must not drift, and it is the same switch, on the
 * same reason, three lines apart.**
 *
 * 🔴 IT DOES NOT SAY "YOU CANNOT COUNT". While the device has signal, every write goes straight
 * to the server and the walk works normally — the engine falls back to a direct write when the
 * queue cannot persist. What is LOST is the dead-zone promise, and that is exactly what the
 * sentence names, because that is the thing she would otherwise find out about in a back acre.
 */
export function storageWarning(failure: { reason: StoreFailureReason }): string {
  return failure.reason === 'quota'
    ? "This device is out of storage. Counts will go straight to the server while you have signal, but nothing can be held on the phone — so if you lose signal, that count is lost. Free up some space before you walk."
    : "This phone isn't letting the app store anything — that usually means a Private browsing tab, or site data turned off. Counts will go straight to the server while you have signal, but NOTHING can be held on the phone: lose signal and that count is gone. Open the app in a normal tab before you walk the lot.";
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

  /**
   * Persist a value. NEVER THROWS — a Save on a phone in a row must not blow up — but the
   * failure is RETURNED rather than discarded, so a caller can tell the person the truth.
   */
  save<T>(key: string, value: T): StoreWriteResult {
    try {
      this.adapter.setItem(this.k(key), JSON.stringify(value));
      return { ok: true };
    } catch (err) {
      return { ok: false, ...classify(err) };
    }
  }

  remove(key: string): void {
    try { this.adapter.removeItem(this.k(key)); }
    catch { /* a remove that cannot run leaves a stale key; harmless, and never worth throwing */ }
  }

  /**
   * 🔴 IS THIS STORE USABLE AT ALL? A write-then-read-back-then-clean-up on a sentinel key.
   *
   * WHY A PROBE AND NOT "WAIT FOR THE FIRST FAILED WRITE": the difference between losing ONE
   * entry and losing AN AFTERNOON. Lauren starts a count, walks a row, saves twenty lots and
   * only then meets the first failure — by which point the work is already gone. Asking the
   * store one question at session start costs a single key and answers it before she walks.
   *
   * 🔴 IT WRITES *AND READS BACK*, DELIBERATELY. A Safari Private tab (and a browser with site
   * data blocked) can ACCEPT `setItem` without throwing and still not persist — a write-only
   * probe would pass and the store would still be a hole. Reading the value back is what
   * distinguishes "accepted" from "stored".
   */
  probe(): StoreWriteResult {
    const key = '__probe';
    const token = `probe-${String(Date.now())}`;
    const wrote = this.save(key, token);
    if (!wrote.ok) return wrote;
    const readBack = this.load<string | null>(key, null);
    this.remove(key);
    if (readBack !== token) {
      return {
        ok: false,
        reason: 'unavailable',
        message: 'storage accepted the write but did not persist it (ephemeral or blocked)',
      };
    }
    return { ok: true };
  }
}
