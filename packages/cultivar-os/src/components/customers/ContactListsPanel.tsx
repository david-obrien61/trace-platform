// ============================================================
// ContactListsPanel — the customer's PHONES, EMAILS and ADDRESSES, with Make main and Remove
// (Cultivar OS · ledger #345)
//
// PURPOSE:      CARD 15 failed twice for one reason among others: a kept second number was
//               visible NOWHERE a person would look — every screen showed `customers.phone`, the
//               derived main number only. This panel is where a person looks: customer page →
//               Phones. Each list marks its main entry; each row has "Make main" and "Remove".
//               Remove RETIRES (active=false) — nothing is ever deleted (R-133).
// DEPENDENCIES: contactWriter (readContactLists · makeContactMain · retireContact — the ONE writer,
//               registered in writer-registry.json) · the browser supabase client (RLS: the lists
//               read with `customers:read`, Make main / Remove are UPDATEs gated on
//               `customers:update` by `customer_*_member_update`) · useBusinessContext (`can`, so a
//               reader is not offered a button the database will refuse) · ContactResultList.
// OUTPUTS:      <ContactListsPanel businessId customerId onChanged /> — `onChanged` fires after an
//               action so the page re-reads the derived main phone / email / billing address.
// TRACE:        [TRACE:CONTACT] from the writer (ON by default, STD-003).
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import {
  makeContactMain, readContactLists, retireContact,
  type ContactList, type ContactValueResult, type CustomerContactLists, type ContactListRow,
} from '@trace/shared/business-logic/contactWriter';
import { ContactResultList } from '@trace/shared/components/customers/ContactResultList';

const TITLES: Record<ContactList, string> = { phones: 'Phones', emails: 'Emails', addresses: 'Addresses' };
const EMPTY: Record<ContactList, string> = {
  phones: 'No phone on file.', emails: 'No email on file.', addresses: 'No address on file.',
};

export function ContactListsPanel({ businessId, customerId, onChanged }: {
  businessId: string; customerId: string; onChanged: () => void;
}) {
  const { can } = useBusinessContext();
  const mayChange = can('customers:update');
  const [lists, setLists] = useState<CustomerContactLists | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<ContactValueResult[]>([]);

  const load = useCallback(async () => {
    const out = await readContactLists(supabase, businessId, customerId);
    if (out.ok) { setLists(out.lists); setError(null); }
    else setError(`Contact details could not be read: ${out.error}`);
  }, [businessId, customerId]);
  useEffect(() => { void load(); }, [load]);

  async function act(kind: 'main' | 'remove', list: ContactList, row: ContactListRow) {
    if (kind === 'remove' && !window.confirm(`Remove ${row.value}? It stays in the customer's history and can be added again.`)) return;
    setBusy(row.id);
    let actorUserId: string | null = null;
    try { actorUserId = (await supabase.auth.getSession()).data.session?.user.id ?? null; } catch { /* change log records a null actor */ }
    const input = { businessId, customerId, list, rowId: row.id, actorUserId };
    const out = kind === 'main' ? await makeContactMain(supabase, input) : await retireContact(supabase, input);
    setBusy(null);
    setResults([out.result]);
    await load();
    onChanged();
  }

  if (error) return <div style={box}><p style={{ ...muted, color: '#A32D2D' }}>{error}</p></div>;
  if (!lists) return <div style={box}><p style={muted}>Loading contact details…</p></div>;

  return (
    <div style={{ marginTop: 18 }} data-testid="contact-lists">
      <ContactResultList results={results} title="Last change" />
      {(['phones', 'emails', 'addresses'] as const).map(list => (
        <section key={list} style={{ marginBottom: 12 }} aria-label={TITLES[list]}>
          <p style={sectionTitle}>{TITLES[list]}</p>
          <div style={box}>
            {lists[list].length === 0 && <p style={muted}>{EMPTY[list]}</p>}
            {lists[list].map(row => {
              const kind = list === 'addresses' ? (row as { kind?: string }).kind : null;
              // Only a billing address can be the main one — a shipping site never becomes the
              // billing address (the D-41 redline), so it is not offered "Make main".
              const canBeMain = list !== 'addresses' || kind === 'billing' || kind === 'both';
              return (
                <div key={row.id} style={rowStyle} data-main={row.is_main ? 'yes' : 'no'}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', color: '#111827', wordBreak: 'break-word' }}>
                      {row.value}
                      {row.is_main && <span style={mainTag}>Main</span>}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                      {[row.label, kind === 'shipping' ? 'delivery site' : kind === 'both' ? 'billing + delivery' : null]
                        .filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {mayChange && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {!row.is_main && canBeMain && (
                        <button type="button" style={btn} disabled={busy !== null}
                          onClick={() => { void act('main', list, row); }}>Make main</button>
                      )}
                      <button type="button" style={{ ...btn, color: '#A32D2D' }} disabled={busy !== null}
                        onClick={() => { void act('remove', list, row); }}>Remove</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {!mayChange && <p style={muted}>You can see these details; changing them needs permission to edit customers.</p>}
    </div>
  );
}

const box: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: '4px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };
const muted: React.CSSProperties = { fontSize: '0.8rem', color: '#6b7280', margin: '10px 0' };
const sectionTitle: React.CSSProperties = { margin: '0 0 8px', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4 };
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f3f4f6', minHeight: 48 };
const mainTag: React.CSSProperties = { marginLeft: 8, fontSize: '0.66rem', fontWeight: 700, color: '#27500A', background: '#EAF3DE', borderRadius: 6, padding: '2px 7px' };
const btn: React.CSSProperties = { minHeight: 48, padding: '0 12px', borderRadius: 9, border: '1px solid #d1d5db', background: '#fff', color: '#27500A', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' };
