import React, { useState, useEffect } from 'react';
import { Wrench, Plus, Clock, ToggleLeft, ToggleRight, X, Shield, Barcode } from 'lucide-react';
import DataBridge from '../DataBridge';
import { supabase } from '../supabase';

const STYLE_DEBUG = true;

// Non-1:1 mappings (48 classNames converted):
// (1) PMI_BADGES.*.classes Tailwind strings → CSS value objects (restructured)
// (2) Conditional className strings on toggle/tab buttons → conditional inline styles
// (3) grid grid-cols-2 gap-3 → flex-wrap (flagged: no breakpoint equivalent)
// (4) focus:border-blue-500 on inputs → ign-input CSS class
// (5) hover:text-white on X button → dropped (cosmetic)
// (6) hover:border-blue-500 hover:text-blue-500 on add-tool button → ign-btn-ghost CSS class
// (7) active:scale-95 on submit button → ign-card-hover CSS class
// [TRACE:STYLE] IgnitionTools converted, 48 classNames → inline, 7 non-1:1 categories

// PMI_BADGES restructured: CSS value objects instead of Tailwind class strings
const PMI_BADGES = {
  OVERDUE:  { label: 'PMI OVERDUE',  color: '#f87171', borderColor: 'rgba(239,68,68,0.30)',   backgroundColor: 'rgba(239,68,68,0.10)'   },
  DUE_SOON: { label: 'PMI DUE SOON', color: '#fbbf24', borderColor: 'rgba(245,158,11,0.30)',  backgroundColor: 'rgba(245,158,11,0.10)'  },
  OK:       { label: 'PMI OK',       color: '#34d399', borderColor: 'rgba(16,185,129,0.30)',  backgroundColor: 'rgba(16,185,129,0.10)'  },
};

const getStatusStyle = (status) => {
  if (status === 'ACTIVE')  return { color: '#34d399', borderColor: 'rgba(16,185,129,0.30)', backgroundColor: 'rgba(16,185,129,0.10)' };
  if (status === 'OVERDUE') return { color: '#f87171', borderColor: 'rgba(239,68,68,0.30)',  backgroundColor: 'rgba(239,68,68,0.10)'  };
  return { color: '#64748b', borderColor: '#334155', backgroundColor: '#1e293b' };
};

const getPmiStatus = (tool) => {
  if (!tool.pmi_interval_days || !tool.last_pmi_at) return null;
  const daysSince = (Date.now() - new Date(tool.last_pmi_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > tool.pmi_interval_days) return 'OVERDUE';
  if (daysSince > tool.pmi_interval_days - 7) return 'DUE_SOON';
  return 'OK';
};

const EMPTY_FORM = { name: '', type: '', brand: '', model: '', serial: '', barcode_id: '', pmi_interval_days: '' };

const badgeBase = {
  fontSize: 9,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  padding: '4px 8px',
  borderRadius: 4,
  border: '1px solid',
};

const inputStyle = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 12,
  padding: '12px 16px',
  color: '#ffffff',
  fontSize: 14,
  outline: 'none',
  width: '100%',
};

const IgnitionTools = () => {
  const [tools, setTools] = useState([]);
  const [bypassLog, setBypassLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('registry');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  if (STYLE_DEBUG) console.log('[TRACE:STYLE] IgnitionTools converted, 48 classNames → inline, 7 non-1:1 categories');

  const shopId = DataBridge.getShopId();
  const currentUser = DataBridge.load('current_user');
  const isAdmin = currentUser?.permissions?.includes('ADMIN');

  const [custodyEnabled, setCustodyEnabled] = useState(() =>
    (DataBridge.load('shop_policy') || {}).enable_bay_custody || false
  );

  const loadTools = async () => {
    if (!shopId) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('tools')
      .select('*')
      .eq('shop_id', shopId)
      .order('added_at', { ascending: false });
    if (err) setError(err.message);
    else setTools(data || []);
    setLoading(false);
  };

  const loadBypassLog = async () => {
    if (!shopId) return;
    const { data } = await supabase
      .from('tool_signout_log')
      .select('*')
      .eq('shop_id', shopId)
      .eq('is_manager_bypass', true)
      .order('created_at', { ascending: false })
      .limit(50);
    setBypassLog(data || []);
  };

  useEffect(() => { loadTools(); }, []);
  useEffect(() => { if (custodyEnabled && view === 'log') loadBypassLog(); }, [custodyEnabled, view]);

  const toggleCustody = () => {
    const next = !custodyEnabled;
    DataBridge.save('shop_policy', { ...(DataBridge.load('shop_policy') || {}), enable_bay_custody: next });
    setCustodyEnabled(next);
  };

  const handleAddTool = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim()) return;
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('tools').insert({
      shop_id: shopId,
      name: addForm.name.trim(),
      type: addForm.type.trim() || null,
      brand: addForm.brand.trim() || null,
      model: addForm.model.trim() || null,
      serial: addForm.serial.trim() || null,
      barcode_id: addForm.barcode_id.trim() || null,
      pmi_interval_days: addForm.pmi_interval_days ? parseInt(addForm.pmi_interval_days) : null,
      status: 'ACTIVE',
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setAddForm(EMPTY_FORM);
    setShowAddForm(false);
    loadTools();
  };

  return (
    <div style={{ padding: 24, paddingBottom: 128, backgroundColor: '#020617', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '-0.05em', color: '#ffffff' }}>
            Hardware Ledger
          </h1>
          <p style={{ fontSize: 10, color: '#64748b', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>
            Tool Registry & PMI Tracking
          </p>
        </div>
        {isAdmin && (
          /* Conditional className → conditional inline styles */
          <button
            onClick={toggleCustody}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 16,
              border: '1px solid',
              fontSize: 10,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              transition: 'all 0.15s',
              cursor: 'pointer',
              borderColor: custodyEnabled ? 'rgba(59,130,246,0.40)' : '#334155',
              backgroundColor: custodyEnabled ? 'rgba(59,130,246,0.10)' : '#0f172a',
              color: custodyEnabled ? '#60a5fa' : '#64748b',
            }}
          >
            {custodyEnabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            Bay Custody {custodyEnabled ? 'ON' : 'OFF'}
          </button>
        )}
      </div>

      {custodyEnabled && (
        <div style={{ marginBottom: 16, padding: '12px 16px', backgroundColor: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.20)', borderRadius: 16 }}>
          <p style={{ color: '#60a5fa', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Bay custody active — techs must acknowledge all tools at job closeout
          </p>
        </div>
      )}

      {/* Tab buttons — conditional className → conditional inline styles */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button
          onClick={() => setView('registry')}
          style={{
            padding: '8px 16px',
            borderRadius: 12,
            fontSize: 10,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            border: '1px solid',
            transition: 'all 0.15s',
            cursor: 'pointer',
            backgroundColor: view === 'registry' ? '#ffffff' : '#0f172a',
            color: view === 'registry' ? '#000000' : '#94a3b8',
            borderColor: view === 'registry' ? '#ffffff' : '#1e293b',
          }}
        >
          Registry
        </button>
        {custodyEnabled && (
          <button
            onClick={() => setView('log')}
            style={{
              padding: '8px 16px',
              borderRadius: 12,
              fontSize: 10,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              border: '1px solid',
              transition: 'all 0.15s',
              cursor: 'pointer',
              backgroundColor: view === 'log' ? '#ffffff' : '#0f172a',
              color: view === 'log' ? '#000000' : '#94a3b8',
              borderColor: view === 'log' ? '#ffffff' : '#1e293b',
            }}
          >
            Bypass Log
          </button>
        )}
      </div>

      {error && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 16, fontWeight: 700 }}>{error}</p>}

      {view === 'registry' && (
        <>
          {loading ? (
            <div style={{ color: '#64748b', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center', paddingTop: 64, paddingBottom: 64 }}>
              Loading...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tools.length === 0 && !showAddForm && (
                <div style={{ textAlign: 'center', paddingTop: 64, paddingBottom: 64, color: '#475569' }}>
                  <Wrench size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                  <p style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>No tools registered</p>
                </div>
              )}
              {tools.map(tool => {
                const pmiStatus = getPmiStatus(tool);
                const pmiBadge = pmiStatus ? PMI_BADGES[pmiStatus] : null;
                const statusStyle = getStatusStyle(tool.status);
                return (
                  <div key={tool.id} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 20 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <p style={{ color: '#ffffff', fontWeight: 900, fontSize: 14 }}>{tool.name}</p>
                        {/* Status badge — conditional className → getStatusStyle() */}
                        <span style={{ ...badgeBase, ...statusStyle }}>{tool.status}</span>
                        {/* PMI badge — pmiBadge.classes Tailwind → pmiBadge CSS values */}
                        {pmiBadge && (
                          <span style={{ ...badgeBase, color: pmiBadge.color, borderColor: pmiBadge.borderColor, backgroundColor: pmiBadge.backgroundColor }}>
                            {pmiBadge.label}
                          </span>
                        )}
                      </div>
                      {(tool.brand || tool.model || tool.serial) && (
                        <p style={{ color: '#64748b', fontSize: 12 }}>{[tool.brand, tool.model, tool.serial].filter(Boolean).join(' · ')}</p>
                      )}
                      {tool.barcode_id && (
                        <p style={{ color: '#475569', fontSize: 10, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Barcode size={10} /> {tool.barcode_id}
                        </p>
                      )}
                      {tool.pmi_interval_days && (
                        <p style={{ color: '#475569', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={10} /> PMI every {tool.pmi_interval_days} days
                          {tool.last_pmi_at && ` · Last: ${new Date(tool.last_pmi_at).toLocaleDateString()}`}
                        </p>
                      )}
                      {tool.last_assigned_tech && (
                        <p style={{ color: '#475569', fontSize: 10 }}>Last tech: {tool.last_assigned_tech}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {showAddForm ? (
            <form onSubmit={handleAddTool} style={{ marginTop: 16, backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ffffff' }}>Add Tool</h3>
                {/* hover:text-white on X → dropped (cosmetic) */}
                <button type="button" onClick={() => setShowAddForm(false)} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}>
                  <X size={16} />
                </button>
              </div>
              {/* focus:border-blue-500 → ign-input CSS class */}
              <input
                required
                placeholder="Tool Name *"
                value={addForm.name}
                onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                className="ign-input"
                style={inputStyle}
              />
              {/* grid grid-cols-2 → flex-wrap; flagged: no breakpoint */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {[
                  { key: 'type',       placeholder: 'Type (Scanner, Torque...)' },
                  { key: 'brand',      placeholder: 'Brand' },
                  { key: 'model',      placeholder: 'Model' },
                  { key: 'serial',     placeholder: 'Serial #' },
                  { key: 'barcode_id', placeholder: 'Barcode ID' },
                ].map(({ key, placeholder }) => (
                  <input
                    key={key}
                    placeholder={placeholder}
                    value={addForm[key]}
                    onChange={e => setAddForm(p => ({ ...p, [key]: e.target.value }))}
                    className="ign-input"
                    style={{ ...inputStyle, flex: '1 1 calc(50% - 6px)', minWidth: 140 }}
                  />
                ))}
                <input
                  type="number"
                  placeholder="PMI Interval (days)"
                  value={addForm.pmi_interval_days}
                  onChange={e => setAddForm(p => ({ ...p, pmi_interval_days: e.target.value }))}
                  className="ign-input"
                  style={{ ...inputStyle, flex: '1 1 calc(50% - 6px)', minWidth: 140 }}
                />
              </div>
              {/* active:scale-95 → ign-card-hover; disabled:opacity-50 → conditional inline opacity */}
              <button
                type="submit"
                disabled={saving}
                className="ign-card-hover"
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  paddingTop: 16,
                  paddingBottom: 16,
                  borderRadius: 16,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontSize: 10,
                  transition: 'all 0.15s',
                  border: 'none',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Add Tool'}
              </button>
            </form>
          ) : (
            isAdmin && (
              /* hover:border-blue-500 hover:text-blue-500 → ign-btn-ghost CSS class */
              <button
                onClick={() => setShowAddForm(true)}
                className="ign-btn-ghost"
                style={{
                  marginTop: 16,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingTop: 16,
                  paddingBottom: 16,
                  border: '2px dashed #334155',
                  borderRadius: 16,
                  color: '#64748b',
                  transition: 'all 0.15s',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                }}
              >
                <Plus size={18} />
                <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Add Tool</span>
              </button>
            )
          )}
        </>
      )}

      {view === 'log' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {bypassLog.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 64, paddingBottom: 64, color: '#475569' }}>
              <Shield size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <p style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>No manager bypasses on record</p>
            </div>
          ) : (
            bypassLog.map(entry => (
              <div key={entry.id} style={{ backgroundColor: '#0f172a', border: '1px solid rgba(245,158,11,0.20)', borderRadius: 16, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <p style={{ color: '#ffffff', fontWeight: 900, fontSize: 14 }}>{entry.tool_name}</p>
                    <p style={{ color: '#64748b', fontSize: 12 }}>{entry.tech_name} · {new Date(entry.created_at).toLocaleString()}</p>
                  </div>
                  <span style={{ ...badgeBase, color: '#fbbf24', borderColor: 'rgba(245,158,11,0.30)', backgroundColor: 'rgba(245,158,11,0.10)' }}>
                    Manager Override
                  </span>
                </div>
                {entry.bypass_reason && (
                  <p style={{ color: '#cbd5e1', fontSize: 12, marginTop: 8, backgroundColor: '#1e293b', borderRadius: 12, padding: '8px 12px' }}>{entry.bypass_reason}</p>
                )}
                {entry.bypass_by && (
                  <p style={{ color: '#475569', fontSize: 10, marginTop: 8 }}>Override by: {entry.bypass_by}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default IgnitionTools;
