// ============================================================
// PMI — shared preventive-maintenance / inspection module (Cultivar + Ignition)
// PURPOSE:      Asset registry + PMI schedules + service-log ledger for any vertical.
// DEPENDENCIES: supabase (cost_objects [node_type=ASSET], business_pmi_schedule,
//               business_service_log), /api/pmi/suggest (AI schedule).
// OUTPUTS:      Reads/writes cost_objects ASSET rows + schedule/service-log rows.
// NOTE:         Table renamed business_assets → cost_objects (2026-06-15, Core-1).
//               PMI/service-log .asset_id FK still points at cost_objects (ASSET nodes).
// ============================================================
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

// Raw row from cost_objects (node_type='ASSET')
interface AssetRow {
  id: string;
  business_id: string;
  name: string;
  asset_type: string | null;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  barcode_id: string | null;
  year: number | null;
  status: string;
  acquisition_cost: number | null;
  notes: string | null;
  created_at: string;
}

// Raw row from business_pmi_schedule
interface ScheduleRow {
  id: string;
  asset_id: string;
  interval_days: number | null;
  tasks: Array<{ name: string; interval: string }>;
  last_service_at: string | null;
}

// Merged object for getPMIStatus / daysUntilDue — asset + schedule merged
interface PMIAsset extends AssetRow {
  pmi_interval_days: number | null;
  last_service_at: string | null;
  tasks: Array<{ name: string; interval: string }>;
  schedule_id: string | null;
}

interface ServiceLog {
  id: string;
  asset_id: string;
  service_type: string;
  performed_by: string | null;
  notes: string | null;
  cost: number | null;
  result: string | null;
  performed_at: string;
}

type PMIStatus = 'OVERDUE' | 'DUE_SOON' | 'OK' | 'NONE';
type InspectionResult = 'PASS' | 'NEEDS_ATTENTION' | 'FAIL';

export interface PMIProps {
  businessId: string;
  /** Label for one asset — "Tool", "Equipment", "Vehicle", "Unit" */
  assetLabel?: string;
  /** Vertical-specific type options shown in the add form */
  assetTypes?: string[];
  /** Common service types for the log form */
  serviceTypes?: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPMIStatus(asset: PMIAsset): PMIStatus {
  if (!asset.pmi_interval_days || !asset.last_service_at) return 'NONE';
  const daysSince = (Date.now() - new Date(asset.last_service_at).getTime()) / 86_400_000;
  if (daysSince > asset.pmi_interval_days) return 'OVERDUE';
  if (daysSince > asset.pmi_interval_days - 7) return 'DUE_SOON';
  return 'OK';
}

function daysUntilDue(asset: PMIAsset): number | null {
  if (!asset.pmi_interval_days || !asset.last_service_at) return null;
  const daysSince = (Date.now() - new Date(asset.last_service_at).getTime()) / 86_400_000;
  return Math.ceil(asset.pmi_interval_days - daysSince);
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  page:     { minHeight: '100vh', background: '#020617', padding: '24px 16px', fontFamily: 'ui-sans-serif, system-ui, sans-serif', color: '#f1f5f9' },
  card:     { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: '16px 18px', marginBottom: 10 },
  label:    { fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.08em' },
  input:    { width: '100%', boxSizing: 'border-box' as const, padding: '11px 13px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none' },
  btnGreen: { padding: '13px 18px', borderRadius: 10, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' },
  btnBlue:  { padding: '10px 16px', borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' },
  btnGhost: { background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: 8, padding: '8px 14px', fontSize: '0.8rem', cursor: 'pointer' },
  row:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
};

const STATUS_STYLE: Record<PMIStatus, { background: string; color: string; label: string }> = {
  OVERDUE:  { background: '#450a0a', color: '#fca5a5', label: 'PMI OVERDUE' },
  DUE_SOON: { background: '#451a03', color: '#fdba74', label: 'DUE SOON' },
  OK:       { background: '#052e16', color: '#86efac', label: 'PMI OK' },
  NONE:     { background: '#1e293b', color: '#64748b', label: 'NO SCHEDULE' },
};

const RESULT_STYLE: Record<InspectionResult, { bg: string; border: string; label: string }> = {
  PASS:            { bg: '#059669', border: '#6ee7b7', label: 'PASS' },
  NEEDS_ATTENTION: { bg: '#d97706', border: '#fcd34d', label: 'NEEDS ATTN' },
  FAIL:            { bg: '#dc2626', border: '#f87171', label: 'FAIL' },
};

// ── Empty form states ──────────────────────────────────────────────────────────

const EMPTY_ASSET = {
  name: '', asset_type: '', make: '', model: '', serial_number: '',
  barcode_id: '', year: '', pmi_interval_days: '', notes: '',
};
const EMPTY_LOG = {
  service_type: '', performed_by: '', notes: '', cost: '',
  result: 'PASS' as InspectionResult,
  performed_at: new Date().toISOString().slice(0, 10),
};

// ── Component ─────────────────────────────────────────────────────────────────

export function PMI({
  businessId,
  assetLabel   = 'Asset',
  assetTypes   = ['Vehicle', 'Equipment', 'Tool', 'Other'],
  serviceTypes = ['Inspection', 'Oil Change', 'Filter Replacement', 'Fluid Top-Off', 'Belt / Chain', 'Blade / Bit', 'Repair', 'Other'],
}: PMIProps) {
  const [assets,       setAssets]       = useState<PMIAsset[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [selected,     setSelected]     = useState<PMIAsset | null>(null);
  const [logs,         setLogs]         = useState<ServiceLog[]>([]);
  const [logsLoading,  setLogsLoading]  = useState(false);
  const [showAdd,      setShowAdd]      = useState(false);
  const [showLog,      setShowLog]      = useState(false);
  const [assetForm,    setAssetForm]    = useState(EMPTY_ASSET);
  const [logForm,      setLogForm]      = useState(EMPTY_LOG);
  const [logTasks,     setLogTasks]     = useState<Array<{ name: string; interval: string; passed: boolean }>>([]);
  const [saving,       setSaving]       = useState(false);
  const [aiLoading,    setAiLoading]    = useState(false);
  const [aiError,      setAiError]      = useState('');

  // ── Load assets + schedules, merge ──────────────────────────────────────────

  async function loadAssets() {
    setLoading(true);
    console.log('[TRACE:pmi] loadAssets → cost_objects (node_type=ASSET)', { businessId });
    const { data: assetRows, error: assetErr } = await supabase
      .from('cost_objects')
      .select('*')
      .eq('business_id', businessId)
      .eq('node_type', 'ASSET')
      .neq('status', 'RETIRED')
      .order('name');

    if (assetErr) { setError(assetErr.message); setLoading(false); return; }
    const rows = (assetRows as AssetRow[]) || [];

    // Fetch schedules for all returned assets in one query
    let scheduleMap: Record<string, ScheduleRow> = {};
    if (rows.length > 0) {
      const ids = rows.map(r => r.id);
      const { data: schedRows } = await supabase
        .from('business_pmi_schedule')
        .select('*')
        .in('asset_id', ids);
      for (const s of (schedRows as ScheduleRow[]) || []) {
        scheduleMap[s.asset_id] = s;
      }
    }

    const merged: PMIAsset[] = rows.map(a => {
      const sched = scheduleMap[a.id];
      return {
        ...a,
        pmi_interval_days: sched?.interval_days ?? null,
        last_service_at:   sched?.last_service_at ?? null,
        tasks:             sched?.tasks ?? [],
        schedule_id:       sched?.id ?? null,
      };
    });

    setAssets(merged);
    setLoading(false);
  }

  useEffect(() => { if (businessId) loadAssets(); }, [businessId]);

  // ── Load logs for selected asset ─────────────────────────────────────────────

  useEffect(() => {
    if (!selected) return;
    setLogsLoading(true);
    supabase
      .from('business_service_log')
      .select('*')
      .eq('asset_id', selected.id)
      .order('performed_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { setLogs((data as ServiceLog[]) || []); setLogsLoading(false); });
  }, [selected]);

  // When opening log form, seed task checklist from schedule
  function openLogForm() {
    setLogForm(EMPTY_LOG);
    setLogTasks((selected?.tasks ?? []).map(t => ({ ...t, passed: true })));
    setShowLog(true);
  }

  // ── Add asset ────────────────────────────────────────────────────────────────

  async function handleAddAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!assetForm.name.trim()) return;
    setSaving(true);
    setError('');

    console.log('[TRACE:pmi] addAsset → cost_objects', { node_type: 'ASSET', name: assetForm.name.trim() });
    const { data: assetData, error: assetErr } = await supabase
      .from('cost_objects')
      .insert({
        business_id:      businessId,
        node_type:        'ASSET',
        name:             assetForm.name.trim(),
        asset_type:       assetForm.asset_type  || null,
        make:             assetForm.make.trim()  || null,
        model:            assetForm.model.trim() || null,
        serial_number:    assetForm.serial_number.trim() || null,
        barcode_id:       assetForm.barcode_id.trim() || null,
        year:             assetForm.year ? parseInt(assetForm.year) : null,
        notes:            assetForm.notes.trim() || null,
      })
      .select('id')
      .single();

    if (assetErr) { setError(assetErr.message); setSaving(false); return; }

    // If interval entered, create schedule row
    if (assetForm.pmi_interval_days && assetData?.id) {
      const { error: schedErr } = await supabase
        .from('business_pmi_schedule')
        .insert({
          business_id:   businessId,
          asset_id:      assetData.id,
          interval_days: parseInt(assetForm.pmi_interval_days),
          tasks:         [],
        });
      if (schedErr) setError(schedErr.message);
    }

    setSaving(false);
    setAssetForm(EMPTY_ASSET);
    setShowAdd(false);
    loadAssets();
  }

  // ── Log service ───────────────────────────────────────────────────────────────

  async function handleLogService(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !logForm.service_type) return;
    setSaving(true);
    setError('');
    const performedAt = logForm.performed_at
      ? new Date(logForm.performed_at).toISOString()
      : new Date().toISOString();

    const { error: logErr } = await supabase.from('business_service_log').insert({
      asset_id:     selected.id,
      business_id:  businessId,
      service_type: logForm.service_type,
      performed_by: logForm.performed_by.trim() || null,
      notes:        logForm.notes.trim()        || null,
      cost:         logForm.cost ? parseFloat(logForm.cost) : null,
      result:       logForm.result || null,
      // receipt_id intentionally null — manual cost = ESTIMATED; linked by receipt flow later
      performed_at: performedAt,
    });
    if (logErr) { setError(logErr.message); setSaving(false); return; }

    // Update last_service_at on the schedule (not the asset)
    if (selected.schedule_id) {
      await supabase
        .from('business_pmi_schedule')
        .update({ last_service_at: performedAt })
        .eq('id', selected.schedule_id);
    }

    setSaving(false);
    setLogForm(EMPTY_LOG);
    setLogTasks([]);
    setShowLog(false);
    loadAssets();

    // Refresh selected asset with updated schedule data
    const { data: updatedRows } = await supabase
      .from('cost_objects')
      .select('*')
      .eq('id', selected.id)
      .single();
    if (updatedRows) {
      const { data: schedRow } = await supabase
        .from('business_pmi_schedule')
        .select('*')
        .eq('asset_id', selected.id)
        .single();
      const s = schedRow as ScheduleRow | null;
      setSelected({
        ...(updatedRows as AssetRow),
        pmi_interval_days: s?.interval_days ?? null,
        last_service_at:   s?.last_service_at ?? null,
        tasks:             s?.tasks ?? [],
        schedule_id:       s?.id ?? null,
      });
    }
  }

  // ── AI Suggest Schedule ───────────────────────────────────────────────────────

  async function handleSuggestSchedule() {
    if (!selected) return;
    setAiLoading(true);
    setAiError('');
    try {
      const res = await fetch('/api/pmi/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          name:       selected.name,
          asset_type: selected.asset_type,
          make:       selected.make,
          model:      selected.model,
          year:       selected.year,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setAiError(json.error ?? 'AI suggest failed');
        return;
      }
      const suggestedTasks: Array<{ name: string; interval: string }> = json.tasks ?? [];

      if (selected.schedule_id) {
        // Update existing schedule tasks
        const { error: upErr } = await supabase
          .from('business_pmi_schedule')
          .update({ tasks: suggestedTasks })
          .eq('id', selected.schedule_id);
        if (upErr) { setAiError(upErr.message); return; }
      } else {
        // Create schedule row with suggested tasks
        const { error: insErr } = await supabase
          .from('business_pmi_schedule')
          .insert({
            business_id: businessId,
            asset_id:    selected.id,
            tasks:       suggestedTasks,
          });
        if (insErr) { setAiError(insErr.message); return; }
      }

      // Reload to pick up updated tasks + schedule_id
      await loadAssets();
      // Refresh selected with new data
      const { data: freshAsset } = await supabase
        .from('cost_objects').select('*').eq('id', selected.id).single();
      const { data: freshSched } = await supabase
        .from('business_pmi_schedule').select('*').eq('asset_id', selected.id).single();
      if (freshAsset) {
        const s = freshSched as ScheduleRow | null;
        setSelected({
          ...(freshAsset as AssetRow),
          pmi_interval_days: s?.interval_days ?? null,
          last_service_at:   s?.last_service_at ?? null,
          tasks:             s?.tasks ?? [],
          schedule_id:       s?.id ?? null,
        });
      }
    } finally {
      setAiLoading(false);
    }
  }

  // ── Detail view ───────────────────────────────────────────────────────────────

  if (selected) {
    const status = getPMIStatus(selected);
    const due    = daysUntilDue(selected);
    const ss     = STATUS_STYLE[status];

    return (
      <div style={S.page}>
        <div style={{ ...S.row, marginBottom: 20 }}>
          <button style={S.btnGhost} onClick={() => { setSelected(null); setShowLog(false); setAiError(''); }}>← Back</button>
          <button style={S.btnGreen} onClick={openLogForm}>+ Log Service</button>
        </div>

        {/* Asset info card */}
        <div style={S.card}>
          <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>{selected.name}</p>
          {(selected.make || selected.model || selected.year) && (
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 8 }}>
              {[selected.year, selected.make, selected.model].filter(Boolean).join(' ')}
            </p>
          )}
          {selected.serial_number && (
            <p style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 4 }}>SN: {selected.serial_number}</p>
          )}
          {selected.barcode_id && (
            <p style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 8 }}>Barcode: {selected.barcode_id}</p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginTop: 8 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: ss.background, color: ss.color }}>
              {ss.label}
            </span>
            {due !== null && (
              <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: '#0f172a', color: '#94a3b8', border: '1px solid #1e293b' }}>
                {due > 0 ? `Due in ${due}d` : `${Math.abs(due)}d overdue`}
              </span>
            )}
          </div>
          {selected.pmi_interval_days && (
            <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: 10 }}>
              Service every {selected.pmi_interval_days} days
              {selected.last_service_at && ` · Last: ${new Date(selected.last_service_at).toLocaleDateString()}`}
            </p>
          )}
          {selected.notes && (
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 10, padding: '10px 12px', background: '#020617', borderRadius: 8 }}>{selected.notes}</p>
          )}
        </div>

        {/* Task checklist display + Suggest Schedule */}
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={{ ...S.row, marginBottom: selected.tasks.length > 0 ? 12 : 0 }}>
            <p style={{ ...S.label, margin: 0 }}>PMI Task Checklist</p>
            <button
              style={{ ...S.btnBlue, opacity: aiLoading ? 0.6 : 1, fontSize: '0.75rem', padding: '7px 12px' }}
              onClick={handleSuggestSchedule}
              disabled={aiLoading}
            >
              {aiLoading ? 'Thinking…' : '✦ Suggest Schedule'}
            </button>
          </div>
          {aiError && <p style={{ color: '#f87171', fontSize: '0.75rem', marginBottom: 8 }}>{aiError}</p>}
          {selected.tasks.length === 0 ? (
            <p style={{ color: '#334155', fontSize: '0.8rem', marginTop: 8 }}>No tasks — click "Suggest Schedule" to generate with AI.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, marginTop: 4 }}>
              {selected.tasks.map((task, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', background: '#020617', padding: '8px 12px', borderRadius: 8 }}>
                  <p style={{ fontSize: '0.82rem', color: '#e2e8f0', margin: 0 }}>{task.name}</p>
                  <p style={{ fontSize: '0.72rem', color: '#475569', margin: 0, textTransform: 'uppercase' as const }}>{task.interval}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Log service form */}
        {showLog && (
          <form onSubmit={handleLogService} style={{ ...S.card, display: 'flex', flexDirection: 'column' as const, gap: 12, marginBottom: 16 }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>LOG SERVICE</p>

            <div>
              <p style={S.label}>Service type *</p>
              <select
                style={S.input}
                value={logForm.service_type}
                onChange={e => setLogForm(p => ({ ...p, service_type: e.target.value }))}
                required
              >
                <option value="">Select type…</option>
                {serviceTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Overall result — PASS / NEEDS_ATTENTION / FAIL */}
            <div>
              <p style={S.label}>Inspection Result</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {(['PASS', 'NEEDS_ATTENTION', 'FAIL'] as InspectionResult[]).map(r => {
                  const rs = RESULT_STYLE[r];
                  const active = logForm.result === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setLogForm(p => ({ ...p, result: r }))}
                      style={{
                        flex: 1, padding: '8px 4px', borderRadius: 8,
                        fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' as const,
                        border: active ? `1px solid ${rs.border}` : '1px solid #334155',
                        background: active ? rs.bg : '#1e293b',
                        color: active ? '#fff' : '#64748b',
                        cursor: 'pointer',
                      }}
                    >
                      {rs.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Task checklist if tasks exist */}
            {logTasks.length > 0 && (
              <div>
                <p style={S.label}>Task Checklist</p>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, marginTop: 4 }}>
                  {logTasks.map((task, i) => (
                    <div
                      key={i}
                      onClick={() => setLogTasks(prev => prev.map((t, idx) => idx === i ? { ...t, passed: !t.passed } : t))}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: '#020617', padding: '10px 12px', borderRadius: 8,
                        border: '1px solid #1e293b', cursor: 'pointer',
                      }}
                    >
                      <div>
                        <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>{task.name}</p>
                        <p style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' as const, margin: 0 }}>{task.interval}</p>
                      </div>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        border: task.passed ? '2px solid #6ee7b7' : '2px solid #475569',
                        background: task.passed ? '#10b981' : '#334155',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {task.passed && <span style={{ color: '#fff', fontSize: '0.6rem', fontWeight: 900 }}>✓</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <p style={S.label}>Performed by</p>
                <input style={S.input} placeholder="Name" value={logForm.performed_by} onChange={e => setLogForm(p => ({ ...p, performed_by: e.target.value }))} />
              </div>
              <div>
                <p style={S.label}>Cost ($)</p>
                <input style={S.input} type="number" step="0.01" placeholder="0.00" value={logForm.cost} onChange={e => setLogForm(p => ({ ...p, cost: e.target.value }))} />
              </div>
            </div>
            <div>
              <p style={S.label}>Date</p>
              <input style={S.input} type="date" value={logForm.performed_at} onChange={e => setLogForm(p => ({ ...p, performed_at: e.target.value }))} />
            </div>
            <div>
              <p style={S.label}>Notes</p>
              <input style={S.input} placeholder="What was done…" value={logForm.notes} onChange={e => setLogForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" style={{ ...S.btnGreen, flex: 1, opacity: saving ? 0.6 : 1 }} disabled={saving}>
                {saving ? 'Saving…' : 'Save Service Log'}
              </button>
              <button type="button" style={S.btnGhost} onClick={() => { setShowLog(false); setLogTasks([]); }}>Cancel</button>
            </div>
          </form>
        )}

        {error && <p style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: 12 }}>{error}</p>}

        {/* Service history */}
        <p style={{ ...S.label, marginBottom: 10 }}>Service History</p>
        {logsLoading ? (
          <p style={{ color: '#475569', fontSize: '0.8rem' }}>Loading…</p>
        ) : logs.length === 0 ? (
          <p style={{ color: '#334155', fontSize: '0.8rem', textAlign: 'center' as const, padding: '24px 0' }}>No service logged yet</p>
        ) : (
          logs.map(log => {
            const rs = log.result ? RESULT_STYLE[log.result as InspectionResult] : null;
            return (
              <div key={log.id} style={{ ...S.card, marginBottom: 8 }}>
                <div style={S.row}>
                  <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f1f5f9' }}>{log.service_type}</p>
                  <p style={{ fontSize: '0.75rem', color: '#475569' }}>{new Date(log.performed_at).toLocaleDateString()}</p>
                </div>
                {rs && (
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: rs.bg, color: '#fff', display: 'inline-block', marginTop: 4 }}>
                    {rs.label}
                  </span>
                )}
                {log.performed_by && <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>By: {log.performed_by}</p>}
                {log.cost != null && <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Cost: ${Number(log.cost).toFixed(2)}</p>}
                {log.notes && <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 6 }}>{log.notes}</p>}
              </div>
            );
          })
        )}
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────────

  const overdue = assets.filter(a => getPMIStatus(a) === 'OVERDUE').length;
  const dueSoon = assets.filter(a => getPMIStatus(a) === 'DUE_SOON').length;

  return (
    <div style={S.page}>
      <div style={{ ...S.row, marginBottom: 4 }}>
        <div>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#22c55e', letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>PMI</p>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f1f5f9', margin: 0 }}>{assetLabel} Registry</h1>
        </div>
        <button style={S.btnGreen} onClick={() => setShowAdd(s => !s)}>+ Add</button>
      </div>

      {(overdue > 0 || dueSoon > 0) && (
        <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
          {overdue > 0  && <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '6px 12px', borderRadius: 8, background: '#450a0a', color: '#fca5a5' }}>{overdue} OVERDUE</span>}
          {dueSoon > 0 && <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '6px 12px', borderRadius: 8, background: '#451a03', color: '#fdba74' }}>{dueSoon} DUE SOON</span>}
        </div>
      )}

      {error && <p style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: 12 }}>{error}</p>}

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAddAsset} style={{ ...S.card, display: 'flex', flexDirection: 'column' as const, gap: 12, marginBottom: 20 }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>NEW {assetLabel.toUpperCase()}</p>
          <div>
            <p style={S.label}>Name *</p>
            <input style={S.input} placeholder="e.g. John Deere 5075E" value={assetForm.name} onChange={e => setAssetForm(p => ({ ...p, name: e.target.value }))} autoFocus required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <p style={S.label}>Type</p>
              <select style={S.input} value={assetForm.asset_type} onChange={e => setAssetForm(p => ({ ...p, asset_type: e.target.value }))}>
                <option value="">Select…</option>
                {assetTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <p style={S.label}>Year</p>
              <input style={S.input} type="number" placeholder="2020" value={assetForm.year} onChange={e => setAssetForm(p => ({ ...p, year: e.target.value }))} />
            </div>
            <div>
              <p style={S.label}>Make</p>
              <input style={S.input} placeholder="John Deere" value={assetForm.make} onChange={e => setAssetForm(p => ({ ...p, make: e.target.value }))} />
            </div>
            <div>
              <p style={S.label}>Model</p>
              <input style={S.input} placeholder="5075E" value={assetForm.model} onChange={e => setAssetForm(p => ({ ...p, model: e.target.value }))} />
            </div>
            <div>
              <p style={S.label}>Serial #</p>
              <input style={S.input} placeholder="SN123456" value={assetForm.serial_number} onChange={e => setAssetForm(p => ({ ...p, serial_number: e.target.value }))} />
            </div>
            <div>
              <p style={S.label}>Barcode ID</p>
              <input style={S.input} placeholder="Scan or type" value={assetForm.barcode_id} onChange={e => setAssetForm(p => ({ ...p, barcode_id: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <p style={S.label}>PMI every (days)</p>
              <input style={S.input} type="number" placeholder="90 — creates a schedule" value={assetForm.pmi_interval_days} onChange={e => setAssetForm(p => ({ ...p, pmi_interval_days: e.target.value }))} />
            </div>
          </div>
          <div>
            <p style={S.label}>Notes</p>
            <input style={S.input} placeholder="Any notes…" value={assetForm.notes} onChange={e => setAssetForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" style={{ ...S.btnGreen, flex: 1, opacity: saving ? 0.6 : 1 }} disabled={saving}>
              {saving ? 'Saving…' : `Add ${assetLabel}`}
            </button>
            <button type="button" style={S.btnGhost} onClick={() => { setShowAdd(false); setAssetForm(EMPTY_ASSET); }}>Cancel</button>
          </div>
        </form>
      )}

      {/* Asset list */}
      {loading ? (
        <p style={{ color: '#475569', fontSize: '0.8rem', textAlign: 'center' as const, padding: '40px 0' }}>Loading…</p>
      ) : assets.length === 0 && !showAdd ? (
        <div style={{ textAlign: 'center' as const, padding: '60px 0', color: '#334155' }}>
          <p style={{ fontSize: '2rem', marginBottom: 8 }}>🔧</p>
          <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>No {assetLabel.toLowerCase()}s registered</p>
          <p style={{ fontSize: '0.8rem', marginTop: 4 }}>Add your first {assetLabel.toLowerCase()} to start tracking maintenance.</p>
        </div>
      ) : (
        assets.map(asset => {
          const st  = getPMIStatus(asset);
          const ss  = STATUS_STYLE[st];
          const due = daysUntilDue(asset);
          return (
            <div
              key={asset.id}
              style={{ ...S.card, cursor: 'pointer', borderColor: st === 'OVERDUE' ? '#7f1d1d' : st === 'DUE_SOON' ? '#7c2d12' : '#1e293b' }}
              onClick={() => { setSelected(asset); setShowLog(false); }}
            >
              <div style={S.row}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f1f5f9', marginBottom: 2 }}>{asset.name}</p>
                  {(asset.make || asset.model || asset.year) && (
                    <p style={{ fontSize: '0.8rem', color: '#64748b' }}>{[asset.year, asset.make, asset.model].filter(Boolean).join(' ')}</p>
                  )}
                  {asset.barcode_id && (
                    <p style={{ fontSize: '0.7rem', color: '#334155', marginTop: 2 }}>Barcode: {asset.barcode_id}</p>
                  )}
                </div>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: ss.background, color: ss.color, whiteSpace: 'nowrap' as const }}>
                  {ss.label}
                </span>
              </div>
              {asset.pmi_interval_days && (
                <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: 8 }}>
                  Every {asset.pmi_interval_days}d
                  {due !== null && ` · ${due > 0 ? `${due}d until due` : `${Math.abs(due)}d overdue`}`}
                  {asset.last_service_at && ` · Last: ${new Date(asset.last_service_at).toLocaleDateString()}`}
                </p>
              )}
              {asset.tasks.length > 0 && (
                <p style={{ fontSize: '0.7rem', color: '#334155', marginTop: 4 }}>{asset.tasks.length} task{asset.tasks.length !== 1 ? 's' : ''} scheduled</p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
