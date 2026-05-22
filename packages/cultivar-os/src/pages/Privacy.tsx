export function Privacy() {
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
        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, margin: 0 }}>Privacy Policy</h1>
        <p style={{ fontSize: '0.8125rem', color: '#a8c890', marginTop: 4 }}>Effective May 22, 2026</p>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        <section>
          <h2 style={h2}>What is Cultivar OS?</h2>
          <p style={body}>
            Cultivar OS is a nursery management platform built by TRACE Enterprises. We help
            owner-operated nurseries manage plant inventory, process customer orders, and
            automatically create QuickBooks invoices. This policy explains what data we collect,
            how we store it, and your rights as a user.
          </p>
        </section>

        <section>
          <h2 style={h2}>Data We Collect</h2>
          <p style={body}>We collect only what is necessary to operate the service:</p>
          <ul style={list}>
            <li><strong>Account data</strong> — your name, email address, and password (hashed, never stored in plain text).</li>
            <li><strong>Nursery data</strong> — nursery name, address, phone, and tax rate you provide during setup.</li>
            <li><strong>Plant inventory</strong> — plant records, container sizes, pricing, and growth photos you enter.</li>
            <li><strong>Order data</strong> — customer name, phone, transport preferences, and items purchased during checkout.</li>
            <li><strong>QuickBooks connection</strong> — OAuth tokens and your QuickBooks company realm ID, used solely to create invoices on your behalf. We never read or modify existing QB data.</li>
            <li><strong>Usage logs</strong> — standard server logs (IP address, timestamps, error reports) for debugging and security.</li>
          </ul>
          <p style={body}>We do not collect payment card numbers. Payments are handled directly between your business and your customers outside this platform.</p>
        </section>

        <section>
          <h2 style={h2}>How Your Data Is Stored</h2>
          <p style={body}>
            All data is stored in a PostgreSQL database hosted on Supabase (AWS us-east-1).
            Data is encrypted at rest and in transit (TLS 1.2+). QuickBooks OAuth tokens are
            stored in your nursery record and are never exposed to other accounts. We use
            row-level security policies to ensure each nursery account can only access its own data.
          </p>
        </section>

        <section>
          <h2 style={h2}>QuickBooks Integration</h2>
          <p style={body}>
            When you connect QuickBooks Online, we receive an OAuth 2.0 access token issued
            by Intuit. We use this token to create invoices when orders are completed. We request
            only the <code style={code}>com.intuit.quickbooks.accounting</code> scope. We do not
            read customer lists, bank accounts, payroll, or any data other than what is needed
            to create and retrieve invoices. You can disconnect QuickBooks at any time from your
            dashboard, which immediately revokes our access.
          </p>
        </section>

        <section>
          <h2 style={h2}>Data Sharing</h2>
          <p style={body}>
            We do not sell, rent, or share your data with third parties for marketing purposes.
            Data is shared only with:
          </p>
          <ul style={list}>
            <li><strong>Intuit</strong> — when creating QuickBooks invoices on your behalf.</li>
            <li><strong>Supabase</strong> — our database and authentication provider.</li>
            <li><strong>Vercel</strong> — our hosting and serverless function provider.</li>
          </ul>
          <p style={body}>All providers are bound by their own privacy and security policies.</p>
        </section>

        <section>
          <h2 style={h2}>Your Rights</h2>
          <ul style={list}>
            <li><strong>Access</strong> — you can view all data associated with your account at any time through the platform.</li>
            <li><strong>Correction</strong> — you can edit your nursery profile and plant records directly.</li>
            <li><strong>Deletion</strong> — you can request full deletion of your account and all associated data by emailing us.</li>
            <li><strong>Export</strong> — we can provide a CSV export of your order history and plant records on request.</li>
          </ul>
        </section>

        <section>
          <h2 style={h2}>Data Retention</h2>
          <p style={body}>
            We retain your data for as long as your account is active. If you cancel your
            subscription, your data is retained for 30 days before permanent deletion, giving
            you time to export records. QuickBooks tokens are deleted immediately on disconnect.
          </p>
        </section>

        <section>
          <h2 style={h2}>Contact</h2>
          <p style={body}>
            Questions about this policy or requests to access, correct, or delete your data:
          </p>
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
          <a href="/terms" style={{ color: 'var(--green-primary, #27500A)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            Terms of Service →
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

const code: React.CSSProperties = {
  background: '#e5e7eb',
  borderRadius: 3,
  padding: '1px 5px',
  fontSize: '0.875rem',
  fontFamily: 'monospace',
};
