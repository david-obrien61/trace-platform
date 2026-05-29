const FETCH_TIMEOUT_MS  = 15000;
const MAX_CONTENT_CHARS = 10000;

// Full browser headers — reduces bot-detection rejections on Cloudflare-protected sites
const BROWSER_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control':   'no-cache',
  'Pragma':          'no-cache',
  'Sec-Fetch-Dest':  'document',
  'Sec-Fetch-Mode':  'navigate',
  'Sec-Fetch-Site':  'none',
  'Upgrade-Insecure-Requests': '1',
};

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

async function fetchOnce(targetUrl: string, signal: AbortSignal): Promise<Response> {
  return fetch(targetUrl, { signal, headers: BROWSER_HEADERS as Record<string, string> });
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchWebsiteContent(url: string): Promise<WebsiteContent> {
  const fetchedAt = new Date().toISOString();

  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  // Try a list of paths: homepage first, then /about as fallback for bot-blocked homepages
  const baseUrl    = normalizedUrl.replace(/\/$/, '');
  const candidates = [normalizedUrl, `${baseUrl}/about`, `${baseUrl}/about-us`];

  for (let attempt = 0; attempt < candidates.length; attempt++) {
    const targetUrl = candidates[attempt];
    try {
      const controller = new AbortController();
      const timeout    = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let response: Response;

      try {
        response = await fetchOnce(targetUrl, controller.signal);
      } catch (fetchErr: any) {
        clearTimeout(timeout);
        if (fetchErr?.name === 'AbortError') {
          return { url: normalizedUrl, title: '', description: '', text: '', fetchedAt, error: 'Timeout — site took too long to respond' };
        }
        return { url: normalizedUrl, title: '', description: '', text: '', fetchedAt, error: fetchErr?.message ?? 'Fetch failed' };
      }
      clearTimeout(timeout);

      // 429 = rate limited — wait 2s and retry the same URL once, then move on
      if (response.status === 429) {
        if (attempt === 0) {
          await delay(2000);
          try {
            const controller2 = new AbortController();
            const timeout2    = setTimeout(() => controller2.abort(), FETCH_TIMEOUT_MS);
            response = await fetchOnce(targetUrl, controller2.signal);
            clearTimeout(timeout2);
          } catch { /* fall through to error handling */ }
        }
        if (!response.ok) {
          if (attempt < candidates.length - 1) continue; // try /about
          return {
            url: normalizedUrl, title: '', description: '', text: '', fetchedAt,
            error: 'Site is rate-limiting automated access (HTTP 429). Large commercial chains often block scrapers — try an independent nursery or smaller business site.',
          };
        }
      }

      // 403 = Cloudflare or explicit block
      if (response.status === 403) {
        if (attempt < candidates.length - 1) continue;
        return {
          url: normalizedUrl, title: '', description: '', text: '', fetchedAt,
          error: 'Site is blocking automated access (HTTP 403). This is common with large chains using bot protection. Try a different URL.',
        };
      }

      if (!response.ok) {
        if (attempt < candidates.length - 1) continue;
        return { url: normalizedUrl, title: '', description: '', text: '', fetchedAt, error: `HTTP ${response.status}` };
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
        if (attempt < candidates.length - 1) continue;
        return { url: normalizedUrl, title: '', description: '', text: '', fetchedAt, error: 'Not an HTML page' };
      }

      const html        = await response.text();
      const title       = extractMeta(html, 'title');
      const description = extractMeta(html, 'description');
      const rawText     = stripHtml(html);
      const text        = rawText.slice(0, MAX_CONTENT_CHARS);

      // Got content — return it (with a note if this was a fallback path)
      const fetchError = targetUrl !== normalizedUrl
        ? `Homepage blocked — analysis based on ${targetUrl}`
        : undefined;

      return { url: normalizedUrl, title, description, text, fetchedAt, error: fetchError };

    } catch (err: any) {
      if (attempt < candidates.length - 1) continue;
      return { url: normalizedUrl, title: '', description: '', text: '', fetchedAt, error: err?.message ?? 'Fetch failed' };
    }
  }

  return { url: normalizedUrl, title: '', description: '', text: '', fetchedAt, error: 'Could not retrieve any content from this site' };
}
