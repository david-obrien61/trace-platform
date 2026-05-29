const FETCH_TIMEOUT_MS = 12000;
const MAX_CONTENT_CHARS = 10000;

export interface WebsiteContent {
  url:         string;
  title:       string;
  description: string;
  text:        string;
  fetchedAt:   string;
  error?:      string;
}

function stripHtml(html: string): string {
  // Remove script and style blocks entirely
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  // Extract title
  // (returned separately — see below)

  // Replace block elements with newlines to preserve structure
  text = text
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr|br)[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');

  // Collapse whitespace
  text = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

function extractMeta(html: string, field: 'title' | 'description'): string {
  if (field === 'title') {
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return m ? stripHtml(m[1]).slice(0, 200) : '';
  }
  const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  return m ? m[1].slice(0, 500) : '';
}

export async function fetchWebsiteContent(url: string): Promise<WebsiteContent> {
  const fetchedAt = new Date().toISOString();

  // Normalize URL
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TRACE-Discovery/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { url: normalizedUrl, title: '', description: '', text: '', fetchedAt, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return { url: normalizedUrl, title: '', description: '', text: '', fetchedAt, error: 'Not an HTML page' };
    }

    const html = await response.text();
    const title       = extractMeta(html, 'title');
    const description = extractMeta(html, 'description');
    const rawText     = stripHtml(html);
    const text        = rawText.slice(0, MAX_CONTENT_CHARS);

    return { url: normalizedUrl, title, description, text, fetchedAt };

  } catch (err: any) {
    const message = err?.name === 'AbortError' ? 'Timeout after 12s' : (err?.message ?? 'Fetch failed');
    return { url: normalizedUrl, title: '', description: '', text: '', fetchedAt, error: message };
  }
}
