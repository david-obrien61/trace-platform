// Builds the HTML body for the Cultivar OS order confirmation email.
// Inlined here so it works with Vite's build pipeline without workspace deps.

interface OrderEmailData {
  customerName:  string;
  invoiceNumber: string;
  plantName:     string;
  container:     string;
  quantity:      number;
  plantTotal:    string;
  addonsTotal:   string;
  tax:           string;
  total:         string;
  transport:     string;
  nettingActive: boolean;
}

const GREEN = '#27500A';

export function buildOrderConfirmationEmail(d: OrderEmailData): string {
  const nettingAlert = d.transport === 'self' && d.nettingActive
    ? `<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:8px;padding:14px;margin:16px 0;font-size:14px;">
         <strong>✓ Netting applied</strong> — Your tree is wrapped and ready to load safely.
       </div>`
    : d.transport === 'self'
      ? `<div style="background:#fff3f3;border:2px solid #A32D2D;border-radius:8px;padding:14px;margin:16px 0;font-size:14px;">
           <strong>⚠ No netting</strong> — Please secure your load before leaving the lot. Texas Transportation Code Ch. 725 applies.
         </div>`
      : `<p style="font-size:14px;color:#374151;">🚚 LAWNS will contact you to schedule your delivery or installation.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Order confirmed</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#fff;">
    <div style="background:${GREEN};padding:24px 32px;">
      <span style="color:#fff;font-size:20px;font-weight:700;">LAWNS Tree Farm</span>
    </div>
    <div style="padding:32px;color:#1f2937;font-size:15px;line-height:1.65;">
      <h1 style="font-size:22px;font-weight:700;margin:0 0 16px;">Your order is confirmed.</h1>
      <p>Hi ${d.customerName}, thank you for your purchase from LAWNS Tree Farm.</p>

      <h2 style="font-size:16px;font-weight:600;color:#374151;margin:20px 0 10px;">Order ${d.invoiceNumber}</h2>

      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:8px 0;">${d.plantName} · ${d.container} × ${d.quantity}</td>
          <td style="padding:8px 0;text-align:right;">${d.plantTotal}</td>
        </tr>
        ${d.addonsTotal !== '$0.00' ? `
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:8px 0;">Add-ons</td>
          <td style="padding:8px 0;text-align:right;">${d.addonsTotal}</td>
        </tr>` : ''}
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:8px 0;color:#9ca3af;">Tax (8.25%)</td>
          <td style="padding:8px 0;text-align:right;color:#9ca3af;">${d.tax}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;font-weight:700;font-size:16px;">Total</td>
          <td style="padding:10px 0;text-align:right;font-weight:700;font-size:16px;">${d.total}</td>
        </tr>
      </table>

      ${nettingAlert}

      <p style="font-size:13px;color:#9ca3af;margin-top:24px;">
        Questions? Call us at (512) 450-3336 or email info@lawnstrees.com.
      </p>
    </div>
    <div style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
      <p style="font-size:12px;color:#9ca3af;margin:0 0 4px;">LAWNS Tree Farm, LLC · 400 Honeycomb Mesa, Leander TX 78641</p>
      <p style="font-size:12px;color:#9ca3af;margin:0;">
        <a href="https://cultivar-os.app/unsubscribe" style="color:#9ca3af;">Unsubscribe</a>
        &nbsp;·&nbsp;cultivar-os.app
      </p>
    </div>
  </div>
</body>
</html>`;
}
