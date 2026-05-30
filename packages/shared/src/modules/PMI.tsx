import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PMIAsset {
  id: string;
  business_id: string;
  name: string;
  asset_type: string | null;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  year: number | null;
  pmi_interval_days: number | null;
  last_service_at: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

interface ServiceLog {
  id: string;
  asset_id: string;
  service_type: string;
  performed_by: string | null;
  notes: string | null;
  cost: number | null;
  performed_at: string;
}

type PMIStatus = 'OVERDUE' | 'DUE_SOON' | 'OK' | 'NONE';

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
  page:    { minHeight: '100vh', background: '#020617', padding: '24px 16px', fontFamily: 'ui-sans-serif, system-ui, sans-serif', color: '#f1f5f9' },
  card:    { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: '16px 18px', marginBottom: 10 },
  label:   { fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.08em' },
  input:   { width: '100%', boxSizing: 'border-box' as const, padding: '11px 13px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none' },
  btnGreen:{ padding: '13px 18px', borderRadius: 10, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' },
  btnGhost:{ background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: 8, padding: '8px 14px', fontSize: '0.8rem', cursor: 'pointer' },
  row:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
};

const STATUS_STYLE: Record<PMIStatus, { background: string; color: string; label: string }> = {
  OVERDUE:  { background: '#450a0a', color: '#fca5a5', label: 'PMI OVERDUE' },
  DUE_SOON: { background: '#451a03', color: '#fdba74', label: 'DUE SOON' },
  OK:       { background: '#052e16', color: '#86efac', label: 'PMI OK' },
  NONE:     { background: '#1e293b', color: '#64748b', label: 'NO SCHEDULE' },
};

// ── Empty form state ──────────────────────────────────────────────────────────

const EMPTY_ASSET = { name: '', asset_type: '', make: '', model: '', serial_number: '', year: '', pmi_interval_days: '', notes: '' };
const EMPTY_LOG   = { service_type: '', performed_by: '', notes: '', cost: '', performed_at: new Date().toISOString().slice(0, 10) };

// ── Component ─────────────────────────────────────────────────────────────────

export function PMI({
  businessId,
  assetLabel   = 'Asset',
  assetTypes   = ['Vehicle', 'Equipment', 'Tool', 'Other'],
  serviceTypes = ['Inspection', 'Oil Change', 'Filter Replacement', 'Fluid Top-Off', 'Belt / Chain', 'Blade / Bit', 'Repair', 'Other'],
}: PMIProps) {
  const [assets,      setAssets]      = useState<PMIAsset[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [selected,    setSelected]    = useState<PMIAsset | null>(null);
  const [logs,        setLogs]        = useState<ServiceLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showAdd,     setShowAdd]     = useState(false);
  const [showLog,     setShowLog]     = useState(false);
  const [assetForm,   setAssetForm]   = useState(EMPTY_ASSET);
  const [logForm,     setLogForm]     = useState(EMPTY_LOG);
  const [saving,      setSaving]      = useState(false);

  // ── Load assets ─────────────────────────────────────────────────────────────

  async function loadAssets() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('pmi_assets')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name');
    if (err) setError(err.message);
    else setAssets(data as PMIAsset[] || []);
    setLoading(false);
  }

  useEffect(() => { if (businessId) loadAssets(); }, [businessId]);

  // ── Load logs for selected asset ─────────────────────────────────────────────

  useEffect(() => {
    if (!selected) return;
    setLogsLoading(true);
    supabase
      .from('pmi_service_logs')
      .select('*')
      .eq('asset_id', selected.id)
      .order('performed_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { setLogs(data as ServiceLog[] || []); setLogsLoading(false); });
  }, [selected]);

  // ── Add asset ────────────────────────────────────────────────────────────────

  async function handleAddAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!assetForm.name.trim()) return;
    setSaving(true);
    const { error: err } = await supabase.from('pmi_assets').insert({
      business_id:       businessId,
      name:              assetForm.name.trim(),
      asset_type:        assetForm.asset_type  || null,
      make:              assetForm.make.trim()  || null,
      model:             assetForm.model.trim() || null,
      serial_number:     assetForm.serial_number.trim() || null,
      year:              assetForm.year ? parseInt(assetForm.year) : null,
      pmi_interval_days: assetForm.pmi_interval_days ? parseInt(assetForm.pmi_interval_days) : null,
      notes:             assetForm.notes.trim() || null,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setAssetForm(EMPTY_ASSET);
    setShowAdd(false);
    loadAssets();
  }

  // ── Log service ───────────────────────────────────────────────────────────────

  async function handleLogService(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !logForm.service_type) return;
    setSaving(true);
    const performedAt = logForm.performed_at ? new Date(logForm.performed_at).toISOString() : new Date().toISOString();
    const { error: logErr } = await supabase.from('pmi_service_logs').insert({
      asset_id:     selected.id,
      business_id:  businessId,
      service_type: logForm.service_type,
      performed_by: logForm.performed_by.trim() || null,
      notes:        logForm.notes.trim()        || null,
      cost:         logForm.cost ? parseFloat(logForm.cost) : null,
      performed_at: performedAt,
    });
    if (logErr) { setError(logErr.message); setSaving(false); return; }
    // Update last_service_at on the asset
    await supabase.from('pmi_assets').update({ last_service_at: performedAt }).eq('id', selected.id);
    setSaving(false);
    setLogForm(EMPTY_LOG);
    setShowLog(false);
    loadAssets();
    // Refresh the selected asset + logs
    const { data } = await supabase.from('pmi_assets').select('*').eq('id', selected.id).single();
    if (data) setSelected(data as PMIAsset);
  }

  // ── Detail view ───────────────────────────────────────────────────────────────

  if (selected) {
    const status = getPMIStatus(selected);
    const due    = daysUntilDue(selected);
    const ss     = STATUS_STYLE[status];
    return (
      <div style={S.page}>
        <div style={{ ...S.row, marginBottom: 20 }}>
          <button style={S.btnGhost} onClick={() => { setSelected(null); setShowLog(false); }}>← Back</button>
          <button style={S.btnGreen} onClick={() => setShowLog(s => !s)}>+ Log Service</button>
        </div>

        <div style={S.card}>
          <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>{selected.name}</p>
          {(selected.make || selected.model || selected.year) && (
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 8 }}>
              {[selected.year, selected.make, selected.model].filter(Boolean).join(' ')}
            </p>
          )}
          {selected.serial_number && (
            <p style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 8 }}>SN: {selected.serial_number}</p>
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

        {/* Log service form */}
        {showLog && (
          <form onSubmit={handleLogService} style={{ ...S.card, display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>LOG SERVICE</p>
            <div>
              <p style={S.label}>Service type *</p>
              <select
                style={S.input}
                value={logForm.service_type}
                onChange={e => setLogForm(p => ({ ...p, service_type: e.target.value }))}
                required
              >
                <option value="">Select type...</option>
                {serviceTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
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
              <input style={S.input} placeholder="What was done..." value={logForm.notes} onChange={e => setLogForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <button type="submit" style={{ ...S.btnGreen, opacity: saving ? 0.6 : 1 }} disabled={saving}>
              {saving ? 'Saving…' : 'Save Service Log'}
            </button>
          </form>
        )}

        {/* Service history */}
        <p style={{ ...S.label, marginBottom: 10 }}>Service history</p>
        {logsLoading ? (
          <p style={{ color: '#475569', fontSize: '0.8rem' }}>Loading…</p>
        ) : logs.length === 0 ? (
          <p style={{ color: '#334155', fontSize: '0.8rem', textAlign: 'center' as const, padding: '24px 0' }}>No service logged yet</p>
        ) : (
          logs.map(log => (
            <div key={log.id} style={{ ...S.card, marginBottom: 8 }}>
              <div style={S.row}>
                <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f1f5f9' }}>{log.service_type}</p>
                <p style={{ fontSize: '0.75rem', color: '#475569' }}>{new Date(log.performed_at).toLocaleDateString()}</p>
              </div>
              {log.performed_by && <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>By: {log.performed_by}</p>}
              {log.cost != null && <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Cost: ${Number(log.cost).toFixed(2)}</p>}
              {log.notes && <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 6 }}>{log.notes}</p>}
            </div>
          ))
        )}
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────────

  const overdue  = assets.filter(a => getPMIStatus(a) === 'OVERDUE').length;
  const dueSoon  = assets.filter(a => getPMIStatus(a) === 'DUE_SOON').length;

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
            <input style={S.input} placeholder={`e.g. John Deere 5075E`} value={assetForm.name} onChange={e => setAssetForm(p => ({ ...p, name: e.target.value }))} autoFocus required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <p style={S.label}>Type</p>
              <select style={S.input} value={assetForm.asset_type} onChange={e => setAssetForm(p => ({ ...p, asset_type: e.target.value }))}>
                <option value="">Select...</option>
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
              <p style={S.label}>PMI every (days)</p>
              <input style={S.input} type="number" placeholder="90" value={assetForm.pmi_interval_days} onChange={e => setAssetForm(p => ({ ...p, pmi_interval_days: e.target.value }))} />
            </div>
          </div>
          <div>
            <p style={S.label}>Notes</p>
            <input style={S.input} placeholder="Any notes..." value={assetForm.notes} onChange={e => setAssetForm(p => ({ ...p, notes: e.target.value }))} />
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
          const status = getPMIStatus(asset);
          const ss     = STATUS_STYLE[status];
          const due    = daysUntilDue(asset);
          return (
            <div
              key={asset.id}
              style={{ ...S.card, cursor: 'pointer', borderColor: status === 'OVERDUE' ? '#7f1d1d' : status === 'DUE_SOON' ? '#7c2d12' : '#1e293b' }}
              onClick={() => { setSelected(asset); setShowLog(false); }}
            >
              <div style={S.row}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f1f5f9', marginBottom: 2 }}>{asset.name}</p>
                  {(asset.make || asset.model || asset.year) && (
                    <p style={{ fontSize: '0.8rem', color: '#64748b' }}>{[asset.year, asset.make, asset.model].filter(Boolean).join(' ')}</p>
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
            </div>
          );
        })
      )}
    </div>
  );
}
