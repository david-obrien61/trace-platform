// extractTag — a scanned QR holds a URL like https://…/plant/SCV-0031; strip the URL,
// keep the tag. Shared by the walk-and-count loop (InventoryCount) and the multi-item
// scan-order loop (ScanOrder) — ONE definition, not a drifted copy (CLAUDE.md §6 rule 8).
export function extractTag(raw: string): string {
  const trimmed = raw.trim();
  const m = trimmed.match(/\/plant\/([^/?#]+)/i);
  if (m) return decodeURIComponent(m[1]);
  // Not a /plant/ URL — if it's any other URL, take the last path segment; else use as-is.
  try {
    const u = new URL(trimmed);
    const segs = u.pathname.split('/').filter(Boolean);
    if (segs.length) return decodeURIComponent(segs[segs.length - 1]);
  } catch { /* not a URL — a bare code */ }
  return trimmed;
}
