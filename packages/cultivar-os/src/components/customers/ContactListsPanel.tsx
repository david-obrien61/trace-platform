// ============================================================
// ContactListsPanel — the customer's PHONES, EMAILS and ADDRESSES: add, edit, make main, remove
// (Cultivar OS · ledger #345, extended by #349)
//
// PURPOSE:      CARD 15 failed twice for one reason among others: a kept second number was
//               visible NOWHERE a person would look. This panel is where a person looks — customer
//               page → Phones — and, since #349, where they can CHANGE what is there. David,
//               2026-09-17: *"every screen needs the create/edit/update pieces."* Before that a typo
//               could only be Removed and retyped, which threw the row's history away with it.
//               Each row has **Edit** (value and label; for an address every field) and **Remove**
//               (retire — nothing is deleted, R-133); each list has **Add**; a row that is not the
//               main one has **Make main**.
// DEPENDENCIES: contactWriter (readContactLists · addContactRow · editContactRow · makeContactMain ·
//               retireContact — the ONE writer, registered in writer-registry.json) · the browser
//               supabase client (RLS: reading needs `customers:read`; Add is an INSERT
//               (`customers:create`) and Edit / Make main / Remove are UPDATEs (`customers:update`)) ·
//               useBusinessContext (`can`, so a reader is not offered a button the database refuses) ·
//               ContactResultList (every outcome in one voice, NOT SAVED in red).
// OUTPUTS:      <ContactListsPanel businessId customerId onChanged /> — `onChanged` fires after every
//               action so the page re-reads the derived main phone / email / billing address.
// TRACE:        [TRACE:CONTACT] from the writer (ON by default, STD-003).
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import {
  addContactRow, editContactRow, makeContactMain, readContactLists, retireContact,
  type ContactAddressPatch, type ContactList, type ContactValueResult,
  type CustomerContactLists, type ContactListRow,
} from '@trace/shared/business-logic/contactWriter';
import { ContactResultList } from '@trace/shared/components/customers/ContactResultList';

const TITLES: Record<ContactList, string> = { phones: 'Phones', emails: 'Emails', addresses: 'Addresses' };
const EMPTY: Record<ContactList, string> = {
  phones: 'No phone on file.', emails: 'No email on file.', addresses: 'No address on file.',
};
const ADD_LABEL: Record<ContactList, string> = {
  phones: 'Add a phone', emails: 'Add an email', addresses: 'Add an address',
};

/** What an open form is editing: a row of a list, or a new row for a list. */
type Draft =
  | { kind: 'edit'; list: ContactList; row: ContactListRow & { kind?: string }; value: string; label: string; address: ContactAddressPatch }
  | { kind: 'add'; list: ContactList; value: string; label: string; address: ContactAddressPatch };

const addressOf = (row: { kind?: string; label: string | null }, parts: Record<string, string>): ContactAddressPatch => ({
  label: row.label ?? '', kind: row.kind ?? 'shipping',
  line1: parts.line1 ?? '', line2: parts.line2 ?? '', city: parts.city ?? '', state: parts.state ?? '', zip: parts.zip ?? '',
});

export function ContactListsPanel({ businessId, customerId, onChanged }: {
  businessId: string; customerId: string; onChanged: () => void;
}) {
  const { can } = useBusinessContext();
  const mayChange = can('customers:update');
  const mayAdd = can('customers:create');
  const [lists, setLists] = useState<CustomerContactLists | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ContactValueResult[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    const out = await readContactLists(supabase, businessId, customerId);
    if (out.ok) { setLists(out.lists); setError(null); }
    else setError(`Contact details could not be read: ${out.error}`);
  }, [businessId, customerId]);
  useEffect(() => { void load(); }, [load]);

  async function actor(): Promise<string | null> {
    try { return (await supabase.auth.getSession()).data.session?.user.id ?? null; } catch { return null; }
  }

  async function run(fn: (actorUserId: string | null) => Promise<{ result: ContactValueResult }>) {
    setBusy(true);
    const out = await fn(await actor());
    setBusy(false);
    setResults([out.result]);
    setDraft(null);
    await load();
    onChanged();
  }

  const act = (kind: 'main' | 'remove', list: ContactList, row: ContactListRow) => {
    if (kind === 'remove' && !window.confirm(`Remove ${row.value}? It stays in the customer's history and can be added again.`)) return;
    void run(async (actorUserId) => {
      const input = { businessId, customerId, list, rowId: row.id, actorUserId };
      return kind === 'main' ? makeContactMain(supabase, input) : retireContact(supabase, input);
    });
  };

  const save = () => {
    if (!draft) return;
    const patch = draft.list === 'addresses'
      ? draft.address
      : { value: draft.value, label: draft.label.trim() || undefined };
    void run(async (actorUserId) => (draft.kind === 'edit'
      ? editContactRow(supabase, { businessId, customerId, list: draft.list, rowId: draft.row.id, actorUserId, patch })
      : addContactRow(supabase, { businessId, customerId, list: draft.list, actorUserId, patch })));
  };

  if (error) return <div style={box}><p style={{ ...muted, color: '#A32D2D' }}>{error}</p></div>;
  if (!lists) return <div style={box}><p style={muted}>Loading contact details…</p></div>;

  const form = (d: Draft) => (
    <div style={formBox} data-testid={`contact-form-${d.kind}-${d.list}`}>
      {d.list === 'addresses' ? (
        <>
          <input style={input} value={d.address.label ?? ''} placeholder="Name it — Billing, Job site…"
            onChange={e => setDraft({ ...d, address: { ...d.address, label: e.target.value } })} />
          <select style={input} value={d.address.kind ?? 'shipping'}
            onChange={e => setDraft({ ...d, address: { ...d.address, kind: e.target.value } })}>
            <option value="billing">Billing address (invoices)</option>
            <option value="shipping">Delivery site</option>
            <option value="both">Both</option>
          </select>
          <input style={input} value={d.address.line1 ?? ''} placeholder="Street" onChange={e => setDraft({ ...d, address: { ...d.address, line1: e.target.value } })} />
          <input style={input} value={d.address.line2 ?? ''} placeholder="Unit, suite (optional)" onChange={e => setDraft({ ...d, address: { ...d.address, line2: e.target.value } })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...input, flex: 2 }} value={d.address.city ?? ''} placeholder="City" onChange={e => setDraft({ ...d, address: { ...d.address, city: e.target.value } })} />
            <input style={{ ...input, flex: 1 }} value={d.address.state ?? ''} placeholder="TX" onChange={e => setDraft({ ...d, address: { ...d.address, state: e.target.value.toUpperCase().slice(0, 2) } })} />
            <input style={{ ...input, flex: 1 }} value={d.address.zip ?? ''} placeholder="ZIP" onChange={e => setDraft({ ...d, address: { ...d.address, zip: e.target.value.replace(/\D/g, '').slice(0, 5) } })} />
          </div>
        </>
      ) : (
        <>
          <input style={input} value={d.value} inputMode={d.list === 'phones' ? 'tel' : 'email'}
            placeholder={d.list === 'phones' ? '(512) 555-0100' : 'name@example.com'}
            onChange={e => setDraft({ ...d, value: e.target.value })} />
          <input style={input} value={d.label} placeholder="What kind — main, mobile, office… (optional)"
            onChange={e => setDraft({ ...d, label: e.target.value })} />
        </>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" style={{ ...btn, background: '#27500A', color: '#fff', border: 'none', flex: 1 }} disabled={busy} onClick={save}>
          {busy ? 'Saving…' : d.kind === 'edit' ? 'Save changes' : 'Save'}
        </button>
        <button type="button" style={btn} disabled={busy} onClick={() => setDraft(null)}>Cancel</button>
      </div>
    </div>
  );

  return (
    <div style={{ marginTop: 18 }} data-testid="contact-lists">
      <ContactResultList results={results} title="Last change" />
      {(['phones', 'emails', 'addresses'] as const).map(list => (
        <section key={list} style={{ marginBottom: 12 }} aria-label={TITLES[list]}>
          <p style={sectionTitle}>{TITLES[list]}</p>
          <div style={box}>
            {lists[list].length === 0 && <p style={muted}>{EMPTY[list]}</p>}
            {lists[list].map(row => {
              const kind = list === 'addresses' ? (row as { kind?: string }).kind : undefined;
              // Only a billing address can be the main one — a delivery site never becomes the
              // billing address (the D-41 redline), so it is not offered "Make main".
              const canBeMain = list !== 'addresses' || kind === 'billing' || kind === 'both';
              const editing = draft?.kind === 'edit' && draft.list === list && draft.row.id === row.id;
              return (
                <div key={row.id} data-main={row.is_main ? 'yes' : 'no'}>
                  <div style={rowStyle}>
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
                    {mayChange && !editing && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button type="button" style={btn} disabled={busy}
                          onClick={() => setDraft({
                            kind: 'edit', list, row: row as ContactListRow & { kind?: string },
                            value: row.value, label: row.label ?? '',
                            address: addressOf(row as { kind?: string; label: string | null }, addressParts(row.value)),
                          })}>Edit</button>
                        {!row.is_main && canBeMain && (
                          <button type="button" style={btn} disabled={busy} onClick={() => act('main', list, row)}>Make main</button>
                        )}
                        <button type="button" style={{ ...btn, color: '#A32D2D' }} disabled={busy}
                          onClick={() => act('remove', list, row)}>Remove</button>
                      </div>
                    )}
                  </div>
                  {editing && draft && form(draft)}
                </div>
              );
            })}
            {mayAdd && (draft?.kind === 'add' && draft.list === list
              ? form(draft)
              : (
                <div style={{ padding: '10px 0' }}>
                  <button type="button" style={btn} disabled={busy}
                    onClick={() => setDraft({ kind: 'add', list, value: '', label: '', address: { label: '', kind: list === 'addresses' ? 'shipping' : undefined, line1: '', line2: '', city: '', state: '', zip: '' } })}>
                    + {ADD_LABEL[list]}
                  </button>
                </div>
              ))}
          </div>
        </section>
      ))}
      {!mayChange && <p style={muted}>You can see these details; changing them needs permission to edit customers.</p>}
    </div>
  );
}

/**
 * The Addresses list shows one line ("9 Site Rd, Austin 78701"), and the Edit form needs the fields
 * back. Splitting the line is a GUESS, so the form starts from it and the person confirms — the same
 * shape the checkout form uses. Street first, ZIP last, city and state from the tail.
 */
function addressParts(line: string): Record<string, string> {
  const bits = line.split(',').map(s => s.trim()).filter(Boolean);
  const tail = bits.length > 1 ? bits[bits.length - 1] : '';
  const zip = (tail.match(/\b\d{5}\b/) ?? [''])[0];
  const state = (tail.match(/\b[A-Z]{2}\b/) ?? [''])[0];
  const city = bits.length > 2 ? bits[bits.length - 2] : tail.replace(zip, '').replace(state, '').replace(/[, ]+$/, '').trim();
  return { line1: bits[0] ?? '', line2: bits.length > 3 ? bits[1] : '', city, state, zip };
}

const box: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: '4px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };
const muted: React.CSSProperties = { fontSize: '0.8rem', color: '#6b7280', margin: '10px 0' };
const sectionTitle: React.CSSProperties = { margin: '0 0 8px', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4 };
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f3f4f6', minHeight: 48 };
const mainTag: React.CSSProperties = { marginLeft: 8, fontSize: '0.66rem', fontWeight: 700, color: '#27500A', background: '#EAF3DE', borderRadius: 6, padding: '2px 7px' };
const btn: React.CSSProperties = { minHeight: 48, padding: '0 12px', borderRadius: 9, border: '1px solid #d1d5db', background: '#fff', color: '#27500A', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' };
const formBox: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 0 14px' };
const input: React.CSSProperties = { minHeight: 48, padding: '0 12px', borderRadius: 9, border: '1px solid #d1d5db', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' };
