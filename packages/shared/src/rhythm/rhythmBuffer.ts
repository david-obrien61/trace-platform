// ───────────────────────────────────────────────────────────────────────────
// PURPOSE: Customer-zero RHYTHM logger buffer. A data-gathering INSTRUMENT (not a
//   product feature) modeled on the proven debug captureBuffer. Captures, per
//   entry: LOCATION (lat/lng/accuracy while foreground), NARRATION (voice/text
//   notes), and SHAPE/THREAD tags (buy | task | inventory-check | project +
//   optional free-text thread). Persisted to a bounded ring in localStorage so it
//   SURVIVES reload/close-reopen, then exported as a .txt/.json file David hands to
//   Lightning to design the north-star TIMING LAYER (right thread, right time).
// DEPENDENCIES: browser localStorage; optional navigator.share / Blob for export.
//   No app/framework deps.
// OUTPUTS: pushPoint(), pushNote(), getRhythmEntries(), getRhythmCount(),
//   getRhythmText(), getRhythmJSON(), clearRhythm(), downloadRhythm(),
//   shareRhythm(), haversineMeters()
// INSTRUMENTATION: [TRACE:RHYTHM] (STD-003, ON by birth) — emitted via console so
//   the trail also lands in the field-debug capture, tying the two instruments.
// PRIVACY: location + narration is sensitive. Data stays LOCAL (localStorage) until
//   David EXPLICITLY exports — nothing auto-uploads. David-only, consented,
//   customer-zero instrumentation. Not wired into any tenant.
// HONEST CONSTRAINT: foreground-only. Web apps cannot reliably get location while
//   the phone is locked/pocketed (iOS kills it). Background = a future NATIVE build.
// ───────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'trace_rhythm_v1';
const MAX_ENTRIES = 5000; // ~a full day of 60s heartbeats (1440) + movement + notes
const MAX_TEXT_CHARS = 2000; // per-note truncation guard
const PERSIST_DEBOUNCE_MS = 800;

export type RhythmShape = 'buy' | 'task' | 'inventory-check' | 'project';
export type RhythmType = 'location' | 'narration';

export interface RhythmEntry {
  t: number; // epoch ms
  type: RhythmType;
  lat?: number;
  lng?: number;
  accuracy?: number; // meters
  text?: string; // narration only
  shape?: RhythmShape; // narration only, optional
  thread?: string; // narration only, optional free-text label
  source?: 'voice' | 'text'; // narration only — how it was captured
  reason?: 'move' | 'heartbeat'; // location only — why the point was logged
}

let buffer: RhythmEntry[] = [];
let loaded = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;

/** Distance between two lat/lng points in meters (haversine). */
export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000; // earth radius (m)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function load(): void {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as RhythmEntry[]) : [];
    buffer = Array.isArray(parsed) ? parsed.slice(-MAX_ENTRIES) : [];
  } catch {
    buffer = [];
  }
  bindFlushListeners();
}

function flushNow(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buffer));
  } catch {
    // quota full/unavailable — drop oldest half and retry once
    try {
      buffer = buffer.slice(-Math.floor(MAX_ENTRIES / 2));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(buffer));
    } catch {
      /* give up silently — never let the instrument break the app */
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

function bindFlushListeners(): void {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;
  // Flush on the way out so a close/reopen keeps the trail.
  window.addEventListener('pagehide', () => flushNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushNow();
  });
}

function append(entry: RhythmEntry): void {
  load();
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer = buffer.slice(-MAX_ENTRIES);
  schedulePersist();
}

/** Log a location point. `reason` records WHY it was logged (movement vs heartbeat). */
export function pushPoint(
  lat: number,
  lng: number,
  accuracy: number | undefined,
  reason: 'move' | 'heartbeat',
): void {
  append({ t: Date.now(), type: 'location', lat, lng, accuracy, reason });
  console.log('[TRACE:RHYTHM] point', { lat, lng, accuracy, reason });
}

/** Log a narration note, stamped with the current location (if known) + shape/thread. */
export function pushNote(args: {
  text: string;
  shape?: RhythmShape;
  thread?: string;
  source: 'voice' | 'text';
  lat?: number;
  lng?: number;
  accuracy?: number;
}): void {
  const text = args.text.slice(0, MAX_TEXT_CHARS);
  append({
    t: Date.now(),
    type: 'narration',
    text,
    shape: args.shape,
    thread: args.thread?.trim() || undefined,
    source: args.source,
    lat: args.lat,
    lng: args.lng,
    accuracy: args.accuracy,
  });
  console.log('[TRACE:RHYTHM] note', {
    shape: args.shape ?? '(untagged)',
    thread: args.thread || '-',
    source: args.source,
    located: args.lat != null,
  });
}

export function getRhythmEntries(): RhythmEntry[] {
  load();
  return buffer.slice();
}

export function getRhythmCount(): { points: number; notes: number } {
  load();
  let points = 0;
  let notes = 0;
  for (const e of buffer) {
    if (e.type === 'location') points++;
    else notes++;
  }
  return { points, notes };
}

/** Human-readable export — a context header + one line per entry. */
export function getRhythmText(): string {
  load();
  const c = getRhythmCount();
  const head = [
    `# TRACE rhythm log (customer-zero instrument)`,
    `# exported: ${new Date().toISOString()}`,
    `# ua: ${typeof navigator !== 'undefined' ? navigator.userAgent : '-'}`,
    `# entries: ${buffer.length} (${c.points} points, ${c.notes} notes)`,
    `# NOTE: contains location + narration — internal (David → Lightning).`,
    ``,
  ].join('\n');
  const lines = buffer.map((e) => {
    const ts = new Date(e.t).toISOString();
    const loc =
      e.lat != null && e.lng != null
        ? `(${e.lat.toFixed(6)},${e.lng.toFixed(6)}±${Math.round(e.accuracy ?? 0)}m)`
        : '(no-loc)';
    if (e.type === 'location') {
      return `${ts} LOCATION ${loc} [${e.reason ?? '-'}]`;
    }
    const tags = [e.shape ? `#${e.shape}` : '', e.thread ? `@${e.thread}` : '']
      .filter(Boolean)
      .join(' ');
    return `${ts} NOTE     ${loc} ${tags ? tags + ' ' : ''}(${e.source ?? '-'}) ${e.text ?? ''}`;
  });
  return head + lines.join('\n') + '\n';
}

/** Machine-readable export — raw entries for Lightning to analyze. */
export function getRhythmJSON(): string {
  load();
  const c = getRhythmCount();
  return JSON.stringify(
    {
      tool: 'trace-rhythm-log',
      exported: new Date().toISOString(),
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : '-',
      counts: c,
      entries: buffer,
    },
    null,
    2,
  );
}

export function clearRhythm(): void {
  load();
  buffer = [];
  flushNow();
  console.log('[TRACE:RHYTHM] cleared');
}

function triggerDownload(text: string, ext: 'txt' | 'json', mime: string): void {
  try {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trace-rhythm-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    console.log('[TRACE:RHYTHM] download', { ext, entries: buffer.length });
  } catch (err) {
    console.error('[TRACE:RHYTHM] download failed', err);
  }
}

/** Download the trail as .txt (human) or .json (machine). Works in any mobile tab. */
export function downloadRhythm(format: 'txt' | 'json' = 'json'): void {
  if (format === 'json') triggerDownload(getRhythmJSON(), 'json', 'application/json');
  else triggerDownload(getRhythmText(), 'txt', 'text/plain');
}

/**
 * Share the trail via the OS share sheet (iOS Safari + Android Chrome). Falls back
 * to a file download if share is unavailable/cancelled. Returns the outcome.
 */
export async function shareRhythm(
  format: 'txt' | 'json' = 'json',
): Promise<'shared' | 'downloaded' | 'failed'> {
  const text = format === 'json' ? getRhythmJSON() : getRhythmText();
  const ext = format;
  const mime = format === 'json' ? 'application/json' : 'text/plain';
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  try {
    const file = new File([text], `trace-rhythm-${Date.now()}.${ext}`, { type: mime });
    if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: 'TRACE rhythm log' });
      console.log('[TRACE:RHYTHM] shared (file)');
      return 'shared';
    }
    if (typeof nav.share === 'function') {
      await nav.share({ title: 'TRACE rhythm log', text });
      console.log('[TRACE:RHYTHM] shared (text)');
      return 'shared';
    }
  } catch (err) {
    // user cancel or unsupported → fall through to download
    console.warn('[TRACE:RHYTHM] share unavailable/cancelled — downloading', err);
  }
  try {
    downloadRhythm(format);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
