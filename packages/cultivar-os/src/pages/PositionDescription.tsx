/**
 * PositionDescription — THE PAGE AN OWNER HANDS TO A PERSON
 *                       (/admin/positions/:positionId/description).
 *
 * PURPOSE:      Render `buildPositionDocument` as something Lauren would print and give Joel on
 *               Monday. **The bar is not "it renders"** — a generated document that reads as
 *               filler teaches the person the feature is decoration, and that is harder to undo
 *               than not shipping it.
 * DEPENDENCIES: positionStore (read) · buildPositionDocument (all assembly, PURE and tested) ·
 *               dayTypeMeta for the day labels · useBusinessContext.
 * OUTPUTS:      A print-ready page. `window.print()` on the page itself.
 * INSTRUMENTATION (STD-003): [TRACE:POSITIONS] — ON by default (standing owner instruction).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 PRINT IS A STYLESHEET ON A REAL ROUTE, NOT A GENERATED WINDOW — AND THE REASON IS SECURITY.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * The repo's one existing print mechanism is `shared/src/qr/print.ts`, which does
 * `window.open` → `document.write` of an interpolated HTML string. It has ZERO callers, and it
 * interpolates its values UNESCAPED — fine for a SKU, and NOT fine for this page, every line of
 * which is prose an owner typed. Rendering through React escapes by construction. It also needs
 * no dependency (there is no PDF library in this repo and none is added), and print-to-PDF is the
 * download, so "printable and downloadable" is one mechanism rather than two.
 * ⚠️ It also avoids inheriting `print.ts`'s `nurseryName` AC-1 leak, which is on the Noun Purge.
 *
 * 🔴 NO SOFTWARE VOCABULARY APPEARS BELOW. No permission, no "not built yet", no capability mark.
 * A responsibility TRACE cannot represent prints exactly like one it can, because to the person
 * doing the job they are the same work. `positions.test.ts` D5 asserts it over the whole document.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, AlertCircle } from 'lucide-react';
import { useBusinessContext } from '@trace/shared/context';
import { supabase } from '@trace/shared/supabase/client';
import { NotPermitted } from '@trace/shared/components/SurfaceState';
import { readPositionWorkspace } from '@trace/shared/positions/positionStore';
import { buildPositionDocument, type PositionDocument } from '@trace/shared/positions/positionDescription';
import type { ResponsibilityFrequency } from '@trace/shared/positions/responsibilityCatalogue';
import { readFailureMessage } from '@trace/shared/utils/readResult';
import { dayTypeMeta } from '../lib/operationsCalendar';

const GREEN = '#27500A';

/**
 * The print rules. `.no-print` covers the chrome; the sheet itself gets serif body text at a size
 * a person reads on paper, and `page-break-inside: avoid` keeps an area's heading with its list
 * instead of orphaning it at a page foot.
 */
const PRINT_CSS = `
@media print {
  .no-print { display: none !important; }
  .doc-sheet { box-shadow: none !important; border: none !important; margin: 0 !important; padding: 0 !important; max-width: none !important; }
  body { background: #fff !important; }
  .doc-area { page-break-inside: avoid; }
  .doc-excellence { page-break-inside: avoid; }
}
@page { margin: 18mm; }
`;

export function PositionDescription() {
  const { positionId } = useParams<{ positionId: string }>();
  const navigate = useNavigate();
  const { businessId, business, can } = useBusinessContext();

  const [doc, setDoc] = useState<PositionDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!businessId || !positionId) return;
    setLoading(true);
    const res = await readPositionWorkspace(supabase, businessId);
    if (!res.ok) { setError(readFailureMessage(res.error)); setLoading(false); return; }
    const position = res.value.positions.find((p) => p.id === positionId);
    if (!position) { setError('That position no longer exists.'); setLoading(false); return; }

    const built = buildPositionDocument({
      title: position.title,
      businessName: business?.name ?? 'This business',
      context: {
        whatWeDo:   res.value.context?.what_we_do   ?? null,
        whoWeServe: res.value.context?.who_we_serve ?? null,
        knownFor:   res.value.context?.known_for    ?? null,
      },
      operatingDays: res.value.operatingDays.map((d) => ({
        weekday: d.weekday, dayTypeLabel: dayTypeMeta(d.day_type)?.label ?? d.day_type,
      })),
      picks: res.value.responsibilities
        .filter((r) => r.position_id === positionId)
        .map((r) => ({ responsibilityId: r.responsibility_id, frequency: (r.frequency as ResponsibilityFrequency | null) ?? null })),
      excellence: position.excellence_note,
      today: new Date(),
    });
    setError(null);
    setDoc(built);
    console.log('[TRACE:POSITIONS] description', {
      positionId, responsibilities: built.responsibilityCount,
      areas: built.areas.length, contextComplete: built.contextComplete, missing: built.missing,
    });
    setLoading(false);
  }, [businessId, positionId, business?.name]);

  useEffect(() => { void load(); }, [load]);

  if (!can('settings:read')) return <NotPermitted permission="settings:read" what="position descriptions" />;

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      <style>{PRINT_CSS}</style>

      <div className="no-print" style={{ background: GREEN, padding: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={() => navigate(`/admin/positions/${positionId}`)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#d7e8c8', fontSize: '0.8125rem', cursor: 'pointer', padding: 0 }}>
          <ArrowLeft size={14} /> Back to the position
        </button>
        <span style={{ flex: 1 }} />
        <button onClick={() => window.print()}
          style={{ minHeight: 48, padding: '0 18px', background: '#fff', color: GREEN, border: 'none', borderRadius: 8, fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Printer size={16} /> Print or save as PDF
        </button>
      </div>

      {loading && <p className="no-print" style={{ padding: 24, fontSize: '0.875rem', color: '#6b7280' }}>Loading…</p>}
      {error && (
        <div className="no-print" style={{ margin: 20, padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10 }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#991b1b' }}>{error}</p>
        </div>
      )}

      {/*
        🔴 SURFACE, DON'T DECIDE. When something is missing the page SAYS SO, above the fold, in
        the owner's own words — and still prints. Refusing to print would be the wrong trade: a
        short honest description is useful today, and this banner is what stops a thin one going
        out by accident. It is `.no-print`, so it never reaches the person receiving the document.
      */}
      {doc && !doc.contextComplete && (
        <div className="no-print" style={{ margin: '16px auto 0', maxWidth: 720, padding: 14, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, display: 'flex', gap: 10 }}>
          <AlertCircle size={18} color="#b45309" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: '0.875rem', color: '#78350f' }}>
            This will print, but it is thinner than it needs to be. Still missing: {doc.missing.join(', ')}.
          </span>
        </div>
      )}

      {doc && (
        <div className="doc-sheet" style={{
          maxWidth: 720, margin: '20px auto 60px', background: '#fff', padding: '48px 56px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)', borderRadius: 4,
          fontFamily: 'Georgia, "Times New Roman", serif', color: '#1f2937', lineHeight: 1.55,
        }}>
          <header style={{ borderBottom: '2px solid #111827', paddingBottom: 14, marginBottom: 22 }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#111827', letterSpacing: '-0.01em' }}>{doc.title}</h1>
            <p style={{ margin: '4px 0 0', fontSize: '1rem', color: '#4b5563' }}>{doc.businessName}</p>
          </header>

          {doc.intro.length > 0 && (
            <p style={{ margin: '0 0 14px', fontSize: '1rem' }}>{doc.intro.join(' ')}</p>
          )}
          {doc.operatingLine && (
            <p style={{ margin: '0 0 26px', fontSize: '1rem' }}>{doc.operatingLine}</p>
          )}

          <h2 style={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 16px', fontFamily: 'system-ui, sans-serif' }}>
            What this job is responsible for
          </h2>

          {doc.areas.length === 0 && (
            /* Empty is a fact, and it is stated rather than left as a blank page. */
            <p style={{ fontSize: '1rem', color: '#6b7280', fontStyle: 'italic', margin: '0 0 24px' }}>
              Nothing has been ticked for this position yet.
            </p>
          )}

          {doc.areas.map((area) => (
            <section className="doc-area" key={area.area} style={{ marginBottom: 22 }}>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, margin: '0 0 8px', color: '#111827' }}>{area.area}</h3>
              <ul style={{ margin: 0, paddingLeft: 22 }}>
                {area.items.map((item, i) => (
                  <li key={i} style={{ fontSize: '1rem', marginBottom: 5 }}>
                    {item.text} — <span style={{ color: '#4b5563' }}>{item.cadence}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {doc.excellence && (
            <section className="doc-excellence" style={{ marginTop: 30, paddingTop: 20, borderTop: '1px solid #d1d5db' }}>
              <h2 style={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 10px', fontFamily: 'system-ui, sans-serif' }}>
                What doing this well looks like here
              </h2>
              {/* The owner's own words, quoted and never rewritten. */}
              <p style={{ margin: 0, fontSize: '1.0625rem', fontStyle: 'italic', color: '#111827' }}>
                “{doc.excellence}”
              </p>
            </section>
          )}

          <footer style={{ marginTop: 34, paddingTop: 12, borderTop: '1px solid #e5e7eb', fontSize: '0.8125rem', color: '#9ca3af', fontFamily: 'system-ui, sans-serif' }}>
            {doc.businessName} · {doc.generatedOn} · {doc.responsibilityCount}{' '}
            {doc.responsibilityCount === 1 ? 'responsibility' : 'responsibilities'}
          </footer>
        </div>
      )}
    </div>
  );
}
