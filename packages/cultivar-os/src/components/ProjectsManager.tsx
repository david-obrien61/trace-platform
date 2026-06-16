/**
 * ── PROJECTS MANAGER (Cultivar OS) · THUNDER D-10 · 2026-06-16 ───────────────────
 *
 * PURPOSE
 *   Manage the PROJECT buckets of the cost-object tree — create / rename / deactivate
 *   PROJECT nodes (cost_objects, node_type='PROJECT'). This is the ENTRY side of the
 *   project-lens (DECISION-project-lens-ui-design.md §6): you manage buckets HERE, and
 *   assign costs INTO them on the tree (the parent-picker). Deliberately DISTINCT from
 *   assigning a cost — no inline project creation in a cost row (Surface Honesty: the
 *   parent-picker lists only real PROJECT nodes).
 *
 *   PROJECT entity is MINIMAL (AC-4): name only — no description/type/budget. Those are
 *   added later only on a real need (honest-debt note in the rename migration).
 *
 * DEPENDENCIES
 *   - ../lib/supabase (cost_objects: insert/update PROJECT rows, business_id-scoped RLS)
 *   - businessId (RLS scope — passed in from the tree, which got it from context)
 *
 * OUTPUTS
 *   - Writes cost_objects rows (node_type='PROJECT'). Create = insert; rename = update name;
 *     deactivate = is_active=false (the tree's loader then re-points orphaned children's
 *     parent_id → null in the same pass, so they fall back to company-level — never
 *     cascade-destroyed; matches the schema's ON DELETE SET NULL intent).
 *   - Calls onChanged() after every successful write so the tree reloads + recomputes.
 *
 * INSTRUMENTATION (STD-003): emits `[TRACE:PROJECTLENS]` lines on create/rename/deactivate.
 *   ON BY DEFAULT until David owner-proves the lens through the UI under RLS.
 */
import { useState } from 'react';
import { X, Plus, Pencil, Check, FolderTree } from 'lucide-react';
import { supabase } from '../lib/supabase';

export interface ManagedProject {
  id: string;
  label: string;
  childCount: number; // how many costs currently hang under this project (shown so deactivate is informed)
}

interface Props {
  businessId: string;
  projects: ManagedProject[];
  onChanged: () => void;
  onClose: () => void;
}

const GREEN = '#27500A';
const GRAY = '#6b7280';
const RED = '#b91c1c';

export function ProjectsManager({ businessId, projects, onChanged, onClose }: Props) {
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    console.log('[TRACE:PROJECTLENS] create project', { businessId, name });
    // node_type='PROJECT' + project_status='open'. cost_confidence/acquisition_cost stay
    // null — a project is a bucket, not a cost (AC-4 minimal; no always-null cost pile).
    const { error } = await supabase.from('cost_objects').insert({
      business_id: businessId,
      node_type: 'PROJECT',
      name,
      project_status: 'open',
    });
    setBusy(false);
    if (error) { console.error('[TRACE:PROJECTLENS] create error', error.message); setError(error.message); return; }
    setNewName('');
    onChanged();
  }

  async function rename(id: string) {
    const name = editName.trim();
    if (!name) { setEditingId(null); return; }
    setBusy(true);
    setError(null);
    console.log('[TRACE:PROJECTLENS] rename project', { id, name });
    const { error } = await supabase.from('cost_objects').update({ name }).eq('id', id).eq('business_id', businessId);
    setBusy(false);
    if (error) { console.error('[TRACE:PROJECTLENS] rename error', error.message); setError(error.message); return; }
    setEditingId(null);
    onChanged();
  }

  async function deactivate(p: ManagedProject) {
    const msg = p.childCount > 0
      ? `Remove project "${p.label}"? Its ${p.childCount} cost${p.childCount === 1 ? '' : 's'} will fall back to company-level overhead — not deleted.`
      : `Remove project "${p.label}"?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    setError(null);
    console.log('[TRACE:PROJECTLENS] deactivate project', { id: p.id, childCount: p.childCount });
    // Re-point children to company-level FIRST (parent_id → null), then deactivate the bucket.
    // This is the explicit ON DELETE SET NULL behaviour, done in app code so RLS + the
    // is_active filter stay consistent (children never cascade-destroyed).
    const reparent = await supabase.from('cost_objects').update({ parent_id: null }).eq('parent_id', p.id).eq('business_id', businessId);
    if (reparent.error) { setBusy(false); console.error('[TRACE:PROJECTLENS] reparent error', reparent.error.message); setError(reparent.error.message); return; }
    const { error } = await supabase.from('cost_objects').update({ is_active: false }).eq('id', p.id).eq('business_id', businessId);
    setBusy(false);
    if (error) { console.error('[TRACE:PROJECTLENS] deactivate error', error.message); setError(error.message); return; }
    onChanged();
  }

  return (
    <div style={S.modal} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.sheet}>
        <div style={S.header}>
          <h2 style={S.title}><FolderTree size={18} color={GREEN} /> Manage projects</h2>
          <button style={S.iconBtn} onClick={onClose}><X size={20} color={GRAY} /></button>
        </div>

        <p style={S.help}>
          Projects are the buckets your costs roll up into. Create them here, then assign each cost
          to a project on the tree. Costs you don't assign stay at company level.
        </p>

        {error && <div style={S.error}>{error}</div>}

        <form onSubmit={createProject} style={S.addRow}>
          <input
            style={S.input}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New project name (e.g. CoolRunnings)"
          />
          <button type="submit" style={S.addBtn} disabled={busy || !newName.trim()}>
            <Plus size={16} /> Add
          </button>
        </form>

        <div style={{ marginTop: 16 }}>
          {projects.length === 0 && (
            <p style={{ ...S.help, textAlign: 'center', padding: '12px 0' }}>No projects yet. Add your first above.</p>
          )}
          {projects.map((p) => (
            <div key={p.id} style={S.projectRow}>
              {editingId === p.id ? (
                <>
                  <input
                    style={{ ...S.input, flex: 1 }}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') rename(p.id); if (e.key === 'Escape') setEditingId(null); }}
                  />
                  <button style={S.iconBtn} onClick={() => rename(p.id)} disabled={busy}><Check size={18} color={GREEN} /></button>
                </>
              ) : (
                <>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, color: '#111827' }}>{p.label}</span>
                    <span style={{ fontSize: '0.75rem', color: GRAY, marginLeft: 8 }}>
                      {p.childCount} cost{p.childCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  <button style={S.iconBtn} onClick={() => { setEditingId(p.id); setEditName(p.label); }} title="Rename">
                    <Pencil size={15} color={GRAY} />
                  </button>
                  <button style={S.iconBtn} onClick={() => deactivate(p)} title="Remove" disabled={busy}>
                    <X size={16} color={RED} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <button style={S.doneBtn} onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 },
  sheet: { background: '#fff', borderRadius: '16px 16px 0 0', padding: '1.5rem', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: '1.1rem', fontWeight: 700, color: '#1a2e0a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 },
  help: { fontSize: '0.8125rem', color: GRAY, lineHeight: 1.5, margin: '4px 0 14px' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center' },
  addRow: { display: 'flex', gap: 8, alignItems: 'center' },
  input: { flex: 1, border: '1.5px solid #d1d5db', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.95rem', color: '#111827', boxSizing: 'border-box', background: '#fff' },
  addBtn: { display: 'flex', alignItems: 'center', gap: 4, background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 0.9rem', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  projectRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '0.6rem 0', borderTop: '1px solid #f3f4f6' },
  error: { color: RED, background: '#fee2e2', borderRadius: 8, padding: '0.6rem 0.875rem', fontSize: '0.85rem', marginBottom: 10 },
  doneBtn: { width: '100%', minHeight: 46, marginTop: 18, background: '#fff', color: GREEN, border: `1.5px solid ${GREEN}`, borderRadius: 10, fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' },
};
