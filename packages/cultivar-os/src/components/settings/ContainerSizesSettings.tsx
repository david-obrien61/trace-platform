// ============================================================
// ContainerSizesSettings — Settings → Container sizes. The nursery's own ladder, edited.
//
// PURPOSE:      One place where a size is added, named, given its volume, its handling time and
//               its install T-posts and its trunk caliper (ledger #356), put in order, and retired. David, 2026-09-15: *"A rung is a row.
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
import { CALIPER_STANDARD, caliperText, standardCaliperHeightInches, validateLadder, type Rung } from '@trace/shared/inventory';
import { loadContainerLadder, type LadderRead } from '../../lib/containerLadderRead';
import { addRung, updateRung, setRungActive, moveRung } from '../../lib/containerLadderWrite';
import {
  COPIED_POSTS_NOTE, draftForNewRung, draftFromRung, rungDraftProblems, SELLABILITY_OPTIONS,
  type RungDraft,
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

/**
 * 🔴 LAUREN'S OWN PRICE SHEET, SHOWN BESIDE THE RUNG — David's ruling (b), 2026-09-23:
 * *"SEED FROM WHAT THEY ACTUALLY BILL … with Lauren's sheet shown BESIDE each rung and the gap
 * named, for her to confirm or change."*
 *
 * ⚠️ THIS IS A TENANT LITERAL IN SHARED-LOOKING CODE AND IT IS DELIBERATE, SCOPED AND FILED.
 * It is a REFERENCE figure for one person to compare against — not a price, not a default, and
 * nothing reads it to charge anybody. It is keyed by RUNG LABEL, so it shows for a tenant whose
 * ladder happens to use the same labels and is simply absent otherwise. `ContainerSizesSettings`
 * already lives in `packages/cultivar-os`, not in `shared`, so no AC-1 boundary is crossed — but
 * it IS a hardcoded tenant value and it belongs on the hardcoded register (tech-debt #363) with
 * its removal condition stated: it comes out the moment Lauren has confirmed or changed each rung,
 * because by then the comparison has done its job and a stale sheet is worse than none.
 */
const SHEET_PRICE: Record<string, number> = {
  '15 gal': 150, '30 gal': 300, '45 gal': 450, '65 gal': 600, '95/100': 900,
};

/** Names the gap between what is typed and what Lauren's sheet says — in words, with a direction. */
function SheetComparison({ label, typed }: { label: string; typed: string }) {
  const sheet = SHEET_PRICE[label];
  if (sheet === undefined) return null;
  const n = Number(typed);
  const has = typed.trim() !== '' && Number.isFinite(n);
  if (!has) {
    return <span style={{ display: 'block', marginTop: 2 }}>Lauren&apos;s 2026-09-23 sheet says <strong>${sheet}</strong> for this size.</span>;
  }
  const gap = Math.round((n - sheet) * 100) / 100;
  if (gap === 0) {
    return <span style={{ display: 'block', marginTop: 2, color: GREEN }}>Matches Lauren&apos;s sheet (${sheet}).</span>;
  }
  return (
    <span style={{ display: 'block', marginTop: 2, color: AMBER }}>
      Lauren&apos;s sheet says <strong>${sheet}</strong> — this is <strong>${Math.abs(gap).toFixed(2)} {gap > 0 ? 'more' : 'less'}</strong>.
      {gap > 0
        ? ' Their invoices have been billing the higher figure; the sheet under-charges.'
        : ' The sheet charges more than their invoices have.'}
    </span>
  );
}

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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
        <Field label="Smallest caliper (inches)" note="Trunk diameter of a tree in this size, at the height set in Operations → Trees. Blank if not recorded.">
          <input style={input} type="number" step="any" min={0} value={draft.caliperMinInches} onChange={(e) => put('caliperMinInches', e.target.value)} />
        </Field>
        <Field label="Largest caliper (inches)" note={'Blank means "and up" — e.g. 200 gal: 5 in and up. The same as the smallest for a single figure.'}>
          <input style={input} type="number" step="any" min={0} value={draft.caliperMaxInches} onChange={(e) => put('caliperMaxInches', e.target.value)} />
        </Field>
        <Field label="Where the caliper came from">
          <input style={input} value={draft.caliperBecause} onChange={(e) => put('caliperBecause', e.target.value)} />
        </Field>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
        <Field
          label="Install price for one tree of this size"
          note={<>
            What the customer is charged to have ONE tree of this size planted in. <strong>Every
            service that prices by size reads this one number</strong> — an install, and “Plant Your
            Tree” for a tree the customer already owns (David, 2026-09-24). <strong>Blank means no
            price is set</strong> — the counter is then asked for an amount, with a reason. Never
            enter 0: that charges nothing, and the database now refuses it.
            {SHEET_PRICE[draft.label] !== undefined && (
              <SheetComparison label={draft.label} typed={draft.installPrice} />
            )}
          </>}
        >
          <input style={input} type="number" step="any" min={0} placeholder="not set"
            value={draft.installPrice} onChange={(e) => put('installPrice', e.target.value)} />
        </Field>
        <Field label="Where the install price came from">
          <input style={input} value={draft.installPriceBecause} onChange={(e) => put('installPriceBecause', e.target.value)} />
        </Field>
      </div>
      {/* ── THERE IS NO SECOND PRICE TO EDIT (ledger #404) ────────────────────────────────────
          🔴 DAVID, 2026-09-24: *"PLANT YOUR TREE uses the INSTALL LADDER'S PRICES per container
          size… 15 gal → the install from ladder."* #399 put a separate "Plant Your Tree price"
          field here for four hours. It is GONE — a second field for one fact is STD-011, and the
          one that drifts is always the one fewer people look at. The price above serves BOTH. */}
      {/* ── THE GROWING SCHEDULE (ledger #390) ───────────────────────────────────────────────
          Two numbers, and they are the whole grow ladder: GROW is how long after potting a tree on
          this size can be SOLD; HOLD is how long it then stays before it must move up. David,
          2026-09-01. Lauren's correction is why there are two and not one: *"It takes six to eight
          months to grow into their pots, and then they can live in their pots for say a year."*
          🔴 BLANK IS THE RIGHT ANSWER FOR A SIZE NOBODY HAS MEASURED, and the plan then prints
          UNKNOWN beside that batch rather than borrowing a number from somewhere else. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
        <Field
          label="Months to GROW — potted until sellable"
          note={<>
            After a tree is potted into this size, how many months before it can be <strong>sold</strong>?
            The uppot plan adds this to the day a batch finishes to say when the trees become sellable.
            <strong> Blank means nobody has measured it</strong> — the plan then says UNKNOWN instead of
            showing a date built on a guess.
          </>}
        >
          <input style={input} type="number" step="any" min={0} placeholder="unknown"
            value={draft.growMonths} onChange={(e) => put('growMonths', e.target.value)} />
        </Field>
        <Field label="Where the grow figure came from">
          <input style={input} value={draft.growBecause} onChange={(e) => put('growBecause', e.target.value)} />
        </Field>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
        <Field
          label="Months to HOLD — sellable until it must move up"
          note={<>
            Once sellable, how many months can a tree stay in this size before it has to be potted
            up whether or not anyone bought it? <strong>Blank means nobody has measured it.</strong>
            {' '}⚠️ Nothing schedules on this yet — it is recorded now so the figure is captured in
            the same conversation as the grow months.
          </>}
        >
          <input style={input} type="number" step="any" min={0} placeholder="unknown"
            value={draft.holdMonths} onChange={(e) => put('holdMonths', e.target.value)} />
        </Field>
        <Field label="Where the hold figure came from">
          <input style={input} value={draft.holdBecause} onChange={(e) => put('holdBecause', e.target.value)} />
        </Field>
      </div>
      {/* ── IS THIS SIZE SOLD AT ALL? (ledger #391, David 2026-09-23) ─────────────────────────
          A production-only rung — slip, 4 in, plug — has no sellable date because nothing is ever
          sold there. The plan then reads "not sold at this size" instead of UNKNOWN, which is the
          difference between a settled fact and a missing measurement. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
        <Field
          label="Is this size sold?"
          note={<>
            Stock passes through a <strong>production size</strong> (a slip, a 4-inch, a plug) on its
            way up and is never offered for sale at it. Saying so stops the uppot plan asking for a
            grow figure it will never need.
          </>}
        >
          <select style={input} value={draft.sellability} onChange={(e) => put('sellability', e.target.value)}>
            {SELLABILITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Why">
          <input style={input} value={draft.sellabilityBecause} onChange={(e) => put('sellabilityBecause', e.target.value)} />
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
        Caliper is read at the height set in <strong>Settings → Operations → Trees</strong>; what each size would be
        measured at under {CALIPER_STANDARD.name} is shown beside it, for reference only.{' '}
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
                  {' · '}{caliperText(r) ? <><strong>caliper {caliperText(r)}</strong> ({r.caliperBecause})</> : 'caliper not recorded'}
                  {/* Reference only — what the STANDARD would measure this size at. The height the
                      platform uses is the nursery's own, in Settings → Operations → Trees. */}
                  {standardCaliperHeightInches(r) != null
                    ? <> · <span style={{ color: '#666' }}>{CALIPER_STANDARD.name} would measure it at {standardCaliperHeightInches(r)} in</span></>
                    : null}
                  {/* ── THE PRICE, ON THE LINE (ledger #386, corrected #404) ──────────────
                      🔴 THE INSTALL PRICE WAS NOT ON THIS LINE BEFORE AND THAT WAS THE REAL GAP:
                      it has been editable since #386 and readable only by opening the rung one at
                      a time, so "which sizes do we not price?" — the exact question the null path
                      exists to make answerable — took nine clicks. It is ONE number now, because
                      every ladder-priced service reads it (ledger #404).
                      ⚠️ "not set" IS PRINTED, NOT HIDDEN, AND IT IS THE COMMON ANSWER (A9 —
                      absent is not empty). A blank where a price belongs reads as a price of
                      nothing; these words read as a decision nobody has made yet. */}
                  <div style={{ marginTop: 2 }}>
                    <strong>install</strong>{' '}
                    {r.installPrice == null
                      ? <span style={{ color: AMBER }}>not set</span>
                      : <>${Number(r.installPrice).toFixed(2)}</>}{' '}
                    <span style={{ color: '#777' }}>({r.installPriceBecause})</span>
                  </div>
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
