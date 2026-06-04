import { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Cultivar OS — Help & FAQ
//
// Public route (/help) — accessible without login so prospects can read it too.
// Keep this page honest: if a feature doesn't exist or works differently than
// described, it is flagged with a // FLAG: comment below. David and Andrew
// review and fill in flagged items before publication.
//
// Styled to match the Privacy and Terms pages (inline styles, no Tailwind).
// ─────────────────────────────────────────────────────────────────────────────

const GREEN  = 'var(--green-primary, #27500A)';
const SAGE   = 'var(--sage-bg, #EAF3DE)';
const GRAY7  = 'var(--gray-700, #374151)';
const GRAY4  = 'var(--gray-400, #9ca3af)';

const h2Style: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 700,
  color: GREEN,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 12,
  marginTop: 0,
  paddingBottom: 8,
  borderBottom: '1px solid #d1fae5',
};

const bodyStyle: React.CSSProperties = {
  fontSize: '0.9375rem',
  color: GRAY7,
  lineHeight: 1.7,
  margin: 0,
};

// ── Accordion FAQ item ────────────────────────────────────────────────────────

function FAQ({ q, a }: { q: string; a: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      borderBottom: '1px solid #e5e7eb',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          padding: '16px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{
          fontSize: '0.9375rem',
          fontWeight: 600,
          color: '#111827',
          lineHeight: 1.45,
          flex: 1,
        }}>
          {q}
        </span>
        <span style={{
          flexShrink: 0,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: open ? GREEN : '#e5e7eb',
          color: open ? '#fff' : '#6b7280',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1rem',
          fontWeight: 700,
          lineHeight: 1,
          marginTop: 1,
          transition: 'background 0.15s',
        }}>
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <div style={{ paddingBottom: 18, paddingRight: 34 }}>
          {typeof a === 'string'
            ? <p style={bodyStyle}>{a}</p>
            : a}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={h2Style}>{title}</h2>
      {children}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function Help() {
  return (
    <div style={{ minHeight: '100vh', background: SAGE }}>

      {/* ── Header ── */}
      <div style={{
        background: GREEN,
        padding: '20px 24px',
        color: '#fff',
      }}>
        <p style={{
          fontSize: '0.75rem', color: '#a8c890', marginBottom: 4,
          letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
        }}>
          Cultivar OS
        </p>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, margin: 0 }}>Help & FAQ</h1>
        <p style={{ fontSize: '0.8125rem', color: '#a8c890', marginTop: 4 }}>
          Common questions about using Cultivar OS
        </p>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '36px 20px' }}>

        {/* ── Getting Started ── */}
        <Section title="Getting started">

          {/*
            FLAG: Step 2 below ("add your plants") references a plant management UI
            that is not yet built as of 2026-05-31. See self-serve readiness plan P-1.
            Update this answer once /plants ships. For now, new customers cannot
            add plants self-serve — they need to contact support.
          */}
          <FAQ
            q="I just signed up — where do I start?"
            a={
              <div style={bodyStyle}>
                <p style={{ margin: '0 0 10px' }}>
                  After the setup wizard, work through these three steps in order:
                </p>
                <ol style={{ paddingLeft: 20, margin: '0 0 10px' }}>
                  <li style={{ marginBottom: 8 }}>
                    <strong>Add your plants.</strong> Each plant in Cultivar OS gets its own
                    record — species, container size, price, and care notes.
                  </li>
                  <li style={{ marginBottom: 8 }}>
                    <strong>Print and attach QR tags.</strong> Each plant gets a unique QR code
                    that links to its profile. Your customers scan this with their phone camera
                    — no app needed.
                  </li>
                  <li style={{ marginBottom: 8 }}>
                    <strong>Run one test order.</strong> Scan a tag on your own phone, walk
                    through the checkout, and confirm a QuickBooks invoice is created. Once
                    that works, you're ready for customers.
                  </li>
                </ol>
                <p style={{ margin: 0, color: GRAY4, fontSize: '0.875rem' }}>
                  Everything on the dashboard — revenue, leakage, installs — depends on having
                  plants and orders in your account. The inventory is what unlocks the rest.
                </p>
              </div>
            }
          />

          {/*
            FLAG: There is no plant management UI as of 2026-05-31. This is the #1
            self-serve gap (readiness plan P-1, ~14h estimate). The answer below
            is a placeholder. Fill in the actual steps once /plants ships and
            remove this FLAG comment before publication.
          */}
          <FAQ
            q="How do I add my plants to the inventory?"
            a={
              <div style={bodyStyle}>
                <p style={{ margin: '0 0 10px' }}>
                  {/* FLAG: Replace this placeholder with actual /plants steps once P-1 ships. */}
                  Plant self-management through the app is coming soon. For now, email
                  {' '}<a href="mailto:david@trace-enterprises.com" style={{ color: GREEN }}>
                    david@trace-enterprises.com
                  </a>{' '}
                  with your plant list — species name, container size, price, and
                  install price if you offer it — and we'll add them to your account
                  within one business day.
                </p>
                <p style={{ margin: 0, color: GRAY4, fontSize: '0.875rem' }}>
                  Include your nursery name in the subject line so we can match your
                  request to the right account.
                </p>
              </div>
            }
          />

          {/*
            FLAG: In-app QR printing is not accessible through a plant management UI yet.
            The QR generation module (shared/src/qr/generate.ts) produces a PNG — no
            specific label format (Avery, Zebra ZPL, etc.) is implemented.
            Update this answer when /plants ships. Remove this FLAG comment before
            publication and add the actual print steps.
          */}
          <FAQ
            q="How do I print QR code tags for my plants?"
            a={
              <div style={bodyStyle}>
                <p style={{ margin: '0 0 10px' }}>
                  {/* FLAG: In-app QR generation via the plant UI is not built yet.
                      When /plants ships, replace the first paragraph below with
                      actual steps (Plants page → tap plant → Print QR Tag → download PNG). */}
                  Each plant gets a unique QR code linked to its profile page. For now,
                  email{' '}
                  <a href="mailto:david@trace-enterprises.com" style={{ color: GREEN }}>
                    david@trace-enterprises.com
                  </a>{' '}
                  with your plant list and we'll generate a print-ready sheet of QR tags for you.
                </p>
                <p style={{ margin: 0, color: GRAY4, fontSize: '0.875rem' }}>
                  QR tags print as standard PNG images. Any thermal label printer, Zebra
                  printer, or standard inkjet on Avery label sheets will work. The QR code
                  is designed to scan reliably even on a 1-inch tag.
                </p>
              </div>
            }
          />

          <FAQ
            q="What does a plant profile page show my customers?"
            a={
              <div style={bodyStyle}>
                <p style={{ margin: '0 0 10px' }}>
                  When a customer scans the QR tag, they see:
                </p>
                <ul style={{ paddingLeft: 20, margin: '0 0 10px' }}>
                  <li>Photo (or a placeholder if no photo is uploaded)</li>
                  <li>Common name and scientific species name</li>
                  <li>Container size and time in cultivation</li>
                  <li>Warranty length in months</li>
                  <li>Base price and professional installation price (if you offer it)</li>
                  <li>Care notes you've added to the record</li>
                  <li>Growth timeline events — notable milestones in the plant's history</li>
                </ul>
                <p style={{ margin: 0 }}>
                  At the bottom is a quantity selector and "Add to cart" button.
                  Add-ons and transport selection are on the next screen.
                </p>
              </div>
            }
          />

        </Section>

        {/* ── Daily Operations ── */}
        <Section title="Daily operations">

          <FAQ
            q="How does QR checkout work for my customers?"
            a={
              <div style={bodyStyle}>
                <p style={{ margin: '0 0 10px' }}>
                  No app required — everything runs in the phone's browser. The flow:
                </p>
                <ol style={{ paddingLeft: 20, margin: '0 0 10px' }}>
                  <li style={{ marginBottom: 6 }}>Customer scans the QR tag with their phone camera.</li>
                  <li style={{ marginBottom: 6 }}>They see the plant profile — photo, species, price, care notes.</li>
                  <li style={{ marginBottom: 6 }}>
                    They select quantity and choose transport: taking it home themselves,
                    requesting delivery, or scheduling professional installation.
                  </li>
                  <li style={{ marginBottom: 6 }}>
                    If they're taking the plant home, netting is offered automatically —
                    pre-selected by default. They can decline.
                  </li>
                  <li style={{ marginBottom: 6 }}>Any other active add-ons are shown here too.</li>
                  <li style={{ marginBottom: 6 }}>They enter their name, phone, and email.</li>
                  <li style={{ marginBottom: 6 }}>
                    Cart review shows plant price, transport, add-ons, and tax. They confirm.
                  </li>
                  <li>
                    A QuickBooks invoice is created automatically and emailed to the customer
                    (if you've connected QuickBooks).
                  </li>
                </ol>
                <p style={{ margin: 0, color: GRAY4, fontSize: '0.875rem' }}>
                  The whole flow takes about 90 seconds. No card processing — Cultivar OS
                  handles the record and invoice; payment happens however your business
                  normally collects it.
                </p>
              </div>
            }
          />

          <FAQ
            q="What is the 'leakage' metric on my dashboard?"
            a={
              <div style={bodyStyle}>
                <p style={{ margin: '0 0 10px' }}>
                  Leakage counts the orders this week where a customer declined all add-ons
                  on a plant they were taking home themselves. These are the sales most likely
                  to have needed netting or a soil amendment but left without it.
                </p>
                <p style={{ margin: 0 }}>
                  The dashboard shows the count and estimates the missed revenue based on your
                  average add-on value. It's the number to watch when you're trying to improve
                  your add-on capture rate — a high leakage count usually means the netting
                  conversation is happening too late, or not at all.
                </p>
              </div>
            }
          />

          <FAQ
            q="How do I track deliveries?"
            a={
              <div style={bodyStyle}>
                <p style={{ margin: '0 0 10px' }}>
                  From your dashboard, tap the Delivery tile. Cultivar OS pulls all orders
                  marked for delivery. From there:
                </p>
                <ol style={{ paddingLeft: 20, margin: '0 0 10px' }}>
                  <li style={{ marginBottom: 6 }}>Check the stops you want to route today.</li>
                  <li style={{ marginBottom: 6 }}>
                    If a customer's address is missing, an address field appears inline —
                    enter it and it's used for this route (it doesn't save back to the order
                    permanently yet).
                  </li>
                  <li style={{ marginBottom: 6 }}>
                    Tap "Open in Maps" — Google Maps opens with all stops pre-loaded as a
                    multi-stop route.
                  </li>
                  <li>
                    Tap "Text Route to Driver" to send the Google Maps link via your phone's
                    messaging app to your driver.
                  </li>
                </ol>
                <p style={{ margin: 0, color: GRAY4, fontSize: '0.875rem' }}>
                  Route optimization (reordering stops for shortest drive) is handled by
                  Google Maps — Cultivar OS passes the stops and Google arranges them.
                </p>
              </div>
            }
          />

          <FAQ
            q="How do I create a marketing campaign?"
            a={
              <div style={bodyStyle}>
                <p style={{ margin: '0 0 10px' }}>
                  Go to the Campaigns section from your dashboard. Tap "New Campaign" and fill in:
                </p>
                <ul style={{ paddingLeft: 20, margin: '0 0 10px' }}>
                  <li style={{ marginBottom: 6 }}>Campaign name and type (seasonal, holiday, clearance, product launch, or custom)</li>
                  <li style={{ marginBottom: 6 }}>Optional date range and target plant category</li>
                  <li style={{ marginBottom: 6 }}>A brief description of what this campaign is about</li>
                </ul>
                <p style={{ margin: '0 0 10px' }}>
                  Cultivar OS drafts social media posts for the campaign based on your description.
                  You review each draft, edit it to sound like you, copy the caption, and post to
                  your accounts.
                </p>
                <p style={{ margin: 0, color: GRAY4, fontSize: '0.875rem' }}>
                  To use campaigns, enable the Social Media module from your dashboard tile first.
                </p>
              </div>
            }
          />

          <FAQ
            q="What is the social media drafts feature?"
            a={
              <div style={bodyStyle}>
                <p style={{ margin: '0 0 10px' }}>
                  TRACE writes ready-to-post captions from your sales each week, tailored to
                  each platform you post on. Tap "Generate this week's posts" on your dashboard
                  and TRACE looks at your recent sales, aggregates them into a story, and writes
                  one caption per platform.
                </p>
                <p style={{ margin: '0 0 10px' }}>
                  Each caption appears in an editable field. Edit it to sound like you, then
                  copy it and paste into Instagram, Facebook, or wherever you post. No app
                  connection or separate account required — the handoff is copy-paste.
                </p>
                <p style={{ margin: 0, color: GRAY4, fontSize: '0.875rem' }}>
                  To enable this, tap the Social Media tile on your dashboard, choose how often
                  you want to post, and select your platforms.
                </p>
              </div>
            }
          />

          <FAQ
            q="How do I view my recent orders?"
            a="From the dashboard, tap the QR Checkout tile or navigate to the Orders section. You'll see your 50 most recent orders, each showing the customer name, plant, amount, and transport method. Orders flagged for leakage show a red border — these are the ones where add-ons were declined on a self-transport sale."
          />

        </Section>

        {/* ── Settings & Configuration ── */}
        <Section title="Settings & configuration">

          <FAQ
            q="How do I connect my QuickBooks account?"
            a={
              <div style={bodyStyle}>
                <p style={{ margin: '0 0 10px' }}>
                  Go to Settings from the dashboard header, then find the Accounting section.
                  Tap "Connect QuickBooks." A browser popup opens for QuickBooks Online
                  authorization — sign in to your QuickBooks account and approve the connection.
                  The popup closes automatically when the connection is established.
                </p>
                <p style={{ margin: '0 0 10px' }}>
                  Once connected, a QuickBooks invoice is created automatically every time a
                  customer completes checkout. The invoice includes plant, add-ons, transport,
                  and tax as separate line items.
                </p>
                <p style={{ margin: 0, color: GRAY4, fontSize: '0.875rem' }}>
                  Cultivar OS supports QuickBooks Online only. QuickBooks Desktop is not
                  supported. If your QB connection needs attention, a yellow alert will
                  appear at the top of your dashboard.
                </p>
              </div>
            }
          />

          <FAQ
            q="How do I change my business name, address, or tax rate?"
            a={
              <div style={bodyStyle}>
                <p style={{ margin: '0 0 10px' }}>
                  Go to Settings → Business Profile. All fields are editable: business name,
                  address, city, state, phone, email, website, and tax rate. Save the section
                  with the button at the bottom.
                </p>
                <p style={{ margin: 0, color: GRAY4, fontSize: '0.875rem' }}>
                  Tax rate is entered as a decimal — for 8.25%, enter <strong>0.0825</strong>.
                  This rate is applied automatically to every order at checkout.
                </p>
              </div>
            }
          />

          <FAQ
            q="How do I add services I offer — delivery, installation, add-ons?"
            a={
              <div style={bodyStyle}>
                <p style={{ margin: '0 0 10px' }}>
                  Go to Settings → Service Offerings. Each service has a name, category
                  (transport, add-on, maintenance), price, and timing (at checkout vs.
                  post-purchase). Tap "Add Service" to create a new one.
                </p>
                <p style={{ margin: '0 0 10px' }}>
                  Active services appear in the checkout flow for your customers. You can
                  toggle any service on or off without deleting it — useful for seasonal
                  offerings.
                </p>
                <p style={{ margin: 0, color: GRAY4, fontSize: '0.875rem' }}>
                  Default install price (used when a customer selects professional
                  installation) is set separately in Settings → Nursery Settings.
                </p>
              </div>
            }
          />

          <FAQ
            q="How do I update my contact info or business hours?"
            a={
              /*
                FLAG: Confirm that business hours are not in the Settings UI.
                If a hours field is added, update this answer accordingly.
              */
              <div style={bodyStyle}>
                <p style={{ margin: '0 0 10px' }}>
                  Business name, phone, email, address, and website are all in
                  Settings → Business Profile. Edit any field and save.
                </p>
                <p style={{ margin: 0 }}>
                  Business hours are not currently tracked in Cultivar OS. Most nurseries
                  manage hours through their website or Google Business profile, which your
                  customers are likely already checking before they visit.
                </p>
              </div>
            }
          />

        </Section>

        {/* ── Billing & Subscription ── */}
        <Section title="Billing & subscription">

          {/*
            FLAG: Trial mechanics (trial_starts_at, countdown UI, enforcement) are not
            built yet as of 2026-05-31. See self-serve readiness plan items T-1–T-4.
            The answers below reflect the intended behavior once Stripe and the trial
            clock are live. Verify all billing answers before publication.
          */}

          <FAQ
            q="How long is the free trial?"
            a="30 days, with no credit card required to start. You get full access to all features during the trial — there's nothing held back. We'll send you a reminder at 7 days before your trial ends and again the day before."
          />

          <FAQ
            q="What happens when my trial ends?"
            a={
              <div style={bodyStyle}>
                <p style={{ margin: '0 0 10px' }}>
                  {/*
                    FLAG: Trial expiration enforcement (locked state, upgrade prompt) is
                    not built yet. This is the intended behavior. Verify before publishing.
                    Note: Privacy page says data retention is 30 days after cancellation;
                    the prompt spec said 60 days. Aligned with Privacy page (30 days)
                    since that's the legally committed document.
                  */}
                  When your trial ends, you'll see a prompt to add a payment method.
                  Your data is fully preserved — plants, orders, customer records, nothing
                  is deleted.
                </p>
                <p style={{ margin: 0 }}>
                  If you don't subscribe within 30 days of your trial ending, your account
                  is permanently deleted. We'll email you before that happens.
                </p>
              </div>
            }
          />

          <FAQ
            q="How much does Cultivar OS cost?"
            a={
              <div style={bodyStyle}>
                {/*
                  FLAG: Stripe pricing is not yet configured. These rates are per
                  THOUGHTS.md and MASTER_BRIEF.md. Verify with David before publishing —
                  including whether the founding rate is still being offered and at what
                  threshold it closes.
                */}
                <p style={{ margin: '0 0 10px' }}>
                  Standard rate is <strong>$299 per month</strong>.
                </p>
                <p style={{ margin: '0 0 10px' }}>
                  Founding customers who sign up during our early access period are locked
                  in at <strong>$149 per month — forever</strong>. That rate doesn't go up
                  when we raise prices, and it doesn't expire.
                </p>
                <p style={{ margin: 0, color: GRAY4, fontSize: '0.875rem' }}>
                  Pricing is reviewed annually. Any increases are communicated 60 days in
                  advance and never apply to founding customers.
                </p>
              </div>
            }
          />

          <FAQ
            q="How do I cancel my subscription?"
            a={
              <div style={bodyStyle}>
                {/*
                  FLAG: Self-serve cancel flow is not built yet (see readiness plan S-5).
                  When built, replace the email-to-cancel instruction with the actual
                  Settings → Cancel path. Remove this FLAG comment before publication.
                */}
                <p style={{ margin: '0 0 10px' }}>
                  Email{' '}
                  <a href="mailto:david@trace-enterprises.com" style={{ color: GREEN }}>
                    david@trace-enterprises.com
                  </a>{' '}
                  to cancel. We'll confirm within one business day. Your account stays active
                  through the end of your current billing period.
                </p>
                <p style={{ margin: 0 }}>
                  Your data is retained for 30 days after cancellation so you can export
                  records if you need them. After 30 days, data is permanently deleted.
                </p>
              </div>
            }
          />

          <FAQ
            q="Can I export my data?"
            a={
              <div style={bodyStyle}>
                <p style={{ margin: '0 0 10px' }}>
                  Yes. Email{' '}
                  <a href="mailto:david@trace-enterprises.com" style={{ color: GREEN }}>
                    david@trace-enterprises.com
                  </a>{' '}
                  and we'll export your order history, plant records, and customer list as
                  CSV files within 5 business days.
                </p>
                <p style={{ margin: 0, color: GRAY4, fontSize: '0.875rem' }}>
                  {/* FLAG: There is no self-serve export button in the app yet.
                      If one is added, update this answer to mention it. */}
                  There isn't a self-serve export button in the app yet — contact us directly.
                </p>
              </div>
            }
          />

        </Section>

        {/* ── Troubleshooting ── */}
        <Section title="Troubleshooting">

          <FAQ
            q="My QuickBooks connection stopped working — what do I do?"
            a={
              <div style={bodyStyle}>
                <p style={{ margin: '0 0 10px' }}>
                  If your QuickBooks connection has expired, a yellow alert banner will appear
                  at the top of your dashboard. Click it or go to Settings → Accounting and
                  tap "Reconnect QuickBooks." Authorize again through the QuickBooks login
                  popup — takes about 60 seconds.
                </p>
                <p style={{ margin: 0 }}>
                  If the reconnect alert isn't showing but invoices are failing, try
                  disconnecting QuickBooks from Settings and reconnecting fresh. If it's still
                  not working after that, email support with your business name and we'll
                  investigate.
                </p>
              </div>
            }
          />

          <FAQ
            q="I'm not receiving emails from Cultivar OS — what should I check?"
            a={
              <div style={bodyStyle}>
                <p style={{ margin: '0 0 10px' }}>
                  Check your spam folder first — automated business emails sometimes land there.
                  Then confirm the email address under Settings → Business Profile is correct.
                </p>
                <p style={{ margin: 0 }}>
                  If you're still missing confirmation emails after a test order, email{' '}
                  <a href="mailto:david@trace-enterprises.com" style={{ color: GREEN }}>
                    david@trace-enterprises.com
                  </a>{' '}
                  with your business name and the order date so we can check the delivery logs.
                </p>
              </div>
            }
          />

          <FAQ
            q="The QR code scan isn't working for a customer — what's wrong?"
            a={
              <div style={bodyStyle}>
                <p style={{ margin: '0 0 12px' }}>Most scan issues come from one of these:</p>
                <ul style={{ paddingLeft: 20, margin: '0 0 10px' }}>
                  <li style={{ marginBottom: 6 }}>
                    <strong>Distance.</strong> The sweet spot is 6–12 inches from the tag.
                    Too close or too far both fail.
                  </li>
                  <li style={{ marginBottom: 6 }}>
                    <strong>Lighting.</strong> Bright natural light works best. Direct sun
                    glare can also cause problems — shade the tag slightly.
                  </li>
                  <li style={{ marginBottom: 6 }}>
                    <strong>Damaged tag.</strong> A creased, smeared, or wet tag won't scan
                    reliably. Replace it.
                  </li>
                  <li style={{ marginBottom: 6 }}>
                    <strong>Using a QR app instead of the camera.</strong> Modern iPhone and
                    Android cameras scan QR codes natively — no separate app needed. Point the
                    regular camera at the tag and a link should appear.
                  </li>
                  <li>
                    <strong>No cellular signal or Wi-Fi at the nursery.</strong> The scan
                    itself works offline — opening the plant profile page requires internet.
                  </li>
                </ul>
                <p style={{ margin: 0 }}>
                  If scans fail consistently on a specific tag, the URL may have printed
                  incorrectly. Email support with the plant tag ID.
                </p>
              </div>
            }
          />

          <FAQ
            q="Something on my dashboard looks wrong — who do I contact?"
            a={
              <div style={bodyStyle}>
                {/*
                  FLAG: Update the August/Andrew note with exact trip dates and
                  Andrew's confirmed email address before publication.
                */}
                <p style={{ margin: '0 0 10px' }}>
                  Email{' '}
                  <a href="mailto:david@trace-enterprises.com" style={{ color: GREEN }}>
                    david@trace-enterprises.com
                  </a>.
                  Include your business name, what you were looking at, and what you
                  expected to see vs. what you saw. A screenshot helps a lot.
                </p>
                <p style={{ margin: 0, color: GRAY4, fontSize: '0.875rem' }}>
                  During August 2026, Andrew O'Brien is monitoring support while David is
                  traveling. Response time for straightforward issues is typically same-day;
                  complex issues may take 2–3 days.
                </p>
              </div>
            }
          />

        </Section>

        {/* ── Getting Help ── */}
        <Section title="Getting help">

          <FAQ
            q="How do I contact support?"
            a={
              <div style={bodyStyle}>
                {/*
                  FLAG: Confirm Andrew's email address and the exact Europe trip dates
                  before publication. Update the August/September window if dates shift.
                */}
                <p style={{ margin: '0 0 10px' }}>
                  Email{' '}
                  <a href="mailto:david@trace-enterprises.com" style={{ color: GREEN }}>
                    david@trace-enterprises.com
                  </a>. Normal response time is 1–2 business days.
                </p>
                <p style={{ margin: 0 }}>
                  During August and September 2026, David is traveling. Andrew O'Brien
                  is handling support during that period — responses may take slightly longer
                  for complex issues. Urgent platform outages will still be addressed quickly.
                </p>
              </div>
            }
          />

          <FAQ
            q="Is there a phone number?"
            a={
              <div style={bodyStyle}>
                <p style={{ margin: '0 0 10px' }}>
                  Yes — <strong>(512) 456-3632</strong>. Email is preferred for account
                  questions since it gives us a written record and is easier to hand off
                  if we need to escalate.
                </p>
                <p style={{ margin: 0 }}>
                  Phone is best for urgent situations where you're in the middle of a
                  customer interaction and something isn't working.
                </p>
              </div>
            }
          />

          <FAQ
            q="Where do I report a bug or request a feature?"
            a={
              <div style={bodyStyle}>
                <p style={{ margin: '0 0 10px' }}>
                  Email{' '}
                  <a href="mailto:david@trace-enterprises.com" style={{ color: GREEN }}>
                    david@trace-enterprises.com
                  </a>{' '}
                  with a description. For bugs, include your business name, what you were
                  doing, and what happened instead. A screenshot if possible.
                </p>
                <p style={{ margin: 0, color: GRAY4, fontSize: '0.875rem' }}>
                  Feature requests are reviewed monthly. We're a small team, so the more
                  specific you can be about why a feature matters for your operation —
                  "I spend 3 hours a week on this" is more useful than "it would be nice" —
                  the better we can prioritize it.
                </p>
              </div>
            }
          />

          <FAQ
            q="Is Cultivar OS still being actively developed?"
            a={
              <div style={bodyStyle}>
                <p style={{ margin: '0 0 10px' }}>
                  Yes. We ship updates regularly. If you're a founding customer, your
                  rate is locked forever — updates, new features, and improvements all
                  included at the price you signed up at.
                </p>
                <p style={{ margin: 0 }}>
                  You can always ask what's coming. We're straightforward about what's
                  on the roadmap and what isn't — we'd rather tell you "not yet" than
                  overpromise.
                </p>
              </div>
            }
          />

        </Section>

        {/* ── Footer ── */}
        <div style={{
          borderTop: '1px solid #d1d5db',
          paddingTop: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ display: 'flex', gap: 20 }}>
            <a href="/privacy" style={{ color: GREEN, fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
              Privacy Policy
            </a>
            <a href="/terms" style={{ color: GREEN, fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
              Terms of Service
            </a>
          </div>
          <a href="/dashboard" style={{ color: '#6b7280', fontSize: '0.875rem', textDecoration: 'none' }}>
            Back to dashboard
          </a>
        </div>

        <p style={{ fontSize: '0.75rem', color: GRAY4, marginTop: 24, textAlign: 'center' }}>
          Cultivar OS · Built by TRACE Enterprises · david@trace-enterprises.com · (512) 456-3632
        </p>

      </div>
    </div>
  );
}
