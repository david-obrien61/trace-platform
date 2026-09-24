// ============================================================
// RungDateSheet — WHEN WAS THIS BLOCK POTTED, AND WHO SAID SO
//
// PURPOSE:      One block's potting date: the current answer, how it became the answer, and a form
//               to add a new one. David, 2026-09-23: each entry or edit ADDS A ROW; nothing is
//               overwritten; current is the latest.
// DEPENDENCIES: @trace/shared/production (the writer + the sort) · ../lib/supabase.
// OUTPUTS:      <RungDateSheet> (default).
// ============================================================
import { useCallback, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  currentRungDate, rungDateHistory, recordRungDate, rungDateProblems, readinessOf,
  type RungDateRow, type Readiness,
} from '@trace/shared/production';
import { sheetStyles as SS } from '@trace/shared/components/datasheet/DataSheet';

const GREEN = '#27500A';
const RED = '#A32D2D';

interface Props {
  businessId: string;
  lot: { id: string; name: string; size: string | null; unitValue: number | null };
  rows: RungDateRow[];
  rung: { label: string; growMonths: number | null; sellability: 'sold' | 'rarely_sold' | 'never_sold' } | null;
  canWrite: boolean;
  onClose: () => void;
  onRecorded: () => void;
}

/** The one place the five readiness states become words. */
function readinessLine(r: Readiness): { text: string; colour: string } {
  switch (r.state) {
    case 'sellable':  return { text: `Sellable — has been since ${r.since}`, colour: GREEN };
    case 'growing':   return { text: `Growing on — sellable from ${r.sellableFrom}`, colour: '#444' };
    case 'not-sold':  return { text: 'Not sold at this size — a production size', colour: '#666' };
    case 'no-date':   return { text: 'No potting date recorded, so there is no sellable date', colour: RED };
    case 'no-grow':   return { text: `Nobody has set GROW on the ${r.rungLabel} rung, so there is no sellable date`, colour: RED };
  }
}

export default function RungDateSheet({ businessId, lot, rows, rung, canWrite, onClose, onRecorded }: Props) {
  const [enteredOn, setEnteredOn] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const current = useMemo(() => currentRungDate(rows), [rows]);
  const history = useMemo(() => rungDateHistory(rows), [rows]);
  const today = new Date().toISOString().slice(0, 10);
  const readiness = readinessOf(
    current?.entered_on ?? null,
    rung?.growMonths ?? null,
    rung?.sellability ?? 'sold',
    rung?.label ?? (lot.size ?? 'this size'),
    today,
  );
  const line = readinessLine(readiness);
  const problems = enteredOn ? rungDateProblems(enteredOn, today) : [];

  const save = useCallback(async () => {
    setSaving(true);
    const out = await recordRungDate(supabase as never, {
      businessId, inventoryId: lot.id, enteredOn, unitValue: lot.unitValue, note,
    });
    setSaving(false);
    setNotice(out.message);
    if (out.ok) { setEnteredOn(''); setNote(''); onRecorded(); }
  }, [businessId, lot.id, lot.unitValue, enteredOn, note, onRecorded]);

  return (
    <div style={SS.modal} onClick={onClose}>
      <div style={{ ...SS.sheet, padding: 24, overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 4px', color: GREEN, fontSize: 18 }}>{lot.name}</h2>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>{lot.size ?? 'no size recorded'}</div>

        <div style={{ background: '#EAF3DE', borderRadius: 6, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#444' }}>
            Potted on <strong>{current ? current.entered_on : 'not recorded'}</strong>
          </div>
          <div style={{ fontSize: 13, color: line.colour, marginTop: 4 }}>{line.text}</div>
        </div>

        {canWrite ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
              {current ? 'Correct the date' : 'Record when it was potted'}
            </div>
            {/* 🔴 THE WORD IS "ADDS", NOT "CHANGES", AND THE COPY SAYS SO. Nothing is overwritten —
                a correction is a new entry and the old one stays visible below. A form that implied
                otherwise would make people hesitate to correct a wrong date. */}
            <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
              This <strong>adds an entry</strong>. The earlier ones are kept and stay visible below; the newest is the one everything uses.
            </div>
            <input type="date" max={today} value={enteredOn} onChange={(e) => setEnteredOn(e.target.value)}
              style={{ padding: 8, border: '1px solid #ccc', borderRadius: 4, marginRight: 8, minHeight: 40 }} />
            <input placeholder="Why — e.g. Joel: it was the week after" value={note} onChange={(e) => setNote(e.target.value)}
              style={{ padding: 8, border: '1px solid #ccc', borderRadius: 4, width: '55%', minHeight: 40 }} />
            {problems.map((p) => <div key={p} style={{ color: RED, fontSize: 12, marginTop: 6 }}>{p}</div>)}
            <div style={{ marginTop: 10 }}>
              <button onClick={() => void save()} disabled={saving || !enteredOn || problems.length > 0}
                style={{ background: GREEN, color: '#fff', border: 0, borderRadius: 4, padding: '10px 16px', minHeight: 48, cursor: 'pointer' }}>
                {saving ? 'Saving…' : 'Add this entry'}
              </button>
            </div>
            {notice && <div style={{ fontSize: 13, marginTop: 8, color: notice.startsWith('Recorded') ? GREEN : RED }}>{notice}</div>}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
            You can see this date; changing it needs permission to update inventory.
          </div>
        )}

        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Every entry, newest first</div>
        {history.length === 0 ? (
          <div style={{ fontSize: 13, color: '#666' }}>Nobody has recorded a potting date for this block yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {history.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '6px 4px', fontWeight: i === 0 ? 700 : 400 }}>
                    {r.entered_on}{i === 0 && <span style={{ color: GREEN, fontSize: 11 }}> — current</span>}
                  </td>
                  <td style={{ padding: '6px 4px', color: '#666' }}>{r.note ?? ''}</td>
                  <td style={{ padding: '6px 4px', color: '#888', fontSize: 11 }}>
                    recorded {String(r.recorded_at).slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: 16 }}>
          <button onClick={onClose} style={{ border: '1px solid #ccc', background: '#fff', borderRadius: 4, padding: '10px 16px', minHeight: 48, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  );
}
