// ============================================================
// ItemLineEntry — TYPE, PICK, QUANTITY, ENTER, TYPE AGAIN. The counter's door.
//
// PURPOSE:  David, describing how Lauren works in QuickBooks today: *"she starts typing, the
//           inventory filters, she picks, then starts typing another item, picks, again and
//           again."* That is the standard counter pattern and it is what this is.
//
// 🔴 IT OWNS NO SEARCH. Matching is `matchesHaystack` in the shared searchSpec — the SAME rule
//           `/inventory` runs (David's ruling, 2026-09-23: *"inventory already has the filter type
//           function, why not reuse that like we should"*). Ordering and annotation are
//           `rankItemChoices`, pure and tested. This file is the keyboard and the pixels.
//
// 🔴 ONE FETCH, THEN MEMORY. The rows load once for the business (~40 KB for LAWNS's 632 live
//           rows) and every keystroke filters in memory. A round trip per keystroke at a till is
//           the thing that makes people go back to paper.
//
// KEYBOARD, AND NOTHING REQUIRES THE MOUSE:
//           ↓/↑ move · Enter picks (then Enter again commits the quantity) · Esc clears ·
//           after committing, focus returns to the field ready for the next item.
//
// DEPENDENCIES: ../../lib/itemLineEntry (pure) · ../../lib/checkoutSearchSpec · supabase.
// OUTPUTS:  <ItemLineEntry onAdd={(row, qty) => …} />
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { rankItemChoices, type ItemChoice, type ItemRow } from '../../lib/itemLineEntry';
import { CHECKOUT_SEARCH_PLACEHOLDER, CHECKOUT_ITEM_SEARCH } from '../../lib/checkoutSearchSpec';
import { searchedColumns } from '@trace/shared/components/datasheet/searchSpec';

const TRACE_CART = true; // [TRACE:CART] STD-003 — on until OWNER-PROVEN

interface Props {
  businessId: string;
  onAdd: (row: ItemRow, qty: number) => void;
}

// 🔴 THE SELECT IS DERIVED FROM THE SEARCH SPEC (R-170's other half). `searchedColumns` returns
// every column the declared getters read, so a field cannot be searched without being fetched —
// which is the silent half of #384's family: a searched field that was never selected matches
// nothing, exactly as quietly as a field that was never searched.
const SELECT = [...new Set(['id', 'qty', 'sell_price', ...searchedColumns(CHECKOUT_ITEM_SEARCH)])].join(', ');

export function ItemLineEntry({ businessId, onAdd }: Props) {
  const [rows, setRows]   = useState<ItemRow[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [term, setTerm]   = useState('');
  const [cursor, setCursor] = useState(0);
  const [picked, setPicked] = useState<ItemChoice | null>(null);
  const [qty, setQty]     = useState(1);
  const fieldRef = useRef<HTMLInputElement>(null);
  const qtyRef   = useRef<HTMLInputElement>(null);

  // ONE fetch. 🔴 A FAILED READ IS NOT AN EMPTY CATALOGUE — "0 matches" would read as a statement
  // about her stock when nothing was ever read (`searchStockLines`' own header makes this point).
  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('business_inventory').select(SELECT)
        .eq('business_id', businessId).is('retired_at', null).neq('status', 'deleted');
      if (cancelled) return;
      if (error) { setFailed(`Could not read the item list — ${error.message}. This is a failed read, not an empty catalogue.`); return; }
      setRows((data ?? []) as unknown as ItemRow[]);
      if (TRACE_CART) console.log('[TRACE:CART] item entry — catalogue loaded once', { rows: (data ?? []).length });
    })();
    return () => { cancelled = true; };
  }, [businessId]);

  const choices = useMemo(() => rankItemChoices(rows ?? [], term), [rows, term]);
  useEffect(() => { setCursor(0); }, [term]);

  function commit(choice: ItemChoice, n: number) {
    if (choice.unsellable) return;                  // the list shows it; it still cannot be sold
    if (TRACE_CART) console.log('[TRACE:CART] item entry — line added', { name: choice.row.name, size: choice.row.size, qty: n });
    onAdd(choice.row, n);
    setPicked(null); setTerm(''); setQty(1);
    fieldRef.current?.focus();                      // ready for the next item, no mouse
  }

  function onFieldKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, choices.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === 'Escape') { setTerm(''); setPicked(null); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const c = choices[cursor];
      if (!c || c.unsellable) return;
      setPicked(c); setQty(1);
      setTimeout(() => qtyRef.current?.select(), 0);
    }
  }

  if (failed) return <div style={S.err}>{failed}</div>;

  return (
    <div style={S.wrap}>
      <input
        ref={fieldRef} autoFocus value={term} onChange={e => setTerm(e.target.value)} onKeyDown={onFieldKey}
        placeholder={rows === null ? 'Loading items…' : CHECKOUT_SEARCH_PLACEHOLDER}
        disabled={rows === null} style={S.field} aria-label={CHECKOUT_SEARCH_PLACEHOLDER}
      />

      {picked && (
        <div style={S.qtyRow}>
          <span style={S.qtyName}>{picked.row.name}{picked.row.size ? ` · ${picked.row.size}` : ''}</span>
          <input
            ref={qtyRef} type="number" min={1} value={qty} style={S.qty}
            onChange={e => setQty(Math.max(1, Number(e.target.value) || 1))}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(picked, qty); } if (e.key === 'Escape') { setPicked(null); fieldRef.current?.focus(); } }}
            aria-label="Quantity — press Enter to add"
          />
          <button style={S.addBtn} onClick={() => commit(picked, qty)}>Add</button>
        </div>
      )}

      {!picked && term.trim() !== '' && (
        <ul style={S.list} role="listbox">
          {choices.length === 0 && <li style={S.none}>Nothing matches “{term}”. Try fewer words, or the item code.</li>}
          {choices.map((c, i) => (
            <li
              key={c.row.id} role="option" aria-selected={i === cursor} aria-disabled={!!c.unsellable}
              onMouseEnter={() => setCursor(i)}
              onClick={() => { if (!c.unsellable) { setPicked(c); setQty(1); setTimeout(() => qtyRef.current?.select(), 0); } }}
              style={{ ...S.row, ...(i === cursor ? S.rowOn : null), ...(c.unsellable ? S.rowDim : null) }}
            >
              <span style={S.rowName}>
                {c.row.name}
                {/* 🔴 THE SIZE IS THE DISAMBIGUATOR — 402 of 632 live LAWNS rows share a name and
                    differ only here, so it is never hidden behind a truncation. */}
                {c.row.size ? <span style={S.size}> · {c.row.size}</span> : null}
                {/* 🔴 …AND WHEN THERE IS NO SIZE TO SHOW, SAY SO. 107 rows carry none; inside a
                    same-name group that means typing MORE cannot separate them, and an
                    indistinguishable list with no explanation is worse than a short one. */}
                {c.indistinguishable && <span style={S.warn}> · no size recorded — can’t be told apart by typing</span>}
              </span>
              <span style={S.rowMeta}>
                {c.unsellable
                  ? <span style={S.bad}>{c.unsellable}</span>
                  : <>{Number(c.row.qty)} on hand · ${Number(c.row.sell_price).toFixed(2)}</>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap:    { position: 'relative', marginBottom: 14 },
  field:   { width: '100%', minHeight: 48, border: '1.5px solid #27500A', borderRadius: 10, padding: '0.6rem 0.85rem', fontSize: '1rem', boxSizing: 'border-box' },
  list:    { listStyle: 'none', margin: '6px 0 0', padding: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, maxHeight: 320, overflowY: 'auto', boxShadow: '0 4px 14px rgba(0,0,0,0.08)' },
  row:     { display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', padding: '10px 12px', minHeight: 48, boxSizing: 'border-box', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' },
  rowOn:   { background: '#f0f7ea' },
  rowDim:  { cursor: 'not-allowed', background: '#fafafa' },
  rowName: { fontSize: '0.9375rem', color: '#1f2937', minWidth: 0 },
  size:    { color: '#27500A', fontWeight: 600 },
  warn:    { color: '#b45309', fontSize: '0.8125rem' },
  rowMeta: { fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' },
  bad:     { color: '#A32D2D', fontWeight: 600 },
  none:    { padding: '12px', fontSize: '0.875rem', color: '#6b7280' },
  qtyRow:  { display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, padding: '10px 12px', background: '#f0f7ea', borderRadius: 10 },
  qtyName: { flex: 1, minWidth: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#1a2e0a' },
  qty:     { width: 84, minHeight: 48, border: '1.5px solid #27500A', borderRadius: 8, padding: '0.4rem 0.6rem', fontSize: '1rem', boxSizing: 'border-box' },
  addBtn:  { minHeight: 48, padding: '0 1.1rem', background: '#27500A', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
  err:     { margin: '0 0 14px', padding: '10px 14px', background: '#fff3f3', border: '1.5px solid #A32D2D', borderRadius: 8, fontSize: '0.875rem', color: '#7f1d1d' },
};
