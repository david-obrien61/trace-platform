// ─────────────────────────────────────────────────────────────────────────────
// Base HTML email wrapper — shared across all TRACE verticals.
// Callers pass inner content HTML; this wraps it in the branded shell.
// ─────────────────────────────────────────────────────────────────────────────

export interface BaseEmailOptions {
  headerColor?:    string;  // default #27500A (TRACE green)
  logoText?:       string;  // business name in header
  footerName?:     string;  // company name in footer
  footerAddress?:  string;
  unsubscribeUrl?: string;
  appUrl?:         string;
}

const DEFAULT: Required<BaseEmailOptions> = {
  headerColor:    '#27500A',
  logoText:       'TRACE',
  footerName:     'Built with CAI — A TRACE Enterprises Platform',
  footerAddress:  '',
  unsubscribeUrl: '#',
  appUrl:         'https://builtwithcai.com',
};

export function baseEmailHtml(innerHtml: string, opts: BaseEmailOptions = {}): string {
  const o = { ...DEFAULT, ...opts };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Email</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 560px; margin: 0 auto; background: #ffffff; }
    .header { background: ${o.headerColor}; padding: 24px 32px; }
    .header-logo { color: #ffffff; font-size: 20px; font-weight: 700; text-decoration: none; letter-spacing: -0.01em; }
    .body { padding: 32px; color: #1f2937; font-size: 15px; line-height: 1.65; }
    .body h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 16px; }
    .body h2 { font-size: 17px; font-weight: 600; color: #374151; margin: 24px 0 8px; }
    .body p { margin: 0 0 16px; }
    .body a { color: ${o.headerColor}; }
    .btn { display: inline-block; padding: 14px 28px; background: ${o.headerColor}; color: #ffffff !important; border-radius: 8px; font-weight: 700; font-size: 15px; text-decoration: none; margin: 8px 0 24px; }
    .line-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
    .line-item:last-child { border-bottom: none; font-weight: 700; font-size: 15px; }
    .alert { background: #fffbeb; border: 2px solid #d97706; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px; }
    .alert-red { background: #fff3f3; border-color: #A32D2D; }
    .footer { background: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb; }
    .footer p { font-size: 12px; color: #9ca3af; margin: 0 0 6px; line-height: 1.5; }
    .footer a { color: #9ca3af; }
    @media (max-width: 600px) {
      .body { padding: 24px 20px; }
      .footer { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span class="header-logo">${o.logoText}</span>
    </div>
    <div class="body">
      ${innerHtml}
    </div>
    <div class="footer">
      <p>${o.footerName}</p>
      ${o.footerAddress ? `<p>${o.footerAddress}</p>` : ''}
      <p>
        <a href="${o.unsubscribeUrl}">Unsubscribe</a>
        &nbsp;·&nbsp;
        <a href="${o.appUrl}">${o.appUrl.replace(/^https?:\/\//, '')}</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}
