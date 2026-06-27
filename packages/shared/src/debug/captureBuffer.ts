// ───────────────────────────────────────────────────────────────────────────
// PURPOSE: On-by-default FIELD-DEBUG capture. Intercepts console.* + window error
//   events and tees every line (the whole [TRACE:*] trail) into a bounded ring
//   buffer persisted to localStorage. The buffer SURVIVES reload / white-screen /
//   close-reopen, so a crash David can only screenshot is now also a downloadable
//   log he can hand Lightning as DATA. Zero per-site changes — it taps console.*
//   itself, so all ~500 scattered [TRACE:*] emits are captured as-is.
// DEPENDENCIES: browser localStorage; optional navigator.share / Blob for export.
//   No app/framework deps — safe to install before React mounts.
// OUTPUTS: installCapture(), isCaptureInstalled(), getCaptureText(), getCaptureCount(),
//   clearCapture(), downloadCapture(), shareCapture()
// INSTRUMENTATION: [TRACE:CAPTURE] (STD-003, ON by birth) — emitted via the ORIGINAL
//   console so it never re-enters the interceptor.
// PRIVACY: TRACE payloads include tenant identifiers (business_id, ids, emails). The
//   export is plain text meant for David → Lightning (internal). Surface that to the
//   user; redaction is a deferred step-up, not built here.
// ───────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'trace_capture_v1';
const MAX_ENTRIES = 600; // ring size — newest kept, oldest dropped
const MAX_ARG_CHARS = 2000; // per-arg truncation guard
const PERSIST_DEBOUNCE_MS = 800;

type Level = 'log' | 'info' | 'warn' | 'error';

interface Entry {
  t: number; // epoch ms (captured via performance-free Date at emit time)
  l: Level;
  m: string;
}

interface ConsoleLike {
  log: (...a: unknown[]) => void;
  info: (...a: unknown[]) => void;
  warn: (...a: unknown[]) => void;
  error: (...a: unknown[]) => void;
}

let installed = false;
let buffer: Entry[] = [];
let originals: ConsoleLike | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function safeArg(a: unknown): string {
  if (typeof a === 'string') return a;
  if (a instanceof Error) return `${a.name}: ${a.message}${a.stack ? '\n' + a.stack : ''}`;
  if (a === null) return 'null';
  if (a === undefined) return 'undefined';
  try {
    const seen = new WeakSet<object>();
    const out = JSON.stringify(a, (_k, v) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v as object)) return '[Circular]';
        seen.add(v as object);
      }
      return v as unknown;
    });
    return out ?? String(a);
  } catch {
    return String(a);
  }
}

function format(args: unknown[]): string {
  const s = args.map(safeArg).join(' ');
  return s.length > MAX_ARG_CHARS ? s.slice(0, MAX_ARG_CHARS) + '…[truncated]' : s;
}

function loadFromStorage(): Entry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Entry[];
    return Array.isArray(parsed) ? parsed.slice(-MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

function flushNow(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buffer));
  } catch {
    // localStorage full/unavailable — drop oldest half and retry once
    try {
      buffer = buffer.slice(-Math.floor(MAX_ENTRIES / 2));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(buffer));
    } catch {
      /* give up silently — never let capture break the app */
    }
  }
}

function schedulePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    flushNow();
  }, PERSIST_DEBOUNCE_MS);
}

function push(l: Level, args: unknown[]): void {
  buffer.push({ t: Date.now(), l, m: format(args) });
  if (buffer.length > MAX_ENTRIES) buffer = buffer.slice(-MAX_ENTRIES);
  schedulePersist();
}

/** Install the console/error interceptor. Idempotent. Call as early as possible at boot. */
export function installCapture(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  buffer = loadFromStorage();

  const c = console as unknown as ConsoleLike;
  originals = { log: c.log.bind(c), info: c.info.bind(c), warn: c.warn.bind(c), error: c.error.bind(c) };
  const orig = originals;

  c.log = (...a: unknown[]) => { push('log', a); orig.log(...a); };
  c.info = (...a: unknown[]) => { push('info', a); orig.info(...a); };
  c.warn = (...a: unknown[]) => { push('warn', a); orig.warn(...a); };
  c.error = (...a: unknown[]) => { push('error', a); orig.error(...a); };

  window.addEventListener('error', (e: ErrorEvent) => {
    push('error', [`[window.onerror] ${e.message}`, e.filename ? `@ ${e.filename}:${e.lineno}:${e.colno}` : '', e.error instanceof Error ? e.error.stack ?? '' : '']);
    flushNow(); // a crash must not be lost to the debounce
  });
  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    push('error', ['[unhandledrejection]', e.reason]);
    flushNow();
  });
  // Flush on the way out so a close/reopen keeps the trail.
  window.addEventListener('pagehide', () => flushNow());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushNow(); });

  orig.log('[TRACE:CAPTURE] installed', { restored: buffer.length, max: MAX_ENTRIES });
}

export function isCaptureInstalled(): boolean {
  return installed;
}

export function getCaptureCount(): number {
  return buffer.length;
}

/** Render the buffer as a single shareable text blob with a context header. */
export function getCaptureText(): string {
  const head = [
    `# TRACE field capture`,
    `# exported: ${new Date().toISOString()}`,
    `# url: ${typeof location !== 'undefined' ? location.href : '-'}`,
    `# online: ${typeof navigator !== 'undefined' ? navigator.onLine : '-'}`,
    `# ua: ${typeof navigator !== 'undefined' ? navigator.userAgent : '-'}`,
    `# entries: ${buffer.length}`,
    `# NOTE: may contain tenant identifiers (business_id, emails) — internal use.`,
    ``,
  ].join('\n');
  const lines = buffer.map((e) => `${new Date(e.t).toISOString()} ${e.l.toUpperCase().padEnd(5)} ${e.m}`);
  return head + lines.join('\n') + '\n';
}

export function clearCapture(): void {
  buffer = [];
  flushNow();
  originals?.log('[TRACE:CAPTURE] cleared');
}

/** Download the trail as a .txt file (works in any mobile browser tab — no PWA needed). */
export function downloadCapture(): void {
  try {
    const blob = new Blob([getCaptureText()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trace-capture-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    originals?.log('[TRACE:CAPTURE] download', { entries: buffer.length });
  } catch (err) {
    originals?.error('[TRACE:CAPTURE] download failed', err);
  }
}

/**
 * Share the trail via the OS share sheet (iOS Safari + Android Chrome support
 * navigator.share in a plain tab). Falls back to a file download if share is
 * unavailable. Returns 'shared' | 'downloaded' | 'failed'.
 */
export async function shareCapture(): Promise<'shared' | 'downloaded' | 'failed'> {
  const text = getCaptureText();
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  try {
    const file = new File([text], `trace-capture-${Date.now()}.txt`, { type: 'text/plain' });
    if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: 'TRACE field capture' });
      originals?.log('[TRACE:CAPTURE] shared (file)');
      return 'shared';
    }
    if (typeof nav.share === 'function') {
      await nav.share({ title: 'TRACE field capture', text });
      originals?.log('[TRACE:CAPTURE] shared (text)');
      return 'shared';
    }
  } catch (err) {
    // user cancel or unsupported → fall through to download
    originals?.warn('[TRACE:CAPTURE] share unavailable/cancelled — downloading', err);
  }
  try {
    downloadCapture();
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
