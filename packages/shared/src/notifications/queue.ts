// ─────────────────────────────────────────────────────────────────────────────
// TRACE Notifications — Queue + Retry
//
// In-memory queue with exponential backoff retry.
// Suitable for server-side use (FastAPI background tasks, Node.js, Bun).
// For high-volume production: swap in a Redis/Supabase-backed queue here
// without changing the caller API.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  NotificationPayload,
  NotificationResult,
  QueuedNotification,
  NotificationConfig,
} from './types';
import { sendNotification } from './send';

let _idCounter = 0;
function nextId(): string {
  return `notif_${Date.now()}_${++_idCounter}`;
}

function backoffMs(attempt: number): number {
  // 1s, 4s, 16s — capped at 60s
  return Math.min(1000 * Math.pow(4, attempt - 1), 60_000);
}

// ── NotificationQueue class ───────────────────────────────────────────────────

export class NotificationQueue {
  private queue: QueuedNotification[] = [];
  private config: NotificationConfig;

  constructor(config: NotificationConfig = {}) {
    this.config = config;
  }

  enqueue(payload: NotificationPayload, maxAttempts = 3): string {
    const item: QueuedNotification = {
      id:            nextId(),
      payload,
      attempts:      0,
      maxAttempts,
      nextAttemptAt: Date.now(),
      createdAt:     Date.now(),
    };
    this.queue.push(item);
    return item.id;
  }

  size(): number {
    return this.queue.filter((i) => !i.result?.success).length;
  }

  // Process one pending item — called by flush() or an interval.
  async processNext(): Promise<NotificationResult | null> {
    const now = Date.now();
    const item = this.queue.find(
      (i) => !i.result?.success && i.attempts < i.maxAttempts && i.nextAttemptAt <= now,
    );
    if (!item) return null;

    item.attempts++;
    item.nextAttemptAt = now + backoffMs(item.attempts);

    try {
      const result = await sendNotification(item.payload, this.config);
      item.result = result;
      if (!result.success && item.attempts >= item.maxAttempts) {
        console.error(
          `[NotificationQueue] Exhausted retries for ${item.id}:`,
          result.error,
        );
      }
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      item.result = { success: false, channel: 'none', error, demo: false };
      return item.result;
    }
  }

  // Drain the queue synchronously — use in request handlers after primary response.
  async flush(): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    const pending = this.queue.filter(
      (i) => !i.result?.success && i.attempts < i.maxAttempts,
    );
    for (const item of pending) {
      item.attempts++;
      item.nextAttemptAt = Date.now() + backoffMs(item.attempts);
      try {
        const result = await sendNotification(item.payload, this.config);
        item.result = result;
        if (result.success) sent++;
        else failed++;
      } catch {
        failed++;
      }
    }
    return { sent, failed };
  }

  // Remove completed items older than maxAgeMs (default 1h).
  gc(maxAgeMs = 3_600_000): void {
    const cutoff = Date.now() - maxAgeMs;
    this.queue = this.queue.filter(
      (i) => !(i.result?.success && i.createdAt < cutoff),
    );
  }
}

// ── Convenience: fire-and-forget ──────────────────────────────────────────────
// Suitable for checkout flows — never blocks the main response.

export async function sendSilently(
  payload: NotificationPayload,
  config: NotificationConfig = {},
): Promise<void> {
  try {
    await sendNotification(payload, config);
  } catch (err) {
    console.error('[Notifications] sendSilently caught:', err);
  }
}
