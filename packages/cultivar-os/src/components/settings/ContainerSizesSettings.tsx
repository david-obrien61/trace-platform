// ============================================================
// ContainerSizesSettings — Settings → Container sizes. The nursery's own ladder, edited.
//
// PURPOSE:      One place where a size is added, named, given its volume, its handling time and
//               its install T-posts, put in order, and retired. David, 2026-09-15: *"A rung is a row.
//               Adding a row makes the size available everywhere — the picker offers it, the resolver
//               recognises it, the BOM can attach to it."* Before this screen, adding a rung was SQL.
//
// STANDARD:     the settings list-editor (ordered list; add / inline edit / move up-down / archive),
//               as in any admin console's ordered-options editor. DEVIATION, deliberate: NO delete —
//               "archive" is the only removal, because old lots and orders still name a retired size
//               (R-133). Move up/down buttons rather than drag handles: 48px targets work on a phone
//               and in a print-width window, and a drag cannot be done with a keyboard.
//
// 🔴 WHO MAY EDIT — the database decides. Insert and update are gated on `settings:update` by the
//   existing `container_ladder` policies; no permission is minted. Without it the list renders
//   read-only with the reason said, never a dead Save button (§1.6 item 5).
//
// 🔴 A NEW SIZE'S T-POSTS ARE COPIED AND SAY SO — "copied — confirm" beside the figure until the size
//   is saved (David, 2026-09-16). See `containerLadderDraft.ts`.
//
// 🔴 NOTHING ALREADY WRITTEN MOVES. The note under the heading says it in words: a change here
//   affects the next load list and the next plan, never an order, a plan or a cost already made.
//
// DEPENDENCIES: ../../lib/containerLadderRead · ../../lib/containerLadderWrite ·
//               ../../lib/containerLadderDraft · @trace/shared/inventory (validateLadder).
// OUTPUTS:      default export ContainerSizesSettings.
// INSTRUMENTATION (STD-003): [TRACE:LADDER] — ON.
// STORY:        user_stories.md → *The growing ladder — potted, waiting, ready, and up a size*.
// ============================================================
import React, { useCallback, useEffect, useState } from 'react';
import { validateLadder, type Rung } from '@trace/shared/inventory';
import { loadContainerLadder, type LadderRead } from '../../lib/containerLadderRead';
import { addRung, updateRung, setRungActive, moveRung } from '../../lib/containerLadderWrite';
import {
  COPIED_POSTS_NOTE, draftForNewRung, draftFromRung, rungDraftProblems, type RungDraft,
} from '../../lib/containerLadderDraft';

const GREEN = '#27500A';
const RED = '#A32D2D';
const AMBER = '#8a6d00';

interface Props { businessId: string; canWrite: boolean }

const btn = (primary: boolean): React.CSSProperties => ({
  minHeight: 48, minWidth: 48, padding: '0 14px', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer',
  border: primary ? 'none' : `1.5px solid ${GREEN}`, background: primary ? GREEN : '#fff', color: primary ? '#fff' : GREEN,
});
const input: React.CSSProperties = { minHeight: 44, fontSize: 16, padding: '4px 8px', border: '1px solid #bbb', borderRadius: 6 };

function Field({ label, children, note }: { label: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, flex: '1 1 220px' }}>
      <span style={{ fontWeight: 700 }}>{label}</span>
      {children}
      {note ? <span style={{ fontSize: 12, color: '#666', lineHeight: 1.4 }}>{note}</span> : null}
    </label>
  );
}

function RungForm({ draft, setDraft, problems, onSave, onCancel, saving, saveLabel }: {
  draft: RungDraft; setDraft: (d: RungDraft) => void; problems: string[];
  onSave: () => void; onCancel: () => void; saving: boolean; saveLabel: string;
}) {
  const put = (k: keyof RungDraft, v: string) => setDraft({ ...draft, [k]: v });
  return (
    <div style={{ border: '1px solid #cfe0bd', borderRadius: 8, padding: 12, background: '#f7fbf2', margin: '8px 0' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <Field label="Name" note="What people call it — shown everywhere exactly as typed.">
          <input style={input} value={draft.label} onChange={(e) => put('label', e.target.value)} />
        </Field>
        <Field label="Other names" note={'Spellings that mean this size, separated by commas — e.g. "#3/5, 3/5 Gallon". A plain "15" or "15 gal" is recognised without listing it.'}>
          <input style={input} value={draft.aliases} onChange={(e) => put('aliases', e.target.value)} />
        </Field>
        <Field label="Container volume (gallons)" note="Used for mix and costing. Leave blank for a size with no real volume, like a slip.">
          <input style={input} type="number" step="any" value={draft.volumeGallons} onChange={(e) => put('volumeGallons', e.target.value)} />
        </Field>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
        <Field label="Minutes to handle one pot" note="Blank uses the yard-wide rate from Operations.">
          <input style={input} type="number" step="any" value={draft.handlingMinutes} onChange={(e) => put('handlingMinutes', e.target.value)} />
        </Field>
        <Field label="Where that time came from">
          <input style={input} value={draft.handlingBecause} onChange={(e) => put('handlingBecause', e.target.value)} />
        </Field>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
        <Field
          label="T-posts to stake one tree at install"
          note={draft.postsCopiedFrom
            ? <strong style={{ color: AMBER }}>{COPIED_POSTS_NOTE} — copied from {draft.postsCopiedFrom}. Saving confirms it.</strong>
            : undefined}
        >
          <input style={{ ...input, borderColor: draft.postsCopiedFrom ? AMBER : '#bbb' }} type="number" min={0} step={1}
            value={draft.installTPostsPerTree}
            onChange={(e) => setDraft({ ...draft, installTPostsPerTree: e.target.value, postsCopiedFrom: null,
              installTPostsBecause: draft.installTPostsBecause.startsWith(COPIED_POSTS_NOTE) ? '' : draft.installTPostsBecause })} />
        </Field>
        <Field label="Where the T-post figure came from">
          <input style={input} value={draft.installTPostsBecause}
            onChange={(e) => setDraft({ ...draft, installTPostsBecause: e.target.value, postsCopiedFrom: null })} />
        </Field>
      </div>
      {problems.length > 0 && (
        <ul style={{ color: RED, fontSize: 13, margin: '10px 0 0', paddingLeft: 18 }}>
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" style={btn(true)} disabled={saving || problems.length > 0} onClick={onSave}>
          {saving ? 'Saving…' : saveLabel}
        </button>
        <button type="button" style={btn(false)} disabled={saving} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function ContainerSizesSettings({ businessId, canWrite }: Props) {
  const [read, setRead] = useState<LadderRead | null>(null);
  const [editing, setEditing] = useState<string | null>(null);   // label being edited
  const [draft, setDraft] = useState<RungDraft | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  const reload = useCallback(async () => {
    const r = await loadContainerLadder(businessId);
    setRead(r);
  }, [businessId]);
  useEffect(() => { void reload(); }, [reload]);

  const ladder = read?.phase === 'loaded' ? read.rungs : [];
  const ordered = [...ladder].sort((a, b) => a.sortOrder - b.sortOrder);
  const conflicts = read?.phase === 'loaded' ? validateLadder(ladder) : [];

  const run = async (p: Promise<{ ok: boolean; message: string }>) => {
    setSaving(true);
    const out = await p;
    setSaving(false);
    setNotice(out);
    if (out.ok) { setEditing(null); setAdding(false); setDraft(null); }
    await reload();
  };

  const problems = draft ? rungDraftProblems(draft, ladder, adding ? null : editing) : [];

  return (
    <section style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 20, marginBottom: 20 }}>
      <h2 style={{ color: GREEN, marginTop: 0 }}>Container sizes</h2>
      <p style={{ color: '#444', lineHeight: 1.5, maxWidth: 760, marginTop: 0 }}>
        The sizes this nursery grows and sells, smallest first. <strong>A size added here is offered everywhere</strong> —
        the uppot plan, the count screen and the delivery load list. Sizes are never deleted: retiring one stops it being
        offered, and every old lot and order that names it still reads it. A change here affects the next load list and the
        next plan — never an order, a plan or a cost already made.
      </p>
      {!canWrite && (
        <p style={{ color: AMBER, fontSize: 13 }}>
          You can see these sizes but not change them — that needs permission to edit settings.
        </p>
      )}

      {notice && (
        <div role="status" style={{ border: `1.5px solid ${notice.ok ? GREEN : RED}`, color: notice.ok ? GREEN : RED, borderRadius: 8, padding: '10px 12px', margin: '0 0 12px', fontSize: 14 }}>
          {notice.message}
        </div>
      )}

      {read === null && <p>Loading the sizes…</p>}
      {read?.phase === 'failed' && (
        <div style={{ border: `2px solid ${RED}`, borderRadius: 8, padding: 12, color: RED }}>
          <strong>Could not read the sizes.</strong> {read.message}
          <div><button type="button" style={{ ...btn(false), marginTop: 8 }} onClick={() => void reload()}>Try again</button></div>
        </div>
      )}
      {conflicts.length > 0 && (
        <div style={{ border: `2px solid ${RED}`, borderRadius: 8, padding: 12, color: RED, marginBottom: 12 }}>
          <strong>These sizes contradict each other — fix them before relying on any count or load list:</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{conflicts.map((c) => <li key={c.detail}>{c.detail}</li>)}</ul>
        </div>
      )}
      {read?.phase === 'loaded' && ordered.length === 0 && (
        <p style={{ fontSize: 15 }}>
          No sizes are set up yet. Until there are, the load list cannot stake or mix any tree and the count screen offers no sizes.
        </p>
      )}

      {read?.phase === 'loaded' && ordered.map((r: Rung, i) => {
        const isEditing = editing === r.label && draft && !adding;
        return (
          <div key={r.label} style={{ borderBottom: '1px solid #eee', padding: '10px 0', opacity: r.active ? 1 : 0.6 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 240px' }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  {r.label}{!r.active && <span style={{ color: AMBER, fontWeight: 700 }}> · retired</span>}
                </div>
                <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>
                  {r.aliases.length ? <>Also: {r.aliases.join(', ')} · </> : null}
                  {r.volumeGallons == null ? 'No volume set' : `${r.volumeGallons} gal`}
                  {' · '}{r.handlingMinutes == null ? 'yard-wide handling rate' : `${r.handlingMinutes} min a pot`} ({r.handlingBecause})
                  {' · '}<strong>{r.installTPostsPerTree} T-post{r.installTPostsPerTree === 1 ? '' : 's'}</strong> at install ({r.installTPostsBecause})
                </div>
              </div>
              {canWrite && !isEditing && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" aria-label={`Move ${r.label} up`} style={btn(false)} disabled={saving || i === 0}
                    onClick={() => void run(moveRung(businessId, ladder, r, -1))}>↑</button>
                  <button type="button" aria-label={`Move ${r.label} down`} style={btn(false)} disabled={saving || i === ordered.length - 1}
                    onClick={() => void run(moveRung(businessId, ladder, r, 1))}>↓</button>
                  <button type="button" style={btn(false)} disabled={saving}
                    onClick={() => { setAdding(false); setEditing(r.label); setDraft(draftFromRung(r)); setNotice(null); }}>Edit</button>
                  <button type="button" style={btn(false)} disabled={saving}
                    onClick={() => void run(setRungActive(businessId, r, !r.active))}>{r.active ? 'Retire' : 'Bring back'}</button>
                </div>
              )}
            </div>
            {isEditing && draft && (
              <RungForm draft={draft} setDraft={setDraft} problems={problems} saving={saving} saveLabel="Save size"
                onSave={() => void run(updateRung(businessId, r, draft))}
                onCancel={() => { setEditing(null); setDraft(null); }} />
            )}
          </div>
        );
      })}

      {canWrite && read?.phase === 'loaded' && (
        adding && draft ? (
          <RungForm draft={draft} setDraft={setDraft} problems={problems} saving={saving} saveLabel="Add size"
            onSave={() => void run(addRung(businessId, ladder, draft))}
            onCancel={() => { setAdding(false); setDraft(null); }} />
        ) : (
          <button type="button" style={{ ...btn(true), marginTop: 12 }} disabled={saving}
            onClick={() => { setEditing(null); setAdding(true); setDraft(draftForNewRung(ladder)); setNotice(null); }}>
            + Add a size
          </button>
        )
      )}
    </section>
  );
}
