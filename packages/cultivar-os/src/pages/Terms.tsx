export function Terms() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--sage-bg, #EAF3DE)' }}>
      <div style={{
        background: 'var(--green-primary, #27500A)',
        padding: '20px 24px',
        color: '#fff',
      }}>
        <p style={{ fontSize: '0.75rem', color: '#a8c890', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
          Cultivar OS
        </p>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, margin: 0 }}>Terms of Service</h1>
        <p style={{ fontSize: '0.8125rem', color: '#a8c890', marginTop: 4 }}>Effective May 22, 2026</p>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        <section>
          <h2 style={h2}>Agreement</h2>
          <p style={body}>
            By creating an account or using Cultivar OS, you agree to these terms. Cultivar OS
            is operated by TRACE Enterprises. If you do not agree, do not use the service.
          </p>
        </section>

        <section>
          <h2 style={h2}>What We Provide</h2>
          <p style={body}>
            Cultivar OS is a software-as-a-service platform for nursery businesses. We provide:
          </p>
          <ul style={list}>
            <li>QR-code-based plant inventory and checkout</li>
            <li>Automated QuickBooks Online invoice creation</li>
            <li>Customer order tracking and follow-up tools</li>
            <li>Owner dashboard with sales metrics and alerts</li>
          </ul>
          <p style={body}>
            We reserve the right to add, modify, or discontinue features with reasonable notice.
          </p>
        </section>

        <section>
          <h2 style={h2}>Your Account</h2>
          <p style={body}>
            You are responsible for maintaining the security of your login credentials. You
            must be a business owner or authorized representative of a nursery to create an
            account. Accounts are for a single business location; contact us for multi-location
            pricing.
          </p>
        </section>

        <section>
          <h2 style={h2}>Subscription and Payment</h2>
          <p style={body}>
            Cultivar OS is offered as a monthly subscription. Pricing is shown at signup and
            on your account page. Founding customers who subscribe during the initial launch
            period are locked into their founding rate for the lifetime of their account.
          </p>
          <p style={body}>
            Subscriptions renew automatically. You may cancel at any time; cancellation takes
            effect at the end of the current billing period. We do not offer partial-month refunds.
          </p>
        </section>

        <section>
          <h2 style={h2}>QuickBooks Integration</h2>
          <p style={body}>
            Connecting QuickBooks Online is optional. By connecting, you authorize Cultivar OS
            to create invoices in your QuickBooks account on your behalf. You may disconnect
            at any time. TRACE Enterprises is not affiliated with or endorsed by Intuit Inc.
            QuickBooks is a registered trademark of Intuit Inc.
          </p>
        </section>

        <section>
          <h2 style={h2}>Your Data</h2>
          <p style={body}>
            You own your data. We do not claim any rights to your plant inventory, customer
            records, or business information. See our{' '}
            <a href="/privacy" style={{ color: 'var(--green-primary, #27500A)', fontWeight: 600 }}>Privacy Policy</a>{' '}
            for details on how data is stored and your rights to access, correct, or delete it.
          </p>
        </section>

        <section>
          <h2 style={h2}>Acceptable Use</h2>
          <p style={body}>You agree not to:</p>
          <ul style={list}>
            <li>Use the platform for any unlawful purpose</li>
            <li>Attempt to reverse-engineer, scrape, or interfere with the service</li>
            <li>Share your account credentials with unauthorized parties</li>
            <li>Input false or misleading business information</li>
          </ul>
          <p style={body}>We reserve the right to suspend accounts that violate these terms.</p>
        </section>

        <section>
          <h2 style={h2}>Service Availability</h2>
          <p style={body}>
            We aim for high availability but do not guarantee uninterrupted service. Planned
            maintenance will be communicated in advance when possible. We are not liable for
            losses resulting from downtime or service interruptions.
          </p>
        </section>

        <section>
          <h2 style={h2}>Limitation of Liability</h2>
          <p style={body}>
            To the fullest extent permitted by law, TRACE Enterprises is not liable for
            indirect, incidental, or consequential damages arising from your use of Cultivar OS,
            including but not limited to lost profits or data. Our total liability in any
            calendar month shall not exceed the subscription fee paid in that month.
          </p>
        </section>

        <section>
          <h2 style={h2}>Changes to These Terms</h2>
          <p style={body}>
            We may update these terms with at least 14 days' notice by email or in-app
            notification. Continued use after the effective date constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 style={h2}>Governing Law</h2>
          <p style={body}>
            These terms are governed by the laws of the State of Texas. Disputes shall be
            resolved in Travis County, Texas.
          </p>
        </section>

        <section>
          <h2 style={h2}>Contact</h2>
          <p style={{ ...body, fontWeight: 600 }}>
            TRACE Enterprises<br />
            <a href="mailto:david@trace-enterprises.com" style={{ color: 'var(--green-primary, #27500A)' }}>
              david@trace-enterprises.com
            </a><br />
            (512) 456-3632
          </p>
        </section>

        <div style={{
          borderTop: '1px solid var(--gray-200, #e5e7eb)',
          paddingTop: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <a href="/privacy" style={{ color: 'var(--green-primary, #27500A)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            ← Privacy Policy
          </a>
          <a href="/" style={{ color: 'var(--gray-600, #4b5563)', fontSize: '0.875rem', textDecoration: 'none' }}>
            Back to app
          </a>
        </div>

      </div>
    </div>
  );
}

const h2: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: 'var(--green-primary, #27500A)',
  marginBottom: 10,
  marginTop: 0,
};

const body: React.CSSProperties = {
  fontSize: '0.9375rem',
  color: 'var(--gray-700, #374151)',
  lineHeight: 1.7,
  margin: '0 0 10px',
};

const list: React.CSSProperties = {
  fontSize: '0.9375rem',
  color: 'var(--gray-700, #374151)',
  lineHeight: 1.7,
  paddingLeft: 20,
  margin: '8px 0',
};
